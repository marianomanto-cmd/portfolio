// La lectura de Posiciones (D-157, anatomía 2) y las cifras clave que no son
// sumas (la mejor y la peor en dólares). Un solo énfasis; lo que falta, con
// palabras. Números inventados (D-24).
import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import type { FilaCartera, VistaCartera } from '@/lib/vistas/contratos'
import { ejemploCartera } from '@/lib/vistas/ejemplo'
import { lecturaPlana, validarLectura } from '@/components/pantalla/lectura'
import { extremos, lecturaPosiciones } from './lectura'

const c = (valor: string | null): CalcVista => (valor === null ? { valor: null, motivo: 'falta', formula: 'sin dato', insumos: [], etiquetas: [] } : { valor, formula: valor, insumos: [], etiquetas: [] })

/** Lo mínimo de una fila que usan la lectura y los extremos. */
const f = (ticker: string, ars: string | null, pct: [string | null, string | null] = [null, null], tipo = 'cedear'): FilaCartera =>
  ({ ticker, tipo, resultado: { ars: c(ars), usd: c(null) }, resultado_pct: { ars: c(pct[0]), usd: c(pct[1]) } }) as unknown as FilaCartera

function leer(filas: FilaCartera[], total?: string | null): string {
  const suma = filas.reduce((a, x) => (a === null || x.tipo === 'liquidez' || x.resultado.ars.valor === null ? a : a + Number(x.resultado.ars.valor)), 0 as number | null)
  const v = { filas, totales: { resultado: { ars: c(total === undefined ? String(suma) : total), usd: c(null) } } } as unknown as Pick<VistaCartera, 'filas' | 'totales'>
  const p = lecturaPosiciones(v)
  expect(validarLectura(p)).toEqual({ ok: true })
  return lecturaPlana(p)
}

describe('lecturaPosiciones', () => {
  it('con el ejemplo: cuántas posiciones y cuál explica más de lo que ganaste', () => {
    const p = lecturaPosiciones(ejemploCartera())
    expect(lecturaPlana(p)).toBe('Seis posiciones. SPY explica casi tres cuartos de lo que ganaste en pesos.')
    expect(p.filter((x) => x.enfasis).map((x) => x.texto)).toEqual(['tres cuartos'])
  })

  it('con pérdida, "de lo que perdiste"; si una sola explica todo, lo dice', () => {
    expect(leer([f('A', '-30'), f('B', '-70')])).toBe('Dos posiciones. B explica más de dos tercios de lo que perdiste en pesos.')
    expect(leer([f('A', '100'), f('B', '0')])).toBe('Dos posiciones. A explica todo lo que ganaste en pesos.')
    expect(leer([f('A', '1000')])).toBe('Una posición. A explica todo lo que ganaste en pesos.')
  })

  it('una que ganó más que todo junto: el resto restó', () => {
    expect(leer([f('A', '150'), f('B', '-50')])).toBe('Dos posiciones. A ganó más que todo lo que ganaste en pesos: el resto restó.')
    expect(leer([f('A', '-150'), f('B', '50')])).toBe('Dos posiciones. A perdió más que todo lo que perdiste en pesos: el resto sumó.')
  })

  it('ni ganaste ni perdiste', () => {
    expect(leer([f('A', '50'), f('B', '-50')])).toBe('Dos posiciones. En pesos, por ahora, ni ganaste ni perdiste.')
  })

  it('al resultado le falta una fila: cuál, nunca un cero', () => {
    expect(leer([f('A', '50'), f('B', null)], null)).toBe('Dos posiciones. Al resultado en pesos le falta un dato: B.')
    expect(leer([f('A', null), f('B', null), f('C', '5')], null)).toBe('Tres posiciones. Al resultado en pesos le faltan datos: A y B.')
  })

  it('la liquidez no es una posición; sin posiciones, lo dice', () => {
    expect(leer([f('A', '100'), f('Pesos', null, [null, null], 'liquidez')])).toBe('Una posición. A explica todo lo que ganaste en pesos.')
    expect(leer([f('Pesos', null, [null, null], 'liquidez')])).toBe('Todavía no tenés posiciones: aparecen con tu primera carga.')
  })
})

describe('extremos: la mejor (en pesos, %) y la peor en dólares (%)', () => {
  it('con el ejemplo: SPY y T30J7', () => {
    const { mejor, peorUsd } = extremos(ejemploCartera().filas)
    expect([mejor?.ticker, peorUsd?.ticker]).toEqual(['SPY', 'T30J7'])
  })

  it('solo las que tienen el dato; la liquidez no cuenta; sin ninguna, null', () => {
    const filas = [f('A', '1', ['0.1', null]), f('B', '1', [null, '-0.2']), f('C', '1', ['0.3', '0.05']), f('Pesos', null, ['9', '-9'], 'liquidez')]
    const { mejor, peorUsd } = extremos(filas)
    expect([mejor?.ticker, peorUsd?.ticker]).toEqual(['C', 'B'])
    expect(extremos([f('A', null)])).toEqual({ mejor: null, peorUsd: null })
  })
})
