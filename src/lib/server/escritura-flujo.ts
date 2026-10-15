import 'server-only'

// Escrituras de Flujo y escenarios (plan §6 D.4 y D.9). Mismo molde que
// escritura.ts: cada escritura de varias filas pasa por una función de la base
// (migraciones 20261015125017 a 20261015125140), con la entrada validada acá
// antes de mandarla y los errores en castellano.

import { randomUUID } from 'node:crypto'
import { controlCripto } from '@/lib/domain/flujo/control'
import { erroresDeRango, esquemaSupuestos } from '@/lib/domain/flujo/supuestos'
import type { Supuestos } from '@/lib/domain/flujo/tipos'
import type { Fecha, Moneda } from '@/lib/domain/tipos'
import {
  ErrorEscritura,
  fechaOpcional,
  fechaRequerida,
  idPositivo,
  leerId,
  loteValido,
  montoParaBase,
  montoRequerido,
  revertirLote,
  traducirErrorBase,
  type ErrorBase,
  type ResumenReversion,
} from './escritura'
import { supabase } from './supabase'

// ───────────── Errores propios de Flujo ─────────────

const RESTRICCIONES_FLUJO: Record<string, string> = {
  ingresos_fijos_naturaleza_check: 'La naturaleza del ingreso tiene que ser sueldo, honorarios, dividendo, retiro a cuenta u otro',
  ingresos_fijos_moneda_check: 'La moneda tiene que ser ARS o USD',
  ingresos_fijos_monto_check: 'El monto tiene que ser mayor que cero',
  ingresos_fijos_check: 'La fecha de fin no puede ser anterior a la de inicio',
  ingresos_fijos_notas_check: 'Las notas tienen que tener entre 1 y 500 caracteres',
  gastos_fijos_frecuencia_check: 'La frecuencia tiene que ser mensual, bimestral, trimestral, semestral o anual',
  gastos_fijos_frecuencia_con_mes: 'Un gasto que no es mensual necesita su primer mes',
  gastos_fijos_primer_mes_check: 'El primer mes tiene que ser un día 1',
  gastos_fijos_pagador_check: 'Quién paga tiene que ser vos o la empresa',
  gastos_fijos_moneda_check: 'La moneda tiene que ser ARS o USD',
  gastos_fijos_monto_check: 'El monto tiene que ser mayor que cero',
  gastos_fijos_check: 'La fecha de fin no puede ser anterior a la de inicio',
  flujos_bono_interes_check: 'El interés por VN no puede ser negativo',
  flujos_bono_amortizacion_check: 'La amortización por VN no puede ser negativa',
  flujos_bono_fuente_check: 'La fuente tiene que tener entre 1 y 200 caracteres',
  escenarios_supuestos_con_version: 'Los supuestos del escenario no dicen su versión',
  escenarios_nombre_check: 'El nombre del escenario tiene que tener entre 1 y 60 caracteres',
  valores_recordados_variable_check: 'La clave de una variable no es válida',
  flujos_reales_cripto_con_pesos: 'El cripto y los pesos que recibiste van juntos',
  flujos_reales_cripto_de_dolares: 'El cripto va solo con dólares que vendiste',
  flujos_reales_anula_afuera: 'Lo que entró a una cuenta no se anula: se deshace (así se va también el aporte)',
  flujos_reales_monto_check: 'El monto tiene que ser mayor que cero',
}

export function traducirErrorFlujo(e: ErrorBase, accion: string): ErrorEscritura {
  const nombre = /constraint "([^"]+)"/.exec(e.message ?? '')?.[1]
  if (nombre && RESTRICCIONES_FLUJO[nombre]) return new ErrorEscritura(`${RESTRICCIONES_FLUJO[nombre]}.`, { codigo: e.code ?? null, causa: e })
  if (e.code === 'PGRST202') {
    return new ErrorEscritura(`La base no tiene la función para ${accion}: falta aplicar las migraciones de Flujo (supabase/migrations/20261015125017 a 20261015125140).`, {
      codigo: e.code,
      causa: e,
    })
  }
  return traducirErrorBase(e, accion)
}

type RespuestaRpc = { data: unknown; error: ErrorBase | null }

async function llamar(fn: string, p: Record<string, unknown>, accion: string, reintentable = false): Promise<unknown> {
  const db = supabase() as unknown as { rpc(fn: string, args: Record<string, unknown>): PromiseLike<RespuestaRpc> }
  let ultimo: ErrorBase | null = null
  for (let i = 0; i < (reintentable ? 2 : 1); i++) {
    let r: RespuestaRpc
    try {
      r = await db.rpc(fn, { p })
    } catch (e) {
      r = { data: null, error: { code: '', message: `Error: ${e instanceof Error ? e.message : String(e)}` } }
    }
    if (!r.error) return r.data
    ultimo = r.error
    if (r.error.code) break
  }
  throw traducirErrorFlujo(ultimo ?? {}, accion)
}

const texto = (v: unknown, campo: string, max: number): string | null => {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new ErrorEscritura(`Valor inválido para ${campo}: tiene que ser texto.`)
  const t = v.trim()
  if (t === '') return null
  if (t.length > max) throw new ErrorEscritura(`${campo[0].toUpperCase()}${campo.slice(1)} tiene más de ${max} caracteres.`)
  return t
}

// ───────────── Cargar ingreso / Cargar gasto ─────────────

export interface FlujoRealAlta {
  fecha: Fecha
  sentido: 'ingreso' | 'gasto'
  concepto: 'mensual' | 'extraordinario'
  moneda: Moneda
  monto: string
  /** null = afuera. */
  cuenta_id: number | null
  cripto_usado?: string | null
  pesos_recibidos?: string | null
  notas?: string | null
}

export function normalizarFlujoReal(f: FlujoRealAlta) {
  if (!f || typeof f !== 'object') throw new ErrorEscritura('El ingreso o gasto llegó vacío.')
  if (f.sentido !== 'ingreso' && f.sentido !== 'gasto') throw new ErrorEscritura('Falta decir si es un ingreso o un gasto.')
  if (f.concepto !== 'mensual' && f.concepto !== 'extraordinario') {
    throw new ErrorEscritura(f.sentido === 'ingreso' ? 'Elegí el concepto: ingreso mensual o extraordinario.' : 'Elegí el concepto: gasto fijo del mes o extraordinario.')
  }
  if (f.moneda !== 'ARS' && f.moneda !== 'USD') throw new ErrorEscritura('Elegí la moneda: US$ o $.')
  const montoT = montoRequerido(f.monto, 'el monto', 'positivo')
  const cripto = montoParaBase(f.cripto_usado ?? null, 'el dólar cripto', 'positivo')
  const pesos = montoParaBase(f.pesos_recibidos ?? null, 'los pesos que recibiste', 'positivo')
  if ((cripto === null) !== (pesos === null)) throw new ErrorEscritura('El cripto y los pesos que recibiste van juntos: completá los dos o ninguno.')
  if (cripto !== null && pesos !== null) {
    if (f.sentido !== 'ingreso' || f.moneda !== 'USD') throw new ErrorEscritura('El cripto va solo con dólares que vendiste (un ingreso en US$).')
    const c = controlCripto(montoT, cripto, pesos)
    if (!c.ok) throw new ErrorEscritura('Los pesos no cierran con US$ × cripto: revisá el cripto o los pesos.')
  }
  return {
    fecha: fechaRequerida(f.fecha, 'la fecha'),
    sentido: f.sentido,
    concepto: f.concepto,
    moneda: f.moneda,
    monto: montoT,
    cuenta_id: f.cuenta_id === null || f.cuenta_id === undefined ? null : idPositivo(f.cuenta_id, 'la cuenta'),
    cripto_usado: cripto,
    pesos_recibidos: pesos,
    notas: texto(f.notas, 'las notas', 500),
  }
}

export interface ResultadoFlujoReal {
  carga_id: number
  flujo_id: number
  movimiento: 'aporte' | 'retiro' | null
  repetido: boolean
}

export function leerResultadoFlujoReal(data: unknown): ResultadoFlujoReal {
  if (!data || typeof data !== 'object') throw new ErrorEscritura('La base respondió algo inesperado al guardar. No se sabe si se grabó: revisá el Registro.')
  const d = data as Record<string, unknown>
  const mov = d.movimiento === 'aporte' || d.movimiento === 'retiro' ? d.movimiento : null
  return { carga_id: leerId(d.carga_id, 'guardar'), flujo_id: leerId(d.flujo_id, 'guardar'), movimiento: mov, repetido: d.repetido === true }
}

/** Graba un ingreso o un gasto real: carga manual + fila + aporte o retiro, en una transacción. Idempotente por lote. */
export async function guardarFlujoReal(f: FlujoRealAlta, lote?: string | null): Promise<ResultadoFlujoReal> {
  const p = { lote: lote ? loteValido(lote) : randomUUID(), ...normalizarFlujoReal(f) }
  return leerResultadoFlujoReal(await llamar('guardar_flujo_real', p, f.sentido === 'ingreso' ? 'guardar el ingreso' : 'guardar el gasto', true))
}

/** Deshacer = revertir su lote, con las reglas de Registro (se va el aporte; la fila deja de contar). */
export async function deshacerFlujoReal(lote: string): Promise<ResumenReversion> {
  return revertirLote(lote, 'Deshecho desde Flujo · Lo que cargaste')
}

/** Anular algo que entró o salió afuera (un error): queda en la auditoría. */
export async function anularFlujoReal(id: number): Promise<void> {
  const fid = idPositivo(id, 'lo cargado')
  const { data, error } = await supabase()
    .from('flujos_reales')
    .update({ anulado_en: new Date().toISOString() })
    .eq('id', fid)
    .is('cuenta_id', null)
    .is('anulado_en', null)
    .select('id')
  if (error) throw traducirErrorFlujo(error, 'anular')
  if (!Array.isArray(data) || data.length !== 1) throw new ErrorEscritura('No se pudo anular: ya estaba anulado, o entró a una cuenta (eso se deshace).')
}

// ───────────── Ingresos y gastos declarados ─────────────

export interface RecurrenteAlta {
  accion: 'alta' | 'cambiar_desde' | 'cerrar' | 'anular'
  sentido: 'ingreso' | 'gasto'
  id?: number | null
  concepto?: string | null
  moneda?: Moneda | null
  monto?: string | null
  desde?: Fecha | null
  hasta?: Fecha | null
  naturaleza?: string | null
  frecuencia?: 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual' | null
  primer_mes?: Fecha | null
  pagador?: 'titular' | 'empresa' | null
  notas?: string | null
}

export function normalizarRecurrente(r: RecurrenteAlta) {
  if (!r || typeof r !== 'object') throw new ErrorEscritura('El ingreso o gasto llegó vacío.')
  if (!['alta', 'cambiar_desde', 'cerrar', 'anular'].includes(r.accion)) throw new ErrorEscritura('Acción inválida.')
  if (r.sentido !== 'ingreso' && r.sentido !== 'gasto') throw new ErrorEscritura('Falta decir si es un ingreso o un gasto.')
  const out: Record<string, unknown> = { accion: r.accion, sentido: r.sentido }
  if (r.accion !== 'alta') out.id = idPositivo(r.id, 'la fila')
  if (r.accion === 'cerrar') out.hasta = fechaRequerida(r.hasta, 'hasta cuándo vale')
  if (r.accion === 'alta' || r.accion === 'cambiar_desde') {
    out.monto = montoRequerido(r.monto, 'el monto', 'positivo')
    out.desde = fechaRequerida(r.desde, 'desde cuándo vale')
    out.hasta = fechaOpcional(r.hasta, 'hasta cuándo vale')
    if (r.accion === 'alta') {
      out.concepto = texto(r.concepto, 'el concepto', 80)
      if (!out.concepto) throw new ErrorEscritura('Falta el concepto.')
      if (r.moneda !== 'ARS' && r.moneda !== 'USD') throw new ErrorEscritura('Elegí la moneda: US$ o $.')
      out.moneda = r.moneda
    }
    if (r.naturaleza) out.naturaleza = r.naturaleza
    if (r.frecuencia) out.frecuencia = r.frecuencia
    if (r.primer_mes) out.primer_mes = fechaRequerida(r.primer_mes, 'el primer mes')
    if (r.pagador) out.pagador = r.pagador
    const notas = texto(r.notas, 'las notas', 500)
    if (notas) out.notas = notas
  }
  return out
}

export async function guardarRecurrente(r: RecurrenteAlta): Promise<number> {
  const data = (await llamar('guardar_recurrente', normalizarRecurrente(r), 'guardar el ingreso o gasto')) as Record<string, unknown> | null
  return leerId(data?.id, 'guardar el ingreso o gasto')
}

// ───────────── Pago al vencimiento ─────────────

export interface FlujosBonoAlta {
  activo_id: number
  fuente: string
  flujos: { fecha: Fecha; interes: string | null; amortizacion: string }[]
}

export function normalizarFlujosBono(b: FlujosBonoAlta) {
  const fuente = texto(b.fuente, 'la fuente', 200)
  if (!fuente) throw new ErrorEscritura('Falta la fuente: de dónde sacaste el pago (el aviso de licitación, por ejemplo).')
  if (!Array.isArray(b.flujos) || b.flujos.length === 0) throw new ErrorEscritura('Falta al menos un pago.')
  return {
    activo_id: idPositivo(b.activo_id, 'el bono o la letra'),
    fuente,
    flujos: b.flujos.map((f) => ({
      fecha: fechaRequerida(f.fecha, 'la fecha del pago'),
      interes: montoParaBase(f.interes, 'el interés por VN', 'no_negativo'),
      amortizacion: montoRequerido(f.amortizacion, 'la amortización por VN', 'no_negativo'),
    })),
  }
}

export async function guardarFlujosBono(b: FlujosBonoAlta): Promise<number> {
  const data = await llamar('guardar_flujos_bono', normalizarFlujosBono(b), 'guardar el pago al vencimiento')
  if (typeof data !== 'number' || data < 1) throw new ErrorEscritura('La base respondió algo inesperado al guardar el pago.')
  return data
}

// ───────────── Escenarios ─────────────

export interface EscenarioAlta {
  accion: 'guardar' | 'archivar' | 'desarchivar'
  id?: number | null
  nombre?: string | null
  supuestos?: Supuestos | null
  recordados?: Record<string, string>
}

export function normalizarEscenario(e: EscenarioAlta) {
  if (!['guardar', 'archivar', 'desarchivar'].includes(e.accion)) throw new ErrorEscritura('Acción inválida.')
  if (e.accion !== 'guardar') return { accion: e.accion, id: idPositivo(e.id, 'el escenario') }
  const nombre = texto(e.nombre, 'el nombre', 60)
  if (!nombre) throw new ErrorEscritura('Ponele un nombre al escenario.')
  const r = esquemaSupuestos.safeParse(e.supuestos)
  if (!r.success) throw new ErrorEscritura('Los supuestos no tienen la forma esperada: recargá la pantalla y probá de nuevo.')
  const rango = erroresDeRango(r.data)
  if (rango.length) throw new ErrorEscritura(rango[0])
  const recordados: Record<string, string> = {}
  // Los valores recordados son una comodidad (D-08): uno inválido se saltea, no frena el guardado.
  for (const [k, v] of Object.entries(e.recordados ?? {})) {
    if (!/^[a-z][a-z0-9_.]{0,79}$/.test(k)) continue
    try {
      const m = montoParaBase(v, `el número recordado de ${k}`, 'no_negativo')
      if (m !== null) recordados[k] = m
    } catch {
      continue
    }
  }
  return { accion: 'guardar', ...(e.id ? { id: idPositivo(e.id, 'el escenario') } : {}), nombre, supuestos: r.data, recordados }
}

export async function guardarEscenario(e: EscenarioAlta): Promise<number> {
  const data = await llamar('guardar_escenario', normalizarEscenario(e), 'guardar el escenario')
  return leerId(data, 'guardar el escenario')
}
