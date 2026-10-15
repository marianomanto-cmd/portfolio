// Tipos del flujo de fondos y de los escenarios (entrega 4, plan §6 D.2 y D.9).
// Los publica el paso 0 para que Evolución y Balance programen contra ellos;
// los mantiene el constructor de Flujo. Se pueden sumar campos; cambiar o sacar
// uno publicado se avisa en la integración. Todo lo que cruza al navegador va
// como texto decimal (D-32), nunca como Decimal: la proyección corre también
// en el navegador, como función pura sobre una base serializada.

import type { Etiqueta } from '../calc'
import type { Fecha, Indexacion, Moneda, TipoActivo } from '../tipos'

export type Direccion = 'baja' | 'igual' | 'sube'

/** Una variable del escenario. Nada arranca elegido (dir null), salvo la regla que declaró el dueño. */
export interface Var {
  dir: Direccion | null
  /** El número del deslizante, como texto decimal (%/mes o %/año según la variable). */
  valor: string | null
}

/** Un tramo de una variable: vale desde el tramo anterior hasta `hasta_mes` (null = hasta el horizonte). */
export interface Tramo extends Var {
  hasta_mes: number | null
}

/** Un tramo del ingreso, "desde el mes N" (el dueño lo pidió como variable por mes, por el cambio de feb-2027). */
export interface TramoIngreso extends Var {
  desde_mes: number
  crecimiento_anual: string | null
  /** Solo pesos: ajuste mensual del ingreso del tramo, %/mes (texto decimal). null = nominal. */
  ajuste_mensual?: string | null
}

export type ClaseProyeccion = TipoActivo | 'liquidez'

export interface Supuestos {
  v: 1
  /**
   * El mes 1 de los meses de abajo es el siguiente a este (el de la carga con
   * que se armaron, día 1). Con otra carga, `rebasar` los corre: un escenario
   * de octubre que dice "desde el mes 4" (feb-2027) dice "desde el mes 3" en
   * noviembre. Ausente (un `?s=` de antes) = contados desde la carga de hoy.
   */
  base_mes?: string
  horizonte_meses: number | null
  devaluacion: Tramo[]
  inflacion: Tramo[]
  brecha_cripto: Var
  ingreso_usd: TramoIngreso[]
  ingreso_pesos: TramoIngreso[]
  tem_renovacion: Var
  reintegro_iva: boolean | null
  gastos: Var & { atado_inflacion?: boolean }
  retorno: { cedear: Var; accion_local: Var; liquidez_pesos: Var }
  /** Por ticker de cada bono dual que tenés. */
  dual: Record<string, Var>
  /** Adónde va lo que vence: 'regla' = la del dueño (proporcional a la última carga), o una clase. */
  destino_vencimientos: 'regla' | ClaseProyeccion | null
  casa: Var
  camioneta: Var
  shock_ingreso: { desde_mes: number; usd: string } | null
  pagador_cuota: { quien: 'titular' | 'empresa'; desde_mes: number | null } | null
  opcion_compra: { ejerce: boolean; mes: number | null } | null
  politica: {
    regla: 'proporcional_ultima_carga' | 'por_clase'
    /** % del excedente que se invierte, como texto decimal ("100"). */
    pct: string
    clase: ClaseProyeccion | null
    origen: 'declarada_14_10' | 'elegida'
    /** ¿El reparto proporcional incluye la liquidez (pesos y dólares en efectivo)? Ausente = sí (la lectura literal de "la última carga"). */
    incluye_liquidez?: boolean
  }
}

/** Un par de montos serializado: texto decimal, o null = sin dato. */
export interface ParNum {
  ars: string | null
  usd: string | null
}

/** Una partida de la última carga, con su peso en el financiero (la regla de reinversión del dueño). */
export interface PartidaBase {
  /** La clave de su ItemFoto ('p:cuenta:activo'), o 'liq:ARS' / 'liq:USD' para la liquidez sumada de todas las cuentas. */
  clave: string
  nombre: string
  clase: ClaseProyeccion
  moneda_riesgo: Moneda
  activo_id: number | null
  cuenta_id: number | null
  valor: ParNum
  /** Participación en el patrimonio financiero de la última carga (fracción); null = sin dato. */
  peso: string | null
  cantidad: string | null
  fecha_vencimiento: Fecha | null
  /** Ticker (o "Pesos" / "Dólares" en la liquidez). */
  ticker?: string
  indexacion?: Indexacion | null
  /**
   * Cómo se proyecta:
   * - 'cronograma': bono o letra de tasa fija con su pago cargado: va a vencimiento a su TEM implícita (D-146);
   * - 'sin_cronograma': de tasa fija y sin el pago al vencimiento: sin dato hasta que lo cargues;
   * - 'propia': bono con pago "a determinar" (dual, CER, TAMAR…): su propia variable del escenario;
   * - 'clase': crece con el retorno de su clase (CEDEAR, acción, liquidez, FCI).
   */
  ley?: 'cronograma' | 'sin_cronograma' | 'propia' | 'clase'
  /** TEM implícita entre el valor de hoy y los pagos del cronograma (fracción por 30 días); null = sin dato. */
  tem?: string | null
}

/** Un ingreso o un gasto declarado (ingresos_fijos, gastos_fijos), con su vigencia. */
export interface RecurrenteBase {
  id: number
  sentido: 'ingreso' | 'gasto'
  concepto: string
  moneda: Moneda
  monto: string
  vigente_desde: Fecha
  vigente_hasta: Fecha | null
  frecuencia: 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
  primer_mes: Fecha | null
  pagador: 'titular' | 'empresa' | null
  naturaleza: string | null
}

/** Una cuota del cuadro de marcha, lista para proyectar (sale de totalCuota y aperturaCuota de Pasivos). */
export interface CuotaBase {
  pasivo_id: number
  nro: number
  fecha_vencimiento: Fecha
  /** Fecha del pago, si la cuota está pagada y la planilla la trae. */
  fecha_pago?: Fecha | null
  /** Las partes, para la traza: canon, IVA, seguro, percepción y los cargos extra que vienen con la cuota (texto decimal). */
  partes?: { canon: string; iva: string; seguro: string; percepcion: string; cargos?: string }
  /** Lo que se debita, en pesos. */
  total: string
  /** La parte que baja la deuda; null = sin dato (falta la tasa del contrato). */
  amortizacion: string | null
  /** IVA y percepción: crédito fiscal de la empresa, que se reintegra solo si se declara. */
  iva_y_percepcion: string
  pagada: boolean
  pagador: 'titular' | 'empresa' | null
  /** proyectado, supuesto, a_confirmar… de la cuota. */
  etiquetas: Etiqueta[]
}

/** Un pago de un bono o una letra que tenés (flujos_bono × tenencia). */
export interface VencimientoBase {
  activo_id: number
  /** La partida que cobra (su clave de ItemFoto). */
  clave?: string
  /** VN en tenencia y pago por 1 VN, para la traza. */
  cantidad?: string | null
  pago_por_vn?: string | null
  fuente?: string | null
  ticker: string
  fecha: Fecha
  /** Lo que cobrás en pesos; null = sin dato (falta el cronograma, o el interés es "a determinar"). */
  monto_ars: string | null
  motivo: string | null
  /** El valor de hoy de esa tenencia, para la TEM implícita. */
  valor_hoy_ars: string | null
  /** El último pago: cierra la posición. */
  es_ultimo: boolean
}

export interface BienBase {
  id: number
  nombre: string
  tipo: 'inmueble' | 'vehiculo' | 'otro'
  moneda: Moneda
  /** La última valuación, en su moneda; null = sin dato. */
  valor: string | null
  pasivo_id: number | null
}

/** Un ingreso o un gasto cargado con "Cargar ingreso" / "Cargar gasto" (flujos_reales, D.9). */
export interface FlujoReal {
  id: number
  fecha: Fecha
  sentido: 'ingreso' | 'gasto'
  concepto: 'mensual' | 'extraordinario'
  moneda: Moneda
  monto: string
  /** null = entró o salió "afuera" (fuera de las cuentas seguidas). */
  cuenta_id: number | null
  cripto_usado: string | null
  pesos_recibidos: string | null
  anulado: boolean
  carga_id: number
  notas: string | null
}

/** Lo que el servidor le pasa a proyectar(): todo serializable. */
export interface BaseProyeccion {
  /** La fecha de la última carga: la proyección arranca de ahí, nunca de un supuesto viejo. */
  fecha: Fecha
  hoy: Fecha
  ccl: string | null
  cripto: string | null
  partidas: PartidaBase[]
  recurrentes: RecurrenteBase[]
  cuotas: CuotaBase[]
  vencimientos: VencimientoBase[]
  bienes: BienBase[]
  /** La deuda de cada pasivo a la fecha de la base, con su origen. */
  deudas: { pasivo_id: number; ars: string | null; origen: 'informada' | 'segun_cuadro' | 'estimada' | null }[]
  flujos_reales: FlujoReal[]
  /** Los contratos de los pasivos: quién paga la cuota y si la empresa reintegra el IVA (lo declarado en Pasivos). */
  pasivos?: {
    id: number
    nombre: string
    pagador_habitual: 'titular' | 'empresa' | null
    reintegra_iva: boolean | null
    /** Tipo, inicio y plazo del contrato: sin cuadro de marcha cargado, la cuota de un mes del plazo es "sin dato" (nunca $ 0). */
    tipo?: 'leasing' | 'tarjeta' | 'prestamo'
    fecha_inicio?: Fecha
    cuotas_totales?: number
  }[]
  /** CCL y cripto de cada carga (los meses reales se convierten con estos). */
  historia_tc?: { fecha: Fecha; ccl: string | null; cripto: string | null }[]
  /** Fecha del cripto de la base (puede ser anterior a `fecha` si ese día no lo cargaste). */
  fecha_cripto?: Fecha | null
  /** Lo que cobraste de bonos y letras (vencimientos, rentas, amortizaciones), para los meses reales. */
  /** ars null = un cobro en dólares sin el CCL de su día: sin dato, nunca × 0. */
  cobros_reales?: { fecha: Fecha; ticker: string; ars: string | null }[]
  /** Nombres de las cuentas (para "a qué cuenta entró"). */
  cuentas?: { id: number; nombre: string }[]
}

/** Un mes de la proyección. `real` = el mes ya pasó y sus cifras salen de los hechos. */
export interface MesProyectado {
  mes: Fecha
  real: boolean
  /** cerrado (antes de la carga), en_curso (el mes de la última carga) o proyectado. */
  estado?: 'cerrado' | 'en_curso' | 'proyectado'
  ccl: string | null
  cripto?: string | null
  ingresos: ParNum
  gastos: ParNum
  /** La cuota entera (lo que se debita) si la paga el dueño. */
  cuota: ParNum
  /** La parte de la cuota que es gasto (todo menos la amortización). */
  cuota_gasto: ParNum
  vencimientos: ParNum
  excedente: ParNum
  invertido: ParNum
  financiero: ParNum
  neto_sin_financiados: ParNum
  deuda_leasing: ParNum
  neto_completo: ParNum
  pnl: { aportes: ParNum; activo: ParNum; tc: ParNum }
  /** supuesto, proyectado, estimado…: se muestran como chip en el mes. */
  etiquetas: Etiqueta[]
  /** Lo extraordinario que cargaste en el mes (va aparte: no cambia la proyección recurrente). */
  extraordinarios?: ParNum
  /** Lo que te reintegra la empresa del IVA y la percepción, si lo declaraste o lo elegiste. */
  reintegro?: ParNum
  /** Liquidez en pesos al fin del mes (de acá sale un excedente negativo). */
  liquidez_pesos?: ParNum
  /** Si el excedente negativo no se cubre con tu liquidez en pesos: lo que falta. null = se cubre. */
  no_se_cubre?: ParNum | null
  /** Casa y demás bienes sin deuda; la camioneta, aparte. */
  bienes_libres?: ParNum
  bienes_financiados?: ParNum
  /** Capital aportado acumulado: el financiero de la carga + lo invertido − lo retirado. */
  aportado?: ParNum
  /** Qué líneas del mes salen de hechos cargados (ingresos, gastos, cuota, vencimientos). */
  reales?: ('ingresos' | 'gastos' | 'cuota' | 'vencimientos')[]
  /** Por qué una cifra del mes es "sin dato" (la primera que falta). */
  motivos?: Partial<Record<CampoMes, string>>
}

/** Las cifras de un mes que tienen traza (trazaMes). */
export type CampoMes =
  | 'ingresos'
  | 'gastos'
  | 'cuota'
  | 'cuota_gasto'
  | 'vencimientos'
  | 'excedente'
  | 'invertido'
  | 'financiero'
  | 'neto_sin_financiados'
  | 'deuda_leasing'
  | 'neto_completo'
  | 'pnl.aportes'
  | 'pnl.activo'
  | 'pnl.tc'
  | 'liquidez_pesos'
  | 'aportado'

export interface Proyeccion {
  estado: 'lista' | 'faltan'
  /** Las variables que faltan elegir, con el texto que lo dice. Con faltantes no se inventa ningún mes. */
  faltan: { variable: string; texto: string }[]
  meses: MesProyectado[]
  /** Variables que faltan solo para una parte (la casa, la camioneta): esas cifras quedan "sin dato". */
  faltan_parciales?: { variable: string; texto: string }[]
  /** Visión 4.15: primer mes en que la mediana de 12 meses del resultado sin aportes (USD) alcanza la cuota en USD. */
  cobertura?: { mes: Fecha | null; texto: string } | null
  /** Visión 4.15: financiero al horizonte contra el capital aportado proyectado. */
  debajo?: { diferencia: ParNum; texto: string } | null
}

/** Lo que recibe Evolución para su bloque "Futuro". */
export interface ProyeccionVista {
  escenario: { id: number | null; nombre: string }
  proyeccion: Proyeccion
}
