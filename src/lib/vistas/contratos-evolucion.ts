// Lo que recibe la pantalla Evolución y PnL (entrega 4, plan §4 B.3). Todo
// serializable: los montos van como texto decimal dentro de CalcVista, con su
// traza completa; cada cifra existe en pesos y en dólares (Par).

import type { CalcVista, Etiqueta } from '@/lib/domain/calc'
import type { Fecha } from '@/lib/domain/tipos'
import type { FraseDelDia, Par } from './contratos'

export type VistaPnl = 'financiero' | 'total'
export type MonedaElegida = 'ars' | 'usd' | 'ambas'
export type PeriodoElegido = 'semana' | 'mes' | '3m' | 'todo' | 'elegir'
export type EstadoEvolucion = 'sin_cargas' | 'un_dia' | 'periodo'

/** Lo que vive en la URL (?vista=&moneda=&periodo=&desde=&hasta=&s=). */
export interface ParametrosEvolucion {
  vista: VistaPnl
  moneda: MonedaElegida
  periodo: PeriodoElegido
  desde: Fecha | null
  hasta: Fecha | null
  /** Los supuestos del escenario (?s= de Flujo), para "Ajustar supuestos". */
  s: string | null
  /** Un escenario guardado elegido en el bloque Futuro (?e=); manda sobre ?s=. */
  e?: number | null
}

export type ClaveLineaPuente =
  | 'inicial'
  | 'aportes'
  | 'cuotas'
  | 'amortizacion'
  | 'activo'
  | 'tc'
  | 'sin_atribuir'
  | 'final'
  | 'de_lo_cual_bienes'
  | 'de_lo_cual_bienes_tc'
  | 'de_lo_cual_deuda'

export interface LineaPuenteVista {
  clave: ClaveLineaPuente
  nombre: string
  valor: Par
  /** "De lo cual": va debajo de su línea y no se suma. */
  informativa: boolean
}

export interface PuenteVista {
  desde: Fecha
  hasta: Fecha
  lineas: LineaPuenteVista[]
  cuadre: { ok: boolean | null; diferencia: Par; detalle: string }
  /** Cuotas pagadas que no entran, con el porqué (sin fecha, sin cuenta, caja que la app no sigue). */
  cuotas_fuera: string[]
}

export interface ContribuyenteVista {
  clave: string
  nombre: string
  ticker: string
  cuenta: string | null
  color: string
  resultado: Par
  /** Por el precio (activo) y por el dólar (TC), D-35. */
  activo: Par
  tc: Par
}

export interface FilaResultado {
  clave: string
  nombre: string
  ticker: string
  cuenta: string | null
  clase: 'posicion' | 'saldo' | 'bien' | 'pasivo'
  color: string
  resultado: Par
  activo: Par
  tc: Par
  sin_atribuir: Par
  /** null = no aplica (liquidez, bienes, deudas), con el porqué en no_aplica. */
  realizado: Par | null
  no_realizado: Par | null
  no_aplica: string | null
  /** Qué parte del resultado del período es esta fila (fracción). */
  peso: Par
}

/** Un grupo de la tabla de resultados (por cuenta o por activo): la suma de sus partidas. */
export interface GrupoVista {
  clave: string
  nombre: string
  /** Las claves de sus filas. */
  claves: string[]
  resultado: Par
  activo: Par
  tc: Par
  sin_atribuir: Par
  realizado: Par | null
  no_realizado: Par | null
  peso: Par
}

export interface TotalesResultado {
  resultado: Par
  activo: Par
  tc: Par
  sin_atribuir: Par
  realizado: Par
  no_realizado: Par
}

export interface MesVista {
  mes: Fecha
  /** "oct-26" */
  nombre: string
  parcial: string | null
  desde: Fecha
  hasta: Fecha
  lineas: LineaPuenteVista[]
  cuadre_ok: boolean | null
}

export interface PuntoSerieVista {
  fecha: Fecha
  ars: string | null
  usd: string | null
  /** Algún precio o saldo de ese día era viejo: punto hueco. */
  viejo?: boolean
  /** El patrimonio de ese día lleva un estimado (la deuda del leasing estimada, D-154). */
  estimado?: boolean
}

export interface FilaDiaCeroVista {
  clave: string
  ticker: string
  nombre: string
  cuenta: string | null
  color: string
  valor: Par
  costo: Par
  resultado: Par
  pendiente: string | null
}

export interface DiaCeroVista {
  fecha: Fecha
  filas: FilaDiaCeroVista[]
  total: Par
}

export interface SensibilidadVista {
  /** La suba del CCL, como fracción ("0.01"). */
  pct: string
  ars: CalcVista
  usd: CalcVista
  /** Lo que arriesga dólares y lo que arriesga pesos, en las dos monedas. */
  base_usd: Par
  base_pesos: Par
}

export interface LineaResultadoVista {
  clave: string
  nombre: string
  valor: Par
  signo: '+' | '−' | '=' | 'detalle'
  rotulo: string | null
  nota: string | null
}

export interface ResultadosVista {
  desde: Fecha
  hasta: Fecha
  /** "del mié 07/10 al mié 14/10", o "oct-26, el mes en curso" con una sola carga. */
  etiqueta: string
  un_dia: boolean
  lineas: LineaResultadoVista[]
}

export interface MesFuturoVista {
  mes: Fecha
  nombre: string
  financiero: Par
  aportes: Par
  activo: Par
  tc: Par
  etiquetas: Etiqueta[]
}

/** El bloque "Futuro", armado desde la ProyeccionVista de Flujo (plan §6 D.2). */
export interface FuturoVista {
  escenario: { id: number | null; nombre: string }
  estado: 'lista' | 'faltan'
  faltan: { variable: string; texto: string }[]
  meses: MesFuturoVista[]
  /** "Ajustar supuestos": Flujo y escenarios con los mismos supuestos (?s=), también los de un escenario guardado. */
  ajustar: string
  /** Los otros escenarios guardados, para cambiar el que se muestra (?e=). */
  otros: { id: number; nombre: string }[]
}

export interface VistaEvolucion {
  hoy: Fecha
  parametros: ParametrosEvolucion
  estado: EstadoEvolucion
  /** Fechas con carga (para "Elegir fechas"). */
  fechas: Fecha[]
  desde: Fecha | null
  hasta: Fecha | null
  /** El día cero: la primera carga. */
  primera: Fecha | null
  /** Una nota si el período pedido no se pudo usar ("elegí dos fechas con carga…"). */
  aviso_periodo: string | null
  ccl: CalcVista
  fecha_ccl: Fecha | null
  /** El patrimonio de la vista el día cero. */
  inicio: Par | null
  /** El patrimonio de la vista al final del período (o el de la única carga). */
  actual: Par | null
  frase: FraseDelDia | null
  puente: PuenteVista | null
  contribuyentes: ContribuyenteVista[]
  filas: FilaResultado[]
  totales: TotalesResultado | null
  /** La misma tabla agrupada por cuenta o por activo (vacío sin período). */
  grupos: { cuenta: GrupoVista[]; activo: GrupoVista[] }
  serie: PuntoSerieVista[]
  aportado: PuntoSerieVista[]
  meses: MesVista[]
  al_dia_cero: DiaCeroVista | null
  sensibilidad: SensibilidadVista | null
  resultados: ResultadosVista | null
  futuro: FuturoVista | null
  /** false: el bloque Futuro invita a armar el primer escenario en Flujo. */
  hay_escenarios: boolean
}
