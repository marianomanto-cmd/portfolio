// La bandeja de revisión (4.2.1 de la visión): de la propuesta de conciliación
// y de lo que elegiste fila por fila, qué se graba con el Enter, qué queda
// pendiente y qué todavía frena. Puro y con tests: la pantalla solo lo dibuja.
//
// Reglas (CA-1, D-47):
// - verificada: la guarda el Enter.
// - advertencia: nunca la acepta el Enter general; se acepta de a una. Si
//   llegás al Enter sin tocarla, queda pendiente, y el botón lo dice.
// - error: frena el Enter hasta que la edites o la dejes pendiente.
// - ticker sin alta: no se graba hasta darlo de alta (o queda pendiente).

import { Decimal, leerNumeroAR } from '@/lib/domain/dinero'
import type { DecisionFila, DecisionSaldo, PropuestaCarga, SaldoLeido } from '@/lib/carga/contratos'

export type Resolucion = 'aceptada' | 'pendiente'

export interface EleccionFila {
  resolucion: Resolucion | null
  /** El motivo es la opción que elegiste ("acepté la compra propuesta"). */
  motivo: string | null
  /** Operación de conciliación corregida a mano. */
  operacion: { cantidad: string; precio: string | null } | null
  /** Huella de la decisión que elegiste: si la propuesta cambia, la elección se cae. */
  huella: string
}

export interface EleccionSaldo {
  resolucion: Resolucion | null
  motivo: string | null
  /** Monto elegido (una de dos lecturas) o tipeado. */
  monto: string | null
  huella: string
}

export interface Elecciones {
  filas: Readonly<Record<string, EleccionFila>>
  saldos: Readonly<Record<string, EleccionSaldo>>
  ausentes: Readonly<Record<string, Resolucion>>
}

export const SIN_ELECCIONES: Elecciones = { filas: {}, saldos: {}, ausentes: {} }

export function huellaFila(d: DecisionFila): string {
  return [d.estado, d.activo_id ?? '-', d.accion, d.operacion?.tipo ?? '-', d.operacion?.cantidad ?? '-', d.operacion?.precio ?? '-', d.cotizacion?.precio_pesos ?? '-'].join('|')
}

export function huellaSaldo(d: DecisionSaldo): string {
  return [d.estado, d.moneda, d.monto].join('|')
}

/** La elección vale solo si se hizo sobre esta misma propuesta. */
export function eleccionFila(e: Elecciones, d: DecisionFila): EleccionFila | null {
  const x = e.filas[d.clave]
  return x && x.huella === huellaFila(d) ? x : null
}

export function eleccionSaldo(e: Elecciones, d: DecisionSaldo): EleccionSaldo | null {
  const x = e.saldos[d.clave]
  return x && x.huella === huellaSaldo(d) ? x : null
}

/**
 * Estado de un ítem en la bandeja:
 * - verificada / aceptada: se graba.
 * - advertencia / sin_alta: a revisar; con el Enter queda pendiente.
 * - error: a revisar y frena el Enter.
 * - pendiente: lo dejaste pendiente.
 */
export type EstadoItem = 'verificada' | 'aceptada' | 'advertencia' | 'sin_alta' | 'error' | 'pendiente'

export function estadoFila(d: DecisionFila, e: EleccionFila | null): EstadoItem {
  if (e?.resolucion === 'pendiente') return 'pendiente'
  if (d.estado === 'error') return 'error'
  if (d.activo_id === null) return 'sin_alta'
  if (d.estado === 'verificada') return 'verificada'
  return e?.resolucion === 'aceptada' ? 'aceptada' : 'advertencia'
}

export function estadoSaldo(d: DecisionSaldo, e: EleccionSaldo | null): EstadoItem {
  if (e?.resolucion === 'pendiente') return 'pendiente'
  if (e?.resolucion === 'aceptada' && e.monto !== null) return 'aceptada'
  if (d.estado === 'error') return 'error'
  if (d.estado === 'verificada') return 'verificada'
  return e?.resolucion === 'aceptada' ? 'aceptada' : 'advertencia'
}

export const seGraba = (e: EstadoItem) => e === 'verificada' || e === 'aceptada'
export const aRevisar = (e: EstadoItem) => e === 'advertencia' || e === 'sin_alta' || e === 'error'

export function claveAusente(a: PropuestaCarga['ausentes'][number]): string {
  return `${a.cuenta}:ausente:${a.ticker}`
}

export interface ItemBandeja {
  clave: string
  tipo: 'fila' | 'saldo' | 'ausente'
  cuenta: string
  estado: EstadoItem
  fila?: DecisionFila
  saldo?: DecisionSaldo
  ausente?: PropuestaCarga['ausentes'][number]
}

export interface ResumenBandeja {
  items: ItemBandeja[]
  /** Leídas: filas + saldos + tipos de cambio tipeados. */
  leidas: number
  /** Las que guarda el Enter (incluye los tipos de cambio). */
  verificadas: number
  aRevisar: number
  errores: number
  pendientes: number
  /** Lo que el Enter deja pendiente: pendientes + advertencias y altas sin resolver. */
  quedanPendientes: number
}

const ORDEN: Record<EstadoItem, number> = { error: 0, sin_alta: 1, advertencia: 2, pendiente: 3, aceptada: 4, verificada: 5 }

export function resumirBandeja(p: PropuestaCarga | null, e: Elecciones, tiposDeCambio: number): ResumenBandeja {
  const items: ItemBandeja[] = []
  if (p) {
    for (const d of p.filas) {
      items.push({ clave: d.clave, tipo: 'fila', cuenta: d.cuenta, estado: estadoFila(d, eleccionFila(e, d)), fila: d })
    }
    for (const d of p.saldos) {
      items.push({ clave: d.clave, tipo: 'saldo', cuenta: d.cuenta, estado: estadoSaldo(d, eleccionSaldo(e, d)), saldo: d })
    }
    for (const a of p.ausentes) {
      const clave = claveAusente(a)
      // Una tenencia que la fuente no trae no se resuelve sola: queda a revisar
      // hasta que la dejes pendiente (y la carga queda con listado incompleto).
      items.push({ clave, tipo: 'ausente', cuenta: a.cuenta, estado: e.ausentes[clave] === 'pendiente' ? 'pendiente' : 'advertencia', ausente: a })
    }
  }
  items.sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado])
  const cuenta = (f: (x: EstadoItem) => boolean) => items.filter((i) => f(i.estado)).length
  const pendientes = cuenta((x) => x === 'pendiente')
  const sinResolver = cuenta((x) => x === 'advertencia' || x === 'sin_alta')
  return {
    items,
    leidas: items.filter((i) => i.tipo !== 'ausente').length + tiposDeCambio,
    verificadas: cuenta(seGraba) + tiposDeCambio,
    aRevisar: cuenta(aRevisar),
    errores: cuenta((x) => x === 'error'),
    pendientes,
    quedanPendientes: pendientes + sinResolver,
  }
}

export interface EstadoBoton {
  texto: string
  /** El Enter guarda. */
  habilitado: boolean
  /** Por qué no guarda (para leerlo en voz alta y mostrarlo). */
  motivo: string | null
}

/** Lo que dice el botón: qué va a hacer el Enter, con números. */
export function textoBoton(r: ResumenBandeja, opciones: { leyendo: string[]; proponiendo: boolean; guardando: boolean }): EstadoBoton {
  if (opciones.guardando) return { texto: 'Guardando…', habilitado: false, motivo: null }
  if (opciones.leyendo.length) {
    return { texto: `Esperando ${opciones.leyendo.join(' y ')} (leyendo…)`, habilitado: false, motivo: 'Todavía estoy leyendo una fuente.' }
  }
  if (opciones.proponiendo) return { texto: 'Revisando…', habilitado: false, motivo: 'Estoy armando la bandeja.' }
  if (r.errores > 0) {
    const n = r.errores
    return {
      texto: `Resolvé ${n} ${n === 1 ? 'error' : 'errores'} para guardar`,
      habilitado: false,
      motivo: 'Una fila con error se edita o se deja pendiente.',
    }
  }
  if (r.verificadas === 0) {
    return { texto: 'Nada para guardar todavía', habilitado: false, motivo: 'Tipeá el CCL o el cripto, o soltá un archivo.' }
  }
  const pend = r.quedanPendientes
  return {
    texto: `Guardar ${r.verificadas}${pend ? ` · dejar ${pend} pendiente${pend === 1 ? '' : 's'}` : ''}`,
    habilitado: true,
    motivo: null,
  }
}

/**
 * "¿Entró o salió plata?" (CA-4): solo cuando un saldo sube más de lo que
 * explica la TNA que muestra la captura, tomando la TNA con medio último
 * dígito de más (la mostrada está redondeada). Sin TNA no se pregunta nada:
 * solo se muestra la diferencia. La TNA puede venir como fracción (0,275) o
 * como porcentaje (27,5).
 */
export function saltoDeSaldo(
  anterior: string,
  actual: string,
  tna: string | null,
  dias: number,
): { suba: string; explicadoHasta: string | null; sinExplicar: string | null } {
  const a = new Decimal(anterior)
  const suba = new Decimal(actual).minus(a)
  if (tna === null || dias <= 0) return { suba: suba.toFixed(), explicadoHasta: null, sinExplicar: null }
  const t = new Decimal(tna)
  const tope = t.plus(new Decimal(5).times(new Decimal(10).pow(-(t.decimalPlaces() + 1))))
  const fraccion = t.gt(1) ? tope.div(100) : tope
  const explicado = a.abs().times(fraccion).times(dias).div(365)
  const sinExplicar = suba.minus(explicado)
  return {
    suba: suba.toFixed(),
    explicadoHasta: explicado.toDecimalPlaces(2).toFixed(),
    sinExplicar: sinExplicar.gt(0) ? sinExplicar.toDecimalPlaces(2).toFixed() : null,
  }
}

/**
 * Las dos lecturas de un saldo que no coinciden, para elegir una con un toque
 * (4.2.1 de la visión). El contrato no tiene un campo para esto: se toman de
 * las partes rotuladas "lectura …" o, si no, del motivo que escribe el lector
 * de capturas ("Saldo — Lectura A: $ 4.912.300 · Lectura B: $ 4.912.800 …").
 * Si alguna no se entiende como número, no se ofrece elegir: se tipea.
 */
export function alternativasSaldo(s: SaldoLeido): { concepto: string; monto: string }[] {
  const rotuladas = s.partes.filter((p) => /lectura/i.test(p.concepto))
  if (rotuladas.length >= 2) return rotuladas.map((p) => ({ concepto: p.concepto, monto: p.monto }))
  for (const m of s.motivos) {
    const r = /^Saldo\b.*?Lectura A:\s*(?:US\$|\$)?\s*([^·(]+?)\s*·\s*Lectura B:\s*(?:US\$|\$)?\s*([^·(]+?)\s*(?:\(|$)/.exec(m)
    if (!r) continue
    const a = leerNumeroAR(r[1].replace(/\.$/, ''))
    const b = leerNumeroAR(r[2].replace(/\.$/, ''))
    if (a === null || b === null || a === b) return []
    return [
      { concepto: 'lectura A', monto: a },
      { concepto: 'lectura B', monto: b },
    ]
  }
  return []
}
