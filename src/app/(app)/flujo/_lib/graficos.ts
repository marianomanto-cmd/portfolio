// Opciones de ECharts de Flujo y escenarios (plan §6 D.5, §8; D-164). Funciones
// puras con test: el envoltorio compartido (components/graficos/grafico.tsx)
// solo dibuja. Reglas: sin tortas; "sin dato" es null (un hueco), nunca 0; lo
// proyectado se ve distinto de lo real (en el flujo, barras rayadas y más
// claras; en el patrimonio, el fondo gris desde "hoy"); una moneda por eje; en
// el modo privado no se ven los montos (ni en el eje, ni en el tooltip, ni en
// la tabla).

import { compacto, monto, numero } from '@/lib/domain/dinero'
import { nombreMes } from '@/lib/domain/flujo/proyeccion'
import type { MesProyectado, ParNum } from '@/lib/domain/flujo/tipos'
import type { TablaGrafico } from '@/components/graficos/grafico'
import { colorTema, OCULTO } from '@/components/graficos/tema'
import type { BarraCascada } from './cascada'

type Moneda = 'ARS' | 'USD'
type Opcion = Record<string, unknown>


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

/**
 * Colores de las líneas del flujo (sistema visual, D-157): los ingresos en
 * dólares en oro, los vencimientos de la renta fija en piedra, los gastos en
 * lavanda y la cuota del leasing en sangría (deuda). Verde y rojo quedan para
 * resultados. Los colorTema(…) se resuelven al dibujar con el tema vigente.
 */
export const COLOR_FLUJO = {
  ingresos: colorTema('viz'),
  vencimientos: '#C7BDAB',
  gastos: '#8C8696',
  cuota: colorTema('acento'),
  excedente: colorTema('texto'),
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
        markLine: meses.length > 1 ? { symbol: 'none', silent: true, label: { formatter: 'hoy', position: 'insideEndTop' }, lineStyle: { type: 'dashed', color: colorTema('tenue') }, data: [{ xAxis: hoy }] } : undefined,
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
const COLOR_COMPARAR = [colorTema('viz'), colorTema('texto'), '#C7BDAB']

/** Tres trazos distinguibles sin color (Comparar: sólida, rayada, punteada). */
export const TRAZOS: Trazo[] = ['solid', 'dashed', 'dotted']

/** El nombre de la línea de referencia (D-164): el mismo escenario con todas las barras en Igual. */
export const TODO_IGUAL = 'Todo igual'

const COLOR_TODO_IGUAL = colorTema('tenue')

export interface OpcionesPatrimonio {
  privado: boolean
  movil?: boolean
  /**
   * Los meses de "Todo igual" (el mismo escenario con todas las barras en
   * Igual, D-164). Solo cuando el escenario no es todo Igual: es la referencia
   * para ver el efecto de lo que moviste. Una sola serie (Comparar no la usa).
   */
  referencia?: readonly MesProyectado[] | null
}

/**
 * Patrimonio proyectado: el financiero y el neto sin la camioneta del
 * escenario, con el tramo proyectado sobre fondo gris (markArea) desde hoy.
 * Una moneda por eje. El financiero va sólido, como el primero de Comparar;
 * "Todo igual" (su financiero), rayado y gris; el neto, punteado: se
 * distinguen sin color. Con varios escenarios (Comparar), solo el financiero,
 * uno por trazo.
 */
export function opcionPatrimonio(series: readonly SeriePatrimonio[], moneda: Moneda, opciones: OpcionesPatrimonio): Opcion {
  const fmt = formateador(moneda, opciones.privado)
  const base = series[0]?.meses ?? []
  const hoy = indiceHoy(base)
  const comparar = series.length > 1
  const comun = { type: 'line', symbol: 'none', smooth: false, emphasis: { focus: 'series' } }
  const area = base.length > 1 ? { silent: true, itemStyle: { color: colorTema('texto', 0.04) }, data: [[{ xAxis: hoy }, { xAxis: base.length - 1 }]] } : undefined
  const financiero = (meses: readonly MesProyectado[]) => meses.map((m) => numeroDe(m.financiero, moneda))
  let lineas: Opcion[]
  if (comparar) {
    lineas = series.map((s, i) => {
      const color = COLOR_COMPARAR[i % COLOR_COMPARAR.length]
      return { ...comun, name: s.nombre, lineStyle: { width: 2, type: s.trazo, color }, itemStyle: { color }, data: financiero(s.meses), markArea: i === 0 ? area : undefined }
    })
  } else {
    const s = series[0]
    const color = colorTema('viz')
    lineas = s
      ? [
          { ...comun, name: 'Financiero', lineStyle: { width: 2.5, type: 'solid', color }, itemStyle: { color }, data: financiero(s.meses), markArea: area, z: 3 },
          {
            ...comun,
            name: 'Neto sin la camioneta',
            lineStyle: { width: 2, type: 'dotted', color: colorTema('texto') },
            itemStyle: { color: colorTema('texto') },
            data: s.meses.map((m) => numeroDe(m.neto_sin_financiados, moneda)),
          },
        ]
      : []
    const ref = opciones.referencia
    if (s && ref && ref.length) {
      // Mes a mes contra los del escenario (los dos salen de la misma base y el mismo horizonte).
      const datos = s.meses.map((m, i) => (ref[i] && ref[i].mes === m.mes ? numeroDe(ref[i].financiero, moneda) : null))
      lineas.splice(1, 0, {
        ...comun,
        name: TODO_IGUAL,
        lineStyle: { width: 1.5, type: 'dashed', color: COLOR_TODO_IGUAL },
        itemStyle: { color: COLOR_TODO_IGUAL },
        data: datos,
        z: 2,
      })
    }
  }
  const nombres = lineas.map((l) => l.name as string)
  return {
    animation: false,
    aria: { enabled: true },
    legend: { top: 0, data: nombres },
    // En el teléfono la leyenda va abajo: con tres nombres o más, en dos renglones.
    grid: opciones.movil ? { top: 16, bottom: nombres.length > 2 ? 76 : 48 } : { top: 36 },
    tooltip: { trigger: 'axis', valueFormatter: fmt },
    xAxis: { type: 'category', boundaryGap: false, data: base.map((m) => nombreMes(m.mes)) },
    yAxis: { type: 'value', scale: true, axisLabel: { formatter: (v: number) => (opciones.privado ? OCULTO : compacto(String(v), moneda)) } },
    series: lineas,
  }
}

export function tablaPatrimonio(series: readonly SeriePatrimonio[], moneda: Moneda, privado: boolean, referencia?: readonly MesProyectado[] | null): TablaGrafico {
  const fmt = formateador(moneda, privado)
  const base = series[0]?.meses ?? []
  if (series.length > 1) {
    return {
      columnas: ['Mes', ...series.map((s) => `Financiero · ${s.nombre}`)],
      filas: base.map((m, i) => [nombreMes(m.mes), ...series.map((s) => fmt(s.meses[i] ? numeroDe(s.meses[i].financiero, moneda) : null))]),
    }
  }
  const ref = referencia && referencia.length ? referencia : null
  return {
    columnas: ['Mes', 'Financiero', ...(ref ? [`Financiero · ${TODO_IGUAL.toLowerCase()}`] : []), 'Neto sin la camioneta'],
    filas: base.map((m, i) => [
      nombreMes(m.mes),
      fmt(numeroDe(m.financiero, moneda)),
      ...(ref ? [fmt(ref[i] && ref[i].mes === m.mes ? numeroDe(ref[i].financiero, moneda) : null)] : []),
      fmt(numeroDe(m.neto_sin_financiados, moneda)),
    ]),
  }
}

// ───────────── La cascada del mes y el patrimonio en dólares (rediseño del 15/10, D-164) ─────────────

/**
 * Lo que deja la cascada debajo de las barras para los nombres de cada paso:
 * la franja de los nombres (hasta tres renglones de 11 px, o un tocable de 44
 * px con el dedo) más un margen arriba y abajo, para que no toque las barras
 * ni "Ver como tabla".
 */
export const ALTO_NOMBRES = 58
/** El alto de la franja de los nombres, adentro de ALTO_NOMBRES (6 px arriba y 8 abajo). */
export const FRANJA_NOMBRES = { arriba: 6, alto: 44 }

/**
 * El monto de cada paso arriba de su barra, como en el handoff y sin el "$":
 * en millones con dos decimales ("4,83 M", "+0,90 M", "−2,65 M"); debajo de
 * $ 10.000, en miles ("+8,5k") o entero.
 */
export function etiquetaPaso(v: number, conSigno: boolean): string {
  const a = Math.abs(v)
  const cuerpo = a >= 10_000 ? `${numero(String(a / 1_000_000), 2)} M` : a >= 1_000 ? `${numero(String(a / 1_000), 1)}k` : numero(String(a), 0)
  const signo = v < 0 ? '−' : conSigno ? '+' : ''
  return `${signo}${cuerpo}`
}

/** El color de cada paso: dólares en oro, pesos en tinta, el reintegro en piedra, lo que sale en sangría y el excedente en verde (o sangría si es negativo). */
export function colorPaso(b: Pick<BarraCascada, 'clave' | 'valor'>): string {
  switch (b.clave) {
    case 'usd':
      return colorTema('viz')
    case 'pesos':
      return colorTema('texto')
    case 'reintegro':
      return '#C7BDAB'
    case 'excedente':
      return b.valor >= 0 ? colorTema('positivo') : colorTema('acento')
    default:
      return colorTema('acento')
  }
}

/**
 * La cascada como barras apiladas: una base transparente lleva cada paso a su
 * altura. Lo que cruza el cero se parte en su tramo positivo y su tramo
 * negativo (ECharts apila los positivos y los negativos por separado). El
 * monto va arriba de cada barra (en el modo privado, •••); los nombres van
 * debajo, en la pantalla (cada uno abre su traza).
 */
export function opcionCascada(barras: readonly BarraCascada[], privado: boolean): { opcion: Opcion; tabla: TablaGrafico } {
  const cats = barras.map((b) => b.nombre)
  const ultimo = barras.length - 1
  const etiqueta = (b: BarraCascada, i: number) => (privado ? OCULTO : etiquetaPaso(b.valor, i > 0 && i < ultimo))
  // Barras de 70 sobre 98 de cada paso, como en el handoff.
  const base = { type: 'bar', stack: 'cascada', barWidth: '70%', silent: true, tooltip: { show: false }, itemStyle: { color: 'transparent' }, emphasis: { disabled: true } }
  const visible = { type: 'bar', stack: 'cascada', barWidth: '70%', emphasis: { disabled: true } }
  const label = (b: BarraCascada, i: number, arriba: boolean) => ({
    show: true,
    position: arriba ? 'top' : 'bottom',
    formatter: () => etiqueta(b, i),
    color: colorTema('texto'),
    fontSize: 11,
  })
  const positivo = barras.map((b) => (b.desde >= 0 ? b.hasta - b.desde : b.hasta > 0 ? b.hasta : 0))
  const negativo = barras.map((b) => (b.hasta <= 0 ? b.desde - b.hasta : b.desde < 0 ? b.desde : 0))
  const opcion: Opcion = {
    animation: false,
    // Abajo, el lugar de los nombres de cada paso (los pone la pantalla, cada uno con su traza).
    grid: { left: 0, right: 0, top: 24, bottom: ALTO_NOMBRES },
    tooltip: {
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const b = barras[p.dataIndex]
        return b ? `${b.nombre}: ${privado ? OCULTO : monto(String(b.valor), 'ARS', { signo: p.dataIndex > 0 && p.dataIndex < ultimo })}` : ''
      },
    },
    xAxis: { type: 'category', data: cats, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: 'value', show: false },
    series: [
      { ...base, name: 'base', data: barras.map((b) => (b.desde >= 0 ? b.desde : 0)) },
      {
        ...visible,
        name: 'Paso',
        data: barras.map((b, i) => ({
          value: positivo[i],
          itemStyle: { color: colorPaso(b), borderRadius: 3 },
          // El monto arriba de la barra; en una que va toda bajo el cero, abajo (en la serie negativa).
          label: positivo[i] > 0 ? label(b, i, true) : { show: false },
        })),
      },
      { ...base, name: 'base negativa', data: barras.map((b) => (b.hasta <= 0 ? b.hasta : 0)) },
      {
        ...visible,
        name: 'Paso (bajo cero)',
        data: barras.map((b, i) => ({
          value: negativo[i],
          itemStyle: { color: colorPaso(b), borderRadius: 3 },
          label: positivo[i] <= 0 && negativo[i] < 0 ? label(b, i, false) : { show: false },
        })),
      },
    ],
  }
  const signo = (b: BarraCascada) => (b.valor < 0 && b.clave !== 'excedente' ? -1 : 1)
  const tabla: TablaGrafico = {
    columnas: ['Paso', 'En pesos', 'En dólares'],
    filas: barras.map((b) => {
      const usd = b.par.usd.valor === null ? null : Number(b.par.usd.valor) * signo(b)
      return [b.nombre, privado ? OCULTO : monto(String(b.valor), 'ARS'), usd === null ? 'sin dato' : privado ? OCULTO : monto(String(usd), 'USD')]
    }),
  }
  return { opcion, tabla }
}

/** La etiqueta de cada mes en el eje del patrimonio: "Hoy" y los meses que pasaron ("6 m"), cada tanto. */
export function pasoEje(h: number): number {
  return h <= 6 ? 1 : h <= 12 ? 3 : h <= 24 ? 6 : 12
}

export interface OpcionesPatrimonioUsd {
  privado: boolean
  /** El nombre del escenario (la leyenda y la tabla). */
  nombre: string
  /** "Todo igual" (el mismo escenario con todas las barras en Igual): la referencia; null si el escenario ya es todo Igual. */
  referencia?: readonly MesProyectado[] | null
}

/** Los trazos del patrimonio en dólares (handoff, captura 10), para el gráfico y su leyenda. */
export const TRAZO_USD = {
  /** El escenario: la línea de la mediana del diseño, oro fuerte de 2,5 px. */
  escenario: { color: 'vizFuerte', ancho: 2.5, guiones: null },
  /** "Todo igual": la referencia, en tinta tenue, rayada. */
  igual: { color: 'texto', ancho: 1.5, guiones: [6, 4] },
  /** Lo que pusiste: el "capital aportado" del diseño, gris y rayado 4 4. */
  puesto: { color: 'tenue', ancho: 1.5, guiones: [4, 4] },
} as const

/**
 * Patrimonio en dólares (handoff, captura 10): el financiero del escenario
 * elegido (la línea de la mediana del diseño: oro fuerte de 2,5 px, con un
 * área tenue), "Todo igual" de referencia (rayada) y lo que pusiste (el
 * "capital aportado" del diseño, gris y rayado: el financiero de tu carga más
 * lo invertido). Como en el diseño, sin eje de montos ni líneas de grilla: los
 * montos van en el tooltip, en la tabla y en las cifras de abajo. Un solo
 * camino: el abanico llega con Monte Carlo (D-144); no se dibuja ninguna
 * banda. Sin dato es un hueco. En el modo privado, sin montos.
 */
export function opcionPatrimonioUsd(meses: readonly MesProyectado[], o: OpcionesPatrimonioUsd): { opcion: Opcion; tabla: TablaGrafico } {
  const fmt = formateador('USD', o.privado)
  const h = meses.length - 1
  const paso = pasoEje(h)
  const ref = o.referencia && o.referencia.length ? o.referencia : null
  const deRef = (i: number, m: MesProyectado) => (ref && ref[i] && ref[i].mes === m.mes ? numeroDe(ref[i].financiero, 'USD') : null)
  const comun = { type: 'line', symbol: 'none', smooth: false, connectNulls: false, emphasis: { disabled: true } }
  const linea = (t: (typeof TRAZO_USD)[keyof typeof TRAZO_USD], alfa?: number) => ({
    color: colorTema(t.color),
    lineStyle: { width: t.ancho, color: colorTema(t.color, alfa), ...(t.guiones ? { type: [...t.guiones] } : {}) },
  })
  const series: Opcion[] = [
    {
      ...comun,
      name: o.nombre,
      data: meses.map((m) => numeroDe(m.financiero, 'USD')),
      ...linea(TRAZO_USD.escenario),
      areaStyle: { color: colorTema('viz', 0.1), origin: 'start' },
      z: 3,
    },
  ]
  if (ref) series.push({ ...comun, name: TODO_IGUAL, data: meses.map((m, i) => deRef(i, m)), ...linea(TRAZO_USD.igual, 0.6), z: 2 })
  series.push({ ...comun, name: 'Lo que pusiste', data: meses.map((m) => (m.aportado ? numeroDe(m.aportado, 'USD') : null)), ...linea(TRAZO_USD.puesto), z: 1 })
  const opcion: Opcion = {
    animation: false,
    grid: { left: 0, right: 0, top: 10, bottom: 24 },
    tooltip: { trigger: 'axis', valueFormatter: fmt },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: meses.map((m) => nombreMes(m.mes)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        interval: (i: number) => i === 0 || i === h || i % paso === 0,
        formatter: (_v: string, i: number) => (i === 0 ? 'Hoy' : `${i} m`),
        hideOverlap: true,
        // "Hoy" pegado al borde izquierdo y el último mes al derecho, como en el diseño.
        alignMinLabel: 'left',
        alignMaxLabel: 'right',
      },
    },
    // Sin eje de montos (como en el diseño): ni etiquetas ni líneas de grilla.
    yAxis: { type: 'value', scale: true, show: false, axisLabel: { show: false, formatter: (v: number) => (o.privado ? OCULTO : compacto(String(v), 'USD')) }, splitLine: { show: false } },
    series,
  }
  const tabla: TablaGrafico = {
    columnas: ['Mes', `Financiero · ${o.nombre}`, ...(ref ? [`Financiero · ${TODO_IGUAL.toLowerCase()}`] : []), 'Lo que pusiste'],
    filas: meses.map((m, i) => [nombreMes(m.mes), fmt(numeroDe(m.financiero, 'USD')), ...(ref ? [fmt(deRef(i, m))] : []), fmt(m.aportado ? numeroDe(m.aportado, 'USD') : null)]),
  }
  return { opcion, tabla }
}
