// Registro (visión §4.3, manual §4.5): las cargas agrupadas por lote (todo lo
// que guardó un Enter) y cómo se dice cada cosa. Funciones puras, con test; la
// página y la tabla (Grilla) solo las dibujan.

import { fechaCorta, fechaEnCordoba, ZONA } from '@/lib/domain/fechas'
import type { FilaRegistro } from '@/lib/vistas/contratos'

export interface Lote {
  /** El lote, o `carga-<id>` para una carga suelta. */
  clave: string
  lote: string | null
  /** El día de los datos. */
  fecha: string
  /** Cuándo se guardó (la última carga del lote). */
  creado: string
  /** Sus cargas, por número. */
  filas: FilaRegistro[]
}

/** Las cargas agrupadas por lote, del más nuevo al más viejo. */
export function agrupar(filas: readonly FilaRegistro[]): Lote[] {
  const m = new Map<string, Lote>()
  for (const f of filas) {
    const k = f.lote ?? `carga-${f.carga_id}`
    const l = m.get(k)
    if (l) {
      l.filas.push(f)
      if (f.creado_en > l.creado) l.creado = f.creado_en
    } else m.set(k, { clave: k, lote: f.lote, fecha: f.fecha, creado: f.creado_en, filas: [f] })
  }
  for (const l of m.values()) l.filas.sort((a, b) => a.carga_id - b.carga_id)
  return [...m.values()].sort((a, b) => (a.creado < b.creado ? 1 : a.creado > b.creado ? -1 : 0))
}

const hora = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "guardado a las 08:00", o "guardado el jue 15/10 a las 08:00" si se guardó otro día que el de los datos. */
export function guardado(fecha: string, creado: string): string {
  const instante = new Date(creado)
  const dia = fechaEnCordoba(instante)
  return `guardado ${dia !== fecha ? `el ${fechaCorta(dia)} ` : ''}a las ${hora.format(instante)}`
}

/** "48 s", "1 min 5 s" (con espacio fino: en la fuente mono, el espacio común queda ancho). */
export function duracion(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  return `${m} min${s % 60 ? ` ${s % 60} s` : ''}`
}

/** Cómo se nombra una carga en el resumen del lote y en el diálogo de Revertir. */
export const nombreFuente = (f: FilaRegistro): string => (f.cuenta === 'Tipo de cambio' ? 'CCL y cripto' : f.cuenta === 'Datos' && f.detalle ? `Datos: ${f.detalle}` : f.cuenta)

/** Qué grabó una carga, en palabras ("12 precios · 3 saldos"); un guardado de Datos dice qué grabó. */
export function conteo(f: FilaRegistro): string {
  if (f.detalle) return f.detalle
  const plural = (n: number | undefined, uno: string, varios: string) => (n ? `${n} ${n > 1 ? varios : uno}` : null)
  const p = [
    plural(f.cotizaciones, 'precio', 'precios'),
    plural(f.saldos, 'saldo', 'saldos'),
    plural(f.operaciones, 'operación', 'operaciones'),
    plural(f.valuaciones, 'valuación', 'valuaciones'),
    plural(f.capitales, 'capital pendiente', 'capitales pendientes'),
    plural(f.movimientos, 'movimiento', 'movimientos'),
  ].filter(Boolean)
  if (f.cuenta === 'Tipo de cambio' && !p.length) return 'CCL y cripto'
  return p.length ? p.join(' · ') : 'sin filas'
}

export interface ResumenLote {
  /** El tiempo activo del lote (el de su carga más larga), o null si no se midió. */
  activoMs: number | null
  /** ¿Queda alguna carga vigente para revertir? */
  hayVigentes: boolean
  todasRevertidas: boolean
  /** Las fuentes vigentes del lote ("IEB · Galicia · CCL y cripto"). */
  fuentes: string[]
  /** Lo que dice el diálogo de Revertir. */
  resumen: string
}

export function resumenLote(l: Lote): ResumenLote {
  const tiempos = l.filas.map((f) => f.tiempo_activo_ms).filter((x): x is number => x !== null)
  const vigentes = l.filas.filter((f) => f.estado === 'vigente')
  const fuentes = [...new Set(vigentes.map(nombreFuente))]
  return {
    activoMs: tiempos.length ? Math.max(...tiempos) : null,
    hayVigentes: vigentes.length > 0,
    todasRevertidas: l.filas.every((f) => f.estado === 'revertida'),
    fuentes,
    resumen: `${fechaCorta(l.fecha)} · ${vigentes.length} carga(s) vigente(s): ${fuentes.join(', ')}.`,
  }
}
