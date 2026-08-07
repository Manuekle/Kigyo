import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/**
 * These pin the two ways env parsing has silently broken the AI stack:
 * requiring a key that is meant to be optional, and treating a blank line in
 * the env file as a present-but-invalid value.
 */

const SUPABASE = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(40),
  SUPABASE_SERVICE_ROLE_KEY: 'b'.repeat(40),
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
}

/** The chat model — all the assistant strictly needs. */
const MODEL = {
  AZURE_FOUNDRY_ENDPOINT: 'https://example.openai.azure.com/openai/v1',
  AZURE_FOUNDRY_DEPLOYMENT: 'gpt-5.4-mini',
}

/** Foundry IQ document grounding — a separate, optional Azure resource. */
const RETRIEVAL = {
  AZURE_SEARCH_ENDPOINT: 'https://example.search.windows.net',
  FOUNDRY_IQ_KNOWLEDGE_BASE: 'kb-kigyo',
  FOUNDRY_IQ_KNOWLEDGE_SOURCE: 'ks-kigyo',
}

const MANAGED = [
  ...Object.keys(SUPABASE),
  ...Object.keys(MODEL),
  ...Object.keys(RETRIEVAL),
  'AZURE_FOUNDRY_API_KEY',
  'AZURE_SEARCH_API_KEY',
]

let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(MANAGED.map((key) => [key, process.env[key]]))
  for (const key of MANAGED) delete process.env[key]
})

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

async function load() {
  vi.resetModules()
  return import('./env')
}

describe('serverEnv', () => {
  it('parses a complete configuration', async () => {
    Object.assign(process.env, SUPABASE)
    const { serverEnv } = await load()
    expect(serverEnv().NEXT_PUBLIC_SUPABASE_URL).toBe(SUPABASE.NEXT_PUBLIC_SUPABASE_URL)
  })

  it('names the missing variables instead of failing opaquely', async () => {
    Object.assign(process.env, SUPABASE)
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { serverEnv } = await load()
    expect(() => serverEnv()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/)
  })
})

describe('modelEnv', () => {
  it('returns null when no model is configured, rather than throwing', async () => {
    Object.assign(process.env, SUPABASE)
    const { modelEnv } = await load()
    // The dashboard renders an insights panel; a missing model config must not
    // take the page down with it.
    expect(modelEnv()).toBeNull()
  })

  it('accepts a model with no API key, which is what selects Entra', async () => {
    Object.assign(process.env, SUPABASE, MODEL)
    const { modelEnv } = await load()

    const env = modelEnv()
    expect(env).not.toBeNull()
    expect(env?.AZURE_FOUNDRY_API_KEY).toBeUndefined()
  })

  it('treats a blank key in the env file as unset', async () => {
    // Every scaffolded .env leaves the unused keys as `FOO=`, which puts an
    // empty string in process.env. Without preprocessing, `.optional()` does
    // not apply and the whole config is rejected.
    Object.assign(process.env, SUPABASE, MODEL, { AZURE_FOUNDRY_API_KEY: '   ' })
    const { modelEnv } = await load()
    expect(modelEnv()?.AZURE_FOUNDRY_API_KEY).toBeUndefined()
  })

  it('keeps a key that is actually set', async () => {
    Object.assign(process.env, SUPABASE, MODEL, { AZURE_FOUNDRY_API_KEY: 'real-key' })
    const { modelEnv } = await load()
    expect(modelEnv()?.AZURE_FOUNDRY_API_KEY).toBe('real-key')
  })

  it('names the missing variable when the endpoint is absent', async () => {
    Object.assign(process.env, SUPABASE, MODEL)
    delete process.env.AZURE_FOUNDRY_ENDPOINT
    const { modelEnv, modelEnvOrThrow } = await load()

    expect(modelEnv()).toBeNull()
    expect(() => modelEnvOrThrow()).toThrowError(/AZURE_FOUNDRY_ENDPOINT/)
  })
})

describe('retrievalEnv', () => {
  it('is null with a model but no knowledge base', async () => {
    // The common case: Foundry Models is provisioned, Foundry IQ is not. The
    // assistant must still run, answering from live database queries.
    Object.assign(process.env, SUPABASE, MODEL)
    const { modelEnv, retrievalEnv } = await load()

    expect(modelEnv()).not.toBeNull()
    expect(retrievalEnv()).toBeNull()
  })

  it('resolves once all three knowledge-base variables are present', async () => {
    Object.assign(process.env, SUPABASE, MODEL, RETRIEVAL)
    const { retrievalEnv } = await load()
    expect(retrievalEnv()?.FOUNDRY_IQ_KNOWLEDGE_BASE).toBe('kb-kigyo')
  })

  it('stays null on a partial knowledge-base config', async () => {
    // Half-configured retrieval would fail at request time inside the chat
    // stream; better to treat it as absent.
    Object.assign(process.env, SUPABASE, MODEL, RETRIEVAL)
    delete process.env.FOUNDRY_IQ_KNOWLEDGE_SOURCE
    const { retrievalEnv } = await load()
    expect(retrievalEnv()).toBeNull()
  })
})

describe('.env.example', () => {
  it('documents every variable the schemas read', async () => {
    const { readFileSync } = await import('node:fs')
    const template = readFileSync('.env.example', 'utf8')
    const declared = new Set(
      [...template.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]),
    )

    for (const key of [...MANAGED, 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET']) {
      expect(declared.has(key), `.env.example is missing ${key}`).toBe(true)
    }
  })
})
