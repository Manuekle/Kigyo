import { generateObject } from 'ai'
import { z } from 'zod'
import { route } from '@/lib/api/handler'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { ApiError, badRequest, notFound } from '@/lib/api/errors'
import { createClient } from '@/lib/supabase/server'
import { modelEnv } from '@/lib/env'
import { chatModel } from '@/lib/ai/model'
import {
  AiBudgetError,
  estimateChatCostCents,
  recordAiUsage,
  reserveAiBudget,
} from '@/lib/ai/rag'

/**
 * The document review that `documents.ai_verdict` was always for.
 *
 * The column has existed since migration 03 and nothing wrote it. The screen
 * used to show an "IA · Análisis automático" tile beside a per-row verdict
 * that came from a fixture — a review nobody had run, presented as one that
 * had. This runs it.
 *
 * Two things bound what the review can honestly say:
 *
 *   · The bucket accepts PDF, Office files and images as well as plain text,
 *     and there is no extractor here for the binary ones. So the file is read
 *     only when it is text, and the model is told which of the two it got.
 *   · Everything else — is a live contract missing its expiry, is the filing
 *     consistent, is the name what the type claims — is answerable from the
 *     row, and is worth answering on its own.
 *
 * The prompt says which case it is in, so a verdict never implies it read a
 * PDF it never saw.
 */

/** Formats we can turn into text here without pulling in an extractor. */
const READABLE_TEXT = new Set(['text/plain', 'text/csv', 'text/markdown', 'application/json'])

/**
 * Enough of the document for a verdict, and no more.
 *
 * A 50 MB CSV is a legal upload; sending it to the model is not. The review is
 * about whether a document is filed correctly and obviously complete, and the
 * opening pages answer that.
 */
const MAX_CHARS = 12_000

const verdictSchema = z.object({
  estado: z
    .enum(['Correcto', 'Revisar', 'Incompleto'])
    .describe(
      'Correcto: nada que corregir. Revisar: hay algo que una persona debería mirar. ' +
      'Incompleto: falta información obligatoria del registro.',
    ),
  veredicto: z
    .string()
    .max(240)
    .describe('Una o dos frases, en español, dirigidas a quien administra el repositorio.'),
})

export type DocumentoRevision = z.infer<typeof verdictSchema> & {
  /** ISO timestamp written to `ai_checked_at`. */
  revisadoEn: string
  /** Whether the file itself was read, or only the registro around it. */
  alcance: 'contenido' | 'registro'
}

export const POST = route({
  permission: 'documentos:write',
  rateLimit: RATE_LIMITS.aiReview,
  async handler({ member, searchParams }) {
    const id = searchParams.get('id') ?? ''
    if (!z.uuid().safeParse(id).success) throw badRequest('Documento desconocido.')

    if (!modelEnv()) {
      throw badRequest('El modelo de Microsoft Foundry no está configurado.')
    }

    const supabase = await createClient()

    // RLS already scopes this to the caller's organization; `org_id` is
    // repeated so a row from elsewhere is a miss rather than a policy error.
    const { data: doc, error } = await supabase
      .from('documents')
      .select(
        'id, code, name, kind, department, status, tags, expires_on, storage_path, mime_type, size_bytes, created_at',
      )
      .eq('id', id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      console.error('[ai/documento] read', error)
      throw badRequest('No se pudo leer el documento.')
    }
    if (!doc) throw notFound('Documento desconocido.')

    const contenido = await readText(supabase, doc.storage_path, doc.mime_type)
    const alcance = contenido === null ? 'registro' : 'contenido'

    const estimatedCostCents = estimateChatCostCents(
      Math.ceil((contenido?.length ?? 1500) / 4),
      200,
    )
    try {
      await reserveAiBudget(supabase, member.orgId, estimatedCostCents)
    } catch (error) {
      if (error instanceof AiBudgetError) throw new ApiError(429, error.message)
      throw error
    }

    const { object, usage } = await generateObject({
      model: chatModel(),
      schema: verdictSchema,
      system:
        `Eres quien revisa el repositorio documental de "${member.orgName}" en Kigyo. ` +
        'Escribe SIEMPRE en español, breve y concreto. ' +
        'Juzgas únicamente lo que se te entrega: si sólo recibes la ficha del ' +
        'documento, no opines sobre su contenido ni supongas qué dice. ' +
        'No inventes fechas, partes ni cláusulas. Si todo está en orden, dilo en ' +
        'una frase en lugar de buscar un defecto.',
      prompt: buildPrompt(doc, contenido, new Date().toISOString().slice(0, 10)),
    })

    const revisadoEn = new Date().toISOString()

    const { error: writeError } = await supabase
      .from('documents')
      .update({
        ai_status: object.estado,
        ai_verdict: object.veredicto,
        ai_checked_at: revisadoEn,
      })
      .eq('id', doc.id)
      .eq('org_id', member.orgId)

    if (writeError) {
      console.error('[ai/documento] write', writeError)
      throw badRequest('Se generó la revisión pero no se pudo guardar.')
    }

    await recordAiUsage(supabase, {
      orgId: member.orgId,
      userId: member.userId,
      documentId: doc.id,
      operation: 'review',
      model: process.env.AZURE_FOUNDRY_DEPLOYMENT ?? 'foundry',
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      estimatedCostCents,
      metadata: { alcance },
    })

    return { ...object, revisadoEn, alcance } satisfies DocumentoRevision
  },
})

/**
 * The file's text, or null when there is nothing readable to send.
 *
 * A download failure is not an error the review should die on — the row is
 * still reviewable, just as a registro. Logged, then treated as "no file".
 */
async function readText(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string | null,
  mimeType: string | null,
): Promise<string | null> {
  if (!storagePath || !mimeType || !READABLE_TEXT.has(mimeType)) return null

  const { data, error } = await supabase.storage.from('documents').download(storagePath)
  if (error || !data) {
    console.error('[ai/documento] download', error)
    return null
  }

  const text = (await data.text()).trim()
  if (!text) return null
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n\n[…texto truncado]` : text
}

interface DocumentFicha {
  code: string | null
  name: string
  kind: string
  department: string
  status: string
  tags: string[]
  expires_on: string | null
  storage_path: string | null
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

function buildPrompt(doc: DocumentFicha, contenido: string | null, today: string): string {
  const ficha = {
    codigo: doc.code,
    nombre: doc.name,
    tipo: doc.kind,
    area: doc.department,
    estado: doc.status,
    etiquetas: doc.tags,
    vence: doc.expires_on,
    tieneArchivo: doc.storage_path !== null,
    formato: doc.mime_type,
    tamanoBytes: doc.size_bytes,
    creado: doc.created_at.slice(0, 10),
    hoy: today,
  }

  const base =
    'Ficha del documento tal como está registrada:\n\n' +
    JSON.stringify(ficha, null, 2)

  if (contenido === null) {
    return (
      `${base}\n\n` +
      'No tienes el contenido del archivo: revisa únicamente el registro. ' +
      'Señala incoherencias entre los campos (por ejemplo un documento "Vigente" ' +
      'cuya fecha de vencimiento ya pasó, un contrato sin fecha de vencimiento, ' +
      'un nombre que no corresponde al tipo declarado, o un registro sin archivo ' +
      'adjunto). No comentes el contenido del documento.'
    )
  }

  return (
    `${base}\n\nContenido del archivo:\n\n${contenido}\n\n` +
    'Revisa el registro y el contenido juntos: ¿el archivo corresponde al tipo y ' +
    'al nombre con que está registrado, y le falta algo evidente (firmas, fechas, ' +
    'partes, anexos que menciona y no incluye)?'
  )
}
