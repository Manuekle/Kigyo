import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * Embudo comercial — red de seguridad antes de tocar el modelo.
 *
 *   cliente (ficha real) → cotización → Aceptada → pedido desde cotización
 *
 * Existe porque el embudo se va a reparar: hoy `quotes.client` es `text` y
 * `create_order_from_quote` inserta `sales_orders.client_id = null`, así que
 * la cadena que la interfaz muestra no es una relación. Antes de cambiar eso
 * hace falta una prueba que diga qué funciona *ahora*, o el arreglo y una
 * regresión se ven igual.
 *
 * Lo que este spec fija:
 *   · una cotización se crea enlazada a una ficha real, se acepta y genera
 *     exactamente un pedido;
 *   · el pedido hereda **la ficha**, no solo el nombre — que es lo que la
 *     migración 98 vino a arreglar y lo que se rompería sin darse cuenta;
 *   · el nombre pactado viaja aparte y se conserva;
 *   · una cotización que ya tiene pedido no puede generar otro (KG105).
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

// IPS Bogota ya trae `clientes`; `cotizaciones` y `pedidos` se activan para el
// smoke y se retiran en teardown, igual que dian.spec.ts hace con integraciones.
const ORG_NAME = 'IPS Bogota'
const ORG_ID = '1b82cb7c-ea6a-4b84-9388-0dceb40e5b5f'
const ADMIN_ID = 'eb711727-43fe-46a2-b8f5-f63b914191ea'
const CLIENT_NAME = 'E2E Embudo Cliente'
const QUOTE_NOTE = 'E2E embudo'

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

/** Los módulos que la prueba necesita, y que el teardown devolverá como estaban. */
const NEEDED_MODULES = ['cotizaciones', 'pedidos', 'facturacion'] as const

/**
 * Enciende los módulos que falten y devuelve **solo los que encendió**.
 *
 * La asimetría entre esta función y el teardown era un defecto real y costó una
 * corrida entenderlo: el seed añadía el módulo solo si faltaba (bien) y el
 * teardown lo quitaba siempre (mal), así que al añadir `facturacion` a esta
 * prueba, la primera corrida se lo arrancó a la empresa fixture —que ya lo
 * tenía de antes— y dejó `dian.spec.ts` en rojo, en otro archivo y sin relación
 * aparente. Un fixture que no restaura lo que encontró no es un fixture, es un
 * efecto secundario.
 */
function seed(clientId: string): string[] {
  const before = psql(`
select set_config('request.jwt.claims', '${claims}', true);
select coalesce(string_agg(m, ','), '') from unnest(
  (select enabled_modules from organizations where id = '${ORG_ID}')
) as m;
`).trim().split('\n').pop() ?? ''
  const had = new Set(before.split(',').filter(Boolean))
  const added = NEEDED_MODULES.filter((m) => !had.has(m))

  psql(`
select set_config('request.jwt.claims', '${claims}', true);
${added.map((m) => `update organizations
   set enabled_modules = enabled_modules || array['${m}']
 where id = '${ORG_ID}' and not ('${m}' = any (enabled_modules));`).join('\n')}
insert into clients (id, org_id, name, email, status)
values ('${clientId}', '${ORG_ID}', '${CLIENT_NAME}', 'e2e-embudo@example.com', 'Activo');
`)
  return added
}

function teardown(clientId: string, added: string[]): void {
  psql(`
select set_config('request.jwt.claims', '${claims}', true);
-- La factura antes que el pedido: invoices.sales_order_id es on-delete-set-null,
-- así que borrar el pedido primero no fallaría, pero dejaría la factura
-- huérfana en la base para la siguiente corrida. (Sin backticks a propósito:
-- esto vive dentro de un template literal.)
delete from invoices where org_id = '${ORG_ID}' and client_name = '${CLIENT_NAME}';
delete from sales_orders where org_id = '${ORG_ID}' and client_name = '${CLIENT_NAME}';
delete from quotes where org_id = '${ORG_ID}' and client = '${CLIENT_NAME}';
delete from clients where id = '${clientId}';
${added.map((m) => `update organizations
   set enabled_modules = array_remove(enabled_modules, '${m}')
 where id = '${ORG_ID}';`).join('\n')}
`)
}

test.describe('embudo comercial', () => {
  test.skip(
    !email || !password || !dbUrl,
    'Falta el fixture: define E2E_USER_EMAIL/E2E_USER_PASSWORD (o DEMO_ACCOUNT_* en .env.local) y SUPABASE_DB_URL.',
  )

  test('cotización → aceptada → pedido → factura, sin cobrar el IVA dos veces', async ({ page }) => {
    test.slow() // dos pantallas completas + tres escrituras encadenadas
    const clientId = randomUUID()
    const added = seed(clientId)
    try {
      await signIn(page, email!, password!)
      await page.goto('/dashboard')
      await ensureOrg(page, ORG_NAME)

      /* ── 1. Cotización ─────────────────────────────────────────────────── */
      await page.goto('/dashboard/cotizaciones')
      await page.getByRole('button', { name: /Nueva cotización/ }).click()

      // Se elige la ficha, no se escribe el nombre: el Select rellena el campo
      // «Nombre en el documento» a partir del directorio.
      await expect(page.locator('#co-client-id')).toBeVisible()
      await page.locator('#co-client-id').click()
      await page.locator('[role=option]', { hasText: CLIENT_NAME }).click()
      await expect(page.locator('input.field').first()).toHaveValue(CLIENT_NAME)

      // Una línea completa, para que la cotización tenga valor y el pedido tenga
      // qué copiar. La descripción no es decorativa: sin ella el editor
      // descartaba la línea en silencio y guardaba la cotización en $0 después
      // de haber enseñado el total en el propio cajón. La versión anterior de
      // esta prueba solo llenaba el precio y pasaba igual, porque no miraba
      // ningún importe — así fue como el defecto sobrevivió.
      await page.locator('input.field[placeholder="Descripción"]').last().fill('Servicio E2E')
      await page.locator('input.field[type=number]').last().fill('250000')
      await page.locator('textarea.field').fill(QUOTE_NOTE)
      await page.getByRole('button', { name: /Guardar|Crear/ }).last().click()

      const fila = page.locator('tbody tr', { hasText: CLIENT_NAME }).first()
      await expect(fila).toBeVisible({ timeout: 10_000 })

      /* ── 2. Aceptar ────────────────────────────────────────────────────── */
      // El estado no se cambia en la fila: se abre la ficha y el Select vive
      // en el cuerpo del Drawer. `create_order_from_quote` rechaza cualquier
      // cotización que no esté Aceptada (KG104).
      await fila.click()
      const ficha = page.locator('.dbody')
      await expect(ficha).toBeVisible()
      await ficha.locator('button.nselect-trigger').first().click()
      await page.locator('[role=option]', { hasText: 'Aceptada' }).click()
      // `changeStatus` cierra la ficha al guardar (setSelected(null)), así que
      // el estado se comprueba en la fila, no en el Select que ya no está.
      await expect(ficha).toBeHidden()
      await expect(fila.locator('.badge', { hasText: 'Aceptada' })).toBeVisible()

      /* ── 3. Pedido desde la cotización ─────────────────────────────────── */
      await page.goto('/dashboard/pedidos')
      const desdeCotizacion = page.getByRole('button', { name: /Desde cotización/ })
      await expect(desdeCotizacion).toBeEnabled()
      await desdeCotizacion.click()
      await page.getByRole('button', { name: /Crear pedido/ }).click()

      const pedido = page.locator('tbody tr', { hasText: CLIENT_NAME }).first()
      await expect(pedido).toBeVisible({ timeout: 10_000 })
      // El pedido llegó con la línea, no vacío. Sin esta aserción un pedido de
      // $0 pasaba por bueno, que es justo lo que pasaba.
      await expect(pedido).toContainText('250.000')
      await expect(pedido).toContainText('1 línea')

      /* ── 4. No dos pedidos de la misma cotización (KG105) ──────────────── */
      // La cotización ya consumida sale de la lista del drawer, así que el
      // botón queda deshabilitado por no tener candidatas.
      await expect(page.getByRole('button', { name: /Desde cotización/ })).toBeDisabled()

      /* ── 5. El enlace relacional, no solo el nombre ────────────────────── */
      // Esta es la aserción que define la migración 98. Antes de ella el RPC
      // insertaba `client_id = null` y esta línea decía `1|` — un pedido con
      // nombre y sin cliente.
      const pedidoEnBase = psql(`
select set_config('request.jwt.claims', '${claims}', true);
select count(*) || '|' || coalesce(max(client_id::text), 'SIN FICHA')
  from sales_orders
 where org_id = '${ORG_ID}' and client_name = '${CLIENT_NAME}' and deleted_at is null;
`).trim().split('\n').pop()
      expect(pedidoEnBase).toBe(`1|${clientId}`)

      // Y la cotización quedó enlazada a la misma ficha.
      const cotizacion = psql(`
select set_config('request.jwt.claims', '${claims}', true);
select coalesce(max(client_id::text), 'SIN FICHA') from quotes
 where org_id = '${ORG_ID}' and client = '${CLIENT_NAME}' and deleted_at is null;
`).trim().split('\n').pop()
      expect(cotizacion).toBe(clientId)

      /* ── 6. Facturar el pedido ─────────────────────────────────────────── */
      // El eslabón que faltaba: `invoices.sales_order_id` existe desde la
      // migración 98 y no había una sola línea en el repositorio que la leyera
      // o la escribiera, así que la cadena comercial se acababa en el pedido.
      await page.getByRole('button', { name: /Facturar/ }).first().click()
      await page.getByRole('button', { name: /Confirmar|Aceptar|Sí/ }).last().click()
      await expect(page.getByText(/Factura .* ·/).first()).toBeVisible({ timeout: 10_000 })

      // Y el botón desaparece: un pedido ya facturado no se factura otra vez.
      await expect(page.getByRole('button', { name: /Facturar/ })).toHaveCount(0)

      /* ── 7. El IVA no se cobra dos veces ───────────────────────────────── */
      // Esta es la aserción que importa de todo el paso.
      //
      // Cotizaciones y pedidos guardan `unit_price_cents` **con** el IVA dentro
      // —copian `products.price_cents`, que es el precio de góndola—; la factura
      // lo guarda **sin** IVA y suma `total = subtotal + tax`. Copiar la línea
      // sin convertir es exactamente el error del 19% que encontró la migración
      // 104, entrando por otra puerta.
      //
      // La línea de esta cotización es de 250.000 y el producto no existe en el
      // catálogo (texto libre), así que la tasa es 0 y el total tiene que ser
      // idéntico. La comprobación de verdad es que factura y pedido coinciden,
      // sea cual sea la tasa.
      const totales = psql(`
select set_config('request.jwt.claims', '${claims}', true);
select i.total_cents || '|' || o.total_cents || '|' || coalesce(i.sales_order_id::text, 'SIN PEDIDO')
  from invoices i
  join sales_orders o on o.id = i.sales_order_id
 where i.org_id = '${ORG_ID}' and i.client_name = '${CLIENT_NAME}' and i.deleted_at is null;
`).trim().split('\n').pop()
      const [facturaCents, pedidoCents, enlace] = (totales ?? '').split('|')
      expect(enlace, 'la factura no quedó enlazada al pedido').toMatch(/^[0-9a-f-]{36}$/)
      expect(facturaCents, 'la factura no cobra lo mismo que el pedido').toBe(pedidoCents)
    } finally {
      teardown(clientId, added)
    }
  })
})

/** Activa la empresa fixture si la cookie dejó otra como activa. */
async function ensureOrg(page: Page, orgName: string): Promise<void> {
  await page.locator('.cswitch-trigger').click()
  const items = page.locator('[role=menuitemradio]')
  await expect(items.first()).toBeVisible()
  const active = page.locator('[role=menuitemradio][aria-checked="true"] .cswitch-item-name')
  if ((await active.first().textContent()) === orgName) {
    await page.locator('[role=menuitemradio][aria-checked="true"]').click()
    return
  }
  const target = page.locator('[role=menuitemradio]', { hasText: orgName })
  await expect(target).toBeVisible()
  await target.click()
  await expect(page.locator('.cswitch-name')).toHaveText(orgName)
}

async function signIn(page: Page, user: string, pass: string): Promise<void> {
  await page.goto('/login')
  await page.locator('#login-email').fill(user)
  await page.locator('#login-password').fill(pass)
  await page.locator('form.auth-form-shell button[type=submit]').click()
  await expect(page).not.toHaveURL(/\/login(\/|$)/)
}
