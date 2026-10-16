import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import type { FilaResultado } from '@/lib/vistas/contratos-evolucion'
import { ejemploEvolucion } from '@/lib/vistas/ejemplo-evolucion'
import { barrasActivoTc } from './activo-tc'
import { leerParametros } from './parametros'

const c = (valor: string | null): CalcVista => ({ valor, formula: 'x', insumos: [], etiquetas: [] })
const p = (ars: string | null) => ({ ars: c(ars), usd: c(ars) })
const fila = (ticker: string, activo: string | null, tc: string | null, sin = '0', clase: FilaResultado['clase'] = 'posicion'): FilaResultado => {
  const r = activo === null || tc === null ? null : String(Number(activo) + Number(tc) + Number(sin))
  return { clave: ticker, nombre: ticker, ticker, cuenta: 'IEB', clase, color: '#000', resultado: p(r), activo: p(activo), tc: p(tc), sin_atribuir: p(sin), realizado: null, no_realizado: null, no_aplica: null, peso: p('0') }
}

describe('resultado en pesos: activo vs. tipo de cambio', () => {
  it('lo positivo a la derecha del cero y lo negativo a la izquierda, con una sola escala', () => {
    const { cero, filas } = barrasActivoTc([fila('GOOGL', '820000', '610000'), fila('LMT', '-120000', '350000'), fila('S30J7', '940000', '0')])
    // El más grande a la derecha mide 1.430.000; a la izquierda, 120.000.
    expect(cero).toBeCloseTo((120000 / 1550000) * 100, 9)
    const googl = filas.find((f) => f.clave === 'GOOGL')!
    expect(googl.tramos.map((t) => t.parte)).toEqual(['activo', 'tc'])
    expect(googl.tramos[0].desde).toBeCloseTo(cero, 9)
    expect(googl.tramos[1].desde).toBeCloseTo(cero + googl.tramos[0].ancho, 9)
    expect(googl.tramos[0].desde + googl.tramos[0].ancho + googl.tramos[1].ancho).toBeCloseTo(100, 9)
    const lmt = filas.find((f) => f.clave === 'LMT')!
    expect(lmt.tramos[0]).toMatchObject({ parte: 'activo', negativo: true })
    expect(lmt.tramos[0].desde).toBeCloseTo(0, 9)
    // Una LECAP en pesos no tiene tipo de cambio: un solo tramo.
    expect(filas.find((f) => f.clave === 'S30J7')!.tramos).toHaveLength(1)
    // Ordenadas por el resultado, de mayor a menor en valor absoluto.
    expect(filas.map((f) => f.clave)).toEqual(['GOOGL', 'S30J7', 'LMT'])
  })

  it('lo sin atribuir va aparte; sin resultado, sin barra; los bienes y la deuda no entran', () => {
    const r = barrasActivoTc([fila('A', '10', '5', '20'), fila('B', null, null), fila('Casa', '1', '1', '0', 'bien')])
    expect(r.filas.map((f) => f.clave)).toEqual(['A', 'B'])
    expect(r.filas[0].tramos.map((t) => t.parte)).toEqual(['activo', 'tc', 'sin_atribuir'])
    expect(r.conSinAtribuir).toBe(true)
    expect(r.filas[1].tramos).toEqual([])
  })

  it('con el demo (inventado): como mucho ocho, y cuántas quedan para el detalle', () => {
    const v = ejemploEvolucion(leerParametros({}), 'mes')
    const r = barrasActivoTc(v.filas)
    const partidas = v.filas.filter((f) => f.clase === 'posicion' || f.clase === 'saldo').length
    expect(r.filas.length).toBe(Math.min(8, partidas))
    expect(r.resto).toBe(partidas - r.filas.length)
    for (const f of r.filas) for (const t of f.tramos) expect(t.desde).toBeGreaterThanOrEqual(-1e-9)
  })
})
