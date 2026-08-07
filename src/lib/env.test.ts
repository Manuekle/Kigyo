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

const FOUNDRY = {
  AZURE_SEARCH_ENDPOINT: 'https://example.search.windows.net',
  FOUNDRY_IQ_KNOWLEDGE_BASE: 'kb-kigyo',
  FOUNDRY_IQ_KNOWLEDGE_SOURCE: 'ks-kigyo',
  AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-4.1',
}

const MANAGED = [
  ...Object.keys(SUPABASE),
  ...Object.keys(FOUNDRY),
  'AZURE_SEARCH_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_API_VERSION',
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

describe('aiEnv', () => {
  it('returns null when Foundry is not configured, rather than throwing', async () => {
    Object.assign(process.env, SUPABASE)
    const { aiEnv } = await load()
    // The dashboard renders an insights panel; a missing AI config must not
    // take the page down with it.
    expect(aiEnv()).toBeNull()
  })

  it('accepts a configuration with no API keys at all', async () => {
    // This is the Entra path. Requiring AZURE_OPENAI_API_KEY here previously
    // made a correctly configured managed identity report "not configured".
    Object.assign(process.env, SUPABASE, FOUNDRY)
    const { aiEnv } = await load()

    const env = aiEnv()
    expect(env).not.toBeNull()
    expect(env?.AZURE_OPENAI_API_KEY).toBeUndefined()
    expect(env?.AZURE_SEARCH_API_KEY).toBeUndefined()
  })

  it('treats a blank key in the env file as unset', async () => {
    // Every scaffolded .env leaves the unused keys as `FOO=`, which puts an
    // empty string in process.env. Without preprocessing, `.optional()` does
    // not apply and the whole AI config is rejected.
    Object.assign(process.env, SUPABASE, FOUNDRY, {
      AZURE_SEARCH_API_KEY: '',
      AZURE_OPENAI_API_KEY: '   ',
    })
    const { aiEnv } = await load()

    const env = aiEnv()
    expect(env).not.toBeNull()
    expect(env?.AZURE_SEARCH_API_KEY).toBeUndefined()
    expect(env?.AZURE_OPENAI_API_KEY).toBeUndefined()
  })

  it('keeps a key that is actually set', async () => {
    Object.assign(process.env, SUPABASE, FOUNDRY, { AZURE_SEARCH_API_KEY: 'real-key' })
    const { aiEnv } = await load()
    expect(aiEnv()?.AZURE_SEARCH_API_KEY).toBe('real-key')
  })

  it('defaults the OpenAI API version', async () => {
    Object.assign(process.env, SUPABASE, FOUNDRY)
    const { aiEnv } = await load()
    expect(aiEnv()?.AZURE_OPENAI_API_VERSION).toBe('2024-10-21')
  })

  it('still rejects a configuration missing an endpoint', async () => {
    Object.assign(process.env, SUPABASE, FOUNDRY)
    delete process.env.AZURE_OPENAI_ENDPOINT
    const { aiEnv, aiEnvOrThrow } = await load()

    expect(aiEnv()).toBeNull()
    expect(() => aiEnvOrThrow()).toThrowError(/AZURE_OPENAI_ENDPOINT/)
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
