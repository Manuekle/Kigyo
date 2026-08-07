import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The retrieval client is where tenant isolation is enforced on the AI path,
 * so the filter it sends and the responses it accepts are worth pinning.
 */

const ENV = {
  AZURE_SEARCH_ENDPOINT: 'https://example.search.windows.net',
  FOUNDRY_IQ_KNOWLEDGE_BASE: 'kb-kigyo',
  FOUNDRY_IQ_KNOWLEDGE_SOURCE: 'ks-kigyo',
  AZURE_SEARCH_API_KEY: 'test-key',
}

// `server-only` throws outside a React Server Component build.
vi.mock('server-only', () => ({}))

const ORG = '2f1c9f1e-6f5f-4a0a-9c8e-7b3d5f2a1c44'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function loadModule() {
  vi.resetModules()
  return import('./foundry-iq')
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  Object.assign(process.env, ENV)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('retrieve', () => {
  it('scopes every request to the caller organization', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ response: [], references: [], activity: [] }))
    const { retrieve } = await loadModule()

    await retrieve({ orgId: ORG, intents: [{ type: 'semantic', search: 'contratos' }] })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain("/knowledgebases('kb-kigyo')/retrieve")
    expect(url).toContain('api-version=2026-04-01')

    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.knowledgeSourceParams[0].filterAddOn).toBe(`org_id eq '${ORG}'`)
    expect(body.intents).toEqual([{ type: 'semantic', search: 'contratos' }])
  })

  it('escapes single quotes in the OData filter literal', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ response: [] }))
    const { retrieve } = await loadModule()

    await retrieve({ orgId: "abc' or '1'='1", intents: [{ type: 'semantic', search: 'x' }] })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.knowledgeSourceParams[0].filterAddOn).toBe(
      "org_id eq 'abc'' or ''1''=''1'",
    )
  })

  it('flattens the extractive content into one string', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        response: [
          { content: [{ type: 'text', text: 'primero' }, { type: 'image', url: 'x' }] },
          { content: [{ type: 'text', text: 'segundo' }] },
        ],
      }),
    )
    const { retrieve } = await loadModule()

    const result = await retrieve({ orgId: ORG, intents: [{ type: 'semantic', search: 'x' }] })
    expect(result.text).toBe('primero\n\nsegundo')
    expect(result.partial).toBe(false)
  })

  it('treats HTTP 206 as a partial success, not a failure', async () => {
    // 206 means some knowledge sources answered and others errored. Throwing
    // would discard grounding the model can legitimately use.
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          response: [{ content: [{ type: 'text', text: 'parcial' }] }],
          activity: [{ type: 'web', id: 1, error: { code: '403', message: 'denied' } }],
        },
        206,
      ),
    )
    const { retrieve } = await loadModule()

    const result = await retrieve({ orgId: ORG, intents: [{ type: 'semantic', search: 'x' }] })
    expect(result.partial).toBe(true)
    expect(result.text).toBe('parcial')
  })

  it('throws with the status on a real error', async () => {
    fetchMock.mockResolvedValue(new Response('knowledge base not found', { status: 404 }))
    const { retrieve, FoundryIqError } = await loadModule()

    await expect(
      retrieve({ orgId: ORG, intents: [{ type: 'semantic', search: 'x' }] }),
    ).rejects.toBeInstanceOf(FoundryIqError)
  })

  it('prefers the api key header when one is configured', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ response: [] }))
    const { retrieve } = await loadModule()

    await retrieve({ orgId: ORG, intents: [{ type: 'semantic', search: 'x' }] })

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers['api-key']).toBe('test-key')
    expect(headers.authorization).toBeUndefined()
  })
})

describe('assertTenantFilterSupported', () => {
  it('fails when the index ignores the tenant filter', async () => {
    // Content returned for an organization that cannot exist means the index
    // has no filterable org_id and filterAddOn is isolating nothing.
    fetchMock.mockResolvedValue(
      jsonResponse({
        response: [{ content: [{ type: 'text', text: 'contrato de otra empresa' }] }],
        references: [{ type: 'searchIndex', id: 'a', activitySource: 0 }],
      }),
    )
    const { assertTenantFilterSupported } = await loadModule()

    const result = await assertTenantFilterSupported()
    expect(result.ok).toBe(false)
    expect(result.detail).toContain('org_id')
  })

  it('passes when nothing comes back for a nonexistent organization', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ response: [], references: [] }))
    const { assertTenantFilterSupported } = await loadModule()

    expect((await assertTenantFilterSupported()).ok).toBe(true)
  })
})

describe('isRetrievalConfigured', () => {
  it('is false without a knowledge base', async () => {
    for (const key of Object.keys(ENV)) delete process.env[key]
    const { isRetrievalConfigured } = await loadModule()
    expect(isRetrievalConfigured()).toBe(false)
  })

  it('is false on a partial configuration', async () => {
    Object.assign(process.env, ENV)
    delete process.env.FOUNDRY_IQ_KNOWLEDGE_BASE
    const { isRetrievalConfigured } = await loadModule()
    expect(isRetrievalConfigured()).toBe(false)
  })

  it('is true once all three variables are set', async () => {
    Object.assign(process.env, ENV)
    const { isRetrievalConfigured } = await loadModule()
    expect(isRetrievalConfigured()).toBe(true)
  })
})

describe('toCitations', () => {
  it('prefers a real title and falls back through the source data', async () => {
    const { toCitations } = await loadModule()

    const citations = toCitations([
      { type: 'web', id: '1', activitySource: 0, title: 'Guía', url: 'https://x.test' },
      {
        type: 'searchIndex',
        id: '2',
        activitySource: 0,
        docKey: 'DOC-1',
        sourceData: { nombre: 'Contrato laboral', content: 'texto largo' },
      },
      { type: 'searchIndex', id: '3', activitySource: 0, docKey: 'DOC-2' },
    ])

    expect(citations.map((c) => c.title)).toEqual(['Guía', 'Contrato laboral', 'DOC-2'])
    expect(citations[0].url).toBe('https://x.test')
    expect(citations[1].snippet).toBe('texto largo')
  })

  it('caps the number of citations it hands to the UI', async () => {
    const { toCitations } = await loadModule()
    const many = Array.from({ length: 30 }, (_, i) => ({
      type: 'searchIndex' as const,
      id: String(i),
      activitySource: 0,
      docKey: `DOC-${i}`,
    }))
    expect(toCitations(many)).toHaveLength(12)
  })
})
