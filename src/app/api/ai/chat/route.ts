import { NextResponse } from 'next/server'
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from 'ai'
import { z } from 'zod'
import { route } from '@/lib/api/handler'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { ApiError } from '@/lib/api/errors'
import { createClient } from '@/lib/supabase/server'
import { modelEnv } from '@/lib/env'
import { chatModel } from '@/lib/ai/model'
import { buildTools } from '@/lib/ai/tools'
import { systemPrompt } from '@/lib/ai/prompt'
import {
  retrieve,
  toCitations,
  isRetrievalConfigured,
  FoundryIqError,
  type RetrievalResult,
} from '@/lib/ai/foundry-iq'
import {
  AiBudgetError,
  estimateChatCostCents,
  nativeRagConfigured,
  recordAiUsage,
  reserveAiBudget,
  searchDocumentChunks,
} from '@/lib/ai/rag'

/**
 * Streaming chat, grounded on Foundry IQ plus live Supabase data.
 *
 * Replaces `simulatedReply()`, a chain of keyword `if`s behind a 1.1s
 * setTimeout, with:
 *
 *   1. authenticate + require `ia:use` + rate limit  (the `route` wrapper)
 *   2. retrieve from the Foundry IQ knowledge base, filtered to the caller's
 *      org_id
 *   3. stream a synthesized answer, with tools that read live rows through the
 *      caller's own RLS-scoped session
 *   4. persist the exchange with its citations
 *
 * Tenant isolation has two independent layers: `filterAddOn` on retrieval, and
 * RLS on every tool query. Neither is trusted on its own.
 */

const MAX_MESSAGES = 40

const bodySchema = z.object({
  messages: z.array(z.custom<UIMessage>()).min(1).max(MAX_MESSAGES),
  conversationId: z.uuid().nullish(),
})

/** Last user-authored text, used as the retrieval intent. */
function latestUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'user') continue
    const text = (message.parts ?? [])
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join(' ')
      .trim()
    if (text) return text
  }
  return ''
}

export const POST = route({
  body: bodySchema,
  permission: 'ia:use',
  rateLimit: RATE_LIMITS.aiChat,
  async handler({ body, member, request }) {
    if (!modelEnv()) {
      throw new ApiError(503, 'Asistente no configurado', {
        type: 'kigyo:ai-not-configured',
        detail:
          'Falta el modelo de Microsoft Foundry. Revisa AZURE_FOUNDRY_ENDPOINT y ' +
          'AZURE_FOUNDRY_DEPLOYMENT en el entorno del servidor.',
      })
    }

    const question = latestUserText(body.messages)
    if (!question) throw new ApiError(400, 'Mensaje vacío', { detail: 'Escribe una pregunta.' })

    const supabase = await createClient()

    let retrieval: RetrievalResult | null = null
    if (nativeRagConfigured()) {
      try {
        retrieval = await searchDocumentChunks(supabase, member.orgId, question)
      } catch (error) {
        if (error instanceof AiBudgetError) throw new ApiError(429, error.message)
        console.warn('[ai] native RAG retrieval failed', error)
      }
    }

    // Foundry IQ remains the fallback for installations that already have an
    // externally indexed knowledge base.
    if (!retrieval && isRetrievalConfigured()) {
      try {
        retrieval = await retrieve({
          orgId: member.orgId,
          intents: [{ type: 'semantic', search: question }],
          signal: request.signal,
        })
      } catch (error) {
        if (error instanceof FoundryIqError) {
          console.warn('[ai] Foundry IQ retrieval failed', error.status, error.message)
        } else {
          console.warn('[ai] Foundry IQ retrieval failed', error)
        }
      }
    }

    try {
      await reserveAiBudget(supabase, member.orgId, estimateChatCostCents(2000, 1000))
    } catch (error) {
      if (error instanceof AiBudgetError) throw new ApiError(429, error.message)
      throw error
    }

    // Reuse the conversation when the client supplies one. RLS scopes the
    // update to conversations this user owns, so a forged id changes nothing.
    let conversationId = body.conversationId ?? null
    if (!conversationId) {
      const { data } = await supabase
        .from('ai_conversations')
        .insert({
          org_id: member.orgId,
          user_id: member.userId,
          title: question.slice(0, 80),
        })
        .select('id')
        .single()
      conversationId = data?.id ?? null
    }

    // Una respuesta de aprobación reanuda el turno: el cliente reenvía la
    // misma conversación con la decisión adjunta al mensaje del asistente, así
    // que la última pregunta ya está guardada. Sin esta condición cada
    // aprobación duplicaba la fila del usuario en el historial.
    const resuming = body.messages[body.messages.length - 1]?.role !== 'user'

    if (conversationId && !resuming) {
      await supabase.from('ai_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: question,
      })
    }

    const citations = retrieval ? toCitations(retrieval.references) : []

    const result = streamText({
      model: chatModel(),
      system: systemPrompt(member, retrieval),
      messages: await convertToModelMessages(body.messages),
      tools: buildTools(member),
      // Enough for the model to call a tool, read the result and answer; not
      // so many that a confused loop runs up a bill.
      stopWhen: stepCountIs(6),
      abortSignal: request.signal,

      async onFinish({ text, usage }) {
        if (!conversationId) return
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: text,
          citations: citations as unknown as never,
          usage: {
            inputTokens: usage?.inputTokens ?? null,
            outputTokens: usage?.outputTokens ?? null,
            retrievalActivity: retrieval?.activity ?? [],
          } as unknown as never,
        })
        await recordAiUsage(supabase, {
          orgId: member.orgId,
          userId: member.userId,
          operation: 'chat',
          model: process.env.AZURE_FOUNDRY_DEPLOYMENT ?? 'foundry',
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          estimatedCostCents: estimateChatCostCents(
            usage?.inputTokens ?? 0,
            usage?.outputTokens ?? 0,
          ),
          metadata: { retrieval: Boolean(retrieval), partial: retrieval?.partial ?? false },
        })
        await supabase
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
      },

      onError({ error }) {
        console.error('[ai] stream failed', error)
      },
    })

    return result.toUIMessageStreamResponse({
      // Citations ride along as message metadata rather than a response
      // header, so they attach to the specific answer they grounded and
      // survive in the transcript instead of applying to the whole request.
      messageMetadata: ({ part }) =>
        part.type === 'start'
          ? { citations, conversationId, partialRetrieval: retrieval?.partial ?? false }
          : undefined,
      headers: { 'cache-control': 'no-store' },
      onError: (error) => {
        console.error('[ai] stream surfaced to client', error)
        return 'El asistente falló al responder. Intenta de nuevo.'
      },
    })
  },
})

/** Conversation history for the sidebar. */
export const GET = route({
  permission: 'ia:use',
  async handler({ searchParams }) {
    const supabase = await createClient()
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, title, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(30)

      if (error) throw new ApiError(500, 'No se pudo leer el historial')
      return { conversations: data }
    }

    const { data, error } = await supabase
      .from('ai_messages')
      .select('id, role, content, citations, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) throw new ApiError(500, 'No se pudo leer la conversación')
    return NextResponse.json({ messages: data }, { headers: { 'cache-control': 'no-store' } })
  },
})
