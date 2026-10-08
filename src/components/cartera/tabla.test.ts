// Cartera, renderizada como la manda el servidor, con el ejemplo (números
// inventados): lo que se ve antes de tocar nada.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ejemploCartera } from '@/lib/vistas/ejemplo'
import { TablaCartera } from './tabla'

const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const html = () => renderToStaticMarkup(h(TablaCartera, { v: ejemploCartera() }))

/** Las celdas (<td>) de la fila de la tabla de ese ticker, en el orden de las columnas. */
function celdas(fuente: string, desde: string, hasta: string): string[] {
  const i = fuente.indexOf(desde)
  const fin = fuente.indexOf(hasta, i + 1)
  return fuente.slice(i, fin).split('<td').slice(1).map((c) => `<td${c}`)
}
const COL = { tc_usd: 5, dias: 10 }

describe('Cartera · Días (visión §4.5)', () => {
  it('abren su traza y dicen de dónde se cuentan: "desde apertura" o "declarado"', () => {
    const t = html()
    const ypfd = celdas(t, 'data-fila="YPFD"', '</tr>')[COL.dias]
    expect(texto(ypfd)).toMatch(/^\d+ desde apertura$/)
    expect(ypfd).toMatch(/<button[^>]*aria-controls/)
    const spy = celdas(t, 'data-fila="SPY"', '</tr>')[COL.dias]
    expect(texto(spy)).toMatch(/^\d+ declarado$/)
    expect(spy).toMatch(/<button[^>]*aria-controls/)
  })
})

describe('Cartera · Totales', () => {
  it('"TC" va pegado a su total, en su renglón, y la suma parcial debajo', () => {
    const t = html()
    const pie = celdas(t, '<tfoot', '</tfoot>')[COL.tc_usd]
    // El rótulo y el total comparten un renglón (items-baseline); "suma parcial" queda afuera.
    const renglon = pie.match(/<span class="inline-flex items-baseline gap-1"><span>TC<\/span>(.*?)<\/span><span class="flex flex-col/)
    expect(renglon, pie).not.toBeNull()
    expect(texto(renglon![1])).toBe('sin dato')
    expect(texto(pie)).toMatch(/TC sin dato suma parcial \(3 de 6\) −US\$ 644,58$/)
  })

  it('sin desglose, el "sin dato" dice qué falta, sin mandar a una pantalla que no lo tiene', () => {
    const ypfd = celdas(html(), 'data-fila="YPFD"', '</tr>')[COL.tc_usd]
    expect(ypfd).toContain('title="Sin el resultado en dólares no se puede separar activo de tipo de cambio. Si es una apertura sin CCL de compra, ese CCL se declara desde la 1b (Pendientes)."')
    expect(ypfd).not.toContain('en Datos')
  })
})
