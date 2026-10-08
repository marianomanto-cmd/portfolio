// Contratos de la carga diaria (docs/carga-diaria.md, D-10 a D-19).
//
// Cada lector (Excel de IEB, captura de Galicia o de Mercado Pago) devuelve una
// LecturaCuenta: lo que entendió, fila por fila, con su verificación. La
// pantalla de Cargar la muestra en la bandeja; al confirmar, se arma una
// ConfirmacionCarga que va entera, en una sola transacción, a la función
// confirmar_carga de la base.
//
// Todos los números viajan como texto decimal normalizado ("1234.56"): nunca
// como number de JavaScript (D-32).

import type { Fecha, Moneda, TipoActivo, TipoOperacion } from '@/lib/domain/tipos'

export type NombreCuenta = 'IEB' | 'Galicia' | 'Mercado Pago'

/** verificada: cerró su control. advertencia: se acepta de a una. error: no se graba hasta corregir. */
export type EstadoFila = 'verificada' | 'advertencia' | 'error'

export interface Chequeo {
  /** Qué se comparó: "cantidad × precio × escala ≈ valorizado". */
  regla: string
  esperado: string
  calculado: string
  /** Tolerancia derivada de la precisión mostrada (medio último dígito). */
  tolerancia: string
  ok: boolean
}

/**
 * Las dos lecturas de una captura no coinciden en un campo (D-36). `a` y `b`
 * son lo que vio cada lectura: texto decimal normalizado ("1234.5") cuando se
 * entendió como número; si no, el texto tal cual. `propuesta` es la que cerró
 * la aritmética (o la única legible). La bandeja muestra las dos y el dueño
 * elige una con un toque.
 */
export interface Alternativa {
  /** Campo de la fuente: 'cantidad', 'precio', 'valorizado', 'ppc', 'rendimiento_monto', 'rendimiento_porcentaje', 'ticker', 'monto', 'moneda'. */
  campo: string
  a: string
  b: string
  propuesta: 'A' | 'B'
}

export interface FilaLeida {
  /** Identificador estable dentro de la lectura: "IEB:T30J7". */
  clave: string
  /** Ticker tal como lo trae la fuente (sin el nombre). */
  ticker: string
  nombre: string | null
  seccion: 'acciones' | 'bonos' | 'cedears' | 'otros' | 'fci' | null
  /** Tipo sugerido para dar de alta un ticker desconocido. */
  tipo_sugerido: TipoActivo | null
  moneda_emision: Moneda | null
  cantidad: string | null
  /** Precio en la escala de la fuente (IEB: cada 100 VN en bonos). */
  precio_mostrado: string | null
  /** Multiplicador fuente → por 1 VN: "1", "0.01" o "0.001" (D-12). */
  escala: '1' | '0.01' | '0.001' | null
  /** Precio por 1 VN / 1 unidad. Es lo que se graba en cotizaciones. */
  precio_unitario: string | null
  valorizado: string | null
  /** PPP/PPC en la escala de la fuente y normalizado por 1 VN. */
  ppc_mostrado: string | null
  ppc_unitario: string | null
  /** Costo total si la fuente lo permite (Galicia: valorizado − rendimiento $). */
  costo_total: string | null
  /** IEB: sub-fila "Disponible" o "Liquidar". */
  liquidacion: 'disponible' | 'liquidar' | null
  estado: EstadoFila
  /** Por qué no está verificada (vacío si lo está). */
  motivos: string[]
  chequeo: Chequeo | null
  /** Dónde está en la fuente: "hoja Patrimonio, fila 21". */
  lugar: string | null
  /** Campos en los que las dos lecturas de una captura no coinciden. */
  alternativas?: Alternativa[]
  /**
   * Captura: el rendimiento $ leído, con su signo y en la moneda de la fuente
   * (null si fue ilegible). Con él, una cantidad corregida a mano vuelve a dar
   * el costo como lo arma el lector: (valorizado − rendimiento $) ÷ cantidad.
   * Ausente en el Excel (el PPP del bróker no depende de la cantidad).
   */
  rendimiento?: string | null
  /**
   * Moneda en la que la fuente muestra precio, valorizado y PPC. Ausente o
   * 'ARS': pesos. Galicia muestra en U$D la sección "Bonos en dólares"; la 1a
   * guarda precios en pesos, así que esa fila no se graba (queda en error).
   * No confundir con moneda_emision (IEB: moneda de emisión, precio en pesos).
   */
  moneda_precio?: Moneda
}

export interface SaldoLeido {
  moneda: Moneda
  /** Puede ser negativo (D-13). */
  monto: string
  /** Partes que lo componen (IEB USD = Total de Saldos + DOLARUSA). */
  partes: { concepto: string; monto: string }[]
  /** TNA anunciada, si la captura la muestra (Mercado Pago), en porcentaje: "27.5" es 27,5 %; "1" es 1 %. */
  tna: string | null
  estado: EstadoFila
  motivos: string[]
  lugar: string | null
  /** Las dos lecturas del saldo (o de su moneda) cuando no coinciden. */
  alternativas?: Alternativa[]
}

export interface ControlLeido {
  tipo: 'ieb_b2' | 'ieb_subtotal' | 'galicia_total'
  seccion: string | null
  /** Moneda de informado y calculado (ausente: pesos). */
  moneda?: Moneda | null
  /**
   * Captura: qué tenencias cubre este total (la sección y la moneda). Si el
   * total cierra, una tenencia de esa sección y moneda que la captura no
   * trae es una ausente (venta total o vencimiento).
   */
  cobertura?: { seccion: NonNullable<FilaLeida['seccion']>; moneda: Moneda } | null
  informado: string
  /** Lo que da la suma de lo leído (en la misma moneda y escala que la fuente). */
  calculado: string | null
  ok: boolean | null
  detalle: string | null
  /** Tolerancia del control (D-37), en la misma moneda y escala; null si no se pudo calcular. */
  tolerancia?: string | null
}

export interface LecturaCuenta {
  cuenta: NombreCuenta
  origen: 'excel' | 'captura'
  /** Fecha que dice la fuente (B1 del Excel; la que muestre la captura). */
  fecha_reporte: Fecha | null
  filas: FilaLeida[]
  saldos: SaldoLeido[]
  controles: ControlLeido[]
  /** Advertencias generales (no de una fila). */
  advertencias: string[]
  /**
   * Tipos de cambio que la fuente usa para valuar (D-66): IEB pasa los dólares
   * a pesos con el precio de DOLARUSA. La bandeja lo compara con tu CCL.
   */
  tipo_cambio_fuente?: { dolar_ieb: string | null } | null
  /** Lector y versión: "ieb-excel@1", "captura-claude@1". */
  lector: string
  /** Lo crudo, para cargas.lectura_cruda. */
  cruda: unknown
}

// ───────────── Confirmación ─────────────

export interface CotizacionAGrabar {
  activo_id: number
  precio_pesos: string
}

export interface SaldoAGrabar {
  moneda: Moneda
  monto: string
}

export interface OperacionAGrabar {
  activo_id: number
  tipo: TipoOperacion
  cantidad: string
  moneda: Moneda
  precio: string | null
  importe: string | null
  comisiones: string
  ccl_del_dia: string | null
  fecha_origen: Fecha | null
  notas: string | null
}

/** Completa el precio de una compra que quedó pendiente (D-19). */
export interface PrecioACompletar {
  operacion_id: number
  /** Por 1 VN / 1 unidad, en la moneda de la compra. */
  precio: string
}

export interface CuentaAGrabar {
  cuenta_id: number
  origen: 'excel' | 'captura' | 'manual'
  archivo_path: string | null
  archivo_sha256: string | null
  lector: string | null
  lectura_cruda: unknown
  /** Lo confirmado por posición + diferencias de conciliación y su resolución. */
  grabado: unknown
  listado_completo: boolean
  cotizaciones: CotizacionAGrabar[]
  saldos: SaldoAGrabar[]
  operaciones: OperacionAGrabar[]
  /**
   * Compras pendientes de esta cuenta (precio e importe vacíos) cuyo precio se
   * completa con el PPP de hoy (D-19). La base solo lo acepta si la compra
   * sigue pendiente y es de esta cuenta; revertir el lote la deja pendiente otra vez.
   */
  completar_precios?: PrecioACompletar[]
}

export interface ConfirmacionCarga {
  /** Idempotencia: el mismo lote confirmado dos veces no duplica nada. */
  lote: string
  fecha: Fecha
  tipo_cambio: {
    ccl: string | null
    cripto_venta: string | null
    mep: string | null
    oficial: string | null
    /** De dónde sacaste el CCL ("Ámbito, cierre"); hasta 200 caracteres. */
    referencia?: string | null
  } | null
  cuentas: CuentaAGrabar[]
  /** Tiempo activo de la carga, para medir los 60 segundos (D-62). */
  tiempo_activo_ms: number | null
  /** Nota del día, si la hay (va a eventos tipo nota). */
  nota: string | null
  /**
   * Huella del pedido: sha256 (hex) de lo que el dueño mandó con el Enter
   * (fuentes, elecciones, ediciones, tipos de cambio y nota). Un reintento del
   * mismo Enter trae la misma; el mismo lote con otro contenido, otra, y la
   * base lo rechaza en vez de decir "ya estaba guardado".
   */
  huella?: string | null
}

export interface ResultadoConfirmacion {
  lote: string
  cargas: { carga_id: number; cuenta_id: number | null }[]
  repetido: boolean
}

// ───────────── Propuesta: lo que la bandeja muestra antes de confirmar ─────────────
// La arma src/lib/carga/conciliar.ts comparando lo leído contra lo que la app
// ya sabe (tenencias derivadas de las operaciones, D-15).

export type AccionFila =
  | 'ninguna' // la cantidad coincide: solo se graba el precio
  | 'apertura' // primera vez que se ve esta tenencia (D-14)
  | 'compra' // el bróker tiene más que la app (D-15, D-19)
  | 'venta' // el bróker tiene menos que la app
  | 'completar_precio' // la cantidad coincide y el PPP de hoy completa una compra pendiente (D-19)
  | 'revisar' // no se puede decidir solo

export interface ActivoNuevo {
  ticker: string
  nombre: string
  tipo: TipoActivo
  moneda_riesgo: Moneda
  geografia: 'AR' | 'US' | 'BR' | 'GLOBAL'
  indexacion: 'fija' | 'cer' | 'tamar' | 'dual_cer_tamar' | 'dolar_linked' | 'hard_dollar' | null
  ticker_subyacente: string | null
}

export interface DecisionFila {
  clave: string
  cuenta: NombreCuenta
  cuenta_id: number
  ticker: string
  nombre: string | null
  /** null: el ticker no está en el catálogo; hay que darlo de alta (activo_nuevo). */
  activo_id: number | null
  activo_nuevo: ActivoNuevo | null
  cantidad_leida: string | null
  /** Tenencia que la app deriva de sus operaciones, antes de esta carga. */
  cantidad_app: string | null
  accion: AccionFila
  operacion: OperacionAGrabar | null
  /**
   * accion 'completar_precio': la compra pendiente y el precio inferido del
   * PPP, con la fórmula (traza). Se acepta de a una; nunca se aplica sola.
   */
  completar?: PrecioInferido | null
  cotizacion: { precio_pesos: string } | null
  /**
   * accion 'compra' de una tenencia que la app nunca tuvo en una cuenta ya
   * cargada: también puede ser una tenencia vieja que quedó pendiente el Día
   * cero. Esta es la otra opción, la apertura con el PPP del bróker (D-14), que
   * el dueño elige de a una ("Ya la tenía"); nunca se aplica sola.
   */
  apertura_alternativa?: OperacionAGrabar | null
  estado: EstadoFila
  motivos: string[]
  fila: FilaLeida
}

export interface PrecioInferido extends PrecioACompletar {
  /** Fecha y cantidad de la compra pendiente. */
  fecha: Fecha
  cantidad: string
  /** "(10.200 × 110 − $ 1.000.000) ÷ 10 = $ 12.200". */
  formula: string
}

export interface DecisionSaldo {
  clave: string
  cuenta: NombreCuenta
  cuenta_id: number
  moneda: Moneda
  monto: string
  /** Último saldo conocido, para "¿entró o salió plata?" (CA-4). */
  anterior: { fecha: Fecha; monto: string } | null
  estado: EstadoFila
  motivos: string[]
  saldo: SaldoLeido
}

/**
 * Tenencia que la app tiene en la cuenta y la fuente no trae: el Excel de IEB
 * (que lista todo) o una captura en una sección y moneda cuyo total cierra.
 * Casi siempre es una venta total o un vencimiento. La bandeja ofrece
 * registrarlo (el importe o el precio los tipea el dueño: el último precio es
 * solo una referencia) o dejarlo pendiente, y entonces su valor pasa a "sin
 * dato" (Hechos.ausentes).
 */
export interface AusentePropuesto {
  cuenta: NombreCuenta
  cuenta_id: number
  activo_id: number
  ticker: string
  tipo_activo: TipoActivo
  cantidad_app: string
  /** Lo que se propone registrar: un bono o una LECAP vence; lo demás se vende. */
  sugerida: 'venta' | 'vencimiento'
  /** Las operaciones que se pueden registrar (un bono también se puede vender). */
  opciones: ('venta' | 'vencimiento')[]
  /** Último precio conocido por 1 VN, en pesos: solo como referencia. */
  ultimo_precio: { fecha: Fecha; precio_pesos: string } | null
  /** CCL del día con el que se registraría (tipeado o el ya cargado ese día). */
  ccl_del_dia: string | null
}

export interface PropuestaCarga {
  fecha: Fecha
  filas: DecisionFila[]
  saldos: DecisionSaldo[]
  controles: { cuenta: NombreCuenta; control: ControlLeido }[]
  advertencias: string[]
  /** Tenencias que la app tiene y la fuente, que las cubre, no trae (ver AusentePropuesto). */
  ausentes: AusentePropuesto[]
  /** CCL que usan las operaciones de la bandeja: el tipeado o, si no, el ya cargado ese día. */
  ccl?: { valor: string; origen: 'tipeado' | 'cargado' } | null
}
