import { describe, expect, it } from 'vitest'
import { POR_DEFECTO } from './parametros'
import { gruposOrdenados, ordenar, ORDEN_INICIAL, siguienteOrden } from './orden'
import { ejemploEvolucion } from '@/lib/vistas/ejemplo-evolucion'

const v = ejemploEvolucion(POR_DEFECTO, 'mes')
const num = (x: string | null) => (x === null ? null : Number(x))

describe('ordenar la tabla de resultados', () => {
  it('por resultado, de mayor a menor en la moneda que mirás; "no aplica" y "sin dato" al final', () => {
    const xs = ordenar(v.filas, ORDEN_INICIAL, 'ars')
    const vals = xs.map((f) => num(f.resultado.ars.valor))
    const conocidos = vals.filter((x): x is number => x !== null)
    expect(conocidos).toEqual([...conocidos].sort((a, b) => b - a))
    expect(vals.slice(conocidos.length).every((x) => x === null)).toBe(true)
    // Realizado: la liquidez ("no aplica") va al final aunque el sentido cambie.
    for (const desc of [true, false]) {
      const r = ordenar(v.filas, { col: 'realizado', desc }, 'usd')
      const primeraNoAplica = r.findIndex((f) => f.realizado === null)
      expect(primeraNoAplica).toBeGreaterThan(0)
      expect(r.slice(primeraNoAplica).every((f) => f.realizado === null)).toBe(true)
    }
    expect(v.filas).not.toBe(xs)
  })

  it('tocar la misma columna da vuelta el sentido; una nueva arranca de mayor a menor (el nombre, de la A a la Z)', () => {
    expect(siguienteOrden(ORDEN_INICIAL, 'resultado')).toEqual({ col: 'resultado', desc: false })
    expect(siguienteOrden(ORDEN_INICIAL, 'tc')).toEqual({ col: 'tc', desc: true })
    expect(siguienteOrden(ORDEN_INICIAL, 'nombre')).toEqual({ col: 'nombre', desc: false })
  })

  it('agrupado: cada fila en su grupo, los grupos ordenados por su subtotal', () => {
    for (const por of ['cuenta', 'activo'] as const) {
      const gs = gruposOrdenados(v.grupos[por], v.filas, ORDEN_INICIAL, 'ars')
      expect(gs.flatMap((g) => g.filas.map((f) => f.clave)).sort()).toEqual(v.filas.map((f) => f.clave).sort())
      const subt = gs.map((g) => num(g.grupo.resultado.ars.valor)).filter((x): x is number => x !== null)
      expect(subt).toEqual([...subt].sort((a, b) => b - a))
    }
    expect(v.grupos.cuenta.map((g) => g.nombre)).toEqual(expect.arrayContaining(['IEB', 'Mercado Pago']))
  })
})
