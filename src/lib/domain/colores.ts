// Un color por activo, el mismo en todos los gráficos (spec §UI), con las
// familias del sistema visual (D-157). Funciones puras, sin dependencias: las
// usan la foto (motor), las vistas y los gráficos.
//
// - Dolarizados (CEDEARs y todo lo que arriesga dólares): la familia dorada.
// - Renta fija y lo demás en pesos: la familia de tinta cálida (piedra).
// - Liquidez: gris lavanda; la de dólares, un oro apagado.
// - Pasivos: sangría.
//
// La asignación es estable: dentro de cada familia, por orden de alta (id). Un
// activo nuevo toma el color siguiente y no le cambia el color a ninguno de los
// que ya estaban. Un color elegido a mano en Datos › Catálogo manda.

/** CEDEARs y dolarizados: el primero, el más claro. */
export const PALETA_DOLAR = ['#F0B86A', '#E0A458', '#C08540', '#9C6A33', '#7A5226'] as const
/** Renta fija y demás activos en pesos. */
export const PALETA_PESOS = ['#C7BDAB', '#A89E8B', '#DDD6C7'] as const
export const COLOR_LIQUIDEZ_ARS = '#8C8696'
export const COLOR_LIQUIDEZ_USD = '#B39B72'
export const COLOR_PASIVO = '#F23A5E'
export const COLOR_BIEN = '#9D8FB0'
/** El texto sobre un segmento de color (barras apiladas): casi negro, en mono 10 px. */
export const TINTA_SOBRE_SEGMENTO = '#0A0810'
/** Lo que todavía no tiene moneda de riesgo elegida (los bienes, D-73): ni pesos ni dólares. */
export const COLOR_SIN_ELEGIR = '#6E6878'

/** Por moneda de riesgo (composición y exposición): los pesos en piedra, los dólares en oro (D-157). */
export const COLOR_MONEDA: Readonly<Record<'ARS' | 'USD' | 'sin_elegir', string>> = {
  ARS: PALETA_PESOS[1],
  USD: PALETA_DOLAR[1],
  sin_elegir: COLOR_SIN_ELEGIR,
}
/** Lo financiero entero, al lado de la casa y la camioneta (el activo del Balance). */
export const COLOR_FINANCIERO = PALETA_PESOS[0]
/** Por liquidez (D-132): lo disponible hoy como la liquidez, lo que se vende en el mercado en piedra clara y lo ilíquido como los bienes. */
export const COLOR_POR_LIQUIDEZ: Readonly<Record<'disponible' | 'mercado' | 'iliquido', string>> = {
  disponible: COLOR_LIQUIDEZ_ARS,
  mercado: PALETA_PESOS[2],
  iliquido: COLOR_BIEN,
}

export type Familia = 'dolar' | 'pesos' | 'liquidez'

/** La familia de color de un activo: la decide la moneda en que arriesga, no el bróker. */
export function familiaDe(a: { tipo: string; moneda_riesgo: 'ARS' | 'USD' }): Familia {
  if (a.tipo === 'liquidez') return 'liquidez'
  return a.moneda_riesgo === 'USD' || a.tipo === 'cedear' ? 'dolar' : 'pesos'
}

// ───────────── OKLCH → sRGB (para los colores que siguen a la paleta base) ─────────────

const TONO = { dolar: { c: 0.11, h: 70 }, pesos: { c: 0.025, h: 80 }, liquidez: { c: 0.02, h: 305 } } as const

function aHex(r: number, g: number, b: number): string {
  const canal = (x: number) => {
    const v = Math.round(Math.min(1, Math.max(0, x)) * 255)
    return v.toString(16).padStart(2, '0').toUpperCase()
  }
  return `#${canal(r)}${canal(g)}${canal(b)}`
}

/** Un color OKLCH (L 0–1, C, h en grados) en sRGB hexadecimal, recortado a la gama. */
export function oklchAHex(l: number, c: number, h: number): string {
  const rad = (h * Math.PI) / 180
  const a = c * Math.cos(rad)
  const b = c * Math.sin(rad)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const [L, M, S] = [l_ ** 3, m_ ** 3, s_ ** 3]
  const lineal = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ]
  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055)
  const [r, g, bl] = lineal.map(gamma)
  return aHex(r, g, bl)
}

/** Van der Corput en base 2: 0,5 · 0,25 · 0,75 · 0,125… (reparte sin repetir y sin depender de cuántos hay). */
function corput(n: number): number {
  let v = 0
  let f = 0.5
  for (let k = n; k > 0; k >>= 1, f /= 2) if (k & 1) v += f
  return v
}

/**
 * El color k-ésimo (0, 1, 2…) de una familia: los de la paleta base y, después,
 * la misma tinta con otra luminosidad (L entre 0,45 y 0,85 en OKLCH). Depende
 * solo de k: agregar un activo no cambia los colores de los anteriores.
 */
export function colorDeFamilia(f: Familia, k: number): string {
  const base: readonly string[] = f === 'dolar' ? PALETA_DOLAR : f === 'pesos' ? PALETA_PESOS : [COLOR_LIQUIDEZ_ARS]
  if (k < base.length) return base[k]
  const t = TONO[f]
  return oklchAHex(0.45 + 0.4 * corput(k - base.length + 1), t.c, t.h)
}

export interface ActivoColor {
  id: number
  tipo: string
  moneda_riesgo: 'ARS' | 'USD'
  /** El color elegido a mano en el catálogo, si hay. */
  color: string | null
}

/**
 * El color de cada activo del catálogo: el elegido a mano o el de su familia
 * por orden de alta (id). Se calcula sobre el catálogo entero (también los
 * dados de baja), así un activo conserva su color aunque otro deje de estar.
 */
export function coloresDeActivos(activos: readonly ActivoColor[]): Map<number, string> {
  const out = new Map<number, string>()
  const contadores: Record<Familia, number> = { dolar: 0, pesos: 0, liquidez: 0 }
  for (const a of [...activos].sort((x, y) => x.id - y.id)) {
    const f = familiaDe(a)
    const propio = a.color && /^#[0-9a-fA-F]{6}$/.test(a.color) ? a.color : null
    // Todos ocupan su lugar en la familia, también el que tiene color propio:
    // elegirle un color a uno no les cambia el color a los que vinieron después.
    const derivado = colorDeFamilia(f, contadores[f]++)
    out.set(a.id, propio ?? derivado)
  }
  return out
}
