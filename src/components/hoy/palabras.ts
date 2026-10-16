// Números en palabras para las lecturas (D-157: una frase en serif con la
// respuesta). Funciones puras, con test (palabras.test.ts). Las usan la
// lectura de Hoy y la de Posiciones.

const ANCLAS: readonly { v: number; t: string; plural: boolean }[] = [
  { v: 1 / 10, t: 'un décimo', plural: false },
  { v: 1 / 5, t: 'un quinto', plural: false },
  { v: 1 / 4, t: 'un cuarto', plural: false },
  { v: 1 / 3, t: 'un tercio', plural: false },
  { v: 1 / 2, t: 'la mitad', plural: false },
  { v: 2 / 3, t: 'dos tercios', plural: true },
  { v: 3 / 4, t: 'tres cuartos', plural: true },
  { v: 1, t: 'todo', plural: false },
]

/** Cuánto se acepta como "exacto" alrededor de cada fracción. */
const TOLERANCIA = 0.015

export interface FraccionEnPalabras {
  /** "casi ", "más de " o nada. */
  antes: string
  /** La fracción: "un tercio", "tres cuartos", "todo"… (va en el énfasis de la lectura). */
  nucleo: string
  /** Para el verbo: "dos tercios vinieron", "la mitad vino". */
  plural: boolean
}

/**
 * Una fracción entre 0 y 1 dicha como la diría una persona: la fracción común
 * más cercana, con "casi" si queda por debajo y "más de" si queda por encima
 * (0,727 → "casi tres cuartos"; 0,55 → "más de la mitad"; 0,98 → "casi todo").
 * Menos de 0,05 es "muy poco". Fuera de [0, 1] se recorta.
 */
export function fraccionEnPalabras(f: number): FraccionEnPalabras {
  const x = Math.min(1, Math.max(0, f))
  if (x < 0.05) return { antes: '', nucleo: 'muy poco', plural: false }
  let mejor = ANCLAS[0]
  for (const a of ANCLAS) if (Math.abs(x - a.v) < Math.abs(x - mejor.v)) mejor = a
  const d = x - mejor.v
  const antes = Math.abs(d) <= TOLERANCIA ? '' : d < 0 ? 'casi ' : 'más de '
  return { antes, nucleo: mejor.t, plural: mejor.plural }
}

const NUMEROS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte']

const mayuscula = (s: string) => s.charAt(0).toLocaleUpperCase('es-AR') + s.slice(1)

/**
 * Una cantidad con su sustantivo femenino, en palabras hasta veinte y en
 * cifras después: "Seis posiciones", "Una posición", "23 posiciones".
 */
export function cantidadEnPalabras(n: number, singular: string, plural: string, conMayuscula = true): string {
  const num = n >= 0 && n <= 20 && Number.isInteger(n) ? NUMEROS[n] : String(n)
  const t = `${num} ${n === 1 ? singular : plural}`
  return conMayuscula ? mayuscula(t) : t
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "Jueves 15 de octubre" (la pregunta de Hoy lleva la fecha). La fecha es 'YYYY-MM-DD', sin zona. */
export function fechaEnPalabras(f: string): string {
  const [a, m, d] = f.split('-').map(Number)
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  return `${mayuscula(DIAS[dia])} ${d} de ${MESES[m - 1]}`
}

/** "SPY", "SPY y YPFD", "SPY, YPFD y FIMA". */
export function enLista(xs: readonly string[]): string {
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}
