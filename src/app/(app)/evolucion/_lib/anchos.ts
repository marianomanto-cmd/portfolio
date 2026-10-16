// El ancho mínimo de una columna de montos de la Grilla (D-157: nunca scroll
// horizontal ni una cifra cortada), según lo que va a mostrar: el monto más
// largo de la columna, en la moneda que mirás, con su signo, su flecha y la
// pastilla de los dólares. Las cifras van en JetBrains Mono (monoespaciada),
// así que el ancho sale de contar caracteres. Pura y con test.

import { Decimal, monto } from '@/lib/domain/dinero'
import type { Par } from '@/lib/vistas/contratos'
import type { MonedaElegida } from '@/lib/vistas/contratos-evolucion'

/** Lo que mide un carácter de una cifra en la grilla (JetBrains Mono de 12 px: 0,6 em). */
export const PX_POR_CARACTER = 7.2
/** La pastilla dorada de los dólares: relleno y borde. */
const PASTILLA = 18
/** La flecha de color (▲ ▼) sale de otra fuente y mide un poco más que un carácter. */
const FLECHA = 6
/** El relleno de la celda y un margen. */
const CELDA = 17

/** El texto de una cifra como lo dibuja la celda ("+US$ 1.074,58 ▲", "sin dato"). */
export function textoCifra(valor: string | null, moneda: 'ARS' | 'USD', o: { signo?: boolean; color?: boolean } = {}): string {
  if (valor === null) return 'sin dato'
  const d = new Decimal(valor)
  const flecha = o.color && !d.isZero() ? (d.isNegative() ? ' ▼' : ' ▲') : ''
  return `${monto(valor, moneda, { decimales: moneda === 'ARS' ? 0 : 2, signo: o.signo })}${flecha}`
}

/**
 * El ancho mínimo (px) de una columna con estos pares, en la moneda elegida
 * (con "Ambas", el más ancho de los dos renglones), nunca menos que `minimo`
 * (lo que necesita el título de la columna).
 */
export function anchoMontos(pares: readonly (Par | null)[], moneda: MonedaElegida, o: { signo?: boolean; color?: boolean; minimo: number }): number {
  const monedas: ('ARS' | 'USD')[] = moneda === 'ars' ? ['ARS'] : moneda === 'usd' ? ['USD'] : ['ARS', 'USD']
  let max = 0
  for (const p of pares) {
    if (!p) continue
    for (const m of monedas) {
      const c = m === 'ARS' ? p.ars : p.usd
      const texto = textoCifra(c.valor, m, o)
      const px = texto.length * PX_POR_CARACTER + (m === 'USD' && c.valor !== null ? PASTILLA : 0) + (/[▲▼]$/.test(texto) ? FLECHA : 0)
      if (px > max) max = px
    }
  }
  return Math.max(o.minimo, Math.ceil(max + CELDA))
}
