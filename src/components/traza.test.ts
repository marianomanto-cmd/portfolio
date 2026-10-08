// Los insumos de la traza se ven con el valor que usa la fórmula.
import { describe, expect, it } from 'vitest'
import { formatearInsumo } from './traza'

describe('formatearInsumo', () => {
  it('el precio de un bono por 1 VN se ve entero: 9.000.000 × $ 1,124 = $ 10.116.000', () => {
    expect(formatearInsumo({ nombre: 'Precio de T30J7', valor: '1.124', unidad: 'ARS' })).toBe('$ 1,124')
    expect(formatearInsumo({ nombre: 'Precio mostrado', valor: '1.0852', unidad: 'ARS' })).toBe('$ 1,0852')
    expect(formatearInsumo({ nombre: 'Precio de una letra', valor: '0.000694', unidad: 'USD' })).toBe('US$ 0,000694')
  })
  it('un monto sigue al centavo, y sin dato es "sin dato"', () => {
    expect(formatearInsumo({ nombre: 'Valor', valor: '10116000', unidad: 'ARS' })).toBe('$ 10.116.000,00')
    expect(formatearInsumo({ nombre: 'Valor en dólares', valor: '6533.789012345', unidad: 'USD' })).toBe('US$ 6.533,79')
    expect(formatearInsumo({ nombre: 'Valor', valor: null, unidad: 'ARS' })).toBe('sin dato')
  })
})
