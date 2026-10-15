'use server'

// Escrituras de Flujo y escenarios (plan §6 D.4 y D.9). Cada una: sesión
// primero (D-21, D-112), validación con zod (números en formato argentino),
// escritura por las funciones de la base (escritura-flujo.ts) y revalidación.
//
// Modo demo (D-24): Cargar ingreso, Deshacer, Anular y los escenarios se
// "guardan" en una cookie del navegador, para probar el recorrido entero sin
// base; los ingresos y gastos declarados y los pagos al vencimiento solo se
// validan (como en Datos).

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { monto } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import { pagoUnico } from '@/lib/domain/flujo/pago'
import type { Supuestos } from '@/lib/domain/flujo/tipos'
import {
  anularFlujoReal,
  deshacerFlujoReal,
  guardarEscenario,
  guardarFlujoReal,
  guardarFlujosBono,
  guardarRecurrente,
  normalizarEscenario,
  normalizarFlujoReal,
} from '@/lib/server/escritura-flujo'
import { exigirSesion, modoDemo } from '@/lib/server/sesion'
import { configurado } from '@/lib/server/supabase'
import { COOKIE_DEMO_ESCENARIOS, COOKIE_DEMO_FLUJO, DEMO_MAX, demoGuardado, partirDemoGuardado } from '@/lib/vistas/flujo'
import type { DemoGuardado } from '@/lib/vistas/ejemplo-flujo'
import { esquemaFlujoReal, esquemaPago, esquemaRecurrente, leer } from './_lib/esquemas'

export interface EstadoFlujo {
  ok: boolean | null
  mensaje: string | null
  errores: Record<string, string>
  /** Sube con cada guardado: el formulario lo usa para limpiarse y pedir un lote nuevo. */
  vez: number
}

const texto = (e: unknown) => (e instanceof Error ? e.message : String(e))
const RE_LOTE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** El lote del envío (lo arma el formulario): un reintento del mismo envío no duplica el hecho. */
const loteDe = (form: FormData): string | null => {
  const v = form.get('lote')
  return typeof v === 'string' && RE_LOTE.test(v) ? v : null
}

const enDemo = () => modoDemo() || !configurado()

async function sesion(): Promise<boolean> {
  try {
    await exigirSesion()
    return true
  } catch {
    return false
  }
}

async function guardarDemo(cambiar: (d: DemoGuardado) => DemoGuardado) {
  const partes = partirDemoGuardado(cambiar(await demoGuardado()))
  const c = await cookies()
  const opciones = { path: '/', sameSite: 'lax' as const, httpOnly: true, maxAge: 60 * 60 * 24 * 7 }
  c.set(COOKIE_DEMO_FLUJO, partes.flujos, opciones)
  c.set(COOKIE_DEMO_ESCENARIOS, partes.escenarios, opciones)
}

function revalidar() {
  revalidatePath('/flujo')
  revalidatePath('/flujo/cargar')
  revalidatePath('/', 'layout')
}

// ───────────── Cargar ingreso / Cargar gasto ─────────────

export async function cargarFlujoReal(previo: EstadoFlujo, form: FormData): Promise<EstadoFlujo> {
  if (!(await sesion())) return { ok: false, mensaje: 'Sesión vencida: volvé a entrar.', errores: {}, vez: previo.vez }
  const v = leer(esquemaFlujoReal, form)
  if (!v.ok) return { ok: false, mensaje: 'Revisá los campos marcados.', errores: v.errores, vez: previo.vez }
  const d = v.datos
  const alta = {
    fecha: d.fecha,
    sentido: d.sentido,
    concepto: d.concepto,
    moneda: d.moneda,
    monto: d.monto,
    cuenta_id: d.cuenta === 'afuera' ? null : Number(d.cuenta),
    cripto_usado: d.cripto,
    pesos_recibidos: d.pesos,
    notas: d.notas,
  } as const
  const que = `${d.sentido === 'ingreso' ? (d.concepto === 'mensual' ? 'ingreso mensual' : 'ingreso extraordinario') : d.concepto === 'mensual' ? 'gasto fijo del mes' : 'gasto extraordinario'}`
  const cuanto = monto(d.monto, d.moneda, { decimales: 2 })
  const dondeTexto = (aporte: boolean) =>
    alta.cuenta_id === null
      ? 'Quedó como hecho fuera de tus cuentas.'
      : aporte
        ? 'Entró a tu cuenta como aporte: la próxima carga no lo lee como ganancia de tus inversiones.'
        : 'Salió de tu cuenta como retiro: la próxima carga no lo lee como pérdida.'
  try {
    if (enDemo()) {
      const n = normalizarFlujoReal(alta)
      const lote = loteDe(form) ?? randomUUID()
      let repetido = false
      await guardarDemo((g) => {
        if (g.flujos.some((f) => f.lote === lote && !f.revertida)) {
          repetido = true
          return g
        }
        const id = g.flujos.reduce((a, f) => Math.max(a, f.id), 900) + 1
        return {
          ...g,
          flujos: [
            ...g.flujos,
            {
              id,
              fecha: n.fecha,
              sentido: n.sentido,
              concepto: n.concepto,
              moneda: n.moneda,
              monto: n.monto,
              cuenta_id: n.cuenta_id,
              cripto_usado: n.cripto_usado,
              pesos_recibidos: n.pesos_recibidos,
              anulado: false,
              carga_id: 9000 + id,
              notas: n.notas,
              lote,
              revertida: false,
              creado_en: new Date().toISOString(),
            },
          ].slice(-DEMO_MAX.flujos),
        }
      })
      revalidar()
      return {
        ok: true,
        mensaje: repetido ? 'Ya estaba cargado (el mismo envío no se duplica).' : `Listo: cargaste ${cuanto} de ${que} del ${fechaCorta(d.fecha)}. ${dondeTexto(n.sentido === 'ingreso')} (Modo demo: queda en este navegador.)`,
        errores: {},
        vez: previo.vez + 1,
      }
    }
    const r = await guardarFlujoReal(alta, loteDe(form))
    revalidar()
    return {
      ok: true,
      mensaje: r.repetido ? 'Ya estaba cargado (el mismo envío no se duplica).' : `Listo: cargaste ${cuanto} de ${que} del ${fechaCorta(d.fecha)}. ${dondeTexto(r.movimiento === 'aporte')}`,
      errores: {},
      vez: previo.vez + 1,
    }
  } catch (e) {
    return { ok: false, mensaje: `No pude guardar: ${texto(e)}`, errores: {}, vez: previo.vez }
  }
}

export interface ResultadoAccion {
  ok: boolean
  mensaje: string
}

/** Deshacer lo cargado: revierte su lote (con las reglas de Registro). */
export async function deshacerCargado(lote: string): Promise<ResultadoAccion> {
  if (!(await sesion())) return { ok: false, mensaje: 'Sesión vencida: volvé a entrar.' }
  if (!RE_LOTE.test(lote)) return { ok: false, mensaje: 'No sé qué deshacer: recargá la pantalla.' }
  try {
    if (enDemo()) {
      await guardarDemo((g) => ({ ...g, flujos: g.flujos.map((f) => (f.lote === lote ? { ...f, revertida: true } : f)) }))
      revalidar()
      return { ok: true, mensaje: 'Deshecho: ya no cuenta en tu flujo. (Modo demo.)' }
    }
    await deshacerFlujoReal(lote)
    revalidar()
    return { ok: true, mensaje: 'Deshecho: ya no cuenta en tu flujo, y el aporte o retiro se fue con él.' }
  } catch (e) {
    return { ok: false, mensaje: `No pude deshacerlo: ${texto(e)}` }
  }
}

/** Anular algo que entró o salió afuera (un error): queda en la auditoría. */
export async function anularCargado(id: number): Promise<ResultadoAccion> {
  if (!(await sesion())) return { ok: false, mensaje: 'Sesión vencida: volvé a entrar.' }
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'No sé qué anular: recargá la pantalla.' }
  try {
    if (enDemo()) {
      await guardarDemo((g) => ({ ...g, flujos: g.flujos.map((f) => (f.id === id && f.cuenta_id === null ? { ...f, anulado: true } : f)) }))
      revalidar()
      return { ok: true, mensaje: 'Anulado: ya no cuenta, y queda registrado. (Modo demo.)' }
    }
    await anularFlujoReal(id)
    revalidar()
    return { ok: true, mensaje: 'Anulado: ya no cuenta, y queda en la auditoría.' }
  } catch (e) {
    return { ok: false, mensaje: `No pude anularlo: ${texto(e)}` }
  }
}

// ───────────── Ingresos y gastos declarados ─────────────

export async function guardarRecurrenteAccion(previo: EstadoFlujo, form: FormData): Promise<EstadoFlujo> {
  if (!(await sesion())) return { ok: false, mensaje: 'Sesión vencida: volvé a entrar.', errores: {}, vez: previo.vez }
  const v = leer(esquemaRecurrente, form)
  if (!v.ok) return { ok: false, mensaje: 'Revisá los campos marcados.', errores: v.errores, vez: previo.vez }
  const d = v.datos
  if (enDemo()) return { ok: true, mensaje: 'Modo demo: los datos están bien, pero no se guardan.', errores: {}, vez: previo.vez + 1 }
  try {
    await guardarRecurrente({
      accion: d.accion,
      sentido: d.sentido,
      id: d.id,
      concepto: d.concepto,
      moneda: d.moneda,
      monto: d.monto,
      desde: d.desde,
      hasta: d.hasta,
      frecuencia: d.frecuencia,
      primer_mes: d.primer_mes ? `${d.primer_mes}-01` : null,
      naturaleza: d.naturaleza,
    })
    revalidar()
    const msj: Record<typeof d.accion, string> = {
      alta: 'Listo: quedó declarado.',
      cambiar_desde: `Listo: desde el ${d.desde ? fechaCorta(d.desde) : ''} vale el monto nuevo; el anterior quedó cerrado el día antes.`,
      cerrar: 'Listo: quedó cerrado.',
      anular: 'Anulado: ya no cuenta, y queda en la auditoría.',
    }
    return { ok: true, mensaje: msj[d.accion], errores: {}, vez: previo.vez + 1 }
  } catch (e) {
    return { ok: false, mensaje: `No pude guardar: ${texto(e)}`, errores: {}, vez: previo.vez }
  }
}

// ───────────── Pago al vencimiento ─────────────

export async function guardarPagoAccion(previo: EstadoFlujo, form: FormData): Promise<EstadoFlujo> {
  if (!(await sesion())) return { ok: false, mensaje: 'Sesión vencida: volvé a entrar.', errores: {}, vez: previo.vez }
  const v = leer(esquemaPago, form)
  if (!v.ok) return { ok: false, mensaje: 'Revisá los campos marcados.', errores: v.errores, vez: previo.vez }
  const d = v.datos
  if (enDemo()) return { ok: true, mensaje: 'Modo demo: el pago está bien, pero no se guarda.', errores: {}, vez: previo.vez + 1 }
  try {
    const p = pagoUnico(d.pago_por_vn)
    await guardarFlujosBono({ activo_id: d.activo_id, fuente: d.fuente, flujos: [{ fecha: d.fecha, interes: p.interes, amortizacion: p.amortizacion }] })
    revalidar()
    return { ok: true, mensaje: 'Listo: el pago quedó cargado con su fuente.', errores: {}, vez: previo.vez + 1 }
  } catch (e) {
    return { ok: false, mensaje: `No pude guardar: ${texto(e)}`, errores: {}, vez: previo.vez }
  }
}

// ───────────── Escenarios ─────────────

export interface PedidoEscenario {
  accion: 'guardar' | 'archivar' | 'desarchivar'
  id?: number | null
  nombre?: string | null
  supuestos?: Supuestos | null
  recordados?: Record<string, string>
}

export async function guardarEscenarioAccion(p: PedidoEscenario): Promise<ResultadoAccion & { id: number | null }> {
  if (!(await sesion())) return { ok: false, mensaje: 'Sesión vencida: volvé a entrar.', id: null }
  try {
    const n = normalizarEscenario(p)
    if (enDemo()) {
      let id: number | null = null
      await guardarDemo((g) => {
        const escenarios = [...g.escenarios]
        const recordados = { ...g.recordados, ...('recordados' in n ? n.recordados : {}) }
        if (n.accion === 'guardar') {
          const existente = 'id' in n && n.id ? escenarios.findIndex((e) => e.id === n.id) : -1
          id = existente >= 0 ? escenarios[existente].id : escenarios.reduce((a, e) => Math.max(a, e.id), 100) + 1
          const fila = { id, nombre: n.nombre as string, supuestos: n.supuestos, archivado: false, actualizado_en: new Date().toISOString() }
          if (existente >= 0) escenarios[existente] = fila
          else escenarios.push(fila)
        } else {
          id = n.id ?? null
          for (const e of escenarios) if (e.id === n.id) e.archivado = n.accion === 'archivar'
        }
        return { ...g, escenarios: escenarios.slice(-DEMO_MAX.escenarios), recordados }
      })
      revalidar()
      return { ok: true, mensaje: n.accion === 'guardar' ? 'Guardado. (Modo demo: queda en este navegador.)' : n.accion === 'archivar' ? 'Archivado: deja de listarse, no se borra.' : 'Vuelve a la lista.', id }
    }
    const id = await guardarEscenario(p)
    revalidar()
    return { ok: true, mensaje: p.accion === 'guardar' ? 'Guardado.' : p.accion === 'archivar' ? 'Archivado: deja de listarse, no se borra.' : 'Vuelve a la lista.', id }
  } catch (e) {
    return { ok: false, mensaje: `No pude guardarlo: ${texto(e)}`, id: null }
  }
}
