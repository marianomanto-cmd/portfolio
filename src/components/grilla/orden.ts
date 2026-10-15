// El orden de la grilla (components/grilla): comparadores puros, con test. La
// grilla los usa para ordenar al tocar un encabezado y para las tarjetas del
// teléfono, que salen en el mismo orden.
//
// - Los montos llegan como texto decimal ("1234.5", "-0.001"): se comparan
//   exactos con decimal.js, nunca como texto ("9" > "10") ni pasando por float.
// - "Sin dato" (null) va siempre al final, en las dos direcciones: no es ni el
//   más chico ni el más grande.
// - Los textos se comparan en castellano, sin distinguir mayúsculas ni
//   tildes, y con los números adentro en su orden ("S13N6" antes que "S130").

import { Decimal } from '@/lib/domain/dinero'

export type ValorOrden = string | number | null | undefined

const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i

/** ¿Es un número escrito como texto decimal (el formato de los montos de las vistas)? */
export function esDecimal(v: ValorOrden): v is string {
  return typeof v === 'string' && DECIMAL.test(v.trim())
}

const textos = new Intl.Collator('es-AR', { sensitivity: 'base', numeric: true })

/** Compara dos valores en orden ascendente; "sin dato" (null o undefined) al final. */
export function compararAsc(a: ValorOrden, b: ValorOrden): number {
  const faltaA = a === null || a === undefined || a === ''
  const faltaB = b === null || b === undefined || b === ''
  if (faltaA && faltaB) return 0
  if (faltaA) return 1
  if (faltaB) return -1
  if (typeof a === 'number' && typeof b === 'number') return a === b ? 0 : a < b ? -1 : 1
  const na = typeof a === 'number' ? new Decimal(a) : esDecimal(a) ? new Decimal(a.trim()) : null
  const nb = typeof b === 'number' ? new Decimal(b) : esDecimal(b) ? new Decimal(b.trim()) : null
  if (na && nb) return na.cmp(nb)
  // Un número antes que un texto; dos textos, en castellano.
  if (na) return -1
  if (nb) return 1
  return textos.compare(String(a), String(b))
}

/**
 * El comparador que recibe AG Grid (`comparator`): la grilla invierte el
 * resultado cuando el orden es descendente, así que acá se compensa para que
 * "sin dato" quede al final también de mayor a menor.
 */
export function compararOrden(a: ValorOrden, b: ValorOrden, descendente = false): number {
  const faltaA = a === null || a === undefined || a === ''
  const faltaB = b === null || b === undefined || b === ''
  if (faltaA !== faltaB) return (faltaA ? 1 : -1) * (descendente ? -1 : 1)
  return compararAsc(a, b)
}

/** Ordena una lista como la grilla (para las tarjetas del teléfono): estable y con "sin dato" al final. */
export function ordenarFilas<T>(filas: readonly T[], valor: (f: T) => ValorOrden, direccion: 'asc' | 'desc'): T[] {
  return filas
    .map((f, i) => ({ f, i, v: valor(f) }))
    .sort((x, y) => {
      const r = compararOrden(x.v, y.v, direccion === 'desc')
      const signo = direccion === 'desc' ? -1 : 1
      return r === 0 ? x.i - y.i : r * signo
    })
    .map((x) => x.f)
}
