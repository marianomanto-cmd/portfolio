import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { esperarHidratacion } from './ayudas'
import { CLAVE_E2E } from './clave'

// Clave simple (D-21) con la app como en producción: sin modo demo, con una
// APP_PASSWORD de prueba y sin base (proyecto "auth" de playwright.config.ts).
// Cada test usa su propia IP (x-real-ip, como la informa Vercel) para que el
// freno a los intentos de uno no frene al otro.

const PAGINAS = ['/', '/cartera', '/exposicion', '/registro', '/carga', '/datos', '/datos/catalogo', '/ajustes', '/no-existe']

// Al azar: los workers de Playwright no comparten un contador.
const nuevaIp = () => `198.18.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`

async function contexto(page: Page): Promise<BrowserContext> {
  await page.context().setExtraHTTPHeaders({ 'x-real-ip': nuevaIp() })
  return page.context()
}

/** Errores de la página y violaciones de la Content-Security-Policy. */
function vigilar(page: Page): string[] {
  const problemas: string[] = []
  page.on('pageerror', (e) => problemas.push(`error de JavaScript: ${e.message}`))
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to (execute|load|apply|connect)/i.test(m.text())) problemas.push(`CSP: ${m.text()}`)
  })
  return problemas
}

async function entrar(page: Page, desde = '/', clave = CLAVE_E2E) {
  await page.goto(desde === '/' ? '/login' : `/login?desde=${encodeURIComponent(desde)}`)
  await page.getByLabel('Clave').fill(clave)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test.describe('sin sesión', () => {
  test('cada página va a la entrada y recuerda adónde ibas', async ({ request }) => {
    for (const p of PAGINAS) {
      const r = await request.get(p, { maxRedirects: 0 })
      expect(r.status(), p).toBe(307)
      expect(r.headers()['location'], p).toBe(p === '/' ? '/login' : `/login?desde=${encodeURIComponent(p)}`)
    }
    const conBusqueda = await request.get('/datos/bienes?x=1', { maxRedirects: 0 })
    expect(conBusqueda.headers()['location']).toBe('/login?desde=%2Fdatos%2Fbienes%3Fx%3D1')
  })

  test('POST /carga/leer y las Server Actions: 401 sin cookie, 403 desde otro sitio', async ({ request, baseURL }) => {
    const archivo = { name: 'captura.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }
    const leer = await request.post('/carga/leer', { multipart: { archivo } })
    expect(leer.status()).toBe(401)
    expect(await leer.json()).toEqual({ error: 'Sesión vencida: volvé a entrar.' })

    // Una Server Action viaja como POST a la página, con el encabezado Next-Action.
    const accion = await request.post('/registro', { headers: { 'Next-Action': '0'.repeat(42), Origin: baseURL! }, data: '[]' })
    expect(accion.status()).toBe(401)

    const deAfuera = await request.post('/carga/leer', { headers: { Origin: 'https://otro.example' }, multipart: { archivo } })
    expect(deAfuera.status()).toBe(403)
    const entradaDeAfuera = await request.post('/login', { headers: { Origin: 'https://otro.example', 'Next-Action': 'x' }, data: '[]' })
    expect(entradaDeAfuera.status()).toBe(403)
  })

  test('la entrada y los estáticos se sirven sin sesión, con los encabezados de seguridad', async ({ request }) => {
    const r = await request.get('/login')
    expect(r.status()).toBe(200)
    const h = r.headers()
    expect(h['content-security-policy']).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/)
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('same-origin')
    expect(h['permissions-policy']).toContain('camera=()')
    expect(h['strict-transport-security']).toMatch(/^max-age=/)
    expect(h['x-robots-tag']).toBe('noindex, nofollow')
    expect(h['x-powered-by']).toBeUndefined()
    // El nonce cambia en cada pedido.
    const otro = await request.get('/login')
    expect(otro.headers()['content-security-policy']).not.toBe(h['content-security-policy'])
  })
})

test.describe('entrar', () => {
  test('una clave equivocada muestra el error y no deja cookie', async ({ page }) => {
    const ctx = await contexto(page)
    const problemas = vigilar(page)
    await entrar(page, '/cartera', 'no-es-la-clave')
    await expect(page.locator('#error-clave')).toHaveText(/Esa no es la clave/)
    await expect(page).toHaveURL(/\/login\?desde=%2Fcartera$/)
    expect((await ctx.cookies()).find((c) => c.name === 'sesion')).toBeUndefined()
    expect(problemas).toEqual([])
  })

  test('después de tres errores seguidos, la entrada se frena', async ({ page }) => {
    await contexto(page)
    await page.goto('/login')
    const clave = page.getByLabel('Clave')
    const boton = page.getByRole('button', { name: 'Entrar' })
    for (let i = 0; i < 3; i++) {
      await clave.fill(`mala-${i}`)
      await boton.click()
      await expect(boton).toBeEnabled()
    }
    await expect(page.locator('#error-clave')).toHaveText('Esa no es la clave. Esperá 1 segundo antes de probar otra vez.')
    // Otro intento enseguida: o sigue trabado, o es el cuarto error y la traba se duplica.
    await clave.fill('mala-3')
    await boton.click()
    await expect(page.locator('#error-clave')).toHaveText(/Demasiados intentos seguidos\. Esperá 1 segundo|Esperá 2 segundos antes de probar otra vez/)
  })

  test('la clave correcta deja la cookie y vuelve a la página pedida; sin base, la app lo dice', async ({ page }) => {
    const ctx = await contexto(page)
    const problemas = vigilar(page)
    await entrar(page, '/cartera')
    await expect(page).toHaveURL(/\/cartera$/)
    const cookie = (await ctx.cookies()).find((c) => c.name === 'sesion')
    expect(cookie).toBeDefined()
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' })
    const dias = (cookie!.expires * 1000 - Date.now()) / 86_400_000
    expect(dias).toBeGreaterThan(29)
    expect(dias).toBeLessThan(31)

    // Sin SUPABASE_SECRET_KEY: la pantalla amigable, no un error ni ceros.
    for (const p of ['/', '/cartera', '/exposicion', '/registro']) {
      await page.goto(p)
      expect(await esperarHidratacion(page), `${p} hidrata (la CSP no frena los scripts de Next)`).toBe(true)
      await expect(page.getByRole('heading', { name: /Falta configurar la base: SUPABASE_SECRET_KEY en Vercel/ }), p).toBeVisible()
    }
    await expect(page.getByText('Falta configurar la base').first()).toBeVisible()
    expect(problemas).toEqual([])
  })

  test('con sesión, la entrada te devuelve adonde ibas', async ({ page }) => {
    await contexto(page)
    await entrar(page)
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/login?desde=%2Fexposicion')
    await expect(page).toHaveURL(/\/exposicion$/)
    // Un desde que apunta afuera vuelve a Hoy.
    await page.goto('/login?desde=%2F%2Fotro.example')
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  })

  test('con sesión, la página puede mandar un archivo a /carga/leer (pasa el control de origen y la CSP)', async ({ page }) => {
    await contexto(page)
    const problemas = vigilar(page)
    await entrar(page, '/carga')
    await expect(page).toHaveURL(/\/carga$/)
    expect(await esperarHidratacion(page)).toBe(true)
    // Un fetch del navegador lleva Origin y Sec-Fetch-Site: same-origin, como el de la pantalla.
    const r = await page.evaluate(async () => {
      const fd = new FormData()
      fd.append('archivo', new File(['hola'], 'nota.txt', { type: 'text/plain' }))
      const res = await fetch('/carga/leer', { method: 'POST', body: fd })
      return { status: res.status, cuerpo: (await res.json()) as { ok: boolean; error?: string } }
    })
    // Llega al lector, que no sabe leer un .txt (ni 401 ni 403).
    expect(r.status).toBe(415)
    expect(r.cuerpo).toMatchObject({ ok: false })
    expect(r.cuerpo.error).toContain('nota.txt')
    expect(problemas).toEqual([])
  })

  test('el script del tema corre con la CSP, y Salir cierra la sesión', async ({ page }) => {
    const ctx = await contexto(page)
    const problemas = vigilar(page)
    await entrar(page, '/ajustes')
    await expect(page).toHaveURL(/\/ajustes$/)
    expect(await esperarHidratacion(page)).toBe(true)
    await page.evaluate(() => localStorage.setItem('portfolio:tema', 'oscuro'))
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.getByRole('button', { name: 'Salir' }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect((await ctx.cookies()).find((c) => c.name === 'sesion')).toBeUndefined()
    await page.goto('/cartera')
    await expect(page).toHaveURL(/\/login\?desde=%2Fcartera$/)
    expect(problemas).toEqual([])
  })
})
