// Las cuentas de las barras de Hoy (handoff, capturas 01 y 02): qué ancho
// tiene cada tramo y de qué color. Puras, con test (barras.test.ts): la
// pantalla solo dibuja lo que devuelven. Los anchos son proporciones de lo
// que se ve; las cifras exactas están en la traza de cada número.

import { Decimal, numero, porcentaje } from '@/lib/domain/dinero'
import type { CalcVista } from '@/lib/domain/calc'
import type { SeriePatrimonio } from '@/lib/vistas/contratos-hoy'

/**
 * El color de un resultado (D-157): verde si suma, sangría si resta y tinta si
 * redondea a cero en lo que se ve (con `decimales`). Va con su signo, siempre.
 */
export function tonoDe(valor: string | null, decimales = 0): 'text-positive' | 'text-negative' | '' {
  if (valor === null) return ''
  const d = new Decimal(valor).toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP)
  return d.isZero() ? '' : d.isNegative() ? 'text-negative' : 'text-positive'
}

/** Un ancho CSS con 2 decimales ("32.18%"). */
const pct = (f: Decimal) => `${f.times(100).toDecimalPlaces(2).toFixed()}%`

const dec = (v: string | null | undefined) => (v === null || v === undefined ? null : new Decimal(v))

export interface TramoBarra {
  clave: 'activos' | 'tc' | 'sin_atribuir'
  ancho: string
  /** Lo que resta va en sangría (una pérdida); lo que suma, en su color. */
  negativo: boolean
}

/**
 * "Variación del día · de dónde vino": un tramo por parte (tus activos, el
 * CCL y, si hay, lo sin atribuir), cada uno proporcional a su tamaño en
 * pesos (|parte| ÷ suma de |partes|). Vacía si falta alguna parte (null:
 * "sin dato", también lo sin atribuir) o si todas son cero: no se inventa una
 * barra. Sin nada sin atribuir, la tercera parte es '0'.
 */
export function barraVariacion(activos: string | null, tc: string | null, sinAtribuir: string | null = '0'): TramoBarra[] {
  const partes = [
    { clave: 'activos' as const, v: dec(activos) },
    { clave: 'tc' as const, v: dec(tc) },
    { clave: 'sin_atribuir' as const, v: dec(sinAtribuir) },
  ]
  if (partes.some((p) => p.v === null)) return []
  const total = partes.reduce((a, p) => a.plus((p.v as Decimal).abs()), new Decimal(0))
  if (total.isZero()) return []
  return partes
    .filter((p) => !(p.v as Decimal).isZero())
    .map((p) => ({ clave: p.clave, ancho: pct((p.v as Decimal).abs().div(total)), negativo: (p.v as Decimal).isNegative() }))
}

/**
 * "Exposición neta al peso": la barra divergente con el eje en el medio. Corto
 * (debés más pesos de los que tenés) va a la izquierda, en sangría; largo, a
 * la derecha. El ancho es el neto sobre lo más grande entre tus pesos y tu
 * deuda en pesos (hasta la mitad de la barra). Sin el neto, sin barra.
 */
export function barraExposicion(neto: string | null, pesos: string | null, deuda: string | null): { lado: 'corto' | 'largo' | null; ancho: string } {
  const n = dec(neto)
  if (n === null || n.isZero()) return { lado: null, ancho: '0%' }
  const escala = Decimal.max(dec(pesos)?.abs() ?? 0, dec(deuda)?.abs() ?? 0, n.abs())
  return { lado: n.isNegative() ? 'corto' : 'largo', ancho: pct(Decimal.min(n.abs().div(escala), 1).div(2)) }
}

export interface BarraExcedente {
  gastos: string
  cuota: string
  sobrante: string
  /** Gastos y cuota pasan a los ingresos: el mes no alcanza (no hay tramo de "lo que sobra"). */
  falta: boolean
}

/**
 * "Excedente invertible": gastos fijos, cuota y lo que sobra, en proporción a
 * los ingresos (o a gastos + cuota, si pasan a los ingresos). null si falta
 * alguna parte: la tarjeta dice "sin dato" con el motivo.
 */
export function barraExcedente(ingresos: string | null, gastos: string | null, cuota: string | null): BarraExcedente | null {
  const i = dec(ingresos)
  const g = dec(gastos)?.abs() ?? null
  const c = dec(cuota)?.abs() ?? null
  if (i === null || g === null || c === null) return null
  const salidas = g.plus(c)
  const base = Decimal.max(i, salidas)
  if (base.lte(0)) return null
  const sobra = Decimal.max(i.minus(salidas), 0)
  return { gastos: pct(g.div(base)), cuota: pct(c.div(base)), sobrante: pct(sobra.div(base)), falta: salidas.gt(i) }
}

/** La aclaración del excedente: qué es real y qué sigue proyectado. */
export function notaExcedente(reales: { ingresos: boolean; gastos: boolean } | null): string {
  if (!reales || (!reales.ingresos && !reales.gastos)) return 'Proyectado; el real se cierra a fin de mes.'
  if (reales.ingresos && reales.gastos) return 'Con lo real que cargaste este mes.'
  return reales.ingresos ? 'Con tu ingreso real; los gastos, proyectados.' : 'Con tus gastos reales; el ingreso, proyectado.'
}

/** El ancho de un tramo de "Qué tenés y qué debés" a partir de su peso (fracción). null si no se dibuja. */
export function anchoTramo(peso: string | null): string | null {
  const p = dec(peso)
  if (p === null || !p.gt(0)) return null
  return pct(Decimal.min(p, 1))
}

/** El neto (o lo que sea) sobre el activo total, como ancho: "95.27%". null si falta o no es positivo. */
export function anchoSobre(parte: string | null, total: string | null): string | null {
  const p = dec(parte)
  const t = dec(total)
  if (p === null || t === null || !t.gt(0) || !p.gt(0)) return null
  return pct(Decimal.min(p.div(t), 1))
}

/**
 * La mini barra de "% cartera" de Posiciones (handoff, captura 03): el peso
 * de la fila sobre el más grande de la tabla, para que la barra más larga
 * llene la caja. null si no se dibuja (sin dato o negativo).
 */
export function anchoRelativo(peso: string | null, maximo: string | null): string | null {
  return anchoSobre(peso, maximo)
}

const signoPct = (c: CalcVista) => (c.valor === null ? null : porcentaje(c.valor, { decimales: 1, signo: true }))

/** Una parte del pie del gráfico: texto, o una cifra con la traza de donde sale. */
export interface ParteSerie {
  texto: string
  calc?: CalcVista
  titulo?: string
}

/**
 * El pie del gráfico del patrimonio neto: cuánto cambió en cada moneda y por
 * qué difieren (el CCL), en partes: cada cifra lleva su traza. Sin palabras de
 * juicio: es lo que pasó. null si falta la variación en alguna moneda.
 * "En pesos tu patrimonio neto subió 3,0%; en dólares, bajó 0,4%. La diferencia es el CCL, que pasó de 1.497,30 a 1.548,20."
 */
export function partesSerie(s: SeriePatrimonio): ParteSerie[] | null {
  const a = signoPct(s.variacion.ars)
  const u = signoPct(s.variacion.usd)
  if (a === null || u === null) return null
  const verbo = (v: string) => (v.startsWith('−') ? 'bajó' : v.startsWith('+') ? 'subió' : 'quedó en')
  const sinSigno = (v: string) => v.replace(/^[+−]/, '')
  const partes: ParteSerie[] = [
    { texto: `En pesos tu patrimonio neto ${verbo(a)} ` },
    { texto: sinSigno(a), calc: s.variacion.ars, titulo: 'Patrimonio neto · variación en pesos en el período' },
    { texto: `; en dólares, ${verbo(u) === verbo(a) ? '' : `${verbo(u)} `}` },
    { texto: sinSigno(u), calc: s.variacion.usd, titulo: 'Patrimonio neto · variación en dólares en el período' },
    { texto: '.' },
  ]
  const c0 = s.ccl?.desde
  const c1 = s.ccl?.hasta
  if (!c0?.valor || !c1?.valor || c0.valor === c1.valor) return partes
  return [
    ...partes,
    { texto: ' La diferencia es el CCL, que pasó de ' },
    { texto: numero(c0.valor, 2), calc: c0, titulo: 'CCL al principio del período' },
    { texto: ' a ' },
    { texto: numero(c1.valor, 2), calc: c1, titulo: 'CCL al final del período' },
    { texto: '.' },
  ]
}

/** El pie del gráfico como texto corrido (el lector de pantalla y los tests). */
export function fraseSerie(s: SeriePatrimonio): string | null {
  const p = partesSerie(s)
  return p ? p.map((x) => x.texto).join('') : null
}
