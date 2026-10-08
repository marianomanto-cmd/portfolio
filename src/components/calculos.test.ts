import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import { Decimal } from '@/lib/domain/dinero'
import { aDolares, compararCifras, decimalesInsumo, decimalesPrecio, diasEnPosicion, fraccionDe, parcialDeTotal, porSubaDeCcl, restoMayor, sumaColumna } from './calculos'

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

describe('parcialDeTotal (D-65 en Hoy)', () => {
  const insumo = (nombre: string, valor: string | null, unidad: 'ARS' | 'USD' | 'ratio' = 'ARS') => ({ nombre, valor, unidad, calc: c(valor) })
  const total = (insumos: ReturnType<typeof insumo>[], etiquetas: CalcVista['etiquetas'] = ['parcial']): CalcVista => ({
    valor: null,
    motivo: 'Falta Camioneta.',
    formula: 'sin dato',
    insumos,
    etiquetas,
  })
  it('vuelve a sumar las partes conocidas, con traza', () => {
    const r = parcialDeTotal(total([insumo('IEB', '80830000'), insumo('Camioneta', null), insumo('Leasing', '-21400000')]), 'ARS')!
    expect(r.parcial!.valor).toBe('59430000')
    expect(r.contadas).toBe(2)
    expect(r.de).toBe(3)
    expect(r.parcial!.formula).toBe('suma parcial (2 de 3): $ 80.830.000,00 + −$ 21.400.000,00 = $ 59.430.000,00')
    expect(r.parcial!.etiquetas).toEqual(['parcial'])
  })
  it('null si el total tiene valor, si no es una suma parcial o si no se conoce ninguna parte', () => {
    expect(parcialDeTotal({ ...c('1'), etiquetas: ['parcial'] }, 'ARS')).toBeNull()
    expect(parcialDeTotal(total([insumo('A', '1'), insumo('B', null)], []), 'ARS')).toBeNull()
    expect(parcialDeTotal(total([insumo('A', null), insumo('B', null)]), 'ARS')).toBeNull()
    expect(parcialDeTotal(total([]), 'ARS')).toBeNull()
  })
  it('null si algún insumo no es un monto en esa moneda: no es una suma de partes', () => {
    expect(parcialDeTotal(total([insumo('Pesos', '1000'), insumo('CCL', '1548.2', 'ratio')]), 'USD')).toBeNull()
    expect(parcialDeTotal(total([insumo('A', '1', 'USD'), insumo('B', null, 'USD')]), 'ARS')).toBeNull()
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

describe('diasEnPosicion (Cartera)', () => {
  it('dice de dónde se cuentan; la fecha declarada lleva "declarado"', () => {
    const ap = diasEnPosicion(14, 'apertura')
    expect(ap.valor).toBe('14')
    expect(ap.formula).toBe('14 días desde la apertura en la app')
    expect(ap.explicacion).toMatch(/No es cuánto hace que la tenés/)
    expect(ap.etiquetas).toEqual([])
    const de = diasEnPosicion(226, 'declarada')
    expect(de.formula).toBe('226 días desde la fecha de compra que declaraste')
    expect(de.etiquetas).toEqual(['declarado'])
    expect(diasEnPosicion(1, 'compra').formula).toBe('1 día desde tu primera compra registrada')
  })
  it('sin fecha de inicio, sin dato (nunca cero)', () => {
    expect(diasEnPosicion(null, null).valor).toBeNull()
    expect(diasEnPosicion(3, null).valor).toBeNull()
  })
})

describe('decimalesInsumo (traza)', () => {
  it('un precio se ve con sus decimales, como en la fórmula', () => {
    expect(decimalesInsumo('1.124')).toBe(3)
    expect(decimalesInsumo('1.0852')).toBe(4)
    expect(decimalesInsumo('0.000694')).toBe(6)
    expect(decimalesInsumo('4.62')).toBe(2)
  })
  it('un monto, al centavo; nunca menos de 2', () => {
    expect(decimalesInsumo('10116000')).toBe(2)
    expect(decimalesInsumo('10116000.5')).toBe(2)
    expect(decimalesInsumo('52345.678901234')).toBe(2)
    expect(decimalesInsumo('23.456789123')).toBe(4)
    expect(decimalesInsumo(null)).toBe(2)
  })
})
