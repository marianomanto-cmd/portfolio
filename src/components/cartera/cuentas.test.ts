// Las cuentas de la tabla de Posiciones (D-157; handoff, capturas 03 y 04):
// el desglose activo / TC, la barra y su traza, los filtros y los totales de
// lo que está a la vista (con la suma parcial, D-65). Con el ejemplo
// (números inventados, D-24).
import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import type { FilaCartera } from '@/lib/vistas/contratos'
import { ejemploCartera, ejemploCarteraVariante } from '@/lib/vistas/ejemplo'
import {
  barraActivoTc,
  CERO_TC,
  desgloseEn,
  esLiquidez,
  haceDias,
  hayFiltros,
  notasPendientes,
  pasa,
  pesoMaximo,
  SIN_FILTRO,
  sinAtribuirHoy,
  sumasParciales,
  tieneSinDato,
  totalesCartera,
  trazaActivoTc,
  trazaTotalActivoTc,
} from './cuentas'

const v = ejemploCartera()
const fila = (ticker: string) => v.filas.find((f) => f.ticker === ticker) as FilaCartera
const liquidez = () => v.filas.filter(esLiquidez)

describe('desgloseEn (D-35, D-68)', () => {
  it('en la moneda en que arriesga, todo es activo y el tipo de cambio es cero', () => {
    const spy = fila('SPY')
    expect(desgloseEn(spy, 'USD')).toEqual({ activo: spy.resultado.usd, tc: CERO_TC })
    const ypfd = fila('YPFD')
    expect(desgloseEn(ypfd, 'ARS')).toEqual({ activo: ypfd.resultado.ars, tc: CERO_TC })
  })

  it('en la otra moneda, el desglose del motor; sin él, null (nunca un cero inventado)', () => {
    const spy = fila('SPY')
    const d = desgloseEn(spy, 'ARS')!
    expect(new Decimal(d.activo.valor!).plus(d.tc.valor!).minus(spy.resultado.ars.valor!).abs().lt('1e-20')).toBe(true)
    expect(desgloseEn(fila('YPFD'), 'USD')).toBeNull()
    expect(desgloseEn(liquidez()[0], 'ARS')).toBeNull()
  })
})

describe('barraActivoTc', () => {
  it('cada tramo proporcional a su tamaño; el activo que resta, marcado', () => {
    expect(barraActivoTc('-100', '300')).toEqual({ activo: '25%', tc: '75%', activoNegativo: true })
    expect(barraActivoTc('1230000', '0')).toEqual({ activo: '100%', tc: '0%', activoNegativo: false })
  })

  it('sin desglose o con las dos partes en cero: sin barra', () => {
    expect(barraActivoTc(null, '300')).toBeNull()
    expect(barraActivoTc('0', '0')).toBeNull()
  })
})

describe('trazaActivoTc: la barra (que no tiene números) dice de dónde sale', () => {
  it('el resultado en pesos = activo + TC, con el desglose en dólares como insumo', () => {
    const spy = fila('SPY')
    const t = trazaActivoTc(spy)
    expect(t.valor).toBe(spy.resultado.ars.valor)
    expect(t.formula).toMatch(/^activo \+\$ [\d.]+ \+ TC \+\$ [\d.]+ = \+\$ 6\.206\.000$/)
    expect(t.insumos.map((i) => [i.nombre, i.unidad])).toEqual([
      ['Activo, en pesos', 'ARS'],
      ['Tipo de cambio, en pesos', 'ARS'],
      ['Activo, en dólares', 'USD'],
      ['Tipo de cambio, en dólares', 'USD'],
    ])
  })

  it('sin desglose: "sin dato" con el motivo', () => {
    const t = trazaActivoTc(liquidez()[0])
    expect(t.valor).toBeNull()
    expect(t.motivo).toBeTruthy()
  })
})

describe('pesoMaximo y haceDias', () => {
  it('el peso más grande (la fila que llena la mini barra); nada si no hay', () => {
    expect(pesoMaximo(v.filas)).toBe(fila('SPY').peso.valor)
    expect(pesoMaximo([])).toBeNull()
  })

  it('de hace cuántos días es un precio', () => {
    expect(haceDias('2026-10-14', '2026-10-21')).toBe(7)
    expect(haceDias(null, '2026-10-21')).toBeNull()
    expect(haceDias('2026-10-14', undefined)).toBeNull()
    expect(haceDias('2026-10-22', '2026-10-21')).toBeNull()
  })
})

describe('filtros', () => {
  const tickers = (x: Parameters<typeof pasa>[1]) => v.filas.filter((f) => pasa(f, x)).map((f) => (esLiquidez(f) ? f.nombre : f.ticker))

  it('por cuenta, clase y moneda de riesgo; la liquidez respeta la cuenta y la moneda', () => {
    expect(tickers(SIN_FILTRO)).toHaveLength(9)
    expect(tickers({ ...SIN_FILTRO, cuenta: 'Galicia' })).toEqual(['S13N6', 'FIMA'])
    expect(tickers({ ...SIN_FILTRO, clase: 'bono' })).toEqual(['T30J7', 'TXMJ0'])
    expect(tickers({ ...SIN_FILTRO, clase: 'liquidez' })).toEqual(['Dólares en IEB', 'Pesos en IEB', 'Pesos en Mercado Pago'])
    expect(tickers({ ...SIN_FILTRO, moneda: 'USD' })).toEqual(['SPY', 'Dólares en IEB'])
  })

  it('"solo con sin dato" y "solo precios viejos"', () => {
    expect(v.filas.filter(tieneSinDato).map((f) => f.ticker)).toEqual(['YPFD', 'FIMA', 'TXMJ0'])
    expect(tickers({ ...SIN_FILTRO, sinDato: true })).toEqual(['YPFD', 'FIMA', 'TXMJ0'])
    expect(tickers({ ...SIN_FILTRO, viejos: true })).toEqual([])
    expect(hayFiltros(SIN_FILTRO)).toBe(false)
    expect(hayFiltros({ ...SIN_FILTRO, viejos: true })).toBe(true)
  })
})

describe('totalesCartera: la fila fija de abajo', () => {
  it('el valor de todo, el resultado de las posiciones (la liquidez no tiene costo) y el % sobre lo invertido', () => {
    const t = totalesCartera(v.filas, v)
    expect(t.posiciones).toBe(6)
    expect(t.valorArs.total.valor).toBe('104271540')
    expect(t.valorArs.total.valor).toBe(v.totales.valor.ars.valor)
    expect(t.resArs.total.valor).toBe('8533500')
    expect(t.pctArs?.valor).toBe(new Decimal(v.totales.resultado.ars.valor!).div(v.totales.costo.ars.valor!).toFixed())
    // Activo + TC = el resultado en pesos.
    expect(new Decimal(t.actArs.total.valor!).plus(t.tcArs.total.valor!).minus('8533500').abs().lt('1e-20')).toBe(true)
  })

  it('a una columna le falta una fila: "sin dato" y la suma parcial, con lo que falta en la leyenda (D-65)', () => {
    const t = totalesCartera(v.filas, v)
    expect(t.resUsd.total.valor).toBeNull()
    expect([t.resUsd.contadas, t.resUsd.de]).toEqual([3, 6])
    expect(Number(t.resUsd.parcial?.valor)).toBeCloseTo(1787.93 + 78.22 - 235.7, 1)
    expect(sumasParciales(t)).toEqual([{ columna: 'Result. USD', faltan: 'YPFD, FIMA y TXMJ0', cuantas: 3 }])
  })

  it('con un filtro, los totales son de lo que está a la vista y el % sobre lo invertido no se muestra', () => {
    const visibles = v.filas.filter((f) => pasa(f, { ...SIN_FILTRO, cuenta: 'Galicia' }))
    const t = totalesCartera(visibles, v)
    expect(t.posiciones).toBe(2)
    expect(t.valorArs.total.valor).toBe('18494800')
    expect(t.pctArs).toBeNull()
    expect(sumasParciales(t)).toEqual([{ columna: 'Result. USD', faltan: 'FIMA', cuantas: 1 }])
  })

  it('la traza de la barra de totales: activo + TC = el resultado, con los dólares como insumo', () => {
    const t = trazaTotalActivoTc(totalesCartera(v.filas, v))
    expect(t.valor).toBe('8533500')
    expect(t.formula).toBe('activo +$ 5.009.527 + TC +$ 3.523.973 = +$ 8.533.500')
    expect(t.insumos.map((i) => i.unidad)).toEqual(['ARS', 'ARS', 'USD', 'USD'])
  })
})

describe('lo pendiente de cada fila, a la vista debajo de la tabla', () => {
  it('agrupado por texto: las aperturas sin CCL de compra van juntas', () => {
    expect(notasPendientes(v.filas)).toEqual([
      {
        quienes: 'YPFD, FIMA y TXMJ0',
        texto: 'Falta el CCL de compra de la apertura: se declara desde la 1b (Pendientes). Hasta entonces, el PPC y el resultado en dólares desde la compra son "sin dato".',
      },
    ])
    expect(notasPendientes(v.filas.filter((f) => f.ticker === 'SPY'))).toEqual([])
  })

  it('lo sin atribuir hoy, con su monto y su moneda (después de una carga express)', () => {
    expect(sinAtribuirHoy(v.filas)).toEqual([])
    const x = sinAtribuirHoy(ejemploCarteraVariante('express').filas)
    expect(x.map((y) => [y.ticker, y.moneda])).toEqual([
      ['S13N6', 'USD'],
      ['T30J7', 'USD'],
    ])
    expect(Number(x[0].calc.valor)).toBeLessThan(0)
  })
})
