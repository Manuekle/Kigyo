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
 * Both API keys are optional: leaving them unset is what selects Microsoft
 * Entra, which is the recommended production configuration. Requiring
 * AZURE_OPENAI_API_KEY here would have made the Entra path in ai/model.ts
 * unreachable — `aiEnv()` returns null without it, so the assistant would
 * report "not configured" on a correctly configured managed identity.
 */
const aiSchema = z.object({
  AZURE_SEARCH_ENDPOINT: z.url(),
  FOUNDRY_IQ_KNOWLEDGE_BASE: z.string().min(1),
  FOUNDRY_IQ_KNOWLEDGE_SOURCE: z.string().min(1),
  AZURE_SEARCH_API_KEY: optionalSecret,

  AZURE_OPENAI_ENDPOINT: z.url(),
  AZURE_OPENAI_API_KEY: optionalSecret,
  AZURE_OPENAI_DEPLOYMENT: z.string().min(1),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-10-21'),
})

export type ServerEnv = z.infer<typeof serverSchema>
export type AiEnv = z.infer<typeof aiSchema>

let cachedServer: ServerEnv | null = null

function format(issues: z.core.$ZodIssue[]): string {
  return issues.map((i) => `  · ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
}

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

let cachedAi: AiEnv | null = null

/**
 * Returns null when the AI stack is not configured, so the assistant can
 * degrade to a clear "not configured" response instead of crashing a page
 * that merely happens to render an insights panel.
 */
export function aiEnv(): AiEnv | null {
  if (cachedAi) return cachedAi
  const parsed = aiSchema.safeParse(process.env)
  if (!parsed.success) return null
  cachedAi = parsed.data
  return cachedAi
}

export function aiEnvOrThrow(): AiEnv {
  const env = aiEnv()
  if (!env) {
    const parsed = aiSchema.safeParse(process.env)
    const detail = parsed.success ? '' : `\n${format(parsed.error.issues)}`
    throw new Error(
      `Falta configurar Microsoft Foundry.${detail}\n` +
        'Revisa la sección de Foundry en .env.local (guía en docs/SETUP.md).',
    )
  }
  return env
}

export const isProduction = process.env.NODE_ENV === 'production'
