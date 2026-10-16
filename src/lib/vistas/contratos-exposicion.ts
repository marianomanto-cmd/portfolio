// Lo que recibe la pantalla Exposición desde el rediseño (15/10, D-156 y
// D-158): la vista del motor (VistaExposicion) más lo que dibuja el diseño:
// cada barra del gráfico "Largo y corto" partida por activo, la serie del neto
// también en dólares y quiénes son las posiciones más grandes. Serializable:
// toda cifra es un Par con su traza.

import type { Fecha } from '@/lib/domain/tipos'
import type { Par, VistaExposicion } from './contratos'

/** Un tramo de una barra de "Largo y corto": un activo, la liquidez de una moneda o una deuda. */
export interface TramoExposicion {
  clave: string
  /** Lo que va adentro del tramo, en mono: el ticker, "LIQ" o el nombre corto de la deuda. */
  etiqueta: string
  /** El nombre entero (el título del tramo y de su traza). */
  nombre: string
  color: string
  /** Lo que vale, en pesos y en dólares, con su traza. Una deuda va con su signo, negativo (como en la foto). */
  valor: Par
}

/** Un punto de la serie del neto en pesos, con el mismo neto en dólares al CCL de ese día. */
export interface PuntoNetoExposicion {
  fecha: Fecha
  /** Pesos financieros − deuda en pesos (texto decimal); null = sin dato. */
  neto_ars: string | null
  neto_usd: string | null
  pesos_ars: string | null
  deuda_ars: string | null
  ccl: string | null
}

export interface VistaExposicionPantalla extends VistaExposicion {
  tramos: {
    /** Lo que arriesga pesos (títulos en pesos y la liquidez en pesos, junta). */
    pesos: TramoExposicion[]
    /** Las deudas en pesos (el leasing). */
    deudas: TramoExposicion[]
    /** Lo que arriesga dólares (CEDEARs y la liquidez en dólares, junta). */
    dolares: TramoExposicion[]
    /** Solo en la vista Total: los bienes, mientras no tengan moneda de riesgo (D-73). */
    bienes: TramoExposicion[]
  }
  serie_neto: PuntoNetoExposicion[]
  /** Las posiciones más grandes del financiero (D-03), en el orden de la concentración: el ticker o el nombre del saldo. */
  mayores: string[]
}
