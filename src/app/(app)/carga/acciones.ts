'use server'

// Server Actions de Cargar. Cada una verifica la sesión primero: el proxy es
// solo la primera barrera (D-21).

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { proponerCarga } from '@/lib/carga/conciliar'
import type { LecturaCuenta, PropuestaCarga, ResultadoConfirmacion } from '@/lib/carga/contratos'
import { dec } from '@/lib/domain/dinero'
import { confirmarCarga, crearActivo, revertirLote } from '@/lib/server/escritura'
import { exigirSesion } from '@/lib/server/sesion'
import { esquemaActivo, leerFormulario } from '../datos/_lib/esquemas'
import type { Elecciones } from './_lib/bandeja'
import { armarConfirmacion, type ArchivoGuardado, type ResumenGuardado } from './_lib/confirmacion'
import type { ActivoLocal } from './_lib/demo'
import { aplicarEdiciones, sinCruda, type Ediciones } from './_lib/ediciones'
import { catalogoEjemplo, lecturaGaliciaDosLecturasEjemplo, lecturaIEBEjemplo, lecturaMPEjemplo } from './_lib/ejemplos'
import { firmaValida, firmarLectura, hechosParaCarga, modoCarga, type ModoCarga } from './_lib/servidor'

const texto = (e: unknown) => (e instanceof Error ? e.message : String(e))

const decimal = z.string().regex(/^-?\d+(\.\d+)?$/)
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// ───────────── Proponer: la bandeja ─────────────

export interface EntradaPropuesta {
  lecturas: LecturaCuenta[]
  ediciones: Ediciones
  ccl: string | null
  fecha: string
  activosLocales: ActivoLocal[]
}

export async function proponer(e: EntradaPropuesta): Promise<{ ok: true; propuesta: PropuestaCarga; modo: ModoCarga } | { ok: false; error: string }> {
  try {
    await exigirSesion()
    if (!fecha.safeParse(e.fecha).success) return { ok: false, error: 'Fecha inválida.' }
    if (e.ccl !== null && !decimal.safeParse(e.ccl).success) return { ok: false, error: 'CCL inválido.' }
    const { hechos, modo } = await hechosParaCarga(e.activosLocales ?? [])
    const lecturas = aplicarEdiciones(e.lecturas.map(sinCruda), e.ediciones ?? {})
    return { ok: true, propuesta: proponerCarga(lecturas, hechos, e.fecha, { ccl: dec(e.ccl) }), modo }
  } catch (err) {
    return { ok: false, error: `No pude armar la bandeja: ${texto(err)}` }
  }
}

// ───────────── Guardar: el Enter ─────────────

export interface FuenteAGuardar {
  lectura: LecturaCuenta
  archivo: ArchivoGuardado | null
  firma: string
}

export interface EntradaGuardar {
  lote: string
  fecha: string
  ccl: string | null
  cripto: string | null
  /** De dónde sacaste el CCL (se guarda con el tipo de cambio). */
  referencia?: string | null
  nota: string | null
  tiempo_activo_ms: number | null
  fuentes: FuenteAGuardar[]
  ediciones: Ediciones
  elecciones: Elecciones
  activosLocales: ActivoLocal[]
}

export type ResultadoGuardar =
  | { ok: true; modo: ModoCarga; resumen: ResumenGuardado; resultado: ResultadoConfirmacion | null }
  | { ok: false; errores: string[] }

const esquemaGuardar = z.object({
  lote: z.uuid(),
  fecha,
  ccl: decimal.nullable(),
  cripto: decimal.nullable(),
  referencia: z.string().max(200).nullable(),
  nota: z.string().max(500).nullable(),
  tiempo_activo_ms: z.number().int().nonnegative().max(24 * 3600 * 1000).nullable(),
})

export async function guardar(e: EntradaGuardar): Promise<ResultadoGuardar> {
  try {
    await exigirSesion()
    const base = esquemaGuardar.safeParse({
      lote: e.lote,
      fecha: e.fecha,
      ccl: e.ccl,
      cripto: e.cripto,
      referencia: e.referencia?.trim() ? e.referencia.trim() : null,
      nota: e.nota,
      tiempo_activo_ms: e.tiempo_activo_ms === null ? null : Math.round(e.tiempo_activo_ms),
    })
    if (!base.success) return { ok: false, errores: ['Los datos de la carga no son válidos: recargá la página.'] }
    for (const [campo, v] of [['CCL', e.ccl], ['cripto', e.cripto]] as const) {
      if (v !== null && dec(v)!.lte(0)) return { ok: false, errores: [`El ${campo} tiene que ser mayor que cero.`] }
    }
    for (const f of e.fuentes) {
      if (!(await firmaValida(f.lectura, f.archivo, f.firma))) {
        return { ok: false, errores: [`La lectura de ${f.lectura.cuenta} no es la que devolvió el lector: volvé a soltar el archivo.`] }
      }
    }
    const { hechos, modo } = await hechosParaCarga(e.activosLocales ?? [])
    const lecturas = e.fuentes.map((f) => f.lectura)
    // La propuesta se vuelve a armar acá, contra la base de este momento.
    const propuesta = proponerCarga(aplicarEdiciones(lecturas, e.ediciones ?? {}), hechos, e.fecha, { ccl: dec(e.ccl) })
    const armado = armarConfirmacion({
      lote: e.lote,
      fecha: e.fecha,
      tc: { ccl: e.ccl, cripto_venta: e.cripto, referencia: base.data.referencia },
      propuesta,
      elecciones: e.elecciones,
      ediciones: e.ediciones ?? {},
      fuentes: e.fuentes.map((f) => ({ lectura: f.lectura, archivo: f.archivo })),
      cuentas: hechos.cuentas,
      tiempo_activo_ms: e.tiempo_activo_ms,
      nota: e.nota,
      sinArchivos: modo !== 'real',
    })
    if (!armado.ok) return { ok: false, errores: armado.errores }
    if (modo !== 'real') return { ok: true, modo, resumen: armado.resumen, resultado: null }
    const resultado = await confirmarCarga(armado.confirmacion)
    revalidatePath('/', 'layout')
    return { ok: true, modo, resumen: armado.resumen, resultado }
  } catch (err) {
    return { ok: false, errores: [`No pude guardar: ${texto(err)}`] }
  }
}

// ───────────── Deshacer ─────────────

export async function deshacer(lote: string): Promise<{ ok: true; cargas: number } | { ok: false; error: string }> {
  try {
    await exigirSesion()
    if (!z.uuid().safeParse(lote).success) return { ok: false, error: 'Lote inválido.' }
    if (modoCarga() !== 'real') return { ok: true, cargas: 0 }
    const r = await revertirLote(lote, 'Deshacer inmediato')
    revalidatePath('/', 'layout')
    return { ok: true, cargas: r.cargas.length }
  } catch (err) {
    return { ok: false, error: `No pude deshacer: ${texto(err)}` }
  }
}

// ───────────── Alta de un activo desde la bandeja ─────────────

export async function altaActivo(
  datos: Record<string, string>,
): Promise<{ ok: true; activo: ActivoLocal } | { ok: false; errores: Record<string, string> }> {
  try {
    await exigirSesion()
    const r = leerFormulario(esquemaActivo, datos)
    if (!r.ok) return r
    const a = r.datos
    const nuevo = {
      ticker: a.ticker,
      nombre: a.nombre,
      tipo: a.tipo,
      moneda_riesgo: a.moneda_riesgo,
      geografia: a.geografia,
      indexacion: a.indexacion,
      ticker_subyacente: a.tipo === 'cedear' ? a.ticker_subyacente : null,
    }
    if (modoCarga() !== 'real') {
      // Sin base: el alta vive en la pantalla (id negativo) para que la bandeja la use.
      return { ok: true, activo: { ...nuevo, id: -Math.floor(1000 + Math.random() * 1_000_000) } }
    }
    const id = await crearActivo({ ...nuevo, ratio: a.tipo === 'cedear' ? a.ratio : null, color: a.color, fecha_vencimiento: a.fecha_vencimiento })
    revalidatePath('/datos/catalogo')
    return { ok: true, activo: { ...nuevo, id } }
  } catch (err) {
    return { ok: false, errores: { _: `No pude dar de alta el activo: ${texto(err)}` } }
  }
}

// ───────────── Ejemplo (solo sin base) ─────────────

/** Lecturas de ejemplo firmadas, para probar la bandeja sin archivos ni base. */
export async function ejemploSinBase(fecha: string): Promise<
  { ok: true; fuentes: FuenteAGuardar[]; catalogo: ActivoLocal[] } | { ok: false; error: string }
> {
  await exigirSesion()
  if (modoCarga() === 'real') return { ok: false, error: 'El ejemplo solo existe en el modo demo.' }
  const f = fecha.match(/^\d{4}-\d{2}-\d{2}$/) ? fecha : '2026-10-14'
  const lecturas = [lecturaIEBEjemplo(f), lecturaGaliciaDosLecturasEjemplo(), lecturaMPEjemplo()]
  return {
    ok: true,
    fuentes: await Promise.all(lecturas.map(async (lectura) => ({ lectura, archivo: null, firma: await firmarLectura(lectura, null) }))),
    catalogo: catalogoEjemplo(),
  }
}
