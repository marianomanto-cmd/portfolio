// Clave inventada para el proyecto "auth" de Playwright: el servidor de esa
// corrida arranca con APP_PASSWORD igual a esto (playwright.config.ts).
export const CLAVE_E2E = process.env.E2E_APP_PASSWORD ?? 'clave-e2e-inventada'
