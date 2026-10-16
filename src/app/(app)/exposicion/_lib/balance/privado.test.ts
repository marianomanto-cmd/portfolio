import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ejemploBalance } from '@/lib/vistas/ejemplo-balance'
import { TarjetaPasivo } from '../../_componentes/balance/tarjetas'
import { EstadoSituacion } from '../../_componentes/balance/estado'

// Modo privado (visión §4.10): el CSS tapa todo lo que lleve la clase `monto`.
// Un texto que llega armado de los datos (la fuente de una deuda, la nota de
// lo que falta pagar) puede traer montos: cada uno tiene que ir en su .monto.
// En producción, la fuente del estimado trae la cuenta con montos (D-131).

/** Los montos que quedan a la vista: el HTML sin lo que va dentro de un elemento .monto. */
function montosSinTapar(html: string): string[] {
  const sinTapados = html.replace(/<span class="[^"]*\bmonto\b[^"]*">[^<]*<\/span>/g, '')
  const texto = sinTapados.replace(/<[^>]+>/g, ' ')
  return texto.match(/(US)?\$\s?[−+-]?\d[\d.,]*/g) ?? []
}

describe('modo privado: los montos que vienen dentro de un texto también se tapan', () => {
  it('la fuente de la deuda estimada (tarjeta del pasivo y estado de situación)', () => {
    const v = ejemploBalance('estimada')
    expect(v.pasivo.filas[0].fuente).toMatch(/\$ 30\.000\.000/)
    expect(montosSinTapar(renderToStaticMarkup(createElement(TarjetaPasivo, { v })))).toEqual([])
    expect(montosSinTapar(renderToStaticMarkup(createElement(EstadoSituacion, { v })))).toEqual([])
  })

  it('la nota de lo que falta pagar según contrato', () => {
    const v = ejemploBalance('completo')
    const f = v.pasivo.filas[0]
    const conMonto = { ...v, pasivo: { ...v.pasivo, filas: [{ ...f, referencia: { ...f.referencia!, nota: '34 cuotas de $ 1.339.200 con IVA; la opción de compra ($ 3.800.000), aparte' } }] } }
    expect(montosSinTapar(renderToStaticMarkup(createElement(TarjetaPasivo, { v: conMonto })))).toEqual([])
    expect(montosSinTapar(renderToStaticMarkup(createElement(EstadoSituacion, { v: conMonto })))).toEqual([])
  })
})
