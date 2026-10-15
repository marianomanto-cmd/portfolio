import 'server-only'

// Arma la vista del Balance: lee los hechos de Supabase (solo el servidor, con
// service_role) y llama al armador puro. En modo demo, los hechos inventados
// de ejemplo-balance.ts, con su estado (?demo=…).

import { hoyCordoba } from '@/lib/domain/fechas'
import type { Hechos } from '@/lib/domain/tipos'
import { leerPasivos } from '@/lib/server/hechos-pasivos'
import { modoDemo } from '@/lib/server/sesion'
import { armarBalance, type ExtrasBalance, type PedidoBalance } from './armar-balance'
import type { VistaBalance } from './contratos-balance'
import { ejemploBalance, varianteBalance } from './ejemplo-balance'
import { leerHechosVista } from './hechos-vista'
import { referenciaAl, segunCuadroAl } from './integracion-pasivos'

/**
 * Lo que aporta Pasivos (plan §10.3): lo que falta pagar según el contrato
 * (resumenLeasing) y la deuda según el cuadro de marcha (capitalSegunCuadro, a
 * la tasa del contrato), por pasivo_id y a cualquier fecha de carga.
 *
 * La deuda que resta es una sola en toda la app (D-131, revisión de la entrega
 * 4): la informada › la según el cuadro de marcha › la estimada. Es el mismo
 * orden que el motor (Hoy, Exposición, Evolución) y que Pasivos y Flujo.
 */
export async function extrasDePasivos(h: Hechos): Promise<ExtrasBalance> {
  const hp = await leerPasivos()
  if (hp.cuotas.length === 0) return {}
  return { segunCuadro: segunCuadroAl(h, hp), referencia: referenciaAl(h, hp) }
}

export async function vistaBalance(pedido: PedidoBalance & { demo?: unknown } = {}): Promise<VistaBalance> {
  if (modoDemo()) return ejemploBalance(varianteBalance(pedido.demo), pedido)
  const h = await leerHechosVista()
  return armarBalance(h, hoyCordoba(), pedido, await extrasDePasivos(h))
}
