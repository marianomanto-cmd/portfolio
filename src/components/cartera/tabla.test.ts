// Posiciones (D-157), renderizada como la manda el servidor, con el ejemplo
// (números inventados, D-24): las tarjetas del teléfono (la grilla de AG Grid
// se arma en el navegador), la leyenda, y las celdas de cada columna de la
// grilla, que son componentes de la app: cada cifra abre su traza.
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { FilaCartera } from '@/lib/vistas/contratos'
import { ejemploCartera, ejemploCarteraVariante } from '@/lib/vistas/ejemplo'
import { pesoMaximo, totalesCartera } from './cuentas'
import { columnas, TablaCartera } from './tabla'

const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const v = ejemploCartera()
const html = () => renderToStaticMarkup(h(TablaCartera, { v }))
const fila = (ticker: string) => v.filas.find((f) => f.ticker === ticker) as FilaCartera
const cols = () => columnas(totalesCartera(v.filas, v), pesoMaximo(v.filas), v.hoy, false)
const celda = (col: string, f: FilaCartera) => renderToStaticMarkup(h('div', null, cols().find((c) => c.id === col)!.celda(f) as ReactNode))
const total = (col: string) => renderToStaticMarkup(h('div', null, cols().find((c) => c.id === col)!.total!() as ReactNode))
const traza = /<button[^>]*aria-controls/

describe('Posiciones · las columnas del handoff', () => {
  it('Activo · Cantidad · PPC ARS · PPC USD · Precio · Valor · Result. ARS · Result. USD · Activo · TC · % cartera · Días', () => {
    expect(cols().map((c) => c.titulo)).toEqual(['Activo', 'Cantidad', 'PPC ARS', 'PPC USD', 'Precio', 'Valor', 'Result. ARS', 'Result. USD', 'Activo · TC', '% cartera', 'Días'])
    // Lo que siempre se ve; lo demás se oculta por prioridad cuando no entra (y va en la ficha ⋯).
    expect(cols().filter((c) => c.prioridad === 0).map((c) => c.id)).toEqual(['activo', 'valor', 'res_ars', 'res_usd'])
  })

  it('el valor en pesos y debajo en dólares; el resultado con su signo y el %, cada cifra con su traza', () => {
    expect(texto(celda('valor', fila('SPY')))).toBe('$ 43.586.000 US$ 28.153')
    expect(texto(celda('res_ars', fila('SPY')))).toBe('+$ 6.206.000 +16,6%')
    expect(texto(celda('res_usd', fila('T30J7')))).toBe('−US$ 236 −3,5%')
    expect([...celda('res_ars', fila('SPY')).matchAll(new RegExp(traza, 'g'))]).toHaveLength(2)
    // Sin resultado en dólares: "sin dato" con su motivo, nunca un cero.
    expect(texto(celda('res_usd', fila('YPFD')))).toBe('sin dato')
  })

  it('la liquidez no tiene costo ni resultado: "—", no "sin dato" ni cero', () => {
    const usd = v.filas.find((f) => f.tipo === 'liquidez' && f.moneda_riesgo === 'USD')!
    for (const col of ['cantidad', 'ppc_ars', 'ppc_usd', 'precio', 'res_ars', 'res_usd', 'activo_tc', 'dias']) expect(texto(celda(col, usd)), col).toBe('—')
    expect(texto(celda('activo', usd))).toBe('Dólares Liquidez · IEB')
  })

  it('Días abren su traza y dicen de dónde se cuentan: «ap.» (apertura) o «decl.» (declarada)', () => {
    const ypfd = celda('dias', fila('YPFD'))
    expect(texto(ypfd)).toMatch(/^\d+ ap\.$/)
    expect(ypfd).toMatch(traza)
    expect(texto(celda('dias', fila('SPY')))).toMatch(/^\d+ decl\.$/)
  })

  it('Activo · TC: una barra con su traza (activo + TC = el resultado en pesos)', () => {
    const spy = celda('activo_tc', fila('SPY'))
    expect(spy).toMatch(traza)
    expect(spy).toMatch(/width:\s*[\d.]+%/)
    // Sin texto escondido adentro del botón: la barra se nombra como imagen.
    expect(spy).toContain('role="img" aria-label="Resultado: activo y tipo de cambio"')
  })

  it('% cartera: la mini barra contra la fila más grande y el porcentaje', () => {
    expect(texto(celda('peso', fila('SPY')))).toBe('41,8%')
    expect(celda('peso', fila('SPY'))).toMatch(/width:\s*100%/)
  })
})

describe('Posiciones · totales (la fila fija de abajo)', () => {
  it('el valor y el resultado de lo que está a la vista, en las dos monedas', () => {
    expect(texto(total('valor'))).toBe('$ 104.271.540 US$ 67.350')
    expect(texto(total('res_ars'))).toBe('+$ 8.533.500 +10,1%')
    expect(texto(total('activo'))).toBe('Total')
  })

  it('a Result. USD le faltan filas: "sin dato" y la suma parcial con su marca ¹', () => {
    const t = total('res_usd')
    expect(texto(t)).toBe('sin dato +US$ 1.630 ¹')
    expect(t).toContain('aria-label="suma parcial"')
  })
})

describe('Posiciones en el servidor: tarjetas del teléfono y leyenda', () => {
  it('una tarjeta por fila, en el orden del valor (la liquidez al pie), y la de los totales', () => {
    const t = html()
    expect([...t.matchAll(/data-tarjeta="([^"]+)"/g)].map((m) => m[1])).toEqual(['SPY', 'YPFD', 'S13N6', 'T30J7', 'FIMA', 'TXMJ0', 'Dólares en IEB', 'Pesos en IEB', 'Pesos en Mercado Pago'])
    expect(texto(t)).toContain('6 de 6 posiciones y 3 saldos de liquidez · al cierre del mié 14/10 · CCL 1.548,20')
  })

  it('el chip "ganás en pesos, perdés en dólares" solo donde los signos difieren', () => {
    const t = html()
    const tarjeta = (k: string) => {
      const i = t.indexOf(`data-tarjeta="${k}"`)
      return t.slice(i, t.indexOf('data-tarjeta=', i + 1))
    }
    expect(tarjeta('T30J7')).toContain('ganás en pesos, perdés en dólares')
    expect(tarjeta('SPY')).not.toContain('ganás en pesos')
  })

  it('la leyenda: los colores de la barra, qué es «ap.» y «decl.», y qué le falta a cada suma parcial', () => {
    const t = texto(html())
    expect(t).toContain('Resultado del activo Resultado del tipo de cambio')
    expect(t).toContain('¹ Suma parcial: en Result. USD, faltan YPFD, FIMA y TXMJ0.')
    // Lo pendiente de cada fila, que antes estaba en el detalle de la fila.
    expect(t).toContain('YPFD, FIMA y TXMJ0: Falta el CCL de compra de la apertura')
  })

  it('lo sin atribuir hoy, con su monto y su traza (carga express)', () => {
    const html = renderToStaticMarkup(h(TablaCartera, { v: ejemploCarteraVariante('express') }))
    const i = html.indexOf('aria-label="Lo pendiente"')
    const notas = html.slice(i, html.indexOf('</ul>', i))
    expect(texto(notas)).toMatch(/S13N6: sin atribuir hoy \(sin precio o CCL nuevo\) −US\$ 60,97 \./)
    expect(notas).toMatch(/<button[^>]*aria-controls/)
  })

  it('un precio viejo (D-16) se dice en la fila: "precio de hace N días"', () => {
    const viejo = ejemploCarteraVariante('viejo')
    expect(viejo.filas.some((f) => f.precio_viejo)).toBe(true)
    const t = texto(renderToStaticMarkup(h(TablaCartera, { v: viejo })))
    expect(t).toMatch(/precio de hace \d+ días/)
  })
})
