import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import { carpetaCapturas, esperarHidratacion, revisarAxe, revisarLayout, sinIndicadorDev } from './ayudas'

// Test de layout (D-30, docs/calidad.md §4): cada pantalla, en cada ancho, en
// claro y en oscuro. Falla si hay scroll horizontal, algo fuera de la
// pantalla, texto cortado o controles superpuestos, o (con puntero grueso) un
// tocable de menos de 44 px; y si axe-core encuentra violaciones serias.
//
// Las pantallas de otras personas (/carga, /datos) se revisan igual, pero sus
// problemas se informan como anotaciones y no frenan este test: si responden
// 404 o 500, se saltean con su motivo.

interface Pantalla {
  ruta: string
  nombre: string
  ajena?: boolean
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
  { ruta: '/carga', nombre: 'carga', ajena: true },
  { ruta: '/datos', nombre: 'datos', ajena: true },
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

for (const ancho of ANCHOS) {
  for (const tema of TEMAS) {
    test(`layout · ${ancho} px · ${tema === 'light' ? 'claro' : 'oscuro'}`, async ({ browser }, info) => {
      const grueso = ancho < 768
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

      for (const p of PANTALLAS) {
        errores.length = 0
        const { status, hidrato } = await abrir(page, p)
        if (status === 404 || status >= 500) {
          const msg = `${p.ruta} respondió ${status}`
          if (p.ajena) {
            info.annotations.push({ type: 'salteada (pantalla de otra persona)', description: msg })
            console.log(`[ajena ${ancho}px ${tema}] salteada: ${msg}`)
            continue
          }
          problemas.push(msg)
          continue
        }
        // En desarrollo, un cambio de otro archivo puede recargar la página a
        // mitad de la revisión: se reintenta una vez.
        const revisar = async () => {
          const r: string[] = []
          if (!hidrato) r.push('no hidrató (¿error de JavaScript?)')
          r.push(...errores)
          r.push(...(await revisarLayout(page, grueso)))
          if (CON_AXE.has(ancho)) r.push(...(await revisarAxe(page)))
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
        if (CON_CAPTURA.has(ancho)) {
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
        const conContexto = encontrados.map((e) => `${p.ruta} · ${e}`)
        if (p.ajena) {
          for (const e of conContexto) {
            info.annotations.push({ type: 'problema en pantalla de otra persona', description: e })
            console.log(`[ajena ${ancho}px ${tema}] ${e}`)
          }
        } else {
          problemas.push(...conContexto)
        }
      }
      await ctx.close()
      expect(problemas, `Problemas de layout a ${ancho} px (${tema}):\n${problemas.join('\n')}`).toEqual([])
    })
  }
}
