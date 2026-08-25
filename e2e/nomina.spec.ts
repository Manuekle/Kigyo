import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * Nómina legal — smoke del ciclo completo (plan 4.3):
 *
 *   fixture (psql, como el admin demo) → crear concepto → añadir línea al
 *   desglose → editar el monto → cerrar el periodo → verificar read-only →
 *   exportar PILA.
 *
 * El fixture siembra su propio empleado y un periodo en un mes futuro libre
 * (2035+), porque el periodo corriente no se puede reabrir tras el cierre y
 * el mes actual colisionaría en la segunda corrida. El cierre es
 * IRREVERSIBLE por diseño (guard KG301 sin bypass): si el spec llega a
 * cerrar, el periodo queda como residuo inerte y read-only en la empresa
 * demo — documento la aceptación explícita aquí. Si falla antes del cierre,
 * el teardown borra todo.
 */

function localEnv(name: string): string | undefined {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    const line = raw.split('\n').find((l) => l.startsWith(`${name}=`))
    return line?.slice(name.length + 1).replace(/^["']|["']$/g, '')
  } catch {
    return undefined
  }
}

const email = process.env.E2E_USER_EMAIL ?? localEnv('DEMO_ACCOUNT_EMAIL')
const password = process.env.E2E_USER_PASSWORD ?? localEnv('DEMO_ACCOUNT_PASSWORD')
const dbUrl = process.env.SUPABASE_DB_URL ?? localEnv('SUPABASE_DB_URL')

// IPS Bogota: la empresa demo con `nomina` activo.
const ORG_NAME = 'IPS Bogota'
const ORG_ID = '1b82cb7c-ea6a-4b84-9388-0dceb40e5b5f'
const ADMIN_ID = 'eb711727-43fe-46a2-b8f5-f63b914191ea'
const EMP_NAME = 'E2E Nomina QA'
const CONCEPT_NAME = 'E2E Prima extra'

/**
 * `psql`, sin filtrar la cadena de conexión cuando falla.
 *
 * `execFileSync` mete el comando entero en el mensaje de error, y el comando
 * lleva `SUPABASE_DB_URL` — usuario y contraseña incluidos. Un fallo de fixture
 * acababa imprimiendo las credenciales de producción en la salida de la suite,
 * que es exactamente donde se copian y se pegan en un informe o en un log de
 * CI. Se vuelve a lanzar solo lo que dijo el servidor.
 *
 * Nótese que NO devuelve `.trim()`: varios llamantes de este archivo parten la
 * salida por líneas y cuentan con el salto final. Cambiarlo aquí rompería los
 * fixtures en silencio, que es peor que la fuga que se está tapando.
 */
function psql(sql: string): string {
  try {
    return execFileSync('psql', ['-A', '-t', '-v', 'ON_ERROR_STOP=1', dbUrl!], {
      input: sql,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? ''
    throw new Error(`psql falló: ${stderr.trim() || 'sin detalle'}`)
  }
}

const claims = JSON.stringify({ sub: ADMIN_ID, role: 'authenticated' })

function seed(employeeId: string, periodId: string): void {
  psql(`
select set_config('request.jwt.claims', '${claims}', true);
insert into employees (id, org_id, full_name, position, department, status, tax_id)
values ('${employeeId}', '${ORG_ID}', '${EMP_NAME}', 'QA', 'E2E', 'Activo', '900000001');
insert into payroll_periods (id, org_id, period, status)
values ('${periodId}', '${ORG_ID}', (
  select min(m)::date from generate_series(date '2035-01-01', date '2049-12-01', interval '1 month') m
  where not exists (
    select 1 from payroll_periods p
    where p.org_id = '${ORG_ID}' and p.period = m::date
  )
), 'Borrador');
insert into payroll_lines (payroll_period_id, employee_id)
values ('${periodId}', '${employeeId}');
`)
}

function teardown(employeeId: string, periodId: string): void {
  psql(`
select set_config('request.jwt.claims', '${claims}', true);
-- El guard KG301 aborta el cascade si el periodo quedó cerrado: solo se
-- borra cuando sigue abierto (fallo antes del cierre).
delete from payroll_periods where id = '${periodId}' and locked_at is null;
delete from employees where id = '${employeeId}'
  and not exists (select 1 from payroll_concept_lines l where l.employee_id = '${employeeId}');
delete from payroll_concepts where org_id = '${ORG_ID}' and name = '${CONCEPT_NAME}';
`)
}

test.describe('nómina legal', () => {
  test.skip(
    !email || !password || !dbUrl,
    'Falta el fixture: define E2E_USER_EMAIL/E2E_USER_PASSWORD (o DEMO_ACCOUNT_* en .env.local) y SUPABASE_DB_URL.',
  )

  test('concepto → línea → edición → cierre inmutable → PILA', async ({ page }) => {
    test.slow() // cada paso refetchea la nómina completa vía server action
    const employeeId = randomUUID()
    const periodId = randomUUID()
    seed(employeeId, periodId)
    try {
      await signIn(page, email!, password!)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard(\/|$)/)
      await ensureOrg(page, ORG_NAME)

      await page.goto('/dashboard/nomina')
      const desglose = page.locator('.card', { hasText: 'Desglose por empleado' })
      const empRow = desglose.locator('tbody tr', { hasText: EMP_NAME }).first()
      await expect(empRow).toBeVisible()

      // 1. Crear el concepto desde el catálogo.
      await desglose.getByRole('button', { name: 'Conceptos', exact: true }).click()
      const modal = page.locator('.modal', { hasText: 'Conceptos de nómina' })
      await expect(modal).toBeVisible()
      await modal.locator('input[placeholder="Nombre (ej. Horas extras)"]').fill(CONCEPT_NAME)
      await modal.getByRole('button', { name: 'Añadir concepto' }).click()
      await expect(modal.locator('.elrow', { hasText: CONCEPT_NAME })).toBeVisible()
      await modal.locator('button[aria-label="Cerrar"]').click()
      await expect(modal).toBeHidden()

      // 2. Añadir la línea al desglose del empleado fixture.
      await empRow.locator('+ tr').getByRole('button', { name: 'Añadir concepto' }).click()
      await empRow.locator('+ tr').locator('button.nselect-trigger').click()
      await page.locator('[role=option]', { hasText: CONCEPT_NAME }).click()
      await empRow.locator('+ tr').locator('input[placeholder="Valor (COP)"]').fill('1000')
      await empRow.locator('+ tr').getByRole('button', { name: 'Añadir línea' }).click()

      const lineRow = desglose.locator('tbody tr', { hasText: CONCEPT_NAME }).first()
      await expect(lineRow).toBeVisible()
      const amount = lineRow.locator('input[aria-label="Valor del concepto"]')
      await expect(amount).toHaveValue('1000') // 1000 pesos → 100000 centavos

      // 3. Editar el monto en la línea (commit on blur).
      await amount.fill('1500')
      await amount.press('Tab')
      await expect(amount).toHaveValue('1500')
      // El neto del empleado header refleja el nuevo devengo.
      await expect(empRow).toContainText(/1\.500/)

      // 4. Cerrar el periodo: congelado para siempre.
      await desglose.getByRole('button', { name: 'Cerrar periodo', exact: true }).click()
      const confirm = page.locator('.modal', { hasText: 'Cerrar periodo' })
      await expect(confirm).toBeVisible()
      await confirm.locator('.btn.dark').click()
      await expect(confirm).toBeHidden()

      // 5. Read-only: chip cerrado, input disabled, sin acciones de escritura.
      await expect(desglose).toContainText('cerrado')
      await expect(amount).toBeDisabled()
      await expect(desglose.getByRole('button', { name: 'Añadir concepto' })).toHaveCount(0)
      await expect(desglose.getByRole('button', { name: 'Cerrar periodo', exact: true })).toHaveCount(0)

      // 6. PILA del periodo cerrado: el route resuelve y devuelve el xlsx.
      //    (No se espera el evento 'download' del navegador: el blob se
      //    revoca en el mismo tick del link.click() y el evento es flaky.)
      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/v1/export') && r.request().method() === 'POST',
        ),
        desglose.getByRole('button', { name: 'PILA', exact: true }).click(),
      ])
      expect(resp.status()).toBe(200)
      expect(resp.headers()['content-disposition']).toMatch(/pila-\d{4}-\d{2}-\d{2}\.xlsx/)
      await expect(page.getByText(/filas exportadas/)).toBeVisible()
    } finally {
      teardown(employeeId, periodId)
    }
  })
})

/** Activa la empresa fixture si el sesión cookie dejó otra como activa. */
async function ensureOrg(page: Page, orgName: string): Promise<void> {
  await page.locator('.cswitch-trigger').click()
  const items = page.locator('[role=menuitemradio]')
  await expect(items.first()).toBeVisible()
  const active = page.locator('[role=menuitemradio][aria-checked="true"] .cswitch-item-name')
  if ((await active.first().textContent()) === orgName) {
    // Re-elegir la activa cierra el menú sin navegación (choose() no-op).
    await page.locator('[role=menuitemradio][aria-checked="true"]').click()
    return
  }
  const target = page.locator('[role=menuitemradio]', { hasText: orgName })
  await expect(target).toBeVisible()
  await target.click()
  await expect(page).toHaveURL(/\/dashboard(\/|$)/)
  await expect(page.locator('.cswitch-name')).toHaveText(orgName)
}

async function signIn(page: Page, user: string, pass: string): Promise<void> {
  await page.goto('/login')
  await page.locator('#login-email').fill(user)
  await page.locator('#login-password').fill(pass)
  await page.locator('form.auth-form-shell button[type=submit]').click()
  await expect(page).not.toHaveURL(/\/login(\/|$)/)
}
