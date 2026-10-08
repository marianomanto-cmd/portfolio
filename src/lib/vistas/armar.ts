// Arma los modelos de cada pantalla a partir de los Hechos. Funciones puras:
// se testean sin base de datos. src/lib/vistas/index.ts las llama con los
// hechos leídos de Supabase.

import { calc, deCalc, sinDato, vista, type Calc, type CalcVista, type Etiqueta, type Insumo } from '@/lib/domain/calc'
import { CERO, Decimal, monto, numero, porcentaje } from '@/lib/domain/dinero'
import { conjuntoFeriados, diaSemana, diasEntre, diasHabilesEntre, esHabil, esViejo, fechaCorta } from '@/lib/domain/fechas'
import { financieros, foto, indexar, sumaCalc, type Foto, type ItemFoto } from '@/lib/domain/foto'
import { cantidadCalc, costoCalc, ppcCalc } from '@/lib/domain/posiciones'
import type { Fecha, Hechos, Moneda } from '@/lib/domain/tipos'
import {
  EXPLICACION_INFERIDO,
  cuadre,
  desgloseDesdeCompra,
  faltantesEnVista,
  fechasDeCarga,
  parteCalc,
  porcentajeCalc,
  variacion,
  type Contribucion,
  type Variacion,
  type Vista,
} from '@/lib/domain/variacion'
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

export { fechasDeCarga }

// ───────────── Helpers ─────────────

const par = (ars: Calc, usd: Calc): Par => ({ ars: vista(ars), usd: vista(usd) })

/** Un motivo dentro de una oración, sin su punto final ("… en Cargar." → "… en Cargar"). */
const sinPunto = (s: string) => s.trim().replace(/\.+$/, '')

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

/** Pasa a dólares un monto en pesos al CCL de la foto, con traza. */
function aDolares(ars: Calc, ccl: Calc, nombre: string, explicacion: string): Calc {
  if (ars.valor === null) return sinDato(ars.motivo ?? 'Falta el monto en pesos.', [deCalc(nombre, ars, 'ARS')], { explicacion, etiquetas: ars.etiquetas })
  if (ccl.valor === null) return sinDato('Falta el CCL para pasar a dólares.', [deCalc(nombre, ars, 'ARS'), deCalc('CCL', ccl, 'ratio')], { explicacion })
  const v = ars.valor.div(ccl.valor)
  return calc(v, `${monto(ars.valor, 'ARS', { decimales: 2 })} ÷ CCL ${numero(ccl.valor, 2)} = ${monto(v, 'USD', { decimales: 2 })}`, [deCalc(nombre, ars, 'ARS'), deCalc('CCL', ccl, 'ratio')], { explicacion })
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
  const financiero = tarjeta('Patrimonio financiero', f1, v, h, 'financiero', vacio, hoy)
  const total = tarjeta('Patrimonio total', f1, v, h, 'total', vacio, hoy)
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
    fecha_ccl: f1?.fecha_ccl ?? null,
    frase: v && d0 && d1 ? frase(v, h, d0, d1, feriados, hoy, f1) : null,
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
    cuadre: v ? cuadreVista(v, h, hoy) : { ars_ok: null, usd_ok: null, detalle: 'Hace falta una segunda carga para el cuadre.', diferencia: null },
  }
}

function cuadreVista(v: Variacion, h: Hechos, hoy: Fecha): VistaHoy['cuadre'] {
  const c = cuadre(v, h, { hoy })
  return { ars_ok: c.ars_ok, usd_ok: c.usd_ok, detalle: c.detalle, diferencia: c.diferencia ? par(c.diferencia.ars, c.diferencia.usd) : null }
}

function tarjeta(titulo: string, f1: Foto | null, v: Variacion | null, h: Hechos, vistaSel: Vista, vacio: Calc, hoy: Fecha): TarjetaPatrimonio {
  if (!f1) return { titulo, valor: par(vacio, vacio), variacion: null, variacion_pct: null, desglose: null, notas: [] }
  const items = itemsVista(f1, vistaSel)
  const expl = vistaSel === 'financiero' ? EXPL_FIN : EXPL_TOT
  const valorArs = sumaItems(items, 'ARS', expl.ARS)
  const valorUsd = sumaItems(items, 'USD', expl.USD)
  if (!v) return { titulo, valor: par(valorArs, valorUsd), variacion: null, variacion_pct: null, desglose: null, notas: [] }
  const resArs = parteCalc(v, h, vistaSel, 'resultado', 'ARS')
  const resUsd = parteCalc(v, h, vistaSel, 'resultado', 'USD')
  const base0 = foto(h, v.desde, { hoy })
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
      sin_atribuir: par(parteCalc(v, h, vistaSel, 'sin_atribuir', 'ARS'), parteCalc(v, h, vistaSel, 'sin_atribuir', 'USD')),
    },
    notas: [],
  }
}

const noCero = (c: Calc) => c.valor !== null && !c.valor.isZero()

function frase(v: Variacion, h: Hechos, d0: Fecha, d1: Fecha, feriados: Set<Fecha>, hoy: Fecha, f1: Foto | null): FraseDelDia {
  const res = { ars: parteCalc(v, h, 'financiero', 'resultado', 'ARS'), usd: parteCalc(v, h, 'financiero', 'resultado', 'USD') }
  const act = { ars: parteCalc(v, h, 'financiero', 'activo', 'ARS'), usd: parteCalc(v, h, 'financiero', 'activo', 'USD') }
  const tc = { ars: parteCalc(v, h, 'financiero', 'tc', 'ARS'), usd: parteCalc(v, h, 'financiero', 'tc', 'USD') }
  const sin = { ars: parteCalc(v, h, 'financiero', 'sin_atribuir', 'ARS'), usd: parteCalc(v, h, 'financiero', 'sin_atribuir', 'USD') }
  const base0 = financieros(foto(h, d0, { hoy }))
  const pctArs = porcentajeCalc(res.ars, sumaItems(base0, 'ARS', 'Valor al inicio.'), 'ARS')
  const pctUsd = porcentajeCalc(res.usd, sumaItems(base0, 'USD', 'Valor al inicio.'), 'USD')
  const dh = diasHabilesEntre(d0, d1, feriados)
  const fm = (c: Calc, m: Moneda) => (c.valor === null ? 'sin dato' : monto(c.valor, m, { signo: true }))
  const pc = (c: Calc) => (c.valor === null ? 'sin dato' : porcentaje(c.valor, { signo: true }))
  const p = (texto: string, c: Calc | null = null): ParteFrase => ({ texto, calc: c ? vista(c) : null })
  // B18: el cero no tiene signo.
  const signosDistintos =
    res.ars.valor !== null && res.usd.valor !== null && ((res.ars.valor.gt(0) && res.usd.valor.lt(0)) || (res.ars.valor.lt(0) && res.usd.valor.gt(0)))
  const fin = v.contribuciones.filter((c) => c.clase === 'posicion' || c.clase === 'saldo')
  const sinCclNuevo = !v.ccl_nuevo
  const soloTc = v.ccl_nuevo && fin.length > 0 && fin.every((c) => c.arrastrado) && v.faltantes.length === 0
  const faltan = faltantesEnVista(v, h, 'financiero')
  if (faltan.length) {
    // D-65: a la variación le falta una partida, así que es "sin dato" en las
    // dos monedas, y también lo son sus partes. La frase dice qué falta y por
    // qué, en vez de repartir cifras que no existen (cada "sin dato" se toca y
    // muestra la suma parcial).
    return {
      desde: d0,
      hasta: d1,
      dias_habiles: dh,
      partes: [
        p(`Desde la carga del ${fechaCorta(d0)}${dh > 1 ? ` (${dh} días hábiles)` : ''}: `),
        p('sin dato', res.ars),
        p(' en pesos y '),
        p('sin dato', res.usd),
        p(' en dólares. '),
        p(`${faltan.length === 1 ? 'Falta' : 'Faltan'} ${faltan.map((x) => `${x.nombre}: ${sinPunto(x.motivo)}`).join('; ')}.`),
      ],
      variacion: par(res.ars, res.usd),
      activos: par(act.ars, act.usd),
      tc: par(tc.ars, tc.usd),
      sin_atribuir: null,
      solo_tipos_de_cambio: false,
      sin_ccl_nuevo: sinCclNuevo,
    }
  }
  const partes: ParteFrase[] = [
    p(`Desde la carga del ${fechaCorta(d0)}${dh > 1 ? ` (${dh} días hábiles)` : ''}: `),
    p(fm(res.ars, 'ARS'), res.ars),
    p(' en pesos ('),
    p(pc(pctArs), pctArs),
    p(signosDistintos ? '), pero ' : '), y '),
    p(fm(res.usd, 'USD'), res.usd),
    p(' en dólares ('),
    p(pc(pctUsd), pctUsd),
    p(').'),
  ]
  const hayAsin = noCero(sin.ars) || noCero(sin.usd) // B09: en las dos monedas
  if (sinCclNuevo) {
    const fc = f1?.fecha_ccl
    partes.push(
      p(` Esta carga no tiene CCL: los dólares usan el ${fc ? `del ${fechaCorta(fc)}` : 'último tipeado'} y no hay con qué separar activo de tipo de cambio, así que todo el cambio queda sin atribuir hasta que cargues uno.`),
    )
  } else if (soloTc) {
    partes.push(p(' Cargaste solo tipos de cambio: ningún precio ni saldo es nuevo, así que todo el cambio queda sin atribuir hasta tu próxima carga completa.'))
    partes.push(...detalleExpress(fin, f1, d0, p))
  } else {
    // Con verbo, como la citan la visión §2 y el manual §4.1: "En dólares, tus
    // activos sumaron US$ 37 y la suba del CCL le restó US$ 377 a tus pesos."
    // Las cifras van sin signo (el verbo lo dice) y la UI las redondea juntas.
    const verbo = (c: Calc, suma: string, resta: string) => (c.valor === null ? '' : c.valor.lt(0) ? resta : suma)
    const abs = (c: Calc, m: Moneda) => (c.valor === null ? 'sin dato' : monto(c.valor.abs(), m))
    const c0 = v.ccl0.valor
    const c1 = v.ccl1.valor
    const elCcl = c0 === null || c1 === null || c0.eq(c1) ? 'el CCL' : c1.gt(c0) ? 'la suba del CCL' : 'la baja del CCL'
    partes.push(
      p(' En pesos, el CCL '),
      p(verbo(tc.ars, 'sumó ', 'restó ')),
      p(abs(tc.ars, 'ARS'), tc.ars),
      p(' y tus activos '),
      p(verbo(act.ars, 'sumaron ', 'restaron ')),
      p(abs(act.ars, 'ARS'), act.ars),
      p('. En dólares, tus activos '),
      p(verbo(act.usd, 'sumaron ', 'restaron ')),
      p(abs(act.usd, 'USD'), act.usd),
      p(` y ${elCcl} le `),
      p(verbo(tc.usd, 'sumó ', 'restó ')),
      p(abs(tc.usd, 'USD'), tc.usd),
      p(' a tus pesos.'),
    )
    if (hayAsin) {
      const todoFresco = fin.every((c) => !c.arrastrado && c.ancla?.hasta === d1)
      partes.push(
        p(todoFresco ? ' Incluye lo que había quedado sin atribuir en cargas anteriores y hoy se atribuye: ' : ' Sin atribuir (sin precio o saldo nuevo, o que vuelve de cargas anteriores): '),
        p(fm(sin.ars, 'ARS'), sin.ars),
        p(' · '),
        p(fm(sin.usd, 'USD'), sin.usd),
        p('.'),
      )
    }
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
    solo_tipos_de_cambio: soloTc,
    sin_ccl_nuevo: sinCclNuevo,
  }
}

const DIA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/**
 * Segunda oración de la frase de una carga express (visión 4.2): de dónde sale
 * el cambio, por grupo: cada CEDEAR, tus posiciones en pesos, tus pesos en
 * efectivo y tus dólares en efectivo, en cada moneda en que cambian.
 */
function detalleExpress(fin: Contribucion[], f1: Foto | null, d0: Fecha, p: (texto: string, c?: Calc | null) => ParteFrase): ParteFrase[] {
  const ticker = new Map((f1?.items ?? []).map((i) => [i.clave, i.ticker]))
  const grupos: { nombre: string; cs: Contribucion[] }[] = []
  for (const c of fin.filter((x) => x.clase === 'posicion' && x.moneda_riesgo === 'USD')) grupos.push({ nombre: `de ${ticker.get(c.clave) ?? c.nombre}`, cs: [c] })
  const resto = (nombre: string, f: (c: Contribucion) => boolean) => {
    const cs = fin.filter(f)
    if (cs.length) grupos.push({ nombre, cs })
  }
  resto('de tus posiciones en pesos', (c) => c.clase === 'posicion' && c.moneda_riesgo === 'ARS')
  resto('de tus pesos en efectivo', (c) => c.clase === 'saldo' && c.moneda_riesgo === 'ARS')
  const dolares = fin.filter((c) => c.clase === 'saldo' && c.moneda_riesgo === 'USD')
  if (dolares.length) grupos.push({ nombre: `de tus ${monto(dolares.reduce((a, c) => a.plus(c.v0?.usd ?? CERO), CERO), 'USD', { decimales: 0 })}`, cs: dolares })
  const lista = (k: 'ars' | 'usd'): ParteFrase[] => {
    const m: Moneda = k === 'ars' ? 'ARS' : 'USD'
    const items = grupos
      .map((g) => ({ g, total: g.cs.reduce((a, c) => a.plus(c.sin_atribuir[k]), CERO) }))
      .filter((x) => !x.total.toDecimalPlaces(0).isZero())
    const out: ParteFrase[] = []
    items.forEach((x, i) => {
      if (i > 0) out.push(p(i === items.length - 1 ? ' y ' : ', '))
      const c = calc(
        x.total,
        `${x.g.cs.map((y) => `${y.nombre} ${monto(y.sin_atribuir[k], m, { decimales: 2, signo: true })}`).join(' + ')} = ${monto(x.total, m, { decimales: 2, signo: true })}`,
        x.g.cs.map((y) => ({ nombre: y.nombre, valor: y.sin_atribuir[k].toFixed(), unidad: m })),
        { explicacion: 'Lo que cambia esta parte de tu cartera solo por valuarla al CCL nuevo con los precios y saldos de la carga anterior. Queda sin atribuir hasta su próxima observación fresca.' },
      )
      out.push(p(monto(x.total, m, { signo: true }), c), p(` ${x.g.nombre}`))
    })
    return out
  }
  const enUsd = lista('usd')
  const enArs = lista('ars')
  if (!enUsd.length && !enArs.length) return []
  const out = [p(` Es lo que da valuar al CCL nuevo lo que tenías el ${DIA_LARGO[diaSemana(d0)]}: `)]
  if (enUsd.length) out.push(p('en dólares, '), ...enUsd)
  if (enArs.length) out.push(p(enUsd.length ? '; en pesos, ' : 'en pesos, '), ...enArs)
  out.push(p('.'))
  return out
}

function movimientos(v: Variacion): MovimientoActivo[] {
  // B11: "Quién movió" muestra la parte de activos, no el resultado total.
  return v.contribuciones
    .filter((c) => c.clase === 'posicion' || c.clase === 'saldo')
    .map((c) => {
      const etiquetas: Etiqueta[] = c.inferido ? ['inferido'] : []
      const explicacion = `Lo que se movió ${c.nombre} en sí (sin el tipo de cambio${c.arrastrado ? '; sin precio o saldo nuevo no se atribuye' : ''}).${c.inferido ? ` Incluye una compra con ${EXPLICACION_INFERIDO}.` : ''}`
      return {
        orden: c.activo.ars.abs(),
        m: {
          clave: c.clave,
          nombre: c.nombre,
          aporte: par(
            calc(c.activo.ars, `activos de ${c.nombre} = ${monto(c.activo.ars, 'ARS', { decimales: 2, signo: true })}`, [], { etiquetas, explicacion }),
            calc(c.activo.usd, `activos de ${c.nombre} = ${monto(c.activo.usd, 'USD', { decimales: 2, signo: true })}`, [], { etiquetas, explicacion }),
          ),
          sin_precio_nuevo: c.arrastrado,
        },
      }
    })
    .sort((a, b) => b.orden.cmp(a.orden))
    .map((x) => x.m)
}

// ───────────── Exposición ─────────────

/** Bienes sin moneda de riesgo elegida (D-73: la elegís vos desde la 1b; el schema todavía no la tiene). */
function bienesSinRiesgo(f: Foto, vistaSel: Vista): ItemFoto[] {
  return vistaSel === 'total' ? f.items.filter((i) => i.clase === 'bien') : []
}

function resumenExposicion(f: Foto | null, vistaSel: Vista): ExposicionResumen {
  if (!f) {
    const n = vista(sinDato('Todavía no hay cargas.'))
    return { pesos_financieros: { ars: n, usd: n }, deuda_pesos: { ars: n, usd: n }, neto_ars: n, neto_usd: n, sensibilidad_usd_1pct: n }
  }
  // Los bienes no suman ni a los pesos ni a los dólares mientras no tengan
  // moneda de riesgo elegida (decisión D de la fase 1a; D-73).
  const items = itemsVista(f, vistaSel).filter((i) => i.clase !== 'bien')
  const bienes = bienesSinRiesgo(f, vistaSel)
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
  const ccl = f.ccl
  const pesosUsd = aDolares(pesosC, ccl, 'Pesos', 'Tus activos con riesgo en pesos, pasados a dólares al CCL de la carga.')
  const deudaUsd = aDolares(deudaC, ccl, 'Deuda en pesos', 'Lo que debés en pesos, en dólares al CCL de la carga. Si el CCL sube, en dólares se achica (se licúa).')
  const netoParcial =
    pesosC.valor === null || deudaC.valor === null
      ? sinDato('Falta un dato de pesos o de deuda.', [deCalc('Pesos', pesosC, 'ARS'), deCalc('Deuda', deudaC, 'ARS')])
      : calc(
          pesosC.valor.minus(deudaC.valor),
          `${monto(pesosC.valor, 'ARS', { decimales: 2 })} − ${monto(deudaC.valor, 'ARS', { decimales: 2 })} = ${monto(pesosC.valor.minus(deudaC.valor), 'ARS', { decimales: 2, signo: true })}`,
          [deCalc('Pesos financieros', pesosC, 'ARS'), deCalc('Deuda en pesos', deudaC, 'ARS')],
          { explicacion: 'Tu exposición neta al peso: lo que tenés en pesos menos lo que debés en pesos. Positivo = largo en pesos.' },
        )
  let neto: Calc = netoParcial
  if (bienes.length) {
    const nombres = bienes.map((b) => b.nombre)
    const uno = nombres.length === 1
    const lista = uno ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
    const parcial =
      netoParcial.valor === null ? 'sin dato' : `${netoParcial.valor.lt(0) ? 'corto' : 'largo'} ${monto(netoParcial.valor.abs(), 'ARS', { decimales: 2 })}`
    neto = sinDato(
      `${lista}: ${uno ? 'le' : 'les'} falta la moneda de riesgo, que vas a poder elegir desde la 1b (la app no la asume; D-73). Sin ${uno ? 'esa partida' : 'esas partidas'} no hay neto total. Suma parcial sin ${uno ? 'ella' : 'ellas'}: ${parcial}.`,
      [deCalc('Pesos financieros − deuda en pesos (suma parcial)', netoParcial, 'ARS'), ...bienes.map((b) => ({ nombre: `${b.nombre} · moneda de riesgo`, valor: null, unidad: 'texto' as const }))],
      { etiquetas: ['parcial'], explicacion: 'Tu exposición neta al peso contando tus bienes, cada uno en la moneda de riesgo que le elijas.' },
    )
  }
  const netoUsd =
    neto.valor === null || ccl.valor === null
      ? sinDato(neto.valor === null ? (neto.motivo ?? 'Falta el neto.') : 'Falta el CCL.', [deCalc('Neto', neto, 'ARS'), deCalc('CCL', ccl, 'ratio')], { etiquetas: neto.etiquetas.includes('parcial') ? ['parcial'] : [] })
      : calc(neto.valor.div(ccl.valor), `${monto(neto.valor, 'ARS', { decimales: 2, signo: true })} ÷ ${numero(ccl.valor, 2)} = ${monto(neto.valor.div(ccl.valor), 'USD', { decimales: 2, signo: true })}`, [deCalc('Neto', neto, 'ARS'), deCalc('CCL', ccl, 'ratio')], {
          explicacion: 'El neto en pesos pasado a dólares al CCL de la carga.',
        })
  const sens =
    netoUsd.valor === null
      ? sinDato(bienes.length ? 'Sin el neto total no hay sensibilidad.' : 'Falta el neto en dólares.', [deCalc('Neto en dólares', netoUsd, 'USD')])
      : calc(
          netoUsd.valor.negated().times('0.01').div('1.01'),
          `−(${monto(netoUsd.valor, 'USD', { decimales: 2 })}) × 0,01 ÷ 1,01 = ${monto(netoUsd.valor.negated().times('0.01').div('1.01'), 'USD', { decimales: 2, signo: true })}`,
          [deCalc('Neto en dólares', netoUsd, 'USD')],
          { explicacion: 'Cuánto cambia en dólares tu posición neta en pesos si el CCL sube 1%. Es una sensibilidad, no un pronóstico.' },
        )
  return {
    pesos_financieros: par(pesosC, pesosUsd),
    deuda_pesos: par(deudaC, deudaUsd),
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
      return { clave: k, nombre: nombre(k), color: color(k), valor: par(ars, usd), peso: vista(peso), orden: ars.valor }
    })
    .sort((a, b) => (b.orden ?? CERO).cmp(a.orden ?? CERO))
    .map(({ orden, ...s }) => {
      void orden
      return s
    })
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
      ccl: vacio,
      fecha_ccl: null,
      resumen,
      activos_en_pesos: { ars: vacio, usd: vacio },
      activos_en_dolares: { ars: vacio, usd: vacio },
      pasivos_en_pesos: { ars: vacio, usd: vacio },
      sin_moneda_de_riesgo: [],
      neto_pct: vacio,
      por_clase: [],
      por_moneda: [],
      por_geografia: [],
      concentracion: { top1: vacio, top1_nombre: null, top3: vacio },
      serie: [],
    }
  }
  const items = itemsVista(f, modo).filter((i) => i.clase !== 'pasivo')
  const bienes = bienesSinRiesgo(f, modo)
  const conRiesgo = items.filter((i) => i.clase !== 'bien')
  const totalArs = sumaItems(items, 'ARS', 'Total de activos de la vista (sin restar deudas).')
  const usdItems = conRiesgo.filter((i) => i.moneda_riesgo === 'USD')
  const netoArs = resumen.neto_ars.valor
  const netoPct =
    netoArs === null || totalArs.valor === null || totalArs.valor.isZero()
      ? sinDato(netoArs === null ? (resumen.neto_ars.motivo ?? 'Falta el neto.') : 'Falta el total.', [deCalc('Total de activos', totalArs, 'ARS')], {
          etiquetas: resumen.neto_ars.etiquetas.includes('parcial') ? ['parcial'] : [],
          explicacion: 'Tu exposición neta al peso como parte de tus activos.',
        })
      : calc(
          new Decimal(netoArs).div(totalArs.valor),
          `${monto(netoArs, 'ARS', { signo: true })} ÷ ${monto(totalArs.valor, 'ARS')} = ${porcentaje(new Decimal(netoArs).div(totalArs.valor), { signo: true })}`,
          [deCalc('Total de activos', totalArs, 'ARS')],
          { explicacion: 'Tu exposición neta al peso como parte de tus activos: (pesos − deuda en pesos) ÷ activos.' },
        )
  const total = totalArs.valor
  // La concentración se mide siempre sobre el patrimonio financiero (D-03, B19).
  const itemsFin = financieros(f)
  const totalFinC = sumaItems(itemsFin, 'ARS', 'Patrimonio financiero en pesos.')
  const totalFin = totalFinC.valor
  const posiciones = itemsFin
    .filter((i) => i.valor_ars.valor !== null)
    .sort((a, b) => (b.valor_ars.valor as Decimal).cmp(a.valor_ars.valor as Decimal))
  const top = (n: number): Calc => {
    if (totalFin === null)
      return sinDato(`Sin el total del patrimonio financiero no hay concentración. ${totalFinC.motivo ?? ''}`.trim(), [deCalc('Patrimonio financiero', totalFinC, 'ARS')], {
        etiquetas: ['parcial'],
        explicacion: 'Cuánto pesan tus posiciones más grandes sobre el patrimonio financiero (D-03).',
      })
    if (totalFin.isZero() || posiciones.length === 0) return sinDato('No hay posiciones valuadas.')
    const sel = posiciones.slice(0, n)
    const s = sel.reduce((a, i) => a.plus(i.valor_ars.valor as Decimal), CERO)
    return calc(s.div(totalFin), `${sel.map((i) => i.ticker).join(' + ')} = ${monto(s, 'ARS')} ÷ ${monto(totalFin, 'ARS')} = ${porcentaje(s.div(totalFin))}`, sel.map((i) => deCalc(i.nombre, i.valor_ars, 'ARS')), {
      explicacion: `${n === 1 ? 'Cuánto pesa tu posición más grande' : 'Cuánto pesan tus tres posiciones más grandes'} sobre el patrimonio financiero (D-03: la casa no es una posición).`,
    })
  }
  const pesosEnActivos = resumen.pesos_financieros
  // Composición por moneda de riesgo: los bienes van a "Sin elegir" (D-73).
  const porMoneda = segmentos(conRiesgo, (i) => i.moneda_riesgo, (k) => (k === 'ARS' ? 'Pesos' : 'Dólares'), (k) => (k === 'ARS' ? '#6b7a90' : '#2f5bd3'), total)
  if (bienes.length) {
    const ars = sumaItems(bienes, 'ARS', 'Bienes sin moneda de riesgo elegida, en pesos.')
    const usd = sumaItems(bienes, 'USD', 'Bienes sin moneda de riesgo elegida, en dólares.')
    const peso =
      ars.valor === null || total === null || total.isZero()
        ? sinDato('Falta un valor para calcular el peso.')
        : calc(ars.valor.div(total), `${monto(ars.valor, 'ARS')} ÷ ${monto(total, 'ARS')} = ${porcentaje(ars.valor.div(total))}`, [deCalc('Bienes sin moneda de riesgo', ars, 'ARS')], { explicacion: 'Qué parte de la vista representa este grupo.' })
    porMoneda.push({ clave: 'sin_elegir', nombre: 'Sin elegir', color: '#9aa1ac', valor: par(ars, usd), peso: vista(peso) })
  }
  return {
    fecha_datos: d1,
    vista: modo,
    ccl: vista(f.ccl),
    fecha_ccl: f.fecha_ccl,
    resumen,
    activos_en_pesos: pesosEnActivos,
    activos_en_dolares: par(sumaItems(usdItems, 'ARS', 'Activos que arriesgan dólares, en pesos.'), sumaItems(usdItems, 'USD', 'Activos que arriesgan dólares (CEDEARs, dólares), aunque coticen en pesos.')),
    pasivos_en_pesos: resumen.deuda_pesos,
    sin_moneda_de_riesgo: bienes.map((b) => b.nombre),
    neto_pct: vista(netoPct),
    por_clase: segmentos(items, (i) => i.tipo, (k) => NOMBRE_CLASE[k] ?? k, (k) => COLOR_CLASE[k] ?? '#888', total),
    por_moneda: porMoneda,
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
    const usd = items.filter((i) => i.moneda_riesgo === 'USD' && i.clase !== 'bien')
    const tot = sumaItems(items, 'ARS', '')
    const neto = r.neto_ars.valor
    return {
      fecha: d,
      activos_ars: r.pesos_financieros.ars.valor,
      activos_usd: sumaItems(usd, 'ARS', '').valor?.toFixed() ?? null,
      deuda_ars: r.deuda_pesos.ars.valor,
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
    return { fecha_datos: null, ccl: vista(vacio), fecha_ccl: null, filas: [], totales: { valor: par(vacio, vacio), resultado: par(vacio, vacio), costo: par(vacio, vacio) } }
  }
  const ix = indexar(h)
  const f = foto(h, d1, { hoy, ix })
  const items = financieros(f)
  const totalArs = sumaItems(items, 'ARS', EXPL_FIN.ARS)
  const totalUsd = sumaItems(items, 'USD', EXPL_FIN.USD)
  const armadas = items.map((i) => filaCartera(i, f, totalArs.valor, hoy, h))
  const conCosto = armadas.filter((a) => a.res !== null)
  const posiciones = items.filter((i) => i.clase === 'posicion')
  const costoArs = sumaCalc(posiciones.map((i) => ({ nombre: i.nombre, calc: costoCalc(i.tenencia!, 'ARS') })), 'ARS', 'Lo que te costaron tus títulos, en pesos.')
  const costoUsd = sumaCalc(posiciones.map((i) => ({ nombre: i.nombre, calc: costoCalc(i.tenencia!, 'USD') })), 'USD', 'Lo que te costaron tus títulos, en dólares al CCL de cada compra.')
  // B14: el total de resultados es la suma de los resultados de cada fila (la
  // suma parcial, si falta alguno, es de resultados y no de costos).
  const resTot = (m: Moneda) =>
    sumaCalc(
      conCosto.map((a) => ({ nombre: a.fila.ticker, calc: m === 'ARS' ? a.res!.ars : a.res!.usd })),
      m,
      m === 'ARS' ? 'Resultado de tus títulos desde la compra, en pesos, sumado fila por fila (la liquidez no tiene costo).' : 'Resultado de tus títulos desde la compra, en dólares (cada compra a su CCL), sumado fila por fila.',
    )
  return {
    fecha_datos: d1,
    ccl: vista(f.ccl),
    fecha_ccl: f.fecha_ccl,
    filas: armadas.map((a) => a.fila),
    totales: {
      valor: par(totalArs, totalUsd),
      resultado: par(resTot('ARS'), resTot('USD')),
      costo: par(costoArs, costoUsd),
    },
  }
}

/**
 * Desglose desde la compra (decisión E): suma de los intervalos entre
 * observaciones frescas, más un intervalo por lote antes de la primera al CCL
 * de compra. Si hubo una baja antes de la primera observación fresca, queda el
 * método anterior (un intervalo con el CCL promedio de compra), rotulado.
 */
function desgloseFila(i: ItemFoto, f: Foto, costoA: Calc, costoU: Calc, resA: Calc, resU: Calc, h: Hechos, hoy: Fecha): FilaCartera['desglose'] {
  const moneda: Moneda = i.moneda_riesgo === 'USD' ? 'ARS' : 'USD'
  const k = moneda === 'ARS' ? 'ars' : 'usd'
  const fm = (d: Decimal) => monto(d, moneda, { decimales: 2, signo: true })
  const res = moneda === 'ARS' ? resA : resU
  // Apertura sin CCL de compra: la UI ya explica qué falta y dónde se declara.
  const sinCclDeCompra = !i.ausente && Boolean(i.tenencia?.apertura_sin_ccl) && costoU.valor === null
  if (res.valor === null && !sinCclDeCompra) {
    // Las partes de un resultado "sin dato" (compra con precio pendiente,
    // tenencia que la fuente ya no lista) también lo son, con el mismo motivo
    // y sus etiquetas (I-9 de la referencia): mostrarlas sería mostrar cifras
    // que cambian cuando llega el dato.
    const n = vista(
      sinDato(res.motivo ?? 'Falta el resultado.', [deCalc(moneda === 'ARS' ? 'Resultado en pesos' : 'Resultado en dólares', res, moneda)], {
        etiquetas: res.etiquetas,
        explicacion: 'Sin el resultado de la fila no hay qué separar entre el activo y el tipo de cambio.',
      }),
    )
    return { moneda, activo: n, tc: n, sin_atribuir: n }
  }
  const dc = desgloseDesdeCompra(h, i.clave, f.fecha, { hoy })
  if (dc.tipo === 'sin_dato') {
    if (costoU.valor === null || costoA.valor === null) return null // la UI ya explica que falta el CCL o el costo
    const n = sinDato(dc.motivo)
    return { moneda, activo: vista(n), tc: vista(n), sin_atribuir: vista(n) }
  }
  if (dc.tipo === 'ok') {
    if (res.valor === null) return null
    const realizado = dc.resultado[k].minus(res.valor)
    const notaRealizado = realizado.abs().gt('1e-9') ? ` (incluye ${fm(realizado)} que no son de la tenencia vigente)` : ''
    const conVentas = dc.tramos.some((t) => t.descripcion.includes('(venta del '))
    const notaVigente = conVentas ? ' (solo la tenencia vigente: cada venta deja lo acumulado × cantidad después ÷ cantidad antes, como el costo)' : ''
    const parte = (sel: 'activo' | 'tc' | 'sin_atribuir', explicacion: string): CalcVista => {
      const tramos = dc.tramos.filter((t) => !t[sel][k].isZero())
      const pre = dc.tramos.filter((t) => t.tipo === 'compra').reduce((a, t) => a.plus(t[sel][k]), CERO)
      const dias = dc.tramos.filter((t) => t.tipo === 'intervalo')
      const enDias = dias.reduce((a, t) => a.plus(t[sel][k]), CERO)
      const formula =
        sel === 'sin_atribuir'
          ? `pendiente hoy (sin precio o CCL nuevo desde la última observación fresca) = ${fm(dc.sin_atribuir[k])}`
          : `antes de la primera observación (${fechaCorta(dc.primera)}, al CCL de compra) ${fm(pre)} + ${dias.length} intervalo(s) entre cargas desde entonces ${fm(enDias)} = ${fm(dc[sel][k])}${notaVigente}${sel === 'tc' ? notaRealizado : ''}`
      return vista(
        calc(
          dc[sel][k],
          formula,
          tramos.map((t) => ({ nombre: t.descripcion, valor: t[sel][k].toFixed(), unidad: moneda })),
          { explicacion },
        ),
      )
    }
    return {
      moneda,
      activo: parte('activo', i.moneda_riesgo === 'USD' ? 'Lo que ganaste en pesos porque se movió el activo (medido en dólares), sumando los intervalos entre cargas desde la compra (D-35).' : 'Lo que rindió el activo en pesos, pasado a dólares, sumando los intervalos entre cargas desde la compra (D-35).'),
      tc: parte('tc', i.moneda_riesgo === 'USD' ? 'Lo que ganaste en pesos solo porque cambió el CCL desde que compraste, sumando los intervalos entre cargas (D-35).' : 'Lo que ganaste o perdiste en dólares porque cambió el CCL desde que compraste, sumando los intervalos entre cargas (D-35).'),
      sin_atribuir: parte('sin_atribuir', 'Lo que todavía no se puede separar porque la última carga no trajo precio o CCL nuevo para esta posición: se atribuye en su próxima observación fresca.'),
    }
  }
  // no_aplica: un solo intervalo con el CCL promedio de compra = costo ARS ÷ costo USD.
  const ccl = f.ccl.valor
  if (!ccl || costoA.valor === null || costoU.valor === null || costoU.valor.isZero() || i.valor_ars.valor === null || i.valor_usd.valor === null) return null
  const cclProm = costoA.valor.div(costoU.valor)
  const insumos: Insumo[] = [deCalc('Costo en pesos', costoA, 'ARS'), deCalc('Costo en dólares', costoU, 'USD'), deCalc('CCL de hoy', f.ccl, 'ratio')]
  const nota = ` (${dc.motivo} Se usa un solo intervalo con el CCL promedio de compra.)`
  const cero = vista(calc(CERO, 'nada pendiente', [], { explicacion: 'Con un solo intervalo no queda nada sin atribuir.' }))
  if (i.moneda_riesgo === 'USD') {
    const tc = costoU.valor.times(ccl.minus(cclProm))
    const act = i.valor_usd.valor.minus(costoU.valor).times(ccl)
    return {
      moneda: 'ARS',
      activo: vista(calc(act, `resultado en dólares ${monto(i.valor_usd.valor.minus(costoU.valor), 'USD', { decimales: 2, signo: true })} × CCL ${numero(ccl, 2)} = ${monto(act, 'ARS', { decimales: 2, signo: true })}`, insumos, { explicacion: 'Lo que ganaste en pesos porque se movió el activo (medido en dólares).' + nota })),
      tc: vista(calc(tc, `${monto(costoU.valor, 'USD', { decimales: 2 })} × (CCL ${numero(ccl, 2)} − CCL de compra ${numero(cclProm, 2)}) = ${monto(tc, 'ARS', { decimales: 2, signo: true })}`, insumos, { explicacion: 'Lo que ganaste en pesos solo porque subió el CCL desde que compraste.' + nota })),
      sin_atribuir: cero,
    }
  }
  const act = i.valor_ars.valor.minus(costoA.valor).div(cclProm)
  const tc = i.valor_ars.valor.times(new Decimal(1).div(ccl).minus(new Decimal(1).div(cclProm)))
  return {
    moneda: 'USD',
    activo: vista(calc(act, `resultado en pesos ${monto(i.valor_ars.valor.minus(costoA.valor), 'ARS', { decimales: 2, signo: true })} ÷ CCL de compra ${numero(cclProm, 2)} = ${monto(act, 'USD', { decimales: 2, signo: true })}`, insumos, { explicacion: 'Lo que rindió el activo en pesos, pasado a dólares al CCL de compra.' + nota })),
    tc: vista(calc(tc, `${monto(i.valor_ars.valor, 'ARS', { decimales: 2 })} × (1/${numero(ccl, 2)} − 1/${numero(cclProm, 2)}) = ${monto(tc, 'USD', { decimales: 2, signo: true })}`, insumos, { explicacion: 'Lo que perdiste o ganaste en dólares porque cambió el CCL desde que compraste.' + nota })),
    sin_atribuir: cero,
  }
}

function filaCartera(i: ItemFoto, f: Foto, totalArs: Decimal | null, hoy: Fecha, h: Hechos): { fila: FilaCartera; res: { ars: Calc; usd: Calc } | null } {
  const peso =
    i.valor_ars.valor === null || totalArs === null || totalArs.isZero()
      ? sinDato('Falta un valor para calcular el peso.')
      : calc(i.valor_ars.valor.div(totalArs), `${monto(i.valor_ars.valor, 'ARS')} ÷ ${monto(totalArs, 'ARS')} = ${porcentaje(i.valor_ars.valor.div(totalArs))}`, [deCalc('Valor', i.valor_ars, 'ARS')], {
          explicacion: 'Qué parte de tu patrimonio financiero es esta fila.',
        })
  const noAplica = sinDato('No aplica a la liquidez: no tiene costo de compra.')
  if (i.clase !== 'posicion' || !i.tenencia) {
    return {
      res: null,
      fila: {
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
        costo: null,
        valor: par(i.valor_ars, i.valor_usd),
        resultado: par(noAplica, noAplica),
        resultado_pct: par(noAplica, noAplica),
        desglose: null,
        peso: vista(peso),
        dias_en_posicion: null,
        dias_desde: null,
        ganas_pesos_perdes_dolares: false,
        pendiente: null,
      },
    }
  }
  const t = i.tenencia
  const costoA = costoCalc(t, 'ARS')
  const costoU = costoCalc(t, 'USD')
  const res = (val: Calc, costo: Calc, m: Moneda): Calc =>
    val.valor === null || costo.valor === null
      ? sinDato(
          i.ausente ? i.ausente.motivo : costo.valor === null ? (costo.motivo ?? 'Falta el costo.') : (val.motivo ?? 'Falta el valor.'),
          [deCalc('Valor', val, m), deCalc('Costo', costo, m)],
          { etiquetas: costo.etiquetas },
        )
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
  const desglose = desgloseFila(i, f, costoA, costoU, resA, resU, h, hoy)
  const pendiente = i.ausente
    ? i.ausente.motivo
    : t.etiquetas.includes('pendiente')
    ? 'Compra con precio pendiente: se completa con el PPP de la próxima carga.'
    : costoU.valor === null && t.apertura_sin_ccl
      ? 'Falta el CCL de compra de la apertura: se declara desde la 1b (Pendientes). Hasta entonces, el PPC y el resultado en dólares desde la compra son "sin dato".'
      : null
  return {
    res: { ars: resA, usd: resU },
    fila: {
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
      costo: par(costoA, costoU),
      valor: par(i.valor_ars, i.valor_usd),
      resultado: par(resA, resU),
      resultado_pct: par(pct(resA, costoA, 'ARS'), pct(resU, costoU, 'USD')),
      desglose,
      peso: vista(peso),
      dias_en_posicion: t.fecha_inicio ? diasEntre(t.fecha_inicio, hoy) : null,
      dias_desde: t.fecha_inicio === null ? null : t.fecha_declarada ? 'declarada' : t.desde_apertura ? 'apertura' : 'compra',
      // B18: el cero no gana ni pierde.
      ganas_pesos_perdes_dolares: resA.valor !== null && resU.valor !== null && resA.valor.gt(0) && resU.valor.lt(0),
      pendiente,
    },
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
  else if (f.fecha_ccl && f.fecha_ccl !== f.fecha)
    out.push({
      id: `ccl-arrastrado:${f.fecha}`,
      gravedad: f.ccl.etiquetas.includes('viejo') ? 'alta' : 'media',
      titulo: `El ${fechaCorta(f.fecha)} no tiene CCL`,
      detalle: `Los dólares usan el CCL del ${fechaCorta(f.fecha_ccl)} y el cambio del día queda sin atribuir hasta que cargues uno.`,
      accion: { etiqueta: 'Cargar', href: '/carga' },
    })
  for (const i of f.items) {
    if (i.ausente) {
      // D-47: lo que dejaste pendiente en la bandeja vive en Atención. Tapa el
      // "dato viejo" y lo demás de la fila: Cargar arregla esto, no aquello.
      out.push({
        id: `ausente:${i.clave}:${i.ausente.fecha}`,
        gravedad: 'alta',
        titulo: `${i.ticker}: ${i.cuenta?.nombre ?? 'tu cuenta'} ya no la lista`,
        detalle: `${i.ausente.motivo} Mientras tanto vale "sin dato" y los totales que la incluyen muestran la suma parcial.`,
        accion: { etiqueta: 'Cargar', href: '/carga' },
      })
      continue
    }
    if (i.clase === 'posicion' && i.precio.valor === null)
      out.push({ id: `sin-precio:${i.clave}`, gravedad: 'alta', titulo: `${i.ticker}: sin precio`, detalle: i.valor_ars.motivo ?? 'No hay un precio cargado para valuarlo.', accion: { etiqueta: 'Cargar', href: '/carga' } })
    else if (i.viejo && i.clase !== 'pasivo')
      out.push({ id: `viejo:${i.clave}`, gravedad: 'media', titulo: `${i.ticker}: dato viejo`, detalle: `El último dato es del ${i.fecha_dato ? fechaCorta(i.fecha_dato) : '—'} (más de 2 días hábiles).`, accion: { etiqueta: 'Cargar', href: '/carga' } })
    if (i.tenencia?.etiquetas.includes('pendiente'))
      out.push({ id: `pendiente:${i.clave}`, gravedad: 'media', titulo: `${i.ticker}: compra con precio pendiente`, detalle: `Se completa con el PPP de la próxima carga de IEB. Mientras tanto, el día usa el precio de mercado (${EXPLICACION_INFERIDO}).`, accion: null })
    else if (i.tenencia && i.tenencia.costo_usd === null && i.tenencia.apertura_sin_ccl)
      out.push({ id: `ccl-compra:${i.clave}`, gravedad: 'baja', titulo: `${i.ticker}: declarar CCL de compra`, detalle: 'Sin el CCL de compra de la apertura, el PPC y el resultado en dólares desde la compra son "sin dato". Se declara desde la 1b (Pendientes).', accion: null })
  }
  for (const b of f.items.filter((x) => x.clase === 'bien' && x.precio.valor === null))
    out.push({ id: `valuacion:${b.clave}`, gravedad: 'media', titulo: `${b.nombre}: sin valuación`, detalle: 'Cargá una valuación con fecha y fuente.', accion: { etiqueta: 'Cargar valuación', href: '/datos/bienes' } })
  for (const p of f.items.filter((x) => x.clase === 'pasivo' && x.precio.valor === null))
    out.push({ id: `capital:${p.clave}`, gravedad: 'alta', titulo: `${p.nombre}: sin capital pendiente`, detalle: 'Sin el capital informado, la exposición no puede netear la deuda.', accion: { etiqueta: 'Cargar capital', href: '/datos/leasing' } })
  if (h.pasivos.length === 0)
    out.push({ id: 'sin-leasing', gravedad: 'media', titulo: 'Cargá el leasing', detalle: 'La deuda en pesos netea contra tus pesos (spec §3).', accion: { etiqueta: 'Cargar leasing', href: '/datos/leasing' } })
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
