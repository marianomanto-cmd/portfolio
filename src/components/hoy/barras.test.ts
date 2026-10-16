// Las barras de Hoy (handoff, capturas 01 y 02) y el color de un resultado:
// anchos proporcionales a lo que se ve, y ninguna barra inventada cuando falta
// un dato. Números inventados (D-24).
import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import type { SeriePatrimonio } from '@/lib/vistas/contratos-hoy'
import { anchoRelativo, anchoSobre, anchoTramo, barraExcedente, barraExposicion, barraVariacion, fraseSerie, notaExcedente, partesSerie, tonoDe } from './barras'

const c = (valor: string | null): CalcVista => (valor === null ? { valor: null, motivo: 'falta', formula: 'sin dato', insumos: [], etiquetas: [] } : { valor, formula: valor, insumos: [], etiquetas: [] })

describe('tonoDe', () => {
  it('verde si suma, sangría si resta y tinta si redondea a cero en lo que se ve', () => {
    expect(tonoDe('1250')).toBe('text-positive')
    expect(tonoDe('-0.6')).toBe('text-negative')
    expect(tonoDe('0.4')).toBe('')
    expect(tonoDe('0')).toBe('')
    expect(tonoDe(null)).toBe('')
    // Un porcentaje con más decimales.
    expect(tonoDe('0.0004', 3)).toBe('')
    expect(tonoDe('0.0006', 3)).toBe('text-positive')
  })
})

describe('barraVariacion', () => {
  it('un tramo por parte, proporcional a su tamaño en pesos', () => {
    expect(barraVariacion('57313', '532812')).toEqual([
      { clave: 'activos', ancho: '9.71%', negativo: false },
      { clave: 'tc', ancho: '90.29%', negativo: false },
    ])
    expect(barraVariacion('-100', '300', '100')).toEqual([
      { clave: 'activos', ancho: '20%', negativo: true },
      { clave: 'tc', ancho: '60%', negativo: false },
      { clave: 'sin_atribuir', ancho: '20%', negativo: false },
    ])
  })

  it('sin dato en alguna parte (también lo sin atribuir) o todo en cero: sin barra', () => {
    expect(barraVariacion(null, '300')).toEqual([])
    expect(barraVariacion('100', '300', null)).toEqual([])
    expect(barraVariacion('0', '0', '0')).toEqual([])
  })
})

describe('barraExposicion', () => {
  it('corto a la izquierda, largo a la derecha; el ancho, sobre lo más grande (hasta la mitad)', () => {
    expect(barraExposicion('-50', '100', '150')).toEqual({ lado: 'corto', ancho: '16.67%' })
    expect(barraExposicion('32783100', '54183100', '21400000')).toEqual({ lado: 'largo', ancho: '30.25%' })
    expect(barraExposicion('100', null, null)).toEqual({ lado: 'largo', ancho: '50%' })
  })

  it('sin el neto, o en cero, no hay barra', () => {
    expect(barraExposicion(null, '100', '150')).toEqual({ lado: null, ancho: '0%' })
    expect(barraExposicion('0', '100', '100')).toEqual({ lado: null, ancho: '0%' })
  })
})

describe('barraExcedente', () => {
  it('gastos fijos, cuota y lo que sobra, sobre los ingresos', () => {
    expect(barraExcedente('1000', '-600', '-200')).toEqual({ gastos: '60%', cuota: '20%', sobrante: '20%', falta: false })
  })

  it('si gastos y cuota pasan a los ingresos, la base es lo que sale y no sobra nada', () => {
    expect(barraExcedente('1000', '800', '400')).toEqual({ gastos: '66.67%', cuota: '33.33%', sobrante: '0%', falta: true })
  })

  it('sin alguna parte, o sin nada que dibujar: null (la tarjeta dice "sin dato")', () => {
    expect(barraExcedente(null, '800', '400')).toBeNull()
    expect(barraExcedente('1000', null, '400')).toBeNull()
    expect(barraExcedente('0', '0', '0')).toBeNull()
  })
})

describe('notaExcedente', () => {
  it('qué es real y qué sigue proyectado', () => {
    expect(notaExcedente(null)).toBe('Proyectado; el real se cierra a fin de mes.')
    expect(notaExcedente({ ingresos: false, gastos: false })).toBe('Proyectado; el real se cierra a fin de mes.')
    expect(notaExcedente({ ingresos: true, gastos: true })).toBe('Con lo real que cargaste este mes.')
    expect(notaExcedente({ ingresos: true, gastos: false })).toBe('Con tu ingreso real; los gastos, proyectados.')
    expect(notaExcedente({ ingresos: false, gastos: true })).toBe('Con tus gastos reales; el ingreso, proyectado.')
  })
})

describe('anchos de "Qué tenés y qué debés" y de "% cartera"', () => {
  it('una fracción positiva como ancho, recortada al 100%; nada si falta o no es positiva', () => {
    expect(anchoTramo('0.25')).toBe('25%')
    expect(anchoTramo('1.5')).toBe('100%')
    expect(anchoTramo(null)).toBeNull()
    expect(anchoTramo('0')).toBeNull()
    expect(anchoTramo('-0.1')).toBeNull()
    expect(anchoSobre('50', '200')).toBe('25%')
    expect(anchoSobre('50', '0')).toBeNull()
    expect(anchoSobre('-50', '200')).toBeNull()
    // La fila más grande llena la caja.
    expect(anchoRelativo('0.418', '0.418')).toBe('100%')
    expect(anchoRelativo('0.209', '0.418')).toBe('50%')
  })
})

describe('fraseSerie: el pie del gráfico del patrimonio neto', () => {
  const serie = (ars: string | null, usd: string | null, ccl?: [string, string]): SeriePatrimonio => ({
    puntos: [],
    periodo: null,
    variacion: { ars: c(ars), usd: c(usd) },
    ccl: ccl ? { desde: c(ccl[0]), hasta: c(ccl[1]) } : null,
    motivo: null,
  })

  it('cuánto cambió en cada moneda y, si el CCL se movió, que esa es la diferencia', () => {
    expect(fraseSerie(serie('0.0298', '-0.0041', ['1497.3', '1548.2']))).toBe(
      'En pesos tu patrimonio neto subió 3,0%; en dólares, bajó 0,4%. La diferencia es el CCL, que pasó de 1.497,30 a 1.548,20.',
    )
    expect(fraseSerie(serie('0.03', '0.01', ['1500', '1500']))).toBe('En pesos tu patrimonio neto subió 3,0%; en dólares, 1,0%.')
  })

  it('sin la variación en alguna moneda, no hay frase', () => {
    expect(fraseSerie(serie(null, '0.01'))).toBeNull()
  })

  it('cada cifra del pie lleva su traza: las dos variaciones y el CCL de las dos puntas', () => {
    const s = serie('0.0298', '-0.0041', ['1497.3', '1548.2'])
    const cifras = partesSerie(s)!.filter((p) => p.calc)
    expect(cifras.map((p) => [p.texto, p.calc])).toEqual([
      ['3,0%', s.variacion.ars],
      ['0,4%', s.variacion.usd],
      ['1.497,30', s.ccl!.desde],
      ['1.548,20', s.ccl!.hasta],
    ])
  })
})
