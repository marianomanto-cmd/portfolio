// Las cuentas de la tabla de Posiciones (rediseño del 15/10, D-157; handoff,
// capturas 03 y 04): el desglose activo / TC, la barra Activo · TC, los
// totales de lo que está a la vista, los filtros y las mini barras. Puras,
// con test (cuentas.test.ts): la tabla solo dibuja lo que devuelven, y cada
// cifra lleva su traza.

import type { CalcVista, InsumoVista } from '@/lib/domain/calc'
import { Decimal, monto } from '@/lib/domain/dinero'
import { diasEntre } from '@/lib/domain/fechas'
import type { FilaCartera, VistaCartera } from '@/lib/vistas/contratos'
import { fraccionDe, sumaColumna } from '@/components/calculos'
import { enLista } from '@/components/hoy/palabras'

export const NOMBRE_TIPO: Record<string, string> = {
  cedear: 'CEDEAR',
  accion_local: 'Acción local',
  bono: 'Bono',
  lecap: 'LECAP',
  fci: 'FCI',
  liquidez: 'Liquidez',
}

export const CERO_TC: CalcVista = {
  valor: '0',
  formula: 'TC = 0',
  explicacion: 'En la moneda en que arriesga, todo el resultado es del activo: el tipo de cambio no aporta (D-35).',
  insumos: [],
  etiquetas: [],
}

export const SIN_DESGLOSE: CalcVista = {
  valor: null,
  motivo: 'Sin el resultado en dólares no se puede separar activo de tipo de cambio. Si es una apertura sin CCL de compra, ese CCL se declara desde la 1b (Pendientes).',
  formula: 'sin dato',
  insumos: [],
  etiquetas: [],
}

export const esLiquidez = (f: FilaCartera) => f.tipo === 'liquidez'

/** Desglose activo / TC en una moneda (D-68): en la moneda en que arriesga, todo es activo. */
export function desgloseEn(f: FilaCartera, moneda: 'ARS' | 'USD'): { activo: CalcVista; tc: CalcVista } | null {
  if (esLiquidez(f)) return null
  if (f.moneda_riesgo === moneda) return { activo: moneda === 'ARS' ? f.resultado.ars : f.resultado.usd, tc: CERO_TC }
  if (f.desglose && f.desglose.moneda === moneda) return { activo: f.desglose.activo, tc: f.desglose.tc }
  return null
}

const pct = (f: Decimal) => `${f.times(100).toDecimalPlaces(2).toFixed()}%`

/**
 * La barra "Activo · TC" del handoff: el resultado en pesos partido en lo que
 * hizo el activo (tinta; sangría si resta) y lo que hizo el tipo de cambio
 * (oro), cada tramo proporcional a su tamaño. Una LECAP, que arriesga pesos,
 * es todo activo en pesos (su TC está en dólares, en la traza). null sin
 * desglose o si las dos partes son cero.
 */
export function barraActivoTc(activo: string | null, tc: string | null): { activo: string; tc: string; activoNegativo: boolean } | null {
  if (activo === null || tc === null) return null
  const a = new Decimal(activo)
  const t = new Decimal(tc)
  const total = a.abs().plus(t.abs())
  if (total.isZero()) return null
  return { activo: pct(a.abs().div(total)), tc: pct(t.abs().div(total)), activoNegativo: a.isNegative() }
}

const signo = (v: string, m: 'ARS' | 'USD') => monto(v, m, { decimales: m === 'ARS' ? 0 : 2, signo: true })

/**
 * La traza de la barra Activo · TC: el resultado en pesos con sus dos partes,
 * y el desglose en dólares como insumo, cada parte con su propio cálculo. Así
 * la barra (que no tiene números) dice de dónde sale, en las dos monedas.
 */
export function trazaActivoTc(f: FilaCartera): CalcVista {
  const ars = desgloseEn(f, 'ARS')
  const usd = desgloseEn(f, 'USD')
  const insumos: InsumoVista[] = []
  const agregar = (nombre: string, c: CalcVista | undefined, unidad: 'ARS' | 'USD') => {
    if (c) insumos.push({ nombre, valor: c.valor, unidad, calc: c })
  }
  agregar('Activo, en pesos', ars?.activo, 'ARS')
  agregar('Tipo de cambio, en pesos', ars?.tc, 'ARS')
  agregar('Activo, en dólares', usd?.activo, 'USD')
  agregar('Tipo de cambio, en dólares', usd?.tc, 'USD')
  const sa = f.desglose?.sin_atribuir
  if (sa && sa.valor !== null && !new Decimal(sa.valor).isZero()) agregar(`Sin atribuir hoy, en ${f.desglose!.moneda === 'ARS' ? 'pesos' : 'dólares'}`, sa, f.desglose!.moneda)
  const explicacion = `Cuánto del resultado de ${f.ticker} desde la compra puso el activo y cuánto el tipo de cambio (D-35). La barra es la parte en pesos; en dólares, el desglose está en los insumos.`
  const total = f.resultado.ars
  if (!ars || ars.activo.valor === null || ars.tc.valor === null || total.valor === null) {
    return { valor: null, motivo: ars?.activo.motivo ?? total.motivo ?? SIN_DESGLOSE.motivo, formula: 'sin dato', explicacion, insumos, etiquetas: total.etiquetas }
  }
  const s = f.desglose?.moneda === 'ARS' && sa?.valor && !new Decimal(sa.valor).isZero() ? ` + sin atribuir ${signo(sa.valor, 'ARS')}` : ''
  return {
    valor: total.valor,
    formula: `activo ${signo(ars.activo.valor, 'ARS')} + TC ${signo(ars.tc.valor, 'ARS')}${s} = ${signo(total.valor, 'ARS')}`,
    explicacion,
    insumos,
    etiquetas: total.etiquetas,
  }
}

/** El peso más grande de las filas (la mini barra de "% cartera" se mide contra él). null si no hay. */
export function pesoMaximo(filas: readonly FilaCartera[]): string | null {
  let max: Decimal | null = null
  for (const f of filas) {
    if (f.peso.valor === null) continue
    const p = new Decimal(f.peso.valor)
    if (p.gt(0) && (max === null || p.gt(max))) max = p
  }
  return max ? max.toFixed() : null
}

/** De hace cuántos días es el precio ("precio de hace 3 días"): días corridos hasta hoy. null sin fecha. */
export function haceDias(fecha: string | null, hoy: string | null | undefined): number | null {
  if (!fecha || !hoy || hoy < fecha) return null
  return diasEntre(fecha, hoy)
}

// ───────────── Filtros ─────────────

export interface Filtros {
  cuenta: string
  clase: string
  moneda: string
  sinDato: boolean
  viejos: boolean
}

export const SIN_FILTRO: Filtros = { cuenta: '', clase: '', moneda: '', sinDato: false, viejos: false }

export function tieneSinDato(f: FilaCartera): boolean {
  if (esLiquidez(f)) return f.valor.ars.valor === null || f.valor.usd.valor === null
  return [f.resultado.ars, f.resultado.usd, f.ppc.ars, f.ppc.usd, f.precio, f.valor.ars, f.valor.usd].some((c) => c.valor === null)
}

/**
 * ¿La fila pasa los filtros? La liquidez (que no es una clase de título)
 * entra con "Todas las clases" o con "Liquidez", y respeta la cuenta, la
 * moneda, "solo con sin dato" y "solo precios viejos".
 */
export function pasa(f: FilaCartera, x: Filtros): boolean {
  if (x.cuenta && f.cuenta !== x.cuenta) return false
  if (x.clase && f.tipo !== x.clase) return false
  if (x.moneda && f.moneda_riesgo !== x.moneda) return false
  if (x.sinDato && !tieneSinDato(f)) return false
  if (x.viejos && !f.precio_viejo) return false
  return true
}

export const hayFiltros = (x: Filtros) => Boolean(x.cuenta || x.clase || x.moneda || x.sinDato || x.viejos)

// ───────────── Totales ─────────────

/**
 * Los totales de lo que está a la vista (la fila fija de abajo): el valor de
 * todas las filas, y el resultado y su desglose de las posiciones (la
 * liquidez no tiene costo: no suma resultado, y no es "sin dato"). Si a una
 * columna le falta una fila, su total es "sin dato" con la suma parcial
 * (D-65). El % sobre lo invertido sale de los totales del motor solo cuando
 * se ven todas las posiciones.
 */
export function totalesCartera(filas: readonly FilaCartera[], v: Pick<VistaCartera, 'filas' | 'totales'>) {
  const posiciones = filas.filter((f) => !esLiquidez(f))
  const col = (sel: (f: FilaCartera) => CalcVista, u: 'ARS' | 'USD' | 'fraccion', e: string, de: readonly FilaCartera[]) =>
    sumaColumna(de.map((f) => ({ nombre: f.ticker === 'USD' || f.ticker === 'ARS' ? f.nombre : f.ticker, calc: sel(f) })), u, e)
  const d = (f: FilaCartera, m: 'ARS' | 'USD', k: 'activo' | 'tc') => desgloseEn(f, m)?.[k] ?? SIN_DESGLOSE
  const todas = posiciones.length === v.filas.filter((f) => !esLiquidez(f)).length
  return {
    posiciones: posiciones.length,
    valorArs: col((f) => f.valor.ars, 'ARS', 'Valor de lo que está a la vista, en pesos.', filas),
    valorUsd: col((f) => f.valor.usd, 'USD', 'Valor de lo que está a la vista, en dólares.', filas),
    peso: col((f) => f.peso, 'fraccion', 'Qué parte de lo financiero es lo que está a la vista.', filas),
    resArs: col((f) => f.resultado.ars, 'ARS', 'Resultado en pesos de las posiciones a la vista, desde la compra.', posiciones),
    resUsd: col((f) => f.resultado.usd, 'USD', 'Resultado en dólares de las posiciones a la vista, cada compra a su CCL.', posiciones),
    actArs: col((f) => d(f, 'ARS', 'activo'), 'ARS', 'Lo que pusieron los activos, en pesos.', posiciones),
    tcArs: col((f) => d(f, 'ARS', 'tc'), 'ARS', 'Lo que puso el tipo de cambio, en pesos.', posiciones),
    actUsd: col((f) => d(f, 'USD', 'activo'), 'USD', 'Lo que pusieron los activos, en dólares.', posiciones),
    tcUsd: col((f) => d(f, 'USD', 'tc'), 'USD', 'Lo que puso el tipo de cambio, en dólares.', posiciones),
    pctArs: todas ? fraccionDe(v.totales.resultado.ars, v.totales.costo.ars, 'ARS', 'Resultado total en pesos sobre lo que te costaron tus títulos.') : null,
    pctUsd: todas ? fraccionDe(v.totales.resultado.usd, v.totales.costo.usd, 'USD', 'Resultado total en dólares sobre lo que te costaron tus títulos.') : null,
  }
}

export type TotalesCartera = ReturnType<typeof totalesCartera>

/**
 * La traza de la barra de totales: el resultado en pesos de lo que está a la
 * vista, partido en activo y tipo de cambio, con el desglose en dólares como
 * insumo.
 */
export function trazaTotalActivoTc(t: TotalesCartera): CalcVista {
  const ins: InsumoVista[] = [
    { nombre: 'Activo, en pesos', valor: t.actArs.total.valor, unidad: 'ARS', calc: t.actArs.total },
    { nombre: 'Tipo de cambio, en pesos', valor: t.tcArs.total.valor, unidad: 'ARS', calc: t.tcArs.total },
    { nombre: 'Activo, en dólares', valor: t.actUsd.total.valor, unidad: 'USD', calc: t.actUsd.total },
    { nombre: 'Tipo de cambio, en dólares', valor: t.tcUsd.total.valor, unidad: 'USD', calc: t.tcUsd.total },
  ]
  const explicacion = 'Cuánto del resultado de lo que está a la vista puso cada activo y cuánto el tipo de cambio, sumado fila por fila (D-35).'
  const a = t.actArs.total.valor
  const c = t.tcArs.total.valor
  if (a === null || c === null) {
    return { valor: null, motivo: t.actArs.total.motivo ?? t.tcArs.total.motivo ?? 'Falta el desglose de alguna fila.', formula: 'sin dato', explicacion, insumos: ins, etiquetas: ['parcial'] }
  }
  // El total es el resultado en pesos de lo que está a la vista (exacto); activo y TC son sus partes.
  const total = t.resArs.total.valor ?? new Decimal(a).plus(c).toFixed()
  return { valor: total, formula: `activo ${signo(a, 'ARS')} + TC ${signo(c, 'ARS')} = ${signo(total, 'ARS')}`, explicacion, insumos: ins, etiquetas: [] }
}

/** Lo que falta en cada total parcial, para la leyenda de la tabla: "en Result. USD, faltan YPFD, FIMA y TXMJ0". */
export function sumasParciales(t: TotalesCartera): { columna: string; faltan: string; cuantas: number }[] {
  const columnas: [string, ReturnType<typeof sumaColumna>][] = [
    ['Valor', t.valorArs],
    ['Valor en dólares', t.valorUsd],
    ['Result. ARS', t.resArs],
    ['Result. USD', t.resUsd],
  ]
  const out: { columna: string; faltan: string; cuantas: number }[] = []
  for (const [columna, s] of columnas) {
    if (!s.parcial) continue
    const nombres = s.total.insumos.filter((i) => i.valor === null).map((i) => i.nombre)
    out.push({ columna, faltan: enLista(nombres), cuantas: nombres.length })
  }
  return out
}

/**
 * Lo pendiente de cada fila (una compra con precio pendiente, una apertura sin
 * CCL de compra, una tenencia que la fuente ya no lista), agrupado por texto,
 * para la nota de abajo de la tabla: "YPFD, FIMA y TXMJ0: Falta el CCL de
 * compra de la apertura…". En el teléfono va en "Más datos" de cada tarjeta.
 */
export function notasPendientes(filas: readonly FilaCartera[]): { quienes: string; texto: string }[] {
  const por = new Map<string, string[]>()
  for (const f of filas) {
    if (!f.pendiente) continue
    por.set(f.pendiente, [...(por.get(f.pendiente) ?? []), esLiquidez(f) ? f.nombre : f.ticker])
  }
  return [...por].map(([texto, quienes]) => ({ quienes: enLista(quienes), texto }))
}

/**
 * Las filas con algo sin atribuir hoy (sin precio o CCL nuevo desde la última
 * observación fresca, D-35), con ese monto: la nota de abajo de la tabla lo
 * dice. También está en la traza de su barra Activo · TC.
 */
export function sinAtribuirHoy(filas: readonly FilaCartera[]): { ticker: string; calc: CalcVista; moneda: 'ARS' | 'USD' }[] {
  return filas.flatMap((f) => {
    const sa = f.desglose?.sin_atribuir
    if (esLiquidez(f) || !f.desglose || !sa || sa.valor === null || new Decimal(sa.valor).isZero()) return []
    return [{ ticker: f.ticker, calc: sa, moneda: f.desglose.moneda }]
  })
}
