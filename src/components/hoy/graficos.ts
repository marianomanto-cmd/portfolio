// El gráfico de Hoy (handoff, fila 3: "Patrimonio neto · 12 meses"): dos
// gráficos chicos apilados, en dólares arriba y en pesos abajo, con el mismo
// eje de fechas. No es un gráfico con dos ejes (el handoff lo prohíbe): son
// dos grillas de ECharts en la misma figura. Funciones puras, con test
// (graficos.test.ts); el envoltorio común (components/graficos/grafico.tsx)
// les pone el tema. Un punto por fecha de carga: un hueco es un hueco.

import { compacto, monto } from '@/lib/domain/dinero'
import { diasEntre, fechaCorta } from '@/lib/domain/fechas'
import type { PuntoPatrimonio, SeriePatrimonio } from '@/lib/vistas/contratos-hoy'
import { colorTema, OCULTO } from '@/components/graficos/tema'
import type { TablaGrafico } from '@/components/graficos/grafico'

/** El alto de cada gráfico chico y el espacio entre los dos (handoff: 80 px). */
export const ALTO_MINI = 80
export const SEPARACION = 14
/** Lo que ocupan las fechas debajo del de pesos. */
export const ALTO_EJE = 22
export const ALTO_TOTAL = ALTO_MINI * 2 + SEPARACION + ALTO_EJE

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

/** Una fecha 'YYYY-MM-DD' como instante del mediodía UTC: el eje de tiempo no depende de la zona del navegador. */
export function instante(f: string): number {
  return Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)), 12)
}

/** La etiqueta de una fecha del eje: el mes ("OCT") si la serie abarca más de dos meses; si no, día y mes ("14/10"). */
export function etiquetaEje(ms: number, largo: boolean): string {
  const d = new Date(ms)
  if (largo) return MESES[d.getUTCMonth()]
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const num = (v: string | null) => (v === null ? null : Number(v))

function texto(v: string | null, moneda: 'ARS' | 'USD', privado: boolean, compacta = false): string {
  if (privado) return OCULTO
  if (v === null) return 'sin dato'
  return compacta ? compacto(v, moneda) : monto(v, moneda, { decimales: 0 })
}

/**
 * La opción de ECharts: arriba, en dólares (línea oro de 2 px y su área al
 * 14%); abajo, en pesos (línea en tinta y su área al 7%). Los dos ejes de
 * fechas van linkeados (el puntero marca el mismo día en los dos) y los
 * montos no se ven en ningún eje: en el modo privado, tampoco en el tooltip.
 */
export function opcionPatrimonio(s: SeriePatrimonio, o: { privado: boolean }): Record<string, unknown> {
  const puntos = s.puntos
  if (!puntos.length) return { series: [] }
  const desde = instante(puntos[0].fecha)
  const hasta = instante(puntos[puntos.length - 1].fecha)
  const largo = diasEntre(puntos[0].fecha, puntos[puntos.length - 1].fecha) > 62
  const uno = puntos.length === 1
  const datos = (k: 'ars' | 'usd') => puntos.map((p) => [instante(p.fecha), num(p[k])])
  // El eje "con aire": la línea arriba y el área debajo (el piso es 60% del rango por debajo del mínimo).
  const ejeY = (gridIndex: number) => ({
    type: 'value',
    gridIndex,
    show: false,
    scale: true,
    min: (v: { min: number; max: number }) => v.min - Math.max(v.max - v.min, Math.abs(v.min) * 0.02) * 0.6,
    max: (v: { min: number; max: number }) => v.max + Math.max(v.max - v.min, Math.abs(v.max) * 0.02) * 0.1,
  })
  const ejeX = (gridIndex: number, conEtiquetas: boolean) => ({
    type: 'time',
    gridIndex,
    min: uno ? desde - 86_400_000 : desde,
    max: uno ? hasta + 86_400_000 : hasta,
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: conEtiquetas ? { formatter: (v: number) => etiquetaEje(v, largo), hideOverlap: true, margin: 10 } : { show: false },
    axisPointer: { label: { show: false } },
  })
  const serie = (k: 'ars' | 'usd', i: number) => {
    const color = k === 'usd' ? colorTema('viz') : colorTema('texto')
    return {
      type: 'line',
      name: k === 'usd' ? 'En dólares' : 'En pesos',
      xAxisIndex: i,
      yAxisIndex: i,
      data: datos(k),
      connectNulls: false,
      showSymbol: uno,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2, color },
      itemStyle: { color },
      areaStyle: { color: k === 'usd' ? colorTema('viz', 0.14) : colorTema('texto', 0.07) },
      emphasis: { disabled: true },
    }
  }
  return {
    grid: [
      { left: 0, right: 0, top: 0, height: ALTO_MINI },
      { left: 0, right: 0, top: ALTO_MINI + SEPARACION, height: ALTO_MINI },
    ],
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    xAxis: [ejeX(0, false), ejeX(1, true)],
    yAxis: [ejeY(0), ejeY(1)],
    tooltip: {
      trigger: 'axis',
      formatter: (p: { dataIndex?: number }[] | { dataIndex?: number }) => {
        const i = (Array.isArray(p) ? p[0]?.dataIndex : p.dataIndex) ?? 0
        const x: PuntoPatrimonio | undefined = puntos[i]
        if (!x) return ''
        return `${fechaCorta(x.fecha)}<br/>${texto(x.usd, 'USD', o.privado)}<br/>${texto(x.ars, 'ARS', o.privado)}`
      },
    },
    series: [serie('usd', 0), serie('ars', 1)],
  }
}

/** Lo mismo que el gráfico, como tabla (el lector de pantalla y "Ver como tabla"). */
export function tablaPatrimonio(s: SeriePatrimonio, o: { privado: boolean }): TablaGrafico {
  return {
    columnas: ['Fecha', 'En dólares', 'En pesos'],
    filas: s.puntos.map((p) => [fechaCorta(p.fecha), texto(p.usd, 'USD', o.privado), texto(p.ars, 'ARS', o.privado)]),
  }
}

/** El rótulo de la tarjeta: "Patrimonio neto · 12 meses", o desde cuándo hay historia. */
export function rotuloSerie(s: SeriePatrimonio): string {
  if (!s.periodo || s.periodo.completo) return 'Patrimonio neto · 12 meses'
  return `Patrimonio neto · desde el ${fechaCorta(s.periodo.desde)}`
}
