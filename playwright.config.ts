import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type PlaywrightTestConfig } from '@playwright/test'
import { CLAVE_E2E } from './tests/e2e/clave'

// Tests de punta a punta y de layout (D-30, docs/calidad.md §4). Dos proyectos,
// cada uno con su servidor:
//
// - "demo": layout e interacción con datos de ejemplo (PORTFOLIO_DEMO=1:
//   números inventados, sin base ni clave). Puerto E2E_PORT (3100).
// - "auth": la clave simple como en producción (tests/e2e/auth.spec.ts): sin
//   modo demo, con APP_PASSWORD de prueba (tests/e2e/clave.ts) y sin base ni
//   ninguna otra clave. Puerto E2E_AUTH_PORT (3110).
//
// Por defecto levanta (o reusa) `next dev`; el de "auth" usa su propia carpeta
// (.next-auth) para no chocar con el otro. Con E2E_PROD=1 arma el build de
// producción una vez y lo sirven los dos con `next start` (los servidores se
// levantan en orden: primero el build). Para E2E_PROD=1, que no haya nada
// corriendo en esos puertos: si reusa uno, el build no se arma.
// Las capturas para la revisión visual van a CAPTURAS_DIR (si no, a una
// carpeta ignorada por git).
//
//   npx playwright test                    # los dos proyectos
//   E2E_SOLO=auth npx playwright test      # uno solo, y solo su servidor

const PUERTO = Number(process.env.E2E_PORT ?? 3100)
const PUERTO_AUTH = Number(process.env.E2E_AUTH_PORT ?? 3110)
const PROD = process.env.E2E_PROD === '1'
const SOLO = process.env.E2E_SOLO // 'demo' | 'auth'

// En este entorno el Chromium de Playwright viene preinstalado en otra versión:
// si existe, se usa ese ejecutable; en CI, el que instala `npx playwright install`.
const CHROMIUM_LOCAL = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)

// Cada corrida en su propia carpeta de salida: varias corridas a la vez en el
// mismo árbol (varias personas) se borraban las trazas entre sí y daban rojos
// falsos (ENOENT … .playwright-artifacts-…). Los workers heredan la variable.
process.env.PW_OUTPUT_DIR ??= path.join('node_modules', '.cache', 'playwright-e2e', `corrida-${Date.now()}`)

const entorno = process.env as Record<string, string>
type Servidor = Exclude<NonNullable<PlaywrightTestConfig['webServer']>, unknown[]> & { proyecto: 'demo' | 'auth' }

/** El servidor de "auth": como producción, sin nada que no sea la clave de prueba. */
function entornoAuth(): Record<string, string> {
  const e: Record<string, string> = {}
  const fuera = /^(PORTFOLIO_DEMO|SUPABASE_.*|SESSION_SECRET|ANTHROPIC_API_KEY|VERCEL_ENV|VERCEL_TARGET_ENV)$/
  for (const [k, v] of Object.entries(entorno)) if (!fuera.test(k) && v !== undefined) e[k] = v
  e.APP_PASSWORD = CLAVE_E2E
  // En desarrollo, su propia carpeta de salida (dos `next dev` no comparten una).
  if (!PROD) e.NEXT_DIST_DIR = '.next-auth'
  return e
}

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: process.env.PW_OUTPUT_DIR,
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
  projects: [
    { name: 'demo', testIgnore: /auth\.spec\.ts$/ },
    { name: 'auth', testMatch: /auth\.spec\.ts$/, use: { baseURL: `http://localhost:${PUERTO_AUTH}` } },
  ].filter((p) => !SOLO || p.name === SOLO),
  webServer: (
    [
      {
        proyecto: 'demo',
        command: PROD ? `npx next build && npx next start -p ${PUERTO}` : `npx next dev -p ${PUERTO}`,
        url: `http://localhost:${PUERTO}/ajustes`,
        reuseExistingServer: true,
        timeout: PROD ? 600_000 : 180_000,
        env: { ...entorno, PORTFOLIO_DEMO: '1' },
        stdout: 'ignore',
        stderr: 'pipe',
      },
      {
        proyecto: 'auth',
        // Con E2E_SOLO=auth no hay build previo: lo arma este.
        command: PROD ? `${SOLO === 'auth' ? 'npx next build && ' : ''}npx next start -p ${PUERTO_AUTH}` : `npx next dev -p ${PUERTO_AUTH}`,
        url: `http://localhost:${PUERTO_AUTH}/login`,
        reuseExistingServer: true,
        timeout: PROD ? 600_000 : 180_000,
        env: entornoAuth(),
        stdout: 'ignore',
        stderr: 'pipe',
      },
    ] satisfies Servidor[]
  )
    .filter((w) => !SOLO || w.proyecto === SOLO)
    .map(({ proyecto: _, ...w }) => w),
})
