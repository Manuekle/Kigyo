import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * El muro de pago (migración 106).
 *
 * Es la prueba que más falta hacía, porque el defecto que cierra no era un
 * fallo sino una **ausencia**: registrarse creaba una cuenta `starter` —el plan
 * que `/pricing` cobra a $80.000/mes— sin suscripción, sin vencimiento y sin
 * ninguna pantalla que volviera a pedir dinero. El checkout de Polar estaba
 * construido y correcto; nada mandaba a nadie hacia él. Las 290 pruebas
 * unitarias que había entonces estaban todas en verde, porque cada una
 * comprobaba una pieza que sí funcionaba.
 *
 * Lo que se comprueba aquí es la composición, que es lo único que las pruebas
 * unitarias no pueden ver:
 *
 *   1. una cuenta al día entra al panel;
 *   2. la misma cuenta en `pending` **no** entra y aterriza en `/suscripcion`;
 *   3. la pantalla ofrece los planes con checkout, no un callejón;
 *   4. la base de datos también lo impide —`app.company_is_active` es el
 *      predicado de las 543 políticas RESTRICTIVE—, así que el muro no es solo
 *      un `redirect` de TypeScript que se esquiva hablando con PostgREST;
 *   5. y volver a `active` lo deshace entero, sin haber perdido una fila.
 *
 * El fixture se toca y se devuelve en `finally`: la cuenta demo es la misma que
 * usan los otros cinco specs, y dejarla en `pending` los tumbaría todos.
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

/**
 * `psql`, sin filtrar la cadena de conexión cuando falla.
 *
 * `execFileSync` mete el comando entero en el mensaje de error, y el comando
 * lleva `SUPABASE_DB_URL` — usuario y contraseña incluidos. Un fallo de fixture
 * acababa imprimiendo las credenciales de producción en la salida de la suite,
 * que es exactamente donde se copian y se pegan en un informe. Se vuelve a
 * lanzar solo lo que dijo el servidor.
 */
function psql(sql: string): string {
  try {
    return execFileSync('psql', ['-A', '-t', '-v', 'ON_ERROR_STOP=1', dbUrl!], {
      input: sql,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? ''
    throw new Error(`psql falló: ${stderr.trim() || 'sin detalle'}`)
  }
}

async function signIn(page: Page, user: string, pass: string): Promise<void> {
  await page.goto('/login')
  await page.locator('#login-email').fill(user)
  await page.locator('#login-password').fill(pass)
  await page.locator('form.auth-form-shell button[type=submit]').click()
  await expect(page).not.toHaveURL(/\/login(\/|$)/)
}

test.describe('muro de pago', () => {
  test.skip(
    !email || !password || !dbUrl,
    'Falta el fixture: define E2E_USER_EMAIL/E2E_USER_PASSWORD (o DEMO_ACCOUNT_* en .env.local) y SUPABASE_DB_URL.',
  )
  test.slow()

  test('una cuenta sin plan activo no entra al panel y aterriza en el checkout', async ({ page }) => {
    // La cuenta que posee la empresa activa del usuario demo. Se busca por el
    // usuario y no por nombre: el fixture puede renombrarse, el correo no.
    const accountId = psql(`
      select o.account_id
      from public.memberships m
      join public.organizations o on o.id = m.org_id
      join public.profiles p on p.id = m.user_id
      where p.email = '${email!.replace(/'/g, "''")}'
      order by m.created_at
      limit 1;
    `)
    expect(accountId, 'no se encontró la cuenta del usuario demo').toMatch(/^[0-9a-f-]{36}$/)

    const orgId = psql(`
      select id from public.organizations
      where account_id = '${accountId}' and setup_completed_at is not null
      order by created_at limit 1;
    `)
    expect(orgId, 'la cuenta demo no tiene una empresa ya configurada').toMatch(/^[0-9a-f-]{36}$/)

    try {
      // ─── 1. Al día: el panel abre ────────────────────────────────────────
      psql(`update public.accounts set access_state = 'active' where id = '${accountId}';`)
      await signIn(page, email!, password!)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard(\/|$)/)

      // La guardia de la base de datos dice lo mismo que la pantalla.
      expect(psql(`select app.company_is_active('${orgId}');`)).toBe('t')

      // ─── 2. Sin pagar: el panel se cierra ────────────────────────────────
      psql(`update public.accounts set access_state = 'pending' where id = '${accountId}';`)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/suscripcion(\/|$)/)

      // Y no solo el panel: cualquier ruta de dentro.
      await page.goto('/dashboard/clientes')
      await expect(page).toHaveURL(/\/suscripcion(\/|$)/)

      // ─── 3. La pantalla es una salida, no un callejón ────────────────────
      // Los tres planes, y un botón de pago para los dos que se venden solos.
      await expect(page.getByRole('heading', { name: /Activa tu suscripción/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Pagar Starter/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Pagar Growth/i })).toBeVisible()
      // Enterprise nunca lleva checkout: va a ventas.
      await expect(page.getByRole('link', { name: /Contactar ventas/i })).toBeVisible()

      // ─── 4. La base tampoco deja escribir ────────────────────────────────
      // Esto es lo que distingue un muro de un cartel. `access_state` lo lee
      // `app.company_is_active`, que es el predicado de las 543 políticas
      // RESTRICTIVE de la migración 99 — así que da igual que alguien se salte
      // el `redirect` y hable con PostgREST directo con la anon key.
      expect(psql(`select app.company_is_active('${orgId}');`)).toBe('f')

      // ─── 5. Pagar lo deshace entero ──────────────────────────────────────
      // Lo que hace el webhook de Polar al llegar `subscription.active`.
      psql(`select public.apply_subscription('${accountId}', null, 'active');`)
      expect(psql(`select access_state from public.accounts where id = '${accountId}';`)).toBe('active')
      expect(psql(`select app.company_is_active('${orgId}');`)).toBe('t')

      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard(\/|$)/)
    } finally {
      // El fixture vuelve como estaba pase lo que pase: los otros cinco specs
      // usan esta misma cuenta y en `pending` fallarían todos.
      psql(`update public.accounts set access_state = 'active' where id = '${accountId}';`)
      psql(`update public.organizations set status = 'active' where account_id = '${accountId}';`)
    }
  })
})
