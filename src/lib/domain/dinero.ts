// Plata exacta (D-32). Todo monto vive en Decimal desde que sale de la base
// hasta que se muestra. La base manda los numeric como texto (::text): este
// módulo es el único lugar que los convierte, y se niega a recibir un número
// de JavaScript, para que un cast olvidado falle a la vista y no en silencio.

import Decimal from 'decimal.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN })

export { Decimal }

/** Texto de la base → Decimal. NULL o vacío = "sin dato" (null). */
export function dec(v: string | null | undefined): Decimal | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') {
    throw new TypeError(
      `Monto recibido como ${typeof v}. Los numeric se leen con ::text (D-32).`,
    )
  }
  const t = v.trim()
  if (t === '') return null
  const d = new Decimal(t)
  if (!d.isFinite()) throw new RangeError(`Monto no finito: ${v}`)
  return d
}

/** Como dec(), pero el dato es obligatorio. */
export function decReq(v: string | null | undefined, campo: string): Decimal {
  const d = dec(v)
  if (d === null) throw new Error(`Falta ${campo}`)
  return d
}

/** Decimal → texto para mandar a la base (exacto, sin notación científica). */
export function aTexto(d: Decimal | null): string | null {
  return d === null ? null : d.toFixed()
}

export const CERO = new Decimal(0)
export const UNO = new Decimal(1)
export const CIEN = new Decimal(100)

export function suma(xs: readonly Decimal[]): Decimal {
  return xs.reduce((a, b) => a.plus(b), CERO)
}

/** Suma que propaga "sin dato": si falta una parte, el total es null. */
export function sumaEstricta(xs: readonly (Decimal | null)[]): Decimal | null {
  let t = CERO
  for (const x of xs) {
    if (x === null) return null
    t = t.plus(x)
  }
  return t
}

// ───────────── Formato es-AR ─────────────
// Los formatters se crean una vez a nivel módulo: instanciar Intl.NumberFormat
// es caro y una tabla de 25 filas × 12 columnas lo nota.

const MENOS = '−' // U+2212: el guion común se confunde con un separador

const nfCache = new Map<string, Intl.NumberFormat>()
function nf(min: number, max: number): Intl.NumberFormat {
  const k = `${min}:${max}`
  let f = nfCache.get(k)
  if (!f) {
    f = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      useGrouping: true,
    })
    nfCache.set(k, f)
  }
  return f
}

/** Formatea un decimal exacto en es-AR. Recibe Decimal o texto decimal. */
export function numero(
  v: Decimal | string,
  decimales = 2,
  opciones: { min?: number; signo?: boolean } = {},
): string {
  const d = typeof v === 'string' ? new Decimal(v) : v
  const min = opciones.min ?? decimales
  const fijo = d.toDecimalPlaces(decimales, Decimal.ROUND_HALF_EVEN)
  const abs = fijo.abs().toFixed(decimales)
  // Intl acepta strings decimales: formatea sin pasar por float.
  const cuerpo = nf(min, decimales).format(abs as unknown as number)
  if (fijo.isZero()) return cuerpo
  if (fijo.isNegative()) return MENOS + cuerpo
  return opciones.signo ? '+' + cuerpo : cuerpo
}

export type Moneda = 'ARS' | 'USD'

/** "$ 1.234.567" o "US$ 1.234,56", con signo opcional. */
export function monto(
  v: Decimal | string,
  moneda: Moneda,
  opciones: { decimales?: number; signo?: boolean } = {},
): string {
  const d = typeof v === 'string' ? new Decimal(v) : v
  const decimales = opciones.decimales ?? (moneda === 'ARS' ? 0 : 2)
  const n = numero(d.abs(), decimales)
  const simbolo = moneda === 'ARS' ? '$' : 'US$'
  const s = d.toDecimalPlaces(decimales).isZero()
    ? ''
    : d.isNegative()
      ? MENOS
      : opciones.signo
        ? '+'
        : ''
  return `${s}${simbolo} ${n}`
}

/** Porcentaje a partir de una fracción (0,0123 → "1,23%"). */
export function porcentaje(
  fraccion: Decimal | string,
  opciones: { decimales?: number; signo?: boolean } = {},
): string {
  const d = typeof fraccion === 'string' ? new Decimal(fraccion) : fraccion
  return `${numero(d.times(100), opciones.decimales ?? 2, { signo: opciones.signo })}%`
}

/**
 * Formato compacto para tarjetas en el teléfono: "US$ 67,4k", "$ 104,3 M".
 * La unidad se elige después de redondear: 999.960 es "$ 1,0 M", no
 * "$ 1.000,0k" (B25).
 */
export function compacto(v: Decimal | string, moneda: Moneda): string {
  const d = typeof v === 'string' ? new Decimal(v) : v
  const abs = d.abs()
  const simbolo = moneda === 'ARS' ? '$' : 'US$'
  const decimales = moneda === 'ARS' ? 0 : 2
  const red = (x: Decimal, n: number) => x.toDecimalPlaces(n, Decimal.ROUND_HALF_EVEN)
  const enMiles = red(abs.div(1_000), 1)
  let cuerpo: string
  let cero = false
  if (abs.gte(1_000_000) || enMiles.gte(1_000)) {
    cuerpo = `${numero(red(abs.div(1_000_000), 1), 1)} M`
  } else if (abs.gte(1_000) || red(abs, decimales).gte(1_000)) {
    cuerpo = `${numero(enMiles, 1)}k`
  } else {
    cero = red(abs, decimales).isZero()
    cuerpo = numero(abs, decimales)
  }
  const s = d.isNegative() && !cero ? MENOS : ''
  return `${s}${simbolo} ${cuerpo}`
}

/**
 * Lee un número escrito en formato argentino ("1.234,56", "1234,5", "1548.2").
 * Devuelve el texto decimal normalizado ("1234.56") o null si no es un número
 * o si es ambiguo. Reglas (B24):
 * - Con coma: la coma es el decimal y los puntos, separadores de miles, solo
 *   en grupos válidos ("1.234.567,8"). Un punto después de la coma ("1,548.20")
 *   o dos comas: null.
 * - Sin coma: un solo punto seguido de 1 o 2 dígitos es decimal ("1548.2");
 *   seguido de 3, son miles si el grupo es válido ("1.548", no "1234.567");
 *   seguido de 4 o más ("1.0852"): null, nunca miles. Con un entero 0 ("0.125")
 *   el punto solo puede ser decimal. Varios puntos: miles en grupos válidos
 *   ("12.345.678"); si no ("12.34.56"), null.
 */
export function leerNumeroAR(entrada: string): string | null {
  let t = entrada.trim().replace(/\s/g, '').replace(/^\$|^US\$|^U\$S/i, '')
  t = t.replace(/[−–]/g, '-')
  if (t === '' || t === '-') return null
  const negativo = t.startsWith('-')
  const cuerpo = negativo ? t.slice(1) : t
  const miles = /^\d{1,3}(\.\d{3})+$/
  // Un grupo de miles no empieza con 0 (salvo el número 0 mismo, que no los lleva).
  const milesValidos = (x: string) => miles.test(x) && !x.startsWith('0')
  let normal: string
  const comas = cuerpo.split(',').length - 1
  if (comas > 1) return null
  if (comas === 1) {
    const [entero, fraccion] = cuerpo.split(',')
    if (fraccion.includes('.') || !/^\d+$/.test(fraccion)) return null
    if (entero.includes('.')) {
      if (!milesValidos(entero)) return null
      normal = `${entero.replace(/\./g, '')}.${fraccion}`
    } else {
      if (!/^\d+$/.test(entero)) return null
      normal = `${entero}.${fraccion}`
    }
  } else {
    const puntos = cuerpo.split('.').length - 1
    if (puntos === 0) {
      normal = cuerpo
    } else if (puntos === 1) {
      const [entero, fraccion] = cuerpo.split('.')
      if (!/^\d+$/.test(entero) || !/^\d+$/.test(fraccion)) return null
      if (fraccion.length <= 2 || /^0+$/.test(entero)) normal = cuerpo
      else if (fraccion.length === 3 && milesValidos(cuerpo)) normal = entero + fraccion
      else return null
    } else {
      if (!milesValidos(cuerpo)) return null
      normal = cuerpo.replace(/\./g, '')
    }
  }
  if (!/^\d+(\.\d+)?$/.test(normal)) return null
  return new Decimal(negativo ? `-${normal}` : normal).toFixed()
}
