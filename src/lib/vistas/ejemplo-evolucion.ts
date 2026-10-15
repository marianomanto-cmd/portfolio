// Evolución y PnL en modo demo (PORTFOLIO_DEMO=1), con ?demo=vacio|un-dia|semana|mes.
//
// TODOS LOS NÚMEROS SON INVENTADOS (D-24). Arranca de los hechos de ejemplo de
// la app (src/lib/vistas/ejemplo.ts, del 01/10 al 14/10) y, para "mes" (y por
// defecto), les suma un mes inventado hasta el vie 13/11: una venta parcial,
// un dividendo, un aporte, la cuota del leasing pagada desde Mercado Pago, una
// compra, una tasación nueva de la casa y el vencimiento de la LECAP. Todo pasa
// por el mismo motor que con datos reales, así que cada cifra trae su traza.
// Los ingresos y gastos declarados, lo cargado con "Cargar ingreso", la
// apertura de las cuotas y la proyección también son inventados: muestran el
// estado de resultados y el bloque Futuro completos hasta la integración.

import { calc, type DobleCalc, type Etiqueta } from '@/lib/domain/calc'
import { Decimal } from '@/lib/domain/dinero'
import type { FlujoReal, MesProyectado, ProyeccionVista, RecurrenteBase } from '@/lib/domain/flujo/tipos'
import type { AperturaCuota, Cuota } from '@/lib/domain/pasivos/tipos'
import type { Fecha, Hechos } from '@/lib/domain/tipos'
import { serieEvolucion } from '@/lib/domain/resultados'
import { fechasDeCarga } from '@/lib/domain/variacion'
import { armarEvolucion, futuroVista, SIN_ENTRADAS, type EntradasEvolucion } from './armar-evolucion'
import type { ParametrosEvolucion, VistaEvolucion } from './contratos-evolucion'
import { hechosEjemplo, hechosVacios, HOY_EJEMPLO } from './ejemplo'

export type DemoEvolucion = 'vacio' | 'un-dia' | 'semana' | 'mes'

export function demoEvolucion(x: unknown): DemoEvolucion | null {
  return x === 'vacio' || x === 'un-dia' || x === 'semana' || x === 'mes' ? x : null
}

const D = (x: string | number) => new Decimal(x)

// ───────────── Un mes más de cargas (inventado) ─────────────

const DIAS_MES: Fecha[] = [
  '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27',
  '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09',
  '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13',
]
export const HOY_MES: Fecha = '2026-11-13'

/** Un paseo determinístico: ±1% por día, con una tendencia propia por serie (inventado). */
function paseo(inicio: string, n: number, semilla: number, tendencia: number, decimales: number): string[] {
  const out: string[] = []
  let x = D(inicio)
  for (let i = 1; i <= n; i++) {
    const ruido = ((semilla * (i + 3) * 7919) % 41) - 20 // −20 … 20
    x = x.times(D(1).plus(D(ruido).div(2000)).plus(D(tendencia).div(10000))).toDecimalPlaces(decimales, Decimal.ROUND_HALF_EVEN)
    out.push(x.toFixed(decimales))
  }
  return out
}

const CARGA_MES = 200
const idCarga = (k: number) => CARGA_MES + k

function hechosMes(): Hechos {
  const h = hechosEjemplo()
  const n = DIAS_MES.length
  const ccl = paseo('1548.20', n, 3, 18, 2)
  const cripto = ccl.map((c) => D(c).times('0.9952').toFixed(2))
  const precios: Record<number, string[]> = {
    1: paseo('35150', n, 5, 22, 0),
    2: paseo('52300', n, 7, 30, 0),
    3: paseo('1.0852', n - 1, 1, 9, 4), // la LECAP vence el 13/11: sin precio ese día
    4: paseo('1.1240', n, 2, 10, 4),
    5: paseo('4.8120', n, 1, 12, 4),
    6: paseo('1.0310', n, 4, 7, 4),
  }
  DIAS_MES.forEach((fecha, k) => {
    h.tipos_cambio.push({ fecha, ccl: D(ccl[k]), mep: null, cripto_venta: D(cripto[k]), oficial: null, carga_id: idCarga(k) })
    for (const [id, serie] of Object.entries(precios)) if (serie[k]) h.cotizaciones.push({ fecha, activo_id: Number(id), precio_pesos: D(serie[k]), precio_usd_subyacente: null, carga_id: idCarga(k) })
    h.cargas.push({ id: idCarga(k), lote: null, fecha, cuenta_id: null, origen: 'manual', archivo_path: null, estado: 'vigente', creado_en: `${fecha}T22:00:00.000Z`, reemplaza_a: null, lector: null, tiempo_activo_ms: 40_000 })
  })
  const k = (f: Fecha) => DIAS_MES.indexOf(f)
  const precioDe = (id: number, f: Fecha) => D(precios[id][k(f)])
  const cclDe = (f: Fecha) => D(ccl[k(f)])
  let idOp = 100
  // Venta parcial de SPY el 22/10, un dividendo de SPY el 27/10, una compra de YPF el 06/11 y el vencimiento de la LECAP el 13/11.
  const venta = D(400).times(precioDe(1, '2026-10-22'))
  const compra = D(100).times(precioDe(2, '2026-11-06'))
  h.operaciones.push(
    { id: idOp++, fecha: '2026-10-22', fecha_origen: null, cuenta_id: 1, activo_id: 1, tipo: 'venta', cantidad: D(400), moneda: 'ARS', precio: precioDe(1, '2026-10-22'), importe: venta, comisiones: D(0), ccl_del_dia: cclDe('2026-10-22'), carga_id: idCarga(k('2026-10-22')), notas: null },
    { id: idOp++, fecha: '2026-10-27', fecha_origen: null, cuenta_id: 1, activo_id: 1, tipo: 'renta', cantidad: D(0), moneda: 'USD', precio: null, importe: D('18.40'), comisiones: D(0), ccl_del_dia: cclDe('2026-10-27'), carga_id: idCarga(k('2026-10-27')), notas: 'dividendo' },
    { id: idOp++, fecha: '2026-11-06', fecha_origen: null, cuenta_id: 1, activo_id: 2, tipo: 'compra', cantidad: D(100), moneda: 'ARS', precio: precioDe(2, '2026-11-06'), importe: compra, comisiones: D(0), ccl_del_dia: cclDe('2026-11-06'), carga_id: idCarga(k('2026-11-06')), notas: null },
    { id: idOp++, fecha: '2026-11-13', fecha_origen: null, cuenta_id: 2, activo_id: 3, tipo: 'vencimiento', cantidad: D(11_500_000), moneda: 'ARS', precio: D('1.1040'), importe: D(11_500_000).times('1.1040'), comisiones: D(0), ccl_del_dia: cclDe('2026-11-13'), carga_id: idCarga(k('2026-11-13')), notas: null },
  )
  // Un aporte a IEB el 20/10: un ingreso en dólares vendido al cripto (lo mismo que se cargó con "Cargar ingreso").
  h.movimientos.push({
    id: 50,
    fecha: '2026-10-20',
    fecha_acreditacion: null,
    tipo: 'aporte',
    cuenta_origen_id: null,
    cuenta_destino_id: 1,
    moneda_origen: 'USD',
    monto_origen: D(2000),
    moneda_destino: 'ARS',
    monto_destino: D(3_000_000),
    tc_aplicado: D(1500),
    impuesto: D(0),
    carga_id: idCarga(k('2026-10-20')),
    notas: 'ingreso mensual',
  })
  // Saldos: IEB en pesos recibe el aporte y la venta y paga la compra; en dólares, el dividendo; Mercado Pago paga la cuota del 19/10.
  let iebArs = D(-185_000)
  let iebUsd = D(4200)
  let mp = D(4_912_300)
  DIAS_MES.forEach((fecha, i) => {
    if (fecha === '2026-10-20') iebArs = iebArs.plus(3_000_000)
    if (fecha === '2026-10-22') iebArs = iebArs.plus(venta)
    if (fecha === '2026-11-06') iebArs = iebArs.minus(compra)
    if (fecha === '2026-10-27') iebUsd = iebUsd.plus('18.40')
    mp = mp.plus(3_650)
    if (fecha === '2026-10-19') mp = mp.minus(1_339_200)
    h.saldos.push(
      { fecha, cuenta_id: 1, moneda: 'ARS', monto: iebArs, carga_id: idCarga(i) },
      { fecha, cuenta_id: 1, moneda: 'USD', monto: iebUsd, carga_id: idCarga(i) },
      { fecha, cuenta_id: 3, moneda: 'ARS', monto: mp, carga_id: idCarga(i) },
    )
  })
  // La leasera informa el capital al 31/10 y la casa tiene una tasación nueva el 05/11.
  h.pasivo_saldos.push({ pasivo_id: 1, fecha: '2026-10-31', capital_pendiente: D(20_710_000), naturaleza: 'informado', fuente: null, carga_id: idCarga(k('2026-10-30')) })
  h.valuaciones.push({ bien_id: 1, fecha: '2026-11-05', valor: D(205_000), fuente: 'tasación de una inmobiliaria', carga_id: idCarga(k('2026-11-05')) })
  // Galicia: su caja en pesos también se sigue (inventada), así el vencimiento de la LECAP del 13/11 cobra adentro
  // de la app. Si no, salía como un retiro de $ 12,7 M y el "no explicado" del estado de resultados era casi todo eso.
  const cobroLecap = D(11_500_000).times('1.1040')
  for (const fecha of fechasDeCarga(h)) {
    const carga = h.cargas.find((c) => c.fecha === fecha)
    if (carga) h.saldos.push({ fecha, cuenta_id: 2, moneda: 'ARS', monto: fecha >= '2026-11-13' ? D(250_000).plus(cobroLecap) : D(250_000), carga_id: carga.id })
  }
  return h
}

/** Solo el día cero (01/10): el estado que el dueño ve con una sola carga, con la deuda del leasing estimada como en producción (D-154). */
function hechosUnDia(): Hechos {
  const h = hechosEjemplo()
  const dia = '2026-10-01'
  return {
    ...h,
    pasivo_saldos: h.pasivo_saldos.map((s) => ({ ...s, naturaleza: 'estimado' as const, fuente: 'estimado provisorio que aprobaste (ejemplo inventado)' })),
    tipos_cambio: h.tipos_cambio.filter((t) => t.fecha <= dia),
    cotizaciones: h.cotizaciones.filter((c) => c.fecha <= dia),
    saldos: h.saldos.filter((s) => s.fecha <= dia),
    operaciones: h.operaciones.filter((o) => o.fecha <= dia),
    cargas: h.cargas.filter((c) => c.fecha <= dia),
  }
}

// ───────────── Lo que traen Pasivos y Flujo (inventado) ─────────────

const RECURRENTES: RecurrenteBase[] = [
  { id: 1, sentido: 'ingreso', concepto: 'Ingreso en dólares', moneda: 'USD', monto: '4000', vigente_desde: '2026-10-01', vigente_hasta: null, frecuencia: 'mensual', primer_mes: null, pagador: null, naturaleza: 'honorarios' },
  { id: 2, sentido: 'ingreso', concepto: 'Ingreso fijo en pesos', moneda: 'ARS', monto: '2000000', vigente_desde: '2026-10-01', vigente_hasta: null, frecuencia: 'mensual', primer_mes: null, pagador: null, naturaleza: 'sueldo' },
  { id: 3, sentido: 'gasto', concepto: 'Gastos fijos', moneda: 'ARS', monto: '3100000', vigente_desde: '2026-10-01', vigente_hasta: null, frecuencia: 'mensual', primer_mes: null, pagador: 'titular', naturaleza: null },
]

const FLUJOS: FlujoReal[] = [
  { id: 1, fecha: '2026-10-20', sentido: 'ingreso', concepto: 'mensual', moneda: 'USD', monto: '2000', cuenta_id: 1, cripto_usado: '1500', pesos_recibidos: '3000000', anulado: false, carga_id: idCarga(3), notas: null },
  { id: 2, fecha: '2026-10-28', sentido: 'gasto', concepto: 'extraordinario', moneda: 'ARS', monto: '450000', cuenta_id: null, cripto_usado: null, pesos_recibidos: null, anulado: false, carga_id: idCarga(9), notas: 'service de la camioneta' },
  { id: 3, fecha: '2026-11-05', sentido: 'ingreso', concepto: 'extraordinario', moneda: 'ARS', monto: '800000', cuenta_id: null, cripto_usado: null, pesos_recibidos: null, anulado: false, carga_id: idCarga(15), notas: 'un trabajo puntual' },
  { id: 4, fecha: '2026-11-10', sentido: 'ingreso', concepto: 'mensual', moneda: 'USD', monto: '4000', cuenta_id: null, cripto_usado: '1560', pesos_recibidos: '6240000', anulado: false, carga_id: idCarga(18), notas: null },
]

function dobleCalc(ars: string, usd: string, nombre: string, etiquetas: Etiqueta[] = []): DobleCalc {
  return {
    ars: calc(D(ars), `${nombre} (ejemplo inventado)`, [], { etiquetas, explicacion: 'Sale de la apertura de la cuota que calcula Pasivos (ejemplo inventado del modo demo).' }),
    usd: calc(D(usd), `${nombre} (ejemplo inventado)`, [], { etiquetas, explicacion: 'Sale de la apertura de la cuota que calcula Pasivos (ejemplo inventado del modo demo).' }),
  }
}

function aperturaCuota(nro: number, fecha: Fecha, ccl: string, interes: string, etiquetas: Etiqueta[] = []): AperturaCuota {
  const usd = (x: string) => D(x).div(ccl).toFixed(2)
  const canon = D(1_000_000)
  const amort = canon.minus(interes).toFixed()
  return {
    pasivo_id: 1,
    nro,
    fecha_vencimiento: fecha,
    amortizacion: dobleCalc(amort, usd(amort), `Amortización de la cuota ${nro}`, ['estimado', ...etiquetas]),
    interes: dobleCalc(interes, usd(interes), `Interés implícito de la cuota ${nro}`, ['estimado', ...etiquetas]),
    iva: dobleCalc('226800', usd('226800'), `IVA de la cuota ${nro}`, etiquetas),
    seguro: dobleCalc('80000', usd('80000'), `Seguro de la cuota ${nro}`, etiquetas),
    percepcion: dobleCalc('32400', usd('32400'), `Percepción de la cuota ${nro}`, etiquetas),
    cargos: dobleCalc('0', '0', `Cargos de la cuota ${nro}`, etiquetas),
    total: dobleCalc('1339200', usd('1339200'), `Cuota ${nro}`, etiquetas),
    gasto: dobleCalc(D(1_339_200).minus(amort).toFixed(), usd(D(1_339_200).minus(amort).toFixed()), `Gasto de la cuota ${nro}`, ['estimado', ...etiquetas]),
  }
}

const LEASING: AperturaCuota[] = [aperturaCuota(15, '2026-10-17', '1552.60', '318400'), aperturaCuota(16, '2026-11-17', '1580.00', '309200', ['proyectado'])]

function cuotasPagadas(): Cuota[] {
  const base = {
    pasivo_id: 1,
    periodo: null,
    canon_neto: D(1_000_000),
    iva_canon: D(226_800),
    seguro: D(80_000),
    otros_conceptos: D(32_400),
    estado: 'facturada' as const,
    fuente_canon: 'comprobante' as const,
    fuente_seguro: 'comprobante' as const,
    fuente_otros: 'comprobante' as const,
    pagada: true,
    monto_pagado: null,
    ccl_del_dia_pago: null,
    ccl_fuente: null,
    pagador: 'titular' as const,
    carga_id: 90,
    notas: null,
  }
  return [
    // La 14 se pagó por débito automático y la planilla no trae la fecha: no entra al puente, y se dice.
    { ...base, nro: 14, fecha_vencimiento: '2026-09-17', fecha_pago: null, cuenta_pago_id: null },
    { ...base, nro: 15, fecha_vencimiento: '2026-10-17', fecha_pago: '2026-10-19', cuenta_pago_id: 3 },
  ]
}

/** Una proyección inventada de 12 meses, como la que va a mandar Flujo: el patrimonio crece con el excedente y los supuestos. */
function proyeccionEjemplo(h: Hechos, hoy: Fecha, financieroArs: string | null, financieroUsd: string | null): ProyeccionVista {
  const meses: MesProyectado[] = []
  let ars = D(financieroArs ?? '0')
  let usd = D(financieroUsd ?? '0')
  let ccl = h.tipos_cambio.filter((t) => t.ccl !== null).at(-1)?.ccl ?? D('1500')
  let mes = `${hoy.slice(0, 7)}-01`
  const nulo = { ars: null, usd: null }
  for (let i = 1; i <= 12; i++) {
    const [a, m] = mes.split('-').map(Number)
    mes = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`
    const cclNuevo = ccl.times('1.015').toDecimalPlaces(2)
    const aportes = D(2_420_000)
    const activoArs = ars.times('0.006').toDecimalPlaces(2)
    const tcArs = usd.times(cclNuevo.minus(ccl)).times('0.62').toDecimalPlaces(2)
    const nuevoArs = ars.plus(aportes).plus(activoArs).plus(tcArs)
    const nuevoUsd = nuevoArs.div(cclNuevo).toDecimalPlaces(2)
    const aportesUsd = aportes.div(cclNuevo).toDecimalPlaces(2)
    const activoUsd = activoArs.div(cclNuevo).toDecimalPlaces(2)
    const tcUsd = nuevoUsd.minus(usd).minus(aportesUsd).minus(activoUsd)
    meses.push({
      mes,
      real: false,
      ccl: cclNuevo.toFixed(),
      ingresos: nulo,
      gastos: nulo,
      cuota: nulo,
      cuota_gasto: nulo,
      vencimientos: nulo,
      excedente: { ars: aportes.toFixed(), usd: aportesUsd.toFixed() },
      invertido: { ars: aportes.toFixed(), usd: aportesUsd.toFixed() },
      financiero: { ars: nuevoArs.toFixed(), usd: nuevoUsd.toFixed() },
      neto_sin_financiados: nulo,
      deuda_leasing: nulo,
      neto_completo: nulo,
      pnl: { aportes: { ars: aportes.toFixed(), usd: aportesUsd.toFixed() }, activo: { ars: activoArs.toFixed(), usd: activoUsd.toFixed() }, tc: { ars: tcArs.toFixed(), usd: tcUsd.toFixed() } },
      etiquetas: ['supuesto', 'proyectado'],
    })
    ars = nuevoArs
    usd = nuevoUsd
    ccl = cclNuevo
  }
  return { escenario: { id: 1, nombre: 'Igual con dólar que sube (ejemplo)' }, proyeccion: { estado: 'lista', faltan: [], meses } }
}

export function ejemploEvolucion(p: ParametrosEvolucion, demo: DemoEvolucion | null): VistaEvolucion {
  if (demo === 'vacio') return armarEvolucion(hechosVacios(), HOY_EJEMPLO, p)
  if (demo === 'un-dia') {
    const entradas: EntradasEvolucion = { ...SIN_ENTRADAS, recurrentes: RECURRENTES, leasing: LEASING }
    return armarEvolucion(hechosUnDia(), '2026-10-01', p, entradas)
  }
  const [h, hoy] = demo === 'semana' ? [hechosEjemplo(), HOY_EJEMPLO] : [hechosMes(), HOY_MES]
  const params: ParametrosEvolucion = demo === 'semana' && p.periodo === 'todo' ? { ...p, periodo: 'semana' } : demo === 'mes' && p.periodo === 'todo' ? { ...p, periodo: 'mes' } : p
  const entradas: EntradasEvolucion = { cuotas: demo === 'semana' ? [] : cuotasPagadas(), leasing: LEASING, flujos: FLUJOS, recurrentes: RECURRENTES, reintegra_iva: null, futuro: null, hay_escenarios: true }
  const v = armarEvolucion(h, hoy, params, entradas)
  // El bloque Futuro arranca del financiero de la última carga (la proyección nunca parte de un supuesto viejo).
  const fin = serieEvolucion(h, 'financiero', hoy).at(-1)
  // Dos escenarios guardados más (inventados), para que "Ver con: «…»" se vea en el demo.
  const guardados = [
    { id: 1, nombre: 'Igual con dólar que sube (ejemplo)' },
    { id: 2, nombre: 'Ingreso más bajo desde feb-27 (ejemplo)' },
    { id: 3, nombre: 'Todo igual (ejemplo)' },
  ]
  return { ...v, futuro: futuroVista(proyeccionEjemplo(h, hoy, fin?.ars ?? null, fin?.usd ?? null), params.s, guardados), hay_escenarios: true }
}
