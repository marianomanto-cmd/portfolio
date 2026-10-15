import 'server-only'

// Escritura del cuadro de marcha y de los datos del contrato que suma la
// entrega 4 (migración 20261015124724_pasivos_cuadro_marcha). Mismo molde que
// escritura.ts, sin editarlo: cada monto se valida acá (texto decimal, D-32),
// las reglas de la base se dicen en castellano antes de mandar, y un error de
// la base se traduce primero con las restricciones nuevas y después con
// traducirErrorBase.
//
//   guardarCuadroMarcha  → guardar_cuadro_marcha(p): la planilla, una cuota o un cargo, con su lote
//   actualizarDatosPasivo → solo pagador_habitual, reintegra_iva y fecha_desembolso (editarPasivo no los conoce)
//   anularCargo           → pasivo_cargos.anulado_en (un cargo no se borra)

import type { FuenteCuota } from '@/lib/domain/pasivos/tipos'
import type { TablesUpdate } from '@/lib/database.types'
import type { Fecha } from '@/lib/domain/tipos'
import {
  ErrorEscritura,
  fechaOpcional,
  fechaRequerida,
  idPositivo,
  leerId,
  loteValido,
  montoParaBase,
  montoRequerido,
  traducirErrorBase,
  type ErrorBase,
} from './escritura'
import { supabase } from './supabase'

export const LECTORES = ['cuadro-marcha-csv@1', 'manual'] as const
const FUENTES = ['comprobante', 'contrato', 'a_confirmar', 'supuesto', 'no_aplica'] as const
const CONCEPTOS = ['multa', 'comision', 'reserva_fondos', 'interes', 'otro'] as const

/** Una cuota para grabar. Los datos del pago van solo si se dicen: la planilla no los trae y recargarla no los pisa. */
export interface CuotaAlta {
  nro: number
  fecha_vencimiento: Fecha
  periodo?: Fecha | null
  canon_neto: string
  iva_canon: string
  seguro: string
  otros_conceptos: string
  estado: 'facturada' | 'proyectada'
  fuente_canon: Exclude<FuenteCuota, 'no_aplica'>
  fuente_seguro: FuenteCuota
  fuente_otros: FuenteCuota
  pagada: boolean
  fecha_pago?: Fecha | null
  monto_pagado?: string | null
  cuenta_pago_id?: number | null
  ccl_del_dia_pago?: string | null
  ccl_fuente?: string | null
  pagador?: 'titular' | 'empresa' | null
  notas?: string | null
}

export interface CargoAlta {
  fecha: Fecha
  concepto: (typeof CONCEPTOS)[number]
  detalle?: string | null
  importe: string
  cuota_nro?: number | null
  fuente: Exclude<FuenteCuota, 'no_aplica'>
  notas?: string | null
}

export interface CuadroMarchaAlta {
  lote: string
  fecha: Fecha
  pasivo_id: number
  lector: (typeof LECTORES)[number]
  /** El CSV entero (va a la lectura cruda de la carga, D-141). Obligatorio con el lector del CSV. */
  archivo?: { nombre: string; sha256: string; texto: string } | null
  cuotas: CuotaAlta[]
  cargos?: CargoAlta[]
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function elegir<T extends string>(v: unknown, opciones: readonly T[], campo: string): T {
  if (typeof v === 'string' && (opciones as readonly string[]).includes(v)) return v as T
  throw new ErrorEscritura(`Valor inválido para ${campo}: ${v === undefined || v === null ? 'falta' : JSON.stringify(v)} (opciones: ${opciones.join(', ')}).`)
}

function texto(v: unknown, campo: string, max: number): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new ErrorEscritura(`Valor inválido para ${campo}: tiene que ser texto.`)
  const t = v.trim()
  if (t === '') return null
  if (t.length > max) throw new ErrorEscritura(`${campo[0].toUpperCase()}${campo.slice(1)} tiene más de ${max} caracteres.`)
  return t
}

/** Valida una cuota con las reglas de la base, dichas en castellano, y la deja lista para mandar. */
export function normalizarCuota(c: CuotaAlta): Record<string, unknown> {
  if (!esObjeto(c)) throw new ErrorEscritura('Una cuota llegó vacía.')
  if (typeof c.nro !== 'number' || !Number.isInteger(c.nro) || c.nro < 1 || c.nro > 32767) {
    throw new ErrorEscritura(`Número de cuota inválido: ${JSON.stringify(c.nro)}.`)
  }
  const de = `la cuota ${c.nro}`
  const periodo = fechaOpcional(c.periodo, `el mes del canon de ${de}`)
  if (periodo !== null && !periodo.endsWith('-01')) throw new ErrorEscritura(`El mes del canon de ${de} tiene que ser el día 1 del mes.`)
  const estado = elegir(c.estado, ['facturada', 'proyectada'] as const, `el estado de ${de}`)
  const fuente_canon = elegir(c.fuente_canon, ['comprobante', 'contrato', 'a_confirmar', 'supuesto'] as const, `la fuente del canon de ${de}`)
  const fuente_seguro = elegir(c.fuente_seguro, FUENTES, `la fuente del seguro de ${de}`)
  const fuente_otros = elegir(c.fuente_otros, FUENTES, `la fuente de la percepción de ${de}`)
  if (typeof c.pagada !== 'boolean') throw new ErrorEscritura(`Falta decir si ${de} está pagada.`)
  const seguro = montoRequerido(c.seguro, `el seguro de ${de}`, 'no_negativo')
  const otros = montoRequerido(c.otros_conceptos, `la percepción de ${de}`, 'no_negativo')
  if (estado === 'facturada' && (fuente_canon !== 'comprobante' || !['comprobante', 'no_aplica'].includes(fuente_seguro) || !['comprobante', 'no_aplica'].includes(fuente_otros))) {
    throw new ErrorEscritura(`Una cuota facturada tiene sus montos de comprobante (o n/a): revisá ${de}.`)
  }
  if (estado === 'proyectada' && [fuente_canon, fuente_seguro, fuente_otros].includes('comprobante')) {
    throw new ErrorEscritura(`Una cuota proyectada no puede tener fuente "comprobante": revisá ${de}.`)
  }
  if (c.pagada && estado !== 'facturada') throw new ErrorEscritura(`Una cuota pagada tiene factura: ${de} está proyectada.`)
  if (fuente_seguro === 'no_aplica' && Number(seguro) !== 0) throw new ErrorEscritura(`El seguro de ${de} dice n/a pero tiene monto.`)
  if (fuente_otros === 'no_aplica' && Number(otros) !== 0) throw new ErrorEscritura(`La percepción de ${de} dice n/a pero tiene monto.`)
  const out: Record<string, unknown> = {
    nro: c.nro,
    fecha_vencimiento: fechaRequerida(c.fecha_vencimiento, `el vencimiento de ${de}`),
    periodo,
    canon_neto: montoRequerido(c.canon_neto, `el canon de ${de}`, 'no_negativo'),
    iva_canon: montoRequerido(c.iva_canon, `el IVA de ${de}`, 'no_negativo'),
    seguro,
    otros_conceptos: otros,
    estado,
    fuente_canon,
    fuente_seguro,
    fuente_otros,
    pagada: c.pagada,
  }
  // Los datos del pago: solo si vienen (si no, la base deja los que había).
  if ('fecha_pago' in c) {
    const f = fechaOpcional(c.fecha_pago, `la fecha de pago de ${de}`)
    if (f !== null && !c.pagada) throw new ErrorEscritura(`Una fecha de pago va solo en una cuota pagada (${de}).`)
    out.fecha_pago = f
  }
  if ('monto_pagado' in c) out.monto_pagado = montoParaBase(c.monto_pagado, `el monto pagado de ${de}`, 'positivo')
  if ('cuenta_pago_id' in c) out.cuenta_pago_id = c.cuenta_pago_id === null || c.cuenta_pago_id === undefined ? null : idPositivo(c.cuenta_pago_id, `la cuenta del pago de ${de}`)
  if ('ccl_del_dia_pago' in c || 'ccl_fuente' in c) {
    const ccl = montoParaBase(c.ccl_del_dia_pago, `el CCL del pago de ${de}`, 'positivo')
    const fuente = texto(c.ccl_fuente, `de dónde salió el CCL de ${de}`, 200)
    if ((ccl === null) !== (fuente === null)) throw new ErrorEscritura(`El CCL del día del pago y de dónde salió van juntos: los dos o ninguno (${de}).`)
    out.ccl_del_dia_pago = ccl
    out.ccl_fuente = fuente
  }
  if (('monto_pagado' in c && out.monto_pagado !== null) || ('cuenta_pago_id' in c && out.cuenta_pago_id !== null) || ('ccl_del_dia_pago' in c && out.ccl_del_dia_pago !== null)) {
    if (!('fecha_pago' in c) || out.fecha_pago === null) {
      throw new ErrorEscritura(`El monto, la cuenta o el CCL del pago necesitan la fecha del pago (${de}).`)
    }
  }
  if ('pagador' in c) out.pagador = c.pagador === null || c.pagador === undefined ? null : elegir(c.pagador, ['titular', 'empresa'] as const, `quién pagó ${de}`)
  if ('notas' in c) out.notas = texto(c.notas, `las notas de ${de}`, 500)
  return out
}

export function normalizarCargo(k: CargoAlta, i: number): Record<string, unknown> {
  if (!esObjeto(k)) throw new ErrorEscritura(`El cargo ${i + 1} llegó vacío.`)
  const de = `el cargo ${i + 1}`
  return {
    fecha: fechaRequerida(k.fecha, `la fecha de ${de}`),
    concepto: elegir(k.concepto, CONCEPTOS, `el concepto de ${de}`),
    detalle: texto(k.detalle, `el detalle de ${de}`, 200),
    importe: montoRequerido(k.importe, `el importe de ${de}`, 'positivo'),
    cuota_nro: k.cuota_nro === null || k.cuota_nro === undefined ? null : idPositivo(k.cuota_nro, `la cuota de ${de}`),
    fuente: elegir(k.fuente, ['comprobante', 'contrato', 'a_confirmar', 'supuesto'] as const, `la fuente de ${de}`),
    notas: texto(k.notas, `las notas de ${de}`, 500),
  }
}

/** El payload de guardar_cuadro_marcha, validado. */
export function normalizarCuadroMarcha(c: CuadroMarchaAlta): Record<string, unknown> {
  if (!esObjeto(c)) throw new ErrorEscritura('El cuadro de marcha llegó vacío.')
  const lector = elegir(c.lector, LECTORES, 'el lector')
  const cuotas = Array.isArray(c.cuotas) ? c.cuotas.map(normalizarCuota) : []
  const cargos = Array.isArray(c.cargos) ? c.cargos.map(normalizarCargo) : []
  if (!cuotas.length && !cargos.length) throw new ErrorEscritura('No hay cuotas ni cargos para grabar.')
  const repetidas = cuotas.map((x) => x.nro).filter((nro, i, xs) => xs.indexOf(nro) !== i)
  if (repetidas.length) throw new ErrorEscritura(`La cuota ${repetidas[0]} aparece dos veces.`)
  let archivo: { nombre: string; sha256: string; texto: string } | null = null
  if (c.archivo) {
    if (!/^[0-9a-f]{64}$/.test(c.archivo.sha256 ?? '')) throw new ErrorEscritura('El sha256 del archivo no es válido.')
    if (typeof c.archivo.texto !== 'string' || c.archivo.texto.trim() === '') throw new ErrorEscritura('El archivo está vacío.')
    if (c.archivo.texto.length > 2_000_000) throw new ErrorEscritura('El archivo es demasiado grande para un cuadro de marcha.')
    archivo = { nombre: texto(c.archivo.nombre, 'el nombre del archivo', 200) ?? 'cuadro de marcha', sha256: c.archivo.sha256, texto: c.archivo.texto }
  } else if (lector === 'cuadro-marcha-csv@1') {
    throw new ErrorEscritura('Falta el archivo del cuadro de marcha.')
  }
  return {
    lote: loteValido(c.lote),
    fecha: fechaRequerida(c.fecha, 'la fecha de la carga'),
    pasivo_id: idPositivo(c.pasivo_id, 'el pasivo'),
    lector,
    ...(archivo ? { archivo } : {}),
    cuotas,
    cargos,
  }
}

// ───────────── Errores ─────────────

/** Las restricciones nuevas, en castellano. */
const RESTRICCIONES_PASIVOS: Record<string, string> = {
  pasivo_cuotas_estado_check: 'El estado de una cuota tiene que ser facturada o proyectada',
  pasivo_cuotas_periodo_check: 'El mes del canon tiene que ser el día 1 del mes',
  pasivo_cuotas_fuente_canon_check: 'La fuente del canon tiene que ser comprobante, contrato, a confirmar o supuesto',
  pasivo_cuotas_fuente_seguro_check: 'La fuente del seguro no es válida',
  pasivo_cuotas_fuente_otros_check: 'La fuente de la percepción no es válida',
  pasivo_cuotas_ccl_fuente_check: 'De dónde salió el CCL: entre 1 y 200 caracteres',
  pasivo_cuotas_pagador_check: 'Quién pagó tiene que ser vos (titular) o la empresa',
  pasivo_cuotas_notas_check: 'Las notas de la cuota: entre 1 y 500 caracteres',
  pasivo_cuotas_facturada_con_comprobante: 'Una cuota facturada tiene sus montos de comprobante (o n/a)',
  pasivo_cuotas_proyectada_sin_comprobante: 'Una cuota proyectada no puede tener fuente "comprobante"',
  pasivo_cuotas_pagada_facturada: 'Una cuota pagada tiene factura: no puede estar proyectada',
  pasivo_cuotas_fecha_pago_de_pagada: 'Una fecha de pago va solo en una cuota pagada',
  pasivo_cuotas_ccl_con_fuente: 'El CCL del día del pago y de dónde salió van juntos',
  pasivo_cuotas_no_aplica_sin_monto: 'Un monto n/a (no aplica) va en cero',
  pasivo_cuotas_check: 'El monto, la cuenta o el CCL del pago necesitan la fecha del pago',
  pasivo_cuotas_canon_neto_check: 'El canon no puede ser negativo',
  pasivo_cuotas_iva_canon_check: 'El IVA no puede ser negativo',
  pasivo_cuotas_seguro_check: 'El seguro no puede ser negativo',
  pasivo_cuotas_otros_conceptos_check: 'La percepción no puede ser negativa',
  pasivo_cuotas_monto_pagado_check: 'El monto pagado tiene que ser mayor que cero',
  pasivo_cuotas_ccl_del_dia_pago_check: 'El CCL del pago tiene que ser mayor que cero',
  pasivo_cuotas_cuenta_pago_id_fkey: 'La cuenta del pago no existe',
  pasivo_cuotas_nro_check: 'El número de cuota tiene que ser mayor que cero',
  pasivo_cuotas_pasivo_id_fkey: 'El pasivo no existe',
  pasivos_pagador_habitual_check: 'Quién paga la cuota tiene que ser vos (titular) o la empresa',
  pasivo_cargos_concepto_check: 'El concepto del cargo tiene que ser multa, comisión, reserva de fondos, interés u otro',
  pasivo_cargos_importe_check: 'El importe del cargo tiene que ser mayor que cero',
  pasivo_cargos_fuente_check: 'La fuente del cargo tiene que ser comprobante, contrato, a confirmar o supuesto',
  pasivo_cargos_detalle_check: 'El detalle del cargo: entre 1 y 200 caracteres',
  pasivo_cargos_cuota_nro_check: 'La cuota del cargo tiene que ser mayor que cero',
  pasivo_cargos_pasivo_id_fkey: 'El pasivo del cargo no existe',
}

/** Traduce un error de la base: primero las restricciones de Pasivos, después las de siempre. */
export function traducirErrorPasivos(e: ErrorBase, accion: string): ErrorEscritura {
  const nombre = /constraint "([^"]+)"/.exec(e.message ?? '')?.[1] ?? null
  if (nombre && RESTRICCIONES_PASIVOS[nombre] && (e.code === '23514' || e.code === '23503' || e.code === '23505')) {
    const ctx = e.details?.trim()
    const conCtx = ctx && !/^(Failing row contains|Key \()/i.test(ctx) && !ctx.includes('\n') && ctx.length <= 200
    return new ErrorEscritura(`${RESTRICCIONES_PASIVOS[nombre]}${conCtx ? ` (${ctx})` : ''}.`, { codigo: e.code ?? null, causa: e })
  }
  if (e.code === 'PGRST202') {
    return new ErrorEscritura('La base no tiene la función guardar_cuadro_marcha: falta aplicar la migración 20261015124724_pasivos_cuadro_marcha (supabase/migrations).', {
      codigo: e.code,
      causa: e,
    })
  }
  return traducirErrorBase(e, accion)
}

type RespuestaRpc = { data: unknown; error: ErrorBase | null }
type ClienteRpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<RespuestaRpc> }

const esDeRed = (e: ErrorBase) => (e.code ?? '') === '' && /^(TypeError|FetchError|AbortError|Error): /i.test((e.message ?? '').trim())

/** Llama a una función de la base; las idempotentes por lote se reintentan una vez si no hubo respuesta. */
async function llamar(fn: string, args: Record<string, unknown>, accion: string, reintentable: boolean): Promise<unknown> {
  // El nombre llega como texto: el rpc tipado de supabase-js pide el literal de cada función.
  const db = supabase() as unknown as ClienteRpc
  let ultimo: ErrorBase | null = null
  for (let i = 0; i < (reintentable ? 2 : 1); i++) {
    let r: RespuestaRpc
    try {
      r = await db.rpc(fn, args)
    } catch (e) {
      r = { data: null, error: { code: '', message: `Error: ${e instanceof Error ? e.message : String(e)}` } }
    }
    if (!r.error) return r.data
    ultimo = r.error
    if (!esDeRed(r.error)) break
  }
  throw traducirErrorPasivos(ultimo ?? {}, accion)
}

/** Graba el cuadro de marcha (o una cuota, o un cargo) con su lote. Devuelve el id de la carga. */
export async function guardarCuadroMarcha(c: CuadroMarchaAlta): Promise<number> {
  const p = normalizarCuadroMarcha(c)
  const data = await llamar('guardar_cuadro_marcha', { p }, 'guardar el cuadro de marcha', true)
  return leerId(data, 'guardar el cuadro de marcha')
}

export interface DatosPasivo {
  pagador_habitual?: 'titular' | 'empresa' | null
  reintegra_iva?: boolean | null
  fecha_desembolso?: Fecha | null
}

/** Normaliza solo lo que se cambia (las tres columnas nuevas del contrato). */
export function normalizarDatosPasivo(d: DatosPasivo): TablesUpdate<'pasivos'> {
  if (!esObjeto(d)) throw new ErrorEscritura('Los datos del contrato llegaron vacíos.')
  const out: TablesUpdate<'pasivos'> = {}
  if ('pagador_habitual' in d) out.pagador_habitual = d.pagador_habitual === null || d.pagador_habitual === undefined ? null : elegir(d.pagador_habitual, ['titular', 'empresa'] as const, 'quién paga la cuota')
  if ('reintegra_iva' in d) {
    if (d.reintegra_iva !== null && typeof d.reintegra_iva !== 'boolean') throw new ErrorEscritura('Si la empresa te reintegra el IVA es sí, no o sin declarar.')
    out.reintegra_iva = d.reintegra_iva ?? null
  }
  if ('fecha_desembolso' in d) out.fecha_desembolso = fechaOpcional(d.fecha_desembolso, 'la fecha de desembolso')
  if (!Object.keys(out).length) throw new ErrorEscritura('No hay nada para cambiar en el contrato.')
  return out
}

/** Cambia solo pagador_habitual, reintegra_iva y fecha_desembolso del contrato (la auditoría guarda el antes). */
export async function actualizarDatosPasivo(id: number, d: DatosPasivo): Promise<void> {
  const pasivoId = idPositivo(id, 'el pasivo')
  const fila = normalizarDatosPasivo(d)
  const { data, error } = await supabase()
    .from('pasivos')
    .update(fila)
    .eq('id', pasivoId)
    .select('id')
  if (error) throw traducirErrorPasivos(error, 'guardar los datos del contrato')
  if (!Array.isArray(data) || data.length !== 1) throw new ErrorEscritura(`No existe el pasivo #${pasivoId}.`)
}

/** Anula un cargo extra (queda auditado; no se borra). */
export async function anularCargo(id: number): Promise<void> {
  const cargoId = idPositivo(id, 'el cargo')
  const { data, error } = await supabase()
    .from('pasivo_cargos')
    .update({ anulado_en: new Date().toISOString() })
    .eq('id', cargoId)
    .is('anulado_en', null)
    .select('id')
  if (error) throw traducirErrorPasivos(error, 'anular el cargo')
  if (!Array.isArray(data) || data.length !== 1) throw new ErrorEscritura(`No hay un cargo #${cargoId} sin anular.`)
}
