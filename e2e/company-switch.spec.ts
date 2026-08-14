import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * Company switching (fase 2 of the audit) is the one flow that cannot be
 * trusted from unit tests: it is a cookie, a server round trip, a revalidate
 * and a redirect working together, and each of those can be right while the
 * composition is wrong.
 *
 * Fixture: an account with TWO companies and one user in both. The demo
 * account in `.env.local` has one company, so the spec reads the same
 * variables the seed script uses and skips with instructions when the fixture
 * is not a two-company account — the check itself is part of the test, so a
 * wrong fixture fails loudly instead of passing on one company.
 */

// .env.local is not loaded into Playwright's process; read the two variables
// the way `node --env-file` would, without pulling in dotenv as a dependency.
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

test.describe('cambio de empresa', () => {
  test.skip(
    !email || !password,
    'Falta el fixture: define E2E_USER_EMAIL/E2E_USER_PASSWORD (o DEMO_ACCOUNT_* en .env.local) con un usuario miembro de DOS empresas.',
  )

  test('alterna entre empresas y el contexto cambia por completo', async ({ page }) => {
    await signIn(page, email!, password!)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard(\/|$)/)

    // The switcher is always rendered for an account governor, and the menu
    // must offer a real choice — one entry is not a choice and means the
    // fixture is wrong.
    await page.locator('.cswitch-trigger').click()
    const options = page.locator('[role=menuitemradio]')
    await expect(options.first()).toBeVisible()
    expect(await options.count()).toBeGreaterThanOrEqual(2)

    const states = await options.evaluateAll((els) =>
      els.map((el) => ({
        name: el.querySelector('.cswitch-item-name')?.textContent ?? '',
        on: el.getAttribute('aria-checked') === 'true',
      })),
    )
    expect(states.length).toBeGreaterThanOrEqual(2)
    const activeName = states.find((s) => s.on)?.name ?? ''
    const other = page.locator('[role=menuitemradio]:not([aria-checked="true"])').first()
    const otherName = states.find((s) => !s.on)?.name ?? ''
    expect(otherName).not.toBe(activeName)

    await other.click()

    // Switching lands on the dashboard, deliberately: the module being viewed
    // may not exist in the other company (see CompanySwitcher).
    await expect(page).toHaveURL(/\/dashboard(\/|$)/)
    await page.locator('.cswitch-trigger').click()
    const activeAfter = await page
      .locator('[role=menuitemradio][aria-checked="true"] .cswitch-item-name')
      .textContent()
    expect(activeAfter).toBe(otherName)
  })
})

async function signIn(page: Page, user: string, pass: string): Promise<void> {
  await page.goto('/login')
  await page.locator('#login-email').fill(user)
  await page.locator('#login-password').fill(pass)
  await page.locator('form.auth-form-shell button[type=submit]').click()
  // Landing anywhere authenticated proves the session; the dashboard layout
  // also redirects to /onboarding for unfinished accounts, which is still a
  // signed-in destination and fine for this spec.
  await expect(page).not.toHaveURL(/\/login(\/|$)/)
}
