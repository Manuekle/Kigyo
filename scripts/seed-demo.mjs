#!/usr/bin/env node
// Seeds one organization with demo data, so the dashboard is not empty on a
// fresh project.
//
//   node --env-file=.env.local scripts/seed-demo.mjs [correo] [contraseña]
//
// Creates (or reuses) a confirmed user through the Admin API, which fires the
// handle_new_user trigger and gets an organization plus an Administrador
// membership. Everything after that is inserted with the service-role key and
// scoped by hand to that organization — RLS does not apply to service_role.
//
// Safe to re-run: rows are keyed on `code` and upserted.

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Copia .env.example a .env.local y ejecuta con --env-file=.env.local',
  )
  process.exit(1)
}

// Defaults come from the environment so the account this seeds is the same one
// `/api/demo/request` hands to whoever asks for a demo. Passing them on the
// command line still wins, for seeding a throwaway org.
const email = (process.argv[2] ?? process.env.DEMO_ACCOUNT_EMAIL ?? 'demo@kigyo.test').toLowerCase()
const password = process.argv[3] ?? process.env.DEMO_ACCOUNT_PASSWORD ?? 'kigyo-demo-2026'

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function fail(step, error) {
  console.error(`✗ ${step}:`, error?.message ?? error)
  process.exit(1)
}

// ─── Schema check ────────────────────────────────────────────────────────────
// Without it the first insert fails with PostgREST's "Could not find the table
// 'public.memberships' in the schema cache", which reads like a caching bug
// rather than "you have not applied the migrations yet".

{
  const { error } = await db.from('memberships').select('id').limit(1)
  if (error) {
    console.error(`
El esquema no está aplicado en esta base de datos.

  npm run db:push

(o \`npx supabase db push\` si tienes la CLI enlazada). Detalle: ${error.message}
`)
    process.exit(1)
  }
}

// ─── User + organization ─────────────────────────────────────────────────────

console.log(`→ usuario ${email}`)

let userId
const created = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: 'Camila Restrepo', company: 'Kigyo Demo', industry: 'Energía Solar' },
})

if (created.error) {
  // Already registered: find them and carry on, so the script is re-runnable.
  const { data, error } = await db.auth.admin.listUsers({ perPage: 200 })
  if (error) fail('listar usuarios', error)
  const existing = data.users.find((u) => u.email?.toLowerCase() === email)
  if (!existing) fail('crear usuario', created.error)
  userId = existing.id

  // Reset the password on the way through. Without this, rotating
  // DEMO_ACCOUNT_PASSWORD and re-running the seed leaves the account on the
  // old one — and the credentials the contact form hands out stop working,
  // with nothing in the output to say so.
  const { error: pwError } = await db.auth.admin.updateUserById(userId, { password })
  if (pwError) fail('actualizar la contraseña', pwError)
  console.log('  ya existía, se reutiliza (contraseña actualizada)')
} else {
  userId = created.data.user.id
}

const { data: membership, error: membershipError } = await db
  .from('memberships')
  .select('org_id')
  .eq('user_id', userId)
  .maybeSingle()

if (membershipError || !membership) {
  fail('leer la membresía', membershipError ?? 'el trigger handle_new_user no creó la organización')
}

const orgId = membership.org_id
console.log(`  organización ${orgId}`)

/**
 * The demo account runs on the top plan.
 *
 * New organizations default to `starter`, which reaches eight of the
 * thirty-five modules — so without this the seed would insert rows into
 * twenty-seven tables whose screens the demo user cannot open, and the account
 * would look broken rather than empty.
 *
 * `company_type` is deliberately left null. Empty `enabled_modules` plus no
 * sector resolves to the whole catalogue (src/lib/modules.ts), which is what a
 * demo wants — and it avoids duplicating the module list into this file, where
 * it would fall out of step the first time the catalogue changes.
 *
 * This runs as service_role, which is what the `organizations_guard_plan`
 * trigger lets through: a signed-in customer cannot do the same.
 */
{
  const { error } = await db
    .from('organizations')
    .update({ plan: 'enterprise' })
    .eq('id', orgId)
  if (error) fail('poner la organización en el plan enterprise', error)
  console.log('  plan enterprise (cuenta de demostración)')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = new Date()
const day = (offset) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

/**
 * Splits a batch into groups that name exactly the same columns.
 *
 * PostgREST turns one array into one INSERT whose column list is the union of
 * every row's keys, and a row that omitted a key gets an explicit NULL rather
 * than the column's DEFAULT. For a nullable column that is harmless; for
 * `phone text not null default ''` it is a not-null violation on a row that
 * simply did not mention the field.
 *
 * Grouping by key signature means every statement carries a uniform column
 * list, so an omitted column is genuinely omitted and the default applies.
 */
function byShape(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = Object.keys(row).sort().join(',')
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }
  return [...groups.values()]
}

async function upsert(table, rows, onConflict = 'org_id,code') {
  if (rows.length === 0) return []
  const inserted = []

  for (const group of byShape(rows.map((row) => ({ org_id: orgId, ...row })))) {
    const { data, error } = await db.from(table).upsert(group, { onConflict }).select()
    if (error) fail(`insertar en ${table}`, error)
    inserted.push(...data)
  }

  console.log(`  ${table}: ${inserted.length}`)
  return inserted
}

/**
 * Inserts rows the first time and does nothing on later runs.
 *
 * Many of the tables seeded below have no natural key to upsert on — a
 * harvest, an invoice line, a work-order task, a goal. Re-running the seed
 * must not stack a second copy of them, so the insert is skipped entirely once
 * the scope already holds a row.
 *
 * `scope` is the column that ties the rows to this organization: `org_id` for
 * top-level tables, or the parent's foreign key for the child ones, which
 * carry no org_id of their own and inherit isolation through their parent.
 */
async function seedOnce(table, rows, scope = 'org_id') {
  if (rows.length === 0) return []

  const values = scope === 'org_id' ? [orgId] : [...new Set(rows.map((row) => row[scope]))]
  const { data: existing, error } = await db.from(table).select('*').in(scope, values)
  if (error) fail(`revisar ${table}`, error)

  // The rows already there are returned rather than an empty array. Callers
  // key off these ids — the review cycle an evaluation belongs to, the lease a
  // rent payment is against — and handing back nothing on the second run would
  // make the upserts that follow write a null foreign key over a good one.
  if (existing.length > 0) {
    console.log(`  ${table}: ya sembrado (${existing.length})`)
    return existing
  }

  const payload = scope === 'org_id' ? rows.map((row) => ({ org_id: orgId, ...row })) : rows
  const inserted = []

  for (const group of byShape(payload)) {
    const { data, error: insertError } = await db.from(table).insert(group).select()
    if (insertError) fail(`insertar en ${table}`, insertError)
    inserted.push(...data)
  }

  console.log(`  ${table}: ${inserted.length}`)
  return inserted
}

/** `YYYY-MM` for a month offset from today, for the rent ledger. */
const period = (offset) => {
  const d = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  return d.toISOString().slice(0, 7)
}

// ─── Employees ───────────────────────────────────────────────────────────────
// One roster. The mock data had three, with no person in common.

console.log('→ datos')

const employees = await upsert('employees', [
  { code: 'EMP-0001', full_name: 'Camila Restrepo', email: email, position: 'Líder de Personas', department: 'Recursos Humanos', location: 'Bogotá', status: 'Activo', access_role: 'Administrador', user_id: userId, hired_on: '2023-02-01' },
  { code: 'EMP-0002', full_name: 'María González', position: 'Diseñadora de Producto', department: 'Diseño', location: 'Medellín', status: 'Activo', access_role: 'Empleado', hired_on: '2024-03-11' },
  { code: 'EMP-0003', full_name: 'Juan Pérez', position: 'Desarrollador Backend', department: 'Ingeniería', location: 'Remoto', status: 'Activo', access_role: 'Empleado', hired_on: '2024-08-05' },
  { code: 'EMP-0004', full_name: 'Andrés Mora', position: 'Analista Financiero', department: 'Finanzas', location: 'Bogotá', status: 'Activo', access_role: 'Líder de equipo', hired_on: '2022-11-20' },
  { code: 'EMP-0005', full_name: 'Valentina Ruiz', position: 'Especialista en Marketing', department: 'Comercial', location: 'Cali', status: 'Activo', access_role: 'Empleado', hired_on: '2025-01-15' },
  { code: 'EMP-0006', full_name: 'Sebastián Cano', position: 'Diseñador UX', department: 'Diseño', location: 'Medellín', status: 'Onboarding', access_role: 'Empleado', hired_on: day(-12) },
  { code: 'EMP-0007', full_name: 'Laura Jiménez', position: 'Contadora', department: 'Finanzas', location: 'Bogotá', status: 'Activo', access_role: 'Líder de equipo', hired_on: '2023-06-01' },
  { code: 'EMP-0008', full_name: 'Daniel Ospina', position: 'Soporte TI', department: 'Ingeniería', location: 'Bogotá', status: 'Activo', access_role: 'Empleado', hired_on: '2024-05-02' },
])

const byCode = Object.fromEntries(employees.map((e) => [e.code, e.id]))

// ─── Projects ────────────────────────────────────────────────────────────────

const projects = await upsert('projects', [
  { code: 'PRY-0001', name: 'Instalación Torre Sur', client: 'Constructora Andina', location: 'Bogotá', kind: 'Instalación', capacity_kwp: 150, status: 'En ejecución', progress: 62, budget_cents: 48_000_000_00, starts_on: day(-90), ends_on: day(30) },
  { code: 'PRY-0002', name: 'Mantenimiento Planta Norte', client: 'AgroSol', location: 'Barranquilla', kind: 'Mantenimiento', capacity_kwp: 80, status: 'Planificación', progress: 10, budget_cents: 12_500_000_00, starts_on: day(14) },
  { code: 'PRY-0003', name: 'Ampliación Bodega Central', client: 'LogiCol', location: 'Medellín', kind: 'Ampliación', capacity_kwp: 220, status: 'Finalizado', progress: 100, budget_cents: 61_000_000_00, starts_on: day(-210), ends_on: day(-30) },
])
const projectByCode = Object.fromEntries(projects.map((p) => [p.code, p.id]))

// ─── Signatures ──────────────────────────────────────────────────────────────

await upsert('signature_requests', [
  { code: 'FIR-0001', title: 'Contrato laboral', signer_id: byCode['EMP-0006'], kind: 'Contrato', status: 'Pendiente', requested_on: day(-2), due_on: day(5) },
  { code: 'FIR-0002', title: 'Política de seguridad', signer_id: byCode['EMP-0003'], kind: 'Política', status: 'Pendiente', requested_on: day(-8), due_on: day(2) },
  { code: 'FIR-0003', title: 'Anexo de teletrabajo', signer_id: byCode['EMP-0002'], kind: 'Anexo', status: 'Vencido', requested_on: day(-18), due_on: day(-4) },
  { code: 'FIR-0004', title: 'Acuerdo de confidencialidad', signer_id: byCode['EMP-0005'], kind: 'NDA', status: 'Firmado', requested_on: day(-20), signed_at: new Date(Date.now() - 5 * 86400000).toISOString() },
])

// ─── Tickets ─────────────────────────────────────────────────────────────────

await upsert('tickets', [
  { code: 'TK-0001', subject: 'Certificado laboral', area: 'Personas', priority: 'Media', status: 'Abierto', requester_id: byCode['EMP-0003'], tags: ['certificados'], board_position: 1 },
  { code: 'TK-0002', subject: 'Ajuste de liquidación de nómina', area: 'Nómina', priority: 'Alta', status: 'Abierto', requester_id: byCode['EMP-0004'], tags: ['nómina', 'urgente'], board_position: 2 },
  { code: 'TK-0003', subject: 'Revisión de contrato de proveedor', area: 'Legal', priority: 'Media', status: 'En proceso', requester_id: byCode['EMP-0007'], assignee_id: byCode['EMP-0001'], tags: ['legal'], board_position: 1 },
  { code: 'TK-0004', subject: 'Acceso a repositorio', area: 'TI', priority: 'Baja', status: 'Resuelto', requester_id: byCode['EMP-0002'], assignee_id: byCode['EMP-0008'], tags: ['permisos'], board_position: 1, resolved_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { code: 'TK-0005', subject: 'Equipo de reemplazo', area: 'TI', priority: 'Alta', status: 'En proceso', requester_id: byCode['EMP-0005'], assignee_id: byCode['EMP-0008'], tags: ['urgente'], board_position: 2 },
])

// ─── Inventory ───────────────────────────────────────────────────────────────

const assets = await upsert('inventory_assets', [
  { code: 'INV-0001', name: 'MacBook Pro 14"', category: 'Cómputo', employee_id: byCode['EMP-0002'], serial: 'C02X1234', status: 'Asignado', acquired_on: '2024-03-10' },
  { code: 'INV-0002', name: 'Dell Latitude 5440', category: 'Cómputo', serial: 'DL55231', status: 'Disponible', acquired_on: '2024-09-01' },
  { code: 'INV-0003', name: 'iPhone 15', category: 'Móvil', serial: 'IP15A991', status: 'Disponible', acquired_on: '2025-02-14' },
  { code: 'INV-0004', name: 'Monitor LG 27"', category: 'Monitor', employee_id: byCode['EMP-0003'], serial: 'LG27B77', status: 'Asignado', acquired_on: '2024-05-20' },
  { code: 'INV-0005', name: 'Multímetro Fluke', category: 'Herramientas', serial: 'FL8845', status: 'Mantenimiento', acquired_on: '2023-08-02' },
])
const assetByCode = Object.fromEntries(assets.map((a) => [a.code, a.id]))

// ─── Documents ───────────────────────────────────────────────────────────────

const folders = await upsert('document_folders', [
  { key: 'contratos', name: 'Contratos', position: 1 },
  { key: 'politicas', name: 'Políticas', position: 2 },
  { key: 'actas', name: 'Actas', position: 3 },
  { key: 'planes', name: 'Planes', position: 4 },
], 'org_id,key')
const folderByKey = Object.fromEntries(folders.map((f) => [f.key, f.id]))

await upsert('documents', [
  { code: 'DOC-0001', name: 'Manual de convivencia', kind: 'Manual', folder_id: folderByKey.politicas, department: 'Personas', owner_id: byCode['EMP-0001'], status: 'Vigente', tags: ['reglamento'] },
  { code: 'DOC-0002', name: 'Contrato laboral — plantilla', kind: 'Contrato', folder_id: folderByKey.contratos, department: 'Legal', owner_id: byCode['EMP-0007'], status: 'Vigente', tags: ['plantilla'], ai_verdict: 'Cláusula a revisar' },
  { code: 'DOC-0003', name: 'Política de datos personales', kind: 'Política', folder_id: folderByKey.politicas, department: 'Legal', owner_id: byCode['EMP-0007'], status: 'Vigente', tags: ['habeas data'], expires_on: day(21) },
  { code: 'DOC-0004', name: 'Plan de capacitación 2026', kind: 'Plan', folder_id: folderByKey.planes, department: 'Personas', owner_id: byCode['EMP-0001'], status: 'Borrador', tags: ['formación'] },
  { code: 'DOC-0005', name: 'Acta de comité SST', kind: 'Acta', folder_id: folderByKey.actas, department: 'SST', owner_id: byCode['EMP-0008'], status: 'Vigente', tags: ['sst'] },
])

// ─── Risks ───────────────────────────────────────────────────────────────────

await upsert('risks', [
  { code: 'R-0001', category: 'Contractual', title: 'Contrato por vencer', employee_id: byCode['EMP-0004'], area: 'Finanzas', severity: 'Alta', detail: 'El contrato vence en 8 días.', action: 'Renovar antes de la fecha límite.', status: 'Abierto', due_on: day(8) },
  { code: 'R-0002', category: 'Cumplimiento', title: 'Firma vencida', employee_id: byCode['EMP-0002'], area: 'Personas', severity: 'Alta', detail: 'Anexo de teletrabajo vencido hace 18 días sin firma.', action: 'Reenviar con urgencia.', status: 'Abierto' },
  { code: 'R-0003', category: 'Rotación', title: 'Rotación alta en Comercial', area: 'Comercial', severity: 'Media', detail: 'Tasa del 14,5%, la mayor de la empresa.', action: 'Análisis de retención.', status: 'Abierto' },
  { code: 'R-0004', category: 'Operacional', title: 'Vacaciones acumuladas', employee_id: byCode['EMP-0003'], area: 'Ingeniería', severity: 'Baja', detail: '18 días disponibles sin tomar.', action: 'Programar antes del cierre del trimestre.', status: 'Abierto' },
])

// ─── Attendance ──────────────────────────────────────────────────────────────

await upsert('absences', [
  { code: 'AUS-0001', employee_id: byCode['EMP-0004'], kind: 'Incapacidad', starts_on: day(-3), ends_on: day(4), status: 'Activa', notes: 'Incapacidad médica de 7 días.' },
  { code: 'AUS-0002', employee_id: byCode['EMP-0005'], kind: 'Vacaciones', starts_on: day(10), ends_on: day(20), status: 'Programada', notes: '' },
  { code: 'AUS-0003', employee_id: byCode['EMP-0002'], kind: 'Permiso', starts_on: day(-20), ends_on: day(-20), status: 'Finalizada', notes: 'Cita médica.' },
])

// ─── Calendar ────────────────────────────────────────────────────────────────

const at = (offset, hour) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  d.setHours(Math.trunc(hour), (hour % 1) * 60, 0, 0)
  return d.toISOString()
}

await upsert('calendar_events', [
  { code: 'M-0001', title: 'Entrevista — Analista de Nómina', kind: 'Entrevista', starts_at: at(1, 10), ends_at: at(1, 11), location: 'Sala A' },
  { code: 'M-0002', title: 'Onboarding Sebastián Cano', kind: 'Onboarding', starts_at: at(2, 9), ends_at: at(2, 11), location: 'Virtual' },
  { code: 'M-0003', title: '1:1 con Juan Pérez', kind: '1:1', starts_at: at(3, 15), ends_at: at(3, 15.5), location: 'Virtual' },
])

// ─── Projects → purchases ────────────────────────────────────────────────────

await upsert('products', [
  { sku: 'PAN-550', name: 'Panel monocristalino 550W', category: 'Paneles', unit: 'UN', price_cents: 780_000_00, cost_cents: 610_000_00, stock: 120, supplier: 'Soltek Solar' },
  { sku: 'INV-5K', name: 'Inversor híbrido 5kW', category: 'Inversores', unit: 'UN', price_cents: 3_900_000_00, cost_cents: 3_100_000_00, stock: 18, supplier: 'EnerSol' },
  { sku: 'BAT-10K', name: 'Batería de litio 10kWh', category: 'Baterías', unit: 'UN', price_cents: 12_400_000_00, cost_cents: 10_200_000_00, stock: 6, supplier: 'EnerSol' },
  { sku: 'EST-AL', name: 'Estructura de aluminio', category: 'Estructuras', unit: 'KIT', price_cents: 450_000_00, cost_cents: 320_000_00, stock: 74, supplier: 'Metálicas SAS' },
], 'org_id,sku')

await upsert('purchase_requests', [
  { code: 'REQ-0001', supplier: 'Soltek Solar', project_id: projectByCode['PRY-0001'], owner_id: byCode['EMP-0004'], category: 'Materiales', status: 'Pendiente', urgency: 'Alta', needed_on: day(7) },
  { code: 'REQ-0002', supplier: 'Metálicas SAS', project_id: projectByCode['PRY-0002'], owner_id: byCode['EMP-0007'], category: 'Materiales', status: 'Aprobada', urgency: 'Normal', needed_on: day(21) },
])

// ─── Clients (CRM) ───────────────────────────────────────────────────────────
// The accounts the quotes, invoices and contracts below all point at, so the
// same customer is one row rather than four spellings of a name.

const clients = await upsert('clients', [
  { code: 'CLI-0001', name: 'Constructora Andina', legal_name: 'Constructora Andina S.A.S.', tax_id: '900123456-1', kind: 'Empresa', status: 'Activo', industry: 'Construcción', email: 'compras@andina.test', phone: '+57 601 555 0110', city: 'Bogotá', owner_id: byCode['EMP-0005'], credit_limit_cents: 80_000_000_00, payment_terms_days: 30 },
  { code: 'CLI-0002', name: 'AgroSol', legal_name: 'AgroSol Ltda.', tax_id: '901987654-2', kind: 'Empresa', status: 'Activo', industry: 'Agroindustria', email: 'gerencia@agrosol.test', phone: '+57 605 555 0142', city: 'Barranquilla', owner_id: byCode['EMP-0005'], credit_limit_cents: 40_000_000_00, payment_terms_days: 45 },
  { code: 'CLI-0003', name: 'LogiCol', legal_name: 'Logística Colombiana S.A.', tax_id: '830456789-3', kind: 'Empresa', status: 'Activo', industry: 'Logística', email: 'proyectos@logicol.test', city: 'Medellín', owner_id: byCode['EMP-0001'], credit_limit_cents: 120_000_000_00, payment_terms_days: 60 },
  { code: 'CLI-0004', name: 'Alcaldía de Chía', kind: 'Entidad pública', status: 'Prospecto', industry: 'Sector público', email: 'contratacion@chia.test', city: 'Chía', owner_id: byCode['EMP-0005'], payment_terms_days: 90 },
])
const clientByCode = Object.fromEntries(clients.map((c) => [c.code, c.id]))

await seedOnce('client_contacts', [
  { client_id: clientByCode['CLI-0001'], full_name: 'Ricardo Peña', position: 'Jefe de Compras', email: 'rpena@andina.test', phone: '+57 310 555 0110', is_primary: true },
  { client_id: clientByCode['CLI-0001'], full_name: 'Sofía Lara', position: 'Interventora', email: 'slara@andina.test', is_primary: false },
  { client_id: clientByCode['CLI-0002'], full_name: 'Hernán Díaz', position: 'Gerente General', email: 'hdiaz@agrosol.test', phone: '+57 315 555 0142', is_primary: true },
  { client_id: clientByCode['CLI-0003'], full_name: 'Paula Restrepo', position: 'Directora de Proyectos', email: 'prestrepo@logicol.test', is_primary: true },
], 'client_id')

await seedOnce('client_interactions', [
  { client_id: clientByCode['CLI-0001'], kind: 'Reunión', subject: 'Revisión de avance Torre Sur', detail: 'Se acordó adelantar la entrega de inversores.', employee_id: byCode['EMP-0005'], follow_up_on: day(6) },
  { client_id: clientByCode['CLI-0002'], kind: 'Llamada', subject: 'Cotización mantenimiento', detail: 'Piden desglose por visita.', employee_id: byCode['EMP-0005'], follow_up_on: day(2) },
  { client_id: clientByCode['CLI-0004'], kind: 'Correo', subject: 'Invitación a licitación', detail: 'Cierre de propuestas en tres semanas.', employee_id: byCode['EMP-0001'], follow_up_on: day(15) },
], 'client_id')

// ─── Contracts ───────────────────────────────────────────────────────────────
// One inside its notice window, so "Por vencer" is not an empty state.

const contracts = await upsert('contracts', [
  { code: 'CTR-0001', title: 'Suministro e instalación — Torre Sur', kind: 'Cliente', status: 'Vigente', client_id: clientByCode['CLI-0001'], counterparty: 'Constructora Andina', owner_id: byCode['EMP-0001'], value_cents: 48_000_000_00, starts_on: day(-90), ends_on: day(20), notice_days: 30 },
  { code: 'CTR-0002', title: 'Mantenimiento anual — Planta Norte', kind: 'Cliente', status: 'Vigente', client_id: clientByCode['CLI-0002'], counterparty: 'AgroSol', owner_id: byCode['EMP-0004'], value_cents: 12_500_000_00, starts_on: day(-30), ends_on: day(335), notice_days: 45, auto_renew: true },
  { code: 'CTR-0003', title: 'Arrendamiento bodega — Fontibón', kind: 'Arrendamiento', status: 'Vigente', counterparty: 'Inversiones Robledo', owner_id: byCode['EMP-0007'], value_cents: 4_200_000_00, starts_on: day(-200), ends_on: day(165), notice_days: 60 },
])
const contractByCode = Object.fromEntries(contracts.map((c) => [c.code, c.id]))

await seedOnce('contract_milestones', [
  { contract_id: contractByCode['CTR-0001'], title: 'Anticipo 40 %', due_on: day(-85), amount_cents: 19_200_000_00, completed_at: new Date(Date.now() - 84 * 86400000).toISOString(), position: 0 },
  { contract_id: contractByCode['CTR-0001'], title: 'Entrega de estructura', due_on: day(-20), amount_cents: 14_400_000_00, completed_at: new Date(Date.now() - 18 * 86400000).toISOString(), position: 1 },
  { contract_id: contractByCode['CTR-0001'], title: 'Puesta en marcha', due_on: day(18), amount_cents: 14_400_000_00, position: 2 },
], 'contract_id')

// ─── Invoicing ───────────────────────────────────────────────────────────────
// One paid, one part-paid, one already past its due date, so the cartera and
// cartera vencida KPIs both show a real figure.

const invoices = await upsert('invoices', [
  { code: 'FAC-00001', client_id: clientByCode['CLI-0001'], client_name: 'Constructora Andina', status: 'Pagada', issued_on: day(-60), due_on: day(-30), subtotal_cents: 19_200_000_00, tax_cents: 3_648_000_00, total_cents: 22_848_000_00, paid_cents: 22_848_000_00 },
  { code: 'FAC-00002', client_id: clientByCode['CLI-0001'], client_name: 'Constructora Andina', status: 'Emitida', issued_on: day(-18), due_on: day(12), subtotal_cents: 14_400_000_00, tax_cents: 2_736_000_00, total_cents: 17_136_000_00, paid_cents: 5_000_000_00 },
  { code: 'FAC-00003', client_id: clientByCode['CLI-0002'], client_name: 'AgroSol', status: 'Emitida', issued_on: day(-52), due_on: day(-22), subtotal_cents: 6_250_000_00, tax_cents: 1_187_500_00, total_cents: 7_437_500_00 },
])
const invoiceByCode = Object.fromEntries(invoices.map((i) => [i.code, i.id]))

await seedOnce('invoice_items', [
  { invoice_id: invoiceByCode['FAC-00001'], description: 'Anticipo contrato CTR-0001', quantity: 1, unit_price_cents: 19_200_000_00, tax_rate: 19, position: 0 },
  { invoice_id: invoiceByCode['FAC-00002'], description: 'Panel monocristalino 550W', quantity: 12, unit_price_cents: 780_000_00, tax_rate: 19, position: 0 },
  { invoice_id: invoiceByCode['FAC-00002'], description: 'Inversor híbrido 5kW', quantity: 1, unit_price_cents: 3_900_000_00, tax_rate: 19, position: 1 },
  { invoice_id: invoiceByCode['FAC-00002'], description: 'Instalación y puesta en marcha', quantity: 1, unit_price_cents: 1_140_000_00, tax_rate: 19, position: 2 },
  { invoice_id: invoiceByCode['FAC-00003'], description: 'Mantenimiento preventivo — visita 1', quantity: 1, unit_price_cents: 6_250_000_00, tax_rate: 19, position: 0 },
], 'invoice_id')

await seedOnce('invoice_payments', [
  { invoice_id: invoiceByCode['FAC-00001'], amount_cents: 22_848_000_00, method: 'Transferencia', reference: 'TRF-88231', paid_on: day(-31) },
  { invoice_id: invoiceByCode['FAC-00002'], amount_cents: 5_000_000_00, method: 'Transferencia', reference: 'TRF-90114', paid_on: day(-5) },
], 'invoice_id')

// ─── Ecommerce ───────────────────────────────────────────────────────────────

const onlineOrders = await upsert('online_orders', [
  { code: 'PED-00001', customer_name: 'Marcela Ortiz', customer_email: 'mortiz@correo.test', customer_phone: '+57 320 555 0198', status: 'Entregado', shipping_method: 'Domicilio', shipping_address: 'Cra 15 # 88-40', shipping_city: 'Bogotá', tracking_code: 'CO994120', subtotal_cents: 1_560_000_00, shipping_cents: 25_000_00, discount_cents: 156_000_00, total_cents: 1_429_000_00, coupon_code: 'BIENVENIDA10', placed_at: new Date(Date.now() - 9 * 86400000).toISOString(), shipped_at: new Date(Date.now() - 7 * 86400000).toISOString(), delivered_at: new Date(Date.now() - 5 * 86400000).toISOString() },
  { code: 'PED-00002', customer_name: 'Iván Betancur', customer_email: 'ibetancur@correo.test', status: 'En preparación', shipping_method: 'Domicilio', shipping_address: 'Calle 10 sur # 44-12', shipping_city: 'Medellín', subtotal_cents: 3_900_000_00, shipping_cents: 35_000_00, total_cents: 3_935_000_00, placed_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { code: 'PED-00003', customer_name: 'Tienda El Faro', customer_phone: '+57 604 555 0177', status: 'Pagado', shipping_method: 'Recoge en tienda', shipping_city: 'Cali', subtotal_cents: 900_000_00, total_cents: 900_000_00, placed_at: new Date(Date.now() - 1 * 86400000).toISOString() },
])
const onlineByCode = Object.fromEntries(onlineOrders.map((o) => [o.code, o.id]))

await seedOnce('online_order_items', [
  { order_id: onlineByCode['PED-00001'], description: 'Panel monocristalino 550W', quantity: 2, unit_price_cents: 780_000_00, position: 0 },
  { order_id: onlineByCode['PED-00002'], description: 'Inversor híbrido 5kW', quantity: 1, unit_price_cents: 3_900_000_00, position: 0 },
  { order_id: onlineByCode['PED-00003'], description: 'Estructura de aluminio', quantity: 2, unit_price_cents: 450_000_00, position: 0 },
], 'order_id')

await upsert('discount_coupons', [
  { code: 'BIENVENIDA10', percent_off: 10, min_total_cents: 500_000_00, max_uses: 200, used_count: 1, expires_on: day(60) },
  { code: 'ENVIOGRATIS', amount_off_cents: 35_000_00, min_total_cents: 1_000_000_00, expires_on: day(30) },
])

// ─── Recruiting ──────────────────────────────────────────────────────────────
// Candidates spread across the funnel, so the board is not one full column.

const openings = await upsert('job_openings', [
  { code: 'VAC-0001', title: 'Técnico de instalaciones solares', department: 'Operaciones', location: 'Bogotá', employment_type: 'Tiempo completo', status: 'Abierta', openings: 2, salary_min_cents: 2_800_000_00, salary_max_cents: 3_600_000_00, hiring_manager_id: byCode['EMP-0004'], description: 'Instalación y puesta en marcha de sistemas fotovoltaicos.', opened_on: day(-25) },
  { code: 'VAC-0002', title: 'Analista de Nómina', department: 'Recursos Humanos', location: 'Bogotá', employment_type: 'Tiempo completo', status: 'En proceso', openings: 1, salary_min_cents: 3_200_000_00, salary_max_cents: 4_000_000_00, hiring_manager_id: byCode['EMP-0001'], opened_on: day(-40) },
])
const openingByCode = Object.fromEntries(openings.map((o) => [o.code, o.id]))

await seedOnce('candidates', [
  { job_opening_id: openingByCode['VAC-0001'], full_name: 'Óscar Villa', email: 'ovilla@correo.test', phone: '+57 311 555 0121', source: 'Portal de empleo', stage: 'Postulado', expected_salary_cents: 3_000_000_00, applied_on: day(-6) },
  { job_opening_id: openingByCode['VAC-0001'], full_name: 'Diana Cárdenas', email: 'dcardenas@correo.test', source: 'Referido', stage: 'Entrevista', rating: 4, expected_salary_cents: 3_400_000_00, applied_on: day(-14) },
  { job_opening_id: openingByCode['VAC-0001'], full_name: 'Julián Mesa', email: 'jmesa@correo.test', source: 'LinkedIn', stage: 'Descartado', rating: 2, applied_on: day(-19), notes: 'Sin experiencia en alturas.' },
  { job_opening_id: openingByCode['VAC-0002'], full_name: 'Natalia Suárez', email: 'nsuarez@correo.test', source: 'LinkedIn', stage: 'Oferta', rating: 5, expected_salary_cents: 3_900_000_00, applied_on: day(-30) },
  { job_opening_id: openingByCode['VAC-0002'], full_name: 'Camilo Pardo', email: 'cpardo@correo.test', source: 'Referido', stage: 'Preselección', rating: 3, expected_salary_cents: 3_500_000_00, applied_on: day(-11) },
], 'job_opening_id')

// ─── Training ────────────────────────────────────────────────────────────────
// The alturas certification expires inside the 60-day window the KPI watches.

const courses = await upsert('courses', [
  { name: 'Trabajo seguro en alturas', category: 'HSEQ', mode: 'Presencial', provider: 'ARL Colmena', instructor: 'Jorge Álvarez', duration_hours: 40, cost_cents: 480_000_00, seats: 12, validity_months: 24, is_mandatory: true, starts_on: day(-330), ends_on: day(-325) },
  { name: 'Primeros auxilios', category: 'HSEQ', mode: 'Presencial', provider: 'Cruz Roja', duration_hours: 16, cost_cents: 220_000_00, seats: 20, validity_months: 12, is_mandatory: true, starts_on: day(-40), ends_on: day(-39) },
  { name: 'Excel avanzado para finanzas', category: 'Técnico', mode: 'Virtual', provider: 'Platzi', duration_hours: 24, cost_cents: 180_000_00, validity_months: null, starts_on: day(5) },
], 'org_id,name')
const courseByName = Object.fromEntries(courses.map((c) => [c.name, c.id]))

await seedOnce('course_enrollments', [
  { course_id: courseByName['Trabajo seguro en alturas'], employee_id: byCode['EMP-0003'], status: 'Aprobado', score: 92, completed_on: day(-325), expires_on: day(35) },
  { course_id: courseByName['Trabajo seguro en alturas'], employee_id: byCode['EMP-0008'], status: 'Aprobado', score: 88, completed_on: day(-325), expires_on: day(35) },
  { course_id: courseByName['Primeros auxilios'], employee_id: byCode['EMP-0002'], status: 'Aprobado', score: 95, completed_on: day(-39), expires_on: day(326) },
  { course_id: courseByName['Primeros auxilios'], employee_id: byCode['EMP-0005'], status: 'Reprobado', score: 48, completed_on: day(-39) },
  { course_id: courseByName['Excel avanzado para finanzas'], employee_id: byCode['EMP-0004'], status: 'Inscrito' },
  { course_id: courseByName['Excel avanzado para finanzas'], employee_id: byCode['EMP-0007'], status: 'Inscrito' },
], 'course_id')

// ─── Performance ─────────────────────────────────────────────────────────────

const cycles = await seedOnce('review_cycles', [
  { name: 'Evaluación semestral 2026-I', status: 'Abierto', starts_on: day(-20), ends_on: day(40), description: 'Ciclo de mitad de año para todo el equipo.' },
])
const cycleId = cycles[0]?.id ?? null

await upsert('evaluations', [
  { code: 'EV-0001', cycle_id: cycleId, employee_id: byCode['EMP-0002'], evaluator_id: byCode['EMP-0001'], period_label: '2026-I', score: 4.5, objectives_done: 4, objectives_total: 5, status: 'Completada', strengths: 'Gran criterio de producto y muy buena comunicación.', improvements: 'Delegar más el detalle visual.', evaluated_on: day(-6) },
  { code: 'EV-0002', cycle_id: cycleId, employee_id: byCode['EMP-0003'], evaluator_id: byCode['EMP-0004'], period_label: '2026-I', score: 4.0, objectives_done: 3, objectives_total: 4, status: 'En revisión', strengths: 'Resolución técnica sólida.' },
  { code: 'EV-0003', cycle_id: cycleId, employee_id: byCode['EMP-0005'], evaluator_id: byCode['EMP-0001'], period_label: '2026-I', objectives_done: 0, objectives_total: 4, status: 'Pendiente' },
])

await seedOnce('employee_goals', [
  { employee_id: byCode['EMP-0005'], cycle_id: cycleId, title: 'Cerrar 8 cuentas nuevas', metric: 'Cuentas firmadas', target_value: 8, current_value: 5, weight: 40, status: 'En progreso', due_on: day(40) },
  { employee_id: byCode['EMP-0003'], cycle_id: cycleId, title: 'Reducir el tiempo de respuesta a tickets', metric: 'Horas de primera respuesta', target_value: 4, current_value: 6, weight: 30, status: 'En progreso', due_on: day(40) },
  { employee_id: byCode['EMP-0002'], cycle_id: cycleId, title: 'Publicar el sistema de diseño', metric: 'Componentes documentados', target_value: 30, current_value: 30, weight: 30, status: 'Cumplido', due_on: day(-5) },
])

// ─── Maintenance ─────────────────────────────────────────────────────────────
// One overdue and one recurring, so both the "vencidas" KPI and the automatic
// re-scheduling on completion have something to act on.

const workOrders = await upsert('work_orders', [
  { code: 'OT-00001', title: 'Cambio de aceite del generador', kind: 'Preventivo', status: 'Programada', priority: 'Media', asset_label: 'Generador Cummins 60 kVA', assignee_id: byCode['EMP-0008'], location: 'Planta Norte', scheduled_on: day(9), recurrence_days: 180, labor_cost_cents: 320_000_00, parts_cost_cents: 180_000_00 },
  { code: 'OT-00002', title: 'Calibración de multímetro', kind: 'Preventivo', status: 'Abierta', priority: 'Baja', asset_id: assetByCode['INV-0005'], asset_label: 'Multímetro Fluke', assignee_id: byCode['EMP-0008'], scheduled_on: day(-4), recurrence_days: 365 },
  { code: 'OT-00003', title: 'Reemplazo de inversor averiado', kind: 'Correctivo', status: 'En ejecución', priority: 'Alta', asset_label: 'Inversor string #4', project_id: projectByCode['PRY-0001'], assignee_id: byCode['EMP-0003'], location: 'Torre Sur', detail: 'Falla intermitente reportada por el cliente.', downtime_hours: 6, labor_cost_cents: 900_000_00, parts_cost_cents: 3_900_000_00 },
  { code: 'OT-00004', title: 'Limpieza de paneles', kind: 'Preventivo', status: 'Completada', priority: 'Baja', asset_label: 'Arreglo fotovoltaico Bodega Central', assignee_id: byCode['EMP-0008'], scheduled_on: day(-25), completed_at: new Date(Date.now() - 24 * 86400000).toISOString(), labor_cost_cents: 420_000_00 },
])
const workOrderByCode = Object.fromEntries(workOrders.map((w) => [w.code, w.id]))

await seedOnce('work_order_tasks', [
  { work_order_id: workOrderByCode['OT-00003'], description: 'Desconectar y asegurar el string', done: true, position: 0 },
  { work_order_id: workOrderByCode['OT-00003'], description: 'Retirar el inversor averiado', done: true, position: 1 },
  { work_order_id: workOrderByCode['OT-00003'], description: 'Instalar el reemplazo y probar', done: false, position: 2 },
], 'work_order_id')

// ─── Fleet ───────────────────────────────────────────────────────────────────
// One vehicle with its SOAT already lapsed, one about to lapse.

const vehicles = await upsert('vehicles', [
  { plate: 'WGT482', kind: 'Camioneta', brand: 'Toyota', model: 'Hilux', model_year: 2022, fuel: 'Diésel', status: 'Disponible', driver_id: byCode['EMP-0008'], odometer_km: 84_300, capacity_kg: 1000, soat_expires_on: day(18), inspection_expires_on: day(120), insurance_expires_on: day(210) },
  { plate: 'KLM119', kind: 'Camión', brand: 'Chevrolet', model: 'NPR', model_year: 2019, fuel: 'Diésel', status: 'En ruta', driver_id: byCode['EMP-0003'], odometer_km: 162_900, capacity_kg: 4500, soat_expires_on: day(-9), inspection_expires_on: day(45), insurance_expires_on: day(150) },
  { plate: 'HRD701', kind: 'Motocicleta', brand: 'Yamaha', model: 'XTZ 150', model_year: 2023, fuel: 'Gasolina', status: 'En taller', odometer_km: 21_450, soat_expires_on: day(200), inspection_expires_on: day(240) },
], 'org_id,plate')
const vehicleByPlate = Object.fromEntries(vehicles.map((v) => [v.plate, v.id]))

await seedOnce('vehicle_services', [
  { vehicle_id: vehicleByPlate['WGT482'], kind: 'Preventivo', description: 'Cambio de aceite y filtros', provider: 'Serviteca La 80', odometer_km: 80_000, cost_cents: 620_000_00, serviced_on: day(-45), next_service_on: day(135) },
  { vehicle_id: vehicleByPlate['KLM119'], kind: 'Correctivo', description: 'Cambio de pastillas de freno', provider: 'Diésel Center', odometer_km: 160_000, cost_cents: 1_180_000_00, serviced_on: day(-20) },
  { vehicle_id: vehicleByPlate['HRD701'], kind: 'Preventivo', description: 'Mantenimiento de 20.000 km', provider: 'Yamaha Centro', odometer_km: 20_000, cost_cents: 340_000_00, serviced_on: day(-8), next_service_on: day(172) },
], 'vehicle_id')

await seedOnce('fuel_logs', [
  { vehicle_id: vehicleByPlate['WGT482'], liters: 62.4, cost_cents: 396_000_00, odometer_km: 84_300, station: 'Terpel Autopista', driver_id: byCode['EMP-0008'], filled_on: day(-3) },
  { vehicle_id: vehicleByPlate['KLM119'], liters: 118.0, cost_cents: 749_000_00, odometer_km: 162_900, station: 'Biomax Calle 13', driver_id: byCode['EMP-0003'], filled_on: day(-2) },
  { vehicle_id: vehicleByPlate['WGT482'], liters: 58.1, cost_cents: 368_000_00, odometer_km: 83_600, station: 'Terpel Autopista', driver_id: byCode['EMP-0008'], filled_on: day(-11) },
], 'vehicle_id')

// ─── Production ──────────────────────────────────────────────────────────────

const productionOrders = await upsert('production_orders', [
  { code: 'OP-00001', product_label: 'Kit de estructura de aluminio', status: 'En proceso', quantity_planned: 200, quantity_done: 128, quantity_scrap: 6, unit: 'KIT', line: 'Línea A', supervisor_id: byCode['EMP-0004'], starts_on: day(-12), due_on: day(8), cost_cents: 38_000_000_00 },
  { code: 'OP-00002', product_label: 'Tablero de conexión DC', status: 'Planificada', quantity_planned: 60, unit: 'UN', line: 'Línea B', supervisor_id: byCode['EMP-0003'], starts_on: day(10), due_on: day(28), cost_cents: 9_400_000_00 },
])
const productionByCode = Object.fromEntries(productionOrders.map((p) => [p.code, p.id]))

await seedOnce('production_stages', [
  { order_id: productionByCode['OP-00001'], name: 'Corte', status: 'Terminada', quantity_done: 200, operator_id: byCode['EMP-0008'], position: 0 },
  { order_id: productionByCode['OP-00001'], name: 'Perforado', status: 'En proceso', quantity_done: 134, operator_id: byCode['EMP-0003'], position: 1 },
  { order_id: productionByCode['OP-00001'], name: 'Ensamble y empaque', status: 'Planificada', quantity_done: 0, position: 2 },
], 'order_id')

// ─── Patients ────────────────────────────────────────────────────────────────
// Sector module: seeded so the screen is demonstrable, with invented people.

const patients = await upsert('patients', [
  { code: 'PAC-00001', full_name: 'Rosa Elena Vargas', document_id: '41235678', birth_date: '1958-04-12', sex: 'F', blood_type: 'O+', status: 'Activo', phone: '+57 312 555 0133', insurer: 'Sura EPS', allergies: 'Penicilina', conditions: 'Hipertensión arterial', emergency_contact: 'Luis Vargas', emergency_phone: '+57 312 555 0134' },
  { code: 'PAC-00002', full_name: 'Mateo Quintero', document_id: '1023456789', birth_date: '2015-09-30', sex: 'M', blood_type: 'A+', status: 'Activo', phone: '+57 300 555 0155', insurer: 'Sanitas', emergency_contact: 'Ana Quintero', emergency_phone: '+57 300 555 0156' },
  { code: 'PAC-00003', full_name: 'Gloria Sanín', document_id: '52987412', birth_date: '1979-01-22', sex: 'F', blood_type: 'B-', status: 'Activo', phone: '+57 318 555 0177', insurer: 'Nueva EPS', conditions: 'Diabetes tipo 2' },
])
const patientByCode = Object.fromEntries(patients.map((p) => [p.code, p.id]))

await seedOnce('patient_visits', [
  { patient_id: patientByCode['PAC-00001'], kind: 'Control', professional_id: byCode['EMP-0001'], reason: 'Control de tensión arterial', diagnosis: 'HTA controlada', treatment: 'Continuar losartán 50 mg', fee_cents: 90_000_00, visited_at: new Date(Date.now() - 40 * 86400000).toISOString(), follow_up_on: day(-4) },
  { patient_id: patientByCode['PAC-00002'], kind: 'Consulta', professional_id: byCode['EMP-0001'], reason: 'Fiebre y odinofagia', diagnosis: 'Faringitis viral', treatment: 'Manejo sintomático', fee_cents: 110_000_00, visited_at: new Date(Date.now() - 6 * 86400000).toISOString() },
  { patient_id: patientByCode['PAC-00003'], kind: 'Control', professional_id: byCode['EMP-0001'], reason: 'Control metabólico', diagnosis: 'DM2 con adherencia parcial', treatment: 'Ajuste de metformina y remisión a nutrición', fee_cents: 90_000_00, visited_at: new Date(Date.now() - 15 * 86400000).toISOString(), follow_up_on: day(75) },
], 'patient_id')

// ─── Students ────────────────────────────────────────────────────────────────

const programs = await upsert('academic_programs', [
  { code: 'PRG-001', name: 'Técnico en instalaciones eléctricas', level: 'Técnico laboral', duration_terms: 4, tuition_cents: 1_800_000_00, coordinator_id: byCode['EMP-0004'] },
  { code: 'PRG-002', name: 'Tecnólogo en energías renovables', level: 'Tecnólogo', duration_terms: 6, tuition_cents: 2_600_000_00, coordinator_id: byCode['EMP-0001'] },
])
const programByCode = Object.fromEntries(programs.map((p) => [p.code, p.id]))

const students = await upsert('students', [
  { code: 'EST-00001', full_name: 'Andrea Pineda', document_id: '1098765432', birth_date: '2004-06-18', email: 'apineda@correo.test', status: 'Activo', program_id: programByCode['PRG-001'], guardian_name: 'Marta Pineda', guardian_phone: '+57 314 555 0191', enrolled_on: day(-200) },
  { code: 'EST-00002', full_name: 'Kevin Rojas', document_id: '1076543210', birth_date: '2003-11-02', email: 'krojas@correo.test', status: 'Activo', program_id: programByCode['PRG-001'], enrolled_on: day(-200) },
  { code: 'EST-00003', full_name: 'Lina Marcela Toro', document_id: '1087654321', birth_date: '2002-03-25', email: 'ltoro@correo.test', status: 'Activo', program_id: programByCode['PRG-002'], enrolled_on: day(-380) },
  { code: 'EST-00004', full_name: 'Brayan Cifuentes', document_id: '1065432109', status: 'Retirado', program_id: programByCode['PRG-002'], enrolled_on: day(-380) },
])
const studentByCode = Object.fromEntries(students.map((s) => [s.code, s.id]))

await seedOnce('student_enrollments', [
  { student_id: studentByCode['EST-00001'], subject: 'Circuitos I', term: '2026-I', teacher_id: byCode['EMP-0003'], status: 'Aprobado', grade: 88, attendance_pct: 95 },
  { student_id: studentByCode['EST-00001'], subject: 'Seguridad eléctrica', term: '2026-I', teacher_id: byCode['EMP-0008'], status: 'Cursando', attendance_pct: 91 },
  { student_id: studentByCode['EST-00002'], subject: 'Circuitos I', term: '2026-I', teacher_id: byCode['EMP-0003'], status: 'Reprobado', grade: 52, attendance_pct: 64 },
  { student_id: studentByCode['EST-00003'], subject: 'Sistemas fotovoltaicos', term: '2026-I', teacher_id: byCode['EMP-0004'], status: 'Aprobado', grade: 94, attendance_pct: 98 },
], 'student_id')

// ─── Restaurant ──────────────────────────────────────────────────────────────

const menu = await seedOnce('menu_items', [
  { name: 'Ajiaco santafereño', category: 'Plato fuerte', description: 'Con crema, alcaparras y aguacate.', price_cents: 38_000_00, cost_cents: 14_000_00, prep_minutes: 20, allergens: 'Lácteos' },
  { name: 'Ceviche de camarón', category: 'Entrada', price_cents: 32_000_00, cost_cents: 15_000_00, prep_minutes: 12, allergens: 'Mariscos' },
  { name: 'Lomo al trapo', category: 'Plato fuerte', price_cents: 56_000_00, cost_cents: 26_000_00, prep_minutes: 30 },
  { name: 'Postre de natas', category: 'Postre', price_cents: 16_000_00, cost_cents: 5_000_00, prep_minutes: 5, allergens: 'Lácteos' },
  { name: 'Limonada de coco', category: 'Bebida', price_cents: 14_000_00, cost_cents: 4_000_00, prep_minutes: 4, allergens: 'Lácteos' },
])
const menuByName = Object.fromEntries(menu.map((m) => [m.name, m.id]))

const tables = await upsert('dining_tables', [
  { label: 'Mesa 1', zone: 'Salón', seats: 4, status: 'Ocupada' },
  { label: 'Mesa 2', zone: 'Salón', seats: 2, status: 'Libre' },
  { label: 'Mesa 3', zone: 'Terraza', seats: 6, status: 'Reservada' },
  { label: 'Mesa 4', zone: 'Terraza', seats: 4, status: 'Libre' },
], 'org_id,label')
const tableByLabel = Object.fromEntries(tables.map((t) => [t.label, t.id]))

const comandas = await upsert('restaurant_orders', [
  { code: 'CMD-00001', table_id: tableByLabel['Mesa 1'], waiter_id: byCode['EMP-0005'], status: 'En cocina', guests: 3, subtotal_cents: 126_000_00, total_cents: 126_000_00 },
  { code: 'CMD-00002', table_id: tableByLabel['Mesa 2'], waiter_id: byCode['EMP-0002'], status: 'Pagada', guests: 2, subtotal_cents: 88_000_00, tip_cents: 8_800_00, total_cents: 96_800_00, closed_at: new Date(Date.now() - 3 * 3600000).toISOString() },
])
const comandaByCode = Object.fromEntries(comandas.map((c) => [c.code, c.id]))

await seedOnce('restaurant_order_items', [
  { order_id: comandaByCode['CMD-00001'], menu_item_id: menuByName['Ajiaco santafereño'], description: 'Ajiaco santafereño', quantity: 2, unit_price_cents: 38_000_00, position: 0 },
  { order_id: comandaByCode['CMD-00001'], menu_item_id: menuByName['Lomo al trapo'], description: 'Lomo al trapo', quantity: 1, unit_price_cents: 56_000_00, notes: 'Término medio', position: 1 },
  { order_id: comandaByCode['CMD-00002'], menu_item_id: menuByName['Ceviche de camarón'], description: 'Ceviche de camarón', quantity: 2, unit_price_cents: 32_000_00, position: 0 },
  { order_id: comandaByCode['CMD-00002'], menu_item_id: menuByName['Limonada de coco'], description: 'Limonada de coco', quantity: 1, unit_price_cents: 14_000_00, position: 1 },
], 'order_id')

// ─── Agriculture ─────────────────────────────────────────────────────────────

const lots = await upsert('farm_lots', [
  { code: 'LOT-0001', name: 'Lote La Cumbre', farm: 'Finca El Retiro', hectares: 12.5, soil_type: 'Franco arcilloso', location: 'Fredonia, Antioquia', status: 'En cosecha' },
  { code: 'LOT-0002', name: 'Lote El Bajo', farm: 'Finca El Retiro', hectares: 8, soil_type: 'Franco arenoso', location: 'Fredonia, Antioquia', status: 'Sembrado' },
])
const lotByCode = Object.fromEntries(lots.map((l) => [l.code, l.id]))

const cropCycles = await seedOnce('crop_cycles', [
  { lot_id: lotByCode['LOT-0001'], crop: 'Café', variety: 'Castillo', status: 'En crecimiento', hectares: 12.5, sown_on: day(-320), expected_harvest_on: day(10), expected_yield_kg: 18_750, input_cost_cents: 42_000_000_00, responsible_id: byCode['EMP-0004'] },
  { lot_id: lotByCode['LOT-0002'], crop: 'Aguacate', variety: 'Hass', status: 'Sembrado', hectares: 8, sown_on: day(-120), expected_harvest_on: day(240), expected_yield_kg: 24_000, input_cost_cents: 31_000_000_00, responsible_id: byCode['EMP-0004'] },
])
const cycleByCrop = Object.fromEntries(cropCycles.map((c) => [c.crop, c.id]))

if (cycleByCrop['Café']) {
  await seedOnce('harvests', [
    { cycle_id: cycleByCrop['Café'], quantity_kg: 6_400, quality: 'Excelso', price_per_kg_cents: 14_800_00, buyer: 'Cooperativa de Caficultores', harvested_on: day(-18) },
    { cycle_id: cycleByCrop['Café'], quantity_kg: 4_950, quality: 'Excelso', price_per_kg_cents: 15_100_00, buyer: 'Cooperativa de Caficultores', harvested_on: day(-4) },
  ], 'cycle_id')
}

// ─── Real estate ─────────────────────────────────────────────────────────────
// One tenant in arrears, so the mora KPI is not always zero.

const properties = await upsert('properties', [
  { code: 'INM-0001', name: 'Apto 501 — Torre Norte', kind: 'Apartamento', status: 'Arrendado', address: 'Cra 45 # 100-20', city: 'Bogotá', area_m2: 78, bedrooms: 3, bathrooms: 2, parking_spots: 1, rent_cents: 2_800_000_00, admin_fee_cents: 420_000_00, owner_name: 'Familia Robledo' },
  { code: 'INM-0002', name: 'Local 12 — Centro Comercial Sur', kind: 'Local', status: 'Arrendado', address: 'Av. Sur # 30-15', city: 'Bogotá', area_m2: 45, rent_cents: 4_100_000_00, admin_fee_cents: 800_000_00, owner_name: 'Inversiones Robledo' },
  { code: 'INM-0003', name: 'Bodega Fontibón', kind: 'Bodega', status: 'Disponible', address: 'Calle 17 # 96-40', city: 'Bogotá', area_m2: 320, rent_cents: 9_500_000_00, sale_price_cents: 1_450_000_000_00, owner_name: 'Inversiones Robledo' },
])
const propertyByCode = Object.fromEntries(properties.map((p) => [p.code, p.id]))

const leases = await seedOnce('leases', [
  { property_id: propertyByCode['INM-0001'], tenant_name: 'Carolina Estrada', tenant_document: '52114477', tenant_email: 'cestrada@correo.test', tenant_phone: '+57 316 555 0166', status: 'Activo', rent_cents: 2_800_000_00, deposit_cents: 2_800_000_00, due_day: 5, starts_on: day(-400), ends_on: day(330) },
  { property_id: propertyByCode['INM-0002'], tenant_name: 'Panadería La Espiga', tenant_document: '900555111-4', tenant_phone: '+57 601 555 0188', status: 'En mora', rent_cents: 4_100_000_00, deposit_cents: 4_100_000_00, due_day: 10, starts_on: day(-250) },
])

if (leases.length > 0) {
  const [aptLease, shopLease] = leases
  await seedOnce('lease_payments', [
    { lease_id: aptLease.id, period: period(-2), amount_cents: 2_800_000_00, paid_cents: 2_800_000_00, due_on: `${period(-2)}-05`, paid_on: `${period(-2)}-04`, method: 'Transferencia', reference: 'TRF-77120' },
    { lease_id: aptLease.id, period: period(-1), amount_cents: 2_800_000_00, paid_cents: 2_800_000_00, due_on: `${period(-1)}-05`, paid_on: `${period(-1)}-06`, method: 'Transferencia', reference: 'TRF-77455' },
    { lease_id: aptLease.id, period: period(0), amount_cents: 2_800_000_00, paid_cents: 0, due_on: `${period(0)}-05` },
    { lease_id: shopLease.id, period: period(-2), amount_cents: 4_100_000_00, paid_cents: 4_100_000_00, due_on: `${period(-2)}-10`, paid_on: `${period(-2)}-09`, method: 'Transferencia' },
    { lease_id: shopLease.id, period: period(-1), amount_cents: 4_100_000_00, paid_cents: 1_500_000_00, due_on: `${period(-1)}-10`, method: 'Efectivo' },
    { lease_id: shopLease.id, period: period(0), amount_cents: 4_100_000_00, paid_cents: 0, due_on: `${period(0)}-10` },
  ], 'lease_id')
}

// ─── Hospitality ─────────────────────────────────────────────────────────────

const rooms = await upsert('hotel_rooms', [
  { number: '101', kind: 'Sencilla', status: 'Disponible', floor: 1, capacity: 1, rate_cents: 180_000_00, amenities: 'Wifi, aire acondicionado' },
  { number: '102', kind: 'Doble', status: 'Ocupada', floor: 1, capacity: 2, rate_cents: 260_000_00, amenities: 'Wifi, aire acondicionado, minibar' },
  { number: '201', kind: 'Suite', status: 'Disponible', floor: 2, capacity: 4, rate_cents: 480_000_00, amenities: 'Wifi, jacuzzi, balcón' },
  { number: '202', kind: 'Familiar', status: 'Limpieza', floor: 2, capacity: 5, rate_cents: 390_000_00, amenities: 'Wifi, cocineta' },
], 'org_id,number')
const roomByNumber = Object.fromEntries(rooms.map((r) => [r.number, r.id]))

await upsert('reservations', [
  { code: 'RES-00001', room_id: roomByNumber['102'], guest_name: 'Felipe Arango', guest_document: '71234567', guest_email: 'farango@correo.test', status: 'Check-in', guests: 2, checkin_on: day(-1), checkout_on: day(2), nightly_rate_cents: 260_000_00, total_cents: 780_000_00, paid_cents: 780_000_00, channel: 'Directo' },
  { code: 'RES-00002', room_id: roomByNumber['201'], guest_name: 'Sandra Milena Ríos', guest_document: '43876512', guest_phone: '+57 313 555 0144', status: 'Confirmada', guests: 3, checkin_on: day(0), checkout_on: day(4), nightly_rate_cents: 480_000_00, total_cents: 1_920_000_00, paid_cents: 500_000_00, channel: 'Booking' },
  { code: 'RES-00003', room_id: roomByNumber['101'], guest_name: 'Tomás Herrera', status: 'Check-out', guests: 1, checkin_on: day(-6), checkout_on: day(-3), nightly_rate_cents: 180_000_00, total_cents: 540_000_00, paid_cents: 540_000_00, channel: 'Directo' },
])

console.log('')
console.log('✓ listo')
console.log('')
console.log(`  correo:     ${email}`)
console.log(`  contraseña: ${password}`)
console.log('')
console.log('  Cámbiala tras el primer acceso: es una credencial de demostración,')
console.log('  y este script no debe ejecutarse contra una base con datos reales.')
