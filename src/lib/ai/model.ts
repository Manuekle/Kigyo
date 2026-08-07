import 'server-only'
import { createAzure } from '@ai-sdk/azure'
import { aiEnvOrThrow } from '@/lib/env'
import { getAccessToken, COGNITIVE_SCOPE } from './credential'

/**
 * Chat model, served by Azure OpenAI in Foundry Models.
 *
 * Foundry IQ's stable retrieval API returns extractive content only — it no
 * longer synthesizes an answer — so this model does the synthesis over what
 * retrieval and the Supabase tools return.
 */

let cached: ReturnType<typeof createAzure> | null = null

function provider() {
  if (cached) return cached
  const env = aiEnvOrThrow()

  cached = createAzure({
    baseURL: `${env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '')}/openai`,
    apiVersion: env.AZURE_OPENAI_API_VERSION,
    useDeploymentBasedUrls: true,
    // Entra when no key is set. `tokenProvider` runs per request and the
    // helper caches until shortly before expiry.
    ...(env.AZURE_OPENAI_API_KEY
      ? { apiKey: env.AZURE_OPENAI_API_KEY }
      : { tokenProvider: () => getAccessToken(COGNITIVE_SCOPE) }),
  })

  return cached
}

export function chatModel() {
  return provider()(aiEnvOrThrow().AZURE_OPENAI_DEPLOYMENT)
}
