// Hechos inventados para los tests de resultados.ts (D-24: ningún número es
// del dueño). Una fábrica chica: cuentas, activos, y helpers para operaciones,
// precios, tipos de cambio, saldos y movimientos.

import { Decimal } from './dinero'
import type { Activo, Cuenta, Fecha, Hechos, MovimientoCapital, Operacion } from './tipos'
import type { Cuota } from './pasivos/tipos'

export const D = (x: string | number) => new Decimal(x)

export const CUENTAS: Cuenta[] = [
  { id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true },
  { id: 2, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true },
  { id: 3, nombre: 'Mercado Pago', tipo: 'billetera', formato_carga: 'captura', activa: true },
]

export function activo(id: number, ticker: string, tipo: Activo['tipo'], moneda: 'ARS' | 'USD'): Activo {
  return {
    id,
    ticker,
    nombre: ticker,
    tipo,
    moneda_riesgo: moneda,
    geografia: moneda === 'USD' ? 'US' : 'AR',
    indexacion: tipo === 'bono' || tipo === 'lecap' ? 'fija' : null,
    ticker_subyacente: tipo === 'cedear' ? ticker : null,
    fecha_vencimiento: null,
    color: null,
    activo_bool: true,
  }
}

export const AAA = activo(1, 'AAA', 'cedear', 'USD')
export const LLL = activo(2, 'LLL', 'lecap', 'ARS')
export const BBB = activo(3, 'BBB', 'accion_local', 'ARS')

export function vacios(): Hechos {
  return {
    cuentas: CUENTAS,
    activos: [AAA, LLL, BBB],
    operaciones: [],
    cotizaciones: [],
    tipos_cambio: [],
    saldos: [],
    movimientos: [],
    pasivos: [],
    pasivo_saldos: [],
    bienes: [],
    valuaciones: [],
    feriados: [],
    cargas: [],
  }
}

let idOp = 1
export function op(o: Partial<Operacion> & Pick<Operacion, 'fecha' | 'activo_id' | 'tipo' | 'cantidad'>): Operacion {
  return {
    id: idOp++,
    fecha_origen: null,
    cuenta_id: 1,
    moneda: 'ARS',
    precio: null,
    importe: null,
    comisiones: D(0),
    ccl_del_dia: null,
    carga_id: 1,
    notas: null,
    ...o,
  }
}

export function reiniciarIds() {
  idOp = 1
}

export function ccl(h: Hechos, fecha: Fecha, valor: string) {
  h.tipos_cambio.push({ fecha, ccl: D(valor), mep: null, cripto_venta: null, oficial: null, carga_id: 1 })
}

export function precio(h: Hechos, fecha: Fecha, activo_id: number, valor: string) {
  h.cotizaciones.push({ fecha, activo_id, precio_pesos: D(valor), precio_usd_subyacente: null, carga_id: 1 })
}

export function saldo(h: Hechos, fecha: Fecha, cuenta_id: number, moneda: 'ARS' | 'USD', valor: string) {
  h.saldos.push({ fecha, cuenta_id, moneda, monto: D(valor), carga_id: 1 })
}

let idMov = 1
export function aporte(h: Hechos, fecha: Fecha, cuenta_id: number, moneda: 'ARS' | 'USD', valor: string): MovimientoCapital {
  const m: MovimientoCapital = {
    id: idMov++,
    fecha,
    fecha_acreditacion: null,
    tipo: 'aporte',
    cuenta_origen_id: null,
    cuenta_destino_id: cuenta_id,
    moneda_origen: moneda,
    monto_origen: D(valor),
    moneda_destino: moneda,
    monto_destino: D(valor),
    tc_aplicado: null,
    impuesto: D(0),
    carga_id: 7,
    notas: null,
  }
  h.movimientos.push(m)
  return m
}

/** Una cuota del leasing, pagada (o no), con montos inventados. */
export function cuota(c: Partial<Cuota> & Pick<Cuota, 'nro' | 'fecha_vencimiento'>): Cuota {
  return {
    pasivo_id: 1,
    periodo: null,
    canon_neto: D(1_000_000),
    iva_canon: D(226_800),
    seguro: D(80_000),
    otros_conceptos: D(32_400),
    estado: 'facturada',
    fuente_canon: 'comprobante',
    fuente_seguro: 'comprobante',
    fuente_otros: 'comprobante',
    pagada: true,
    fecha_pago: null,
    monto_pagado: null,
    cuenta_pago_id: null,
    ccl_del_dia_pago: null,
    ccl_fuente: null,
    pagador: 'titular',
    carga_id: 90,
    notas: null,
    ...c,
  }
}
