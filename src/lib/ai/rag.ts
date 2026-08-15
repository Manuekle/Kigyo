import 'server-only'

import { createHash } from 'node:crypto'
import { embed, embedMany } from 'ai'
import type { RetrievalResult, KnowledgeReference } from './foundry-iq'
import { embeddingModel } from './model'
import { createClient } from '@/lib/supabase/server'

export const RAG_DIMENSIONS = 1536
const CHUNK_WORDS = 600
const OVERLAP_WORDS = 90

export interface RagChunk {
  index: number
  content: string
  tokenCount: number
  contentHash: string
}

export interface IndexDocumentInput {
  id: string
  orgId: string
  name: string
  mimeType: string | null
  storagePath: string | null
}

interface RagQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  insert(values: unknown): RagQuery
  delete(): RagQuery
  eq(column: string, value: unknown): RagQuery
}

interface RagClient {
  from(table: string): RagQuery
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>
}

function ragClient(supabase: Awaited<ReturnType<typeof createClient>>): RagClient {
  return supabase as unknown as RagClient
}

export class AiBudgetError extends Error {
  constructor() {
    super('El presupuesto mensual de IA fue alcanzado.')
    this.name = 'AiBudgetError'
  }
}

export function nativeRagConfigured(): boolean {
  return Boolean(process.env.AZURE_FOUNDRY_EMBEDDING_DEPLOYMENT?.trim())
}

export function normalizeDocumentText(value: string): string {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function approximateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4))
}

export function chunkDocumentText(value: string): RagChunk[] {
  const words = normalizeDocumentText(value).split(/\s+/).filter(Boolean)
  const chunks: RagChunk[] = []
  let start = 0

  while (start < words.length) {
    const content = words.slice(start, start + CHUNK_WORDS).join(' ').trim()
    if (!content) break
    chunks.push({
      index: chunks.length,
      content,
      tokenCount: approximateTokens(content),
      contentHash: createHash('sha256').update(content).digest('hex'),
    })
    if (start + CHUNK_WORDS >= words.length) break
    start += CHUNK_WORDS - OVERLAP_WORDS
  }

  return chunks
}

export async function readRagText(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string | null,
  mimeType: string | null,
): Promise<string | null> {
  const readable = new Set(['text/plain', 'text/csv', 'text/markdown', 'application/json'])
  if (!storagePath || !mimeType || !readable.has(mimeType)) return null

  const { data, error } = await supabase.storage.from('documents').download(storagePath)
  if (error || !data) return null
  const text = normalizeDocumentText(await data.text())
  return text || null
}

function vectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`
}

function monthStart(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString().slice(0, 10)
}

function costCents(tokens: number, envName: string, fallback: number): number {
  const perThousand = Number(process.env[envName] ?? fallback)
  return Math.max(1, Math.ceil((Math.max(tokens, 1) / 1000) * perThousand))
}

export function estimateChatCostCents(inputTokens: number, outputTokens: number): number {
  const inputRate = Number(process.env.AI_CHAT_INPUT_COST_CENTS_PER_1K ?? 1)
  const outputRate = Number(process.env.AI_CHAT_OUTPUT_COST_CENTS_PER_1K ?? 3)
  return Math.max(
    1,
    Math.ceil((Math.max(inputTokens, 1) / 1000) * inputRate)
      + Math.ceil((Math.max(outputTokens, 1) / 1000) * outputRate),
  )
}

export async function reserveAiBudget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  estimatedCents: number,
): Promise<void> {
  const { data, error } = await ragClient(supabase).rpc('reserve_ai_budget', {
    p_org_id: orgId,
    p_month_start: monthStart(),
    p_cost_cents: Math.max(1, Math.ceil(estimatedCents)),
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as { allowed?: boolean } | null
  if (!row?.allowed) throw new AiBudgetError()
}

export async function recordAiUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    orgId: string
    userId?: string | null
    documentId?: string | null
    operation: 'chat' | 'embedding' | 'retrieval' | 'review'
    model: string
    inputTokens?: number
    outputTokens?: number
    embeddingTokens?: number
    estimatedCostCents?: number
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await ragClient(supabase).from('ai_usage_events').insert({
    org_id: input.orgId,
    user_id: input.userId ?? null,
    document_id: input.documentId ?? null,
    operation: input.operation,
    model: input.model,
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    embedding_tokens: input.embeddingTokens ?? 0,
    estimated_cost_cents: input.estimatedCostCents ?? 0,
    metadata: input.metadata ?? {},
  })
  if (error) console.error('[ai] usage ledger', error)
}

export async function indexDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: IndexDocumentInput,
): Promise<{ chunks: number; tokens: number }> {
  const text = await readRagText(supabase, input.storagePath, input.mimeType)
  if (!text) return { chunks: 0, tokens: 0 }

  const chunks = chunkDocumentText(text)
  const tokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)
  await reserveAiBudget(supabase, input.orgId, costCents(tokens, 'AI_EMBEDDING_COST_CENTS_PER_1K', 1))

  const { embeddings, usage } = await embedMany({
    model: embeddingModel(),
    values: chunks.map((chunk) => chunk.content),
  })

  await ragClient(supabase)
    .from('document_chunks')
    .delete()
    .eq('org_id', input.orgId)
    .eq('document_id', input.id)

  const rows = chunks.map((chunk, index) => ({
    org_id: input.orgId,
    document_id: input.id,
    chunk_index: chunk.index,
    content: chunk.content,
    content_hash: chunk.contentHash,
    token_count: chunk.tokenCount,
    embedding: vectorLiteral(embeddings[index] ?? []),
    embedding_model: process.env.AZURE_FOUNDRY_EMBEDDING_DEPLOYMENT ?? 'unknown',
    status: 'ready',
    metadata: { title: input.name, mimeType: input.mimeType },
  }))

  const { error } = await ragClient(supabase).from('document_chunks').insert(rows)
  if (error) throw error

  await recordAiUsage(supabase, {
    orgId: input.orgId,
    documentId: input.id,
    operation: 'embedding',
    model: process.env.AZURE_FOUNDRY_EMBEDDING_DEPLOYMENT ?? 'unknown',
    embeddingTokens: Number((usage as { tokens?: number } | undefined)?.tokens ?? tokens),
    estimatedCostCents: costCents(tokens, 'AI_EMBEDDING_COST_CENTS_PER_1K', 1),
    metadata: { chunks: chunks.length },
  })

  return { chunks: chunks.length, tokens }
}

export async function searchDocumentChunks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  question: string,
): Promise<RetrievalResult | null> {
  if (!nativeRagConfigured()) return null

  const { embedding, usage } = await embed({ model: embeddingModel(), value: question })
  const embeddingTokens = Number((usage as { tokens?: number } | undefined)?.tokens ?? approximateTokens(question))
  await reserveAiBudget(supabase, orgId, costCents(embeddingTokens, 'AI_EMBEDDING_COST_CENTS_PER_1K', 1))
  await recordAiUsage(supabase, {
    orgId,
    operation: 'retrieval',
    model: process.env.AZURE_FOUNDRY_EMBEDDING_DEPLOYMENT ?? 'unknown',
    embeddingTokens,
    estimatedCostCents: costCents(embeddingTokens, 'AI_EMBEDDING_COST_CENTS_PER_1K', 1),
  })

  const { data, error } = await ragClient(supabase).rpc('match_document_chunks', {
    query_embedding: vectorLiteral(embedding),
    p_org_id: orgId,
    match_threshold: Number(process.env.AI_RAG_MATCH_THRESHOLD ?? 0.68),
    match_count: 8,
  })
  if (error) throw error

  const rows = (data ?? []) as Array<{
    id: string
    document_id: string
    content: string
    chunk_index: number
    metadata: { title?: string; mimeType?: string } | null
    similarity: number
  }>
  if (rows.length === 0) return null

  const references: KnowledgeReference[] = rows.map((row) => ({
    type: 'searchIndex',
    id: row.id,
    activitySource: 0,
    docKey: row.document_id,
    rerankerScore: row.similarity,
    sourceData: {
      title: row.metadata?.title ?? 'Documento',
      content: row.content,
      chunk: row.chunk_index,
    },
  }))

  return {
    text: rows.map((row) => `[${row.metadata?.title ?? 'Documento'}]\n${row.content}`).join('\n\n'),
    references,
    activity: [{ type: 'localVector', id: 0, count: rows.length }],
    partial: false,
  }
}
