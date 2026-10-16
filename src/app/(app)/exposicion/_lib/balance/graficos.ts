// Opciones de ECharts de la pantalla Balance (plan §8): funciones puras, con
// test. El envoltorio compartido (src/components/graficos/grafico.tsx) les
// aplica el tema y las reglas (sin tortas, tooltip confinado, sin zoom).

import { compacto, monto } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import type { Moneda } from '@/lib/domain/tipos'
import type { PuntoBalance } from '@/lib/vistas/contratos-balance'
import { COLOR_CLASE, NOMBRE_CLASE } from '@/lib/vistas/colores'
import { colorTema } from '@/components/graficos/tema'

/** El orden de las capas: de lo más líquido (abajo) a los bienes (arriba). */
const ORDEN = ['liquidez', 'fci', 'lecap', 'bono', 'accion_local', 'cedear', 'otro', 'inmueble', 'vehiculo']

export interface OpcionesEvolucion {
  moneda: Moneda
  /** Modo privado: sin montos en los ejes, el tooltip ni la tabla. */
  privado: boolean
  /** Tema oscuro efectivo: las líneas del patrimonio van en la tinta del tema. */
  oscuro: boolean
  /** "Sin la camioneta" (lo firme); null si no hay bienes financiados. */
  rotuloFirme: string | null
}

const OCULTO = '•••'

/** Las clases que aparecen en algún punto, en orden de capas. */
export function clasesDe(serie: readonly PuntoBalance[]): string[] {
  const hay = new Set(serie.flatMap((p) => Object.keys(p.por_clase)))
  return [...ORDEN.filter((k) => hay.has(k)), ...[...hay].filter((k) => !ORDEN.includes(k)).sort()]
}

const num = (v: string | null): number | null => (v === null ? null : Number(v))
const clave = (m: Moneda) => (m === 'ARS' ? 'ars' : 'usd')

function formatear(v: number | string | null | undefined, m: Moneda, privado: boolean, compacta = false): string {
  if (privado) return OCULTO
  if (v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) return 'sin dato'
  return compacta ? compacto(String(v), m) : monto(String(v), m, { decimales: 0 })
}

const nombreNeto = (serie: readonly PuntoBalance[]) => (serie.some((p) => p.completo_estimado) ? 'Patrimonio neto (deuda estimada)' : 'Patrimonio neto')

/** La leyenda, en HTML debajo del gráfico (se lee en cualquier ancho, sin paginar). */
export interface ItemLeyenda {
  nombre: string
  color: string | null
  forma: 'area' | 'linea' | 'rayada' | 'punteada'
}

export function leyendaEvolucion(serie: readonly PuntoBalance[], rotuloFirme: string | null): ItemLeyenda[] {
  const estimado = serie.some((p) => p.completo_estimado)
  return [
    ...clasesDe(serie).map((c) => ({ nombre: NOMBRE_CLASE[c] ?? c, color: COLOR_CLASE[c] ?? '#888888', forma: 'area' as const })),
    { nombre: nombreNeto(serie), color: null, forma: estimado ? ('rayada' as const) : ('linea' as const) },
    ...(rotuloFirme ? [{ nombre: `${rotuloFirme} (firme)`, color: null, forma: 'punteada' as const }] : []),
  ]
}

/**
 * Área apilada del activo por clase (el mismo color por clase que en
 * Exposición) y dos líneas: el patrimonio neto (rayada si la deuda es un
 * estimado) y lo firme ("sin la camioneta", punteada). Un hueco es un hueco
 * (connectNulls: false); una sola carga es un punto.
 */
export function opcionEvolucion(serie: readonly PuntoBalance[], o: OpcionesEvolucion): Record<string, unknown> {
  const k = clave(o.moneda)
  const uno = serie.length === 1
  // La tinta del tema vigente (la resuelve el envoltorio al dibujar).
  const tinta = colorTema('texto')
  const estimado = serie.some((p) => p.completo_estimado)
  const series: Record<string, unknown>[] = clasesDe(serie).map((c) => ({
    type: 'line',
    name: NOMBRE_CLASE[c] ?? c,
    stack: 'activo',
    color: COLOR_CLASE[c] ?? '#888888',
    areaStyle: { opacity: 0.8 },
    lineStyle: { width: uno ? 0 : 1 },
    symbol: uno ? 'circle' : 'none',
    symbolSize: 8,
    connectNulls: false,
    emphasis: { focus: 'series' },
    data: serie.map((p) => num(p.por_clase[c]?.[k] ?? null)),
  }))
  series.push({
    type: 'line',
    name: nombreNeto(serie),
    color: tinta,
    lineStyle: { width: 3, type: estimado ? 'dashed' : 'solid' },
    symbol: uno ? 'circle' : 'none',
    symbolSize: 9,
    connectNulls: false,
    z: 5,
    data: serie.map((p) => num(p.completo[k])),
  })
  if (o.rotuloFirme) {
    series.push({
      type: 'line',
      name: `${o.rotuloFirme} (firme)`,
      color: tinta,
      lineStyle: { width: 2, type: 'dotted' },
      symbol: uno ? 'diamond' : 'none',
      symbolSize: 9,
      connectNulls: false,
      z: 4,
      data: serie.map((p) => num(p.neto[k])),
    })
  }
  return {
    grid: { top: 12 },
    tooltip: {
      trigger: 'axis',
      order: 'seriesDesc',
      valueFormatter: (v: number | string | null) => formatear(v, o.moneda, o.privado),
    },
    xAxis: { type: 'category', boundaryGap: uno, data: serie.map((p) => fechaCorta(p.fecha)) },
    yAxis: {
      type: 'value',
      axisLabel: o.privado ? { show: false } : { formatter: (v: number) => compacto(String(v), o.moneda) },
    },
    series,
  }
}

/**
 * La misma evolución como tabla (lector de pantalla y "Ver como tabla"): una
 * fila por fecha de carga, el activo por rubro (saldos, títulos, bienes) y las
 * dos líneas. Por rubro y en formato compacto, para que entre en una tarjeta
 * desde 768 px; el detalle por clase de cada fecha está en el balance de esa fecha.
 */
export function tablaEvolucion(serie: readonly PuntoBalance[], o: Pick<OpcionesEvolucion, 'moneda' | 'privado' | 'rotuloFirme'>): { columnas: string[]; filas: string[][] } {
  const k = clave(o.moneda)
  const columnas = ['Fecha', 'Liquidez', 'Títulos', 'Bienes', nombreNeto(serie), ...(o.rotuloFirme ? [o.rotuloFirme] : [])]
  const filas = serie.map((p) => [
    fechaCorta(p.fecha),
    formatear(p.por_rubro.liquidez[k], o.moneda, o.privado, true),
    formatear(p.por_rubro.titulos[k], o.moneda, o.privado, true),
    formatear(p.por_rubro.bienes[k], o.moneda, o.privado, true),
    formatear(p.completo[k], o.moneda, o.privado, true),
    ...(o.rotuloFirme ? [formatear(p.neto[k], o.moneda, o.privado, true)] : []),
  ])
  return { columnas, filas }
}
