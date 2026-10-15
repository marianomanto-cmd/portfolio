// Flujo y escenarios en modo demo (PORTFOLIO_DEMO=1; D-24). TODOS LOS NÚMEROS
// SON INVENTADOS: la cartera es la del ejemplo de Hoy (ejemplo.ts) y los
// ingresos, gastos, cuotas y pagos al vencimiento de acá no son los del dueño
// ni una propuesta de nada. Se arman como hechos y pasan por el mismo armador
// que los datos reales, así cada cifra del demo trae su traza de verdad.
//
// Estados (?demo=): vacio (sin cargas), sin-ingresos, parcial (sin cripto y sin
// el pago al vencimiento de las letras), completo (por defecto) y comparar
// (con tres escenarios guardados).
//
// Lo que se "guarda" en demo (Cargar ingreso, Deshacer, Anular, escenarios)
// vive en una cookie del navegador (DemoGuardado): así el flujo se puede
// probar de punta a punta sin base, y cada navegador ve lo suyo.

import { Decimal } from '@/lib/domain/dinero'
import type { Cuota } from '@/lib/domain/pasivos/tipos'
import type { RecurrenteBase, Supuestos } from '@/lib/domain/flujo/tipos'
import { supuestosVacios } from '@/lib/domain/flujo/supuestos'
import type { Hechos } from '@/lib/domain/tipos'
import type { DatosFlujo, EscenarioGuardado, FlujoCargado } from '@/lib/server/hechos-flujo'
import { armarFlujo } from './armar-flujo'
import type { EstadoDemoFlujo, VistaFlujo } from './contratos-flujo'
import { HOY_EJEMPLO, hechosEjemplo, hechosVacios } from './ejemplo'

const D = (x: string | number) => new Decimal(x)

export function estadoDemoFlujo(v: unknown): EstadoDemoFlujo {
  return v === 'vacio' || v === 'sin-ingresos' || v === 'parcial' || v === 'comparar' ? v : 'completo'
}

/** Ingresos y gastos declarados (inventados). */
export const RECURRENTES_EJEMPLO: RecurrenteBase[] = [
  { id: 1, sentido: 'ingreso', concepto: 'Honorarios del exterior', moneda: 'USD', monto: '3800', vigente_desde: '2026-10-01', vigente_hasta: null, frecuencia: 'mensual', primer_mes: null, pagador: null, naturaleza: 'honorarios' },
  { id: 2, sentido: 'ingreso', concepto: 'Fijo en pesos', moneda: 'ARS', monto: '850000', vigente_desde: '2026-10-01', vigente_hasta: null, frecuencia: 'mensual', primer_mes: null, pagador: null, naturaleza: 'otro' },
  { id: 3, sentido: 'gasto', concepto: 'Gastos de la casa', moneda: 'ARS', monto: '2450000', vigente_desde: '2026-10-01', vigente_hasta: null, frecuencia: 'mensual', primer_mes: null, pagador: 'titular', naturaleza: null },
  { id: 4, sentido: 'gasto', concepto: 'Seguro del hogar', moneda: 'ARS', monto: '180000', vigente_desde: '2026-10-01', vigente_hasta: null, frecuencia: 'trimestral', primer_mes: '2026-11-01', pagador: 'titular', naturaleza: null },
]

/** El cuadro de marcha inventado del leasing del ejemplo: 48 cuotas, la 1 el 17/09/2025; 13 pagadas. */
export function cuotasEjemplo(): Cuota[] {
  const out: Cuota[] = []
  for (let nro = 1; nro <= 48; nro++) {
    const t = 2025 * 12 + 7 + nro // agosto de 2025 + nro meses
    const fecha = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-17`
    const pagada = nro <= 13
    out.push({
      pasivo_id: 1,
      nro,
      fecha_vencimiento: fecha,
      periodo: `${fecha.slice(0, 7)}-01`,
      canon_neto: D(1_000_000),
      iva_canon: D(226_800),
      seguro: D(80_000),
      otros_conceptos: D(32_400),
      estado: pagada ? 'facturada' : 'proyectada',
      fuente_canon: pagada ? 'comprobante' : 'contrato',
      fuente_seguro: pagada ? 'comprobante' : 'supuesto',
      fuente_otros: pagada ? 'comprobante' : 'a_confirmar',
      pagada,
      fecha_pago: null,
      monto_pagado: null,
      cuenta_pago_id: null,
      ccl_del_dia_pago: null,
      ccl_fuente: null,
      pagador: null,
      carga_id: 1,
      notas: null,
    })
  }
  return out
}

/** Pago al vencimiento por 1 VN de las letras del ejemplo (inventado: "aviso de licitación de ejemplo"). */
const FLUJOS_BONO_EJEMPLO: DatosFlujo['flujos_bono'] = [
  { activo_id: 3, fecha: '2026-11-13', interes: D('0.1046'), amortizacion: D(1), fuente: 'aviso de licitación (ejemplo)' },
  { activo_id: 4, fecha: '2027-06-30', interes: D('0.3180'), amortizacion: D(1), fuente: 'aviso de licitación (ejemplo)' },
]

function sup(f: (s: Supuestos) => void): Supuestos {
  const s = supuestosVacios()
  s.ingreso_usd.push({ dir: null, valor: null, desde_mes: 4, crecimiento_anual: null, ajuste_mensual: null })
  s.ingreso_pesos.push({ dir: null, valor: null, desde_mes: 4, crecimiento_anual: null, ajuste_mensual: null })
  s.dual.TXMJ0 = { dir: null, valor: null }
  f(s)
  return s
}

const igual = { dir: 'igual' as const, valor: null }

function todoIgual(s: Supuestos) {
  s.horizonte_meses = 24
  s.devaluacion = [{ ...igual, hasta_mes: null }]
  s.inflacion = [{ ...igual, hasta_mes: null }]
  s.brecha_cripto = { ...igual }
  s.ingreso_usd = s.ingreso_usd.map((t) => ({ ...t, ...igual }))
  s.ingreso_pesos = s.ingreso_pesos.map((t) => ({ ...t, ...igual }))
  s.gastos = { ...igual, atado_inflacion: false }
  s.retorno = { cedear: { ...igual }, accion_local: { ...igual }, liquidez_pesos: { ...igual } }
  s.tem_renovacion = { ...igual }
  s.dual.TXMJ0 = { ...igual }
  s.casa = { ...igual }
  s.camioneta = { ...igual }
}

/** Tres escenarios guardados (inventados) para el estado "comparar". */
function escenariosEjemplo(): EscenarioGuardado[] {
  return [
    { id: 1, nombre: 'Todo igual', supuestos: sup(todoIgual), archivado: false, actualizado_en: '2026-10-14T22:00:00.000Z' },
    {
      id: 2,
      nombre: 'Dólar arriba',
      supuestos: sup((s) => {
        todoIgual(s)
        s.devaluacion = [{ dir: 'sube', valor: '2', hasta_mes: null }]
        s.retorno.cedear = { dir: 'sube', valor: '8' }
      }),
      archivado: false,
      actualizado_en: '2026-10-14T22:05:00.000Z',
    },
    {
      id: 3,
      nombre: 'Ingreso baja en feb-27',
      supuestos: sup((s) => {
        todoIgual(s)
        s.ingreso_usd[1] = { ...s.ingreso_usd[1], dir: 'baja', valor: '30' }
      }),
      archivado: false,
      actualizado_en: '2026-10-14T22:10:00.000Z',
    },
  ]
}

/** Lo que se guardó en modo demo (en una cookie del navegador). */
export interface DemoGuardado {
  flujos: FlujoCargado[]
  escenarios: EscenarioGuardado[]
  recordados: Record<string, string>
}

export const DEMO_VACIO: DemoGuardado = { flujos: [], escenarios: [], recordados: {} }

/** Hechos y datos de Flujo del estado demo pedido. */
export function datosEjemplo(estado: EstadoDemoFlujo, guardado: DemoGuardado = DEMO_VACIO): { h: Hechos; d: DatosFlujo } {
  if (estado === 'vacio') {
    return { h: hechosVacios(), d: { recurrentes: [], flujos_bono: [], escenarios: [], recordados: {}, flujos: [], leasing: { contratos: [], cuotas: [], cargos: [] } } }
  }
  const h = hechosEjemplo()
  if (estado === 'parcial') for (const t of h.tipos_cambio) t.cripto_venta = null
  const contrato = {
    id: 1,
    nombre: 'Leasing de la camioneta',
    tipo: 'leasing' as const,
    moneda: 'ARS' as const,
    fecha_inicio: '2025-08-17',
    cuotas_totales: 48,
    monto_financiado_neto: null,
    anticipo_neto: null,
    opcion_compra_neto: null,
    opcion_compra_fecha: '2029-08-17',
    valor_bien: null,
    alicuota_ganancias: null,
    fecha_desembolso: null,
    pagador_habitual: null,
    reintegra_iva: null,
    notas: null,
  }
  return {
    h,
    d: {
      recurrentes: estado === 'sin-ingresos' ? [] : RECURRENTES_EJEMPLO,
      flujos_bono: estado === 'parcial' ? [] : FLUJOS_BONO_EJEMPLO,
      escenarios: [...(estado === 'comparar' ? escenariosEjemplo() : []), ...guardado.escenarios],
      // Copias: quien use estos datos puede tocarlos sin cambiar lo guardado (ni DEMO_VACIO, que es de todos).
      recordados: { ...guardado.recordados },
      flujos: guardado.flujos.map((f) => ({ ...f })),
      leasing: { contratos: [contrato], cuotas: cuotasEjemplo(), cargos: [] },
    },
  }
}

export function ejemploFlujo(estado: EstadoDemoFlujo, guardado: DemoGuardado = DEMO_VACIO): VistaFlujo {
  const { h, d } = datosEjemplo(estado, guardado)
  return armarFlujo(h, d, HOY_EJEMPLO, estado)
}
