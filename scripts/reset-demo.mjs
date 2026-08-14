#!/usr/bin/env node
// Wipes every tenant in the database and leaves one signed-up user with an
// empty company, exactly as a person who just registered would have.
//
//   node --env-file=.env.local scripts/reset-demo.mjs [correo] [contraseña]
//
// This is the opposite of scripts/seed-demo.mjs: that one fills a company with
// plausible data so the dashboard is not empty, this one leaves it bare so the
// setup wizard and the first-run experience can be tested from zero.
//
// ─── Lo que borra ───────────────────────────────────────────────────────────
//
//   · todas las filas de public.organizations — y con ellas, en cascada, las
//     66 tablas de negocio que llevan org_id;
//   · todas las cuentas y sus membresías;
//   · todos los usuarios de auth.
//
// Irreversible. There is no soft delete here and there is not meant to be:
// the point is a database that looks like the first minute of a new project.
//
// ─── Lo que NO hace ─────────────────────────────────────────────────────────
//
// No toca el esquema, ni los catálogos de referencia (sectores, presets,
// dependencias de módulos, permisos, límites de plan): esos son parte del
// producto, no datos de un cliente.

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Ejecuta con --env-file=.env.local',
  )
  process.exit(1)
}

const email = (process.argv[2] ?? process.env.DEMO_ACCOUNT_EMAIL ?? 'demo@kigyo.test').toLowerCase()
const password = process.argv[3] ?? process.env.DEMO_ACCOUNT_PASSWORD ?? 'kigyo-demo-2026'

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function fail(step, error) {
  console.error(`✗ ${step}:`, error?.message ?? error)
  process.exit(1)
}

// ─── Qué hay antes ───────────────────────────────────────────────────────────

const { data: before } = await db.auth.admin.listUsers({ perPage: 1000 })
const { count: orgsBefore } = await db.from('organizations').select('*', { count: 'exact', head: true })

console.log(`→ borrando ${orgsBefore ?? 0} empresa(s) y ${before?.users.length ?? 0} usuario(s)`)

// ─── Borrado ─────────────────────────────────────────────────────────────────
//
// Companies first. Every business table declares `org_id ... on delete
// cascade`, so one delete per company takes its data with it — which is also
// the reason this cannot be done by deleting the auth users: nothing in
// `public.organizations` points at a user, so the companies (and all their
// rows) would simply be orphaned.

{
  const { data: orgs, error } = await db.from('organizations').select('id')
  if (error) fail('leer empresas', error)

  for (const org of orgs ?? []) {
    const { error: delError } = await db.from('organizations').delete().eq('id', org.id)
    if (delError) fail(`borrar empresa ${org.id}`, delError)
  }
}

{
  const { data: accounts, error } = await db.from('accounts').select('id')
  if (error) fail('leer cuentas', error)

  for (const account of accounts ?? []) {
    const { error: delError } = await db.from('accounts').delete().eq('id', account.id)
    if (delError) fail(`borrar cuenta ${account.id}`, delError)
  }
}

// Invitations and demo requests are neither company data nor reference data:
// they are leftovers that would make a "fresh" database behave oddly — an
// unexpired invitation makes the next signup join a company that is gone.
for (const table of ['invitations', 'demo_requests', 'billing_events']) {
  const { error } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error && !error.message.includes('does not exist')) {
    console.warn(`  · ${table}: ${error.message}`)
  }
}

for (const user of before?.users ?? []) {
  const { error } = await db.auth.admin.deleteUser(user.id)
  if (error) fail(`borrar usuario ${user.email}`, error)
}

console.log('✓ base vacía')

// ─── El usuario nuevo ────────────────────────────────────────────────────────
//
// Created through the Admin API, which fires `handle_new_user` — the same
// trigger a real signup fires. So this account is not special-cased anywhere:
// it gets an account, a company, the three seeded roles, an Administrador
// membership and its permission grants, and `onboarding_completed_at` stays
// null so the wizard is the first thing it sees.
//
// `company_type` is deliberately absent. The sector is what the wizard is for,
// and pre-answering it would skip the step being tested.

console.log(`→ creando ${email}`)

const { data: created, error: createError } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'Manuel Erazo', company: 'Mi Empresa' },
})

if (createError) fail('crear usuario', createError)

const userId = created.user.id

// ─── Comprobación ────────────────────────────────────────────────────────────
//
// Asserted rather than assumed: a trigger that half-ran leaves a person who
// can sign in and cannot do anything, which is a confusing way to start a test.

/**
 * Signs in with the credential that was just written, through the anon key —
 * the same path the login form takes.
 *
 * Not paranoia. The account is created from `.env.local`, and that file is
 * edited by hand between runs: an email changed after the account was made
 * leaves a user nobody can sign in as, and the failure appears at the login
 * form as "correo o contraseña incorrectos" with no hint that the two sides
 * are describing different accounts. Better to find out here, in the process
 * that wrote it, than in the browser ten minutes later.
 */
{
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await anon.auth.signInWithPassword({ email, password })
  if (error) fail('verificar el inicio de sesión', error)
}

const { data: membership } = await db
  .from('memberships')
  .select('org_id, role, organizations ( name, company_type, subsector, enabled_modules, status, accounts ( name, plan, onboarding_completed_at ) )')
  .eq('user_id', userId)
  .single()

if (!membership) fail('comprobar', 'el trigger no creó la membresía')

const org = membership.organizations
const account = org.accounts

const { count: roles } = await db
  .from('roles').select('*', { count: 'exact', head: true }).eq('org_id', membership.org_id)
const { count: grants } = await db
  .from('role_permissions').select('*', { count: 'exact', head: true }).eq('org_id', membership.org_id)

console.log(`
✓ listo

  correo       ${email}
  contraseña   la de DEMO_ACCOUNT_PASSWORD en tu .env.local
  cuenta       ${account.name} · plan ${account.plan}
  empresa      ${org.name} · sector ${org.company_type ?? 'sin elegir'} · ${org.status}
  rol          ${membership.role} · ${roles} roles, ${grants} permisos
  onboarding   ${account.onboarding_completed_at === null ? 'pendiente — entrarás al asistente' : 'ya completado'}
  módulos      ${(org.enabled_modules ?? []).length === 0 ? 'sin configurar — los eliges en el asistente' : org.enabled_modules.join(', ')}

Entra en /login. Al entrar te llevará a /onboarding.
`)
