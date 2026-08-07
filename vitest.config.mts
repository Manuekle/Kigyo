import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Playwright specs live under e2e/ and are driven by `npm run test:e2e`.
    exclude: ['node_modules/**', 'e2e/**', '.next/**', '.claude/**'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
