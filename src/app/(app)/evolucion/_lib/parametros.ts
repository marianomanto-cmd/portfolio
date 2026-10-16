// Los controles de Evolución viven en la URL (?vista=&moneda=&periodo=&desde=&hasta=&s=&e=):
// el período se puede guardar como favorito y Atrás recorre lo que miraste.
// Sin dependencias pesadas: lo usan la página (servidor) y los controles (cliente).

import type { Fecha } from '@/lib/domain/tipos'
import type { MonedaElegida, ParametrosEvolucion, PeriodoElegido, VistaPnl } from '@/lib/vistas/contratos-evolucion'

type Busqueda = Record<string, string | string[] | undefined>

const uno = (x: string | string[] | undefined): string | undefined => (Array.isArray(x) ? x[0] : x)
const FECHA = /^\d{4}-\d{2}-\d{2}$/
/** Los supuestos de Flujo van en base64url: solo esos caracteres, y con un tope. */
const SUPUESTOS = /^[A-Za-z0-9_-]{1,8000}$/
/** El id de un escenario guardado. */
const ID = /^[1-9]\d{0,9}$/

/** Todos los períodos, con su nombre largo (la hoja "Otro período", lo que dice el período elegido). */
export const PERIODOS: { periodo: PeriodoElegido; nombre: string }[] = [
  { periodo: 'semana', nombre: 'La última semana' },
  { periodo: 'mes', nombre: 'El último mes' },
  { periodo: '3m', nombre: 'Los últimos 3 meses' },
  { periodo: 'ytd', nombre: 'En lo que va del año' },
  { periodo: '12m', nombre: 'Los últimos 12 meses' },
  { periodo: 'todo', nombre: 'Desde el día cero' },
  { periodo: 'elegir', nombre: 'Elegir fechas' },
]

/**
 * La pastilla de arriba (handoff: 1M · 3M · YTD · 12M · INICIO, D-159). La
 * semana y "Elegir fechas" no se fueron: están en "Otro período".
 */
export const PERIODOS_PASTILLA: { periodo: PeriodoElegido; nombre: string }[] = [
  { periodo: 'mes', nombre: '1M' },
  { periodo: '3m', nombre: '3M' },
  { periodo: 'ytd', nombre: 'YTD' },
  { periodo: '12m', nombre: '12M' },
  { periodo: 'todo', nombre: 'Inicio' },
]

/** El nombre largo de un período ("El último mes"). */
export function nombrePeriodo(p: PeriodoElegido): string {
  return PERIODOS.find((x) => x.periodo === p)?.nombre ?? 'Desde el día cero'
}

export const MONEDAS: { moneda: MonedaElegida; nombre: string }[] = [
  { moneda: 'ars', nombre: 'Pesos' },
  { moneda: 'usd', nombre: 'Dólares' },
  { moneda: 'ambas', nombre: 'Ambas' },
]

export const VISTAS: { vista: VistaPnl; nombre: string; detalle: string }[] = [
  { vista: 'financiero', nombre: 'Financiero', detalle: 'títulos y liquidez' },
  { vista: 'total', nombre: 'Total', detalle: '+ bienes − deudas' },
]

export const POR_DEFECTO: ParametrosEvolucion = { vista: 'financiero', moneda: 'ambas', periodo: 'todo', desde: null, hasta: null, s: null, e: null }

/** Lee y valida los parámetros: lo que no se entiende vuelve al valor por defecto (Financiero, Ambas, desde el día cero). */
export function leerParametros(sp: Busqueda): ParametrosEvolucion {
  const vista = uno(sp.vista)
  const moneda = uno(sp.moneda)
  const periodo = uno(sp.periodo)
  const desde = uno(sp.desde)
  const hasta = uno(sp.hasta)
  const s = uno(sp.s)
  const e = uno(sp.e)
  return {
    vista: vista === 'total' ? 'total' : 'financiero',
    moneda: moneda === 'ars' || moneda === 'usd' ? moneda : 'ambas',
    periodo: PERIODOS.some((p) => p.periodo === periodo) ? (periodo as PeriodoElegido) : 'todo',
    desde: desde && FECHA.test(desde) ? (desde as Fecha) : null,
    hasta: hasta && FECHA.test(hasta) ? (hasta as Fecha) : null,
    s: s && SUPUESTOS.test(s) ? s : null,
    e: e && ID.test(e) ? Number(e) : null,
  }
}

/**
 * El enlace a Evolución con algunos parámetros cambiados (sin repetir los que
 * quedan por defecto). Los controles piden `explicito`: lo que elegiste va
 * entero en la dirección, aunque sea el valor por defecto, para que manden
 * sobre lo recordado en el dispositivo (si no, "Desde el día cero" volvería a
 * la semana recordada).
 */
export function hrefEvolucion(p: ParametrosEvolucion, cambios: Partial<ParametrosEvolucion> = {}, demo: string | null = null, opciones: { explicito?: boolean } = {}): string {
  const q = { ...p, ...cambios }
  const u = new URLSearchParams()
  const todo = Boolean(opciones.explicito)
  if (demo) u.set('demo', demo)
  if (todo || q.vista !== POR_DEFECTO.vista) u.set('vista', q.vista)
  if (todo || q.moneda !== POR_DEFECTO.moneda) u.set('moneda', q.moneda)
  if (todo || q.periodo !== POR_DEFECTO.periodo) u.set('periodo', q.periodo)
  if (q.periodo === 'elegir') {
    if (q.desde) u.set('desde', q.desde)
    if (q.hasta) u.set('hasta', q.hasta)
  }
  if (q.s) u.set('s', q.s)
  if (q.e) u.set('e', String(q.e))
  const t = u.toString()
  return t ? `/evolucion?${t}` : '/evolucion'
}

// ───────────── Lo que se recuerda en el dispositivo (HO-7) ─────────────

/** Las claves que se recuerdan: qué mirás, la moneda y el período (no los supuestos de Flujo). */
const RECORDADAS = ['vista', 'moneda', 'periodo', 'desde', 'hasta'] as const

/** ¿La dirección ya dice qué mirar? Entonces manda la dirección, no lo recordado. */
export function hayEleccionEnLaUrl(sp: Busqueda): boolean {
  return RECORDADAS.some((k) => uno(sp[k]) !== undefined)
}

/** Lo que se guarda en el dispositivo (solo texto, validado al leerlo). */
export function paraRecordar(p: ParametrosEvolucion): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of RECORDADAS) {
    const x = p[k]
    if (x !== null) out[k] = x
  }
  return out
}

/**
 * Adónde ir con lo recordado si la dirección no dice qué mirar: el período
 * recordado con el escenario de la dirección (?s= o ?e=), o null si ya es la
 * misma dirección (no hay que reemplazar nada).
 */
export function destinoRecordado(r: ParametrosEvolucion, p: ParametrosEvolucion): string | null {
  const destino = hrefEvolucion({ ...r, s: p.s, e: p.e ?? null })
  return destino === hrefEvolucion(p) ? null : destino
}

/** Lee lo recordado; cualquier cosa rara vuelve a null (y no se usa). */
export function leerRecordado(x: unknown): ParametrosEvolucion | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null
  const r = x as Record<string, unknown>
  const sp: Busqueda = {}
  for (const k of RECORDADAS) if (typeof r[k] === 'string') sp[k] = r[k] as string
  if (!hayEleccionEnLaUrl(sp)) return null
  return leerParametros(sp)
}
