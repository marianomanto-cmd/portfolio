// Hoy, carga express (visión §4.2): "+$ 49.560 de tus US$ 4.200". Los US$ 4.200
// son una cifra con traza (tus dólares en efectivo de la carga anterior): en la
// frase se tocan, y en la hoja del teléfono tienen su renglón, sin signo. El
// rótulo del grupo no lleva el monto (se leería en modo privado). Datos del
// ejemplo (inventados, D-24).
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: (p: { href: string; children: unknown; className?: string }) => h('a', { href: p.href, className: p.className }, p.children as never),
}))
vi.mock('@/lib/server/sesion', () => ({ modoDemo: () => true }))
vi.mock('@/components/shell/datos', () => ({ hoyDelPedido: async () => null }))

const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function pagina(sp: Record<string, string>): Promise<string> {
  const { default: PaginaHoy } = await import('@/app/(app)/page')
  return renderToStaticMarkup((await PaginaHoy({ searchParams: Promise.resolve(sp) })) as ReactElement)
}

describe('Hoy · carga express: "de tus US$ 4.200"', () => {
  it('los US$ 4.200 tienen su renglón en la hoja, sin signo y tocables; ningún rótulo lleva un monto', async () => {
    const html = await pagina({ demo: 'express' })
    const i = html.indexOf('aria-label="La frase del día, cifra por cifra"')
    expect(i).toBeGreaterThan(-1)
    const hoja = html.slice(i, html.indexOf('</dialog>', i))
    const filas = [...hoja.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) => m[1])
    const fila = (etiqueta: string) => filas.find((f) => texto(f).startsWith(etiqueta)) ?? ''
    // El "+$ 49.560" del grupo es el mismo que "Sin atribuir": no se repite en la hoja.
    const base = fila('Tus dólares en efectivo (carga anterior)')
    expect(texto(base)).toBe('Tus dólares en efectivo (carga anterior) US$ 4.200')
    expect(base).toMatch(/<button[^>]*aria-controls[^>]*>(?:(?!<\/button>).)*US\$ 4\.200/)
    // Ningún rótulo de la hoja lleva un monto.
    for (const f of filas) expect(f.replace(/<button.*$/, '')).not.toMatch(/US\$ \d|\$ \d/)
  })
})

describe('la frase: la puntuación que sigue a una cifra va pegada a ella', () => {
  it('"US$ 4.200" + "." quedan juntos (el punto no baja solo de renglón)', async () => {
    const { pegarPuntuacion } = await import('./frase')
    const c = { valor: '4200', formula: 'x', insumos: [], etiquetas: [] }
    const parte = (texto: string, conCalc: boolean) => ({ texto, calc: conCalc ? c : null, tono: null, esMonto: conCalc, titulo: '' })
    expect(pegarPuntuacion([parte(' de tus ', false), parte('US$ 4.200', true), parte('.', false)]).map((x) => [x.p.texto, x.pegado])).toEqual([
      [' de tus ', ''],
      ['US$ 4.200', '.'],
      ['', ''],
    ])
    // Solo la puntuación del principio; el resto del texto sigue en su parte. Un texto sin cifra antes no cambia.
    expect(pegarPuntuacion([parte('−0,71%', true), parte('). Cargaste', false), parte('. Hola', false)]).map((x) => [x.p.texto, x.pegado])).toEqual([
      ['−0,71%', ').'],
      [' Cargaste', ''],
      ['. Hola', ''],
    ])
  })

  it('en la página, "US$ 4.200." va dentro de un mismo bloque sin corte', async () => {
    const html = await pagina({ demo: 'express' })
    expect(html).toMatch(/<span class="whitespace-nowrap">(?:(?!<\/?span class="whitespace-nowrap").)*US\$ 4\.200(?:(?!<span class="whitespace-nowrap").)*?<\/span>\.<\/span>/)
  })
})
