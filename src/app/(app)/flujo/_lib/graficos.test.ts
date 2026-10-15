import { describe, expect, it } from 'vitest'
import { tieneTorta } from '@/components/graficos/tema'
import { proyectar } from '@/lib/domain/flujo/proyeccion'
import { completarConIgual } from '@/lib/domain/flujo/supuestos'
import type { MesProyectado } from '@/lib/domain/flujo/tipos'
import { ejemploFlujo } from '@/lib/vistas/ejemplo-flujo'
import { indiceHoy, numeroDe, opcionFlujoMensual, opcionPatrimonio, tablaFlujoMensual, tablaPatrimonio } from './graficos'

// Los datos del gráfico son los de la vista: mismo largo, ningún NaN, null
// donde hay "sin dato" (nunca 0), sin tortas, y nada de montos en el modo privado.

const v = ejemploFlujo('completo')
const base = v.base!
const meses = proyectar(base, { ...completarConIgual(v.supuestos_iniciales, base), horizonte_meses: 12 }).meses

type Serie = { name: string; type: string; data: ({ value: number | null } | number | null)[] }
const series = (o: Record<string, unknown>) => o.series as Serie[]
const valores = (s: Serie) => s.data.map((d) => (d !== null && typeof d === 'object' ? d.value : d))

describe('gráficos de Flujo', () => {
  it('flujo mensual: una barra por mes y por línea, gastos y cuota abajo del cero, la línea del excedente', () => {
    const o = opcionFlujoMensual(meses, 'ARS', { privado: false })
    expect(tieneTorta(o)).toBe(false)
    expect((o.xAxis as { data: string[] }).data).toHaveLength(meses.length)
    for (const s of series(o)) {
      expect(s.data).toHaveLength(meses.length)
      for (const x of valores(s)) expect(x === null || Number.isFinite(x)).toBe(true)
    }
    const [ing, , gas, cuota, exc] = series(o)
    expect(valores(ing)[1]).toBe(Number(meses[1].ingresos.ars))
    expect(valores(gas)[1]).toBe(-Number(meses[1].gastos.ars))
    expect(valores(cuota)[1]).toBe(-Number(meses[1].cuota.ars))
    expect(exc.type).toBe('line')
    expect(valores(exc)).toEqual(meses.map((m) => Number(m.excedente.ars)))
  })

  it('"sin dato" es un hueco, nunca 0', () => {
    const conHueco: MesProyectado[] = meses.map((m, i) => (i === 2 ? { ...m, excedente: { ars: null, usd: null } } : m))
    const o = opcionFlujoMensual(conHueco, 'USD', { privado: false })
    expect(valores(series(o)[4])[2]).toBeNull()
    expect(numeroDe({ ars: null, usd: '1' }, 'ARS')).toBeNull()
    expect(tablaFlujoMensual(conHueco, 'USD', false).filas[2][5]).toBe('sin dato')
  })

  it('lo proyectado va rayado y la línea de hoy cae en el primer mes proyectado', () => {
    const o = opcionFlujoMensual(meses, 'ARS', { privado: false })
    const d = series(o)[0].data[1] as { itemStyle?: { decal?: unknown } }
    expect(d.itemStyle?.decal).toBeTruthy()
    expect(indiceHoy(meses)).toBe(0)
    expect(indiceHoy([{ ...meses[0], real: true }, ...meses.slice(1)])).toBe(1)
  })

  it('en el modo privado no hay montos: ni en el eje, ni en el tooltip, ni en la tabla', () => {
    const o = opcionFlujoMensual(meses, 'ARS', { privado: true })
    const eje = (o.yAxis as { axisLabel: { formatter: (v: number) => string } }).axisLabel.formatter(5000000)
    const tip = (o.tooltip as { valueFormatter: (v: number) => string }).valueFormatter(5000000)
    expect(eje).not.toMatch(/\d/)
    expect(tip).not.toMatch(/\d/)
    for (const f of tablaFlujoMensual(meses, 'ARS', true).filas) for (const c of f.slice(1)) expect(c).not.toMatch(/\$\s?\d/)
    expect(tablaFlujoMensual(meses, 'ARS', false).filas[0][1]).toMatch(/^\$ \d/)
  })

  it('patrimonio: financiero y neto sin la camioneta; al comparar, una línea por escenario con trazos distintos', () => {
    const una = opcionPatrimonio([{ nombre: 'A', meses, trazo: 'solid' }], 'USD', { privado: false })
    expect(tieneTorta(una)).toBe(false)
    expect(series(una).map((s) => s.name)).toEqual(['Financiero', 'Neto sin la camioneta'])
    expect(valores(series(una)[0])).toEqual(meses.map((m) => Number(m.financiero.usd)))
    expect(series(una).map((s) => (s as unknown as { lineStyle: { type: string } }).lineStyle.type)).toEqual(['dashed', 'dotted'])
    // Con meses reales: sólido hasta hoy y rayado desde el último dato real (se tocan en ese mes).
    const conReal = meses.map((m, i) => (i < 2 ? { ...m, real: true } : m))
    const mixto = series(opcionPatrimonio([{ nombre: 'A', meses: conReal, trazo: 'solid' }], 'ARS', { privado: false }))
    expect(mixto.map((s) => s.name)).toEqual(['Financiero', 'Neto sin la camioneta', 'Financiero', 'Neto sin la camioneta'])
    expect(valores(mixto[0]).slice(0, 3)).toEqual([Number(meses[0].financiero.ars), Number(meses[1].financiero.ars), null])
    expect(valores(mixto[2])[0]).toBeNull()
    expect(valores(mixto[2])[1]).toBe(Number(meses[1].financiero.ars))
    const tres = opcionPatrimonio(
      [
        { nombre: 'A', meses, trazo: 'solid' },
        { nombre: 'B', meses, trazo: 'dashed' },
        { nombre: 'C', meses, trazo: 'dotted' },
      ],
      'ARS',
      { privado: false },
    )
    expect(series(tres).map((s) => (s as unknown as { lineStyle: { type: string } }).lineStyle.type)).toEqual(['solid', 'dashed', 'dotted'])
    expect(tablaPatrimonio([{ nombre: 'A', meses, trazo: 'solid' }], 'ARS', false).filas).toHaveLength(meses.length)
  })
})
