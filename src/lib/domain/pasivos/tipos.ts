// Tipos del leasing y de su cuadro de marcha (entrega 4, plan §5 C.2). Los
// publica el paso 0 para que Balance, Evolución y Flujo programen contra ellos
// desde el principio; los mantiene el constructor de Pasivos. Se pueden sumar
// campos; cambiar o sacar uno publicado se avisa en la integración.
// Montos exactos (Decimal, D-32).

import type { Calc, DobleCalc, Etiqueta } from '../calc'
import type { Decimal } from '../dinero'
import type { Fecha, Moneda } from '../tipos'

/** De dónde sale cada monto de una cuota. `no_aplica`: la planilla dice n/a (monto vacío o 0). */
export type FuenteCuota = 'comprobante' | 'contrato' | 'a_confirmar' | 'supuesto' | 'no_aplica'

/** Una cuota del cuadro de marcha (pasivo_cuotas). Una proyectada nunca es un hecho ni puede estar pagada. */
export interface Cuota {
  pasivo_id: number
  nro: number
  fecha_vencimiento: Fecha
  /** Mes del canon (día 1), si la planilla lo trae. */
  periodo: Fecha | null
  canon_neto: Decimal
  /** IVA facturado de la cuota, sobre canon y seguro, como factura la leasera. */
  iva_canon: Decimal
  /** Seguro, neto de IVA. */
  seguro: Decimal
  /** Percepción de IVA RG 3337 y otros conceptos facturados. */
  otros_conceptos: Decimal
  estado: 'facturada' | 'proyectada'
  fuente_canon: FuenteCuota
  fuente_seguro: FuenteCuota
  fuente_otros: FuenteCuota
  pagada: boolean
  /** null con pagada = "pagada · fecha sin dato" (débito automático sin fecha en la planilla). */
  fecha_pago: Fecha | null
  monto_pagado: Decimal | null
  cuenta_pago_id: number | null
  ccl_del_dia_pago: Decimal | null
  ccl_fuente: string | null
  pagador: 'titular' | 'empresa' | null
  /**
   * Base de Ganancias de la cuota para quien deduce el canon (la empresa); null
   * o ausente = sin dato. Opcional para no romper a quien ya arma cuotas.
   */
  base_ganancias?: Decimal | null
  carga_id: number
  notas: string | null
}

/** Un cargo fuera de la cuota (multa, comisión, reserva de fondos, intereses): pasivo_cargos. */
export interface CargoExtra {
  id: number
  pasivo_id: number
  fecha: Fecha
  concepto: 'multa' | 'comision' | 'reserva_fondos' | 'interes' | 'otro'
  detalle: string | null
  /** En pesos, con IVA si lo lleva. */
  importe: Decimal
  cuota_nro: number | null
  fuente: Exclude<FuenteCuota, 'no_aplica'>
  anulado: boolean
  carga_id: number
  notas: string | null
}

/** El contrato de un pasivo (pasivos), con las columnas que suma la entrega 4. */
export interface ContratoPasivo {
  id: number
  nombre: string
  tipo: 'leasing' | 'tarjeta' | 'prestamo'
  moneda: Moneda
  fecha_inicio: Fecha
  cuotas_totales: number
  monto_financiado_neto: Decimal | null
  anticipo_neto: Decimal | null
  opcion_compra_neto: Decimal | null
  opcion_compra_fecha: Fecha | null
  valor_bien: Decimal | null
  alicuota_ganancias: Decimal | null
  /** Desde cuándo corre la financiación (la entrega del bien). Con el monto financiado, da la tasa del contrato. */
  fecha_desembolso: Fecha | null
  pagador_habitual: 'titular' | 'empresa' | null
  /** ¿La empresa le reintegra al dueño el IVA y la percepción de la cuota? null = sin declarar. */
  reintegra_iva: boolean | null
  notas: string | null
}

/**
 * Una cuota abierta en sus partes (pedido del dueño del 14/10): solo la
 * amortización baja la deuda y cuenta para el patrimonio; el interés
 * implícito, el IVA, el seguro, la percepción y los cargos son gasto.
 */
export interface AperturaCuota {
  pasivo_id: number
  nro: number
  fecha_vencimiento: Fecha
  amortizacion: DobleCalc
  /** Interés implícito a la tasa del contrato: lleva la etiqueta "estimado". */
  interes: DobleCalc
  iva: DobleCalc
  seguro: DobleCalc
  percepcion: DobleCalc
  cargos: DobleCalc
  /** La cuota entera: lo que se debita. */
  total: DobleCalc
  /** Todo lo que no es amortización. */
  gasto: DobleCalc
}

/** Lo que lee el servidor (src/lib/server/hechos-pasivos.ts). Las cuotas y los cargos de una carga revertida no llegan. */
export interface HechosPasivos {
  contratos: ContratoPasivo[]
  cuotas: Cuota[]
  /** Solo los que cuentan: de la última planilla vigente de cada pasivo o cargados a mano, sin anular (D-153). */
  cargos: CargoExtra[]
}

/** La opción de compra: el neto del contrato y su IVA a la alícuota observada en las facturas (D-142). */
export interface OpcionDeCompra {
  neto: DobleCalc
  iva: DobleCalc
  total: DobleCalc
  fecha: Fecha | null
}

/** Un renglón del cuadro de amortización implícito (a la TEA del contrato). La opción de compra es el último (nro null). */
export interface FilaAmortizacion {
  nro: number | null
  fecha: Fecha
  dias: number
  saldo_inicial: Decimal
  /** Lo que se paga ese día: el canon neto, o la opción neta. */
  pago: Decimal
  interes: Decimal
  amortizacion: Decimal
  saldo_final: Decimal
}

/** Lo que falta pagar, partido por de dónde sale cada monto. */
export interface FaltaPagar {
  cuotas: number
  /** Nominal: canon + IVA + seguro + percepción de las cuotas impagas (sin la opción). */
  total: DobleCalc
  canon: DobleCalc
  /** IVA, seguro y percepción. */
  resto: DobleCalc
  /** En pesos, por fuente del monto: comprobante, contrato, supuesto, a confirmar. */
  por_fuente: { comprobante: Calc; contrato: Calc; supuesto: Calc; a_confirmar: Calc }
}

/** Todo lo que se sabe del leasing a una fecha (C.2 resumenLeasing). */
export interface ResumenLeasing {
  pasivo_id: number
  cuotas_totales: number
  /** Cuotas que tiene el cuadro de marcha cargado. */
  cargadas: number
  pagadas: number
  proxima: { nro: number; fecha_vencimiento: Fecha; total: DobleCalc; etiquetas: Etiqueta[] } | null
  /** ARS: lo pagado; USD: cada cuota al CCL de su pago (suma parcial si falta alguno). */
  pagado: DobleCalc
  falta: FaltaPagar
  iva_percepcion: { pagado: DobleCalc; por_pagar: DobleCalc }
  cargos: DobleCalc
  opcion: OpcionDeCompra
  alicuota_iva: Calc
  /** Pagado + falta + opción + cargos. */
  costo_total: DobleCalc
  /** Costo total ÷ valor del bien del contrato (veces). */
  costo_vs_valor: Calc
}
