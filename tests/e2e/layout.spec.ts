import { expect, test, type Browser, type Page } from '@playwright/test'
import path from 'node:path'
import { carpetaCapturas, esperarHidratacion, revisarAxe, revisarGrillas, revisarLayout, sinIndicadorDev } from './ayudas'
import { pantallas, type Pantalla } from './pantallas'

// Test de layout (D-30, docs/calidad.md §4): cada pantalla, en cada ancho, en
// claro y en oscuro. Falla si hay scroll horizontal, algo fuera de la
// pantalla, texto cortado o controles superpuestos, o (con puntero grueso) un
// tocable de menos de 44 px; si una grilla (AG Grid, D-157) tiene scroll
// horizontal adentro; y si axe-core encuentra violaciones serias.
// El tema se elige como lo elige el dueño (Ajustes, en localStorage): el
// oscuro es el de siempre y no depende del sistema (D-157).
// Todas las pantallas frenan el test, también Cargar y Datos. La lista está en
// tests/e2e/pantallas/ (un archivo por pantalla nueva; E2E_PANTALLAS elige grupos).
//
// El puntero grueso no es solo el teléfono: una tablet, o el teléfono
// acostado, pasa los 768 px con el dedo (D-100). Por eso 768 y 1024 px se
// recorren también con puntero táctil.
//
// La barra lateral tampoco es siempre la misma: entre 768 y 1279 px arranca
// colapsada (68 px), pero abierta a mano (su botón o Ajustes) queda guardada y
// vale en todos los anchos, y mide 232. Por eso 768 y 1024 px se recorren
// también con la barra abierta, con capturas para revisarlas (D-167).

const PANTALLAS: Pantalla[] = pantallas()

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
  if (status >= 400 && status !== p.estado) return { status, hidrato: false }
  const hidrato = await esperarHidratacion(page)
  await sinIndicadorDev(page)
  return { status, hidrato }
}

/** Recorre todas las pantallas en un ancho y devuelve los problemas, con la ruta adelante. */
async function recorrer(browser: Browser, ancho: number, tema: 'light' | 'dark', grueso: boolean, barraAbierta = false): Promise<string[]> {
  const ctx = await browser.newContext({
    viewport: { width: ancho, height: alto(ancho) },
    colorScheme: tema,
    isMobile: grueso,
    hasTouch: grueso,
    deviceScaleFactor: 1,
  })
  await ctx.addInitScript(
    ({ t, barra }) => {
      try {
        window.localStorage.setItem('portfolio:tema', t)
        // Como queda al abrirla con su botón o en Ajustes › Barra lateral.
        if (barra) window.localStorage.setItem('portfolio:nav', 'expandida')
      } catch {
        // Sin almacenamiento, el tema por defecto (oscuro) y la barra en automático.
      }
    },
    { t: tema === 'light' ? 'claro' : 'oscuro', barra: barraAbierta },
  )
  const page = await ctx.newPage()
  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(`error de JavaScript: ${e.message}`))
  const problemas: string[] = []
  // axe y capturas en los anchos de revisión, con el puntero de cada uno.
  const revision = CON_AXE.has(ancho) && grueso === ancho < 768
  // Con la barra abierta, una captura de cada pantalla: el contenido más angosto del escritorio, donde las grillas pueden pasar a tarjetas.
  const captura = (revision && CON_CAPTURA.has(ancho)) || barraAbierta

  for (const p of PANTALLAS) {
    errores.length = 0
    const { status, hidrato } = await abrir(page, p)
    if (p.estado ? status !== p.estado : status === 404 || status >= 500) {
      problemas.push(`${p.ruta} respondió ${status}${p.estado ? ` y tenía que responder ${p.estado}` : ''}`)
      continue
    }
    // En desarrollo, un cambio de otro archivo puede recargar la página a
    // mitad de la revisión: se reintenta una vez.
    const revisar = async () => {
      const r: string[] = []
      if (!hidrato) r.push('no hidrató (¿error de JavaScript?)')
      r.push(...errores)
      if (barraAbierta) {
        // Que se esté probando lo que dice el nombre del test: la barra abierta, de 232 px.
        const nav = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--nav-w').trim())
        if (nav !== '232px') r.push(`la barra lateral no está abierta (--nav-w: ${nav || 'sin valor'})`)
      }
      r.push(...(await revisarLayout(page, grueso)))
      r.push(...(await revisarGrillas(page)))
      // Un h1 por pantalla (aunque sea solo para el lector de pantalla).
      const h1 = await page.locator('h1').count()
      if (h1 !== 1) r.push(`tiene ${h1} h1 y tiene que tener uno`)
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
    if (captura) {
      // Página entera agrandando el viewport: la captura fullPage de Chromium
      // apaga la emulación táctil mientras captura, y el teléfono saldría
      // con el layout de mouse.
      const alto0 = alto(ancho)
      const total = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.setViewportSize({ width: ancho, height: Math.max(alto0, total) })
      await page.waitForTimeout(150)
      await page.screenshot({ path: path.join(carpetaCapturas(), `${p.nombre}-${ancho}${barraAbierta ? '-barra-abierta' : ''}-${tema === 'light' ? 'claro' : 'oscuro'}.png`) })
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
      // Cada ancho recorre todas las pantallas y sus estados (con las cuatro de la entrega 4, ~5 min con la
      // máquina tranquila): el doble del timeout general, para que la carga de la máquina no lo corte a la mitad.
      test.setTimeout(600_000)
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

// La barra lateral abierta a mano entre 768 y 1279 px: al contenido le quedan
// 164 px menos (a 768 px, unos 480). En el tema de la app (el oscuro).
for (const ancho of [768, 1024]) {
  test(`layout · ${ancho} px · barra abierta`, async ({ browser }) => {
    // Recorre todas las pantallas y captura cada una: el mismo margen que los anchos de arriba.
    test.setTimeout(600_000)
    const problemas = await recorrer(browser, ancho, 'dark', false, true)
    expect(problemas, `Problemas de layout a ${ancho} px con la barra lateral abierta:\n${problemas.join('\n')}`).toEqual([])
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
