import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

// Tests de punta a punta y de layout (D-30, docs/calidad.md §4).
//
// Por defecto levanta (o reusa) `next dev` en el puerto 3100 con datos de
// ejemplo (PORTFOLIO_DEMO=1: números inventados, sin base ni clave).
// Con E2E_PROD=1 arma el build de producción y lo sirve con `next start`.
// Las capturas para la revisión visual van a CAPTURAS_DIR (si no, a una
// carpeta ignorada por git).

const PUERTO = Number(process.env.E2E_PORT ?? 3100)
const PROD = process.env.E2E_PROD === '1'

// En este entorno el Chromium de Playwright viene preinstalado en otra versión:
// si existe, se usa ese ejecutable; en CI, el que instala `npx playwright install`.
const CHROMIUM_LOCAL = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: process.env.PW_OUTPUT_DIR ?? path.join('node_modules', '.cache', 'playwright-e2e'),
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS ?? 2),
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    browserName: 'chromium',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Cordoba',
    launchOptions: CHROMIUM_LOCAL ? { executablePath: CHROMIUM_LOCAL } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: PROD ? `npx next build && npx next start -p ${PUERTO}` : `npx next dev -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}/ajustes`,
    reuseExistingServer: true,
    timeout: PROD ? 600_000 : 180_000,
    env: { ...(process.env as Record<string, string>), PORTFOLIO_DEMO: '1' },
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
