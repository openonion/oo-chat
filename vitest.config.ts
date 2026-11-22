import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The same `@/…` root alias as tsconfig.json, so a component test can import a
  // component that imports the store (chat-input → @/store/chat-store).
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    // *.contract.test.ts files are type-level assertions checked by `tsc` during
    // `npm run build` — they have no runtime suite, so vitest must not collect them.
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['**/*.contract.test.ts', '**/node_modules/**', '.next/**'],
  },
})
