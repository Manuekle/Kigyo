#!/usr/bin/env node
// Verifies the Microsoft Foundry configuration before you rely on it.
//
//   node --env-file=.env.local scripts/check-foundry.mjs
//
// Three checks:
//   1. the required variables are present
//   2. the Foundry IQ knowledge base answers a retrieval call
//   3. `filterAddOn` actually isolates by org_id
//
// (3) is the one that matters. If the knowledge source's index has no
// filterable `org_id` field the filter is silently ignored, retrieval returns
// every tenant's documents, and nothing in the response says so.

const required = [
  'AZURE_SEARCH_ENDPOINT',
  'FOUNDRY_IQ_KNOWLEDGE_BASE',
  'FOUNDRY_IQ_KNOWLEDGE_SOURCE',
]

const API_VERSION = '2026-04-01'
const IMPOSSIBLE_ORG_ID = '00000000-0000-4000-8000-000000000000'

let failures = 0

function report(ok, label, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`)
}

const missing = required.filter((name) => !process.env[name])
report(missing.length === 0, 'variables de entorno presentes', missing.join(', '))
if (missing.length) {
  console.log('\nCopia .env.example a .env.local y complétalo.')
  process.exit(1)
}

async function authHeaders() {
  const apiKey = process.env.AZURE_SEARCH_API_KEY
  if (apiKey) return { 'api-key': apiKey }

  const { DefaultAzureCredential, ClientSecretCredential } = await import('@azure/identity')
  const { AZURE_TENANT_ID: t, AZURE_CLIENT_ID: c, AZURE_CLIENT_SECRET: s } = process.env
  const credential =
    t && c && s ? new ClientSecretCredential(t, c, s) : new DefaultAzureCredential()

  const token = await credential.getToken('https://search.azure.com/.default')
  if (!token?.token) throw new Error('Entra no devolvió un token')
  return { authorization: `Bearer ${token.token}` }
}

async function retrieve(orgId, search) {
  const url =
    `${process.env.AZURE_SEARCH_ENDPOINT.replace(/\/+$/, '')}` +
    `/knowledgebases('${encodeURIComponent(process.env.FOUNDRY_IQ_KNOWLEDGE_BASE)}')` +
    `/retrieve?api-version=${API_VERSION}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({
      intents: [{ type: 'semantic', search }],
      knowledgeSourceParams: [
        {
          kind: 'searchIndex',
          knowledgeSourceName: process.env.FOUNDRY_IQ_KNOWLEDGE_SOURCE,
          filterAddOn: `org_id eq '${orgId}'`,
          includeReferences: true,
          includeReferenceSourceData: true,
          rerankerThreshold: 2.0,
        },
      ],
      maxOutputSizeInTokens: 4000,
      maxRuntimeInSeconds: 25,
      includeActivity: true,
    }),
  })

  if (!response.ok && response.status !== 206) {
    throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  }
  return { body: await response.json(), status: response.status }
}

try {
  const { body, status } = await retrieve(IMPOSSIBLE_ORG_ID, 'contrato política documento')

  report(true, 'la base de conocimiento respondió', `HTTP ${status}`)

  const refs = body.references ?? []
  const text = (body.response ?? [])
    .flatMap((m) => m.content ?? [])
    .map((c) => c.text ?? '')
    .join('')
    .trim()

  const isolated = refs.length === 0 && text.length === 0
  report(
    isolated,
    'filterAddOn aísla por org_id',
    isolated
      ? ''
      : `devolvió ${refs.length} referencia(s) para una organización inexistente. ` +
        'El índice del knowledge source NO tiene un campo `org_id` filtrable: ' +
        'el filtro por tenant no está haciendo nada. Reindexa antes de usarlo con varios tenants.',
  )

  const errored = (body.activity ?? []).filter((a) => a.error)
  report(errored.length === 0, 'todas las fuentes respondieron sin error',
    errored.map((a) => `${a.knowledgeSourceName}: ${a.error?.message}`).join('; '))
} catch (error) {
  report(false, 'llamada de recuperación', error.message)
}

console.log('')
process.exit(failures > 0 ? 1 : 0)
