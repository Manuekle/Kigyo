import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * Los datos con los que la empresa se presenta en un documento.
 *
 * Razón social, NIT, ciudad y dirección se preguntaban una sola vez, en el
 * asistente, y no había dónde corregirlos: un NIT mal tecleado el primer día se
 * quedaba en todas las facturas y la única salida era crear otra empresa.
 * Ciudad y dirección ni siquiera existían como columna (migración 111).
 *
 * Esta prueba mira lo único que no se puede comprobar sin navegador: que el
 * formulario escribe de verdad y que lo escrito sobrevive una recarga. Deja la
 * empresa **exactamente** como la encontró, valores vacíos incluidos.
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

async function signIn(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('#login-email').fill(email!)
  await page.locator('#login-password').fill(password!)
  await page.locator('form.auth-form-shell button[type=submit]').click()
  await expect(page).not.toHaveURL(/\/login(\/|$)/, { timeout: 60_000 })
}

/** Los cuatro campos nuevos, por el orden en que están en la pestaña. */
const CAMPOS = ['Razón social', 'NIT / identificación fiscal', 'Ciudad', 'Dirección']

async function abrirEmpresa(page: Page): Promise<void> {
  await page.goto('/dashboard/configuracion')
  await page.getByRole('tab', { name: 'Empresa' }).click()
  await expect(page.getByText('Información de la organización')).toBeVisible({ timeout: 60_000 })
}

function campo(page: Page, label: string) {
  // Los `.flabel` de esta pantalla son divs, no <label for>, así que el campo
  // es el `.field` que va justo detrás del rótulo.
  return page.locator(`.flabel:text-is("${label}") + input.field`)
}

test.describe('datos de la empresa', () => {
  test.skip(
    !email || !password,
    'Falta el fixture: define E2E_USER_EMAIL/E2E_USER_PASSWORD (o DEMO_ACCOUNT_* en .env.local).',
  )

  test('se corrigen desde Configuración y sobreviven la recarga', async ({ page }) => {
    test.slow()
    await signIn(page)
    await abrirEmpresa(page)

    const previos: string[] = []
    for (const label of CAMPOS) previos.push(await campo(page, label).inputValue())

    try {
      await campo(page, 'Ciudad').fill('Bogotá D.C.')
      await campo(page, 'Dirección').fill('Calle 100 # 7-33, oficina 502')
      await page.getByRole('button', { name: 'Guardar cambios' }).click()

      await page.reload()
      await abrirEmpresa(page)
      await expect(campo(page, 'Ciudad')).toHaveValue('Bogotá D.C.')
      await expect(campo(page, 'Dirección')).toHaveValue('Calle 100 # 7-33, oficina 502')
    } finally {
      // Restaura lo que encontró, no lo que debería haber: si la empresa tenía
      // los campos vacíos, vacíos se quedan.
      await abrirEmpresa(page)
      for (const [i, label] of CAMPOS.entries()) await campo(page, label).fill(previos[i])
      await page.getByRole('button', { name: 'Guardar cambios' }).click()
      await page.waitForTimeout(600)
    }
  })
})
