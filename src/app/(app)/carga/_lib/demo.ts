// Hechos para cuando no hay base (modo demo o falta la configuración de
// Supabase): las tres cuentas del dueño y el catálogo que hayas dado de alta en
// la pantalla, sin operaciones ni precios. Así la lectura y la bandeja andan
// igual, y la confirmación avisa que no se guarda nada.

import type { ActivoNuevo } from '@/lib/carga/contratos'
import { Decimal } from '@/lib/domain/dinero'
import type { Activo, Cuenta, Hechos } from '@/lib/domain/tipos'

export const CUENTAS_SIN_BASE: Cuenta[] = [
  { id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true },
  { id: 2, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true },
  { id: 3, nombre: 'Mercado Pago', tipo: 'billetera', formato_carga: 'captura', activa: true },
]

/** Un activo dado de alta en la pantalla cuando no hay base (id negativo, nunca se graba). */
export interface ActivoLocal extends ActivoNuevo {
  id: number
}

export function aActivo(a: ActivoLocal): Activo {
  return {
    id: a.id,
    ticker: a.ticker,
    nombre: a.nombre,
    tipo: a.tipo,
    moneda_riesgo: a.moneda_riesgo,
    geografia: a.geografia,
    indexacion: a.indexacion,
    ticker_subyacente: a.ticker_subyacente,
    fecha_vencimiento: null,
    color: null,
    activo_bool: true,
  }
}

export function hechosSinBase(activos: readonly ActivoLocal[] = []): Hechos {
  return {
    cuentas: CUENTAS_SIN_BASE,
    activos: activos.map(aActivo),
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

/**
 * Escenario del modo demo para ver D-19 a mano (PORTFOLIO_DEMO_ESCENARIO=
 * compra_pendiente): IEB ya tiene SPY, una apertura de 1.230 a $ 30.100 y una
 * compra de 10 con PPP "-" (precio pendiente). Con el ejemplo de IEB (1.240 a
 * PPP $ 30.145,16), la bandeja propone completar su precio. Números inventados.
 */
export function conCompraPendiente(h: Hechos): Hechos {
  const spy = h.activos.find((a) => a.ticker === 'SPY')
  if (!spy) return h
  const base = { fecha_origen: null, cuenta_id: 1, activo_id: spy.id, moneda: 'ARS' as const, importe: null, comisiones: new Decimal(0), carga_id: -1, notas: null }
  return {
    ...h,
    operaciones: [
      ...h.operaciones,
      { ...base, id: -1, fecha: '2026-01-02', tipo: 'apertura', cantidad: new Decimal(1230), precio: new Decimal('30100'), ccl_del_dia: null },
      { ...base, id: -2, fecha: '2026-01-05', tipo: 'compra', cantidad: new Decimal(10), precio: null, ccl_del_dia: new Decimal('1180') },
    ],
    cargas: [
      ...h.cargas,
      { id: -1, lote: null, fecha: '2026-01-05', cuenta_id: 1, origen: 'excel', archivo_path: null, estado: 'vigente', creado_en: '2026-01-05T21:00:00Z', reemplaza_a: null, lector: null, tiempo_activo_ms: null },
    ],
  }
}
