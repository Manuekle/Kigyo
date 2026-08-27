import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * Los tres segmentos — CRM, POS y ERP — vistos desde el navegador.
 *
 * La aritmética (qué módulo sirve a qué parte, qué propone el asistente con un
 * enfoque puesto) está pineada en `registry.test.ts` y `sectors.test.ts`, que
 * son puros y no necesitan navegador. Lo que sólo se puede comprobar aquí es la
 * composición: la lente vive en `localStorage`, la dibuja el rail con el filtro
 * de permisos ya aplicado, y se tiene que recordar entre recargas. Cada una de
 * esas tres piezas puede estar bien mientras el conjunto está mal.
 *
 * No crea ni borra nada: mira la empresa activa del usuario demo y comprueba
 * invariantes que valen sea cual sea esa empresa. Un spec que sembrara su
 * propia empresa gastaría uno de los tres cupos del plan Growth y dejaría
 * residuo si fallara a mitad.
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

/**
 * Todos los enlaces del rail, plegados incluidos.
 *
 * El «plegados incluidos» es la mitad del assert: sin lente el rail abre dos
 * secciones y dobla el resto, así que contar sólo lo visible mide qué está
 * desplegado, no qué ofrece la lista. Esta comparación falsa fue lo primero que
 * dio esta prueba, y decía que la lente no filtraba cuando sí filtraba.
 */
async function links(page: Page): Promise<string[]> {
  return page.locator('nav.nav .nitem-row a').allInnerTexts()
}

test.describe('segmentos', () => {
  test.skip(
    !email || !password,
    'Falta el fixture: define E2E_USER_EMAIL/E2E_USER_PASSWORD (o DEMO_ACCOUNT_* en .env.local).',
  )

  test('la lente del rail recorta por segmento, no inventa y se recuerda', async ({ page }) => {
    test.slow()
    await signIn(page)
    await page.goto('/dashboard')
    await page.waitForSelector('nav.nav', { timeout: 60_000 })

    const lens = page.locator('.nav-lens')
    if ((await lens.count()) === 0) {
      // Una empresa que usa un solo segmento no tiene vistas que alternar, y
      // eso también es correcto — pero no es lo que esta prueba mira.
      test.skip(true, 'La empresa activa usa un solo segmento: no hay lente que probar.')
    }

    const todo = await links(page)
    expect(todo.length).toBeGreaterThan(1)

    const seen: Record<string, string[]> = {}
    for (const chip of ['CRM', 'POS', 'ERP']) {
      const button = page.getByRole('button', { name: chip, exact: true })
      if ((await button.count()) === 0) continue
      await button.click()
      await page.waitForTimeout(300)
      seen[chip] = await links(page)
      // Una lente nunca puede enseñar un módulo que la empresa no tiene: filtra
      // la misma lista, no consulta otra.
      for (const item of seen[chip]) expect(todo, `${chip} inventó ${item}`).toContain(item)
      expect(seen[chip].length, `${chip} no recortó nada`).toBeLessThan(todo.length)
    }
    expect(Object.keys(seen).length, 'ninguna pastilla de segmento').toBeGreaterThan(1)

    // Cada módulo declara al menos un segmento, así que las lentes ofrecidas,
    // juntas, tienen que devolver el rail entero. Si sobra uno, hay un módulo
    // huérfano que sólo se ve con «Todo» — invisible para quien deja la lente
    // puesta.
    const offered = Object.values(seen).flat()
    expect([...new Set(offered)].sort()).toEqual([...todo].sort())

    // La lente vigente sobrevive la recarga: se guarda por empresa y por
    // dispositivo, al lado de las secciones plegadas y de los fijados.
    const last = Object.keys(seen)[Object.keys(seen).length - 1]
    await page.reload()
    await page.waitForSelector('nav.nav', { timeout: 60_000 })
    await page.waitForTimeout(300)
    await expect(page.getByRole('button', { name: last, exact: true }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(await links(page)).toEqual(seen[last])

    // Y «Todo» devuelve exactamente lo que había.
    await page.getByRole('button', { name: 'Todo', exact: true }).click()
    await page.waitForTimeout(300)
    expect(await links(page)).toEqual(todo)
  })

  test('el panel obedece la lente y dice qué esconde', async ({ page }) => {
    test.slow()
    await signIn(page)
    await page.goto('/dashboard')
    await page.waitForSelector('nav.nav', { timeout: 60_000 })
    if ((await page.locator('.nav-lens').count()) === 0) {
      test.skip(true, 'La empresa activa usa un solo segmento: no hay lente que probar.')
    }

    const tiles = page.locator('.gkpi > div')
    // El esqueleto de carga también dibuja casillas en `.gkpi`, así que contar
    // antes de que llegue el contenido mide el placeholder: la primera versión
    // de esta prueba leyó siete donde había tres y concluyó que la lente
    // escondía cosas que no escondía.
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.gkpi').first()).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(600)
    const todos = await tiles.count()

    // Cuál de las tres esconde algo depende de la empresa: si todos sus
    // indicadores son de la misma parte, no esconder nada es la respuesta
    // correcta y no hay nota que enseñar.
    let conNota: string | null = null
    for (const chip of ['CRM', 'POS', 'ERP']) {
      const button = page.getByRole('button', { name: chip, exact: true })
      if ((await button.count()) === 0) continue
      await button.click()
      await page.waitForTimeout(300)
      const visibles = await tiles.count()
      expect(visibles, `${chip} inventó indicadores`).toBeLessThanOrEqual(todos)
      if (visibles < todos) {
        conNota = chip
        break
      }
      // Sin nada escondido no puede haber nota: sería explicar una ausencia
      // que no existe.
      expect(await page.locator('.dash-lens-note').count(), chip).toBe(0)
    }

    if (conNota === null) {
      test.skip(true, 'Los indicadores de esta empresa son todos de la misma parte.')
    }

    const nota = page.locator('.dash-lens-note')
    await expect(nota).toBeVisible()
    await expect(nota).toContainText(conNota!)
    // Y el camino de vuelta está en la propia nota, no sólo en el rail.
    await nota.getByRole('button', { name: 'Ver todo' }).click()
    await page.waitForTimeout(300)
    expect(await tiles.count()).toBe(todos)
    await expect(page.getByRole('button', { name: 'Todo', exact: true }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  test('el ⌘K entiende CRM, POS y ERP como segmentos', async ({ page }) => {
    test.slow()
    await signIn(page)
    await page.goto('/dashboard')
    await page.waitForSelector('nav.nav', { timeout: 60_000 })

    await page.keyboard.press('/')
    const input = page.locator('.cmdk-input, .cpal input, input[placeholder*="Busca"]').first()
    await expect(input).toBeVisible({ timeout: 30_000 })
    await input.fill('ERP')
    await page.waitForTimeout(400)
    const filas = await page.locator('[role=option], .cpal-item').allInnerTexts()
    // «ERP» no es el nombre de ninguna pantalla: si devuelve filas, es porque
    // la palabra se entendió como segmento y no como texto.
    expect(filas.join(' ').length).toBeGreaterThan(0)
    console.log('⌘K ERP: ' + filas.join(' · '))
  })

  test('el catálogo de Configuración se filtra por segmento', async ({ page }) => {
    test.slow()
    await signIn(page)
    await page.goto('/dashboard/configuracion')
    await page.getByRole('tab', { name: 'Módulos' }).click()
    await expect(page.locator('.mod-lens')).toBeVisible({ timeout: 60_000 })

    const all = await page.locator('.acc .act').count()
    await page.getByRole('button', { name: /^POS · / }).click()
    await page.waitForTimeout(200)
    const pos = await page.locator('.acc .act').count()
    expect(pos).toBeGreaterThan(0)
    expect(pos).toBeLessThan(all)

    // La cuenta de la pastilla es contra el plan, no contra el catálogo: ofrecer
    // «5/13» donde ocho de esos trece no se pueden encender sería contar algo
    // que no está en juego.
    const label = await page.getByRole('button', { name: /^POS · / }).innerText()
    const [activos, enPlan] = label.replace(/^POS · /, '').split('/').map(Number)
    expect(enPlan).toBeGreaterThanOrEqual(activos)
    expect(enPlan).toBeLessThanOrEqual(all)

    await page.getByRole('button', { name: /^Todo · / }).click()
    await page.waitForTimeout(200)
    expect(await page.locator('.acc .act').count()).toBe(all)
  })

  test('la landing del sector nombra las tres partes con sus números', async ({ page }) => {
    await page.goto('/soluciones/alimentos')
    const suites = page.locator('.soluciones-suite')
    await expect(suites.first()).toBeVisible({ timeout: 30_000 })
    const text = await suites.allInnerTexts()
    expect(text.join(' ')).toContain('CRM')
    expect(text.join(' ')).toContain('POS')
    expect(text.join(' ')).toContain('ERP')
    // Derivado del preset del sector: si alguna parte dijera 0 módulos, la
    // página estaría prometiendo algo que el asistente no enciende.
    for (const block of text) expect(block).toMatch(/\d+ módulos?/)
  })
})
