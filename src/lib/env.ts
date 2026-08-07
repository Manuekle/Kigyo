import 'server-only'
import { z } from 'zod'

/**
 * Server-side environment, validated once at first access.
 *
 * Everything here is read lazily rather than at module scope: `next build`
 * imports route modules to collect metadata, and a hard failure at import time
 * would make the build depend on production secrets being present.
 */

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.url(),
})

/**
 * A key left blank in the env file means "not set".
 *
 * `.optional()` alone does not cover this: `FOO=` puts an empty string in
 * process.env, which is present, so the field is validated rather than
 * skipped. Every scaffolded .env has blank lines for the keys you are not
 * using, so this is the normal case, not the edge case.
 */
const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
)

/**
 * The chat model — Microsoft Foundry Models.
 *
 * The endpoint is the OpenAI-compatible surface Foundry exposes, e.g.
 * `https://<recurso>.openai.azure.com/openai/v1` or
 * `https://<recurso>.services.ai.azure.com/openai/v1`. Both work; both accept
 * the key as `api-key` or as a bearer token, so one code path covers keys and
 * Microsoft Entra alike.
 *
 * The API key is optional: leaving it blank selects Entra, which is the
 * recommended production configuration.
 */
const modelSchema = z.object({
  AZURE_FOUNDRY_ENDPOINT: z.url(),
  AZURE_FOUNDRY_DEPLOYMENT: z.string().min(1),
  AZURE_FOUNDRY_API_KEY: optionalSecret,
})

/**
 * Foundry IQ retrieval — **optional**.
 *
 * A Foundry IQ knowledge base is a separate resource from Foundry Models: it
 * is served by an Azure AI Search service and has to be created and indexed on
 * its own. Plenty of installs have Models and no knowledge base.
 *
 * Without it the assistant still works: it answers from live database queries,
 * which is where the operational questions are answered anyway. What is lost
 * is grounding on uploaded documents, and answers carry no citations.
 */
const retrievalSchema = z.object({
  AZURE_SEARCH_ENDPOINT: z.url(),
  FOUNDRY_IQ_KNOWLEDGE_BASE: z.string().min(1),
  FOUNDRY_IQ_KNOWLEDGE_SOURCE: z.string().min(1),
  AZURE_SEARCH_API_KEY: optionalSecret,
})

export type ServerEnv = z.infer<typeof serverSchema>
export type ModelEnv = z.infer<typeof modelSchema>
export type RetrievalEnv = z.infer<typeof retrievalSchema>

function format(issues: z.core.$ZodIssue[]): string {
  return issues.map((i) => `  · ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
}

let cachedServer: ServerEnv | null = null

export function serverEnv(): ServerEnv {
  if (cachedServer) return cachedServer
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(
      `Falta configurar el entorno.\n${format(parsed.error.issues)}\n` +
        'Copia .env.example a .env.local y complétalo (guía en docs/SETUP.md).',
    )
  }
  cachedServer = parsed.data
  return cachedServer
}

let cachedModel: ModelEnv | null = null

/**
 * Returns null when no chat model is configured, so the assistant can report
 * that plainly instead of crashing a page that merely renders an insights
 * panel.
 */
export function modelEnv(): ModelEnv | null {
  if (cachedModel) return cachedModel
  const parsed = modelSchema.safeParse(process.env)
  if (!parsed.success) return null
  cachedModel = parsed.data
  return cachedModel
}

export function modelEnvOrThrow(): ModelEnv {
  const env = modelEnv()
  if (!env) {
    const parsed = modelSchema.safeParse(process.env)
    const detail = parsed.success ? '' : `\n${format(parsed.error.issues)}`
    throw new Error(
      `Falta configurar el modelo de Microsoft Foundry.${detail}\n` +
        'Revisa AZURE_FOUNDRY_* en .env.local (guía en docs/SETUP.md).',
    )
  }
  return env
}

let cachedRetrieval: RetrievalEnv | null = null

/** Null whenever Foundry IQ is not set up — an expected state, not an error. */
export function retrievalEnv(): RetrievalEnv | null {
  if (cachedRetrieval) return cachedRetrieval
  const parsed = retrievalSchema.safeParse(process.env)
  if (!parsed.success) return null
  cachedRetrieval = parsed.data
  return cachedRetrieval
}

export function retrievalEnvOrThrow(): RetrievalEnv {
  const env = retrievalEnv()
  if (!env) {
    const parsed = retrievalSchema.safeParse(process.env)
    const detail = parsed.success ? '' : `\n${format(parsed.error.issues)}`
    throw new Error(
      `Falta configurar Foundry IQ.${detail}\n` +
        'Es opcional: sin él, el asistente responde desde la base de datos, ' +
        'pero sin citas de documentos.',
    )
  }
  return env
}

export const isProduction = process.env.NODE_ENV === 'production'
