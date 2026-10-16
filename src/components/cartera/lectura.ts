// La lectura de Posiciones (D-157, anatomía 2; handoff, captura 03): cuántas
// posiciones tenés y cuál explica más de lo que ganaste (o perdiste) en
// pesos, con un solo énfasis en la fracción. Y las cifras clave que no son
// sumas: la mejor y la peor en dólares. Puras, con test (lectura.test.ts).
// Lo que falta se dice con palabras, nunca con un cero.

import { Decimal } from '@/lib/domain/dinero'
import type { FilaCartera, VistaCartera } from '@/lib/vistas/contratos'
import { enfasis, texto, type ParteLectura } from '@/components/pantalla/lectura'
import { cantidadEnPalabras, enLista, fraccionEnPalabras } from '@/components/hoy/palabras'
import { esLiquidez } from './cuentas'

const dec = (v: string | null) => (v === null ? null : new Decimal(v))

/**
 * "Seis posiciones. SPY explica casi *tres cuartos* de lo que ganaste en pesos."
 * Con pérdida, "de lo que perdiste"; si una sola ganó más que todo junto, lo
 * dice; si al resultado le falta una fila, dice cuál.
 */
export function lecturaPosiciones(v: Pick<VistaCartera, 'filas' | 'totales'>): ParteLectura[] {
  const pos = v.filas.filter((f) => !esLiquidez(f))
  if (pos.length === 0) return [texto('Todavía no tenés '), enfasis('posiciones'), texto(': aparecen con tu primera carga.')]
  const cuantas = `${cantidadEnPalabras(pos.length, 'posición', 'posiciones')}. `
  const faltan = pos.filter((f) => f.resultado.ars.valor === null).map((f) => f.ticker)
  const total = dec(v.totales.resultado.ars.valor)
  if (faltan.length || total === null) {
    return [texto(cuantas), texto('Al resultado en pesos le '), enfasis(faltan.length > 1 ? 'faltan datos' : 'falta un dato'), texto(faltan.length ? `: ${enLista(faltan)}.` : '.')]
  }
  if (total.isZero()) return [texto(cuantas), texto('En pesos, por ahora, '), enfasis('ni ganaste ni perdiste'), texto('.')]
  const gano = total.gt(0)
  // La que más empuja hacia el lado del total.
  let elegida: FilaCartera | null = null
  let valor: Decimal | null = null
  for (const f of pos) {
    const r = dec(f.resultado.ars.valor)
    if (r === null) continue
    if (valor === null || (gano ? r.gt(valor) : r.lt(valor))) {
      elegida = f
      valor = r
    }
  }
  if (!elegida || valor === null || (gano ? !valor.gt(0) : !valor.lt(0))) return [texto(cuantas), texto('Ninguna explica '), enfasis(gano ? 'lo que ganaste' : 'lo que perdiste'), texto(' en pesos por sí sola.')]
  const lo = gano ? 'lo que ganaste en pesos' : 'lo que perdiste en pesos'
  const parte = valor.div(total).toNumber()
  if (parte > 1.005) return [texto(cuantas), texto(`${elegida.ticker} ${gano ? 'ganó' : 'perdió'} `), enfasis('más que todo'), texto(` ${lo}: el resto ${gano ? 'restó' : 'sumó'}.`)]
  const fr = fraccionEnPalabras(parte)
  return [texto(cuantas), texto(`${elegida.ticker} explica ${fr.antes}`), enfasis(fr.nucleo), texto(`${fr.nucleo === 'todo' ? '' : ' de'} ${lo}.`)]
}

/**
 * Las cifras clave que no son sumas (handoff): la mejor posición por su
 * resultado en pesos (%) y la peor en dólares (%). Solo las que tienen el
 * dato; sin ninguna, null (la tarjeta dice "sin dato").
 */
export function extremos(filas: readonly FilaCartera[]): { mejor: FilaCartera | null; peorUsd: FilaCartera | null } {
  let mejor: FilaCartera | null = null
  let peorUsd: FilaCartera | null = null
  for (const f of filas) {
    if (esLiquidez(f)) continue
    const a = dec(f.resultado_pct.ars.valor)
    const u = dec(f.resultado_pct.usd.valor)
    if (a !== null && (mejor === null || a.gt(dec(mejor.resultado_pct.ars.valor) as Decimal))) mejor = f
    if (u !== null && (peorUsd === null || u.lt(dec(peorUsd.resultado_pct.usd.valor) as Decimal))) peorUsd = f
  }
  return { mejor, peorUsd }
}
