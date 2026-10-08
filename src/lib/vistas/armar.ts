// Arma los modelos de cada pantalla a partir de los Hechos. Funciones puras:
// se testean sin base de datos. src/lib/vistas/index.ts las llama con los
// hechos leídos de Supabase.

import { calc, deCalc, sinDato, vista, type Calc, type CalcVista, type Insumo } from '@/lib/domain/calc'
import { CERO, Decimal, monto, numero, porcentaje } from '@/lib/domain/dinero'
import { conjuntoFeriados, diasEntre, diasHabilesEntre, esHabil, esViejo, fechaCorta } from '@/lib/domain/fechas'
import { financieros, foto, indexar, sumaCalc, type Foto, type ItemFoto } from '@/lib/domain/foto'
import { cantidadCalc, costoCalc, ppcCalc } from '@/lib/domain/posiciones'
import type { Fecha, Hechos, Moneda } from '@/lib/domain/tipos'
import { parteCalc, porcentajeCalc, variacion, type Variacion, type Vista } from '@/lib/domain/variacion'
import type {
  ExposicionResumen,
  FilaCartera,
  FraseDelDia,
  Fuente,
  MovimientoActivo,
  Par,
  ParteFrase,
  Pendiente,
  PuntoExposicion,
  Segmento,
  TarjetaPatrimonio,
  VistaCartera,
  VistaExposicion,
  VistaHoy,
} from './contratos'

// ───────────── Fechas de carga ─────────────

/** Fechas con datos cargados (tipo de cambio, precios o saldos), ascendente. */
export function fechasDeCarga(h: Hechos): Fecha[] {
  const s = new Set<Fecha>()
  for (const t of h.tipos_cambio) s.add(t.fecha)
  for (const c of h.cotizaciones) s.add(c.fecha)
  for (const x of h.saldos) s.add(x.fecha)
  return [...s].sort()
}

// ───────────── Helpers ─────────────

const par = (ars: Calc, usd: Calc): Par => ({ ars: vista(ars), usd: vista(usd) })

function sumaItems(items: ItemFoto[], moneda: Moneda, explicacion: string): Calc {
  return sumaCalc(
    items.map((i) => ({ nombre: i.nombre, calc: moneda === 'ARS' ? i.valor_ars : i.valor_usd })),
    moneda,
    explicacion,
  )
}

function itemsVista(f: Foto, v: Vista): ItemFoto[] {
  return v === 'financiero' ? financieros(f) : f.items
}

const EXPL_FIN = {
  ARS: 'Todo lo invertible: títulos y liquidez de tus cuentas, en pesos. No incluye la casa, el auto ni deudas (D-03).',
  USD: 'Todo lo invertible: títulos y liquidez de tus cuentas, en dólares al CCL de la carga. No incluye la casa, el auto ni deudas (D-03).',
}
const EXPL_TOT = {
  ARS: 'Patrimonio financiero + bienes (casa, auto) − deudas (capital pendiente del leasing), en pesos.',
  USD: 'Patrimonio financiero + bienes (casa, auto) − deudas (capital pendiente del leasing), en dólares.',
}

// ───────────── Hoy ─────────────

export function armarHoy(h: Hechos, hoy: Fecha): VistaHoy {
  const feriados = conjuntoFeriados(h.feriados, 'AR')
  const fechas = fechasDeCarga(h)
  const d1 = fechas.at(-1) ?? null
  const d0 = fechas.length > 1 ? fechas[fechas.length - 2] : null
  const ix = indexar(h)
  const f1 = d1 ? foto(h, d1, { hoy, ix }) : null
  const v = d0 && d1 ? variacion(h, d0, d1, { hoy }) : null

  const vacio = sinDato('Todavía no hay cargas.')
  const financiero = tarjeta('Patrimonio financiero', f1, v, h, 'financiero', vacio)
  const total = tarjeta('Patrimonio total', f1, v, h, 'total', vacio)
  const tieneBienes = h.bienes.length > 0
  if (tieneBienes) {
    total.notas.push('Incluye la casa y tu parte del auto (valor − capital pendiente). El auto queda sujeto a la opción de compra del leasing.')
  } else {
    total.notas.push('Todavía no cargaste bienes (casa, auto): los cargás en Datos.')
  }

  return {
    hoy,
    hay_datos: d1 !== null,
    fecha_datos: d1,
    ccl: vista(f1?.ccl ?? sinDato('Todavía no cargaste un CCL.')),
    frase: v && d0 && d1 ? frase(v, h, d0, d1, feriados) : null,
    financiero,
    total,
    exposicion: resumenExposicion(f1, 'financiero'),
    atencion: pendientes(h, f1, hoy),
    fuentes: fuentes(h, d1, hoy, feriados),
    cargo_hoy: fechas.includes(hoy),
    es_habil_hoy: esHabil(hoy, feriados),
    aviso_fin_de_anio:
      hoy.slice(5, 7) === '12'
        ? 'La carga del último día hábil del año es tu foto al 31/12: la vas a necesitar para Bienes Personales.'
        : null,
    movimientos: v ? movimientos(v) : [],
    cuadre: cuadre(v),
  }
}

function tarjeta(titulo: string, f1: Foto | null, v: Variacion | null, h: Hechos, vistaSel: Vista, vacio: Calc): TarjetaPatrimonio {
  if (!f1) return { titulo, valor: par(vacio, vacio), variacion: null, variacion_pct: null, desglose: null, notas: [] }
  const items = itemsVista(f1, vistaSel)
  const expl = vistaSel === 'financiero' ? EXPL_FIN : EXPL_TOT
  const valorArs = sumaItems(items, 'ARS', expl.ARS)
  const valorUsd = sumaItems(items, 'USD', expl.USD)
  if (!v) return { titulo, valor: par(valorArs, valorUsd), variacion: null, variacion_pct: null, desglose: null, notas: [] }
  const resArs = parteCalc(v, h, vistaSel, 'resultado', 'ARS')
  const resUsd = parteCalc(v, h, vistaSel, 'resultado', 'USD')
  const base0 = foto(h, v.desde, { hoy: v.hasta })
  const b0 = itemsVista(base0, vistaSel)
  const baseArs = sumaItems(b0, 'ARS', 'Valor al inicio del período.')
  const baseUsd = sumaItems(b0, 'USD', 'Valor al inicio del período.')
  return {
    titulo,
    valor: par(valorArs, valorUsd),
    variacion: par(resArs, resUsd),
    variacion_pct: { ars: vista(porcentajeCalc(resArs, baseArs, 'ARS')), usd: vista(porcentajeCalc(resUsd, baseUsd, 'USD')) },
    desglose: {
      activos: par(parteCalc(v, h, vistaSel, 'activo', 'ARS'), parteCalc(v, h, vistaSel, 'activo', 'USD')),
      tc: par(parteCalc(v, h, vistaSel, 'tc', 'ARS'), parteCalc(v, h, vistaSel, 'tc', 'USD')),
    },
    notas: [],
  }
}

function frase(v: Variacion, h: Hechos, d0: Fecha, d1: Fecha, feriados: Set<Fecha>): FraseDelDia {
  const res = { ars: parteCalc(v, h, 'financiero', 'resultado', 'ARS'), usd: parteCalc(v, h, 'financiero', 'resultado', 'USD') }
  const act = { ars: parteCalc(v, h, 'financiero', 'activo', 'ARS'), usd: parteCalc(v, h, 'financiero', 'activo', 'USD') }
  const tc = { ars: parteCalc(v, h, 'financiero', 'tc', 'ARS'), usd: parteCalc(v, h, 'financiero', 'tc', 'USD') }
  const sin = { ars: parteCalc(v, h, 'financiero', 'sin_atribuir', 'ARS'), usd: parteCalc(v, h, 'financiero', 'sin_atribuir', 'USD') }
  const base0 = financieros(foto(h, d0, { hoy: d1 }))
  const pctArs = porcentajeCalc(res.ars, sumaItems(base0, 'ARS', 'Valor al inicio.'), 'ARS')
  const pctUsd = porcentajeCalc(res.usd, sumaItems(base0, 'USD', 'Valor al inicio.'), 'USD')
  const dh = diasHabilesEntre(d0, d1, feriados)
  const fm = (c: Calc, m: Moneda) => (c.valor === null ? 'sin dato' : monto(c.valor, m, { signo: true }))
  const pc = (c: Calc) => (c.valor === null ? 'sin dato' : porcentaje(c.valor, { signo: true }))
  const p = (texto: string, c: Calc | null = null): ParteFrase => ({ texto, calc: c ? vista(c) : null })
  const signosDistintos =
    res.ars.valor !== null && res.usd.valor !== null && res.ars.valor.isNegative() !== res.usd.valor.isNegative() && !res.ars.valor.isZero() && !res.usd.valor.isZero()
  const partes: ParteFrase[] = [
    p(`Desde la carga del ${fechaCorta(d0)}${dh > 1 ? ` (${dh} días hábiles)` : ''}: `),
    p(fm(res.ars, 'ARS'), res.ars),
    p(' en pesos ('),
    p(pc(pctArs), pctArs),
    p(signosDistintos ? '), pero ' : '), y '),
    p(fm(res.usd, 'USD'), res.usd),
    p(' en dólares ('),
    p(pc(pctUsd), pctUsd),
    p('). En pesos, el CCL '),
    p(tc.ars.valor !== null && tc.ars.valor.isNegative() ? 'restó ' : 'sumó '),
    p(tc.ars.valor === null ? 'sin dato' : monto(tc.ars.valor.abs(), 'ARS'), tc.ars),
    p(' y tus activos '),
    p(fm(act.ars, 'ARS'), act.ars),
    p('. En dólares, tus activos '),
    p(fm(act.usd, 'USD'), act.usd),
    p(' y el CCL '),
    p(fm(tc.usd, 'USD'), tc.usd),
    p(' sobre tus pesos.'),
  ]
  const hayAsin = sin.ars.valor !== null && !sin.ars.valor.isZero()
  if (hayAsin) {
    partes.push(p(' Sin atribuir (sin precio o saldo nuevo): '), p(fm(sin.ars, 'ARS'), sin.ars), p(' · '), p(fm(sin.usd, 'USD'), sin.usd), p('.'))
  }
  return {
    desde: d0,
    hasta: d1,
    dias_habiles: dh,
    partes,
    variacion: par(res.ars, res.usd),
    activos: par(act.ars, act.usd),
    tc: par(tc.ars, tc.usd),
    sin_atribuir: hayAsin ? par(sin.ars, sin.usd) : null,
  }
}

function movimientos(v: Variacion): MovimientoActivo[] {
  return v.contribuciones
    .filter((c) => c.clase === 'posicion' || c.clase === 'saldo')
    .map((c) => ({
      clave: c.clave,
      nombre: c.nombre,
      aporte: par(
        calc(c.resultado.ars, `resultado de ${c.nombre} = ${monto(c.resultado.ars, 'ARS', { decimales: 2, signo: true })}`),
        calc(c.resultado.usd, `resultado de ${c.nombre} = ${monto(c.resultado.usd, 'USD', { decimales: 2, signo: true })}`),
      ),
      sin_precio_nuevo: c.arrastrado,
    }))
    .sort((a, b) => Math.abs(Number(b.aporte.ars.valor)) - Math.abs(Number(a.aporte.ars.valor)))
}

function cuadre(v: Variacion | null): VistaHoy['cuadre'] {
  if (!v) return { ars_ok: null, usd_ok: null, detalle: 'Hace falta una segunda carga para el cuadre.' }
  if (v.faltantes.length) return { ars_ok: null, usd_ok: null, detalle: `No verificable: ${v.faltantes.length} partida(s) sin dato.` }
  let okA = true
  let okU = true
  for (const c of v.contribuciones) {
    const v0 = c.v0 ?? { ars: CERO, usd: CERO }
    const v1 = c.v1 ?? { ars: CERO, usd: CERO }
    const fa = c.flujos.reduce((a, f) => a.plus(f.ars), CERO)
    const fu = c.flujos.reduce((a, f) => a.plus(f.usd), CERO)
    const ra = c.activo.ars.plus(c.tc.ars).plus(c.sin_atribuir.ars)
    const ru = c.activo.usd.plus(c.tc.usd).plus(c.sin_atribuir.usd)
    if (v1.ars.minus(v0.ars).minus(fa).minus(ra).abs().gt('1e-12')) okA = false
    if (v1.usd.minus(v0.usd).minus(fu).minus(ru).abs().gt('1e-12')) okU = false
  }
  return {
    ars_ok: okA,
    usd_ok: okU,
    detalle: okA && okU ? 'Activos + TC + sin atribuir = variación − flujos, en las dos monedas.' : 'El desglose no cierra: revisar.',
  }
}

// ───────────── Exposición ─────────────

function resumenExposicion(f: Foto | null, vistaSel: Vista): ExposicionResumen {
  if (!f) {
    const n = vista(sinDato('Todavía no hay cargas.'))
    return { pesos_financieros: n, deuda_pesos: n, neto_ars: n, neto_usd: n, sensibilidad_usd_1pct: n }
  }
  const items = itemsVista(f, vistaSel)
  const pesos = items.filter((i) => i.moneda_riesgo === 'ARS' && i.clase !== 'pasivo')
  const deudas = f.items.filter((i) => i.clase === 'pasivo' && i.moneda_riesgo === 'ARS')
  const pesosC = sumaItems(pesos, 'ARS', 'Lo que arriesga pesos: bonos y letras en pesos, FCI y pesos en tus cuentas.')
  const deudaNeg = sumaItems(deudas, 'ARS', 'Deuda en pesos (capital pendiente informado), con signo negativo.')
  const deudaC =
    deudaNeg.valor === null
      ? deudaNeg
      : calc(deudaNeg.valor.negated(), `capital pendiente = ${monto(deudaNeg.valor.negated(), 'ARS', { decimales: 2 })}`, [deCalc('Deudas', deudaNeg, 'ARS')], {
          explicacion: 'Deuda en pesos a cuota fija: es una posición corta en pesos (spec §3).',
        })
  const neto =
    pesosC.valor === null || deudaC.valor === null
      ? sinDato('Falta un dato de pesos o de deuda.', [deCalc('Pesos', pesosC, 'ARS'), deCalc('Deuda', deudaC, 'ARS')])
      : calc(
          pesosC.valor.minus(deudaC.valor),
          `${monto(pesosC.valor, 'ARS', { decimales: 2 })} − ${monto(deudaC.valor, 'ARS', { decimales: 2 })} = ${monto(pesosC.valor.minus(deudaC.valor), 'ARS', { decimales: 2, signo: true })}`,
          [deCalc('Pesos financieros', pesosC, 'ARS'), deCalc('Deuda en pesos', deudaC, 'ARS')],
          { explicacion: 'Tu exposición neta al peso: lo que tenés en pesos menos lo que debés en pesos. Positivo = largo en pesos.' },
        )
  const ccl = f.ccl
  const netoUsd =
    neto.valor === null || ccl.valor === null
      ? sinDato('Falta el neto o el CCL.', [deCalc('Neto', neto, 'ARS'), deCalc('CCL', ccl, 'ratio')])
      : calc(neto.valor.div(ccl.valor), `${monto(neto.valor, 'ARS', { decimales: 2, signo: true })} ÷ ${numero(ccl.valor, 2)} = ${monto(neto.valor.div(ccl.valor), 'USD', { decimales: 2, signo: true })}`, [deCalc('Neto', neto, 'ARS'), deCalc('CCL', ccl, 'ratio')], {
          explicacion: 'El neto en pesos pasado a dólares al CCL de la carga.',
        })
  const sens =
    netoUsd.valor === null
      ? sinDato('Falta el neto en dólares.')
      : calc(
          netoUsd.valor.negated().times('0.01').div('1.01'),
          `−(${monto(netoUsd.valor, 'USD', { decimales: 2 })}) × 0,01 ÷ 1,01 = ${monto(netoUsd.valor.negated().times('0.01').div('1.01'), 'USD', { decimales: 2, signo: true })}`,
          [deCalc('Neto en dólares', netoUsd, 'USD')],
          { explicacion: 'Cuánto cambia en dólares tu posición neta en pesos si el CCL sube 1%. Es una sensibilidad, no un pronóstico.' },
        )
  return {
    pesos_financieros: vista(pesosC),
    deuda_pesos: vista(deudaC),
    neto_ars: vista(neto),
    neto_usd: vista(netoUsd),
    sensibilidad_usd_1pct: vista(sens),
  }
}

const NOMBRE_CLASE: Record<string, string> = {
  cedear: 'CEDEARs',
  accion_local: 'Acciones locales',
  bono: 'Bonos',
  lecap: 'Letras',
  fci: 'FCI',
  liquidez: 'Liquidez',
  inmueble: 'Inmuebles',
  vehiculo: 'Vehículos',
  otro: 'Otros bienes',
  deuda: 'Deudas',
}
const COLOR_CLASE: Record<string, string> = {
  cedear: '#2f5bd3',
  accion_local: '#0f8b8d',
  bono: '#c2621f',
  lecap: '#b8336a',
  fci: '#7a4fc9',
  liquidez: '#6b7a90',
  inmueble: '#8a8f98',
  vehiculo: '#a0a4ab',
  otro: '#b5b8bd',
}
const NOMBRE_GEO: Record<string, string> = { AR: 'Argentina', US: 'EE.UU.', BR: 'Brasil', GLOBAL: 'Global' }
const COLOR_GEO: Record<string, string> = { AR: '#4a6fa5', US: '#2f5bd3', BR: '#3b8f3e', GLOBAL: '#7a4fc9' }

function segmentos(items: ItemFoto[], clave: (i: ItemFoto) => string, nombre: (k: string) => string, color: (k: string) => string, total: Decimal | null): Segmento[] {
  const grupos = new Map<string, ItemFoto[]>()
  for (const i of items) {
    const k = clave(i)
    grupos.set(k, [...(grupos.get(k) ?? []), i])
  }
  return [...grupos.entries()]
    .map(([k, is]) => {
      const ars = sumaItems(is, 'ARS', `Suma de ${nombre(k)} en pesos.`)
      const usd = sumaItems(is, 'USD', `Suma de ${nombre(k)} en dólares.`)
      const peso =
        ars.valor === null || total === null || total.isZero()
          ? sinDato('Falta un valor para calcular el peso.')
          : calc(ars.valor.div(total), `${monto(ars.valor, 'ARS')} ÷ ${monto(total, 'ARS')} = ${porcentaje(ars.valor.div(total))}`, [deCalc(nombre(k), ars, 'ARS')], {
              explicacion: 'Qué parte de la vista representa este grupo.',
            })
      return { clave: k, nombre: nombre(k), color: color(k), valor: par(ars, usd), peso: vista(peso) }
    })
    .sort((a, b) => Number(b.valor.ars.valor ?? 0) - Number(a.valor.ars.valor ?? 0))
}

export function armarExposicion(h: Hechos, hoy: Fecha, modo: Vista): VistaExposicion {
  const fechas = fechasDeCarga(h)
  const d1 = fechas.at(-1) ?? null
  const ix = indexar(h)
  const f = d1 ? foto(h, d1, { hoy, ix }) : null
  const resumen = resumenExposicion(f, modo)
  const vacio = vista(sinDato('Todavía no hay cargas.'))
  if (!f) {
    return {
      fecha_datos: null,
      vista: modo,
      resumen,
      activos_en_pesos: vacio,
      activos_en_dolares: { ars: vacio, usd: vacio },
      pasivos_en_pesos: vacio,
      neto_pct: vacio,
      por_clase: [],
      por_moneda: [],
      por_geografia: [],
      concentracion: { top1: vacio, top1_nombre: null, top3: vacio },
      serie: [],
    }
  }
  const items = itemsVista(f, modo).filter((i) => i.clase !== 'pasivo')
  const totalArs = sumaItems(items, 'ARS', 'Total de activos de la vista.')
  const usdItems = items.filter((i) => i.moneda_riesgo === 'USD')
  const netoPct =
    resumen.neto_ars.valor === null || totalArs.valor === null || totalArs.valor.isZero()
      ? sinDato('Falta el neto o el total.')
      : calc(
          new Decimal(resumen.neto_ars.valor).div(totalArs.valor),
          `${monto(resumen.neto_ars.valor, 'ARS', { signo: true })} ÷ ${monto(totalArs.valor, 'ARS')} = ${porcentaje(new Decimal(resumen.neto_ars.valor).div(totalArs.valor), { signo: true })}`,
          [deCalc('Total de activos', totalArs, 'ARS')],
          { explicacion: 'Tu exposición neta al peso como parte de tus activos: (pesos − deuda en pesos) ÷ activos.' },
        )
  const total = totalArs.valor
  const posiciones = items
    .filter((i) => i.valor_ars.valor !== null)
    .sort((a, b) => (b.valor_ars.valor as Decimal).cmp(a.valor_ars.valor as Decimal))
  const top = (n: number): Calc => {
    if (!total || total.isZero() || posiciones.length === 0) return sinDato('No hay posiciones valuadas.')
    const sel = posiciones.slice(0, n)
    const s = sel.reduce((a, i) => a.plus(i.valor_ars.valor as Decimal), CERO)
    return calc(s.div(total), `${sel.map((i) => i.ticker).join(' + ')} = ${monto(s, 'ARS')} ÷ ${monto(total, 'ARS')} = ${porcentaje(s.div(total))}`, sel.map((i) => deCalc(i.nombre, i.valor_ars, 'ARS')), {
      explicacion: n === 1 ? 'Cuánto pesa tu posición más grande.' : 'Cuánto pesan tus tres posiciones más grandes.',
    })
  }
  return {
    fecha_datos: d1,
    vista: modo,
    resumen,
    activos_en_pesos: resumen.pesos_financieros,
    activos_en_dolares: par(sumaItems(usdItems, 'ARS', 'Activos que arriesgan dólares, en pesos.'), sumaItems(usdItems, 'USD', 'Activos que arriesgan dólares (CEDEARs, dólares), aunque coticen en pesos.')),
    pasivos_en_pesos: resumen.deuda_pesos,
    neto_pct: vista(netoPct),
    por_clase: segmentos(items, (i) => i.tipo, (k) => NOMBRE_CLASE[k] ?? k, (k) => COLOR_CLASE[k] ?? '#888', total),
    por_moneda: segmentos(items, (i) => i.moneda_riesgo, (k) => (k === 'ARS' ? 'Pesos' : 'Dólares'), (k) => (k === 'ARS' ? '#6b7a90' : '#2f5bd3'), total),
    por_geografia: segmentos(items, (i) => i.geografia, (k) => NOMBRE_GEO[k] ?? k, (k) => COLOR_GEO[k] ?? '#888', total),
    concentracion: { top1: vista(top(1)), top1_nombre: posiciones[0]?.nombre ?? null, top3: vista(top(3)) },
    serie: serieExposicion(h, fechas.slice(-120), ix, hoy, modo),
  }
}

function serieExposicion(h: Hechos, fechas: Fecha[], ix: ReturnType<typeof indexar>, hoy: Fecha, modo: Vista): PuntoExposicion[] {
  return fechas.map((d) => {
    const f = foto(h, d, { hoy, ix })
    const r = resumenExposicion(f, modo)
    const items = itemsVista(f, modo).filter((i) => i.clase !== 'pasivo')
    const usd = items.filter((i) => i.moneda_riesgo === 'USD')
    const tot = sumaItems(items, 'ARS', '')
    const neto = r.neto_ars.valor
    return {
      fecha: d,
      activos_ars: r.pesos_financieros.valor,
      activos_usd: sumaItems(usd, 'ARS', '').valor?.toFixed() ?? null,
      deuda_ars: r.deuda_pesos.valor,
      neto_ars: neto,
      neto_pct: neto !== null && tot.valor !== null && !tot.valor.isZero() ? new Decimal(neto).div(tot.valor).toFixed() : null,
    }
  })
}

// ───────────── Cartera ─────────────

export function armarCartera(h: Hechos, hoy: Fecha): VistaCartera {
  const fechas = fechasDeCarga(h)
  const d1 = fechas.at(-1) ?? null
  const vacio = sinDato('Todavía no hay cargas.')
  if (!d1) {
    return { fecha_datos: null, ccl: vista(vacio), filas: [], totales: { valor: par(vacio, vacio), resultado: par(vacio, vacio), costo: par(vacio, vacio) } }
  }
  const ix = indexar(h)
  const f = foto(h, d1, { hoy, ix })
  const items = financieros(f)
  const totalArs = sumaItems(items, 'ARS', EXPL_FIN.ARS)
  const totalUsd = sumaItems(items, 'USD', EXPL_FIN.USD)
  const filas = items.map((i) => filaCartera(i, f, totalArs.valor, hoy))
  const posiciones = items.filter((i) => i.clase === 'posicion')
  const costoArs = sumaCalc(posiciones.map((i) => ({ nombre: i.nombre, calc: costoCalc(i.tenencia!, 'ARS') })), 'ARS', 'Lo que te costaron tus títulos, en pesos.')
  const costoUsd = sumaCalc(posiciones.map((i) => ({ nombre: i.nombre, calc: costoCalc(i.tenencia!, 'USD') })), 'USD', 'Lo que te costaron tus títulos, en dólares al CCL de cada compra.')
  const valorPosArs = sumaItems(posiciones, 'ARS', '')
  const valorPosUsd = sumaItems(posiciones, 'USD', '')
  const resTot = (val: Calc, costo: Calc, m: Moneda): Calc =>
    val.valor === null || costo.valor === null
      ? sinDato(costo.valor === null ? (costo.motivo ?? 'Falta el costo de alguna posición.') : (val.motivo ?? 'Falta un valor.'), [deCalc('Valor', val, m), deCalc('Costo', costo, m)], { etiquetas: ['parcial'] })
      : calc(val.valor.minus(costo.valor), `${monto(val.valor, m, { decimales: 2 })} − ${monto(costo.valor, m, { decimales: 2 })} = ${monto(val.valor.minus(costo.valor), m, { decimales: 2, signo: true })}`, [deCalc('Valor de los títulos', val, m), deCalc('Costo', costo, m)], {
          explicacion: 'Resultado de tus títulos desde la compra (la liquidez no tiene costo).',
        })
  return {
    fecha_datos: d1,
    ccl: vista(f.ccl),
    filas,
    totales: {
      valor: par(totalArs, totalUsd),
      resultado: par(resTot(valorPosArs, costoArs, 'ARS'), resTot(valorPosUsd, costoUsd, 'USD')),
      costo: par(costoArs, costoUsd),
    },
  }
}

function filaCartera(i: ItemFoto, f: Foto, totalArs: Decimal | null, hoy: Fecha): FilaCartera {
  const peso =
    i.valor_ars.valor === null || totalArs === null || totalArs.isZero()
      ? sinDato('Falta un valor para calcular el peso.')
      : calc(i.valor_ars.valor.div(totalArs), `${monto(i.valor_ars.valor, 'ARS')} ÷ ${monto(totalArs, 'ARS')} = ${porcentaje(i.valor_ars.valor.div(totalArs))}`, [deCalc('Valor', i.valor_ars, 'ARS')], {
          explicacion: 'Qué parte de tu patrimonio financiero es esta fila.',
        })
  const noAplica = sinDato('No aplica a la liquidez: no tiene costo de compra.')
  if (i.clase !== 'posicion' || !i.tenencia) {
    return {
      clave: i.clave,
      ticker: i.ticker,
      nombre: i.nombre,
      cuenta: i.cuenta?.nombre ?? '',
      tipo: 'liquidez',
      moneda_riesgo: i.moneda_riesgo,
      geografia: i.geografia,
      color: i.color,
      cantidad: vista(sinDato('No aplica.')),
      precio: vista(i.precio),
      fecha_precio: i.fecha_dato,
      precio_viejo: i.viejo,
      ppc: par(noAplica, noAplica),
      valor: par(i.valor_ars, i.valor_usd),
      resultado: par(noAplica, noAplica),
      resultado_pct: par(noAplica, noAplica),
      desglose: null,
      peso: vista(peso),
      dias_en_posicion: null,
      ganas_pesos_perdes_dolares: false,
      pendiente: null,
    }
  }
  const t = i.tenencia
  const costoA = costoCalc(t, 'ARS')
  const costoU = costoCalc(t, 'USD')
  const res = (val: Calc, costo: Calc, m: Moneda): Calc =>
    val.valor === null || costo.valor === null
      ? sinDato(costo.valor === null ? (costo.motivo ?? 'Falta el costo.') : (val.motivo ?? 'Falta el valor.'), [deCalc('Valor', val, m), deCalc('Costo', costo, m)], { etiquetas: costo.etiquetas })
      : calc(val.valor.minus(costo.valor), `${monto(val.valor, m, { decimales: 2 })} − ${monto(costo.valor, m, { decimales: 2 })} = ${monto(val.valor.minus(costo.valor), m, { decimales: 2, signo: true })}`, [deCalc('Valor', val, m), deCalc('Costo', costo, m)], {
          explicacion: m === 'ARS' ? 'Cuánto ganaste o perdiste en pesos desde la compra.' : 'Cuánto ganaste o perdiste en dólares desde la compra (cada compra a su CCL).',
        })
  const resA = res(i.valor_ars, costoA, 'ARS')
  const resU = res(i.valor_usd, costoU, 'USD')
  const pct = (r: Calc, costo: Calc, m: Moneda): Calc =>
    r.valor === null || costo.valor === null || costo.valor.isZero()
      ? sinDato(r.motivo ?? 'Falta el resultado.', [deCalc('Resultado', r, m)], { etiquetas: r.etiquetas })
      : calc(r.valor.div(costo.valor), `${monto(r.valor, m, { decimales: 2, signo: true })} ÷ ${monto(costo.valor, m, { decimales: 2 })} = ${porcentaje(r.valor.div(costo.valor), { signo: true })}`, [deCalc('Resultado', r, m), deCalc('Costo', costo, m)], {
          explicacion: 'El resultado sobre lo que te costó.',
        })
  // Desglose desde la compra (D-35), con el CCL promedio de compra = costo ARS ÷ costo USD.
  let desglose: FilaCartera['desglose'] = null
  const ccl = f.ccl.valor
  if (ccl && costoA.valor && costoU.valor && !costoU.valor.isZero() && i.valor_ars.valor && i.valor_usd.valor) {
    const cclProm = costoA.valor.div(costoU.valor)
    const insumos: Insumo[] = [deCalc('Costo en pesos', costoA, 'ARS'), deCalc('Costo en dólares', costoU, 'USD'), deCalc('CCL de hoy', f.ccl, 'ratio')]
    if (i.moneda_riesgo === 'USD') {
      const tc = costoU.valor.times(ccl.minus(cclProm))
      const act = (i.valor_usd.valor.minus(costoU.valor)).times(ccl)
      desglose = {
        moneda: 'ARS',
        activo: vista(calc(act, `resultado en dólares ${monto(i.valor_usd.valor.minus(costoU.valor), 'USD', { decimales: 2, signo: true })} × CCL ${numero(ccl, 2)} = ${monto(act, 'ARS', { decimales: 2, signo: true })}`, insumos, { explicacion: 'Lo que ganaste en pesos porque se movió el activo (medido en dólares).' })),
        tc: vista(calc(tc, `${monto(costoU.valor, 'USD', { decimales: 2 })} × (CCL ${numero(ccl, 2)} − CCL de compra ${numero(cclProm, 2)}) = ${monto(tc, 'ARS', { decimales: 2, signo: true })}`, insumos, { explicacion: 'Lo que ganaste en pesos solo porque subió el CCL desde que compraste.' })),
      }
    } else {
      const act = i.valor_ars.valor.minus(costoA.valor).div(cclProm)
      const tc = i.valor_ars.valor.times(new Decimal(1).div(ccl).minus(new Decimal(1).div(cclProm)))
      desglose = {
        moneda: 'USD',
        activo: vista(calc(act, `resultado en pesos ${monto(i.valor_ars.valor.minus(costoA.valor), 'ARS', { decimales: 2, signo: true })} ÷ CCL de compra ${numero(cclProm, 2)} = ${monto(act, 'USD', { decimales: 2, signo: true })}`, insumos, { explicacion: 'Lo que rindió el activo en pesos, pasado a dólares al CCL de compra.' })),
        tc: vista(calc(tc, `${monto(i.valor_ars.valor, 'ARS', { decimales: 2 })} × (1/${numero(ccl, 2)} − 1/${numero(cclProm, 2)}) = ${monto(tc, 'USD', { decimales: 2, signo: true })}`, insumos, { explicacion: 'Lo que perdiste o ganaste en dólares porque cambió el CCL desde que compraste.' })),
      }
    }
  }
  const pendiente = t.etiquetas.includes('pendiente')
    ? 'Compra con precio pendiente: se completa con el PPP de la próxima carga.'
    : costoU.valor === null && t.desde_apertura
      ? 'Falta el CCL de compra de la apertura: declaralo en Datos para ver el resultado en dólares.'
      : null
  return {
    clave: i.clave,
    ticker: i.ticker,
    nombre: i.nombre,
    cuenta: i.cuenta?.nombre ?? '',
    tipo: i.activo!.tipo,
    moneda_riesgo: i.moneda_riesgo,
    geografia: i.geografia,
    color: i.color,
    cantidad: vista(cantidadCalc(t)),
    precio: vista(i.precio),
    fecha_precio: i.fecha_dato,
    precio_viejo: i.viejo,
    ppc: par(ppcCalc(t, 'ARS'), ppcCalc(t, 'USD')),
    valor: par(i.valor_ars, i.valor_usd),
    resultado: par(resA, resU),
    resultado_pct: par(pct(resA, costoA, 'ARS'), pct(resU, costoU, 'USD')),
    desglose,
    peso: vista(peso),
    dias_en_posicion: t.fecha_inicio ? diasEntre(t.fecha_inicio, hoy) : null,
    ganas_pesos_perdes_dolares:
      resA.valor !== null && resU.valor !== null && resA.valor.isPositive() && resU.valor.isNegative() && !resU.valor.isZero(),
    pendiente,
  }
}

// ───────────── Pendientes y fuentes ─────────────

function pendientes(h: Hechos, f: Foto | null, hoy: Fecha): Pendiente[] {
  const out: Pendiente[] = []
  if (!f) {
    out.push({ id: 'primera-carga', gravedad: 'alta', titulo: 'Hacé tu primera carga', detalle: 'CCL, cripto, el Excel de IEB y las capturas de Galicia y Mercado Pago.', accion: { etiqueta: 'Cargar', href: '/carga' } })
    return out
  }
  if (f.ccl.valor === null) out.push({ id: 'sin-ccl', gravedad: 'alta', titulo: 'Falta el CCL', detalle: 'Sin CCL no hay valores en dólares.', accion: { etiqueta: 'Cargar', href: '/carga' } })
  for (const i of f.items) {
    if (i.clase === 'posicion' && i.precio.valor === null)
      out.push({ id: `sin-precio:${i.clave}`, gravedad: 'alta', titulo: `${i.ticker}: sin precio`, detalle: 'No hay un precio cargado para valuarlo.', accion: { etiqueta: 'Cargar', href: '/carga' } })
    else if (i.viejo && i.clase !== 'pasivo')
      out.push({ id: `viejo:${i.clave}`, gravedad: 'media', titulo: `${i.ticker}: dato viejo`, detalle: `El último dato es del ${i.fecha_dato ? fechaCorta(i.fecha_dato) : '—'} (más de 2 días hábiles).`, accion: { etiqueta: 'Cargar', href: '/carga' } })
    if (i.tenencia?.etiquetas.includes('pendiente'))
      out.push({ id: `pendiente:${i.clave}`, gravedad: 'media', titulo: `${i.ticker}: compra con precio pendiente`, detalle: 'Se completa con el PPP de la próxima carga de IEB.', accion: null })
    else if (i.tenencia && i.tenencia.costo_usd === null && i.tenencia.desde_apertura)
      out.push({ id: `ccl-compra:${i.clave}`, gravedad: 'baja', titulo: `${i.ticker}: PPC en USD sin dato`, detalle: 'Falta el CCL de compra de la apertura.', accion: { etiqueta: 'Declarar', href: '/datos?seccion=catalogo' } })
  }
  for (const b of f.items.filter((x) => x.clase === 'bien' && x.precio.valor === null))
    out.push({ id: `valuacion:${b.clave}`, gravedad: 'media', titulo: `${b.nombre}: sin valuación`, detalle: 'Cargá una valuación con fecha y fuente.', accion: { etiqueta: 'Cargar valuación', href: '/datos?seccion=bienes' } })
  for (const p of f.items.filter((x) => x.clase === 'pasivo' && x.precio.valor === null))
    out.push({ id: `capital:${p.clave}`, gravedad: 'alta', titulo: `${p.nombre}: sin capital pendiente`, detalle: 'Sin el capital informado, la exposición no puede netear la deuda.', accion: { etiqueta: 'Cargar capital', href: '/datos?seccion=leasing' } })
  if (h.pasivos.length === 0)
    out.push({ id: 'sin-leasing', gravedad: 'media', titulo: 'Cargá el leasing', detalle: 'La deuda en pesos netea contra tus pesos (spec §3).', accion: { etiqueta: 'Cargar leasing', href: '/datos?seccion=leasing' } })
  void hoy
  const orden = { alta: 0, media: 1, baja: 2 }
  return out.sort((a, b) => orden[a.gravedad] - orden[b.gravedad])
}

function fuentes(h: Hechos, d1: Fecha | null, hoy: Fecha, feriados: Set<Fecha>): Fuente[] {
  const out: Fuente[] = []
  for (const nombre of ['IEB', 'Galicia', 'Mercado Pago'] as const) {
    const cuenta = h.cuentas.find((c) => c.nombre === nombre)
    const cargas = h.cargas.filter((c) => c.cuenta_id === cuenta?.id && c.estado === 'vigente').sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    const ult = cargas.at(-1)
    out.push({
      nombre,
      estado: !ult ? 'sin_carga' : esViejo(ult.fecha, hoy, feriados) ? 'viejo' : 'ok',
      fecha: ult?.fecha ?? null,
      carga_id: ult?.id ?? null,
      detalle: ult ? `Última carga: ${fechaCorta(ult.fecha)}` : 'Todavía no cargaste esta cuenta.',
    })
  }
  const tc = [...h.tipos_cambio].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  const ultCcl = [...tc].reverse().find((t) => t.ccl !== null)
  const ultCri = [...tc].reverse().find((t) => t.cripto_venta !== null)
  out.push({ nombre: 'CCL', estado: !ultCcl ? 'sin_carga' : esViejo(ultCcl.fecha, hoy, feriados) ? 'viejo' : 'tipeado', fecha: ultCcl?.fecha ?? null, carga_id: ultCcl?.carga_id ?? null, detalle: ultCcl ? `Tipeado el ${fechaCorta(ultCcl.fecha)}` : null })
  out.push({ nombre: 'Cripto', estado: !ultCri ? 'sin_carga' : esViejo(ultCri.fecha, hoy, feriados) ? 'viejo' : 'tipeado', fecha: ultCri?.fecha ?? null, carga_id: ultCri?.carga_id ?? null, detalle: ultCri ? `Tipeado el ${fechaCorta(ultCri.fecha)}` : null })
  void d1
  return out
}

export type { CalcVista }
