// Hechos del dominio, ya convertidos de la base (montos en Decimal, fechas como
// 'YYYY-MM-DD' en America/Argentina/Cordoba). Reflejan las tablas de
// supabase/migrations; ver docs/datos.md. No guardan nada derivado.

import type { Decimal, Moneda } from './dinero'

export type { Moneda }
export type Fecha = string // 'YYYY-MM-DD'

export type TipoActivo = 'cedear' | 'accion_local' | 'bono' | 'lecap' | 'fci'
export type Geografia = 'AR' | 'US' | 'BR' | 'GLOBAL'
export type Indexacion =
  | 'fija'
  | 'cer'
  | 'tamar'
  | 'dual_cer_tamar'
  | 'dolar_linked'
  | 'hard_dollar'

export interface Cuenta {
  id: number
  nombre: string
  tipo: 'broker' | 'banco' | 'billetera'
  formato_carga: 'excel_ieb' | 'captura' | 'manual'
  activa: boolean
}

export interface Activo {
  id: number
  ticker: string
  nombre: string
  tipo: TipoActivo
  moneda_riesgo: Moneda
  geografia: Geografia
  indexacion: Indexacion | null
  ticker_subyacente: string | null
  fecha_vencimiento: Fecha | null
  color: string | null
  activo_bool: boolean
}

export type TipoOperacion =
  | 'apertura'
  | 'compra'
  | 'venta'
  | 'vencimiento'
  | 'renta'
  | 'amortizacion'
  | 'ajuste_ratio'

export interface Operacion {
  id: number
  fecha: Fecha
  fecha_origen: Fecha | null
  cuenta_id: number
  activo_id: number
  tipo: TipoOperacion
  cantidad: Decimal
  moneda: Moneda
  /** Por 1 VN / 1 unidad. null en compra = pendiente; en apertura = costo sin dato. */
  precio: Decimal | null
  /** compra/venta: total liquidado con comisiones; renta/amort./venc.: lo cobrado. */
  importe: Decimal | null
  comisiones: Decimal
  ccl_del_dia: Decimal | null
  carga_id: number
  notas: string | null
}

export interface Cotizacion {
  fecha: Fecha
  activo_id: number
  /** Por 1 VN / 1 unidad, en pesos (D-12). */
  precio_pesos: Decimal
  precio_usd_subyacente: Decimal | null
  carga_id: number
}

export interface TipoCambio {
  fecha: Fecha
  ccl: Decimal | null
  mep: Decimal | null
  cripto_venta: Decimal | null
  oficial: Decimal | null
  carga_id: number
}

export interface Saldo {
  fecha: Fecha
  cuenta_id: number
  moneda: Moneda
  /** Puede ser negativo (saldo deudor del bróker, D-13). */
  monto: Decimal
  carga_id: number
}

export interface MovimientoCapital {
  id: number
  fecha: Fecha
  fecha_acreditacion: Fecha | null
  tipo: 'aporte' | 'retiro' | 'transferencia'
  cuenta_origen_id: number | null
  cuenta_destino_id: number | null
  moneda_origen: Moneda | null
  monto_origen: Decimal | null
  moneda_destino: Moneda | null
  monto_destino: Decimal | null
  tc_aplicado: Decimal | null
  impuesto: Decimal
  carga_id: number
  notas: string | null
}

export interface Pasivo {
  id: number
  nombre: string
  tipo: 'leasing' | 'tarjeta' | 'prestamo'
  moneda: Moneda
  fecha_inicio: Fecha
  cuotas_totales: number
  opcion_compra_fecha: Fecha | null
}

export interface PasivoSaldo {
  pasivo_id: number
  fecha: Fecha
  capital_pendiente: Decimal
  carga_id: number
}

export interface Bien {
  id: number
  nombre: string
  tipo: 'inmueble' | 'vehiculo' | 'otro'
  moneda_valuacion: Moneda
  geografia: Geografia
  pasivo_id: number | null
  activo_bool: boolean
}

export interface BienValuacion {
  bien_id: number
  fecha: Fecha
  valor: Decimal
  fuente: string
  carga_id: number
}

export interface Feriado {
  mercado: 'AR' | 'US'
  fecha: Fecha
  descripcion: string
}

export interface CargaResumen {
  id: number
  lote: string | null
  fecha: Fecha
  cuenta_id: number | null
  origen: 'excel' | 'captura' | 'manual'
  archivo_path: string | null
  estado: 'vigente' | 'reemplazada' | 'revertida'
  creado_en: string
  reemplaza_a: number | null
  lector: string | null
  tiempo_activo_ms: number | null
}

/** Todo lo que el motor necesita para calcular. Se lee entero desde la base. */
export interface Hechos {
  cuentas: Cuenta[]
  activos: Activo[]
  operaciones: Operacion[]
  cotizaciones: Cotizacion[]
  tipos_cambio: TipoCambio[]
  saldos: Saldo[]
  movimientos: MovimientoCapital[]
  pasivos: Pasivo[]
  pasivo_saldos: PasivoSaldo[]
  bienes: Bien[]
  valuaciones: BienValuacion[]
  feriados: Feriado[]
  /** Solo cargas vigentes (las revertidas no aportan hechos). */
  cargas: CargaResumen[]
}
