import 'server-only'
import { retrievalEnv, retrievalEnvOrThrow } from '@/lib/env'
import { getAccessToken, SEARCH_SCOPE } from './credential'

/**
 * Microsoft Foundry IQ knowledge-base retrieval.
 *
 * Foundry IQ knowledge bases are served by the Azure AI Search service behind
 * the Foundry project, so this speaks the Search Service REST API directly:
 *
 *   POST {endpoint}/knowledgebases('{name}')/retrieve?api-version=2026-04-01
 *
 * 2026-04-01 is the first stable version for agentic retrieval. It differs
 * from 2025-11-01-preview in ways that matter here: answer synthesis and model
 * query planning were removed, `messages` became `intents`, and the response
 * is extractive grounded content plus `references[]`. Synthesis is therefore
 * ours to do — see chat/route.ts, which feeds this into an Azure OpenAI model.
 *
 * Reference:
 * https://learn.microsoft.com/en-us/rest/api/searchservice/knowledge-retrieval/retrieve?view=rest-searchservice-2026-04-01
 */

const API_VERSION = '2026-04-01'

/**
 * Whether a Foundry IQ knowledge base is configured.
 *
 * Retrieval is optional. A knowledge base is an Azure AI Search resource that
 * has to be created and indexed separately from the chat model, so an install
 * with Models and no knowledge base is a normal state — the assistant answers
 * from live database queries instead, without document citations.
 */
export function isRetrievalConfigured(): boolean {
  return retrievalEnv() !== null
}

export interface RetrievalIntent {
  type: 'semantic'
  search: string
}

export interface SearchIndexReference {
  type: 'searchIndex'
  id: string
  activitySource: number
  docKey?: string
  rerankerScore?: number
  sourceData?: Record<string, unknown>
}

export interface WebReference {
  type: 'web'
  id: string
  activitySource: number
  title?: string
  url?: string
  rerankerScore?: number
  sourceData?: Record<string, unknown>
}

export type KnowledgeReference =
  | SearchIndexReference
  | WebReference
  | { type: 'azureBlob' | 'indexedOneLake'; id: string; activitySource: number; [key: string]: unknown }

export interface ActivityRecord {
  type: string
  id: number
  elapsedMs?: number
  count?: number
  knowledgeSourceName?: string
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  error?: { code?: string; message?: string }
}

export interface RetrievalResult {
  /** Flattened extractive content, ready to drop into a system prompt. */
  text: string
  references: KnowledgeReference[]
  activity: ActivityRecord[]
  /** True on HTTP 206 — one or more knowledge sources failed but others answered. */
  partial: boolean
}

interface RawResponse {
  response?: Array<{ content?: Array<{ type: string; text?: string }> }>
  references?: KnowledgeReference[]
  activity?: ActivityRecord[]
}

export class FoundryIqError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'FoundryIqError'
    this.status = status
  }
}

async function authHeaders(apiKey: string | undefined): Promise<Record<string, string>> {
  // Entra first. The api-key path exists so local development does not require
  // an Azure login, and is not the recommended production configuration.
  if (!apiKey) {
    return { authorization: `Bearer ${await getAccessToken(SEARCH_SCOPE)}` }
  }
  return { 'api-key': apiKey }
}

export interface RetrieveOptions {
  /** The organization the caller belongs to. Never optional — see below. */
  orgId: string
  intents: RetrievalIntent[]
  maxOutputSizeInTokens?: number
  maxRuntimeInSeconds?: number
  rerankerThreshold?: number
  signal?: AbortSignal
}

/**
 * Runs retrieval scoped to one tenant.
 *
 * `filterAddOn` pins every knowledge-source query to the caller's org_id. This
 * is one of two independent controls — the Supabase-backed tools the model can
 * also call run under the caller's own token and are filtered by RLS. Neither
 * is trusted alone.
 *
 * This requires the knowledge source's underlying index to expose a filterable
 * `org_id` field. If it does not, retrieval returns content from every tenant
 * and the filter silently does nothing, so `assertTenantFilterSupported` below
 * should be run once against a new knowledge base.
 */
export async function retrieve(options: RetrieveOptions): Promise<RetrievalResult> {
  const env = retrievalEnvOrThrow()

  const url =
    `${env.AZURE_SEARCH_ENDPOINT.replace(/\/+$/, '')}` +
    `/knowledgebases('${encodeURIComponent(env.FOUNDRY_IQ_KNOWLEDGE_BASE)}')` +
    `/retrieve?api-version=${API_VERSION}`

  // OData string literals escape a single quote by doubling it. A tenant id is
  // a uuid so this cannot trigger in practice, but the filter is built from a
  // variable and must not be injectable on principle.
  const orgLiteral = options.orgId.replace(/'/g, "''")

  const body = {
    intents: options.intents,
    knowledgeSourceParams: [
      {
        kind: 'searchIndex' as const,
        knowledgeSourceName: env.FOUNDRY_IQ_KNOWLEDGE_SOURCE,
        filterAddOn: `org_id eq '${orgLiteral}'`,
        includeReferences: true,
        includeReferenceSourceData: true,
        rerankerThreshold: options.rerankerThreshold ?? 2.0,
      },
    ],
    maxOutputSizeInTokens: options.maxOutputSizeInTokens ?? 24_000,
    maxRuntimeInSeconds: options.maxRuntimeInSeconds ?? 30,
    includeActivity: true,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json;odata.metadata=minimal',
      ...(await authHeaders(env.AZURE_SEARCH_API_KEY)),
    },
    body: JSON.stringify(body),
    signal: options.signal,
  })

  // 206 is a documented success: some knowledge sources answered and others
  // errored. Treating it as a failure would throw away usable grounding.
  if (!response.ok && response.status !== 206) {
    const detail = await response.text().catch(() => '')
    throw new FoundryIqError(
      response.status,
      `Foundry IQ respondió ${response.status}: ${detail.slice(0, 500)}`,
    )
  }

  const raw = (await response.json()) as RawResponse

  const text = (raw.response ?? [])
    .flatMap((message) => message.content ?? [])
    .filter((chunk) => chunk.type === 'text' && chunk.text)
    .map((chunk) => chunk.text as string)
    .join('\n\n')

  return {
    text,
    references: raw.references ?? [],
    activity: raw.activity ?? [],
    partial: response.status === 206,
  }
}

/** Compact citation shape stored alongside a message and rendered in the UI. */
export interface Citation {
  id: string
  title: string
  url?: string
  score?: number
  snippet?: string
}

export function toCitations(references: KnowledgeReference[]): Citation[] {
  return references.slice(0, 12).map((reference) => {
    const source = (reference as { sourceData?: Record<string, unknown> }).sourceData ?? {}
    const pick = (...keys: string[]) => {
      for (const key of keys) {
        const value = source[key]
        if (typeof value === 'string' && value.trim()) return value
      }
      return undefined
    }

    return {
      id: reference.id,
      title:
        (reference as WebReference).title ??
        pick('title', 'name', 'nombre', 'subject') ??
        (reference as SearchIndexReference).docKey ??
        'Documento',
      url: (reference as WebReference).url ?? pick('url', 'storage_path'),
      score: (reference as { rerankerScore?: number }).rerankerScore,
      snippet: pick('content', 'chunk', 'text', 'detail', 'description')?.slice(0, 280),
    }
  })
}

/**
 * One-off check that the knowledge source actually honours the tenant filter.
 *
 * Retrieval is run against a uuid that belongs to nobody. Anything coming back
 * means `filterAddOn` is being ignored — most likely because the index has no
 * filterable `org_id` field — and the knowledge base must not be used for
 * multi-tenant grounding until that is fixed.
 *
 * Exercised by scripts/check-foundry.mjs.
 */
export async function assertTenantFilterSupported(): Promise<{ ok: boolean; detail: string }> {
  const impossibleOrgId = '00000000-0000-4000-8000-000000000000'

  const result = await retrieve({
    orgId: impossibleOrgId,
    intents: [{ type: 'semantic', search: 'contrato' }],
    maxRuntimeInSeconds: 20,
  })

  if (result.references.length > 0 || result.text.trim().length > 0) {
    return {
      ok: false,
      detail:
        'La base de conocimiento devolvió contenido para una organización inexistente. ' +
        'El índice del knowledge source no tiene un campo `org_id` filtrable, así que ' +
        'filterAddOn no está aislando nada. Reindexa antes de usarla con varios tenants.',
    }
  }

  return { ok: true, detail: 'filterAddOn aísla por org_id correctamente.' }
}
