// Tiempo activo de la carga (D-62 de la visión): mide los 60 segundos de
// verdad. Suma los intervalos entre gestos (tipear, pegar, tocar, soltar); un
// intervalo de más de 60 s sin gestos corta el tramo y no cuenta. Así, la
// media hora que dejaste la pestaña abierta no se suma.

export const CORTE_MS = 60_000

export interface Reloj {
  /** Primer gesto de la carga (ms). */
  inicio: number | null
  /** Último gesto (ms). */
  ultimo: number | null
  /** Tiempo activo acumulado hasta el último gesto. */
  activoMs: number
  /** Tramos de actividad (1 + cortes de más de 60 s). */
  tramos: number
}

export function relojNuevo(): Reloj {
  return { inicio: null, ultimo: null, activoMs: 0, tramos: 0 }
}

/** Registra un gesto en el instante `t` (ms). Puro: devuelve un reloj nuevo. */
export function registrarGesto(r: Reloj, t: number): Reloj {
  if (r.ultimo === null) return { inicio: t, ultimo: t, activoMs: 0, tramos: 1 }
  const intervalo = t - r.ultimo
  if (intervalo < 0) return r // un reloj que va para atrás no resta ni suma
  if (intervalo <= CORTE_MS) return { ...r, ultimo: t, activoMs: r.activoMs + intervalo }
  return { ...r, ultimo: t, tramos: r.tramos + 1 }
}

/** De punta a punta: del primer gesto al último (para el Registro). */
export function puntaAPuntaMs(r: Reloj): number | null {
  return r.inicio === null || r.ultimo === null ? null : r.ultimo - r.inicio
}

/** "41 s", "1 min 05 s". */
export function textoDuracion(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const resto = s % 60
  return `${m} min ${String(resto).padStart(2, '0')} s`
}
