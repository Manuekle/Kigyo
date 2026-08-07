import { generateObject } from 'ai'
import { z } from 'zod'
import { route } from '@/lib/api/handler'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { aiEnv } from '@/lib/env'
import { chatModel } from '@/lib/ai/model'

/**
 * Dashboard insights and recommendations.
 *
 * What this replaces: `fetch('https://api.anthropic.com/v1/messages')` issued
 * **from the browser** in the dashboard page. It carried no key, so it always
 * failed silently into the fallback copy — and had a key ever been added, it
 * would have shipped in the client bundle.
 *
 * Results are cached per organization: regenerating on every dashboard view is
 * slow and billable, and the underlying figures move on the order of hours.
 */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000

const TONES = ['red', 'amb', 'grn', 'blu', 'vio'] as const

const insightsSchema = z.object({
  insights: z
    .array(
      z.object({
        title: z.string().max(40).describe('Máximo 4 palabras.'),
        desc: z.string().max(120),
        tone: z.enum(TONES),
      }),
    )
    .length(3),
  recs: z
    .array(
      z.object({
        prioridad: z.enum(['Urgente', 'Importante', 'Pronto']),
        cat: z.enum(['Retención', 'Cumplimiento', 'Desarrollo', 'Operación', 'Finanzas']),
        titulo: z.string().max(60).describe('Máximo 6 palabras.'),
        razon: z.string().max(110),
        tone: z.enum(TONES),
      }),
    )
    .length(3),
})

export type Insights = z.infer<typeof insightsSchema>

/** Real aggregates, so the model summarizes facts instead of inventing them. */
async function gatherSnapshot() {
  const supabase = await createClient()

  const [employees, signatures, tickets, risks, documents, assets] = await Promise.all([
    supabase.from('employees').select('status', { count: 'exact', head: false }).is('deleted_at', null),
    supabase.from('signature_requests').select('status, due_on').is('deleted_at', null),
    supabase.from('tickets').select('status, priority, area').is('deleted_at', null),
    supabase.from('risks').select('severity, category, status').is('deleted_at', null),
    supabase.from('documents').select('status, expires_on').is('deleted_at', null),
    supabase.from('inventory_assets').select('status').is('deleted_at', null),
  ])

  const tally = <T extends Record<string, unknown>>(rows: T[] | null, key: keyof T) =>
    (rows ?? []).reduce<Record<string, number>>((acc, row) => {
      const value = String(row[key] ?? 'Sin definir')
      acc[value] = (acc[value] ?? 0) + 1
      return acc
    }, {})

  const today = new Date().toISOString().slice(0, 10)

  return {
    empleados: { total: employees.data?.length ?? 0, porEstado: tally(employees.data, 'status') },
    firmas: {
      total: signatures.data?.length ?? 0,
      porEstado: tally(signatures.data, 'status'),
      vencidas: (signatures.data ?? []).filter(
        (row) => row.status === 'Pendiente' && row.due_on !== null && row.due_on < today,
      ).length,
    },
    tickets: {
      total: tickets.data?.length ?? 0,
      porEstado: tally(tickets.data, 'status'),
      porPrioridad: tally(tickets.data, 'priority'),
      porArea: tally(tickets.data, 'area'),
    },
    riesgos: {
      abiertos: (risks.data ?? []).filter((row) => row.status === 'Abierto').length,
      porSeveridad: tally(
        (risks.data ?? []).filter((row) => row.status === 'Abierto'),
        'severity',
      ),
    },
    documentos: {
      total: documents.data?.length ?? 0,
      porEstado: tally(documents.data, 'status'),
      porVencer: (documents.data ?? []).filter(
        (row) => row.expires_on !== null && row.expires_on >= today,
      ).length,
    },
    inventario: { total: assets.data?.length ?? 0, porEstado: tally(assets.data, 'status') },
  }
}

export const POST = route({
  permission: 'ia:use',
  rateLimit: RATE_LIMITS.aiInsights,
  async handler({ member, searchParams }) {
    const supabase = await createClient()
    const force = searchParams.get('refresh') === '1'

    if (!force) {
      const { data: cached } = await supabase
        .from('ai_insights')
        .select('payload, generated_at, expires_at')
        .eq('org_id', member.orgId)
        .eq('kind', 'dashboard')
        .maybeSingle()

      if (cached && new Date(cached.expires_at) > new Date()) {
        return { ...(cached.payload as Insights), generatedAt: cached.generated_at, cached: true }
      }
    }

    if (!aiEnv()) {
      // Not an error the dashboard should surface as a failure: the page has
      // static fallback copy and simply keeps using it.
      return { unavailable: true as const, reason: 'Microsoft Foundry no está configurado.' }
    }

    const snapshot = await gatherSnapshot()

    const { object } = await generateObject({
      model: chatModel(),
      schema: insightsSchema,
      temperature: 0.3,
      system:
        `Eres el analista de operaciones de "${member.orgName}" en Kigyo. ` +
        'Escribe SIEMPRE en español, en tono directo y profesional. ' +
        'Basas todo en las cifras que recibes: no inventes datos ni supongas tendencias ' +
        'que los números no muestren. Si una cifra es cero, dilo en lugar de adornarla.',
      prompt:
        'Estas son las cifras actuales de la organización:\n\n' +
        JSON.stringify(snapshot, null, 2) +
        '\n\nGenera 3 observaciones (lo más relevante que muestran los datos) y ' +
        '3 recomendaciones accionables, ordenadas por impacto.',
    })

    const generatedAt = new Date()
    await supabase.from('ai_insights').upsert(
      {
        org_id: member.orgId,
        kind: 'dashboard',
        payload: object as unknown as never,
        generated_at: generatedAt.toISOString(),
        expires_at: new Date(generatedAt.getTime() + CACHE_TTL_MS).toISOString(),
      },
      { onConflict: 'org_id,kind' },
    )

    return { ...object, generatedAt: generatedAt.toISOString(), cached: false }
  },
})
