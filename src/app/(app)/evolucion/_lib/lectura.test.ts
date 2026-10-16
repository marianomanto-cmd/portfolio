import { describe, expect, it } from 'vitest'
import { lecturaPlana, validarLectura } from '@/components/pantalla/lectura'
import type { CalcVista } from '@/lib/domain/calc'
import type { TotalesResultado } from '@/lib/vistas/contratos-evolucion'
import { ejemploEvolucion } from '@/lib/vistas/ejemplo-evolucion'
import { lecturaEvolucion } from './lectura'
import { leerParametros } from './parametros'

const c = (valor: string | null): CalcVista => ({ valor, formula: valor === null ? 'sin dato' : `x = ${valor}`, insumos: [], etiquetas: [], motivo: valor === null ? 'Falta.' : undefined })
const par = (ars: string | null, usd: string | null) => ({ ars: c(ars), usd: c(usd) })
const totales = (r: [string | null, string | null], activo: string | null, tc: string | null, sin = '0'): TotalesResultado => ({
  resultado: par(...r),
  activo: par(activo, activo),
  tc: par(tc, tc),
  sin_atribuir: par(sin, sin),
  realizado: par('0', '0'),
  no_realizado: par('0', '0'),
})
const periodo = (t: TotalesResultado) => ({ estado: 'periodo' as const, primera: '2026-10-01', totales: t })

describe('la lectura de Evolución', () => {
  it('ganaste en pesos y perdiste en dólares: eso primero, con el énfasis en "perdiste"', () => {
    const l = lecturaEvolucion(periodo(totales(['4670000', '-654'], '2550000', '2120000')))
    expect(validarLectura(l)).toEqual({ ok: true })
    expect(lecturaPlana(l)).toBe('En el período ganaste $ 4.670.000 en pesos, pero en dólares perdiste: US$ 654.')
    expect(l.find((p) => p.enfasis)?.texto).toBe('perdiste')
    expect(l.filter((p) => p.calc).map((p) => p.calc?.valor)).toEqual(['4670000', '-654'])
  })

  it('ganaste en las dos: quién puso la mayor parte, el dólar o tus activos', () => {
    expect(lecturaPlana(lecturaEvolucion(periodo(totales(['100', '1'], '30', '70'))))).toBe('En el período ganaste $ 100 en pesos y US$ 1 en dólares; la mayor parte la puso el dólar.')
    expect(lecturaPlana(lecturaEvolucion(periodo(totales(['100', '1'], '70', '30'))))).toBe('En el período ganaste $ 100 en pesos y US$ 1 en dólares; la mayor parte la pusieron tus activos.')
    expect(lecturaPlana(lecturaEvolucion(periodo(totales(['-100', '-1'], '-70', '-30'))))).toContain('perdiste $ 100 en pesos y US$ 1 en dólares; la mayor parte vino de tus activos.')
    expect(lecturaPlana(lecturaEvolucion(periodo(totales(['100', '1'], '10', '10', '80'))))).toContain('la mayor parte, sin atribuir')
    // "La mayor parte" es la más grande de las tres, aunque ninguna llegue a la mitad.
    expect(lecturaPlana(lecturaEvolucion(periodo(totales(['100', '1'], '30', '31', '39'))))).toContain('la mayor parte, sin atribuir')
    expect(lecturaPlana(lecturaEvolucion(periodo(totales(['100', '1'], '30', '40', '30'))))).toContain('la mayor parte la puso el dólar')
  })

  it('cuando falta algo lo dice con palabras; un solo énfasis siempre', () => {
    const casos = [
      lecturaEvolucion(periodo(totales(['100', null], '50', '50'))),
      lecturaEvolucion(periodo(totales([null, null], null, null))),
      lecturaEvolucion(periodo(totales(['0', '0'], '0', '0'))),
      lecturaEvolucion({ estado: 'un_dia', primera: '2026-10-01', totales: null }),
      lecturaEvolucion({ estado: 'sin_cargas', primera: null, totales: null }),
    ]
    for (const l of casos) {
      expect(validarLectura(l)).toEqual({ ok: true })
      expect(lecturaPlana(l)).not.toMatch(/sin dato|\$ 0\b/)
    }
    expect(lecturaPlana(casos[0])).toBe('En el período ganaste $ 100 en pesos; en dólares, el resultado todavía no se calcula: falta un dato.')
    expect(lecturaPlana(casos[3])).toBe('Tu historia empieza el jue 01/10: con tu próxima carga vas a ver qué cambió y por qué.')
    expect(lecturaPlana(casos[4])).toBe('Todavía no hay cargas: tu evolución arranca con la primera.')
  })

  it('con los demos (inventados), en cada estado, una lectura válida', () => {
    for (const demo of ['vacio', 'un-dia', 'semana', 'mes', null] as const) {
      for (const vista of ['financiero', 'total']) {
        const v = ejemploEvolucion(leerParametros({ vista }), demo)
        expect(validarLectura(lecturaEvolucion(v)), `${demo} ${vista}`).toEqual({ ok: true })
      }
    }
  })
})
