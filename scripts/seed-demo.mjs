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

const email = (process.argv[2] ?? 'demo@kigyo.test').toLowerCase()
const password = process.argv[3] ?? 'kigyo-demo-2026'

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
  console.log('  ya existía, se reutiliza')
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = new Date()
const day = (offset) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

async function upsert(table, rows, onConflict = 'org_id,code') {
  if (rows.length === 0) return []
  const { data, error } = await db
    .from(table)
    .upsert(rows.map((row) => ({ org_id: orgId, ...row })), { onConflict })
    .select()
  if (error) fail(`insertar en ${table}`, error)
  console.log(`  ${table}: ${data.length}`)
  return data
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

await upsert('inventory_assets', [
  { code: 'INV-0001', name: 'MacBook Pro 14"', category: 'Cómputo', employee_id: byCode['EMP-0002'], serial: 'C02X1234', status: 'Asignado', acquired_on: '2024-03-10' },
  { code: 'INV-0002', name: 'Dell Latitude 5440', category: 'Cómputo', serial: 'DL55231', status: 'Disponible', acquired_on: '2024-09-01' },
  { code: 'INV-0003', name: 'iPhone 15', category: 'Móvil', serial: 'IP15A991', status: 'Disponible', acquired_on: '2025-02-14' },
  { code: 'INV-0004', name: 'Monitor LG 27"', category: 'Monitor', employee_id: byCode['EMP-0003'], serial: 'LG27B77', status: 'Asignado', acquired_on: '2024-05-20' },
  { code: 'INV-0005', name: 'Multímetro Fluke', category: 'Herramientas', serial: 'FL8845', status: 'Mantenimiento', acquired_on: '2023-08-02' },
])

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

console.log('')
console.log('✓ listo')
console.log('')
console.log(`  correo:     ${email}`)
console.log(`  contraseña: ${password}`)
console.log('')
console.log('  Cámbiala tras el primer acceso: es una credencial de demostración,')
console.log('  y este script no debe ejecutarse contra una base con datos reales.')
