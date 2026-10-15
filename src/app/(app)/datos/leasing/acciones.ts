'use server'

// Escrituras de Datos › Leasing que suma la entrega 4 (plan §5 C.4): importar
// el cuadro de marcha (revisar → Enter → guardado → Deshacer), completar el pago
// de una cuota, la fecha de desembolso, la opción de compra que trae la
// planilla y los cargos extra. Sesión primero (D-21). El servidor vuelve a leer
// el CSV al guardar: nunca graba lo que armó el navegador. En modo demo se
// revisa todo igual, pero no se guarda nada.

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { LECTOR_CUADRO, leerCuadroMarcha, revisarCuadro, type LecturaCuadro, type RevisionCuadro } from '@/lib/carga/cuadro-marcha'
import { hoyCordoba } from '@/lib/domain/fechas'
import type { ContratoPasivo, Cuota } from '@/lib/domain/pasivos/tipos'
import { actualizarPasivo, revertirLote } from '@/lib/server/escritura'
import { actualizarDatosPasivo, anularCargo, guardarCuadroMarcha, type CargoAlta, type CuotaAlta } from '@/lib/server/escritura-pasivos'
import { exigirSesion, modoDemo } from '@/lib/server/sesion'
import { configurado } from '@/lib/server/supabase'
import { esquemaCargo, esquemaDeshacer, esquemaDesembolso, esquemaGuardarPlanilla, esquemaOpcion, esquemaPago, esquemaPlanilla } from '../_lib/esquemas-leasing'
import { hechosLeasing } from '../_lib/servidor-leasing'

export interface ResultadoPlanilla {
  ok: boolean
  mensaje: string
  /** La revisión (también con errores: se muestran con fila y columna). */
  revision: RevisionCuadro | null
  sha256: string | null
  /** Después del Enter: el lote (para Deshacer) y lo que se grabó. */
  guardado: { lote: string; carga_id: number | null; cuotas: number; cargos: number; demo: boolean } | null
}

export interface ResultadoSimple {
  ok: boolean
  mensaje: string
  errores?: Record<string, string>
}

const texto = (e: unknown) => (e instanceof Error ? e.message : String(e))
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')
const sinGuardar = () => modoDemo() || !configurado()

function erroresZod(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const k = String(i.path[0] ?? 'formulario')
    out[k] ??= i.message
  }
  return out
}

async function sesion(): Promise<string | null> {
  try {
    await exigirSesion()
    return null
  } catch {
    return 'Sesión vencida: volvé a entrar.'
  }
}

/** El contrato y sus cuotas de hoy (del demo pedido o de la base). */
async function contratoYCuotas(pasivoId: number, demo: unknown): Promise<{ contrato: ContratoPasivo; cuotas: Cuota[] } | null> {
  const { hp } = await hechosLeasing(demo)
  const contrato = hp.contratos.find((c) => c.id === pasivoId)
  if (!contrato) return null
  return { contrato, cuotas: hp.cuotas.filter((c) => c.pasivo_id === pasivoId) }
}

async function leerYRevisar(pasivoId: number, textoCsv: string, demo: unknown): Promise<{ lectura: LecturaCuadro; revision: RevisionCuadro } | string> {
  const cc = await contratoYCuotas(pasivoId, demo)
  if (!cc) return 'No encuentro ese pasivo: recargá la página.'
  const lectura = leerCuadroMarcha(textoCsv, { cuotasTotales: cc.contrato.cuotas_totales })
  return { lectura, revision: revisarCuadro(lectura, cc.contrato, cc.cuotas) }
}

/** Primer paso: lee el CSV y devuelve la revisión. No graba nada. */
export async function revisarPlanilla(datos: { pasivo_id: number; nombre?: string; texto: string; demo?: string | null }): Promise<ResultadoPlanilla> {
  const s = await sesion()
  if (s) return { ok: false, mensaje: s, revision: null, sha256: null, guardado: null }
  const r = esquemaPlanilla.safeParse(datos)
  if (!r.success) return { ok: false, mensaje: r.error.issues[0]?.message ?? 'Revisá el archivo.', revision: null, sha256: null, guardado: null }
  try {
    const x = await leerYRevisar(r.data.pasivo_id, r.data.texto, datos.demo)
    if (typeof x === 'string') return { ok: false, mensaje: x, revision: null, sha256: null, guardado: null }
    const n = x.revision.errores.length
    return {
      ok: n === 0,
      mensaje: n === 0 ? 'Revisá y guardá con Enter.' : `La planilla tiene ${n === 1 ? 'un error' : `${n} errores`}: corregilos en el archivo y volvé a elegirlo.`,
      revision: x.revision,
      sha256: sha(r.data.texto),
      guardado: null,
    }
  } catch (e) {
    return { ok: false, mensaje: `No pude leer la planilla: ${texto(e)}`, revision: null, sha256: null, guardado: null }
  }
}

/** El Enter: vuelve a leer el mismo texto, exige cero errores y las advertencias aceptadas, y graba con su lote. */
export async function guardarPlanilla(datos: {
  pasivo_id: number
  nombre?: string
  texto: string
  lote: string
  sha256: string
  aceptadas: string[]
  demo?: string | null
}): Promise<ResultadoPlanilla> {
  const s = await sesion()
  if (s) return { ok: false, mensaje: s, revision: null, sha256: null, guardado: null }
  const r = esquemaGuardarPlanilla.safeParse(datos)
  if (!r.success) return { ok: false, mensaje: r.error.issues[0]?.message ?? 'Revisá el archivo.', revision: null, sha256: null, guardado: null }
  const hash = sha(r.data.texto)
  if (hash !== datos.sha256) return { ok: false, mensaje: 'El archivo cambió desde la revisión: volvé a revisarlo.', revision: null, sha256: null, guardado: null }
  try {
    const x = await leerYRevisar(r.data.pasivo_id, r.data.texto, datos.demo)
    if (typeof x === 'string') return { ok: false, mensaje: x, revision: null, sha256: null, guardado: null }
    const { lectura, revision } = x
    if (revision.errores.length) return { ok: false, mensaje: 'La planilla tiene errores: no se guardó nada.', revision, sha256: hash, guardado: null }
    const faltan = revision.advertencias.filter((a) => !(Array.isArray(datos.aceptadas) && datos.aceptadas.includes(a)))
    if (faltan.length) return { ok: false, mensaje: 'Aceptá cada advertencia antes de guardar.', revision, sha256: hash, guardado: null }
    const cuotas: CuotaAlta[] = lectura.filas.map((f) => ({
      nro: f.nro,
      fecha_vencimiento: f.fecha_vencimiento,
      periodo: f.periodo,
      canon_neto: f.canon_neto,
      iva_canon: f.iva_canon,
      seguro: f.seguro,
      otros_conceptos: f.otros_conceptos,
      estado: f.estado,
      fuente_canon: f.fuente_canon,
      fuente_seguro: f.fuente_seguro,
      fuente_otros: f.fuente_otros,
      pagada: f.pagada,
    }))
    const cargos: CargoAlta[] = lectura.cargos.map((k) => ({ fecha: k.fecha, concepto: k.concepto, detalle: k.detalle, importe: k.importe, cuota_nro: k.cuota_nro, fuente: k.fuente }))
    const resumen = `${cuotas.length} cuotas${cargos.length ? ` y ${cargos.length === 1 ? 'un cargo' : `${cargos.length} cargos`}` : ''}`
    if (sinGuardar()) {
      return {
        ok: true,
        mensaje: `Modo demo: la planilla está bien (${resumen}), pero no se guarda.`,
        revision,
        sha256: hash,
        guardado: { lote: r.data.lote, carga_id: null, cuotas: cuotas.length, cargos: cargos.length, demo: true },
      }
    }
    const carga = await guardarCuadroMarcha({
      lote: r.data.lote,
      fecha: hoyCordoba(),
      pasivo_id: r.data.pasivo_id,
      lector: LECTOR_CUADRO,
      archivo: { nombre: r.data.nombre, sha256: hash, texto: r.data.texto },
      cuotas,
      cargos,
    })
    revalidatePath('/', 'layout')
    return { ok: true, mensaje: `Guardado · ${resumen}.`, revision, sha256: hash, guardado: { lote: r.data.lote, carga_id: carga, cuotas: cuotas.length, cargos: cargos.length, demo: false } }
  } catch (e) {
    return { ok: false, mensaje: `No pude guardar: ${texto(e)}. Probá de nuevo: el mismo Enter no duplica nada.`, revision: null, sha256: hash, guardado: null }
  }
}

/** Deshacer el guardado recién hecho (revertir_lote restaura lo que la planilla pisó). */
export async function deshacerPlanilla(datos: { lote: string }): Promise<ResultadoSimple> {
  const s = await sesion()
  if (s) return { ok: false, mensaje: s }
  const r = esquemaDeshacer.safeParse(datos)
  if (!r.success) return { ok: false, mensaje: 'Falta el lote para deshacer.' }
  if (sinGuardar()) return { ok: true, mensaje: 'Modo demo: no se había guardado nada, así que no hay nada que deshacer.' }
  try {
    await revertirLote(r.data.lote, 'Deshacer el cuadro de marcha')
    revalidatePath('/', 'layout')
    return { ok: true, mensaje: 'Deshecho: el cuadro de marcha volvió a como estaba antes de esta planilla.' }
  } catch (e) {
    return { ok: false, mensaje: `No pude deshacer: ${texto(e)}. También podés revertirlo desde Registro.` }
  }
}

/** La opción de compra que trae la planilla, guardada en el contrato (actualizarPasivo, con el contrato entero). */
export async function guardarOpcionEnContrato(datos: { pasivo_id: number; neto: string; fecha: string; demo?: string | null }): Promise<ResultadoSimple> {
  const s = await sesion()
  if (s) return { ok: false, mensaje: s }
  const r = esquemaOpcion.safeParse(datos)
  if (!r.success) return { ok: false, mensaje: 'La opción de compra de la planilla no es válida.' }
  if (sinGuardar()) return { ok: true, mensaje: 'Modo demo: está bien, pero no se guarda en el contrato.' }
  try {
    const cc = await contratoYCuotas(r.data.pasivo_id, datos.demo)
    if (!cc) return { ok: false, mensaje: 'No encuentro ese pasivo: recargá la página.' }
    const c = cc.contrato
    await actualizarPasivo(c.id, {
      nombre: c.nombre,
      tipo: c.tipo,
      moneda: c.moneda,
      fecha_inicio: c.fecha_inicio,
      cuotas_totales: c.cuotas_totales,
      monto_financiado_neto: c.monto_financiado_neto?.toFixed() ?? null,
      anticipo_neto: c.anticipo_neto?.toFixed() ?? null,
      opcion_compra_neto: r.data.neto,
      opcion_compra_fecha: r.data.fecha,
      valor_bien: c.valor_bien?.toFixed() ?? null,
      notas: c.notas,
    })
    revalidatePath('/', 'layout')
    return { ok: true, mensaje: 'Guardada en el contrato.' }
  } catch (e) {
    return { ok: false, mensaje: `No pude guardarla: ${texto(e)}` }
  }
}

/** La fecha de desembolso (la entrega del bien): con el monto financiado, da la tasa del contrato. */
export async function guardarDesembolso(datos: { pasivo_id: number; fecha_desembolso: string }): Promise<ResultadoSimple> {
  const s = await sesion()
  if (s) return { ok: false, mensaje: s }
  const r = esquemaDesembolso.safeParse(datos)
  if (!r.success) return { ok: false, mensaje: 'Revisá la fecha.', errores: erroresZod(r.error.issues) }
  if (sinGuardar()) return { ok: true, mensaje: 'Modo demo: la fecha está bien, pero no se guarda.' }
  try {
    await actualizarDatosPasivo(r.data.pasivo_id, { fecha_desembolso: r.data.fecha_desembolso })
    revalidatePath('/', 'layout')
    return { ok: true, mensaje: 'Guardada. La tasa del contrato ya la usa.' }
  } catch (e) {
    return { ok: false, mensaje: `No pude guardar: ${texto(e)}` }
  }
}

/**
 * Completa el pago de una cuota facturada: la fecha (opcional: "fecha sin
 * dato" vale, D-140), el CCL de ese día con su fuente (los dos o ninguno) y
 * quién pagó. Graba la cuota entera como está (con su lote), más el pago.
 */
export async function registrarPago(datos: Record<string, unknown>): Promise<ResultadoSimple> {
  const s = await sesion()
  if (s) return { ok: false, mensaje: s }
  const r = esquemaPago.safeParse(datos)
  if (!r.success) return { ok: false, mensaje: 'Revisá los campos marcados.', errores: erroresZod(r.error.issues) }
  const p = r.data
  if (p.fecha_pago !== null && p.fecha_pago > hoyCordoba()) return { ok: false, mensaje: 'Revisá los campos marcados.', errores: { fecha_pago: 'Es una fecha futura.' } }
  try {
    const cc = await contratoYCuotas(p.pasivo_id, datos.demo)
    if (!cc) return { ok: false, mensaje: 'No encuentro ese pasivo: recargá la página.' }
    const c = cc.cuotas.find((x) => x.nro === p.nro)
    if (!c) return { ok: false, mensaje: `La cuota ${p.nro} no está en el cuadro de marcha.` }
    if (c.estado !== 'facturada') return { ok: false, mensaje: `La cuota ${p.nro} todavía no tiene factura: cuando la pagues, importá la planilla actualizada.` }
    if (sinGuardar()) return { ok: true, mensaje: `Modo demo: el pago de la cuota ${p.nro} está bien, pero no se guarda.` }
    await guardarCuadroMarcha({
      lote: p.lote,
      fecha: hoyCordoba(),
      pasivo_id: p.pasivo_id,
      lector: 'manual',
      cuotas: [
        {
          nro: c.nro,
          fecha_vencimiento: c.fecha_vencimiento,
          periodo: c.periodo,
          canon_neto: c.canon_neto.toFixed(),
          iva_canon: c.iva_canon.toFixed(),
          seguro: c.seguro.toFixed(),
          otros_conceptos: c.otros_conceptos.toFixed(),
          estado: c.estado,
          fuente_canon: c.fuente_canon === 'no_aplica' ? 'comprobante' : c.fuente_canon,
          fuente_seguro: c.fuente_seguro,
          fuente_otros: c.fuente_otros,
          pagada: true,
          fecha_pago: p.fecha_pago,
          ccl_del_dia_pago: p.ccl,
          ccl_fuente: p.ccl_fuente,
          pagador: p.pagador,
        },
      ],
    })
    revalidatePath('/', 'layout')
    return { ok: true, mensaje: `Guardado el pago de la cuota ${p.nro}.` }
  } catch (e) {
    return { ok: false, mensaje: `No pude guardar: ${texto(e)}` }
  }
}

/** Un cargo extra cargado a mano (multa, comisión, reserva de fondos, interés u otro). */
export async function agregarCargo(datos: Record<string, unknown>): Promise<ResultadoSimple> {
  const s = await sesion()
  if (s) return { ok: false, mensaje: s }
  const r = esquemaCargo.safeParse(datos)
  if (!r.success) return { ok: false, mensaje: 'Revisá los campos marcados.', errores: erroresZod(r.error.issues) }
  const k = r.data
  if (sinGuardar()) return { ok: true, mensaje: 'Modo demo: el cargo está bien, pero no se guarda.' }
  try {
    await guardarCuadroMarcha({
      lote: k.lote,
      fecha: hoyCordoba(),
      pasivo_id: k.pasivo_id,
      lector: 'manual',
      cuotas: [],
      cargos: [{ fecha: k.fecha, concepto: k.concepto, detalle: k.detalle, importe: k.importe, cuota_nro: k.cuota_nro, fuente: k.fuente }],
    })
    revalidatePath('/', 'layout')
    return { ok: true, mensaje: 'Cargo guardado.' }
  } catch (e) {
    return { ok: false, mensaje: `No pude guardar: ${texto(e)}` }
  }
}

/** Anula un cargo (queda en la auditoría; no se borra). */
export async function anularCargoAccion(datos: { id: number }): Promise<ResultadoSimple> {
  const s = await sesion()
  if (s) return { ok: false, mensaje: s }
  const id = Number(datos?.id)
  if (!Number.isSafeInteger(id) || id < 1) return { ok: false, mensaje: 'Falta el cargo.' }
  if (sinGuardar()) return { ok: true, mensaje: 'Modo demo: no se anula nada.' }
  try {
    await anularCargo(id)
    revalidatePath('/', 'layout')
    return { ok: true, mensaje: 'Cargo anulado.' }
  } catch (e) {
    return { ok: false, mensaje: `No pude anularlo: ${texto(e)}` }
  }
}
