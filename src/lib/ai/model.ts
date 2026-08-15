import 'server-only'
import { createOpenAI } from '@ai-sdk/openai'
import { modelEnvOrThrow } from '@/lib/env'
import { getAccessToken, COGNITIVE_SCOPE } from './credential'

/**
 * Chat model, served by Microsoft Foundry Models.
 *
 * Foundry exposes an OpenAI-compatible surface at `/openai/v1`, so this uses
 * the plain OpenAI provider with a custom `baseURL` rather than the Azure
 * provider. That matters for two reasons:
 *
 *   · The Azure provider rewrites the URL (`{baseURL}/v1{path}`, or
 *     `/deployments/{id}` in legacy mode), which fights an endpoint that
 *     already carries its own path.
 *   · Foundry accepts the credential as a bearer token whether it is an API
 *     key or an Entra token, so one header covers both auth modes instead of
 *     the key/token split the Azure provider needs.
 *
 * Verified against gpt-5.4-mini: streaming, tool calling and structured
 * output all work through this path.
 */

let cached: ReturnType<typeof createOpenAI> | null = null

/**
 * Injects a freshly-minted Entra token on every request.
 *
 * The provider's `headers` option is synchronous, so it cannot await a token.
 * Wrapping fetch is the supported way to add a credential that has to be
 * fetched and can expire mid-session.
 */
const entraFetch: typeof fetch = async (input, init) => {
  const token = await getAccessToken(COGNITIVE_SCOPE)
  const headers = new Headers(init?.headers)
  headers.set('authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

function provider() {
  if (cached) return cached
  const env = modelEnvOrThrow()

  // Accept the endpoint with or without a trailing slash: Foundry's own
  // sample code prints it both ways.
  const baseURL = env.AZURE_FOUNDRY_ENDPOINT.replace(/\/+$/, '')
  const apiKey = env.AZURE_FOUNDRY_API_KEY

  cached = createOpenAI({
    baseURL,
    // An empty apiKey would make the provider throw before the wrapped fetch
    // ever runs, so a placeholder stands in and is then overwritten.
    apiKey: apiKey ?? 'entra',
    ...(apiKey ? {} : { fetch: entraFetch }),
  })

  return cached
}

export function chatModel() {
  return provider()(modelEnvOrThrow().AZURE_FOUNDRY_DEPLOYMENT)
}

export function embeddingModel() {
  const deployment = process.env.AZURE_FOUNDRY_EMBEDDING_DEPLOYMENT?.trim()
  if (!deployment) {
    throw new Error('Falta AZURE_FOUNDRY_EMBEDDING_DEPLOYMENT para RAG nativo.')
  }
  return provider().embeddingModel(deployment)
}

/** Resets the memoized provider. Tests only. */
export function resetModelCache() {
  cached = null
}
