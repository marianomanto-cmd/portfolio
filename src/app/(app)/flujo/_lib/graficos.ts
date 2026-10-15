// Opciones de ECharts de Flujo y escenarios (plan §6 D.5, §8). Funciones puras
// con test: el envoltorio compartido (components/graficos/grafico.tsx) solo
// dibuja. Reglas: sin tortas; "sin dato" es null (un hueco), nunca 0; lo
// proyectado se ve distinto de lo real (rayado y más claro) con la línea de
// "hoy"; una moneda por eje; en el modo privado no se ven los montos (ni en el
// eje, ni en el tooltip, ni en la tabla).

import { compacto, monto } from '@/lib/domain/dinero'
import { nombreMes } from '@/lib/domain/flujo/proyeccion'
import type { MesProyectado, ParNum } from '@/lib/domain/flujo/tipos'
import type { TablaGrafico } from '@/components/graficos/grafico'

type Moneda = 'ARS' | 'USD'
type Opcion = Record<string, unknown>

const OCULTO = '•••'

/** El número de un ParNum para el gráfico: null es un hueco ("sin dato"), nunca 0. */
export function numeroDe(p: ParNum, moneda: Moneda, signo: 1 | -1 = 1): number | null {
  const v = moneda === 'ARS' ? p.ars : p.usd
  if (v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? (signo === -1 ? -n : n) : null
}

/** Un mes proyectado (no real): va rayado y más claro. */
const esProyectado = (m: MesProyectado) => !m.real

const RAYADO = { symbol: 'rect', symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [3, 4], rotation: Math.PI / 4, color: 'rgba(255,255,255,0.45)' }

/** Colores de las líneas del flujo: neutros (verde y rojo quedan para resultados). */
export const COLOR_FLUJO = {
  ingresos: '#2f5bd3',
  vencimientos: '#0f8b8d',
  gastos: '#8a8f98',
  cuota: '#c2621f',
  excedente: '#121722',
}

function barras(meses: readonly MesProyectado[], nombre: string, color: string, valor: (m: MesProyectado) => number | null) {
  return {
    name: nombre,
    type: 'bar',
    stack: 'flujo',
    barMaxWidth: 28,
    itemStyle: { color },
    emphasis: { focus: 'series' },
    data: meses.map((m) => ({
      value: valor(m),
      itemStyle: esProyectado(m) ? { opacity: 0.7, decal: RAYADO } : undefined,
    })),
  }
}

/** Índice del primer mes proyectado (la línea de "hoy"); null si son todos reales o todos proyectados desde el 0. */
export function indiceHoy(meses: readonly MesProyectado[]): number {
  const i = meses.findIndex((m) => !m.real)
  return i < 0 ? meses.length - 1 : i
}

function formateador(moneda: Moneda, privado: boolean) {
  return (v: number | null | undefined) => (v === null || v === undefined ? 'sin dato' : privado ? OCULTO : monto(String(v), moneda, { decimales: moneda === 'ARS' ? 0 : 2 }))
}

/**
 * Flujo mensual: entradas arriba del cero (ingresos, vencimientos), salidas
 * abajo (gastos, cuota), y la línea del excedente. Lo proyectado, rayado.
 */
export function opcionFlujoMensual(meses: readonly MesProyectado[], moneda: Moneda, opciones: { privado: boolean; colorTexto?: string; movil?: boolean }): Opcion {
  const fmt = formateador(moneda, opciones.privado)
  const hoy = indiceHoy(meses)
  return {
    // Sin animación: el gráfico sigue al deslizante y una animación por movimiento lo traba.
    animation: false,
    aria: { enabled: true, decal: { show: false } },
    legend: { top: 0, data: ['Ingresos', 'Vencimientos', 'Gastos', 'Cuota', 'Excedente'] },
    // En el teléfono la leyenda va abajo y ocupa dos renglones.
    grid: opciones.movil ? { top: 16, bottom: 76 } : { top: 36 },
    tooltip: { trigger: 'axis', valueFormatter: fmt },
    xAxis: { type: 'category', data: meses.map((m) => nombreMes(m.mes)) },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => (opciones.privado ? OCULTO : compacto(String(v), moneda)) },
    },
    series: [
      barras(meses, 'Ingresos', COLOR_FLUJO.ingresos, (m) => numeroDe(m.ingresos, moneda)),
      barras(meses, 'Vencimientos', COLOR_FLUJO.vencimientos, (m) => numeroDe(m.vencimientos, moneda)),
      barras(meses, 'Gastos', COLOR_FLUJO.gastos, (m) => numeroDe(m.gastos, moneda, -1)),
      barras(meses, 'Cuota', COLOR_FLUJO.cuota, (m) => numeroDe(m.cuota, moneda, -1)),
      {
        name: 'Excedente',
        type: 'line',
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: opciones.colorTexto ?? COLOR_FLUJO.excedente },
        lineStyle: { width: 2, color: opciones.colorTexto ?? COLOR_FLUJO.excedente },
        data: meses.map((m) => numeroDe(m.excedente, moneda)),
        markLine: meses.length > 1 ? { symbol: 'none', silent: true, label: { formatter: 'hoy', position: 'insideEndTop' }, lineStyle: { type: 'dashed', color: '#8a8f98' }, data: [{ xAxis: hoy }] } : undefined,
      },
    ],
  }
}

/** La misma información, como tabla (lector de pantalla y "Ver como tabla"). */
export function tablaFlujoMensual(meses: readonly MesProyectado[], moneda: Moneda, privado: boolean): TablaGrafico {
  const fmt = formateador(moneda, privado)
  return {
    columnas: ['Mes', 'Ingresos', 'Vencimientos', 'Gastos', 'Cuota', 'Excedente'],
    filas: meses.map((m) => [
      `${nombreMes(m.mes)}${m.real ? ' (real)' : ' (proyectado)'}`,
      fmt(numeroDe(m.ingresos, moneda)),
      fmt(numeroDe(m.vencimientos, moneda)),
      fmt(numeroDe(m.gastos, moneda)),
      fmt(numeroDe(m.cuota, moneda)),
      fmt(numeroDe(m.excedente, moneda)),
    ]),
  }
}

export type Trazo = 'solid' | 'dashed' | 'dotted'

export interface SeriePatrimonio {
  nombre: string
  meses: readonly MesProyectado[]
  trazo: Trazo
}

/** Colores de Comparar (además del trazo, que no depende del color). */
const COLOR_COMPARAR = ['#2f5bd3', '#0f8b8d', '#c2621f']

/** Tres trazos distinguibles sin color (Comparar: sólida, rayada, punteada). */
export const TRAZOS: Trazo[] = ['solid', 'dashed', 'dotted']

/**
 * Patrimonio proyectado: el financiero y el neto sin la camioneta de cada
 * escenario, con el tramo proyectado en gris (markArea) desde hoy. Una moneda
 * por eje. Con varios escenarios (Comparar), solo el financiero, uno por trazo.
 */
export function opcionPatrimonio(series: readonly SeriePatrimonio[], moneda: Moneda, opciones: { privado: boolean; movil?: boolean }): Opcion {
  const fmt = formateador(moneda, opciones.privado)
  const base = series[0]?.meses ?? []
  const hoy = indiceHoy(base)
  const comparar = series.length > 1
  const hayReal = base.some((m) => m.real)
  // Lo real, sólido hasta hoy; lo proyectado, rayado (financiero) o punteado (neto) desde el último dato real.
  const tramo = (vals: (number | null)[], desde: number, hasta: number) => vals.map((v, j) => (j >= desde && j <= hasta ? v : null))
  const lineas = series.flatMap((s, i) => {
    const comun = { type: 'line', symbol: 'none', smooth: false, emphasis: { focus: 'series' } }
    const color = comparar ? COLOR_COMPARAR[i % COLOR_COMPARAR.length] : '#2f5bd3'
    const fin = s.meses.map((m) => numeroDe(m.financiero, moneda))
    const area =
      i === 0 && base.length > 1 ? { silent: true, itemStyle: { color: 'rgba(138,143,152,0.10)' }, data: [[{ xAxis: hoy }, { xAxis: base.length - 1 }]] } : undefined
    if (comparar) {
      return [{ ...comun, name: s.nombre, lineStyle: { width: 2, type: s.trazo, color }, itemStyle: { color }, data: fin, markArea: area }]
    }
    const neto = s.meses.map((m) => numeroDe(m.neto_sin_financiados, moneda))
    const desdeProy = Math.max(0, hoy - 1)
    const proyectadas = [
      { ...comun, name: 'Financiero', lineStyle: { width: 2, type: 'dashed', color }, itemStyle: { color }, data: hayReal ? tramo(fin, desdeProy, base.length - 1) : fin, markArea: area },
      {
        ...comun,
        name: 'Neto sin la camioneta',
        lineStyle: { width: 2, type: 'dotted', color: '#0f8b8d' },
        itemStyle: { color: '#0f8b8d' },
        data: hayReal ? tramo(neto, desdeProy, base.length - 1) : neto,
      },
    ]
    if (!hayReal) return proyectadas
    return [
      { ...comun, name: 'Financiero', lineStyle: { width: 2, type: 'solid', color }, itemStyle: { color }, data: tramo(fin, 0, hoy - 1) },
      { ...comun, name: 'Neto sin la camioneta', lineStyle: { width: 2, type: 'solid', color: '#0f8b8d' }, itemStyle: { color: '#0f8b8d' }, data: tramo(neto, 0, hoy - 1) },
      ...proyectadas,
    ]
  })
  return {
    animation: false,
    aria: { enabled: true },
    legend: { top: 0 },
    grid: opciones.movil ? { top: 16, bottom: series.length > 1 ? 76 : 48 } : { top: 36 },
    tooltip: { trigger: 'axis', valueFormatter: fmt },
    xAxis: { type: 'category', boundaryGap: false, data: base.map((m) => nombreMes(m.mes)) },
    yAxis: { type: 'value', scale: true, axisLabel: { formatter: (v: number) => (opciones.privado ? OCULTO : compacto(String(v), moneda)) } },
    series: lineas,
  }
}

export function tablaPatrimonio(series: readonly SeriePatrimonio[], moneda: Moneda, privado: boolean): TablaGrafico {
  const fmt = formateador(moneda, privado)
  const base = series[0]?.meses ?? []
  if (series.length > 1) {
    return {
      columnas: ['Mes', ...series.map((s) => `Financiero · ${s.nombre}`)],
      filas: base.map((m, i) => [nombreMes(m.mes), ...series.map((s) => fmt(s.meses[i] ? numeroDe(s.meses[i].financiero, moneda) : null))]),
    }
  }
  return {
    columnas: ['Mes', 'Financiero', 'Neto sin la camioneta'],
    filas: base.map((m) => [nombreMes(m.mes), fmt(numeroDe(m.financiero, moneda)), fmt(numeroDe(m.neto_sin_financiados, moneda))]),
  }
}
