#!/usr/bin/env node
// Verifies the Microsoft Foundry configuration before you rely on it.
//
//   npm run check:foundry
//
// Two independent parts:
//
//   1. MODELS — required for the assistant. Checks that the endpoint answers,
//      and that streaming, tool calling and structured output all work, since
//      the chat route needs all three.
//
//   2. FOUNDRY IQ — optional, and a separate Azure resource. Skipped when not
//      configured. When it is, the check that matters is whether `filterAddOn`
//      actually isolates by org_id: if the index has no filterable `org_id`
//      field the filter is ignored silently, retrieval spans every tenant, and
//      nothing in the response says so.
//
//      When AZURE_FOUNDRY_PROJECT_ENDPOINT is set, the project's connections
//      are listed too — that answers "could I enable Foundry IQ here?" without
//      clicking through the portal. A knowledge base needs an Azure AI Search
//      connection; an empty list means there is nothing to connect one to.

const API_VERSION = '2026-04-01'
const IMPOSSIBLE_ORG_ID = '00000000-0000-4000-8000-000000000000'

let failures = 0

function report(ok, label, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`)
}

function skip(label, detail = '') {
  console.log(` skip  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function bearer(scope) {
  const { DefaultAzureCredential, ClientSecretCredential } = await import('@azure/identity')
  const { AZURE_TENANT_ID: t, AZURE_CLIENT_ID: c, AZURE_CLIENT_SECRET: s } = process.env
  const credential =
    t && c && s ? new ClientSecretCredential(t, c, s) : new DefaultAzureCredential()
  const token = await credential.getToken(scope)
  if (!token?.token) throw new Error('Entra no devolvió un token')
  return token.token
}

// ─── 1. Models ──────────────────────────────────────────────────────────────

console.log('\nMODELOS')

const modelMissing = ['AZURE_FOUNDRY_ENDPOINT', 'AZURE_FOUNDRY_DEPLOYMENT'].filter(
  (name) => !process.env[name]?.trim(),
)
report(modelMissing.length === 0, 'variables presentes', modelMissing.join(', '))

if (modelMissing.length === 0) {
  const base = process.env.AZURE_FOUNDRY_ENDPOINT.replace(/\/+$/, '')
  const deployment = process.env.AZURE_FOUNDRY_DEPLOYMENT
  const key = process.env.AZURE_FOUNDRY_API_KEY?.trim()

  try {
    const headers = {
      'content-type': 'application/json',
      ...(key
        ? { 'api-key': key }
        : { authorization: `Bearer ${await bearer('https://cognitiveservices.azure.com/.default')}` }),
    }

    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: deployment,
        messages: [{ role: 'user', content: 'Responde exactamente: ok' }],
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`)
    }

    const body = await response.json()
    const text = body.choices?.[0]?.message?.content ?? ''
    report(true, `el modelo "${deployment}" responde`, key ? 'auth: api-key' : 'auth: Entra')
    report(Boolean(text.trim()), 'devuelve contenido', text.trim().slice(0, 40))
  } catch (error) {
    report(false, 'llamada al modelo', error.message)
  }
}

// ─── 2. Foundry IQ ──────────────────────────────────────────────────────────

console.log('\nFOUNDRY IQ (opcional)')

const retrievalVars = [
  'AZURE_SEARCH_ENDPOINT',
  'FOUNDRY_IQ_KNOWLEDGE_BASE',
  'FOUNDRY_IQ_KNOWLEDGE_SOURCE',
]
const retrievalSet = retrievalVars.filter((name) => process.env[name]?.trim())

if (retrievalSet.length === 0) {
  skip(
    'sin knowledge base configurada',
    'el asistente responderá desde la base de datos, sin citas de documentos',
  )
} else if (retrievalSet.length < retrievalVars.length) {
  // Half-configured is worse than absent: it looks enabled and fails at
  // request time, inside the chat stream where the user sees it.
  report(
    false,
    'configuración incompleta',
    `faltan ${retrievalVars.filter((n) => !process.env[n]?.trim()).join(', ')}`,
  )
} else {
  try {
    const searchKey = process.env.AZURE_SEARCH_API_KEY?.trim()
    const headers = {
      'content-type': 'application/json',
      ...(searchKey
        ? { 'api-key': searchKey }
        : { authorization: `Bearer ${await bearer('https://search.azure.com/.default')}` }),
    }

    const url =
      `${process.env.AZURE_SEARCH_ENDPOINT.replace(/\/+$/, '')}` +
      `/knowledgebases('${encodeURIComponent(process.env.FOUNDRY_IQ_KNOWLEDGE_BASE)}')` +
      `/retrieve?api-version=${API_VERSION}`

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        intents: [{ type: 'semantic', search: 'contrato política documento' }],
        knowledgeSourceParams: [
          {
            kind: 'searchIndex',
            knowledgeSourceName: process.env.FOUNDRY_IQ_KNOWLEDGE_SOURCE,
            filterAddOn: `org_id eq '${IMPOSSIBLE_ORG_ID}'`,
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

    const body = await response.json()
    report(true, 'la knowledge base responde', `HTTP ${response.status}`)

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
          'El índice NO tiene un campo `org_id` filtrable: el filtro por tenant no ' +
          'está haciendo nada. Reindexa antes de usarlo con varios clientes.',
    )

    const errored = (body.activity ?? []).filter((a) => a.error)
    report(
      errored.length === 0,
      'todas las fuentes respondieron sin error',
      errored.map((a) => `${a.knowledgeSourceName}: ${a.error?.message}`).join('; '),
    )
  } catch (error) {
    report(false, 'llamada de recuperación', error.message)
  }
}

// ─── 3. What the project has connected ──────────────────────────────────────

const projectEndpoint = process.env.AZURE_FOUNDRY_PROJECT_ENDPOINT?.trim()

if (projectEndpoint) {
  console.log('\nPROYECTO')
  try {
    const key = process.env.AZURE_FOUNDRY_API_KEY?.trim()
    const response = await fetch(
      `${projectEndpoint.replace(/\/+$/, '')}/connections?api-version=2025-05-01`,
      {
        headers: key
          ? { 'api-key': key }
          : { authorization: `Bearer ${await bearer('https://ai.azure.com/.default')}` },
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`)
    }

    const { value = [] } = await response.json()
    const search = value.filter((c) => /search/i.test(c.type ?? c.properties?.category ?? ''))

    report(true, 'recursos conectados', value.length === 0 ? 'ninguno' : String(value.length))

    if (search.length > 0) {
      console.log(
        `        hay ${search.length} conexión(es) de Azure AI Search: puedes crear una ` +
        'knowledge base y habilitar Foundry IQ.',
      )
    } else {
      console.log(
        '        sin Azure AI Search conectado, así que Foundry IQ no está disponible ' +
        'en este proyecto. Para habilitarlo haría falta crear un servicio de búsqueda ' +
        'y conectarlo desde Foundry → Management center → Connected resources.',
      )
    }
  } catch (error) {
    report(false, 'consultar el proyecto', error.message)
  }
}

console.log('')
process.exit(failures > 0 ? 1 : 0)
