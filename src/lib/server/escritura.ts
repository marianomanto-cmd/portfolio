import 'server-only'

// Capa de escritura (docs/datos.md, reglas 3 y 4; D-17, D-20, D-32).
//
// Toda escritura que toca más de una fila pasa por una función de Postgres, que
// la hace en una sola transacción (migración 20261008120000_carga_transaccional):
//   confirmar_carga · revertir_lote · guardar_manual · alta_activo · editar_activo.
// Las altas de una sola fila (bienes, pasivos) van directo a su tabla.
//
// Antes de mandar nada, cada monto se valida acá: texto decimal ("1234.56"),
// finito, con su signo permitido. Los montos viajan como texto, nunca como
// number de JavaScript (D-32), y la base lo vuelve a verificar.
//
// Los errores salen como ErrorEscritura, con un mensaje en español que la
// pantalla puede mostrar tal cual. En una Server Action, atrapalo y devolvé el
// mensaje: en producción Next oculta el texto de los errores que se lanzan.

import { createHash, randomUUID } from 'node:crypto'
import type {
  ActivoNuevo,
  ConfirmacionCarga,
  CotizacionAGrabar,
  CuentaAGrabar,
  OperacionAGrabar,
  ResultadoConfirmacion,
  SaldoAGrabar,
} from '@/lib/carga/contratos'
import type { Database } from '@/lib/database.types'
import { dec } from '@/lib/domain/dinero'
import { hoyCordoba } from '@/lib/domain/fechas'
import type { Fecha, Geografia, Indexacion, Moneda, TipoActivo, TipoOperacion } from '@/lib/domain/tipos'
import { supabase } from './supabase'

// ───────────── API ─────────────

export interface ResumenReversion {
  lote: string
  cargas: number[]
  borradas: number
  restauradas: number
}

export type CambiosActivo = Partial<{
  nombre: string
  tipo: TipoActivo
  moneda_riesgo: Moneda
  geografia: Geografia
  indexacion: Indexacion | null
  ticker_subyacente: string | null
  fecha_vencimiento: Fecha | null
  color: string | null
  activo_bool: boolean
}> & { ratio?: { ratio: string; vigente_desde: Fecha } }

export type ActivoAlta = ActivoNuevo & {
  ratio?: string | null
  color?: string | null
  fecha_vencimiento?: Fecha | null
}

export interface BienAlta {
  nombre: string
  tipo: 'inmueble' | 'vehiculo' | 'otro'
  moneda_valuacion: Moneda
  geografia?: Geografia
  pasivo_id?: number | null
}

export interface PasivoAlta {
  nombre: string
  tipo: 'leasing' | 'tarjeta' | 'prestamo'
  moneda: Moneda
  fecha_inicio: Fecha
  cuotas_totales: number
  monto_financiado_neto?: string | null
  anticipo_neto?: string | null
  opcion_compra_neto?: string | null
  opcion_compra_fecha?: Fecha | null
  valor_bien?: string | null
  notas?: string | null
}

/**
 * Confirma un lote de la carga diaria: tipo de cambio, una carga por cuenta,
 * cotizaciones, saldos, operaciones y nota, todo o nada. Es idempotente por
 * lote: un doble Enter (o un reintento) devuelve las mismas cargas con
 * `repetido: true`. Después de revertir un lote, una carga nueva necesita un
 * lote nuevo.
 */
export async function confirmarCarga(c: ConfirmacionCarga): Promise<ResultadoConfirmacion> {
  const p = normalizarConfirmacion(c)
  const data = await llamar('confirmar_carga', { p }, 'confirmar la carga', { reintentable: true })
  return leerResultadoConfirmacion(data, p.lote)
}

/**
 * Revierte todas las cargas de un lote: borra sus hechos, restaura desde la
 * auditoría lo que habían pisado y las deja en el registro como revertidas.
 * Se niega si alguna cuenta del lote tiene una carga posterior.
 */
export async function revertirLote(lote: string, motivo: string): Promise<ResumenReversion> {
  const l = loteValido(lote)
  const m = typeof motivo === 'string' ? motivo.trim() : ''
  if (m === '') throw new ErrorEscritura('Falta el motivo de la reversión.')
  const data = await llamar('revertir_lote', { p_lote: l, p_motivo: m }, 'revertir el lote')
  return leerResumenReversion(data, l)
}

/**
 * Da de alta un activo (y su ratio, si es un CEDEAR con ratio) en una
 * transacción. El ratio rige desde hoy (Córdoba); sin ratio, queda "sin dato".
 */
export async function crearActivo(a: ActivoAlta): Promise<number> {
  const p = normalizarActivoNuevo(a, hoyCordoba())
  const data = await llamar('alta_activo', { p }, 'dar de alta el activo')
  return leerId(data, 'dar de alta el activo')
}

/** Cambia solo los campos presentes. `ratio` agrega o corrige un ratio con su vigencia. */
export async function actualizarActivo(id: number, cambios: CambiosActivo): Promise<void> {
  const activoId = idPositivo(id, 'el activo')
  const p = normalizarCambiosActivo(cambios)
  if (Object.keys(p).length === 0) return
  await llamar('editar_activo', { p_id: activoId, p }, 'actualizar el activo')
}

export async function crearBien(b: BienAlta): Promise<number> {
  const fila = normalizarBien(b)
  const { data, error } = await supabase().from('bienes').insert(fila).select('id').single()
  if (error) throw traducirErrorBase(error, 'dar de alta el bien')
  return leerId(data?.id, 'dar de alta el bien')
}

export async function crearPasivo(p: PasivoAlta): Promise<number> {
  const fila = normalizarPasivo(p)
  // Los montos van como texto (D-32); los tipos generados los declaran number.
  const { data, error } = await supabase()
    .from('pasivos')
    .insert(fila as unknown as Database['public']['Tables']['pasivos']['Insert'])
    .select('id')
    .single()
  if (error) throw traducirErrorBase(error, 'dar de alta el pasivo')
  return leerId(data?.id, 'dar de alta el pasivo')
}

/** Graba (o corrige, si ya hay una ese día) la valuación de un bien. Devuelve el id de la carga. */
export async function guardarValuacionBien(v: { bien_id: number; fecha: Fecha; valor: string; fuente: string }): Promise<number> {
  const p = altaManual({ bienes_valuaciones: [normalizarValuacion(v)] }, v.fecha)
  const data = await llamar('guardar_manual', { p }, 'guardar la valuación', { reintentable: true })
  return leerId(data, 'guardar la valuación')
}

/** Graba (o corrige) el capital pendiente informado de un pasivo. Devuelve el id de la carga. */
export async function guardarPasivoSaldo(s: { pasivo_id: number; fecha: Fecha; capital_pendiente: string }): Promise<number> {
  const p = altaManual({ pasivo_saldos: [normalizarPasivoSaldo(s)] }, s.fecha)
  const data = await llamar('guardar_manual', { p }, 'guardar el capital pendiente', { reintentable: true })
  return leerId(data, 'guardar el capital pendiente')
}

export const BUCKET_CARGAS = 'cargas'

/**
 * Sube un archivo de carga al bucket privado, nombrado por su sha256
 * ("AAAA/MM/<sha256>.<ext>", mes de hoy en Córdoba). Si ya está, lo reusa:
 * mismo nombre, mismo contenido.
 */
export async function subirArchivo(bytes: Uint8Array, tipo: string, nombre: string): Promise<{ path: string; sha256: string }> {
  if (!(bytes instanceof Uint8Array)) throw new ErrorEscritura('El archivo no llegó como bytes.')
  if (bytes.byteLength === 0) throw new ErrorEscritura('El archivo está vacío.')
  const sha256 = sha256Hex(bytes)
  const ext = extensionArchivo(tipo, nombre)
  const path = rutaArchivo(sha256, ext, hoyCordoba())
  let error: unknown
  try {
    ;({ error } = await supabase()
      .storage.from(BUCKET_CARGAS)
      .upload(path, bytes, { contentType: tipoContenido(tipo, ext), upsert: false }))
  } catch (e) {
    error = e
  }
  if (error && !esDuplicado(error)) {
    const detalle = error instanceof Error ? error.message : String(error)
    throw new ErrorEscritura(`No se pudo guardar el archivo: ${detalle}`, { causa: error })
  }
  return { path, sha256 }
}

// ───────────── Errores ─────────────

/** Error con un mensaje en español que la pantalla puede mostrar tal cual. */
export class ErrorEscritura extends Error {
  /** SQLSTATE o código de PostgREST, si vino de la base. */
  readonly codigo: string | null

  constructor(mensaje: string, opciones: { codigo?: string | null; causa?: unknown } = {}) {
    super(mensaje, opciones.causa === undefined ? undefined : { cause: opciones.causa })
    this.name = 'ErrorEscritura'
    this.codigo = opciones.codigo ?? null
  }
}

/** Lo que devuelve PostgREST (PostgrestError) o cualquier error con esa forma. */
export interface ErrorBase {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

const FORMA_OPERACION: Record<TipoOperacion, string> = {
  apertura: 'Una apertura lleva cantidad mayor que cero y no lleva importe',
  compra: 'Una compra lleva cantidad mayor que cero',
  venta: 'Una venta lleva cantidad mayor que cero y su precio o su importe',
  vencimiento: 'Un vencimiento lleva cantidad mayor que cero y el importe cobrado, sin precio',
  renta: 'Una renta lleva cantidad 0 y el importe cobrado, sin precio',
  amortizacion: 'Una amortización lleva cantidad 0 y el importe cobrado, sin precio',
  ajuste_ratio: 'Un ajuste de ratio lleva una cantidad distinta de cero, sin precio ni importe',
}

/** Qué quiere decir cada restricción del schema, para quien carga. */
const RESTRICCIONES: Record<string, string> = {
  // cargas
  cargas_check: 'Una carga manual no lleva archivo, y una de Excel o de captura sí',
  cargas_check1: 'Una carga revertida necesita la fecha de reversión',
  cargas_archivo_sha256: 'El archivo de la carga necesita su sha256, y la ruta tiene que contenerlo',
  cargas_archivo_sha256_check: 'El sha256 del archivo tiene que tener 64 caracteres hexadecimales en minúscula',
  cargas_motivo_reversion: 'Una carga revertida necesita el motivo de la reversión',
  cargas_tiempo_activo_ms_check: 'El tiempo activo no puede ser negativo',
  cargas_lector_check: 'El lector de la carga no puede estar vacío',
  cargas_origen_check: 'El origen de la carga tiene que ser excel, captura o manual',
  cargas_estado_check: 'El estado de la carga no es válido',
  cargas_cuenta_id_fkey: 'La cuenta de la carga no existe',
  // tipo de cambio
  tipo_cambio_ccl_check: 'El CCL tiene que ser mayor que cero',
  tipo_cambio_mep_check: 'El MEP tiene que ser mayor que cero',
  tipo_cambio_cripto_venta_check: 'El dólar cripto tiene que ser mayor que cero',
  tipo_cambio_oficial_check: 'El dólar oficial tiene que ser mayor que cero',
  // cotizaciones y saldos
  cotizaciones_precio_pesos_check: 'El precio en pesos tiene que ser mayor que cero',
  cotizaciones_precio_usd_subyacente_check: 'El precio del subyacente en USD tiene que ser mayor que cero',
  cotizaciones_activo_id_fkey: 'El activo no está en el catálogo: dalo de alta antes de grabar su precio',
  saldos_liquidez_moneda_check: 'La moneda de un saldo tiene que ser ARS o USD',
  saldos_liquidez_monto_check: 'El saldo tiene que ser un número finito',
  saldos_liquidez_cuenta_id_fkey: 'La cuenta del saldo no existe',
  // operaciones
  operaciones_ccl: 'Falta el CCL del día: solo una apertura puede no tenerlo',
  operaciones_fecha_origen:
    'La fecha de origen va solo en una apertura, no puede ser posterior a la carga, y una apertura con CCL la necesita',
  operaciones_tipo_check: 'El tipo de operación no es válido',
  operaciones_moneda_check: 'La moneda de una operación tiene que ser ARS o USD',
  operaciones_cantidad_check: 'La cantidad tiene que ser un número finito',
  operaciones_precio_check: 'El precio tiene que ser mayor que cero',
  operaciones_importe_check: 'El importe tiene que ser mayor que cero',
  operaciones_comisiones_check: 'Las comisiones no pueden ser negativas',
  operaciones_ccl_del_dia_check: 'El CCL del día tiene que ser mayor que cero',
  operaciones_activo_id_fkey: 'El activo no está en el catálogo: dalo de alta antes de grabar la operación',
  operaciones_cuenta_id_fkey: 'La cuenta de la operación no existe',
  operaciones_una_apertura: 'Ya existe una apertura de ese activo en esa cuenta: la tenencia inicial se carga una sola vez',
  // eventos
  eventos_tipo_check: 'El tipo de evento no es válido',
  eventos_nota: 'La nota del día necesita texto y su carga',
  // activos
  activos_ticker_key: 'Ya existe un activo con ese ticker',
  activos_check: 'Un CEDEAR necesita el ticker de su subyacente',
  activos_check1: 'Un bono o una LECAP necesita su indexación, y los demás tipos no la llevan',
  activos_color_check: 'El color tiene que tener la forma #RRGGBB',
  activos_tipo_check: 'El tipo de activo no es válido',
  activos_moneda_riesgo_check: 'La moneda de riesgo tiene que ser ARS o USD',
  activos_geografia_check: 'La geografía tiene que ser AR, US, BR o GLOBAL',
  activos_indexacion_check: 'La indexación no es válida',
  ratios_cedear_ratio_check: 'El ratio tiene que ser mayor que cero',
  ratios_cedear_activo_id_fkey: 'El activo del ratio no existe',
  // bienes
  bienes_nombre_key: 'Ya existe un bien con ese nombre',
  bienes_pasivo_id_key: 'Ese pasivo ya está vinculado a otro bien',
  bienes_pasivo_id_fkey: 'El pasivo vinculado no existe',
  bienes_tipo_check: 'El tipo de bien tiene que ser inmueble, vehículo u otro',
  bienes_moneda_valuacion_check: 'La moneda de valuación tiene que ser ARS o USD',
  bienes_geografia_check: 'La geografía tiene que ser AR, US, BR o GLOBAL',
  bienes_valuaciones_valor_check: 'El valor de la valuación tiene que ser mayor que cero',
  bienes_valuaciones_bien_id_fkey: 'El bien no existe',
  // pasivos
  pasivos_nombre_key: 'Ya existe un pasivo con ese nombre',
  pasivos_tipo_check: 'El tipo de pasivo tiene que ser leasing, tarjeta o préstamo',
  pasivos_moneda_check: 'La moneda del pasivo tiene que ser ARS o USD',
  pasivos_cuotas_totales_check: 'Las cuotas totales tienen que ser más que cero',
  pasivos_monto_financiado_neto_check: 'El monto financiado tiene que ser mayor que cero',
  pasivos_anticipo_neto_check: 'El anticipo no puede ser negativo',
  pasivos_opcion_compra_neto_check: 'La opción de compra no puede ser negativa',
  pasivos_valor_bien_check: 'El valor del bien tiene que ser mayor que cero',
  pasivos_alicuota_ganancias_check: 'La alícuota de Ganancias tiene que estar entre 0 y 1',
  pasivo_saldos_capital_pendiente_check: 'El capital pendiente no puede ser negativo',
  pasivo_saldos_pasivo_id_fkey: 'El pasivo no existe',
  // movimientos de capital
  movimientos_capital_check: 'La fecha de acreditación no puede ser anterior a la del movimiento',
  movimientos_capital_check1: 'La moneda y el monto de origen van juntos',
  movimientos_capital_check2: 'La moneda y el monto de destino van juntos',
  movimientos_capital_check3:
    'El movimiento no tiene la forma de su tipo: un aporte entra a una cuenta, un retiro sale de una, y una transferencia une dos cuentas distintas, con los dos montos',
  movimientos_capital_tipo_check: 'El tipo de movimiento tiene que ser aporte, retiro o transferencia',
  movimientos_capital_moneda_origen_check: 'La moneda de origen tiene que ser ARS o USD',
  movimientos_capital_moneda_destino_check: 'La moneda de destino tiene que ser ARS o USD',
  movimientos_capital_monto_origen_check: 'El monto de origen tiene que ser mayor que cero',
  movimientos_capital_monto_destino_check: 'El monto de destino tiene que ser mayor que cero',
  movimientos_capital_tc_aplicado_check: 'El tipo de cambio aplicado tiene que ser mayor que cero',
  movimientos_capital_impuesto_check: 'El impuesto no puede ser negativo',
  movimientos_capital_cuenta_origen_id_fkey: 'La cuenta de origen no existe',
  movimientos_capital_cuenta_destino_id_fkey: 'La cuenta de destino no existe',
}

/** Nombre legible de una columna, para "Falta …". */
const CAMPOS: Record<string, string> = {
  fecha: 'la fecha',
  cuenta_id: 'la cuenta',
  origen: 'el origen de la carga',
  activo_id: 'el activo',
  tipo: 'el tipo',
  cantidad: 'la cantidad',
  moneda: 'la moneda',
  precio_pesos: 'el precio en pesos',
  monto: 'el monto',
  ticker: 'el ticker',
  nombre: 'el nombre',
  moneda_riesgo: 'la moneda de riesgo',
  geografia: 'la geografía',
  fuente: 'la fuente de la valuación',
  valor: 'el valor',
  capital_pendiente: 'el capital pendiente',
  bien_id: 'el bien',
  pasivo_id: 'el pasivo',
  moneda_valuacion: 'la moneda de valuación',
  fecha_inicio: 'la fecha de inicio',
  cuotas_totales: 'las cuotas totales',
  titulo: 'el texto',
  ratio: 'el ratio',
  vigente_desde: 'la fecha de vigencia',
  activo_bool: 'si el activo está activo',
  listado_completo: 'si el listado es completo',
  carga_id: 'la carga',
}

/** Contexto que agregan las funciones de la base ("IEB · venta de AL30"); no el detalle crudo de Postgres. */
function contexto(e: ErrorBase): string | null {
  const d = e.details?.trim()
  if (!d) return null
  if (/^(Failing row contains|Key \(|Key is not present|Results contain|Could not|Searched for)/i.test(d)) return null
  if (d.includes('\n') || d.length > 200) return null
  return d
}

function restriccion(mensaje: string): string | null {
  return /constraint "([^"]+)"/.exec(mensaje)?.[1] ?? null
}

/** Traduce un error de la base a un mensaje que dice qué corregir. */
export function traducirErrorBase(e: ErrorBase, accion: string): ErrorEscritura {
  const code = e.code ?? ''
  const msg = (e.message ?? '').trim()
  const ctx = contexto(e)
  const con = (base: string) => new ErrorEscritura(cerrar(base, ctx), { codigo: code || null, causa: e })

  // Sin respuesta: la red, un timeout o la base caída.
  if (esErrorDeRed(e)) {
    return new ErrorEscritura(`No se pudo conectar con la base para ${accion}. Revisá la conexión y probá de nuevo.`, {
      codigo: null,
      causa: e,
    })
  }
  if (code === 'PGRST202') {
    const fn = /function ([\w.]+)\(/.exec(msg)?.[1] ?? 'de escritura'
    return new ErrorEscritura(
      `La base no tiene la función ${fn}: falta aplicar la migración 20261008120000_carga_transaccional.`,
      { codigo: code, causa: e },
    )
  }
  if (code.startsWith('PGRST3')) {
    return new ErrorEscritura('La clave del servidor para la base no es válida (SUPABASE_SECRET_KEY).', { codigo: code, causa: e })
  }
  // Mensajes propios de las funciones de la base: ya están en español.
  if (code === 'P0001') return con(msg)

  const nombre = restriccion(msg)
  switch (code) {
    case '23505': {
      const conocido = nombre ? RESTRICCIONES[nombre] : undefined
      const clave = /Key \(([^)]+)\)=\(([^)]*)\)/.exec(e.details ?? '')
      if (conocido) return con(clave ? `${conocido}: ${clave[2]}` : conocido)
      return con(clave ? `Ya existe un registro con ${clave[1]} = ${clave[2]}` : 'Ya existe un registro igual')
    }
    case '23514': {
      if (nombre === 'operaciones_forma') {
        const tipo = /· (apertura|compra|venta|vencimiento|renta|amortizacion|ajuste_ratio) de /.exec(ctx ?? '')?.[1] as
          | TipoOperacion
          | undefined
        return con(
          tipo
            ? `La operación no tiene la forma de su tipo. ${FORMA_OPERACION[tipo]}`
            : 'La operación no tiene la forma de su tipo: revisá cantidad, precio e importe',
        )
      }
      if (nombre && RESTRICCIONES[nombre]) return con(RESTRICCIONES[nombre])
      const col = columnaDeCheck(nombre, msg)
      return con(col ? `El valor ${de(CAMPOS[col] ?? col)} no es válido` : `Un dato no cumple una regla de la base${nombre ? ` (${nombre})` : ''}`)
    }
    case '23502': {
      const col = /column "([^"]+)"/.exec(msg)?.[1]
      return con(`Falta ${col ? (CAMPOS[col] ?? col) : 'un dato obligatorio'}`)
    }
    case '23503': {
      if (nombre && RESTRICCIONES[nombre]) return con(RESTRICCIONES[nombre])
      if (/still referenced/i.test(e.details ?? '') || /update or delete/i.test(msg)) {
        return con('No se puede borrar: hay otros datos que lo usan')
      }
      return con('El dato apunta a algo que no existe')
    }
    case '21000':
      return con('Un mismo dato aparece dos veces en lo que se graba')
    case '22P02':
    case '22007':
    case '22008':
      return con(`Un dato tiene un formato inválido: ${msg}`)
    case '22003':
      return con('Un número está fuera de rango')
    case '42501':
      return new ErrorEscritura(`La base no le da permiso al servidor para ${accion} (falta un grant a service_role).`, {
        codigo: code,
        causa: e,
      })
    case '57014':
      return new ErrorEscritura(`La base tardó demasiado en ${accion}. Probá de nuevo.`, { codigo: code, causa: e })
    case '40001':
    case '40P01':
    case '55P03':
      return new ErrorEscritura(`La base estaba ocupada y no pudo ${accion}. Probá de nuevo.`, { codigo: code, causa: e })
  }
  return new ErrorEscritura(`No se pudo ${accion}${msg ? `: ${msg}` : ''}.`.replace(/\.\.$/, '.'), { codigo: code || null, causa: e })
}

/** Mensaje final: la base, el contexto entre paréntesis si lo hay, y un punto. */
function cerrar(base: string, ctx: string | null): string {
  const b = base.trim()
  if (!ctx) return /[.!?]$/.test(b) ? b : `${b}.`
  return `${b.replace(/\.$/, '')} (${ctx}).`
}

/** Columna de un check con nombre automático: "<tabla>_<columna>_check". */
function columnaDeCheck(nombre: string | null, mensaje: string): string | null {
  if (!nombre?.endsWith('_check')) return null
  const tabla = /relation "([^"]+)"/.exec(mensaje)?.[1]
  if (!tabla || !nombre.startsWith(`${tabla}_`)) return null
  const col = nombre.slice(tabla.length + 1, -'_check'.length)
  return /^[a-z_]+$/.test(col) ? col : null
}

function esErrorDeRed(e: ErrorBase): boolean {
  return (e.code ?? '') === '' && /^(TypeError|FetchError|AbortError|Error): /i.test((e.message ?? '').trim())
}

/** Storage avisa que el objeto ya existe (409 / Duplicate / ResourceAlreadyExists). */
export function esDuplicado(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as { status?: unknown; statusCode?: unknown; code?: unknown; error?: unknown; message?: unknown }
  return (
    o.status === 409 ||
    o.statusCode === '409' ||
    o.statusCode === 409 ||
    o.code === 'ResourceAlreadyExists' ||
    o.code === 'Duplicate' ||
    o.error === 'Duplicate' ||
    (typeof o.message === 'string' && /already exists|duplicate/i.test(o.message))
  )
}

// ───────────── Llamadas a la base ─────────────

type RespuestaRpc = { data: unknown; error: ErrorBase | null }
type ClienteRpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<RespuestaRpc> }

/**
 * Llama a una función de la base. Las idempotentes (por lote) se reintentan una
 * vez si no hubo respuesta: si la primera llegó a grabar, la segunda la encuentra.
 */
async function llamar(
  fn: string,
  args: Record<string, unknown>,
  accion: string,
  opciones: { reintentable?: boolean } = {},
): Promise<unknown> {
  // Hasta regenerar los tipos, las funciones nuevas no figuran en Database['public']['Functions'].
  const db = supabase() as unknown as ClienteRpc
  const intentos = opciones.reintentable ? 2 : 1
  let ultimo: ErrorBase | null = null
  for (let i = 0; i < intentos; i++) {
    let res: RespuestaRpc
    try {
      res = await db.rpc(fn, args)
    } catch (e) {
      res = { data: null, error: { code: '', message: `Error: ${e instanceof Error ? e.message : String(e)}` } }
    }
    if (!res.error) return res.data
    ultimo = res.error
    if (!esErrorDeRed(res.error)) break
  }
  throw traducirErrorBase(ultimo ?? {}, accion)
}

// ───────────── Respuestas ─────────────

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function respuestaInesperada(accion: string, que: string): ErrorEscritura {
  return new ErrorEscritura(`La base respondió algo inesperado al ${accion} (${que}). No se sabe si se grabó: revisá el Registro.`)
}

function enteroPositivo(v: unknown): number | null {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0) return v
  if (typeof v === 'string' && /^[1-9]\d{0,15}$/.test(v) && Number.isSafeInteger(Number(v))) return Number(v)
  return null
}

function enteroNoNegativo(v: unknown): number | null {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return v
  return null
}

/** Valida la respuesta de confirmar_carga contra ResultadoConfirmacion. */
export function leerResultadoConfirmacion(data: unknown, loteEnviado: string): ResultadoConfirmacion {
  const accion = 'confirmar la carga'
  if (!esObjeto(data)) throw respuestaInesperada(accion, 'no es un objeto')
  if (typeof data.lote !== 'string' || data.lote.toLowerCase() !== loteEnviado.toLowerCase()) {
    throw respuestaInesperada(accion, 'otro lote')
  }
  if (typeof data.repetido !== 'boolean') throw respuestaInesperada(accion, 'sin "repetido"')
  if (!Array.isArray(data.cargas) || data.cargas.length === 0) throw respuestaInesperada(accion, 'sin cargas')
  const cargas = data.cargas.map((c) => {
    if (!esObjeto(c)) throw respuestaInesperada(accion, 'carga sin forma')
    const carga_id = enteroPositivo(c.carga_id)
    if (carga_id === null) throw respuestaInesperada(accion, 'carga sin id')
    let cuenta_id: number | null = null
    if (c.cuenta_id !== null) {
      cuenta_id = enteroPositivo(c.cuenta_id)
      if (cuenta_id === null) throw respuestaInesperada(accion, 'cuenta sin id')
    }
    return { carga_id, cuenta_id }
  })
  return { lote: loteEnviado, cargas, repetido: data.repetido }
}

/** Valida la respuesta de revertir_lote. */
export function leerResumenReversion(data: unknown, loteEnviado: string): ResumenReversion {
  const accion = 'revertir el lote'
  if (!esObjeto(data)) throw respuestaInesperada(accion, 'no es un objeto')
  if (typeof data.lote !== 'string' || data.lote.toLowerCase() !== loteEnviado.toLowerCase()) {
    throw respuestaInesperada(accion, 'otro lote')
  }
  if (!Array.isArray(data.cargas) || data.cargas.length === 0) throw respuestaInesperada(accion, 'sin cargas')
  const cargas = data.cargas.map((c) => {
    const id = enteroPositivo(c)
    if (id === null) throw respuestaInesperada(accion, 'carga sin id')
    return id
  })
  const borradas = enteroNoNegativo(data.borradas)
  const restauradas = enteroNoNegativo(data.restauradas)
  if (borradas === null || restauradas === null) throw respuestaInesperada(accion, 'sin conteos')
  return { lote: loteEnviado, cargas, borradas, restauradas }
}

/** Un id que devolvió la base (identity: número entero positivo). */
export function leerId(data: unknown, accion: string): number {
  const id = enteroPositivo(data)
  if (id === null) throw respuestaInesperada(accion, 'sin id')
  return id
}

// ───────────── Validación de la entrada ─────────────

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/
/** Texto decimal: el mismo que acepta leer_monto() en la base. Sin exponente, sin 0x, sin formato es-AR. */
const RE_DECIMAL = /^-?\d+(\.\d+)?$/
const RE_SHA256 = /^[0-9a-f]{64}$/
const RE_COLOR = /^#[0-9a-fA-F]{6}$/

const TIPOS_ACTIVO: readonly TipoActivo[] = ['cedear', 'accion_local', 'bono', 'lecap', 'fci']
const MONEDAS: readonly Moneda[] = ['ARS', 'USD']
const GEOGRAFIAS: readonly Geografia[] = ['AR', 'US', 'BR', 'GLOBAL']
const INDEXACIONES: readonly Indexacion[] = ['fija', 'cer', 'tamar', 'dual_cer_tamar', 'dolar_linked', 'hard_dollar']
const TIPOS_OPERACION: readonly TipoOperacion[] = [
  'apertura',
  'compra',
  'venta',
  'vencimiento',
  'renta',
  'amortizacion',
  'ajuste_ratio',
]
const ORIGENES: readonly CuentaAGrabar['origen'][] = ['excel', 'captura', 'manual']

function mayus(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "de" + campo, con la contracción: "del CCL", "de la fecha". */
function de(campo: string): string {
  return campo.startsWith('el ') ? `del ${campo.slice(3)}` : `de ${campo}`
}

function elegir<T extends string>(v: unknown, opciones: readonly T[], campo: string): T {
  if (typeof v === 'string' && (opciones as readonly string[]).includes(v)) return v as T
  throw new ErrorEscritura(
    `Valor inválido para ${campo}: ${v === undefined || v === null ? 'falta' : JSON.stringify(v)} (opciones: ${opciones.join(', ')}).`,
  )
}

export type ReglaMonto = 'positivo' | 'no_negativo' | 'cualquiera'

/**
 * Monto de la entrada → texto para la base, validado con dec(). null, undefined
 * o vacío = sin dato (null). Rechaza números de JavaScript, NaN, Infinity,
 * exponentes, hexadecimales y el formato es-AR sin normalizar.
 */
export function montoParaBase(v: unknown, campo: string, regla: ReglaMonto = 'cualquiera'): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') {
    throw new ErrorEscritura(
      `El valor ${de(campo)} llegó como ${typeof v === 'number' ? 'número' : typeof v}: los montos viajan como texto (D-32).`,
    )
  }
  const t = v.trim()
  if (t === '') return null
  if (!RE_DECIMAL.test(t)) {
    throw new ErrorEscritura(`El valor ${de(campo)} no es un número decimal: "${v}" (se espera, por ejemplo, 1234.56).`)
  }
  let d
  try {
    d = dec(t)
  } catch {
    throw new ErrorEscritura(`El valor ${de(campo)} no es un número válido: "${v}".`)
  }
  if (d === null) return null
  if (regla === 'positivo' && !d.gt(0)) throw new ErrorEscritura(`El valor ${de(campo)} tiene que ser mayor que cero.`)
  if (regla === 'no_negativo' && d.lt(0)) throw new ErrorEscritura(`El valor ${de(campo)} no puede ser negativo.`)
  return t
}

export function montoRequerido(v: unknown, campo: string, regla: ReglaMonto = 'cualquiera'): string {
  const m = montoParaBase(v, campo, regla)
  if (m === null) throw new ErrorEscritura(`Falta ${campo}.`)
  return m
}

/** 'AAAA-MM-DD' que exista en el calendario. null, undefined o vacío = sin fecha. */
export function fechaOpcional(v: unknown, campo: string): Fecha | null {
  if (v === null || v === undefined || v === '') return null
  const m = typeof v === 'string' ? RE_FECHA.exec(v.trim()) : null
  if (!m) throw new ErrorEscritura(`Fecha inválida en ${campo}: ${JSON.stringify(v)} (se espera AAAA-MM-DD).`)
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(a, mes - 1, dia))
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    throw new ErrorEscritura(`Fecha inválida en ${campo}: ${m[0]} no existe en el calendario.`)
  }
  return m[0]
}

export function fechaRequerida(v: unknown, campo: string): Fecha {
  const f = fechaOpcional(v, campo)
  if (f === null) throw new ErrorEscritura(`Falta ${campo}.`)
  return f
}

export function idPositivo(v: unknown, campo: string): number {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0) return v
  throw new ErrorEscritura(
    v === null || v === undefined || v === 0
      ? `Falta ${campo}${v === 0 ? ' (¿falta darlo de alta en el catálogo?)' : ''}.`
      : `Identificador inválido para ${campo}: ${JSON.stringify(v)}.`,
  )
}

function textoOpcional(v: unknown, campo: string): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new ErrorEscritura(`Valor inválido para ${campo}: tiene que ser texto.`)
  const t = v.trim()
  return t === '' ? null : t
}

function textoRequerido(v: unknown, campo: string): string {
  const t = textoOpcional(v, campo)
  if (t === null) throw new ErrorEscritura(`Falta ${campo}.`)
  return t
}

export function loteValido(v: unknown): string {
  if (typeof v !== 'string' || !RE_UUID.test(v.trim())) {
    throw new ErrorEscritura(`El lote no es un identificador válido: ${JSON.stringify(v)}.`)
  }
  return v.trim().toLowerCase()
}

/** Tiempo activo en milisegundos: entero no negativo (se redondea). */
export function tiempoActivo(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new ErrorEscritura(`El tiempo activo tiene que ser un número de milisegundos no negativo: ${JSON.stringify(v)}.`)
  }
  const ms = Math.round(v)
  if (ms > 2_147_483_647) throw new ErrorEscritura('El tiempo activo es demasiado grande.')
  return ms
}

function normalizarCotizacion(q: CotizacionAGrabar, cuenta: string, i: number): CotizacionAGrabar & { precio_usd_subyacente?: string | null } {
  const campo = `la cotización ${i + 1} de ${cuenta}`
  if (!esObjeto(q)) throw new ErrorEscritura(`${mayus(campo)} no tiene forma de cotización.`)
  const activo_id = idPositivo(q.activo_id, `el activo de ${campo}`)
  const precio_pesos = montoRequerido(q.precio_pesos, `el precio en pesos de ${campo}`, 'positivo')
  const extra = (q as { precio_usd_subyacente?: unknown }).precio_usd_subyacente
  const precio_usd_subyacente = montoParaBase(extra, `el precio del subyacente de ${campo}`, 'positivo')
  return precio_usd_subyacente === null ? { activo_id, precio_pesos } : { activo_id, precio_pesos, precio_usd_subyacente }
}

function normalizarSaldo(s: SaldoAGrabar, cuenta: string, i: number): SaldoAGrabar {
  const campo = `el saldo ${i + 1} de ${cuenta}`
  if (!esObjeto(s)) throw new ErrorEscritura(`${mayus(campo)} no tiene forma de saldo.`)
  return {
    moneda: elegir(s.moneda, MONEDAS, `la moneda ${de(campo)}`),
    // Puede ser negativo: el Total de IEB a liquidar (D-13).
    monto: montoRequerido(s.monto, campo, 'cualquiera'),
  }
}

function normalizarOperacion(o: OperacionAGrabar, cuenta: string, i: number): OperacionAGrabar {
  const campo = `la operación ${i + 1} de ${cuenta}`
  if (!esObjeto(o)) throw new ErrorEscritura(`${mayus(campo)} no tiene forma de operación.`)
  return {
    activo_id: idPositivo(o.activo_id, `el activo de ${campo}`),
    tipo: elegir(o.tipo, TIPOS_OPERACION, `el tipo de ${campo}`),
    // El signo y el cero los valida la forma de cada tipo, en la base.
    cantidad: montoRequerido(o.cantidad, `la cantidad de ${campo}`, 'cualquiera'),
    moneda: o.moneda === null || o.moneda === undefined ? 'ARS' : elegir(o.moneda, MONEDAS, `la moneda de ${campo}`),
    precio: montoParaBase(o.precio, `el precio de ${campo}`, 'positivo'),
    importe: montoParaBase(o.importe, `el importe de ${campo}`, 'positivo'),
    comisiones: montoParaBase(o.comisiones, `las comisiones de ${campo}`, 'no_negativo') ?? '0',
    ccl_del_dia: montoParaBase(o.ccl_del_dia, `el CCL del día de ${campo}`, 'positivo'),
    fecha_origen: fechaOpcional(o.fecha_origen, `la fecha de origen de ${campo}`),
    notas: textoOpcional(o.notas, `las notas de ${campo}`),
  }
}

function normalizarCuenta(k: CuentaAGrabar, i: number): CuentaAGrabar {
  if (!esObjeto(k)) throw new ErrorEscritura(`La cuenta ${i + 1} de la carga no tiene forma de cuenta.`)
  const cuenta_id = idPositivo(k.cuenta_id, `la cuenta ${i + 1} de la carga`)
  const nombre = `la cuenta #${cuenta_id}`
  const origen = elegir(k.origen, ORIGENES, `el origen de ${nombre}`)
  const archivo_path = textoOpcional(k.archivo_path, `el archivo de ${nombre}`)
  const sha = textoOpcional(k.archivo_sha256, `el sha256 de ${nombre}`)
  const archivo_sha256 = sha === null ? null : sha.toLowerCase()
  if (origen === 'manual' && archivo_path !== null) {
    throw new ErrorEscritura(`Una carga manual no lleva archivo (${nombre}).`)
  }
  if (origen !== 'manual' && archivo_path === null) {
    throw new ErrorEscritura(`Falta el archivo de ${nombre}: una carga de ${origen === 'excel' ? 'Excel' : 'captura'} guarda el original (D-11).`)
  }
  if ((archivo_path === null) !== (archivo_sha256 === null)) {
    throw new ErrorEscritura(`El archivo de ${nombre} necesita su sha256 (lo devuelve subirArchivo).`)
  }
  if (archivo_sha256 !== null && !RE_SHA256.test(archivo_sha256)) {
    throw new ErrorEscritura(`El sha256 del archivo de ${nombre} no es válido.`)
  }
  if (archivo_path !== null && archivo_sha256 !== null && !archivo_path.includes(archivo_sha256)) {
    throw new ErrorEscritura(`La ruta del archivo de ${nombre} no corresponde a su sha256.`)
  }
  if (k.listado_completo !== undefined && typeof k.listado_completo !== 'boolean') {
    throw new ErrorEscritura(`"Listado completo" de ${nombre} tiene que ser sí o no.`)
  }
  const lista = <T>(xs: T[] | null | undefined, que: string): T[] => {
    if (xs === null || xs === undefined) return []
    if (!Array.isArray(xs)) throw new ErrorEscritura(`${mayus(que)} de ${nombre} tienen que ser una lista.`)
    return xs
  }
  const cotizaciones = lista(k.cotizaciones, 'las cotizaciones').map((q, j) => normalizarCotizacion(q, nombre, j))
  const repetida = primerRepetido(cotizaciones.map((q) => q.activo_id))
  if (repetida !== null) throw new ErrorEscritura(`El activo #${repetida} tiene dos cotizaciones en ${nombre}.`)
  const saldos = lista(k.saldos, 'los saldos').map((s, j) => normalizarSaldo(s, nombre, j))
  const monedaRepetida = primerRepetido(saldos.map((s) => s.moneda))
  if (monedaRepetida !== null) throw new ErrorEscritura(`${mayus(nombre)} tiene dos saldos en ${monedaRepetida}.`)
  const operaciones = lista(k.operaciones, 'las operaciones').map((o, j) => normalizarOperacion(o, nombre, j))
  return {
    cuenta_id,
    origen,
    archivo_path,
    archivo_sha256,
    lector: textoOpcional(k.lector, `el lector de ${nombre}`),
    lectura_cruda: k.lectura_cruda === undefined ? null : k.lectura_cruda,
    grabado: k.grabado === undefined ? null : k.grabado,
    listado_completo: k.listado_completo ?? true,
    cotizaciones,
    saldos,
    operaciones,
  }
}

function primerRepetido<T>(xs: readonly T[]): T | null {
  const vistos = new Set<T>()
  for (const x of xs) {
    if (vistos.has(x)) return x
    vistos.add(x)
  }
  return null
}

/**
 * Valida y normaliza una ConfirmacionCarga antes de mandarla: montos como texto
 * decimal con su signo, ids enteros, fechas reales, archivo con su sha256.
 * Un tipo de cambio sin ningún valor se manda como null (no pisa nada).
 */
export function normalizarConfirmacion(c: ConfirmacionCarga): ConfirmacionCarga {
  if (!esObjeto(c)) throw new ErrorEscritura('La confirmación llegó vacía.')
  const lote = loteValido(c.lote)
  const fecha = fechaRequerida(c.fecha, 'la fecha de la carga')
  let tipo_cambio: ConfirmacionCarga['tipo_cambio'] = null
  if (c.tipo_cambio !== null && c.tipo_cambio !== undefined) {
    if (!esObjeto(c.tipo_cambio)) throw new ErrorEscritura('El tipo de cambio llegó con otra forma.')
    const tc = {
      ccl: montoParaBase(c.tipo_cambio.ccl, 'el CCL', 'positivo'),
      cripto_venta: montoParaBase(c.tipo_cambio.cripto_venta, 'el dólar cripto', 'positivo'),
      mep: montoParaBase(c.tipo_cambio.mep, 'el MEP', 'positivo'),
      oficial: montoParaBase(c.tipo_cambio.oficial, 'el dólar oficial', 'positivo'),
    }
    if (Object.values(tc).some((v) => v !== null)) tipo_cambio = tc
  }
  if (c.cuentas !== null && c.cuentas !== undefined && !Array.isArray(c.cuentas)) {
    throw new ErrorEscritura('Las cuentas de la carga tienen que ser una lista.')
  }
  const cuentas = (c.cuentas ?? []).map((k, i) => normalizarCuenta(k, i))
  const cuentaRepetida = primerRepetido(cuentas.map((k) => k.cuenta_id))
  if (cuentaRepetida !== null) throw new ErrorEscritura(`La cuenta #${cuentaRepetida} aparece dos veces en la misma carga.`)
  if (tipo_cambio === null && cuentas.length === 0) {
    throw new ErrorEscritura('No hay nada para grabar: falta el tipo de cambio y no hay ninguna cuenta.')
  }
  return {
    lote,
    fecha,
    tipo_cambio,
    cuentas,
    tiempo_activo_ms: tiempoActivo(c.tiempo_activo_ms),
    nota: textoOpcional(c.nota, 'la nota del día'),
  }
}

function tickerValido(v: unknown, campo: string): string {
  const t = textoRequerido(v, campo).toUpperCase()
  if (/\s/.test(t) || t.length > 30) throw new ErrorEscritura(`Valor inválido para ${campo}: "${t}" (sin espacios, hasta 30 caracteres).`)
  return t
}

function colorValido(v: unknown): string | null {
  const c = textoOpcional(v, 'el color')
  if (c !== null && !RE_COLOR.test(c)) throw new ErrorEscritura(`El color tiene que tener la forma #RRGGBB: "${c}".`)
  return c
}

function indexacionValida(tipo: TipoActivo, v: unknown): Indexacion | null {
  const lleva = tipo === 'bono' || tipo === 'lecap'
  if (v === null || v === undefined || v === '') {
    if (lleva) throw new ErrorEscritura('Un bono o una LECAP necesita su indexación (fija, CER, TAMAR…).')
    return null
  }
  if (!lleva) throw new ErrorEscritura('Solo un bono o una LECAP lleva indexación.')
  return elegir(v, INDEXACIONES, 'la indexación')
}

/** Payload de alta_activo. `hoy` es la fecha de Córdoba desde la que rige el ratio. */
export function normalizarActivoNuevo(a: ActivoAlta, hoy: Fecha) {
  if (!esObjeto(a)) throw new ErrorEscritura('El activo llegó vacío.')
  const tipo = elegir(a.tipo, TIPOS_ACTIVO, 'el tipo de activo')
  const sub = textoOpcional(a.ticker_subyacente, 'el ticker del subyacente')
  const ticker_subyacente = sub === null ? null : tickerValido(sub, 'el ticker del subyacente')
  if (tipo === 'cedear' && ticker_subyacente === null) {
    throw new ErrorEscritura('Un CEDEAR necesita el ticker de su subyacente.')
  }
  const ratio = montoParaBase(a.ratio, 'el ratio', 'positivo')
  if (ratio !== null && tipo !== 'cedear') throw new ErrorEscritura('El ratio solo va en un CEDEAR.')
  return {
    ticker: tickerValido(a.ticker, 'el ticker'),
    nombre: textoRequerido(a.nombre, 'el nombre del activo'),
    tipo,
    moneda_riesgo: elegir(a.moneda_riesgo, MONEDAS, 'la moneda de riesgo'),
    geografia: elegir(a.geografia, GEOGRAFIAS, 'la geografía'),
    indexacion: indexacionValida(tipo, a.indexacion),
    ticker_subyacente,
    fecha_vencimiento: fechaOpcional(a.fecha_vencimiento, 'la fecha de vencimiento'),
    color: colorValido(a.color),
    ratio,
    ratio_vigente_desde: fechaRequerida(hoy, 'la fecha de hoy'),
  }
}

/** Payload de editar_activo: solo las claves presentes (undefined = no cambia). */
export function normalizarCambiosActivo(cambios: CambiosActivo): Record<string, unknown> {
  if (!esObjeto(cambios)) throw new ErrorEscritura('Los cambios del activo llegaron vacíos.')
  const p: Record<string, unknown> = {}
  const hay = (k: keyof CambiosActivo) => Object.prototype.hasOwnProperty.call(cambios, k) && cambios[k] !== undefined
  if (hay('nombre')) p.nombre = textoRequerido(cambios.nombre, 'el nombre del activo')
  if (hay('tipo')) p.tipo = elegir(cambios.tipo, TIPOS_ACTIVO, 'el tipo de activo')
  if (hay('moneda_riesgo')) p.moneda_riesgo = elegir(cambios.moneda_riesgo, MONEDAS, 'la moneda de riesgo')
  if (hay('geografia')) p.geografia = elegir(cambios.geografia, GEOGRAFIAS, 'la geografía')
  if (hay('indexacion')) {
    p.indexacion = cambios.indexacion === null ? null : elegir(cambios.indexacion, INDEXACIONES, 'la indexación')
  }
  if (hay('ticker_subyacente')) {
    const t = textoOpcional(cambios.ticker_subyacente, 'el ticker del subyacente')
    p.ticker_subyacente = t === null ? null : tickerValido(t, 'el ticker del subyacente')
  }
  if (hay('fecha_vencimiento')) p.fecha_vencimiento = fechaOpcional(cambios.fecha_vencimiento, 'la fecha de vencimiento')
  if (hay('color')) p.color = colorValido(cambios.color)
  if (hay('activo_bool')) {
    if (typeof cambios.activo_bool !== 'boolean') throw new ErrorEscritura('"Activo" tiene que ser sí o no.')
    p.activo_bool = cambios.activo_bool
  }
  if (hay('ratio')) {
    const r = cambios.ratio
    if (!esObjeto(r)) throw new ErrorEscritura('El ratio llegó con otra forma.')
    p.ratio = {
      ratio: montoRequerido(r.ratio, 'el ratio', 'positivo'),
      vigente_desde: fechaRequerida(r.vigente_desde, 'la fecha desde la que rige el ratio'),
    }
  }
  return p
}

export function normalizarBien(b: BienAlta) {
  if (!esObjeto(b)) throw new ErrorEscritura('El bien llegó vacío.')
  return {
    nombre: textoRequerido(b.nombre, 'el nombre del bien'),
    tipo: elegir(b.tipo, ['inmueble', 'vehiculo', 'otro'] as const, 'el tipo de bien'),
    moneda_valuacion: elegir(b.moneda_valuacion, MONEDAS, 'la moneda de valuación'),
    geografia: b.geografia === undefined ? 'AR' : elegir(b.geografia, GEOGRAFIAS, 'la geografía'),
    pasivo_id: b.pasivo_id === null || b.pasivo_id === undefined ? null : idPositivo(b.pasivo_id, 'el pasivo vinculado'),
  }
}

export function normalizarPasivo(p: PasivoAlta) {
  if (!esObjeto(p)) throw new ErrorEscritura('El pasivo llegó vacío.')
  if (typeof p.cuotas_totales !== 'number' || !Number.isInteger(p.cuotas_totales) || p.cuotas_totales < 1 || p.cuotas_totales > 32767) {
    throw new ErrorEscritura(`Las cuotas totales tienen que ser un número entero mayor que cero: ${JSON.stringify(p.cuotas_totales)}.`)
  }
  return {
    nombre: textoRequerido(p.nombre, 'el nombre del pasivo'),
    tipo: elegir(p.tipo, ['leasing', 'tarjeta', 'prestamo'] as const, 'el tipo de pasivo'),
    moneda: elegir(p.moneda, MONEDAS, 'la moneda del pasivo'),
    fecha_inicio: fechaRequerida(p.fecha_inicio, 'la fecha de inicio'),
    cuotas_totales: p.cuotas_totales,
    monto_financiado_neto: montoParaBase(p.monto_financiado_neto, 'el monto financiado', 'positivo'),
    anticipo_neto: montoParaBase(p.anticipo_neto, 'el anticipo', 'no_negativo'),
    opcion_compra_neto: montoParaBase(p.opcion_compra_neto, 'la opción de compra', 'no_negativo'),
    opcion_compra_fecha: fechaOpcional(p.opcion_compra_fecha, 'la fecha de la opción de compra'),
    valor_bien: montoParaBase(p.valor_bien, 'el valor del bien', 'positivo'),
    notas: textoOpcional(p.notas, 'las notas'),
  }
}

export function normalizarValuacion(v: { bien_id: number; fecha: Fecha; valor: string; fuente: string }) {
  if (!esObjeto(v)) throw new ErrorEscritura('La valuación llegó vacía.')
  return {
    bien_id: idPositivo(v.bien_id, 'el bien'),
    fecha: fechaRequerida(v.fecha, 'la fecha de la valuación'),
    valor: montoRequerido(v.valor, 'el valor de la valuación', 'positivo'),
    fuente: textoRequerido(v.fuente, 'la fuente de la valuación'),
  }
}

export function normalizarPasivoSaldo(s: { pasivo_id: number; fecha: Fecha; capital_pendiente: string }) {
  if (!esObjeto(s)) throw new ErrorEscritura('El capital pendiente llegó vacío.')
  return {
    pasivo_id: idPositivo(s.pasivo_id, 'el pasivo'),
    fecha: fechaRequerida(s.fecha, 'la fecha del capital pendiente'),
    capital_pendiente: montoRequerido(s.capital_pendiente, 'el capital pendiente', 'no_negativo'),
  }
}

/** Payload de guardar_manual, con un lote nuevo. */
function altaManual(hechos: Record<string, unknown[]>, fecha: Fecha): Record<string, unknown> {
  return { lote: randomUUID(), fecha: fechaRequerida(fecha, 'la fecha'), ...hechos }
}

// ───────────── Archivos ─────────────

const EXTENSION_POR_TIPO: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-excel.sheet.macroenabled.12': 'xlsm',
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'application/json': 'json',
}

const TIPO_POR_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSION_POR_TIPO)
    .filter(([t]) => t !== 'image/jpg')
    .map(([t, e]) => [e, t]),
)

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Extensión del archivo: por su tipo MIME; si no se conoce, por el nombre; si no, "bin". */
export function extensionArchivo(tipo: string, nombre: string): string {
  const mime = (tipo ?? '').split(';')[0].trim().toLowerCase()
  if (EXTENSION_POR_TIPO[mime]) return EXTENSION_POR_TIPO[mime]
  const m = /\.([a-z0-9]{1,8})$/i.exec((nombre ?? '').trim())
  if (m) {
    const ext = m[1].toLowerCase()
    return ext === 'jpeg' ? 'jpg' : ext
  }
  return 'bin'
}

/** Content-Type para Storage: el recibido si es un MIME válido; si no, el de la extensión. */
export function tipoContenido(tipo: string, ext: string): string {
  const mime = (tipo ?? '').split(';')[0].trim().toLowerCase()
  if (/^[a-z]+\/[a-z0-9.+-]+$/.test(mime) && mime !== 'application/octet-stream') return mime
  return TIPO_POR_EXTENSION[ext] ?? 'application/octet-stream'
}

/** "AAAA/MM/<sha256>.<ext>", con el mes de `hoy` (fecha de Córdoba). */
export function rutaArchivo(sha256: string, ext: string, hoy: Fecha): string {
  if (!RE_SHA256.test(sha256)) throw new ErrorEscritura('El sha256 del archivo no es válido.')
  const f = fechaRequerida(hoy, 'la fecha de hoy')
  if (!/^[a-z0-9]{1,8}$/.test(ext)) throw new ErrorEscritura(`La extensión del archivo no es válida: "${ext}".`)
  return `${f.slice(0, 4)}/${f.slice(5, 7)}/${sha256}.${ext}`
}
