import 'server-only'

// Lo que traen Flujo y Pasivos a Hoy (entrega 4, plan §10.5) y lo que suma el
// rediseño del 15/10 (D-157): el excedente del mes con lo que declaraste y sus
// partes (la barra "gastos fijos · cuota · lo que sobra"), Atención con la
// cuota del leasing y los vencimientos de bonos que llegan en 10 días o menos
// ("Hoy toca", visión 4.1), "Próximos 30 días" y el patrimonio neto de los
// últimos 12 meses. Se arma solo para la página de Hoy: el resto de las
// pantallas no paga estas lecturas. Si Flujo, Pasivos o la historia no se
// pueden leer, Hoy sigue igual y cada bloque dice por qué no está.

import { sinDato, vista } from '@/lib/domain/calc'
import type { BaseProyeccion } from '@/lib/domain/flujo/tipos'
import { fechaCorta, hoyCordoba } from '@/lib/domain/fechas'
import { leerHechos } from '@/lib/server/hechos'
import { leerPasivos } from '@/lib/server/hechos-pasivos'
import { modoDemo } from '@/lib/server/sesion'
import { resumenParaHoy } from './armar-flujo'
import { proximosDias, seriePatrimonio } from './armar-hoy'
import type { Par, Pendiente } from './contratos'
import type { EventoProximo, SeriePatrimonio } from './contratos-hoy'
import { hechosDeVariante, type VarianteDemo } from './ejemplo'
import { vistaFlujo } from './flujo'
import { leerHechosVista } from './hechos-vista'
import { cuotasQueVencen } from './integracion-pasivos'

export interface ExcedenteHoy {
  mes: string
  valor: Par
  href: string
  /** Sus partes (el mes en curso de Flujo), para la barra; null si Flujo no se pudo leer. */
  ingresos: Par | null
  gastos: Par | null
  cuota: Par | null
  /** Qué ya es real (cargado con Cargar ingreso o Cargar gasto) y qué sigue proyectado. */
  reales: { ingresos: boolean; gastos: boolean } | null
}

export interface ContextoHoy {
  /** El excedente del mes en curso, con lo que declaraste (Flujo); null sin ninguna carga. */
  excedente: ExcedenteHoy | null
  /** Lo que se suma a Atención: la cuota del leasing y los vencimientos que llegan. */
  atencion: Pendiente[]
  /** Lo que pasa en los próximos 30 días, con fecha (cuotas, vencimientos, el cierre del mes). */
  proximos: EventoProximo[]
  /** El patrimonio neto en cada fecha de carga de los últimos 12 meses. */
  serie: SeriePatrimonio
}

function sinFlujo(motivo: string): Par {
  const c = vista(sinDato(motivo))
  return { ars: c, usd: c }
}

function serieVacia(motivo: string): SeriePatrimonio {
  const c = vista(sinDato(motivo))
  return { puntos: [], periodo: null, variacion: { ars: c, usd: c }, ccl: null, motivo }
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'error')

/**
 * `variante`: el estado del modo demo (?demo=…), para que la serie salga de los
 * mismos hechos que la vista. `cargaPendiente`: ya cerró BYMA y no cargaste
 * (D-127): va primero en "Próximos 30 días".
 */
export async function contextoHoy(o: { variante?: VarianteDemo | null; cargaPendiente?: boolean } = {}): Promise<ContextoHoy> {
  const demo = modoDemo()
  const atencion: Pendiente[] = []
  let excedente: ContextoHoy['excedente'] = null
  let base: BaseProyeccion | null = null
  try {
    const vf = await vistaFlujo()
    base = vf.base
    const r = resumenParaHoy(vf)
    if (r && vf.mes_actual) {
      const m = vf.mes_actual
      excedente = { mes: r.mes, valor: r.excedente, href: r.href, ingresos: m.ingresos, gastos: m.gastos, cuota: m.cuota, reales: m.reales }
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
    excedente = { mes, valor: sinFlujo(`No se pudo leer Flujo: ${mensaje(e)}.`), href: '/flujo', ingresos: null, gastos: null, cuota: null, reales: null }
  }
  if (!demo) {
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

  let serie: SeriePatrimonio
  let hoy: string
  try {
    const { hechos, hoy: dia } = demo ? hechosDeVariante(o.variante ?? null) : { hechos: await leerHechosVista(), hoy: hoyCordoba() }
    hoy = dia
    serie = seriePatrimonio(hechos, dia)
  } catch (e) {
    hoy = demo ? hechosDeVariante(o.variante ?? null).hoy : hoyCordoba()
    serie = serieVacia(`No se pudo leer tu historia: ${mensaje(e)}.`)
  }
  return { excedente, atencion, proximos: proximosDias(base, hoy, { cargaPendiente: o.cargaPendiente }), serie }
}
