import 'server-only'

// Flujo y escenarios: lee los hechos y lo de Flujo, y arma la vista (plan §6
// D.3). En modo demo, hechos inventados más lo "guardado" en la cookie del
// navegador (ejemplo-flujo.ts).

import { cookies } from 'next/headers'
import { hoyCordoba } from '@/lib/domain/fechas'
import { leerFlujo } from '@/lib/server/hechos-flujo'
import { modoDemo } from '@/lib/server/sesion'
import { armarFlujo } from './armar-flujo'
import type { VistaFlujo } from './contratos-flujo'
import { DEMO_VACIO, ejemploFlujo, estadoDemoFlujo, type DemoGuardado } from './ejemplo-flujo'
import { leerHechosVista } from './hechos-vista'

export const COOKIE_DEMO_FLUJO = 'demo_flujo'
/** Los escenarios del demo van en su propia cookie: cada cookie entra en 4 KB. */
export const COOKIE_DEMO_ESCENARIOS = 'demo_flujo_esc'
/** Lo que entra en el demo sin pasar los 4 KB de cada cookie. */
export const DEMO_MAX = { flujos: 5, escenarios: 2 }

export function leerDemoGuardado(valor: string | undefined): DemoGuardado {
  if (!valor) return DEMO_VACIO
  try {
    const d = JSON.parse(Buffer.from(valor, 'base64url').toString('utf8')) as Partial<DemoGuardado>
    return {
      flujos: Array.isArray(d.flujos) ? d.flujos.slice(0, 12) : [],
      escenarios: Array.isArray(d.escenarios) ? d.escenarios.slice(0, 6) : [],
      recordados: d.recordados && typeof d.recordados === 'object' ? d.recordados : {},
    }
  } catch {
    return DEMO_VACIO
  }
}

export function escribirDemoGuardado(d: DemoGuardado): string {
  return Buffer.from(JSON.stringify(d), 'utf8').toString('base64url')
}

/** Lo guardado en el demo, en dos cookies: lo cargado y los recordados en una, los escenarios en otra. */
export function partirDemoGuardado(d: DemoGuardado): { flujos: string; escenarios: string } {
  return {
    flujos: escribirDemoGuardado({
      flujos: d.flujos.slice(-DEMO_MAX.flujos).map((f) => ({ ...f, notas: f.notas ? f.notas.slice(0, 60) : null, creado_en: null })),
      escenarios: [],
      recordados: d.recordados,
    }),
    escenarios: escribirDemoGuardado({ flujos: [], escenarios: d.escenarios.slice(-DEMO_MAX.escenarios), recordados: {} }),
  }
}

export function unirDemoGuardado(flujos: string | undefined, escenarios: string | undefined): DemoGuardado {
  const a = leerDemoGuardado(flujos)
  const b = leerDemoGuardado(escenarios)
  return { flujos: a.flujos, escenarios: b.escenarios, recordados: a.recordados }
}

export async function demoGuardado(): Promise<DemoGuardado> {
  const c = await cookies()
  return unirDemoGuardado(c.get(COOKIE_DEMO_FLUJO)?.value, c.get(COOKIE_DEMO_ESCENARIOS)?.value)
}

export async function vistaFlujo(demo?: unknown): Promise<VistaFlujo> {
  if (modoDemo()) return ejemploFlujo(estadoDemoFlujo(demo), await demoGuardado())
  const [h, d] = await Promise.all([leerHechosVista(), leerFlujo()])
  return armarFlujo(h, d, hoyCordoba())
}
