// Trazabilidad (spec, "requisito no negociable"; D-22). Toda función de cálculo
// devuelve un Calc: el valor, la fórmula con los valores concretos que
// entraron, sus insumos (que pueden ser otros Calc o hechos con su carga de
// origen) y etiquetas que se propagan ("viejo", "declarado"...).
//
// valor === null significa "sin dato", nunca cero. `motivo` dice qué falta.

import type { Decimal } from './dinero'

export type Etiqueta =
  | 'viejo' // precio o saldo con más de 2 días hábiles (D-16)
  | 'declarado' // lo cargaste vos sin respaldo de una fuente (CCL de compra de una apertura)
  | 'inferido' // calculado a partir de otro dato (precio de una compra desde el PPP)
  | 'pendiente' // falta un dato que llega después (compra del día con PPP "-")
  | 'parcial' // suma con partes "sin dato" (el valor es null; la suma parcial va en insumos)

/** Gravedad para mostrar una sola etiqueta cuando hay varias. */
export const GRAVEDAD: Record<Etiqueta, number> = {
  parcial: 5,
  pendiente: 4,
  viejo: 3,
  inferido: 2,
  declarado: 1,
}

export interface Origen {
  carga_id: number
  /** Dónde exactamente: "hoja Patrimonio, fila 18", "captura de Galicia". */
  lugar?: string
}

export interface Insumo {
  /** Qué es, en castellano: "CCL del 14/10", "Cantidad de SPY". */
  nombre: string
  /** Valor exacto como texto decimal, o texto si no es numérico (fecha, ticker). */
  valor: string | null
  unidad?: 'ARS' | 'USD' | 'cantidad' | 'ratio' | 'fraccion' | 'fecha' | 'texto'
  origen?: Origen
  /** Si el insumo es a su vez un cálculo, su traza completa. */
  calc?: Calc
}

export interface Calc<T = Decimal> {
  valor: T | null
  /** Cuando valor es null: qué falta, en una línea. */
  motivo?: string
  /** Fórmula con los valores reales: "1.240 × $35.150 ÷ 1.548,20 = US$ 28.152,69". */
  formula: string
  /** "¿Qué es esto?": una línea en castellano. */
  explicacion?: string
  insumos: Insumo[]
  etiquetas: Etiqueta[]
}

export function calc<T = Decimal>(
  valor: T,
  formula: string,
  insumos: Insumo[] = [],
  opciones: { etiquetas?: Etiqueta[]; explicacion?: string } = {},
): Calc<T> {
  return {
    valor,
    formula,
    insumos,
    etiquetas: unicas([
      ...(opciones.etiquetas ?? []),
      ...insumos.flatMap((i) => i.calc?.etiquetas ?? []),
    ]),
    explicacion: opciones.explicacion,
  }
}

export function sinDato<T = Decimal>(
  motivo: string,
  insumos: Insumo[] = [],
  opciones: { etiquetas?: Etiqueta[]; explicacion?: string; formula?: string } = {},
): Calc<T> {
  return {
    valor: null,
    motivo,
    formula: opciones.formula ?? 'sin dato',
    insumos,
    etiquetas: unicas([
      ...(opciones.etiquetas ?? []),
      ...insumos.flatMap((i) => i.calc?.etiquetas ?? []),
    ]),
    explicacion: opciones.explicacion,
  }
}

/** Insumo que envuelve un cálculo. */
export function deCalc(nombre: string, c: Calc, unidad?: Insumo['unidad']): Insumo {
  return {
    nombre,
    valor: c.valor === null ? null : c.valor.toFixed(),
    unidad,
    calc: c,
  }
}

export function unicas(es: Etiqueta[]): Etiqueta[] {
  return [...new Set(es)].sort((a, b) => GRAVEDAD[b] - GRAVEDAD[a])
}

/** La etiqueta más grave, para mostrar un solo chip. */
export function etiquetaPrincipal(es: readonly Etiqueta[]): Etiqueta | null {
  return es.length ? [...es].sort((a, b) => GRAVEDAD[b] - GRAVEDAD[a])[0] : null
}

// ───────────── Serialización para la UI ─────────────
// Los Server Components no pueden pasar instancias de Decimal a componentes de
// cliente. La vista recibe CalcVista: lo mismo, con los valores como texto.

export interface InsumoVista {
  nombre: string
  valor: string | null
  unidad?: Insumo['unidad']
  origen?: Origen
  calc?: CalcVista
}

export interface CalcVista {
  valor: string | null
  motivo?: string
  formula: string
  explicacion?: string
  insumos: InsumoVista[]
  etiquetas: Etiqueta[]
}

export function vista(c: Calc): CalcVista {
  return {
    valor: c.valor === null ? null : (c.valor as Decimal).toFixed(),
    motivo: c.motivo,
    formula: c.formula,
    explicacion: c.explicacion,
    etiquetas: c.etiquetas,
    insumos: c.insumos.map((i) => ({
      nombre: i.nombre,
      valor: i.valor,
      unidad: i.unidad,
      origen: i.origen,
      calc: i.calc ? vista(i.calc) : undefined,
    })),
  }
}
