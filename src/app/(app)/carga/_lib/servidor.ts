import 'server-only'

// Lo que la pantalla de Cargar necesita del servidor: los hechos para
// conciliar (o los de "sin base"), el contexto inicial y la firma de cada
// lectura. La lectura que se graba como lectura_cruda es la que devolvió el
// lector en el servidor, nunca una que arme el navegador (D-63 de la visión):
// el servidor la firma al leerla y verifica la firma al confirmar.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { hoyCordoba } from '@/lib/domain/fechas'
import type { Fecha, Hechos } from '@/lib/domain/tipos'
import type { LecturaCuenta } from '@/lib/carga/contratos'
import { leerHechos } from '@/lib/server/hechos'
import { claveDerivada, modoDemo } from '@/lib/server/sesion'
import { FaltaConfiguracion, configurado } from '@/lib/server/supabase'
import type { ArchivoGuardado } from './confirmacion'
import { conAusente, conCompraPendiente, hechosSinBase, type ActivoLocal } from './demo'

export type ModoCarga = 'real' | 'demo' | 'sin_base'

export function modoCarga(): ModoCarga {
  if (modoDemo()) return 'demo'
  return configurado() ? 'real' : 'sin_base'
}

export async function hechosParaCarga(locales: readonly ActivoLocal[]): Promise<{ hechos: Hechos; modo: ModoCarga }> {
  const modo = modoCarga()
  if (modo === 'demo' && process.env.PORTFOLIO_DEMO_ESCENARIO === 'ausente') {
    return { hechos: conAusente(hechosSinBase(locales)), modo }
  }
  if (modo === 'demo' && process.env.PORTFOLIO_DEMO_ESCENARIO === 'compra_pendiente') {
    return { hechos: conCompraPendiente(hechosSinBase(locales)), modo }
  }
  if (modo !== 'real') return { hechos: hechosSinBase(locales), modo }
  try {
    return { hechos: await leerHechos(), modo }
  } catch (e) {
    if (e instanceof FaltaConfiguracion) return { hechos: hechosSinBase(locales), modo: 'sin_base' }
    throw e
  }
}

export interface ContextoCarga {
  modo: ModoCarga
  hoy: Fecha
  /** Último tipo de cambio conocido, como ayuda (nunca como valor). */
  ultimo: { fecha: Fecha; ccl: string | null; cripto: string | null } | null
  cuentas: { id: number; nombre: string }[]
  /** Si la base no se pudo leer: qué pasó. La pantalla igual lee archivos. */
  aviso: string | null
}

export async function contextoCarga(): Promise<ContextoCarga> {
  const hoy = hoyCordoba()
  const modo = modoCarga()
  if (modo !== 'real') {
    return { modo, hoy, ultimo: null, cuentas: hechosSinBase().cuentas.map(({ id, nombre }) => ({ id, nombre })), aviso: null }
  }
  try {
    const h = await leerHechos()
    const tcs = h.tipos_cambio.filter((t) => t.fecha <= hoy && (t.ccl || t.cripto_venta))
    const t = tcs.at(-1) ?? null
    return {
      modo,
      hoy,
      ultimo: t ? { fecha: t.fecha, ccl: t.ccl?.toFixed() ?? null, cripto: t.cripto_venta?.toFixed() ?? null } : null,
      cuentas: h.cuentas.map(({ id, nombre }) => ({ id, nombre })),
      aviso: null,
    }
  } catch (e) {
    if (e instanceof FaltaConfiguracion) {
      return { modo: 'sin_base', hoy, ultimo: null, cuentas: hechosSinBase().cuentas.map(({ id, nombre }) => ({ id, nombre })), aviso: null }
    }
    return {
      modo,
      hoy,
      ultimo: null,
      cuentas: hechosSinBase().cuentas.map(({ id, nombre }) => ({ id, nombre })),
      aviso: `No pude leer la base (${e instanceof Error ? e.message : String(e)}). Podés leer los archivos igual; para guardar, recargá la página.`,
    }
  }
}

// ───────────── Firma de las lecturas ─────────────

// La clave es la de propósito "lectura" (src/lib/server/sesion.ts): derivada
// de APP_PASSWORD con PBKDF2 (o de SESSION_SECRET), distinta de la de la
// cookie. La firma viaja al navegador: con la clave en crudo, una firma
// alcanzaría para probar claves offline a toda velocidad.
const efimera = randomBytes(32)

async function claveFirma(): Promise<Buffer> {
  const k = await claveDerivada('lectura')
  return k ? Buffer.from(k) : efimera
}

export async function firmarLectura(lectura: LecturaCuenta, archivo: ArchivoGuardado | null): Promise<string> {
  return createHmac('sha256', await claveFirma()).update(JSON.stringify({ lectura, archivo })).digest('base64url')
}

export async function firmaValida(lectura: LecturaCuenta, archivo: ArchivoGuardado | null, firma: string): Promise<boolean> {
  const esperada = Buffer.from(await firmarLectura(lectura, archivo))
  const dada = Buffer.from(String(firma))
  return esperada.length === dada.length && timingSafeEqual(esperada, dada)
}
