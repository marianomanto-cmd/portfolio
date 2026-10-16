// Lo que suma Hoy con el rediseño del 15/10 (D-157, handoff "Portfolio UI",
// capturas 01 y 02): el patrimonio neto con sus activos y sus pasivos, "Qué
// tenés y qué debés", el patrimonio neto de los últimos 12 meses y "Próximos
// 30 días". Serializable, como el resto de los contratos: los montos van como
// texto decimal dentro de CalcVista, con su traza.

import type { CalcVista } from '@/lib/domain/calc'
import type { Fecha } from '@/lib/domain/tipos'
import type { Par } from './contratos'

/** Un tramo de una barra de "Qué tenés y qué debés": una partida (o toda la liquidez junta). */
export interface TramoHoy {
  clave: string
  /** Lo que va adentro de la barra, en mono 10 px: el ticker, LIQ, el nombre del bien o el de la deuda. */
  rotulo: string
  nombre: string
  color: string
  valor: Par
  /**
   * Su parte del activo total, como fracción (texto decimal): el ancho del
   * tramo. null si no se puede dibujar (falta un valor, o es negativo).
   */
  peso: string | null
}

/** Lo que tenés y lo que debés a la fecha de los datos (D-03): el patrimonio neto es activos + pasivos. */
export interface BalanceHoy {
  /** Lo financiero más los bienes, sin restar deudas. */
  activos: Par
  /** La casa y la camioneta, a su última valuación. */
  bienes: Par
  /** Lo que debés, con signo negativo: resta en el patrimonio neto. */
  pasivos: Par
  tramos_activos: TramoHoy[]
  tramos_pasivos: TramoHoy[]
}

/** El CCL de las dos puntas del período de la frase del día y cuánto cambió. */
export interface CclPeriodo {
  desde: CalcVista
  hasta: CalcVista
  /** hasta ÷ desde − 1, como fracción. */
  variacion: CalcVista
}

/** Un punto de la serie del patrimonio neto: una fecha de carga, nunca un punto inventado entre cargas. */
export interface PuntoPatrimonio {
  fecha: Fecha
  /** Texto decimal; null = sin dato ese día. */
  ars: string | null
  usd: string | null
}

export interface SeriePatrimonio {
  puntos: PuntoPatrimonio[]
  /** Lo que abarca: 12 meses si hay tanta historia; si no, desde la primera carga. null sin puntos. */
  periodo: { desde: Fecha; hasta: Fecha; completo: boolean } | null
  /** Del primer punto al último, en cada moneda, como fracción. */
  variacion: { ars: CalcVista; usd: CalcVista }
  /** El CCL del primer punto y el del último: la diferencia entre las dos variaciones. */
  ccl: { desde: CalcVista; hasta: CalcVista } | null
  /** Por qué no hay serie (falta un dato del patrimonio neto, o no hay cargas). */
  motivo: string | null
}

/**
 * Un renglón de "Próximos 30 días": una fecha (o un pendiente sin fecha) con
 * lo que pasa ese día. `alerta`: va en sangría clara (un vencimiento a menos
 * de 15 días, una cuota vencida, la carga de hoy que falta).
 */
export interface EventoProximo {
  id: string
  tipo: 'carga' | 'cuota' | 'vencimiento' | 'cierre'
  fecha: Fecha
  titulo: string
  /** La línea de abajo, sin el monto (el monto va aparte, con su traza). */
  detalle: string
  valor: Par | null
  alerta: boolean
  href: string | null
}
