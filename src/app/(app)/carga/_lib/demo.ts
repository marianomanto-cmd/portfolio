// Hechos para cuando no hay base (modo demo o falta la configuración de
// Supabase): las tres cuentas del dueño y el catálogo que hayas dado de alta en
// la pantalla, sin operaciones ni precios. Así la lectura y la bandeja andan
// igual, y la confirmación avisa que no se guarda nada.

import type { ActivoNuevo } from '@/lib/carga/contratos'
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
