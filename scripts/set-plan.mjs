#!/usr/bin/env node
// Changes an organization's subscription plan.
//
//   node --env-file=.env.local scripts/set-plan.mjs <slug-o-uuid> <plan>
//   node --env-file=.env.local scripts/set-plan.mjs --list
//
// This is the billing seam. `organizations.plan` is deliberately not writable
// by the `authenticated` role — migration 14 installs a trigger that rejects
// the change — because a customer who can PATCH their own plan column can buy
// Enterprise for free. So the plan moves either from a payment webhook running
// as `service_role`, or from here.
//
// Reads SUPABASE_DB_URL from .env.local, the same variable scripts/db-push.mjs
// uses. It connects as the database owner, which is what lets the trigger's
// `current_user = 'authenticated'` test pass through.

import { execFileSync } from 'node:child_process'

const PLANS = ['starter', 'growth', 'enterprise']

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error(`
Falta SUPABASE_DB_URL.

  Supabase → Project Settings → Database → Connection string → "Session pooler"
  Sustituye [YOUR-PASSWORD] por la contraseña de la base de datos y ponla en
  .env.local como SUPABASE_DB_URL.
`)
  process.exit(2)
}

/** Runs SQL and returns the raw text psql printed. */
function psql(sql) {
  return execFileSync(
    'psql',
    [dbUrl, '--quiet', '--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--command', sql],
    { encoding: 'utf8' },
  )
}

/**
 * Escapes a value for a single-quoted SQL literal.
 *
 * The arguments come from a shell, not from a user-facing form, but "it is
 * only ever run by us" is the reasoning behind a good share of SQL injection.
 */
function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

const [target, plan] = process.argv.slice(2)

if (target === '--list' || !target) {
  const out = psql(`
    select o.plan, o.slug, o.name, count(m.id) as miembros
    from public.organizations o
    left join public.memberships m on m.org_id = o.id
    group by o.id, o.plan, o.slug, o.name
    order by o.plan, o.name;
  `)
  process.stdout.write(out)
  if (!target) {
    console.error('\nUso: node --env-file=.env.local scripts/set-plan.mjs <slug-o-uuid> <plan>')
    console.error(`Planes: ${PLANS.join(', ')}`)
    process.exit(2)
  }
  process.exit(0)
}

if (!PLANS.includes(plan)) {
  console.error(`Plan desconocido: ${plan ?? '(ninguno)'}. Usa uno de: ${PLANS.join(', ')}`)
  process.exit(2)
}

// Matched on slug or id so the caller can paste whichever they have. `::text`
// on the id keeps a non-uuid argument from raising a cast error instead of
// simply not matching.
const where = `(slug = ${quote(target)} or id::text = ${quote(target)})`

const before = psql(
  `select plan || ' — ' || name from public.organizations where ${where};`,
).trim()

if (!before) {
  console.error(`No hay ninguna organización con slug o id ${target}.`)
  process.exit(1)
}

psql(`update public.organizations set plan = ${quote(plan)} where ${where};`)

console.log(`antes:   ${before}`)
console.log(`después: ${plan} — ${before.split(' — ').slice(1).join(' — ')}`)
console.log(`
Los módulos que el plan no incluye dejan de resolverse de inmediato
(src/lib/auth/session.ts los filtra al leer la sesión). Lo que la organización
tuviera activado se conserva en enabled_modules y vuelve a aparecer si sube de
plan otra vez — bajar de plan oculta, no borra.`)
