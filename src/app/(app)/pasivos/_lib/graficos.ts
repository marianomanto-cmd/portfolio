// Opciones de ECharts de la pantalla Pasivos (plan §5 C.5). Funciones puras
// sobre la vista, con test: los datos del gráfico son los de la vista (mismo
// largo, ningún NaN, null donde hay "sin dato"). Las dibuja el envoltorio
// compartido (src/components/graficos/grafico.tsx). Sin tortas.

import type { CalcVista } from '@/lib/domain/calc'
import { compacto, numero } from '@/lib/domain/dinero'
import type { TablaGrafico } from '@/components/graficos/grafico'
import type { FilaCuota, VistaLeasing } from '@/lib/vistas/contratos-pasivos'

/** Colores de cada parte de la cuota: los mismos en el gráfico, la leyenda y las tarjetas. */
export const COLOR_PARTE = {
  amortizacion: '#2f5bd3',
  interes: '#c2621f',
  canon: '#2f5bd3',
  iva: '#7a4fc9',
  seguro: '#0f8b8d',
  percepcion: '#b8336a',
  cargos: '#6b7a90',
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
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (privado ? oculto : compacto(String(v), 'ARS')) } },
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
      { type: 'line', name: 'Cuota en pesos', data: filas.map((f) => Number(f.ars)), color: COLOR_PARTE.iva, symbolSize: 6 },
      { type: 'line', name: 'Cuota en dólares', data: filas.map((f) => Number(f.usd)), color: COLOR_PARTE.amortizacion, lineStyle: { type: 'dashed' }, symbolSize: 6 },
    ],
  }
  const tabla: TablaGrafico = {
    columnas: ['Cuota', 'En pesos (índice)', 'En dólares (índice)'],
    filas: filas.map((f) => [String(f.nro), numero(f.ars, 1), numero(f.usd, 1)]),
  }
  return { opcion, tabla }
}
