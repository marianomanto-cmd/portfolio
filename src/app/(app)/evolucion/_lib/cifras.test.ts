import { describe, expect, it } from 'vitest'
import { lecturaPlana } from '@/components/pantalla/lectura'
import type { CalcVista } from '@/lib/domain/calc'
import { ejemploEvolucion } from '@/lib/vistas/ejemplo-evolucion'
import { cifrasEvolucion, cociente } from './cifras'
import { leerParametros } from './parametros'

const c = (valor: string | null, etiquetas: CalcVista['etiquetas'] = []): CalcVista => ({ valor, formula: 'x', insumos: [], etiquetas, motivo: valor === null ? 'Falta el CCL de compra de YPFD.' : undefined })

describe('las cuatro cifras clave de Evolución', () => {
  it('el cociente lleva la fórmula con los dos valores, sus insumos con su traza y las etiquetas de los dos', () => {
    const q = cociente(c('4670000'), c('19780000', ['estimado']), { m: 'ARS', nombreA: 'Resultado', nombreB: 'Patrimonio al inicio', explicacion: 'e', positivoB: true })
    expect(q.formula).toBe('+$ 4.670.000,00 ÷ $ 19.780.000,00 = +23,61%')
    expect(q.insumos.map((i) => i.nombre)).toEqual(['Resultado', 'Patrimonio al inicio'])
    expect(q.insumos[1].calc?.valor).toBe('19780000')
    expect(q.etiquetas).toContain('estimado')
    expect(cociente(c(null), c('1'), { m: 'ARS', nombreA: 'A', nombreB: 'B', explicacion: 'e' }).motivo).toBe('Falta el CCL de compra de YPFD.')
    expect(cociente(c('1'), c('0'), { m: 'ARS', nombreA: 'A', nombreB: 'B', explicacion: 'e' }).valor).toBeNull()
    expect(cociente(c('1'), c('-5'), { m: 'ARS', nombreA: 'A', nombreB: 'B', explicacion: 'e', positivoB: true }).valor).toBeNull()
  })

  it('con un mes (demo inventado): resultado en pesos y en dólares, activos y tipo de cambio, con sus notas trazables', () => {
    const v = ejemploEvolucion(leerParametros({}), 'mes')
    const cs = cifrasEvolucion(v)
    expect(cs.map((x) => x.rotulo)).toEqual(['Resultado en pesos', 'Resultado en dólares', 'De tus activos', 'Del tipo de cambio'])
    expect(cs[0].principal.calc).toBe(v.totales!.resultado.ars)
    expect(cs[2].secundaria?.calc).toBe(v.totales!.activo.usd)
    // Las notas: cada cifra con su traza, que dice de qué sale.
    for (const x of cs) {
      for (const p of x.nota.filter((n) => n.calc)) expect(p.calc!.valor === null ? p.calc!.motivo : p.calc!.formula).toBeTruthy()
    }
    expect(lecturaPlana(cs[0].nota)).toMatch(/^[+−]\d+,\d% sobre lo que tenías al /)
    expect(lecturaPlana(cs[3].nota)).toMatch(/^[+−]?\d+,\d% · CCL de [\d.]+ a [\d.]+$/)
    // La parte del activo y la del tipo de cambio suman lo que no queda sin atribuir.
    const partes = cs.slice(2).map((x) => Number(x.nota.find((n) => n.calc)!.calc!.valor))
    const sin = Number(v.totales!.sin_atribuir.ars.valor) / Number(v.totales!.resultado.ars.valor)
    expect(partes[0] + partes[1] + sin).toBeCloseTo(1, 9)
  })

  it('con un solo día o sin cargas: "sin dato" con el porqué, nunca cero', () => {
    for (const demo of ['un-dia', 'vacio'] as const) {
      const cs = cifrasEvolucion(ejemploEvolucion(leerParametros({}), demo))
      for (const x of cs) {
        expect(x.principal.calc.valor).toBeNull()
        expect(lecturaPlana(x.nota)).toBe(demo === 'vacio' ? 'Todavía no hay cargas.' : 'Necesita una segunda carga: con una sola no hay período que comparar.')
      }
    }
  })
})
