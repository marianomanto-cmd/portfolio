// El chip de estado de los datos de la barra superior (D-156): qué dice y de
// qué color va el punto. Función pura, con test; el chip (chip-estado.tsx)
// solo la dibuja.
//
//   ● CARGA DE HOY · 09:41 | CCL 1.485 CRIPTO 1.510      (la carga es de hoy)
//   ● ÚLTIMA CARGA · 14/10 | CCL 1.485 CRIPTO 1.510      (la última es de otro día)
//
// El punto va en --positive si cada fuente está al día (✓ u ○) y en --warn si
// alguna tiene una diferencia (≠), está vieja (◷) o nunca se cargó. Un fin de
// semana, la carga del viernes está al día: el punto no avisa de más.

import { numero } from '@/lib/domain/dinero'
import { ZONA } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import type { Fuente } from '@/lib/vistas/contratos'

export interface ResumenChip {
  punto: 'al_dia' | 'atencion'
  /** "CARGA DE HOY · 09:41", "ÚLTIMA CARGA · 14/10" o "SIN CARGAS". */
  texto: string
  /** Para el teléfono: "HOY 09:41", "14/10" o "SIN DATOS". */
  corto: string
  /** El CCL y el cripto con los que está la app ("1.485"), o null si nunca se tipeó. */
  ccl: string | null
  cripto: string | null
  /** Lo que lee el lector de pantalla, entero. */
  etiqueta: string
}

const hora = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "1.485" (sin decimales si no los tiene; con dos si los tiene: "1.531,70"). */
export function tipoDeCambioCorto(v: string | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null
  const entero = Number.isInteger(Number(v))
  return numero(v, entero ? 0 : 2)
}

/** "14/10" de "2026-10-14". */
function diaMes(f: Fecha): string {
  const [, m, d] = f.split('-')
  return `${d}/${m}`
}

export function resumenChip(e: {
  hoy: Fecha
  fechaDatos: Fecha | null
  /** La hora en que se guardó la última carga del día de los datos (ISO). */
  creadoEn?: string | null
  fuentes: Fuente[]
}): ResumenChip {
  const atencion = e.fuentes.some((f) => f.estado === 'diferencia' || f.estado === 'viejo' || f.estado === 'sin_carga')
  const ccl = tipoDeCambioCorto(e.fuentes.find((f) => f.nombre === 'CCL')?.valor)
  const cripto = tipoDeCambioCorto(e.fuentes.find((f) => f.nombre === 'Cripto')?.valor)
  const tc = [ccl ? `CCL ${ccl}` : null, cripto ? `cripto ${cripto}` : null].filter(Boolean).join(', ')
  if (e.fechaDatos === null) {
    return { punto: 'atencion', texto: 'SIN CARGAS', corto: 'SIN DATOS', ccl, cripto, etiqueta: 'Todavía no hay cargas' }
  }
  const deHoy = e.fechaDatos === e.hoy
  const h = deHoy && e.creadoEn ? hora.format(new Date(e.creadoEn)) : null
  const texto = deHoy ? (h ? `CARGA DE HOY · ${h}` : 'CARGA DE HOY') : `ÚLTIMA CARGA · ${diaMes(e.fechaDatos)}`
  const corto = deHoy ? (h ? `HOY ${h}` : 'HOY') : diaMes(e.fechaDatos)
  const etiqueta = `${deHoy ? `Carga de hoy${h ? ` a las ${h}` : ''}` : `Última carga del ${diaMes(e.fechaDatos)}`}${tc ? `, ${tc}` : ''}${atencion ? ', con fuentes para revisar' : ', todas las fuentes al día'}`
  return { punto: atencion ? 'atencion' : 'al_dia', texto, corto, ccl, cripto, etiqueta }
}
