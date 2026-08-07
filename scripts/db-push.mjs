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

const dbUrl = process.env.SUPABASE_DB_URL

if (!dbUrl) {
  console.error(`
Falta SUPABASE_DB_URL.

  1. Supabase → Project Settings → Database → Connection string → URI
  2. Sustituye [YOUR-PASSWORD] por la contraseña de la base de datos
     (NO es la service-role key; si no la recuerdas, en esa misma pantalla
     puedes generar una nueva)
  3. Pégala en .env.local:

     SUPABASE_DB_URL=postgresql://postgres.<ref>:<contraseña>@<host>:5432/postgres
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

try {
  const who = psql(['--tuples-only', '--no-align', '--command', 'select current_database()'])
  console.log(`→ conectado a ${who.trim()}\n`)
} catch (error) {
  console.error('No se pudo conectar.\n')
  console.error(String(error.stderr ?? error.message).trim().slice(0, 500))
  console.error('\nRevisa la contraseña y que la URI sea la de tu proyecto.')
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

  try {
    // Each migration runs in one transaction, so a failure halfway leaves the
    // database exactly as it was rather than half-migrated.
    psql(['--single-transaction', '--file', '-'], sql)
    psql([
      '--command',
      `insert into supabase_migrations.schema_migrations (version, name)
       values ('${version}', '${file.replace(/'/g, "''")}')
       on conflict (version) do nothing`,
    ])
    console.log(`  ok    ${file}`)
    ran++
  } catch (error) {
    console.error(`  FAIL  ${file}\n`)
    console.error(String(error.stderr ?? error.message).trim().slice(0, 2000))
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
