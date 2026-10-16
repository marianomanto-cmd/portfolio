// Opciones de ECharts de la pantalla Pasivos (plan §5 C.5). Funciones puras
// sobre la vista, con test: los datos del gráfico son los de la vista (mismo
// largo, ningún NaN, null donde hay "sin dato"). Las dibuja el envoltorio
// compartido (src/components/graficos/grafico.tsx). Sin tortas.

import type { CalcVista } from '@/lib/domain/calc'
import { compacto, monto, numero } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import type { TablaGrafico } from '@/components/graficos/grafico'
import { colorTema } from '@/components/graficos/tema'
import type { FilaCuota, VistaLeasing } from '@/lib/vistas/contratos-pasivos'

/**
 * Colores de cada parte de la cuota: los mismos en el gráfico, la leyenda y las
 * tarjetas (sistema visual, D-157). Lo que baja la deuda en piedra; lo que es
 * costo (interés, cargos) en la familia sangría; impuestos y seguro en lavanda.
 * Son colores fijos (no colorTema) porque también pintan los puntos de las tarjetas.
 */
export const COLOR_PARTE = {
  amortizacion: '#C7BDAB',
  interes: '#F23A5E',
  canon: '#C7BDAB',
  iva: '#9D8FB0',
  seguro: '#8C8696',
  percepcion: '#7F7194',
  cargos: '#FF7D9B',
} as const

export type Parte = keyof typeof COLOR_PARTE

export const NOMBRE_PARTE: Record<Parte, string> = {
  amortizacion: 'Amortización',
  interes: 'Interés implícito',
  canon: 'Canon',
  iva: 'IVA',
  seguro: 'Seguro',
  percepcion: 'Percepción',
  cargos: 'Cargos',
}

const num = (c: CalcVista): number | null => (c.valor === null ? null : Number(c.valor))
const oculto = '•••'
const pesos = (v: number | null, privado: boolean) => (v === null ? 'sin dato' : privado ? oculto : compacto(String(v), 'ARS'))

/** Un rótulo de eje: compacto y sin ",0" ("$ 800k", "$ 2 M", "US$ 1,5k"); debajo de mil dólares, sin centavos. */
export function enEje(v: number, moneda: 'ARS' | 'USD', privado: boolean): string {
  if (privado) return oculto
  if (moneda === 'USD' && Math.abs(v) < 1000) return monto(String(Math.round(v)), 'USD', { decimales: 0 })
  return compacto(String(v), moneda).replace(/,0(?= M$|k$)/, '')
}

export interface Grafico {
  opcion: Record<string, unknown>
  tabla: TablaGrafico
}

/**
 * Cada cuota, abierta (D-152): barras apiladas por cuota, en pesos. Con la tasa
 * del contrato, amortización e interés por separado; sin ella, el canon entero.
 * Las pagadas, sólidas; las que faltan, más claras; un monto supuesto o a
 * confirmar, rayado. La línea "hoy" en la primera cuota que vence desde hoy; la opción al final.
 */
export function graficoApertura(l: Pick<VistaLeasing, 'cuotas' | 'opcion' | 'tea' | 'hoy'>, privado: boolean, movil = false): Grafico {
  const conTasa = l.tea.valor !== null
  // Los cargos, solo si alguna cuota los trajo (si no, son un cero real y ensucian la leyenda).
  const conCargos = l.cuotas.some((c) => c.hay_cargos)
  const partes: Parte[] = [...(conTasa ? (['amortizacion', 'interes'] as const) : (['canon'] as const)), 'iva', 'seguro', 'percepcion', ...(conCargos ? (['cargos'] as const) : [])]
  const cats = [...l.cuotas.map((c) => String(c.nro)), 'OC']
  const valor = (c: FilaCuota, p: Parte): number | null => {
    switch (p) {
      case 'amortizacion':
        return num(c.apertura.amortizacion.ars)
      case 'interes':
        return num(c.apertura.interes.ars)
      case 'canon':
        return num(c.canon)
      case 'iva':
        return num(c.iva)
      case 'seguro':
        return num(c.seguro)
      case 'percepcion':
        return num(c.percepcion)
      case 'cargos':
        return num(c.apertura.cargos.ars)
    }
  }
  const incierto = (c: FilaCuota, p: Parte) =>
    !c.pagada &&
    ((p === 'seguro' && (c.fuentes.seguro === 'supuesto' || c.fuentes.seguro === 'a_confirmar')) ||
      (p === 'percepcion' && (c.fuentes.percepcion === 'supuesto' || c.fuentes.percepcion === 'a_confirmar')) ||
      (p === 'iva' && [c.fuentes.seguro, c.fuentes.percepcion].some((f) => f === 'supuesto' || f === 'a_confirmar')))
  const opcionNeto = num(l.opcion.neto.ars)
  const opcionIva = num(l.opcion.iva.ars)
  // "Hoy" va en la primera cuota que vence desde hoy (no en la primera impaga: una vencida sin
  // pagar queda a la izquierda de la línea); si ya vencieron todas, en la opción si no llegó.
  const desdeHoy = l.cuotas.find((c) => c.fecha_vencimiento >= l.hoy)
  const corte = desdeHoy ? String(desdeHoy.nro) : l.opcion.fecha !== null && l.opcion.fecha >= l.hoy ? 'OC' : null
  const series = partes.map((p, i) => ({
    type: 'bar',
    name: NOMBRE_PARTE[p],
    stack: 'cuota',
    barMaxWidth: 22,
    color: COLOR_PARTE[p],
    emphasis: { focus: 'series' },
    data: [
      ...l.cuotas.map((c) => ({
        value: valor(c, p),
        itemStyle: {
          opacity: c.pagada ? 1 : 0.5,
          ...(incierto(c, p) ? { decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 3], rotation: -Math.PI / 4, color: 'rgba(255,255,255,0.55)' } } : {}),
        },
      })),
      // La opción de compra: su neto va como amortización (o canon) y su IVA como IVA.
      { value: p === (conTasa ? 'amortizacion' : 'canon') ? opcionNeto : p === 'iva' ? opcionIva : null, itemStyle: { opacity: 0.5 } },
    ],
    ...(i === 0 && corte
      ? {
          markLine: {
            symbol: 'none',
            silent: true,
            label: { formatter: 'hoy', position: 'insideEndTop' },
            lineStyle: { type: 'dashed' },
            data: [{ xAxis: corte }],
          },
        }
      : {}),
  }))
  const opcion = {
    // Leyenda plana: en el teléfono va abajo (la ubica el envoltorio) y se
    // parte en dos renglones en vez de paginarse; el gráfico le deja lugar.
    legend: movil ? { type: 'plain', itemGap: 10, itemWidth: 12, itemHeight: 10, textStyle: { fontSize: 11 } } : { type: 'plain', top: 0 },
    grid: movil ? { bottom: 64 } : { top: 40 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: number | null) => (privado ? oculto : v === null || v === undefined ? 'sin dato' : compacto(String(v), 'ARS')),
    },
    xAxis: { type: 'category', data: cats },
    // El eje, como el de la cuota: compacto y sin ",0" ("$ 900k", no "$ 900,0k").
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => enEje(v, 'ARS', privado) } },
    series,
  }
  const tabla: TablaGrafico = {
    columnas: ['Cuota', ...partes.map((p) => NOMBRE_PARTE[p]), 'Total'],
    filas: [
      ...l.cuotas.map((c) => [
        `${c.nro}${c.pagada ? ' (pagada)' : ''}`,
        ...partes.map((p) => pesos(valor(c, p), privado)),
        pesos(num(c.apertura.total.ars), privado),
      ]),
      ['Opción de compra', ...partes.map((p) => pesos(p === (conTasa ? 'amortizacion' : 'canon') ? opcionNeto : p === 'iva' ? opcionIva : 0, privado)), pesos(num(l.opcion.total.ars), privado)],
    ],
  }
  return { opcion, tabla }
}

/**
 * La cuota en pesos contra la cuota en dólares (spec §5): las dos indexadas a
 * 100 en la primera cuota pagada con su CCL. Dos monedas en un eje, solo así.
 */
export function graficoIndexado(filas: VistaLeasing['indexado']): Grafico {
  const cats = filas.map((f) => String(f.nro))
  const opcion = {
    legend: { type: 'plain', top: 0 },
    grid: { top: 40 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => (v === null || v === undefined ? 'sin dato' : numero(String(v), 1)) },
    xAxis: { type: 'category', data: cats },
    yAxis: { type: 'value', scale: true, axisLabel: { formatter: (v: number) => numero(String(v), 0) } },
    series: [
      { type: 'line', name: 'Cuota en pesos', data: filas.map((f) => Number(f.ars)), color: colorTema('texto'), symbolSize: 6 },
      { type: 'line', name: 'Cuota en dólares', data: filas.map((f) => Number(f.usd)), color: colorTema('viz'), lineStyle: { type: 'dashed' }, symbolSize: 6 },
    ],
  }
  const tabla: TablaGrafico = {
    columnas: ['Cuota', 'En pesos (índice)', 'En dólares (índice)'],
    filas: filas.map((f) => [String(f.nro), numero(f.ars, 1), numero(f.usd, 1)]),
  }
  return { opcion, tabla }
}

// En dólares, sin centavos debajo de mil ("US$ 800", no "US$ 800,00"): son ejes y referencias.
const dolares = (v: number | null, privado: boolean) =>
  v === null ? 'sin dato' : privado ? oculto : Math.abs(v) >= 1000 ? compacto(String(v), 'USD') : monto(String(Math.round(v)), 'USD', { decimales: 0 })

/**
 * Hasta qué cuota es pasado (la línea "Hoy" del gráfico de la cuota): la
 * última que ya venció (hoy inclusive). -1 si todavía no venció ninguna.
 */
export function indiceHoy(cuotas: readonly Pick<FilaCuota, 'fecha_vencimiento'>[], hoy: string): number {
  let i = -1
  cuotas.forEach((c, j) => {
    if (c.fecha_vencimiento <= hoy) i = j
  })
  return i
}

/**
 * Un techo "redondo" para un eje: 1; 1,2; 1,5; 1,6; 2; 3; 4; 5; 6; 8 × 10^n,
 * el primero que no queda debajo. El eje lleva el techo y su mitad, y las dos
 * se leen sin redondear en el rótulo compacto (sin 2,5: su mitad, 1,25, sería
 * "1,3k" o "1,3 M").
 */
export function techo(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1
  const e = Math.pow(10, Math.floor(Math.log10(x)))
  for (const f of [1, 1.2, 1.5, 1.6, 2, 3, 4, 5, 6, 8, 10]) if (f * e >= x - 1e-9) return f * e
  return 10 * e
}

/**
 * La cuota en pesos y en dólares (handoff, captura 08; spec §5: "cuota en
 * pesos (plana) vs. en dólares (cae)"): una línea por moneda, cada una con su
 * eje (pesos a la izquierda, en tinta; dólares a la derecha, en oro). En
 * dólares, las pagadas al CCL de su pago (sólida) y las que faltan al CCL de
 * hoy (punteada, 4 4: una referencia, nunca un tipo de cambio inventado). Lo
 * pasado con un tinte y la línea "Hoy" en sangría. Sin el CCL de un pago, esa
 * cuota en dólares es un hueco (sin dato), nunca un cero. En el modo privado,
 * sin montos en los ejes, el tooltip ni la tabla.
 */
export function graficoCuota(l: Pick<VistaLeasing, 'cuotas' | 'hoy'>, privado: boolean): Grafico {
  const cuotas = [...l.cuotas].sort((a, b) => a.nro - b.nro)
  const cats = cuotas.map((c) => String(c.nro))
  const hoy = indiceHoy(cuotas, l.hoy)
  const ars = cuotas.map((c) => num(c.total))
  const usd = cuotas.map((c) => num(c.total_usd))
  const pagadas = cuotas.map((c, i) => (c.pagada ? usd[i] : null))
  // La punteada arranca en la última pagada (si tiene su dato), así las dos líneas se tocan.
  const ultimaPagada = cuotas.reduce((a, c, i) => (c.pagada ? i : a), -1)
  const porPagar = cuotas.map((c, i) => (!c.pagada || (i === ultimaPagada && cuotas[i + 1] && !cuotas[i + 1].pagada) ? usd[i] : null))
  const enPesos = (v: number | null | undefined) => pesos(v ?? null, privado)
  const enDolares = (v: number | null | undefined) => dolares(v ?? null, privado)
  const comun = { type: 'line', symbol: 'none', smooth: false, connectNulls: false, emphasis: { disabled: true } }
  const ultimo = cats.length - 1
  // Cada moneda en su eje, los dos desde cero: los pesos arriba (con aire) y los dólares por debajo,
  // así las dos líneas no se pisan cuando el CCL no se mueve (el handoff las dibuja separadas).
  const maxDe = (xs: (number | null)[]) => xs.reduce<number>((a, v) => (v !== null && v > a ? v : a), 0)
  const ejeMax = (max: number, aire: number) => (max > 0 ? techo(max * aire) : undefined)
  const topeArs = ejeMax(maxDe(ars), 1.15)
  const topeUsd = ejeMax(maxDe(usd), 1.8)
  const opcion = {
    // Sin animación: el gráfico es chico y la línea "hoy" no tiene que moverse.
    animation: false,
    grid: { left: 8, right: 8, top: 14, bottom: 8 },
    tooltip: { trigger: 'axis' },
    // Como en el diseño: sin líneas de grilla ni línea de eje; la referencia es el tinte de lo pasado y la línea de hoy.
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: cats,
      axisTick: { show: false },
      axisLine: { show: false },
      // Solo la primera, la de hoy y la última: "Cuota 1 · Hoy · 14 · Cuota 35" (handoff).
      axisLabel: {
        interval: (i: number) => i === 0 || i === ultimo || i === hoy,
        // "Hoy", en sangría clara (--accent-glow), como en el diseño.
        formatter: (v: string, i: number) => (i === hoy && i !== 0 && i !== ultimo ? `{hoy|Hoy · ${v}}` : `Cuota ${v}`),
        rich: { hoy: { color: colorTema('acentoBrillo') } },
        hideOverlap: true,
      },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: topeArs,
        interval: topeArs ? topeArs / 2 : undefined,
        splitLine: { show: false },
        axisLabel: { color: colorTema('tenue'), formatter: (v: number) => enEje(v, 'ARS', privado) },
      },
      {
        type: 'value',
        min: 0,
        max: topeUsd,
        interval: topeUsd ? topeUsd / 2 : undefined,
        splitLine: { show: false },
        axisLabel: { color: colorTema('viz'), formatter: (v: number) => enEje(v, 'USD', privado) },
      },
    ],
    series: [
      {
        ...comun,
        name: 'Cuota en pesos',
        yAxisIndex: 0,
        data: ars,
        color: colorTema('texto'),
        lineStyle: { width: 2, color: colorTema('texto') },
        tooltip: { valueFormatter: enPesos },
        ...(hoy >= 0
          ? {
              // Lo pasado, con un tinte; la línea de hoy, en sangría.
              markArea: { silent: true, itemStyle: { color: colorTema('texto', 0.03) }, data: [[{ xAxis: cats[0] }, { xAxis: cats[hoy] }]] },
              markLine: {
                symbol: 'none',
                silent: true,
                label: { show: false },
                lineStyle: { color: colorTema('acento'), width: 1, type: 'solid' },
                data: [{ xAxis: cats[hoy] }],
              },
            }
          : {}),
      },
      { ...comun, name: 'Cuota en dólares, al CCL de cada pago', yAxisIndex: 1, data: pagadas, color: colorTema('viz'), lineStyle: { width: 2, color: colorTema('viz') }, tooltip: { valueFormatter: enDolares } },
      {
        ...comun,
        name: 'Cuota en dólares, al CCL de hoy',
        yAxisIndex: 1,
        data: porPagar,
        color: colorTema('viz'),
        lineStyle: { width: 2, color: colorTema('viz'), type: [4, 4] },
        tooltip: { valueFormatter: enDolares },
      },
    ],
  }
  const tabla: TablaGrafico = {
    columnas: ['Cuota', 'En pesos', 'En dólares', 'Dólares al CCL'],
    filas: cuotas.map((c, i) => [`${c.nro} · ${fechaCorta(c.fecha_vencimiento)}`, enPesos(ars[i]), enDolares(usd[i]), c.pagada ? 'del pago' : 'de hoy']),
  }
  return { opcion, tabla }
}
