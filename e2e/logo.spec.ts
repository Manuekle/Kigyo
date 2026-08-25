import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * El logo de la empresa (migración 107).
 *
 * Era el último control muerto del producto: «Cambiar logo» contestaba
 * `addToast('Selector de logo próximamente')`. El sitio donde guardarlo existía
 * desde la migración 30 —`organizations.branding.logo_url`— y `updateBranding`
 * sabía escribirlo; faltaban el bucket y quien subiera el archivo.
 *
 * Se prueba aquí y no con psql porque lo que hay que comprobar son las
 * **políticas de storage bajo RLS real**, y psql entra como `postgres`, que
 * tiene `rolbypassrls` y no ve ninguna. La única forma de que la política de la
 * migración 107 se evalúe de verdad es un navegador con sesión.
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

const ORG_NAME = 'IPS Bogota'

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

/** Un PNG de 1×1 transparente, el archivo válido más pequeño que existe. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

async function signIn(page: Page, user: string, pass: string): Promise<void> {
  await page.goto('/login')
  await page.locator('#login-email').fill(user)
  await page.locator('#login-password').fill(pass)
  await page.locator('form.auth-form-shell button[type=submit]').click()
  await expect(page).not.toHaveURL(/\/login(\/|$)/)
}

test.describe('logo de la empresa', () => {
  test.skip(
    !email || !password || !dbUrl,
    'Falta el fixture: define E2E_USER_EMAIL/E2E_USER_PASSWORD (o DEMO_ACCOUNT_* en .env.local) y SUPABASE_DB_URL.',
  )
  test.slow()

  test('sube el logo, lo guarda en branding y lo vuelve a mostrar', async ({ page }) => {
    const orgId = psql(`select id from organizations where name = '${ORG_NAME}';`)
    expect(orgId, `no existe la empresa fixture ${ORG_NAME}`).toMatch(/^[0-9a-f-]{36}$/)

    // Lo que hubiera antes, para devolverlo tal cual. `branding` también guarda
    // `accent`, así que se conserva el objeto entero y no solo la clave.
    const before = psql(`select coalesce(branding::text, 'null') from organizations where id = '${orgId}';`)

    try {
      await signIn(page, email!, password!)
      await ensureOrg(page, ORG_NAME)

      await page.goto('/dashboard/configuracion')
      await page.getByRole('tab', { name: 'Empresa', exact: true }).click()

      // El control es un <label> con un input file oculto, igual que el avatar.
      await page.locator('input[type=file][accept*="image"]').setInputFiles({
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: PNG_1PX,
      })

      await expect(page.locator('[role=status]', { hasText: 'Logo actualizado' }))
        .toBeVisible({ timeout: 15_000 })

      // 1. La ruta quedó escrita donde la lee el resto del producto.
      const stored = psql(`select branding ->> 'logo_url' from organizations where id = '${orgId}';`)
      expect(stored).toBe(`${orgId}/logo`)

      // 2. El objeto existe de verdad en el bucket, y en el bucket correcto.
      const objects = psql(`
select count(*) from storage.objects
 where bucket_id = 'logos' and name = '${orgId}/logo';
`)
      expect(objects).toBe('1')

      // 3. Y la pantalla lo enseña: tras recargar, la URL firmada ya viaja con
      //    la consulta y el cuadrado con la inicial deja paso a la imagen.
      await page.reload()
      await page.getByRole('tab', { name: 'Empresa', exact: true }).click()
      await expect(page.getByRole('img', { name: new RegExp(`Logo de ${ORG_NAME}`) }))
        .toBeVisible({ timeout: 15_000 })
    } finally {
      /*
       * Solo se restaura `branding`. El objeto del bucket se queda, y no por
       * pereza: Supabase prohíbe borrar de `storage.objects` por SQL
       * —`storage.protect_delete()` levanta «Direct deletion from storage
       * tables is not allowed»— para que no queden binarios huérfanos sin su
       * fila. Es un PNG de 1×1 en una ruta fija que la siguiente corrida
       * sobrescribe, así que no se acumula nada.
       */
      psql(`
update organizations set branding = ${before === 'null' ? 'null' : `'${before.replace(/'/g, "''")}'::jsonb`}
 where id = '${orgId}';
`)
    }
  })
})

/** Activa la empresa fixture si la cookie dejó otra como activa. */
async function ensureOrg(page: Page, orgName: string): Promise<void> {
  await page.goto('/dashboard')
  await page.locator('.cswitch-trigger').click()
  const target = page.locator('[role=menuitemradio]', { hasText: orgName }).first()
  await expect(target).toBeVisible()
  if ((await target.getAttribute('aria-checked')) === 'true') {
    await page.keyboard.press('Escape')
    return
  }
  await target.click()
  await expect(page).toHaveURL(/\/dashboard(\/|$)/)
  await expect(page.locator('.cswitch-name')).toHaveText(orgName)
}
