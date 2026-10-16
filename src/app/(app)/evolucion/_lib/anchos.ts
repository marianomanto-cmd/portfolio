// Las medidas de las grillas de Evolución (D-157: nunca scroll horizontal ni
// una cifra cortada). El ancho mínimo de una columna de montos sale de lo que
// va a mostrar: el monto más largo de la columna, en la moneda que mirás, con
// su signo, su flecha y la pastilla de los dólares, y nunca menos que su
// título. Las cifras y los títulos van en JetBrains Mono (monoespaciada), así
// que el ancho sale de contar caracteres. Además, qué columnas del PnL por mes
// quedan siempre a la vista y el alto de las filas con el dedo. Puras y con test.

import type { MedidaColumna } from '@/components/grilla/columnas'
import { Decimal, monto } from '@/lib/domain/dinero'
import type { Par } from '@/lib/vistas/contratos'
import type { MesVista, MonedaElegida } from '@/lib/vistas/contratos-evolucion'

/** Lo que mide un carácter de una cifra en la grilla (JetBrains Mono de 12 px: 0,6 em). */
export const PX_POR_CARACTER = 7.2
/** La pastilla dorada de los dólares: relleno y borde. */
const PASTILLA = 18
/** La flecha de color (▲ ▼) sale de otra fuente y mide un poco más que un carácter. */
const FLECHA = 6
/** El relleno de la celda y un margen. */
const CELDA = 17
/** Lo que mide un carácter del título de una columna (JetBrains Mono de 10 px: 0,6 em, más 0,12 em de tracking). */
export const PX_POR_CARACTER_TITULO = 7.2
/** El relleno del encabezado (12 px de cada lado) y un margen. */
const ENCABEZADO = 26

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

/** El ancho (px) que pide el título de una columna para leerse entero, sin puntos suspensivos. */
export function anchoTitulo(titulo: string): number {
  return Math.ceil(titulo.length * PX_POR_CARACTER_TITULO + ENCABEZADO)
}

// ───────────── PnL por mes ─────────────

/** Las líneas del puente que son resultado (van con color y su flecha): lo que pusieron tus activos, el dólar y lo que quedó sin atribuir. */
export const LINEAS_RESULTADO: ReadonlySet<string> = new Set(['activo', 'tc', 'sin_atribuir'])

/** El ancho mínimo de la columna del mes ("oct-26"; lo parcial va debajo y corta en renglones). */
export const ANCHO_MES = 110

/**
 * Las medidas de las columnas del PnL por mes para la Grilla (el mes y una por
 * línea del puente): el ancho mínimo (la cifra más larga de la columna, o su
 * título) y la prioridad. A 768 px la tarjeta le deja a la grilla 600 px, y
 * las de prioridad 0 entran siempre: con la ficha ⋯, tienen que caber ahí.
 * Por eso a la vista quedan siempre el mes y lo que pusieron tus activos y el
 * dólar (0); el lugar que queda es primero para "sin atribuir" (1) y después
 * para los flujos: aportes y retiros, cuotas y amortización (2).
 */
export function medidasColumnasMes(meses: readonly MesVista[], claves: readonly string[], nombres: Readonly<Record<string, string>>, moneda: MonedaElegida): MedidaColumna[] {
  return [
    { id: 'mes', ancho: ANCHO_MES, prioridad: 0 },
    ...claves.map((c) => ({
      id: c,
      ancho: anchoMontos(
        meses.map((x) => x.lineas.find((y) => y.clave === c)?.valor ?? null),
        moneda,
        { signo: true, color: LINEAS_RESULTADO.has(c), minimo: anchoTitulo(nombres[c] ?? c) },
      ),
      prioridad: c === 'activo' || c === 'tc' ? 0 : c === 'sin_atribuir' ? 1 : 2,
    })),
  ]
}

// ───────────── El alto de las filas ─────────────

/** Una fila con una sola cifra por celda (y el mínimo con el dedo, D-100). */
const ALTO_UN_RENGLON = 44
/** Pesos arriba y dólares abajo, con el mouse. */
const ALTO_DOS_RENGLONES = 56
/** Pesos arriba y dólares abajo, con el dedo: dos tocables de 44 px (90 con el espacio entre los dos) y el aire de la celda, como Posiciones y Pasivos. */
export const ALTO_DOS_RENGLONES_TACTIL = 100

/**
 * El alto de las filas de una grilla de montos. Con una moneda, un renglón;
 * con "Ambas", dos cifras apiladas. Con el dedo (una tablet, o el teléfono
 * acostado: D-100) cada cifra es un tocable de 44 px, y dos (90 px) no entran
 * en una fila de 56: se pisaban con las de la fila de arriba y la de abajo.
 */
export function altoFilaMontos(moneda: MonedaElegida, grueso: boolean): number {
  if (moneda !== 'ambas') return ALTO_UN_RENGLON
  return grueso ? ALTO_DOS_RENGLONES_TACTIL : ALTO_DOS_RENGLONES
}
