'use server'

// Escrituras de Datos. Cada una: sesión primero (D-21), validación con zod
// (números en formato argentino), escritura por las funciones de la base y
// revalidación de las pantallas que dependen de esos datos.

import { revalidatePath } from 'next/cache'
import {
  actualizarActivo,
  crearActivo,
  crearBien,
  crearPasivo,
  guardarMovimientoCapital,
  guardarPasivoSaldo,
  guardarValuacionBien,
} from '@/lib/server/escritura'
import { exigirSesion, modoDemo } from '@/lib/server/sesion'
import { configurado } from '@/lib/server/supabase'
import {
  esquemaActivo,
  esquemaBien,
  esquemaEdicionActivo,
  esquemaMovimiento,
  esquemaPasivo,
  esquemaPasivoSaldo,
  esquemaValuacion,
  leerFormulario,
} from './_lib/esquemas'

export interface EstadoFormulario {
  ok: boolean | null
  mensaje: string | null
  errores: Record<string, string>
  /** Sube con cada guardado: el formulario lo usa para limpiarse. */
  vez: number
}

const texto = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** El lote del envío (lo arma el formulario): un reintento del mismo envío no duplica el hecho. */
const loteDe = (form: FormData): string | null => {
  const v = form.get('lote')
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null
}

async function escribir(
  previo: EstadoFormulario,
  validar: () => { ok: true } | { ok: false; errores: Record<string, string> },
  hacer: () => Promise<string>,
): Promise<EstadoFormulario> {
  try {
    await exigirSesion()
  } catch {
    return { ok: false, mensaje: 'Sesión vencida: volvé a entrar.', errores: {}, vez: previo.vez }
  }
  const v = validar()
  if (!v.ok) return { ok: false, mensaje: 'Revisá los campos marcados.', errores: v.errores, vez: previo.vez }
  if (modoDemo() || !configurado()) {
    return { ok: true, mensaje: 'Modo demo: los datos están bien, pero no se guardan.', errores: {}, vez: previo.vez + 1 }
  }
  try {
    const mensaje = await hacer()
    revalidatePath('/', 'layout')
    return { ok: true, mensaje, errores: {}, vez: previo.vez + 1 }
  } catch (e) {
    return { ok: false, mensaje: `No pude guardar: ${texto(e)}`, errores: {}, vez: previo.vez }
  }
}

export async function nuevoActivo(previo: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const r = leerFormulario(esquemaActivo, form)
  return escribir(
    previo,
    () => r,
    async () => {
      if (!r.ok) throw new Error('inválido')
      const a = r.datos
      await crearActivo({
        ticker: a.ticker,
        nombre: a.nombre,
        tipo: a.tipo,
        moneda_riesgo: a.moneda_riesgo,
        geografia: a.geografia,
        indexacion: a.indexacion,
        ticker_subyacente: a.tipo === 'cedear' ? a.ticker_subyacente : null,
        ratio: a.tipo === 'cedear' ? a.ratio : null,
        color: a.color,
        fecha_vencimiento: a.fecha_vencimiento,
      })
      return `${a.ticker} quedó en el catálogo.`
    },
  )
}

export async function editarActivo(previo: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const r = leerFormulario(esquemaEdicionActivo, form)
  return escribir(
    previo,
    () => r,
    async () => {
      if (!r.ok) throw new Error('inválido')
      const a = r.datos
      await actualizarActivo(a.id, {
        nombre: a.nombre,
        tipo: a.tipo,
        moneda_riesgo: a.moneda_riesgo,
        geografia: a.geografia,
        indexacion: a.indexacion,
        ticker_subyacente: a.tipo === 'cedear' ? a.ticker_subyacente : null,
        fecha_vencimiento: a.fecha_vencimiento,
        color: a.color,
        activo_bool: a.activo_bool,
        ...(a.ratio && a.ratio_desde ? { ratio: { ratio: a.ratio, vigente_desde: a.ratio_desde } } : {}),
      })
      return a.ratio ? 'Guardado, con el ratio nuevo y su vigencia.' : 'Guardado.'
    },
  )
}

export async function nuevoBien(previo: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const r = leerFormulario(esquemaBien, form)
  return escribir(
    previo,
    () => r,
    async () => {
      if (!r.ok) throw new Error('inválido')
      await crearBien(r.datos)
      return `${r.datos.nombre} quedó cargado. Sumale una valuación con su fuente.`
    },
  )
}

export async function nuevaValuacion(previo: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const r = leerFormulario(esquemaValuacion, form)
  return escribir(
    previo,
    () => r,
    async () => {
      if (!r.ok) throw new Error('inválido')
      await guardarValuacionBien(r.datos, loteDe(form))
      return 'Valuación guardada.'
    },
  )
}

export async function nuevoPasivo(previo: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const r = leerFormulario(esquemaPasivo, form)
  return escribir(
    previo,
    () => r,
    async () => {
      if (!r.ok) throw new Error('inválido')
      await crearPasivo(r.datos)
      return `${r.datos.nombre} quedó cargado. Registrá el capital pendiente que informa el acreedor.`
    },
  )
}

export async function nuevoSaldoPasivo(previo: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const r = leerFormulario(esquemaPasivoSaldo, form)
  return escribir(
    previo,
    () => r,
    async () => {
      if (!r.ok) throw new Error('inválido')
      await guardarPasivoSaldo(r.datos, loteDe(form))
      return 'Capital pendiente guardado.'
    },
  )
}

export async function nuevoMovimiento(previo: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const r = leerFormulario(esquemaMovimiento, form)
  return escribir(
    previo,
    () => r,
    async () => {
      if (!r.ok) throw new Error('inválido')
      await guardarMovimientoCapital(r.datos, loteDe(form))
      return r.datos.tipo === 'aporte'
        ? 'El aporte quedó registrado.'
        : r.datos.tipo === 'retiro'
          ? 'El retiro quedó registrado.'
          : 'La transferencia quedó registrada.'
    },
  )
}
