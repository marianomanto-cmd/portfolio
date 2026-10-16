// La tinta del rótulo adentro de un tramo de color (las barras de largo y
// corto y las de la apertura): casi negra sobre los colores claros, como en el
// diseño, y clara sobre los oscuros (un bien "sin elegir", un activo de una
// familia con muchos), para que se lea con contraste AA (4,5:1, D-157). Pura y
// con test.

import { TINTA_SOBRE_SEGMENTO } from '@/lib/domain/colores'

/** La tinta clara: el texto del tema oscuro. */
export const TINTA_CLARA = '#F4F1EA'

/** La luminancia relativa de un color #RRGGBB (WCAG 2.x); null si no es un hexadecimal de 6 dígitos. */
export function luminancia(hex: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const canal = (i: number) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4)
}

/** El contraste entre dos colores (de 1 a 21); null si alguno no se entiende. */
export function contraste(a: string, b: string): number | null {
  const la = luminancia(a)
  const lb = luminancia(b)
  if (la === null || lb === null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** El contraste mínimo de un texto chico (AA). */
export const AA = 4.5

/** De dos tintas, la que más contrasta con el fondo. */
function mejor(fondo: string, a: string, b: string): { tinta: string; contraste: number } {
  const ca = contraste(fondo, a) as number
  const cb = contraste(fondo, b) as number
  return cb > ca ? { tinta: b, contraste: cb } : { tinta: a, contraste: ca }
}

/**
 * La tinta que más contrasta con el fondo: la oscura del diseño o la clara. Si
 * ninguna llega a AA (un tono medio, como el oro oscuro), negro o blanco puros:
 * uno de los dos siempre llega (el peor caso da 4,58:1). Con un color que no se
 * entiende, la del diseño.
 */
export function tintaSobre(fondo: string): string {
  if (luminancia(fondo) === null) return TINTA_SOBRE_SEGMENTO
  const m = mejor(fondo, TINTA_SOBRE_SEGMENTO, TINTA_CLARA)
  return m.contraste >= AA ? m.tinta : mejor(fondo, '#000000', '#FFFFFF').tinta
}
