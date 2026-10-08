import { expect, test, type Browser, type Page } from '@playwright/test'
import path from 'node:path'
import { carpetaCapturas, esperarHidratacion, revisarAxe, revisarLayout, sinIndicadorDev } from './ayudas'

// Test de layout (D-30, docs/calidad.md §4): cada pantalla, en cada ancho, en
// claro y en oscuro. Falla si hay scroll horizontal, algo fuera de la
// pantalla, texto cortado o controles superpuestos, o (con puntero grueso) un
// tocable de menos de 44 px; y si axe-core encuentra violaciones serias.
// Todas las pantallas frenan el test, también Cargar y Datos.
//
// El puntero grueso no es solo el teléfono: una tablet, o el teléfono
// acostado, pasa los 768 px con el dedo (D-100). Por eso 768 y 1024 px se
// recorren también con puntero táctil.

interface Pantalla {
  ruta: string
  nombre: string
}

const PANTALLAS: Pantalla[] = [
  { ruta: '/', nombre: 'hoy' },
  { ruta: '/?demo=vacio', nombre: 'hoy-dia-cero' },
  { ruta: '/?demo=express', nombre: 'hoy-carga-express' },
  { ruta: '/?demo=viejo', nombre: 'hoy-datos-viejos' },
  { ruta: '/cartera', nombre: 'cartera' },
  { ruta: '/cartera?demo=viejo', nombre: 'cartera-precios-viejos' },
  { ruta: '/exposicion', nombre: 'exposicion' },
  { ruta: '/exposicion?vista=total', nombre: 'exposicion-total' },
  { ruta: '/registro', nombre: 'registro' },
  { ruta: '/ajustes', nombre: 'ajustes' },
  { ruta: '/carga', nombre: 'carga' },
  { ruta: '/datos/catalogo', nombre: 'datos-catalogo' },
  { ruta: '/datos/cuentas', nombre: 'datos-cuentas' },
  { ruta: '/datos/bienes', nombre: 'datos-bienes' },
  { ruta: '/datos/leasing', nombre: 'datos-leasing' },
  { ruta: '/datos/movimientos', nombre: 'datos-movimientos' },
]

const ANCHOS = [360, 390, 412, 768, 1024, 1279, 1280, 1600, 2560]
const TEMAS = ['light', 'dark'] as const
// axe y capturas en los anchos de revisión (teléfono y desktop), en los dos temas.
const CON_AXE = new Set([390, 1280])
const CON_CAPTURA = new Set([390, 1280])

function alto(ancho: number): number {
  if (ancho === 390) return 664 // iPhone 13 con las barras de Safari (visión §4.1)
  if (ancho < 768) return 740
  return 900
}

async function abrir(page: Page, p: Pantalla): Promise<{ status: number; hidrato: boolean }> {
  const r = await page.goto(p.ruta, { waitUntil: 'load' })
  const status = r?.status() ?? 0
  if (status >= 400) return { status, hidrato: false }
  const hidrato = await esperarHidratacion(page)
  await sinIndicadorDev(page)
  return { status, hidrato }
}

/** Recorre todas las pantallas en un ancho y devuelve los problemas, con la ruta adelante. */
async function recorrer(browser: Browser, ancho: number, tema: 'light' | 'dark', grueso: boolean): Promise<string[]> {
  const ctx = await browser.newContext({
    viewport: { width: ancho, height: alto(ancho) },
    colorScheme: tema,
    isMobile: grueso,
    hasTouch: grueso,
    deviceScaleFactor: 1,
  })
  const page = await ctx.newPage()
  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(`error de JavaScript: ${e.message}`))
  const problemas: string[] = []
  // axe y capturas en los anchos de revisión, con el puntero de cada uno.
  const revision = CON_AXE.has(ancho) && grueso === ancho < 768

  for (const p of PANTALLAS) {
    errores.length = 0
    const { status, hidrato } = await abrir(page, p)
    if (status === 404 || status >= 500) {
      problemas.push(`${p.ruta} respondió ${status}`)
      continue
    }
    // En desarrollo, un cambio de otro archivo puede recargar la página a
    // mitad de la revisión: se reintenta una vez.
    const revisar = async () => {
      const r: string[] = []
      if (!hidrato) r.push('no hidrató (¿error de JavaScript?)')
      r.push(...errores)
      r.push(...(await revisarLayout(page, grueso)))
      if (revision) r.push(...(await revisarAxe(page)))
      return r
    }
    let encontrados: string[]
    try {
      encontrados = await revisar()
    } catch {
      await page.waitForLoadState('load')
      await esperarHidratacion(page)
      await sinIndicadorDev(page)
      encontrados = await revisar()
    }
    if (revision && CON_CAPTURA.has(ancho)) {
      // Página entera agrandando el viewport: la captura fullPage de Chromium
      // apaga la emulación táctil mientras captura, y el teléfono saldría
      // con el layout de mouse.
      const alto0 = alto(ancho)
      const total = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.setViewportSize({ width: ancho, height: Math.max(alto0, total) })
      await page.waitForTimeout(150)
      await page.screenshot({ path: path.join(carpetaCapturas(), `${p.nombre}-${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}.png`) })
      await page.setViewportSize({ width: ancho, height: alto0 })
    }
    problemas.push(...encontrados.map((e) => `${p.ruta} · ${e}`))
  }
  await ctx.close()
  return problemas
}

for (const ancho of ANCHOS) {
  for (const tema of TEMAS) {
    test(`layout · ${ancho} px · ${tema === 'light' ? 'claro' : 'oscuro'}`, async ({ browser }) => {
      const problemas = await recorrer(browser, ancho, tema, ancho < 768)
      expect(problemas, `Problemas de layout a ${ancho} px (${tema}):\n${problemas.join('\n')}`).toEqual([])
    })
  }
}

// Tablet o teléfono acostado: más de 768 px con el dedo (D-100).
for (const ancho of [768, 1024]) {
  test(`layout · ${ancho} px · táctil`, async ({ browser }) => {
    const problemas = await recorrer(browser, ancho, 'light', true)
    expect(problemas, `Problemas de layout a ${ancho} px con puntero táctil:\n${problemas.join('\n')}`).toEqual([])
  })
}

// Lo que el recorrido de arriba no abre: el estado de cada fuente (el chip de
// la barra superior) en el teléfono. Con el panel abierto, la misma revisión
// de D-30, y cada fuente con su nombre a la vista.
for (const ancho of [360, 390, 412]) {
  test(`chip de datos abierto · ${ancho} px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: ancho, height: alto(ancho) }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    const problemas: string[] = []
    for (const ruta of ['/', '/?demo=viejo', '/cartera']) {
      await page.goto(ruta, { waitUntil: 'load' })
      expect(await esperarHidratacion(page), ruta).toBe(true)
      await sinIndicadorDev(page)
      await page.getByRole('button', { name: /Ver el estado de cada fuente/ }).tap()
      const panel = page.getByRole('dialog', { name: 'Estado de las fuentes' })
      await expect(panel).toBeVisible()
      for (const fuente of ['IEB', 'Galicia', 'Mercado Pago', 'CCL', 'Cripto']) await expect(panel).toContainText(fuente)
      problemas.push(...(await revisarLayout(page, true)).map((e) => `${ruta} · ${e}`))
    }
    await ctx.close()
    expect(problemas, `Con el chip abierto a ${ancho} px:\n${problemas.join('\n')}`).toEqual([])
  })
}
