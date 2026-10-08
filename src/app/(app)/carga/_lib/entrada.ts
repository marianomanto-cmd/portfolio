// Los dos campos de tipo de cambio (spec: "un campo para el CCL del día y uno
// para el dólar cripto"). Aceptan formato argentino y muestran al lado lo que
// entendieron ("= 1.548,20"), para que un punto de más no pase en silencio.

import { Decimal, leerNumeroAR, numero, porcentaje } from '@/lib/domain/dinero'

export interface EntradaTC {
  /** Texto tal cual lo tipeaste. */
  texto: string
  /** Decimal normalizado ("1548.2") o null si está vacío o no se entiende. */
  valor: string | null
  /** Eco de lo entendido: "= 1.548,20". */
  eco: string | null
  error: string | null
}

export function interpretarTC(texto: string): EntradaTC {
  if (texto.trim() === '') return { texto, valor: null, eco: null, error: null }
  const v = leerNumeroAR(texto)
  if (v === null) return { texto, valor: null, eco: null, error: 'No lo entiendo como número (ej.: 1548,20).' }
  const d = new Decimal(v)
  if (d.lte(0)) return { texto, valor: null, eco: null, error: 'Tiene que ser mayor que cero.' }
  return { texto, valor: d.toFixed(), eco: `= ${numero(d, 4, { min: 2 })}`, error: null }
}

/** "+1,08% vs ayer": variación de un valor contra una referencia. null si falta alguno. */
export function variacionContra(valor: string | null, referencia: string | null): string | null {
  if (valor === null || referencia === null) return null
  const r = new Decimal(referencia)
  if (r.isZero()) return null
  return porcentaje(new Decimal(valor).div(r).minus(1), { signo: true })
}

/** Número de una referencia para mostrar como ayuda ("1.531,70"). */
export function textoReferencia(valor: string | null): string | null {
  return valor === null ? null : numero(valor, 2)
}

/** Lee un monto tipeado (saldo o precio corregido a mano). */
export function leerMonto(texto: string, opciones: { positivo?: boolean } = {}): { valor: string | null; error: string | null } {
  if (texto.trim() === '') return { valor: null, error: 'Falta el valor.' }
  const v = leerNumeroAR(texto)
  if (v === null) return { valor: null, error: 'No lo entiendo como número.' }
  if (opciones.positivo && new Decimal(v).lte(0)) return { valor: null, error: 'Tiene que ser mayor que cero.' }
  return { valor: v, error: null }
}
