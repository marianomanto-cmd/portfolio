// La lectura de una pantalla (D-157, anatomía: pregunta → lectura → cifras
// clave → gráfico → detalle): una frase en serif con la respuesta y UN SOLO
// énfasis. La arman funciones puras de cada pantalla (como la frase de Hoy,
// components/hoy/frase.tsx) con estas piezas; el Encabezado solo la dibuja.
// Sin React: sirve en el servidor, en el cliente y en los tests.

import type { CalcVista } from '@/lib/domain/calc'

export interface ParteLectura {
  texto: string
  /** La única parte en itálica sangría. */
  enfasis?: boolean
  /** Una cifra calculada: se toca y abre su traza; el modo privado la tapa. */
  calc?: CalcVista | null
  /** El título de su traza ("Patrimonio neto · en pesos"). */
  titulo?: string
  moneda?: 'ARS' | 'USD'
}

/** Texto plano de la lectura. */
export const texto = (t: string): ParteLectura => ({ texto: t })

/**
 * La palabra (o las pocas palabras) en itálica sangría: una sola por lectura.
 * Puede ser una cifra ("llegás a *US$ 87.587*"): con `calc`, también abre su traza.
 */
export const enfasis = (t: string, calc?: CalcVista, titulo?: string, moneda?: 'ARS' | 'USD'): ParteLectura =>
  calc ? { texto: t, enfasis: true, calc, titulo, moneda } : { texto: t, enfasis: true }

/**
 * Una cifra de la lectura, ya formateada (`t`), con la traza de donde sale.
 * Una cifra "sin dato" no va en la lectura: la frase dice qué falta.
 */
export const cifra = (t: string, calc: CalcVista, titulo: string, moneda?: 'ARS' | 'USD'): ParteLectura => ({ texto: t, calc, titulo, moneda })

/**
 * ¿Está bien armada? Exactamente un énfasis, ninguna parte vacía, y ninguna
 * cifra en "sin dato" (la lectura no muestra "sin dato" ni ceros inventados:
 * cuando falta algo, la frase lo dice con palabras).
 */
export function validarLectura(partes: readonly ParteLectura[]): { ok: true } | { ok: false; motivo: string } {
  const enfasis = partes.filter((p) => p.enfasis).length
  if (enfasis !== 1) return { ok: false, motivo: `La lectura lleva un solo énfasis y tiene ${enfasis}.` }
  if (partes.some((p) => p.texto.trim() === '')) return { ok: false, motivo: 'Hay una parte vacía.' }
  const sinDato = partes.find((p) => p.calc && p.calc.valor === null)
  if (sinDato) return { ok: false, motivo: `La cifra "${sinDato.texto}" es "sin dato": la frase tiene que decir qué falta.` }
  return { ok: true }
}

/** La lectura de corrido, sin marcas (para el título de la página, un aria-label o los tests). */
export function lecturaPlana(partes: readonly ParteLectura[]): string {
  return partes.map((p) => p.texto).join('').replace(/\s+/g, ' ').trim()
}
