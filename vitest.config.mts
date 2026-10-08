import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    // server-only lanza fuera de un Server Component: en los tests se ignora.
    alias: { 'server-only': path.resolve(import.meta.dirname, 'tests/unit/server-only-vacio.ts') },
  },
})
