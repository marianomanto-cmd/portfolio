import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import { Decimal } from '@/lib/domain/dinero'
import { aDolares, compararCifras, decimalesPrecio, fraccionDe, porSubaDeCcl, restoMayor, sumaColumna } from './calculos'

const c = (valor: string | null, motivo?: string): CalcVista => ({ valor, motivo, formula: valor ?? 'sin dato', insumos: [], etiquetas: [] })

describe('restoMayor (visión §4.0)', () => {
  it('la frase del Apéndice B: lo que se ve suma exacto', () => {
    const ars = restoMayor('590125.00', ['532812.44', '57312.56'])
    expect(ars.total.toFixed()).toBe('590125')
    expect(ars.partes.map((p) => p.toFixed())).toEqual(['532812', '57313'])
    const usd = restoMayor('-340.2447', ['36.7602', '-377.0049'])
    expect(usd.total.toFixed()).toBe('-340')
    expect(usd.partes.map((p) => p.toFixed())).toEqual(['37', '-377'])
  })
  it('las partes redondeadas siempre suman el total redondeado', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -10_000_000, max: 10_000_000 }), { minLength: 1, maxLength: 6 }), fc.integer({ min: 0, max: 2 }), (xs, dec) => {
        const partes = xs.map((x) => new Decimal(x).div(1000))
        const total = partes.reduce((a, b) => a.plus(b), new Decimal(0))
        const r = restoMayor(total, partes, dec)
        return r.partes.reduce((a, b) => a.plus(b), new Decimal(0)).eq(r.total)
      }),
    )
  })
})

describe('sumaColumna (D-65)', () => {
  it('con todo, suma exacta', () => {
    const r = sumaColumna([{ nombre: 'A', calc: c('1.10') }, { nombre: 'B', calc: c('2.20') }], 'USD', '')
    expect(r.total.valor).toBe('3.3')
    expect(r.parcial).toBeNull()
  })
  it('si falta una parte, el total es sin dato y la parcial queda rotulada', () => {
    const r = sumaColumna(
      [
        { nombre: 'SPY', calc: c('1787.9335') },
        { nombre: 'YPFD', calc: c(null) },
        { nombre: 'S13N6', calc: c('78.2217') },
        { nombre: 'T30J7', calc: c('-235.7033') },
      ],
      'USD',
      '',
    )
    expect(r.total.valor).toBeNull()
    expect(r.total.etiquetas).toContain('parcial')
    expect(r.parcial!.valor).toBe('1630.4519')
    expect(r.contadas).toBe(3)
    expect(r.de).toBe(4)
    expect(r.total.motivo).toMatch(/YPFD/)
  })
})

describe('conversiones', () => {
  it('pesos a dólares al CCL, y sin dato si falta algo', () => {
    expect(aDolares(c('54183100'), c('1548.2'), 'Pesos', '').valor).toBe(new Decimal('54183100').div('1548.2').toFixed())
    expect(aDolares(c(null), c('1548.2'), 'Pesos', '').valor).toBeNull()
    expect(aDolares(c('1'), c(null), 'Pesos', '').valor).toBeNull()
  })
  it('sensibilidad al CCL: 1% de los activos en dólares', () => {
    expect(porSubaDeCcl(c('50088440'), '1', 'ARS', '').valor).toBe('500884.4')
    expect(porSubaDeCcl(c(null), '1', 'ARS', '').valor).toBeNull()
  })
  it('ordena cifras exactas con sin dato al final', () => {
    const xs = ['10', null, '-2', '3.5'].sort(compararCifras)
    expect(xs).toEqual(['-2', '3.5', '10', null])
  })
})


describe('fraccionDe y decimales de precio', () => {
  it('resultado sobre costo, y sin dato con base cero', () => {
    expect(fraccionDe(c('8533500'), c('84508300'), 'ARS', '').valor).toBe(new Decimal('8533500').div('84508300').toFixed())
    expect(fraccionDe(c('1'), c('0'), 'ARS', '').valor).toBeNull()
  })
  it('más decimales para precios chicos', () => {
    expect(decimalesPrecio('35150')).toBe(2)
    expect(decimalesPrecio('1.0852')).toBe(4)
    expect(decimalesPrecio('0.000694')).toBe(6)
  })
})
