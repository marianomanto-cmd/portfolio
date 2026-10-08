import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

export const CAPTURAS = process.env.CAPTURAS_DIR ?? path.join('node_modules', '.cache', 'playwright-e2e', 'capturas')

export function carpetaCapturas(): string {
  mkdirSync(CAPTURAS, { recursive: true })
  return CAPTURAS
}

/** Espera a que la página hidrate (el shell marca <html data-hidratado>) y a las fuentes. */
export async function esperarHidratacion(page: Page, timeout = 45_000): Promise<boolean> {
  try {
    await page.waitForFunction(() => document.documentElement.getAttribute('data-hidratado') === '1', null, { timeout })
    // La página hidrata en su propio Suspense (loading.tsx), a veces después del
    // shell: se espera a que no quede nada por bajar y a que asiente.
    await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined)
    await page.evaluate(() => document.fonts.ready.then(() => true))
    await page.waitForTimeout(250)
    return true
  } catch {
    return false
  }
}

/** Oculta el indicador de desarrollo de Next, que no es parte de la app. */
export async function sinIndicadorDev(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => undefined)
}

/**
 * Los controles de D-30 en el navegador: scroll horizontal, elementos fuera de
 * la pantalla o fuera de su tarjeta, texto cortado en controles, controles
 * superpuestos y, con puntero grueso, tocables de menos de 44 px. Devuelve una
 * línea por problema.
 */
export async function revisarLayout(page: Page, grueso: boolean): Promise<string[]> {
  return page.evaluate((grueso) => {
    const out: string[] = []
    const de = document.documentElement
    const vw = de.clientWidth
    if (de.scrollWidth > vw + 1) out.push(`scroll horizontal del documento: ${de.scrollWidth} > ${vw}`)
    if (document.body.scrollWidth > vw + 1) out.push(`el body es más ancho que la pantalla: ${document.body.scrollWidth} > ${vw}`)

    const ignorar = (el: Element) => {
      if (el.closest('nextjs-portal, .sr-only, dialog:not([open])')) return true
      // Lo de adentro de un <details> cerrado no se ve (el resumen sí).
      const d = el.closest('details:not([open])')
      return Boolean(d && !el.closest('summary'))
    }
    const visible = (el: Element) => {
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return false
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const desc = (el: Element) => {
      const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48)
      const cls = (el.getAttribute('class') || '').split(' ').slice(0, 3).join('.')
      return `<${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}> "${t}"`
    }
    const enFijo = (el: Element) => {
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const p = getComputedStyle(a).position
        if (p === 'fixed' || p === 'sticky') return a
      }
      return null
    }

    // Fuera de la pantalla, o scroll horizontal dentro de un contenedor.
    const reportados: Element[] = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (ignorar(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (reportados.some((p) => p.contains(el))) continue
      const cs = getComputedStyle(el)
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) {
        out.push(`scroll horizontal interno (${el.scrollWidth} > ${el.clientWidth}): ${desc(el)}`)
        reportados.push(el)
        continue
      }
      if (r.right > vw + 1 || r.left < -1) {
        if (!visible(el)) continue
        // Si un ancestro lo recorta, no se ve afuera (pero ese ancestro tiene que entrar).
        let recortado = false
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const ca = getComputedStyle(a)
          if (ca.overflowX !== 'visible') {
            const ra = a.getBoundingClientRect()
            if (ra.right <= vw + 1 && ra.left >= -1) recortado = true
            break
          }
        }
        if (recortado) continue
        out.push(`fuera de la pantalla (${Math.round(r.left)} a ${Math.round(r.right)}, ancho ${vw}): ${desc(el)}`)
        reportados.push(el)
      }
    }

    // Fuera de su tarjeta: nada visible pasa el borde del contenedor con borde
    // más cercano (D-30 también vale adentro de la pantalla: un monto que pisa
    // el borde de su tarjeta está cortado aunque entre en la pantalla). Un
    // panel flotante (absolute o fixed) o algo que un ancestro recorta no cuenta.
    const fueraDeTarjeta: Element[] = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (fueraDeTarjeta.some((p) => p.contains(el)) || ignorar(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const pe = getComputedStyle(el).position
      if (pe === 'absolute' || pe === 'fixed') continue
      let caja: Element | null = null
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ca = getComputedStyle(a)
        if (parseFloat(ca.borderLeftWidth) > 0 && parseFloat(ca.borderRightWidth) > 0) {
          caja = a
          break
        }
        if (ca.overflowX !== 'visible' || ca.position === 'absolute' || ca.position === 'fixed') break
      }
      if (!caja) continue
      const rc = caja.getBoundingClientRect()
      const cc = getComputedStyle(caja)
      const izq = rc.left + parseFloat(cc.borderLeftWidth)
      const der = rc.right - parseFloat(cc.borderRightWidth)
      const exceso = Math.max(r.right - der, izq - r.left)
      if (exceso > 1 && visible(el)) {
        out.push(`se sale ${Math.round(exceso * 10) / 10} px de su tarjeta: ${desc(el)} en ${desc(caja)}`)
        fueraDeTarjeta.push(el)
      }
    }

    const SEL = 'a[href], button, label, summary, select, input:not([type=hidden]), textarea, [role=button], [role=radio], [role=switch], [role=tab], [role=link], [role=checkbox]'
    const controles = Array.from(document.querySelectorAll(SEL)).filter((el) => !ignorar(el) && visible(el))

    // Texto cortado dentro de un control.
    for (const el of controles) {
      for (const d of [el, ...Array.from(el.querySelectorAll('*'))]) {
        if (!visible(d)) continue
        const cs = getComputedStyle(d)
        const recorta = cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis'
        if (recorta && d.scrollWidth > d.clientWidth + 1) {
          out.push(`texto cortado (${d.scrollWidth} > ${d.clientWidth}): ${desc(d)}`)
          break
        }
      }
    }

    // Controles superpuestos (uno fijo y otro que scrollea no cuenta: el contenido pasa por debajo de las barras).
    const cajas = controles.map((el) => ({ el, r: el.getBoundingClientRect(), fijo: enFijo(el) }))
    for (let i = 0; i < cajas.length; i++) {
      for (let j = i + 1; j < cajas.length; j++) {
        const a = cajas[i]
        const b = cajas[j]
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue
        if (Boolean(a.fijo) !== Boolean(b.fijo)) continue
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
        if (w > 1 && h > 1) out.push(`se superponen ${Math.round(w)}×${Math.round(h)} px: ${desc(a.el)} y ${desc(b.el)}`)
      }
    }

    // Tocables de 44 px con puntero grueso (D-30, D-100).
    if (grueso) {
      for (const { el, r } of cajas) {
        // Un <label> de un campo que se ve no es el objetivo: el campo sí (y se revisa aparte).
        if (el instanceof HTMLLabelElement && el.control && !el.contains(el.control) && visible(el.control)) continue
        if (r.height < 43.5) out.push(`tocable de ${Math.round(r.height * 10) / 10} px de alto (< 44): ${desc(el)}`)
      }
    }
    return out
  }, grueso)
}

/** axe-core: solo las violaciones serias o críticas (calidad.md §4). */
export async function revisarAxe(page: Page): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('nextjs-portal').analyze()
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `axe ${v.impact} · ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
}

/**
 * Modo privado: los montos que se leen en la pantalla (texto visible con "$ " y
 * un dígito) sin un desenfoque en el camino. Abre antes todos los <details>.
 * Devuelve cada uno con su contexto; vacío si el modo privado tapa todo.
 */
export async function montosALaVista(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    for (const d of Array.from(document.querySelectorAll('details'))) d.open = true
    const out: string[] = []
    const caminante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = caminante.nextNode(); n; n = caminante.nextNode()) {
      const t = (n.textContent ?? '').replace(/\s+/g, ' ')
      if (!/\$\s?[−+-]?\d/.test(t)) continue
      const el = n.parentElement
      if (!el || el.closest('script, style, title, nextjs-portal, .sr-only, dialog:not([open])')) continue
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      let tapado = false
      for (let a: Element | null = el; a; a = a.parentElement) {
        if (getComputedStyle(a).filter.includes('blur')) {
          tapado = true
          break
        }
      }
      if (!tapado) out.push(`"${t.trim().slice(0, 60)}" en <${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(' ').slice(0, 3).join('.')}>`)
    }
    return out
  })
}
