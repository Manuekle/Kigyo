import { defineConfig } from '@playwright/test'

/**
 * E2E for the multi-company flow.
 *
 * Run against the local stack: `npm run test:e2e`. The web server is started
 * by Playwright (or reused if one is already listening), and the Supabase
 * instance it talks to is the one in `.env.local` — the same one the demo
 * account belongs to.
 *
 * The specs are skipped, not failed, when the credentials they need are
 * missing, so `npx playwright test` on a fresh checkout stays green while
 * clearly saying what a fixture must provide.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  // Todos los specs comparten el usuario demo, la empresa activa y la base
  // demo (seeds y teardowns por psql): correrlos en paralelo hace que el
  // teardown de uno reviente el fixture de otro. Secuencial, siempre.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
