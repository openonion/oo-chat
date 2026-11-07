import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    // *.contract.test.ts files are type-level assertions checked by `tsc` during
    // `npm run build` — they have no runtime suite, so vitest must not collect them.
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['**/*.contract.test.ts', '**/node_modules/**', '.next/**'],
  },
})
