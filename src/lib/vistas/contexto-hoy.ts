import 'server-only'

// Lo que traen Flujo y Pasivos a Hoy (entrega 4, plan §10.5): el excedente del
// mes con lo que declaraste, y en Atención la cuota del leasing y los
// vencimientos de bonos que llegan en 10 días o menos ("Hoy toca", visión 4.1).
// Se arma solo para la página de Hoy: el resto de las pantallas no paga estas
// lecturas. Si Flujo o Pasivos no se pueden leer, Hoy sigue igual y el
// excedente dice por qué no está.

import { sinDato, vista } from '@/lib/domain/calc'
import { fechaCorta, hoyCordoba } from '@/lib/domain/fechas'
import { leerHechos } from '@/lib/server/hechos'
import { leerPasivos } from '@/lib/server/hechos-pasivos'
import { modoDemo } from '@/lib/server/sesion'
import { resumenParaHoy } from './armar-flujo'
import type { Par, Pendiente } from './contratos'
import { vistaFlujo } from './flujo'
import { cuotasQueVencen } from './integracion-pasivos'

export interface ContextoHoy {
  /** El excedente del mes en curso, con lo que declaraste (Flujo); null sin ninguna carga. */
  excedente: { mes: string; valor: Par; href: string } | null
  /** Lo que se suma a Atención: la cuota del leasing y los vencimientos que llegan. */
  atencion: Pendiente[]
}

function sinFlujo(motivo: string): Par {
  const c = vista(sinDato(motivo))
  return { ars: c, usd: c }
}

export async function contextoHoy(): Promise<ContextoHoy> {
  const atencion: Pendiente[] = []
  let excedente: ContextoHoy['excedente'] = null
  try {
    const r = resumenParaHoy(await vistaFlujo())
    if (r) {
      excedente = { mes: r.mes, valor: r.excedente, href: r.href }
      for (const v of r.vencimientos) {
        atencion.push({
          id: `vence-${v.ticker}-${v.fecha}`,
          gravedad: 'media',
          titulo: `Vence ${v.ticker} el ${fechaCorta(v.fecha)}`,
          detalle: 'Lo que cobrás y adónde va, en Flujo y escenarios.',
          accion: { etiqueta: 'Ver el flujo', href: '/flujo' },
        })
      }
    }
  } catch (e) {
    const mes = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'America/Argentina/Cordoba' }).format(new Date())
    excedente = { mes, valor: sinFlujo(`No se pudo leer Flujo: ${e instanceof Error ? e.message : 'error'}.`), href: '/flujo' }
  }
  if (!modoDemo()) {
    try {
      const [h, hp] = await Promise.all([leerHechos(), leerPasivos()])
      for (const c of cuotasQueVencen(h, hp, hoyCordoba())) {
        atencion.push({
          id: `cuota-${c.pasivo_id}-${c.nro}`,
          gravedad: c.vencida ? 'alta' : 'media',
          titulo: c.texto,
          detalle: `Cuota ${c.nro} de ${c.nombre}: el monto, con su apertura, en Pasivos.`,
          accion: { etiqueta: 'Ver el cuadro de marcha', href: '/pasivos' },
        })
      }
    } catch {
      // Sin Pasivos legible, Atención sigue con lo suyo: la cuota la muestra /pasivos.
    }
  }
  return { excedente, atencion }
}
