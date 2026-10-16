import { describe, expect, it } from 'vitest'
import { tieneTorta } from '@/components/graficos/tema'
import { proyectar } from '@/lib/domain/flujo/proyeccion'
import { completarConIgual } from '@/lib/domain/flujo/supuestos'
import type { MesProyectado } from '@/lib/domain/flujo/tipos'
import { ejemploFlujo } from '@/lib/vistas/ejemplo-flujo'
import { cascada } from './cascada'
import { colorPaso, etiquetaPaso, indiceHoy, numeroDe, opcionCascada, opcionFlujoMensual, opcionPatrimonio, opcionPatrimonioUsd, pasoEje, tablaFlujoMensual, tablaPatrimonio, TODO_IGUAL } from './graficos'

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

  it('patrimonio: financiero (sólida) y neto sin la camioneta (punteada); con "Todo igual", su financiero rayado; al comparar, una línea por escenario', () => {
    const una = opcionPatrimonio([{ nombre: 'A', meses, trazo: 'solid' }], 'USD', { privado: false })
    expect(tieneTorta(una)).toBe(false)
    expect(series(una).map((s) => s.name)).toEqual(['Financiero', 'Neto sin la camioneta'])
    expect(valores(series(una)[0])).toEqual(meses.map((m) => Number(m.financiero.usd)))
    expect(series(una).map((s) => (s as unknown as { lineStyle: { type: string } }).lineStyle.type)).toEqual(['solid', 'dotted'])
    const otro = proyectar(base, { ...completarConIgual(v.supuestos_iniciales, base), horizonte_meses: 12, devaluacion: [{ dir: 'sube', valor: '2.0', hasta_mes: null }] }).meses
    const conRef = series(opcionPatrimonio([{ nombre: 'A', meses: otro, trazo: 'solid' }], 'USD', { privado: false, referencia: meses }))
    expect(conRef.map((s) => s.name)).toEqual(['Financiero', TODO_IGUAL, 'Neto sin la camioneta'])
    expect(valores(conRef[1])).toEqual(meses.map((m) => Number(m.financiero.usd)))
    expect(tablaPatrimonio([{ nombre: 'A', meses: otro, trazo: 'solid' }], 'USD', false, meses).columnas).toEqual(['Mes', 'Financiero', 'Financiero · todo igual', 'Neto sin la camioneta'])
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

describe('la cascada del mes como gráfico (handoff, captura 10)', () => {
  const mes = v.mes_actual!
  const c = cascada(mes)

  it('un excedente negativo va bajo el cero, en sangría', () => {
    const neg = cascada({ ...mes, gastos: { ...mes.gastos, ars: { ...mes.gastos.ars, valor: '9000000' } }, excedente: { ...mes.excedente, ars: { ...mes.excedente.ars, valor: '-3633200' } } })
    const e = neg.barras!.at(-1)!
    expect(e).toMatchObject({ desde: -3633200, hasta: 0 })
    expect(colorPaso(e)).toBe('tema:acento')
    expect(colorPaso({ clave: 'excedente', valor: 1 })).toBe('tema:positivo')
    const o = opcionCascada(neg.barras!, false)
    const visibles = (o.opcion.series as { name: string; data: { value: number }[] }[]).filter((s) => s.name.startsWith('Paso'))
    // La barra del excedente va entera en la serie de abajo del cero.
    expect(visibles[0].data.at(-1)!.value).toBe(0)
    expect(visibles[1].data.at(-1)!.value).toBe(-3633200)
  })

  it('el monto arriba de cada barra, como en el diseño (en millones, con dos decimales); en el modo privado, •••', () => {
    expect(etiquetaPaso(4_832_000, false)).toBe('4,83 M')
    expect(etiquetaPaso(900_000, true)).toBe('+0,90 M')
    expect(etiquetaPaso(-420_000, true)).toBe('−0,42 M')
    expect(etiquetaPaso(-2_650_000, true)).toBe('−2,65 M')
    expect(etiquetaPaso(-999_600, true)).toBe('−1,00 M')
    // Debajo de $ 10.000, en miles o entero (un cero de millones no dice nada).
    expect(etiquetaPaso(8_500, true)).toBe('+8,5k')
    expect(etiquetaPaso(-640, true)).toBe('−640')
    const o = opcionCascada(c.barras!, false)
    expect(tieneTorta(o.opcion)).toBe(false)
    const paso = (o.opcion.series as { name: string; data: { label: { show: boolean; formatter?: () => string } }[] }[])[1]
    expect(paso.data[0].label.formatter!()).toBe(etiquetaPaso(c.barras![0].valor, false))
    expect(paso.data[2].label.formatter!()).toMatch(/^−/)
    const privada = opcionCascada(c.barras!, true)
    const pasoP = (privada.opcion.series as { data: { label: { formatter?: () => string } }[] }[])[1]
    expect(pasoP.data[0].label.formatter!()).toBe('•••')
    for (const f of privada.tabla.filas) for (const x of f.slice(1)) expect(x).not.toMatch(/\d/)
    expect(o.tabla.columnas).toEqual(['Paso', 'En pesos', 'En dólares'])
    expect(o.tabla.filas[2][1]).toMatch(/^−\$ /)
  })
})

describe('el patrimonio en dólares (handoff, captura 10): un solo camino, sin abanico', () => {
  it('el financiero del escenario (la línea de la mediana del diseño), "Todo igual" rayada y lo que pusiste rayada 4 4; ninguna banda', () => {
    const otro = proyectar(base, { ...completarConIgual(v.supuestos_iniciales, base), horizonte_meses: 12, retorno: { ...v.supuestos_iniciales.retorno, cedear: { dir: 'sube', valor: '10.0' }, accion_local: { dir: 'igual', valor: null }, liquidez_pesos: { dir: 'igual', valor: null } } }).meses
    const { opcion, tabla } = opcionPatrimonioUsd(otro, { privado: false, nombre: 'Con tus supuestos', referencia: meses })
    const ss = series(opcion)
    expect(ss.map((s) => s.name)).toEqual(['Con tus supuestos', TODO_IGUAL, 'Lo que pusiste'])
    expect(valores(ss[0])).toEqual(otro.map((m) => Number(m.financiero.usd)))
    expect(valores(ss[1])).toEqual(meses.map((m) => Number(m.financiero.usd)))
    expect(valores(ss[2])).toEqual(otro.map((m) => Number(m.aportado!.usd)))
    expect((ss[0] as unknown as { lineStyle: { width: number; type?: unknown } }).lineStyle).toMatchObject({ width: 2.5, color: 'tema:vizFuerte' })
    expect((ss[0] as unknown as { lineStyle: { type?: unknown } }).lineStyle.type).toBeUndefined()
    expect((ss[1] as unknown as { lineStyle: { type: number[] } }).lineStyle.type).toEqual([6, 4])
    expect((ss[2] as unknown as { lineStyle: { type: number[]; color: string } }).lineStyle).toMatchObject({ type: [4, 4], color: 'tema:tenue' })
    // Sin bandas: ninguna serie apilada ni de "rango".
    expect(ss.every((s) => !('stack' in s))).toBe(true)
    expect(tabla.columnas).toEqual(['Mes', 'Financiero · Con tus supuestos', 'Financiero · todo igual', 'Lo que pusiste'])
    const sinRef = opcionPatrimonioUsd(meses, { privado: false, nombre: 'Todo igual' })
    expect(series(sinRef.opcion).map((s) => s.name)).toEqual(['Todo igual', 'Lo que pusiste'])
  })

  it('el eje: Hoy y los meses que pasan, cada tanto, de borde a borde; sin eje de montos, como en el diseño; en el modo privado, sin montos', () => {
    expect([pasoEje(6), pasoEje(12), pasoEje(24), pasoEje(36)]).toEqual([1, 3, 6, 12])
    const { opcion, tabla } = opcionPatrimonioUsd(meses, { privado: true, nombre: 'Todo igual' })
    const x = opcion.xAxis as { axisLabel: { interval: (i: number) => boolean; formatter: (v: string, i: number) => string; alignMinLabel: string; alignMaxLabel: string } }
    expect(x.axisLabel.formatter('oct-26', 0)).toBe('Hoy')
    expect(x.axisLabel.formatter('ene-27', 3)).toBe('3 m')
    expect(x.axisLabel.interval(3)).toBe(true)
    expect(x.axisLabel.interval(4)).toBe(false)
    expect([x.axisLabel.alignMinLabel, x.axisLabel.alignMaxLabel]).toEqual(['left', 'right'])
    // El eje de los montos no se dibuja (ni etiquetas ni grilla); si alguna vez se muestra, en el modo privado no tiene montos.
    const y = opcion.yAxis as { show: boolean; splitLine: { show: boolean }; axisLabel: { show: boolean; formatter: (v: number) => string } }
    expect([y.show, y.splitLine.show, y.axisLabel.show]).toEqual([false, false, false])
    expect(y.axisLabel.formatter(90000)).toBe('•••')
    expect((opcion.tooltip as { valueFormatter: (v: number) => string }).valueFormatter(90000)).toBe('•••')
    for (const f of tabla.filas) for (const c of f.slice(1)) expect(c).not.toMatch(/\d/)
  })
})
