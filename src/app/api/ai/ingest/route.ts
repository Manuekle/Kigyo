import { z } from 'zod'
import { route } from '@/lib/api/handler'
import { ApiError, badRequest, notFound } from '@/lib/api/errors'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { indexDocument, nativeRagConfigured, AiBudgetError } from '@/lib/ai/rag'

const querySchema = z.object({ id: z.uuid() })

export const POST = route({
  permission: 'documentos:write',
  rateLimit: RATE_LIMITS.aiReview,
  async handler({ member, searchParams }) {
    if (!can(member.permissions, 'ia:use')) {
      throw new ApiError(403, 'No tienes permiso para usar la IA.')
    }
    if (!nativeRagConfigured()) {
      throw new ApiError(503, 'RAG nativo no configurado. Falta el deployment de embeddings.')
    }

    const parsed = querySchema.safeParse({ id: searchParams.get('id') })
    if (!parsed.success) throw badRequest('Documento desconocido.')

    const supabase = await createClient()
    const { data: document, error } = await supabase
      .from('documents')
      .select('id, name, mime_type, storage_path')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw badRequest('No se pudo leer el documento.')
    if (!document) throw notFound('Documento desconocido.')

    try {
      const result = await indexDocument(supabase, {
        id: document.id,
        orgId: member.orgId,
        name: document.name,
        mimeType: document.mime_type,
        storagePath: document.storage_path,
      })
      return {
        ok: true,
        indexed: result.chunks > 0,
        chunks: result.chunks,
        tokens: result.tokens,
      }
    } catch (error) {
      if (error instanceof AiBudgetError) {
        throw new ApiError(429, error.message)
      }
      console.error('[ai/ingest] failed', error)
      throw badRequest('No se pudo indexar el documento.')
    }
  },
})
