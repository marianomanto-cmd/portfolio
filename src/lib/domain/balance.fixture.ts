// Hechos inventados para los tests del balance (D-24: ningún número es del
// dueño). Son los del plan de la entrega 4 (§3 A.1): CCL 1.500,00, financiero
// $ 105.000.000 (US$ 70.000), casa US$ 180.000, camioneta $ 36.000.000
// financiada por un leasing. Dos fechas de carga, el mar 13/10 y el mié 14/10.

import { Decimal } from './dinero'
import type { Activo, Bien, BienValuacion, CargaResumen, Cotizacion, Cuenta, Fecha, Hechos, Operacion, Pasivo, PasivoSaldo, Saldo, TipoCambio } from './tipos'

const D = (x: string | number) => new Decimal(x)

export const F13: Fecha = '2026-10-13'
export const F14: Fecha = '2026-10-14'

const CUENTAS: Cuenta[] = [
  { id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true },
  { id: 2, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true },
  { id: 3, nombre: 'Mercado Pago', tipo: 'billetera', formato_carga: 'captura', activa: true },
]

const activo = (a: Pick<Activo, 'id' | 'ticker' | 'nombre' | 'tipo' | 'moneda_riesgo'> & Partial<Activo>): Activo => ({
  geografia: 'AR',
  indexacion: null,
  ticker_subyacente: null,
  fecha_vencimiento: null,
  color: null,
  activo_bool: true,
  ...a,
})

const ACTIVOS: Activo[] = [
  activo({ id: 1, ticker: 'SPY', nombre: 'SPDR S&P 500 (CEDEAR)', tipo: 'cedear', moneda_riesgo: 'USD', geografia: 'US' }),
  activo({ id: 2, ticker: 'YPFD', nombre: 'YPF', tipo: 'accion_local', moneda_riesgo: 'ARS' }),
  activo({ id: 3, ticker: 'T30J7', nombre: 'BONCAP jun-27', tipo: 'bono', moneda_riesgo: 'ARS', fecha_vencimiento: '2027-06-30' }),
  activo({ id: 4, ticker: 'S13N6', nombre: 'LECAP nov-26', tipo: 'lecap', moneda_riesgo: 'ARS', fecha_vencimiento: '2026-11-13' }),
]

/**
 * Al 14/10 (CCL 1.500): SPY 1.240 × $ 35.150 = $ 43.586.000; YPFD 400 ×
 * $ 44.555 = $ 17.822.000; T30J7 8.000.000 × $ 1,124 = $ 8.992.000 (IEB);
 * S13N6 10.000.000 × $ 1,20 = $ 12.000.000 (Galicia); pesos en IEB
 * $ 6.000.000, dólares en IEB US$ 4.000 ($ 6.000.000), pesos en Mercado Pago
 * $ 10.600.000. Financiero: $ 105.000.000 = US$ 70.000.
 */
const PRECIOS: Record<number, [string, string]> = {
  1: ['34900', '35150'],
  2: ['44100', '44555'],
  3: ['1.1230', '1.1240'],
  4: ['1.1990', '1.2000'],
}
const CANTIDAD: Record<number, string> = { 1: '1240', 2: '400', 3: '8000000', 4: '10000000' }
const CUENTA_DE: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 2 }

export const PASIVO: Pasivo = { id: 1, nombre: 'Leasing de la camioneta', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-08-17', cuotas_totales: 35, opcion_compra_fecha: '2028-07-17' }
export const CASA: Bien = { id: 1, nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null, activo_bool: true }
export const CAMIONETA: Bien = { id: 2, nombre: 'Camioneta', tipo: 'vehiculo', moneda_valuacion: 'ARS', geografia: 'AR', pasivo_id: 1, activo_bool: true }

export type DeudaFixture = 'informada' | 'estimada' | 'ninguna'

export interface OpcionesFixture {
  /** La deuda del leasing: informada ($ 19.500.000 el 13/10), estimada ($ 21.000.000 el 08/10) o ninguna. */
  deuda?: DeudaFixture
  sinBienes?: boolean
  casaSinValuacion?: boolean
  camionetaSinValuacion?: boolean
  /** Sin el precio de YPFD el 14/10 (y sin ninguno antes): su valor es "sin dato". */
  sinPrecioYpf?: boolean
  /** Solo la carga del 14/10. */
  unDia?: boolean
}

export function hechosBalance(o: OpcionesFixture = {}): Hechos {
  const fechas: Fecha[] = o.unDia ? [F14] : [F13, F14]
  const cargaTc = (k: number) => 10 + k
  const cargaCuenta = (k: number, c: number) => 20 + k * 3 + c
  const cargas: CargaResumen[] = []
  fechas.forEach((fecha, k) => {
    const base = { lote: `lote-${fecha}`, fecha, estado: 'vigente' as const, creado_en: `${fecha}T22:00:00.000Z`, reemplaza_a: null, lector: null, tiempo_activo_ms: null }
    cargas.push({ ...base, id: cargaTc(k), cuenta_id: null, origen: 'manual', archivo_path: null })
    for (const c of CUENTAS) cargas.push({ ...base, id: cargaCuenta(k, c.id), cuenta_id: c.id, origen: 'manual', archivo_path: null })
  })
  const k14 = fechas.indexOf(F14)
  const tipos_cambio: TipoCambio[] = fechas.map((fecha, k) => ({ fecha, ccl: D(fecha === F14 ? '1500' : '1490'), mep: null, cripto_venta: null, oficial: null, carga_id: cargaTc(k) }))
  const cotizaciones: Cotizacion[] = []
  for (const a of ACTIVOS) {
    fechas.forEach((fecha, k) => {
      if (o.sinPrecioYpf && a.id === 2) return
      cotizaciones.push({ fecha, activo_id: a.id, precio_pesos: D(PRECIOS[a.id][fecha === F14 ? 1 : 0]), precio_usd_subyacente: null, carga_id: cargaCuenta(k, CUENTA_DE[a.id]) })
    })
  }
  const operaciones: Operacion[] = ACTIVOS.map((a) => ({
    id: a.id,
    fecha: fechas[0],
    fecha_origen: null,
    cuenta_id: CUENTA_DE[a.id],
    activo_id: a.id,
    tipo: 'apertura',
    cantidad: D(CANTIDAD[a.id]),
    moneda: 'ARS',
    precio: D(PRECIOS[a.id][0]),
    importe: null,
    comisiones: D(0),
    ccl_del_dia: null,
    carga_id: cargaCuenta(0, CUENTA_DE[a.id]),
    notas: null,
  }))
  const saldos: Saldo[] = []
  fechas.forEach((fecha, k) => {
    saldos.push({ fecha, cuenta_id: 1, moneda: 'ARS', monto: D('6000000'), carga_id: cargaCuenta(k, 1) })
    saldos.push({ fecha, cuenta_id: 1, moneda: 'USD', monto: D('4000'), carga_id: cargaCuenta(k, 1) })
    saldos.push({ fecha, cuenta_id: 3, moneda: 'ARS', monto: D(fecha === F14 ? '10600000' : '10550000'), carga_id: cargaCuenta(k, 3) })
  })
  const cargaDatos = cargaTc(k14)
  const valuaciones: BienValuacion[] = []
  if (!o.sinBienes && !o.casaSinValuacion) valuaciones.push({ bien_id: 1, fecha: '2026-10-08', valor: D('180000'), fuente: 'tasación de una inmobiliaria', carga_id: cargaDatos })
  if (!o.sinBienes && !o.camionetaSinValuacion) valuaciones.push({ bien_id: 2, fecha: '2026-10-08', valor: D('36000000'), fuente: 'cotización del seguro', carga_id: cargaDatos })
  const pasivo_saldos: PasivoSaldo[] = []
  if (o.deuda === 'estimada' || o.deuda === undefined) {
    pasivo_saldos.push({ pasivo_id: 1, fecha: '2026-10-08', capital_pendiente: D('21000000'), naturaleza: 'estimado', fuente: 'VP de los cánones que faltan y la opción, a la tasa del contrato (inventado)', carga_id: cargaDatos })
  } else if (o.deuda === 'informada') {
    pasivo_saldos.push({ pasivo_id: 1, fecha: F13, capital_pendiente: D('19500000'), naturaleza: 'informado', fuente: 'la leasera, por correo', carga_id: cargaDatos })
  }
  return {
    cuentas: CUENTAS,
    activos: ACTIVOS,
    operaciones,
    cotizaciones,
    tipos_cambio,
    saldos,
    movimientos: [],
    pasivos: [PASIVO],
    pasivo_saldos,
    bienes: o.sinBienes ? [] : [CASA, CAMIONETA],
    valuaciones,
    feriados: [],
    cargas,
  }
}
