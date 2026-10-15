import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { F13, F14, hechosBalance } from '@/lib/domain/balance.fixture'
import { armarBalance } from '@/lib/vistas/armar-balance'
import { Comparativo } from '../_componentes/comparativo'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }))

// El comparativo pone un chip por renglón. Si la cifra anterior es un estimado
// y la de hoy no (la leasera informó el valor de cancelación después), la
// diferencia también es un estimado: el chip tiene que decirlo (CLAUDE.md:
// un estimado solo con su etiqueta a la vista).

describe('comparativo: el chip de cada renglón cuenta las dos fechas', () => {
  it('deuda estimada el 13/10 e informada el 14/10: el patrimonio neto y el pasivo llevan "estimado"', () => {
    const h = hechosBalance({ deuda: 'estimada' })
    h.pasivo_saldos = [...h.pasivo_saldos, { pasivo_id: 1, fecha: F14, capital_pendiente: new Decimal('19500000'), naturaleza: 'informado', fuente: 'la leasera (inventado)', carga_id: 10 }]
    const v = armarBalance(h, F14, { comparar: F13 })
    const c = v.comparativo!
    const neto = c.lineas.find((l) => l.clave === 'completo')!
    expect(neto.actual.ars.etiquetas).not.toContain('estimado')
    expect(neto.anterior.ars.etiquetas).toContain('estimado')
    expect(neto.chip).toBe('estimado')
    const html = renderToStaticMarkup(createElement(Comparativo, { c, fecha: v.fecha!, demo: null, ruta: { fecha: null, agrupar: 'cuenta' } }))
    // La fila de la tabla del patrimonio neto (desde 768 px) y su tarjeta (teléfono).
    const [tabla, telefono] = html.split('</table>')
    const filas = tabla.split('<tr').filter((x) => x.includes('Patrimonio neto') || x.includes('Total del pasivo'))
    expect(filas.length).toBe(2)
    for (const f of filas) expect(f).toContain('estimado')
    const tarjetas = telefono.split('<li').filter((x) => x.includes('Patrimonio neto') || x.includes('Total del pasivo'))
    expect(tarjetas.length).toBe(2)
    for (const t of tarjetas) expect(t).toContain('estimado')
  })
})
