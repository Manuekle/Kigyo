#!/usr/bin/env node
// Changes an organization's subscription plan.
//
//   node --env-file=.env.local scripts/set-plan.mjs <slug-o-uuid> <plan>
//   node --env-file=.env.local scripts/set-plan.mjs --list
//
// This is the billing seam. The plan is deliberately not writable by the
// `authenticated` role — migrations 14 and 26 install triggers that reject the
// change — because a customer who can PATCH their own plan column can buy
// Enterprise for free. So the plan moves either from a payment webhook running
// as `service_role`, or from here.
//
// The subscription belongs to `public.accounts` since migration 26: a customer
// buys one plan and may run several companies under it. `organizations.plan`
// was dropped in migration 32, so the account is the only copy and the only
// thing written here.
//
// A downgrade never deletes anything: companies beyond the plan's
// `max_companies` are marked `suspended` — visible, read-only — and return to
// `active` when the plan rises again. The first company (by creation) is
// always the one that stays active; the rest are what a later upgrade
// reactivates.
//
// The argument still names a COMPANY (a slug or an organization id), because
// that is what an operator has in front of them. The change is applied to the
// account above it, which means every sibling company in the same group moves
// with it — that is what "one subscription per customer" means, and the script
// says so out loud when there is more than one.
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

/**
 * Runs SQL and returns the raw text psql printed.
 *
 * `--tuples-only --no-align` for anything whose output is read back as a value:
 * without it psql frames every result with a column header and a "(1 fila)"
 * footer, and those end up inside the string. Only `--list`, which is printed
 * for a person to read, wants the table formatting.
 */
function psql(sql, { formatted = false } = {}) {
  const flags = formatted ? [] : ['--tuples-only', '--no-align']
  return execFileSync(
    'psql',
    [dbUrl, '--quiet', '--no-psqlrc', '--set', 'ON_ERROR_STOP=1', ...flags, '--command', sql],
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
    select a.plan, a.name as cuenta, o.slug, o.name as empresa, count(m.id) as miembros
    from public.organizations o
    join public.accounts a on a.id = o.account_id
    left join public.memberships m on m.org_id = o.id
    group by a.id, a.plan, a.name, o.id, o.slug, o.name
    order by a.name, o.name;
  `, { formatted: true })
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

/**
 * Matches the company on slug or id, so the caller can paste whichever they
 * have. `::text` on the id keeps a non-uuid argument from raising a cast error
 * instead of simply not matching.
 *
 * Takes the table alias rather than being rewritten afterwards: qualifying the
 * columns with a regular expression would also rewrite a slug that happens to
 * contain the word `id`, which is a bug that only shows up on somebody's real
 * company name.
 */
const matches = (alias) =>
  `(${alias}.slug = ${quote(target)} or ${alias}.id::text = ${quote(target)})`

const before = psql(
  `select a.plan || ' — ' || a.name
     from public.organizations o
     join public.accounts a on a.id = o.account_id
    where ${matches('o')};`,
).trim()

if (!before) {
  console.error(`No hay ninguna empresa con slug o id ${target}.`)
  process.exit(1)
}

// Every company under the same account, so an operator who thinks they are
// moving one business learns before the fact that they are moving the group.
const siblings = psql(
  `select o2.name
     from public.organizations o
     join public.organizations o2 on o2.account_id = o.account_id
    where ${matches('o')}
    order by o2.name;`,
)
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

// The change applies to the account. `organizations.plan` no longer exists
// (migration 32), so there is one copy to write and no way for two columns to
// disagree.
const targetAccount = `(select o2.account_id from public.organizations o2 where ${matches('o2')})`

// One call, and the same one the payment webhook makes.
//
// This used to write the plan and then reconcile suspension with a copy of the
// ranking query inline. Both halves now live in `public.apply_subscription`
// (migration 38), so the manual path and the automatic one cannot drift into
// suspending different companies — and the reconciliation is atomic with the
// plan change, which two separate statements could not promise.
//
// A downgrade suspends, never deletes: companies beyond the plan's limit become
// read-only, the oldest stay active, and everything returns when the plan goes
// back up. Idempotent.
psql(`select public.apply_subscription(${targetAccount}, ${quote(plan)}, 'active');`)

const suspended = psql(
  `select count(*) from public.organizations
    where account_id = ${targetAccount} and status = 'suspended'`,
).trim()

console.log(`antes:   ${before}`)
console.log(`después: ${plan} — ${before.split(' — ').slice(1).join(' — ')}`)
if (suspended !== '0') {
  console.log(
    `\n${suspended} ${suspended === '1' ? 'empresa suspendida' : 'empresas suspendidas'} (solo lectura) ` +
      `por superar el límite de ${plan}. Siguen visibles; vuelven a activas al subir de plan.`,
  )
}
if (siblings.length > 1) {
  console.log(`\nLa cuenta tiene ${siblings.length} empresas. El plan cambia para todas:`)
  for (const name of siblings) console.log(`  · ${name}`)
}

console.log(`
Los módulos que el plan no incluye dejan de resolverse de inmediato
(src/lib/auth/session.ts los filtra al leer la sesión). Lo que cada empresa
tuviera activado se conserva en enabled_modules y vuelve a aparecer si sube de
plan otra vez — bajar de plan oculta, no borra.`)
