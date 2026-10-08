// Monto y los montos dentro de un texto, renderizados como los manda el servidor.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Monto, TextoConMontos } from './monto'

const texto = (html: string) => html.replace(/<[^>]+>/g, '')

describe('Monto compacto con signo (manual: "el signo y la flecha siempre están")', () => {
  it('un positivo lleva "+", como el formato largo', () => {
    expect(texto(renderToStaticMarkup(h(Monto, { valor: '6206000', moneda: 'ARS', signo: true, color: true, compacta: true })))).toBe('+$ 6,2 M ▲')
    expect(texto(renderToStaticMarkup(h(Monto, { valor: '1787.9335', moneda: 'USD', signo: true, color: true, compacta: true })))).toBe('+US$ 1,8k ▲')
    expect(texto(renderToStaticMarkup(h(Monto, { valor: '78.22', moneda: 'USD', signo: true, compacta: true })))).toBe('+US$ 78,22')
  })
  it('un negativo sigue con "−", y lo que redondea a cero no lleva signo ni color', () => {
    expect(texto(renderToStaticMarkup(h(Monto, { valor: '-235.7', moneda: 'USD', signo: true, color: true, compacta: true })))).toBe('−US$ 235,70 ▼')
    const cero = renderToStaticMarkup(h(Monto, { valor: '0.001', moneda: 'USD', signo: true, color: true, compacta: true }))
    expect(texto(cero)).toBe('US$ 0,00')
    expect(cero).not.toMatch(/text-(positive|negative)/)
  })
  it('sin signo pedido, no lo agrega', () => {
    expect(texto(renderToStaticMarkup(h(Monto, { valor: '6206000', moneda: 'ARS', compacta: true })))).toBe('$ 6,2 M')
  })
})

describe('TextoConMontos: los montos de un texto armado se ocultan en modo privado', () => {
  it('cada monto va en su .monto, y el de dólares en su pastilla', () => {
    const html = renderToStaticMarkup(h(TextoConMontos, { texto: ' de tus US$ 4.200; −$ 21.400.000 y +$ 6,2 M, al 12,5%.' }))
    expect(texto(html)).toBe(' de tus US$ 4.200; −$ 21.400.000 y +$ 6,2 M, al 12,5%.')
    const montos = [...html.matchAll(/<span class="([^"]*)">([^<]*)<\/span>/g)].map((m) => [m[1], m[2]])
    expect(montos).toEqual([
      ['num monto usd', 'US$ 4.200'],
      ['num monto whitespace-nowrap', '−$ 21.400.000'],
      ['num monto whitespace-nowrap', '+$ 6,2 M'],
    ])
  })
  it('un texto sin montos queda igual', () => {
    expect(renderToStaticMarkup(h(TextoConMontos, { texto: 'Falta la valuación de la camioneta.' }))).toBe('Falta la valuación de la camioneta.')
  })
})
