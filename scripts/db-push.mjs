#!/usr/bin/env node
// Applies supabase/migrations/*.sql to a Postgres database over a direct
// connection.
//
//   npm run db:push
//
// Reads SUPABASE_DB_URL from .env.local. Get it from the Supabase dashboard:
// Project Settings → Database → Connection string → URI (the "Session pooler"
// entry works, and so does the direct one). Replace [YOUR-PASSWORD] with the
// database password — which is NOT the service-role key.
//
// Why this exists: `supabase db push` needs a personal access token and a
// `supabase link`, and `supabase gen types` needs Docker. Neither is available
// everywhere, and neither is needed to run SQL against a database you already
// have credentials for.
//
// Applied migrations are recorded in supabase_migrations.schema_migrations —
// the same table the Supabase CLI uses — so re-runs skip what is already in
// place and switching to the CLI later still works.

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { resolve4, resolve6 } from 'node:dns/promises'

const dbUrl = process.env.SUPABASE_DB_URL

if (!dbUrl) {
  console.error(`
Falta SUPABASE_DB_URL.

  1. Supabase → Project Settings → Database → Connection string
     → pestaña "Session pooler"  (puerto 5432)

     Usa el pooler, no la conexión directa: db.<ref>.supabase.co solo
     publica IPv6 y la mayoría de redes no lo tienen.

  2. Sustituye [YOUR-PASSWORD] por la contraseña de la base de datos
     (NO es la service-role key; si no la recuerdas, en esa misma pantalla
     puedes generar una nueva)

  3. Pégala en .env.local:

     SUPABASE_DB_URL=postgresql://postgres.<ref>:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres
`)
  process.exit(1)
}

try {
  execFileSync('psql', ['--version'], { stdio: 'ignore' })
} catch {
  console.error('Falta `psql`. Instálalo con `brew install libpq` o `brew install postgresql`.')
  process.exit(1)
}

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')

function psql(args, input) {
  return execFileSync(
    'psql',
    [
      dbUrl,
      '--quiet',
      '--no-psqlrc',
      '-v', 'ON_ERROR_STOP=1',
      // "already exists, skipping" on every idempotent DDL statement buries
      // the actual progress, and a NOTICE arriving mid-line garbles it.
      '-c', 'set client_min_messages to warning',
      ...args,
    ],
    {
      encoding: 'utf8',
      input,
      maxBuffer: 64 * 1024 * 1024,
      // Captured rather than inherited, so a failure is reported once by this
      // script instead of twice — psql's copy plus ours.
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )
}

// ─── Connectivity ────────────────────────────────────────────────────────────


/** Supabase pooler regions, in rough order of how common they are. */
const POOLER_REGIONS = [
  'us-east-1', 'us-west-1', 'us-west-2', 'us-east-2', 'ca-central-1',
  'sa-east-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-north-1', 'eu-central-2', 'ap-southeast-1', 'ap-southeast-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-south-1', 'ap-east-1',
]

/**
 * Finds which pooler hosts a project, by asking each one.
 *
 * Supavisor answers "tenant/user not found" for a project it does not host and
 * an authentication error for one it does — so a deliberately wrong password
 * identifies the region without ever needing the real one. Beats making
 * somebody read a region out of the dashboard and guess between aws-0 and
 * aws-1.
 */
async function findPoolerHost(ref) {
  const attempt = (host) =>
    new Promise((done) => {
      try {
        execFileSync(
          'psql',
          [`postgresql://postgres.${ref}@${host}:5432/postgres`, '-c', 'select 1'],
          {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PGPASSWORD: 'x', PGCONNECT_TIMEOUT: '8' },
          },
        )
        done(host) // would mean the password happened to be 'x'
      } catch (error) {
        const text = String(error.stderr ?? '')
        // Anything that is not "no such tenant" means this pooler knows it.
        done(/not found/i.test(text) || /translate|traducir/i.test(text) ? null : host)
      }
    })

  const hosts = POOLER_REGIONS.flatMap((region) => [
    `aws-0-${region}.pooler.supabase.com`,
    `aws-1-${region}.pooler.supabase.com`,
  ])

  const found = (await Promise.all(hosts.map(attempt))).filter(Boolean)
  return found[0] ?? null
}

/**
 * Explains a connection failure instead of restating it.
 *
 * The common one is not a wrong password: Supabase's direct host,
 * `db.<ref>.supabase.co`, publishes only an AAAA record. On a network without
 * IPv6 — most home and office connections — DNS resolution fails outright, and
 * psql reports it as "could not translate host name", which reads like a typo.
 * The fix is the pooler, which is reachable over IPv4.
 */
async function explainConnectionFailure(message) {
  const host = dbUrl.match(/@([^:/?]+)/)?.[1]
  if (!host) return null

  const [v4, v6] = await Promise.all([
    resolve4(host).catch(() => []),
    resolve6(host).catch(() => []),
  ])

  const directMatch = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/)

  if (directMatch && v4.length === 0) {
    const ref = directMatch[1]

    process.stderr.write('\nBuscando el pooler de tu proyecto…')
    const pooler = await findPoolerHost(ref)
    process.stderr.write('\r' + ' '.repeat(40) + '\r')

    if (pooler) {
      return `
Ese host es la conexión DIRECTA de Supabase, que solo publica IPv6${
        v6.length ? ` (${v6[0]})` : ''
      },
y esta red no tiene salida IPv6. No es un problema de contraseña.

Tu proyecto está en ${pooler.replace('.pooler.supabase.com', '')}. Pon esto en
.env.local, con la contraseña de la base de datos:

  SUPABASE_DB_URL=postgresql://postgres.${ref}:<contraseña>@${pooler}:5432/postgres

Si no recuerdas la contraseña, genera una nueva en
Supabase → Project Settings → Database → Database password.`
    }

    return `
Ese host es la conexión DIRECTA de Supabase, que solo publica IPv6${
      v6.length ? ` (${v6[0]})` : ''
    },
y esta red no tiene salida IPv6. No es un problema de contraseña.

Usa el POOLER, que sí responde por IPv4:

  Supabase → Project Settings → Database → Connection string
           → pestaña "Session pooler"  (puerto 5432, no el 6543)

Queda con esta forma — fíjate en que el usuario lleva el ref del proyecto:

  postgresql://postgres.${ref}:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres
               ─────────┬────────────────                ────┬────
                        │                                    └── la región de tu proyecto
                        └── "postgres." + ref, no "postgres" a secas

Copia la URI tal cual de esa pestaña y sustituye solo [YOUR-PASSWORD].`
  }

  // Right pooler family, wrong region: Supavisor answers "tenant not found"
  // rather than anything that points at the actual problem.
  if (/tenant\/user .* not found/i.test(message) && /pooler\.supabase\.com$/.test(host)) {
    const ref = dbUrl.match(/\/\/postgres\.([a-z0-9]+)/)?.[1]
    if (ref) {
      process.stderr.write('\nBuscando el pooler de tu proyecto…')
      const pooler = await findPoolerHost(ref)
      process.stderr.write('\r' + ' '.repeat(40) + '\r')

      if (pooler && pooler !== host) {
        return `
Ese pooler no aloja tu proyecto: está en otra región.

  usa   ${pooler}
  no    ${host}`
      }
    }
    return `
El pooler no reconoce el usuario. Debe ser "postgres.<ref>", no "postgres" a
secas — copia la URI tal cual de la pestaña "Session pooler".`
  }

  if (v4.length === 0 && v6.length === 0) {
    return `\nEl nombre "${host}" no resuelve. Revisa que la URI sea la de tu proyecto.`
  }

  if (/password|authenticat/i.test(message)) {
    return `
La contraseña no es correcta. Es la de la BASE DE DATOS, no la service-role key.
Puedes generar una nueva en Supabase → Project Settings → Database → Database password.`
  }

  return null
}

try {
  const who = psql(['--tuples-only', '--no-align', '--command', 'select current_database()'])
  console.log(`→ conectado a ${who.trim()}\n`)
} catch (error) {
  const message = String(error.stderr ?? error.message).trim()
  console.error('No se pudo conectar.\n')
  console.error(message.slice(0, 500))

  const hint = await explainConnectionFailure(message)
  console.error(hint ?? '\nRevisa la contraseña y que la URI sea la de tu proyecto.')
  process.exit(1)
}

// ─── Ledger ──────────────────────────────────────────────────────────────────

psql([
  '--command',
  `create schema if not exists supabase_migrations;
   create table if not exists supabase_migrations.schema_migrations (
     version text primary key,
     name    text,
     statements text[],
     inserted_at timestamptz not null default now()
   );
   alter table supabase_migrations.schema_migrations
     add column if not exists inserted_at timestamptz not null default now();`,
])

const applied = new Set(
  psql(['--tuples-only', '--no-align', '--command',
        'select version from supabase_migrations.schema_migrations'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
)

// ─── Apply ───────────────────────────────────────────────────────────────────

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
let ran = 0

for (const file of files) {
  // `20260806090000_01_core.sql` → version `20260806090000`
  const version = basename(file).split('_')[0]

  if (applied.has(version)) {
    console.log(`  skip  ${file}`)
    continue
  }

  const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8')

  // El apunte en el ledger viaja DENTRO de la misma transacción que la
  // migración. Cuando iban en dos llamadas separadas, una migración podía
  // aplicarse y quedar sin anotar —basta con que la segunda llamada no llegue—
  // y el siguiente `db:push` la reintentaba y moría en el primer `create
  // table ... already exists`. Ahora las dos cosas se confirman juntas o no
  // ocurre ninguna, que es lo único que hace el ledger fiable.
  const ledger = `insert into supabase_migrations.schema_migrations (version, name)
       values ('${version}', '${file.replace(/'/g, "''")}')
       on conflict (version) do nothing;`

  try {
    // Each migration runs in one transaction, so a failure halfway leaves the
    // database exactly as it was rather than half-migrated.
    psql(['--single-transaction', '--file', '-'], `${sql}\n${ledger}\n`)
    console.log(`  ok    ${file}`)
    ran++
  } catch (error) {
    const message = String(error.stderr ?? error.message).trim()
    console.error(`  FAIL  ${file}\n`)
    console.error(message.slice(0, 2000))

    if (/already exists/i.test(message)) {
      console.error(`
Eso que "ya existe" está en la base pero no en el ledger: la migración se
aplicó alguna vez sin quedar anotada, o alguien la corrió a mano desde el
editor SQL de Supabase.

Dos salidas:

  · si ${file} ya está completa en la base, anótala y sigue:

      insert into supabase_migrations.schema_migrations (version, name)
      values ('${version}', '${file}')
      on conflict (version) do nothing;

  · si solo está a medias, hazla idempotente (create table if not exists,
    create index if not exists, drop trigger if exists antes de crearlo) y
    vuelve a ejecutar.`)
    }

    console.error(`\nNada de ${file} se aplicó. Corrige y vuelve a ejecutar.`)
    process.exit(1)
  }
}

console.log(
  ran === 0
    ? '\n✓ la base ya estaba al día'
    : `\n✓ ${ran} migración(es) aplicada(s)`,
)

// ─── Orphan accounts ─────────────────────────────────────────────────────────
// Accounts can exist before the schema does — Supabase Auth accepts signups
// either way, and handle_new_user only fires on INSERT. Migration 09 repairs
// them, but a signup between two runs of this script would be missed.

try {
  const repaired = psql([
    '--tuples-only', '--no-align', '--command',
    'select count(*) from app.backfill_orphan_accounts()',
  ]).trim()

  if (repaired !== '0') {
    console.log(`✓ ${repaired} cuenta(s) sin organización reparada(s)`)
  }
} catch {
  // Only reachable if migration 09 has not been applied yet, which the loop
  // above would already have reported.
}

console.log('')
