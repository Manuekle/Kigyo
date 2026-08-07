import 'server-only'
import {
  ClientSecretCredential,
  DefaultAzureCredential,
  type TokenCredential,
} from '@azure/identity'

/**
 * Microsoft Entra token acquisition, shared by the Foundry IQ retrieval client
 * and the Azure OpenAI provider.
 *
 * Entra is preferred over API keys everywhere: keys cannot be scoped, rotate
 * without a deploy, or be attributed to a caller. A key is still accepted for
 * local development, and each caller decides whether to fall back to one.
 */

let cached: TokenCredential | null = null

export function azureCredential(): TokenCredential {
  if (cached) return cached

  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET

  cached =
    tenantId && clientId && clientSecret
      ? new ClientSecretCredential(tenantId, clientId, clientSecret)
      : // Picks up a managed identity in Azure, the Azure CLI login locally,
        // and workload identity in Kubernetes.
        new DefaultAzureCredential()

  return cached
}

interface CachedToken {
  token: string
  expiresAt: number
}

const tokens = new Map<string, CachedToken>()

/**
 * Returns a bearer token for `scope`, reusing it until shortly before expiry.
 *
 * The 5-minute skew matters: a token that expires mid-flight produces a 401 on
 * a streaming response, which surfaces to the user as a truncated answer
 * rather than as an error.
 */
export async function getAccessToken(scope: string): Promise<string> {
  const hit = tokens.get(scope)
  if (hit && hit.expiresAt > Date.now() + 5 * 60_000) return hit.token

  const credential = azureCredential()
  const result = await credential.getToken(scope)

  if (!result?.token) {
    throw new Error(
      `No se pudo obtener un token de Entra para ${scope}. ` +
        'Configura AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET, ' +
        'o ejecuta `az login`, o usa una identidad administrada.',
    )
  }

  tokens.set(scope, { token: result.token, expiresAt: result.expiresOnTimestamp })
  return result.token
}

export const SEARCH_SCOPE = 'https://search.azure.com/.default'
export const COGNITIVE_SCOPE = 'https://cognitiveservices.azure.com/.default'
