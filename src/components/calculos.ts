// Cálculos de presentación, en funciones puras con test (CLAUDE.md): cada uno
// devuelve el valor con su fórmula y sus insumos, como el motor. Ninguno inventa
// un dato: si falta una parte, el resultado es "sin dato" con la suma parcial.

import type { CalcVista, InsumoVista } from '@/lib/domain/calc'
import { Decimal, monto, numero, porcentaje } from '@/lib/domain/dinero'

type Unidad = 'ARS' | 'USD' | 'fraccion'

function fmt(v: Decimal | string, u: Unidad, signo = false): string {
  if (u === 'fraccion') return porcentaje(v, { signo })
  return monto(v, u, { decimales: 2, signo })
}

/**
 * Redondeo por resto mayor (visión §4.0): cuando una cifra se muestra junto con
 * sus partes, las partes se redondean de modo que lo que se ve suma exacto lo
 * que se ve. Devuelve el total redondeado y las partes ajustadas.
 * Si las partes no suman el total (no debería pasar), devuelve cada parte
 * redondeada por su lado.
 */
export function restoMayor(
  total: Decimal | string,
  partes: (Decimal | string)[],
  decimales = 0,
): { total: Decimal; partes: Decimal[] } {
  const T = new Decimal(total)
  const ps = partes.map((p) => new Decimal(p))
  const unidad = new Decimal(10).pow(-decimales)
  const totalRed = T.toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP)
  const pisos = ps.map((p) => p.div(unidad).floor().times(unidad))
  const restos = ps.map((p, i) => p.minus(pisos[i]))
  const faltan = totalRed.minus(pisos.reduce((a, b) => a.plus(b), new Decimal(0))).div(unidad)
  if (!faltan.isInteger() || faltan.isNegative() || faltan.gt(ps.length) || !ps.reduce((a, b) => a.plus(b), new Decimal(0)).minus(T).abs().lt(unidad.div(1000))) {
    return { total: totalRed, partes: ps.map((p) => p.toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP)) }
  }
  const orden = restos
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.cmp(a.r) || a.i - b.i)
    .slice(0, faltan.toNumber())
    .map((x) => x.i)
  return { total: totalRed, partes: pisos.map((p, i) => (orden.includes(i) ? p.plus(unidad) : p)) }
}

/**
 * Suma con traza de una columna de cifras ya calculadas. Si falta alguna, el
 * total es "sin dato" (D-65) y la suma parcial queda en `parcial`, también con
 * su traza, para mostrarla rotulada como parcial.
 */
export function sumaColumna(
  partes: { nombre: string; calc: CalcVista }[],
  unidad: Unidad,
  explicacion: string,
): { total: CalcVista; parcial: CalcVista | null; contadas: number; de: number } {
  const insumos: InsumoVista[] = partes.map((p) => ({ nombre: p.nombre, valor: p.calc.valor, unidad, calc: p.calc }))
  const con = partes.filter((p) => p.calc.valor !== null)
  const suma = con.reduce((a, p) => a.plus(p.calc.valor as string), new Decimal(0))
  const formula = con.length
    ? `${con.map((p) => fmt(p.calc.valor as string, unidad)).join(' + ')} = ${fmt(suma, unidad)}`
    : 'nada que sumar'
  if (con.length === partes.length) {
    return {
      total: { valor: suma.toFixed(), formula, explicacion, insumos, etiquetas: etiquetas(partes) },
      parcial: null,
      contadas: con.length,
      de: partes.length,
    }
  }
  const faltan = partes.filter((p) => p.calc.valor === null).map((p) => p.nombre)
  const motivo = `Falta${faltan.length > 1 ? 'n' : ''} ${faltan.join(', ')}. Suma parcial (${con.length} de ${partes.length}): ${fmt(suma, unidad, true)}.`
  return {
    total: { valor: null, motivo, formula: 'sin dato', explicacion, insumos, etiquetas: ['parcial'] },
    parcial: {
      valor: suma.toFixed(),
      formula: `suma parcial (${con.length} de ${partes.length}): ${formula}`,
      explicacion: `Suma de las filas que tienen dato. No es el total: faltan ${faltan.join(', ')}.`,
      insumos: insumos.filter((i) => i.valor !== null),
      etiquetas: ['parcial'],
    },
    contadas: con.length,
    de: partes.length,
  }
}

function etiquetas(partes: { calc: CalcVista }[]): CalcVista['etiquetas'] {
  const orden = ['parcial', 'pendiente', 'viejo', 'inferido', 'declarado'] as const
  const todas = new Set(partes.flatMap((p) => p.calc.etiquetas))
  return orden.filter((e) => todas.has(e))
}

/** Un monto en pesos pasado a dólares al CCL, con su traza. */
export function aDolares(ars: CalcVista, ccl: CalcVista, nombre: string, explicacion: string): CalcVista {
  const insumos: InsumoVista[] = [
    { nombre, valor: ars.valor, unidad: 'ARS', calc: ars },
    { nombre: 'CCL', valor: ccl.valor, unidad: 'ratio', calc: ccl },
  ]
  if (ars.valor === null || ccl.valor === null || new Decimal(ccl.valor).isZero()) {
    return {
      valor: null,
      motivo: ars.valor === null ? (ars.motivo ?? `Falta ${nombre}.`) : 'Falta el CCL para pasar a dólares.',
      formula: 'sin dato',
      explicacion,
      insumos,
      etiquetas: [...new Set([...ars.etiquetas, ...ccl.etiquetas])],
    }
  }
  const v = new Decimal(ars.valor).div(ccl.valor)
  return {
    valor: v.toFixed(),
    formula: `${monto(ars.valor, 'ARS', { decimales: 2 })} ÷ CCL ${numero(ccl.valor, 2)} = ${monto(v, 'USD', { decimales: 2 })}`,
    explicacion,
    insumos,
    etiquetas: [...new Set([...ars.etiquetas, ...ccl.etiquetas])],
  }
}

/** Cuánto cambia un monto si el CCL sube un porcentaje (sensibilidad, no pronóstico). */
export function porSubaDeCcl(base: CalcVista, pct: string, unidad: 'ARS' | 'USD', explicacion: string): CalcVista {
  const f = new Decimal(pct).div(100)
  if (base.valor === null) {
    return { valor: null, motivo: base.motivo ?? 'Falta la base.', formula: 'sin dato', explicacion, insumos: [{ nombre: 'Base', valor: null, unidad, calc: base }], etiquetas: base.etiquetas }
  }
  const v = new Decimal(base.valor).times(f)
  return {
    valor: v.toFixed(),
    formula: `${monto(base.valor, unidad, { decimales: 2 })} × ${numero(f, 4, { min: 2 })} = ${monto(v, unidad, { decimales: 2, signo: true })}`,
    explicacion,
    insumos: [
      { nombre: 'Base', valor: base.valor, unidad, calc: base },
      { nombre: 'Suba del CCL', valor: f.toFixed(), unidad: 'fraccion' },
    ],
    etiquetas: base.etiquetas,
  }
}

/** Compara dos cifras como decimales exactos, con "sin dato" al final. */
export function compararCifras(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return new Decimal(a).cmp(b)
}

/** Un resultado sobre su base, como fracción, con su traza ("sin dato" si falta algo o la base es cero). */
export function fraccionDe(num: CalcVista, den: CalcVista, unidad: 'ARS' | 'USD', explicacion: string): CalcVista {
  const insumos: InsumoVista[] = [
    { nombre: 'Resultado', valor: num.valor, unidad, calc: num },
    { nombre: 'Base', valor: den.valor, unidad, calc: den },
  ]
  if (num.valor === null || den.valor === null || new Decimal(den.valor).isZero()) {
    return { valor: null, motivo: num.valor === null ? (num.motivo ?? 'Falta el resultado.') : 'Falta la base o es cero.', formula: 'sin dato', explicacion, insumos, etiquetas: [...new Set([...num.etiquetas, ...den.etiquetas])] }
  }
  const f = new Decimal(num.valor).div(den.valor)
  return {
    valor: f.toFixed(),
    formula: `${monto(num.valor, unidad, { decimales: 2, signo: true })} ÷ ${monto(den.valor, unidad, { decimales: 2 })} = ${porcentaje(f, { signo: true })}`,
    explicacion,
    insumos,
    etiquetas: [...new Set([...num.etiquetas, ...den.etiquetas])],
  }
}

/** Decimales para mostrar un precio: los de bonos y letras por 1 VN necesitan más. */
export function decimalesPrecio(v: string | null): number {
  if (v === null) return 2
  const a = new Decimal(v).abs()
  if (a.isZero()) return 2
  if (a.lt('0.01')) return 6
  if (a.lt(100)) return 4
  return 2
}
