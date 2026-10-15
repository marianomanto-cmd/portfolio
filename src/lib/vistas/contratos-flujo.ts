// Lo que recibe la pantalla Flujo y escenarios (plan §6 D.3). Serializable:
// los montos van como texto decimal dentro de CalcVista o ParNum. La
// proyección corre en el navegador con `base` (proyectar() es una función pura).

import type { CalcVista } from '@/lib/domain/calc'
import type { MovimientoParaControl } from '@/lib/domain/flujo/control'
import type { BaseProyeccion, Supuestos } from '@/lib/domain/flujo/tipos'
import type { Fecha, Moneda } from '@/lib/domain/tipos'
import type { Par, ParteFrase } from './contratos'

export type EstadoDemoFlujo = 'vacio' | 'sin-ingresos' | 'parcial' | 'completo' | 'comparar'

export interface FilaCalendario {
  tipo: 'ingreso' | 'gasto' | 'cuota' | 'vencimiento'
  nombre: string
  detalle: string | null
  valor: Par
  chips: string[]
  /** Un vencimiento sin el pago cargado: el acceso para cargarlo. */
  cargar_pago: { activo_id: number; ticker: string } | null
}

export interface MesCalendario {
  mes: Fecha
  nombre: string
  filas: FilaCalendario[]
  /** Con lo declarado: ingresos − gastos − cuotas que pagás vos (los vencimientos, aparte). */
  neto: Par
}

export interface FilaDesvioVista {
  linea: string
  nombre: string
  proyectado: Par
  real: Par
  desvio: Par
}

export interface MesCerrado {
  mes: Fecha
  nombre: string
  estado: 'cerrado' | 'en_curso'
  filas: FilaDesvioVista[]
}

export interface FilaRecurrente {
  id: number
  sentido: 'ingreso' | 'gasto'
  concepto: string
  moneda: Moneda
  monto: string
  desde: Fecha
  hasta: Fecha | null
  frecuencia: string
  primer_mes: Fecha | null
  pagador: 'titular' | 'empresa' | null
  naturaleza: string | null
  /** El monto en las dos monedas, con el tipo de cambio de tu última carga. */
  valor: Par
  vigente: boolean
}

export interface FilaCargada {
  id: number
  fecha: Fecha
  sentido: 'ingreso' | 'gasto'
  concepto: 'mensual' | 'extraordinario'
  moneda: Moneda
  monto: string
  cuenta: string | null
  cuenta_id: number | null
  cripto: string | null
  pesos: string | null
  lote: string | null
  carga_id: number
  anulado: boolean
  movimiento: 'aporte' | 'retiro' | null
  valor: Par
  puede_deshacer: boolean
  puede_anular: boolean
}

export interface BonoSinCronograma {
  activo_id: number
  ticker: string
  nombre: string
  fecha_vencimiento: Fecha | null
  /** VN en tenencia (texto decimal). */
  vn: string | null
}

export interface EscenarioVista {
  id: number
  nombre: string
  /** null si se guardó con otra versión de los supuestos: no se lee a medias (D-08). */
  supuestos: Supuestos | null
  archivado: boolean
}

export interface MesActual {
  mes: Fecha
  nombre: string
  partes: ParteFrase[]
  ingresos: Par
  gastos: Par
  cuota: Par
  excedente: Par
  cuotas: { nro: number; fecha: Fecha; total: Par; quien: 'titular' | 'empresa' | null; chips: string[] }[]
  vencimientos: { ticker: string; fecha: Fecha; valor: Par }[]
  reales: { ingresos: boolean; gastos: boolean }
  sin_declaraciones: boolean
}

export interface VistaFlujo {
  hoy: Fecha
  fecha_datos: Fecha | null
  demo: EstadoDemoFlujo | null
  /** null sin ninguna carga: no hay de dónde arrancar. */
  base: BaseProyeccion | null
  supuestos_iniciales: Supuestos
  ccl: CalcVista
  cripto: CalcVista
  mes_actual: MesActual | null
  calendario: MesCalendario[]
  cerrados: MesCerrado[]
  recurrentes: FilaRecurrente[]
  escenarios: EscenarioVista[]
  recordados: Record<string, string>
  cargados: FilaCargada[]
  sin_cronograma: BonoSinCronograma[]
  faltan_datos: { texto: string; href: string | null; etiqueta: string | null }[]
  cuentas: { id: number; nombre: string }[]
  /** Aportes y retiros cargados en Datos › Movimientos (últimos 62 días), para avisar una posible doble carga. */
  movimientos_datos: MovimientoParaControl[]
  /** Lo que declaraste en Pasivos: si la empresa te reintegra el IVA (null = sin declarar). */
  reintegro_declarado: boolean | null
  /** Quién paga la cuota según lo declarado (contrato o tu regla del 14/10). */
  pagador_declarado: 'titular' | 'empresa' | null
}
