import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { chunkDocumentText, normalizeDocumentText } from './rag'

describe('document RAG chunking', () => {
  it('normalizes control characters and repeated whitespace', () => {
    expect(normalizeDocumentText('  contrato\r\n\r\n\r\n\u0000 vigente  '))
      .toBe('contrato\n\nvigente')
  })

  it('creates reproducible overlapping chunks', () => {
    const words = Array.from({ length: 700 }, (_, index) => `palabra-${index}`)
    const chunks = chunkDocumentText(words.join(' '))

    expect(chunks).toHaveLength(2)
    expect(chunks[0]?.content.split(' ').slice(-90)[0]).toBe(chunks[1]?.content.split(' ')[0])
    expect(chunks[0]?.contentHash).toBe(chunkDocumentText(words.join(' '))[0]?.contentHash)
  })

  it('returns no chunks for empty input', () => {
    expect(chunkDocumentText('   ')).toEqual([])
  })
})
