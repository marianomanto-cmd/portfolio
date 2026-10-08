// Hoy, renderizada como la manda el servidor (sin navegador): lo que el dueño
// ve antes de tocar nada. Con hechos inventados (los del ejemplo), sin base.
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Hechos } from '@/lib/domain/tipos'
import { armarHoy } from '@/lib/vistas/armar'
import type { VistaHoy } from '@/lib/vistas/contratos'
import { hechosEjemplo, HOY_EJEMPLO } from '@/lib/vistas/ejemplo'

let hechos: Hechos = hechosEjemplo()
let demo = false
let ajustar: (v: VistaHoy) => VistaHoy = (v) => v
vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) => h('a', { href: p.href, className: p.className }, p.children as never),
}))
vi.mock('@/lib/server/sesion', () => ({ modoDemo: () => demo }))
vi.mock('@/components/shell/datos', () => ({ hoyDelPedido: async () => ajustar(armarHoy(hechos, HOY_EJEMPLO)) }))

const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/** El HTML de la tarjeta con ese aria-label (hasta la próxima sección). */
function tarjeta(html: string, etiqueta: string): string {
  const i = html.indexOf(`aria-label="${etiqueta}"`)
  if (i < 0) return ''
  const fin = html.indexOf('<section', i + 1)
  return html.slice(i, fin < 0 ? undefined : fin)
}

async function pagina(sp: Record<string, string> = {}): Promise<string> {
  const { default: PaginaHoy } = await import('@/app/(app)/page')
  const el = (await PaginaHoy({ searchParams: Promise.resolve(sp) })) as ReactElement
  return renderToStaticMarkup(el)
}

describe('Hoy: un total al que le falta una parte (D-65)', () => {
  it('dice "sin dato", con el motivo, y debajo la suma parcial en pesos y en dólares', async () => {
    hechos = hechosEjemplo()
    hechos.valuaciones = hechos.valuaciones.filter((v) => v.bien_id !== 2) // la camioneta, dada de alta sin valuación
    const v = armarHoy(hechos, HOY_EJEMPLO)
    expect(v.total.valor.ars.valor).toBeNull()
    const html = tarjeta(await pagina(), 'Patrimonio total')
    const t = texto(html)
    expect(t).toContain('sin dato')
    expect(t).toContain('suma parcial (11 de 12): $ 392.511.540')
    expect(t).toContain('US$ 253.528')
    // El "sin dato" del total lleva su motivo.
    expect(html).toContain(`title="${v.total.valor.ars.motivo}"`)
  })

  it('con todo cargado no aparece ninguna suma parcial', async () => {
    hechos = hechosEjemplo()
    const t = texto(tarjeta(await pagina(), 'Patrimonio total'))
    expect(t).not.toContain('suma parcial')
  })
})

describe('Hoy en el teléfono: la hoja de la frase tiene cada cifra en su renglón tocable (D-113)', () => {
  it('carga express: las cifras de la segunda oración también, con su nombre', async () => {
    demo = true
    try {
      const html = await pagina({ demo: 'express' })
      const i = html.indexOf('aria-label="La frase del día, cifra por cifra"')
      expect(i).toBeGreaterThan(-1)
      const hoja = html.slice(i, html.indexOf('</dialog>', i))
      const filas = [...hoja.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) => m[1])
      const fila = (etiqueta: string) => filas.find((f) => texto(f).startsWith(etiqueta)) ?? ''
      for (const [etiqueta, cifra] of [
        ['De SPY', '−US$ 213'],
        ['De tus posiciones en pesos', '−US$ 242'],
        ['De tus pesos en efectivo', '−US$ 23'],
      ]) {
        const f = fila(etiqueta)
        expect(texto(f), etiqueta).toContain(cifra)
        // La cifra es un botón que abre su traza.
        expect(f, etiqueta).toMatch(new RegExp(`<button[^>]*aria-controls[^>]*>(?:(?!</button>).)*${cifra.replace('$', '\\$')}`))
      }
    } finally {
      demo = false
    }
  })
})

describe('Hoy · el cuadre dice por cuánto cierra o no cierra (D-66)', () => {
  const cuadre = (html: string) => {
    const i = html.indexOf('Cuadre ')
    return html.slice(html.lastIndexOf('<p', i), html.indexOf('</p>', i))
  }
  const calc = (valor: string) => ({ valor, formula: valor, insumos: [], etiquetas: [] })
  // Todo en línea: sin tags, sin espacios agregados.
  const plano = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

  it('si cierra: "cierra (diferencia $ 0,00 · US$ 0,00)", cada cifra con su traza', async () => {
    hechos = hechosEjemplo()
    ajustar = (v) => ({ ...v, cuadre: { ars_ok: true, usd_ok: true, detalle: 'Cierra en las dos monedas.', diferencia: { ars: calc('0'), usd: calc('0') } } })
    try {
      const p = cuadre(await pagina())
      expect(plano(p)).toBe('Cuadre ✓ cierra (diferencia $ 0,00 · US$ 0,00). Cierra en las dos monedas.')
      expect([...p.matchAll(/<button[^>]*aria-controls/g)]).toHaveLength(2)
    } finally {
      ajustar = (v) => v
    }
  })

  it('si no cierra: "no cierra por" el monto, con signo, en pesos y en dólares', async () => {
    hechos = hechosEjemplo()
    ajustar = (v) => ({ ...v, cuadre: { ars_ok: false, usd_ok: true, detalle: 'Revisar.', diferencia: { ars: calc('1050000'), usd: calc('0') } } })
    try {
      expect(plano(cuadre(await pagina()))).toBe('Cuadre ≠ no cierra por +$ 1.050.000,00 · US$ 0,00. Revisar.')
    } finally {
      ajustar = (v) => v
    }
  })

  it('sin diferencia (no verificable) no inventa un cero: solo el detalle', async () => {
    hechos = hechosEjemplo()
    ajustar = (v) => ({ ...v, cuadre: { ars_ok: null, usd_ok: null, detalle: 'No verificable: falta un valor.', diferencia: null } })
    try {
      expect(plano(cuadre(await pagina()))).toBe('Cuadre ○ No verificable: falta un valor.')
    } finally {
      ajustar = (v) => v
    }
  })
})
