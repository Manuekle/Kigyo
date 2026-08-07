import type { UIMessage } from 'ai'
import type { Citation } from './foundry-iq'

/**
 * Metadata attached to every assistant message by the chat route.
 *
 * Shared between the route and the client so the citation shape cannot drift
 * between the two.
 */
export interface ChatMetadata {
  citations: Citation[]
  conversationId: string | null
  /** True when a Foundry IQ knowledge source errored and grounding is partial. */
  partialRetrieval: boolean
}

export type KigyoUIMessage = UIMessage<ChatMetadata>

export type { Citation }
