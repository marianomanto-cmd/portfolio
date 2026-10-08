// Fechas de calendario en America/Argentina/Cordoba y días hábiles (D-16).
// Una fecha es 'YYYY-MM-DD' sin hora: nunca depende de la zona del servidor.

import type { Feriado, Fecha } from './tipos'

export const ZONA = 'America/Argentina/Cordoba'

const fmtFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Día calendario de un instante en Córdoba. */
export function fechaEnCordoba(instante: Date): Fecha {
  return fmtFecha.format(instante) // en-CA da 'YYYY-MM-DD'
}

export function hoyCordoba(ahora: Date = new Date()): Fecha {
  return fechaEnCordoba(ahora)
}

function aUTC(f: Fecha): Date {
  const [a, m, d] = f.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

function deUTC(d: Date): Fecha {
  return d.toISOString().slice(0, 10)
}

export function sumarDias(f: Fecha, n: number): Fecha {
  const d = aUTC(f)
  d.setUTCDate(d.getUTCDate() + n)
  return deUTC(d)
}

export function diaSemana(f: Fecha): number {
  return aUTC(f).getUTCDay() // 0 domingo … 6 sábado
}

export function esHabil(f: Fecha, feriados: ReadonlySet<Fecha>): boolean {
  const ds = diaSemana(f)
  return ds !== 0 && ds !== 6 && !feriados.has(f)
}

export function conjuntoFeriados(fs: readonly Feriado[], mercado: Feriado['mercado'] = 'AR'): Set<Fecha> {
  return new Set(fs.filter((f) => f.mercado === mercado).map((f) => f.fecha))
}

/**
 * Días hábiles estrictamente después de `desde` y hasta `hasta` inclusive.
 * diasHabilesEntre('2026-10-09' vie, '2026-10-13' mar) = 2 (lun y mar), si no hay feriados.
 */
export function diasHabilesEntre(desde: Fecha, hasta: Fecha, feriados: ReadonlySet<Fecha>): number {
  if (hasta <= desde) return 0
  let n = 0
  for (let f = sumarDias(desde, 1); f <= hasta; f = sumarDias(f, 1)) {
    if (esHabil(f, feriados)) n++
  }
  return n
}

/** Un dato es viejo si tiene más de 2 días hábiles (D-16). */
export function esViejo(fechaDato: Fecha, hoy: Fecha, feriados: ReadonlySet<Fecha>): boolean {
  return diasHabilesEntre(fechaDato, hoy, feriados) > 2
}

/** Días corridos entre dos fechas. */
export function diasEntre(desde: Fecha, hasta: Fecha): number {
  return Math.round((aUTC(hasta).getTime() - aUTC(desde).getTime()) / 86_400_000)
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** "mié 14/10" */
export function fechaCorta(f: Fecha): string {
  const [, m, d] = f.split('-')
  return `${DIAS[diaSemana(f)]} ${d}/${m}`
}

/** "14/10/2026" */
export function fechaLarga(f: Fecha): string {
  const [a, m, d] = f.split('-')
  return `${d}/${m}/${a}`
}
