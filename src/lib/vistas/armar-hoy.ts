// Hoy (rediseño del 15/10, D-157; handoff "Portfolio UI", capturas 01 y 02):
// las cuentas que suma la pantalla, en funciones puras con test
// (armar-hoy.test.ts). armarHoy (./armar) arma con ellas lo barato (activos,
// pasivos y el CCL del período); el contexto de Hoy (./contexto-hoy), lo que
// solo paga la pantalla de Hoy (la serie de 12 meses y "Próximos 30 días").
// Nada se guarda: todo sale de los hechos, con su traza, y lo que falta es
// "sin dato" con su motivo, nunca cero.

import { calc, deCalc, sinDato, vista, type Calc, type CalcVista } from '@/lib/domain/calc'
import { COLOR_LIQUIDEZ_ARS } from '@/lib/domain/colores'
import { CERO, Decimal, monto, numero, porcentaje } from '@/lib/domain/dinero'
import type { BaseProyeccion } from '@/lib/domain/flujo/tipos'
import { cclA, foto, indexar, sumaCalc, type Foto, type ItemFoto } from '@/lib/domain/foto'
import { diasEntre, fechaCorta, sumarDias } from '@/lib/domain/fechas'
import type { Fecha, Hechos, Moneda } from '@/lib/domain/tipos'
import { fechasDeCarga } from '@/lib/domain/variacion'
import type { Par } from './contratos'
import type { BalanceHoy, CclPeriodo, EventoProximo, PuntoPatrimonio, SeriePatrimonio, TramoHoy } from './contratos-hoy'

const par = (ars: Calc, usd: Calc): Par => ({ ars: vista(ars), usd: vista(usd) })

// ───────────── Lo que le falta al patrimonio total (D-03, D-126) ─────────────

export const SIN_LEASING = 'Todavía no cargaste el leasing: lo cargás en Datos › Leasing.'
export const SIN_BIENES = 'Todavía no cargaste tus bienes (casa, auto): los cargás en Datos › Bienes.'

/**
 * Lo que el patrimonio total necesita y todavía no cargaste (D-03): sin eso,
 * el total es "sin dato" con la suma parcial a la vista (D-65), nunca el
 * financiero presentado como total ni una deuda de $ 0. Un bien dado de baja
 * se cargó: sin bienes activos, el total es el financiero − deudas.
 */
export function faltanParaElTotal(h: Pick<Hechos, 'bienes' | 'pasivos'>): { nombre: string; calc: Calc }[] {
  const out: { nombre: string; calc: Calc }[] = []
  if (h.bienes.length === 0) out.push({ nombre: 'Tus bienes (casa, auto)', calc: sinDato(SIN_BIENES) })
  if (h.pasivos.length === 0) out.push({ nombre: 'Capital pendiente del leasing', calc: sinDato(SIN_LEASING) })
  return out
}

// ───────────── Activos y pasivos: el patrimonio neto, de qué está hecho ─────────────

const EXPL = {
  activos: {
    ARS: 'Lo que tenés, sin restar deudas: lo financiero (títulos y liquidez) más tus bienes, en pesos (D-03).',
    USD: 'Lo que tenés, sin restar deudas: lo financiero (títulos y liquidez) más tus bienes, en dólares al CCL de la carga (D-03).',
  },
  bienes: {
    ARS: 'Tus bienes (la casa, la camioneta) a su última valuación, en pesos.',
    USD: 'Tus bienes (la casa, la camioneta) a su última valuación, en dólares al CCL de la carga.',
  },
  pasivos: {
    ARS: 'Lo que debés, con signo negativo: la deuda del leasing (la informada, la según el cuadro de marcha o la estimada, D-131). Resta en el patrimonio neto.',
    USD: 'Lo que debés, con signo negativo, en dólares al CCL de la carga. Resta en el patrimonio neto.',
  },
  liquidez: {
    ARS: 'Tus pesos y dólares en las cuentas, juntos, en pesos.',
    USD: 'Tus pesos y dólares en las cuentas, juntos, en dólares al CCL de la carga.',
  },
}

const ROTULO_DEUDA: Record<string, string> = { leasing: 'LEASING', tarjeta: 'TARJETA', prestamo: 'PRÉSTAMO' }

const valorEn = (i: ItemFoto, m: Moneda) => (m === 'ARS' ? i.valor_ars : i.valor_usd)
const idDe = (clave: string) => Number(clave.split(':')[1])

/** La parte de `total` que es `parte`, como fracción en texto: null si no se puede dibujar (falta algo, o no es positivo). */
export function pesoEn(parte: string | null, total: string | null): string | null {
  if (parte === null || total === null) return null
  const t = new Decimal(total)
  const p = new Decimal(parte)
  if (!t.gt(0) || !p.gt(0)) return null
  return p.div(t).toFixed()
}

/**
 * Activos (financiero + bienes), bienes y pasivos a la fecha de la foto, cada
 * uno con su traza, y los tramos de "Qué tenés y qué debés": una partida por
 * tramo (la liquidez, junta), en el color de cada activo (D-157). Los
 * dolarizados primero, después lo que está en pesos, la liquidez y los bienes.
 */
export function balanceHoy(h: Hechos, f: Foto): BalanceHoy {
  const posiciones = f.items.filter((i) => i.clase === 'posicion')
  const saldos = f.items.filter((i) => i.clase === 'saldo')
  const bienesItems = f.items.filter((i) => i.clase === 'bien')
  const deudas = f.items.filter((i) => i.clase === 'pasivo')
  const sinBienes = h.bienes.length === 0
  const sinPasivos = h.pasivos.length === 0

  const activos = (m: Moneda) =>
    sumaCalc(
      [
        ...[...posiciones, ...saldos, ...bienesItems].map((i) => ({ nombre: i.nombre, calc: valorEn(i, m) })),
        ...(sinBienes ? [{ nombre: 'Tus bienes (casa, auto)', calc: sinDato(SIN_BIENES) }] : []),
      ],
      m,
      EXPL.activos[m],
    )
  const bienes = (m: Moneda) =>
    sinBienes ? sinDato(SIN_BIENES, [], { explicacion: EXPL.bienes[m] }) : sumaCalc(bienesItems.map((i) => ({ nombre: i.nombre, calc: valorEn(i, m) })), m, EXPL.bienes[m])
  const pasivos = (m: Moneda) =>
    sinPasivos ? sinDato(SIN_LEASING, [], { explicacion: EXPL.pasivos[m] }) : sumaCalc(deudas.map((i) => ({ nombre: i.nombre, calc: valorEn(i, m) })), m, EXPL.pasivos[m])

  const a = par(activos('ARS'), activos('USD'))
  const totalArs = a.ars.valor

  const tramo = (clave: string, rotulo: string, nombre: string, color: string, valor: Par, positivo = true): TramoHoy => ({
    clave,
    rotulo,
    nombre,
    color,
    valor,
    peso: pesoEn(positivo ? valor.ars.valor : valor.ars.valor === null ? null : new Decimal(valor.ars.valor).abs().toFixed(), totalArs),
  })
  // De mayor a menor; lo que no tiene valor, al final.
  const porValor = (x: ItemFoto, y: ItemFoto) => {
    const vx = x.valor_ars.valor
    const vy = y.valor_ars.valor
    if (vx === null || vy === null) return vx === null ? (vy === null ? 0 : 1) : -1
    return vy.cmp(vx)
  }
  const dolar = posiciones.filter((i) => i.moneda_riesgo === 'USD').sort(porValor)
  const pesos = posiciones.filter((i) => i.moneda_riesgo !== 'USD').sort(porValor)
  const tramos_activos: TramoHoy[] = [...dolar, ...pesos].map((i) => tramo(i.clave, i.ticker, i.nombre, i.color, par(i.valor_ars, i.valor_usd)))
  if (saldos.length) {
    const liq = (m: Moneda) => sumaCalc(saldos.map((i) => ({ nombre: i.nombre, calc: valorEn(i, m) })), m, EXPL.liquidez[m])
    tramos_activos.push(tramo('liquidez', 'LIQ', 'Liquidez', COLOR_LIQUIDEZ_ARS, par(liq('ARS'), liq('USD'))))
  }
  for (const i of [...bienesItems].sort(porValor)) tramos_activos.push(tramo(i.clave, i.nombre.toLocaleUpperCase('es-AR'), i.nombre, i.color, par(i.valor_ars, i.valor_usd)))

  const tipoDe = new Map(h.pasivos.map((p) => [p.id, p.tipo]))
  const tramos_pasivos: TramoHoy[] = deudas.map((i) =>
    tramo(i.clave, ROTULO_DEUDA[tipoDe.get(idDe(i.clave)) ?? ''] ?? i.nombre.toLocaleUpperCase('es-AR'), i.nombre, i.color, par(i.valor_ars, i.valor_usd), false),
  )

  return {
    activos: a,
    bienes: par(bienes('ARS'), bienes('USD')),
    pasivos: par(pasivos('ARS'), pasivos('USD')),
    tramos_activos,
    tramos_pasivos,
  }
}

// ───────────── El CCL del período de la frase ─────────────

/** El CCL de las dos puntas y cuánto cambió (hasta ÷ desde − 1), con su traza. */
export function cclPeriodo(ccl0: Calc, ccl1: Calc, d0: Fecha, d1: Fecha): CclPeriodo {
  const ins = [deCalc(`CCL del ${fechaCorta(d0)}`, ccl0, 'ratio'), deCalc(`CCL del ${fechaCorta(d1)}`, ccl1, 'ratio')]
  const explicacion = 'Cuánto cambió el CCL entre las dos cargas: es lo que mueve, en pesos, todo lo que arriesga dólares.'
  let variacion: Calc
  if (ccl0.valor === null || ccl1.valor === null) {
    variacion = sinDato(ccl0.valor === null ? `Falta el CCL del ${fechaCorta(d0)}.` : `Falta el CCL del ${fechaCorta(d1)}.`, ins, { explicacion })
  } else if (ccl0.valor.isZero()) {
    variacion = sinDato('El CCL de la carga anterior es cero.', ins, { explicacion })
  } else {
    const r = ccl1.valor.div(ccl0.valor).minus(1)
    variacion = calc(r, `${numero(ccl1.valor, 2)} ÷ ${numero(ccl0.valor, 2)} − 1 = ${porcentaje(r, { signo: true })}`, ins, { explicacion })
  }
  return { desde: vista(ccl0), hasta: vista(ccl1), variacion: vista(variacion) }
}

// ───────────── El patrimonio neto en el tiempo ─────────────

/** La misma fecha, `meses` meses antes (el 31 de un mes corto cae en su último día). */
export function restarMeses(f: Fecha, meses: number): Fecha {
  const [a, m, d] = f.split('-').map(Number)
  const total = a * 12 + (m - 1) - meses
  const anio = Math.floor(total / 12)
  const mes = (total % 12) + 1
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}

/** El último día del mes de una fecha. */
export function finDeMes(f: Fecha): Fecha {
  const [a, m] = f.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return `${a}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
}

function variacionSerie(puntos: PuntoPatrimonio[], m: Moneda, motivo: string | null): Calc {
  const k = m === 'ARS' ? 'ars' : 'usd'
  const conDato = puntos.filter((p) => p[k] !== null)
  const explicacion = `Cuánto cambió tu patrimonio neto ${m === 'ARS' ? 'en pesos' : 'en dólares'} entre la primera y la última carga de la serie. Incluye lo que pusiste o sacaste: no es un resultado (eso está en Evolución y PnL).`
  if (motivo) return sinDato(motivo, [], { explicacion })
  if (conDato.length < 2) return sinDato('Hace falta una segunda carga para ver cuánto cambió.', [], { explicacion })
  const p0 = conDato[0]
  const p1 = conDato[conDato.length - 1]
  const a = new Decimal(p0[k] as string)
  const b = new Decimal(p1[k] as string)
  const ins = [
    { nombre: `Patrimonio neto del ${fechaCorta(p0.fecha)}`, valor: a.toFixed(), unidad: m },
    { nombre: `Patrimonio neto del ${fechaCorta(p1.fecha)}`, valor: b.toFixed(), unidad: m },
  ]
  if (!a.gt(0)) return sinDato('El patrimonio neto del primer día no es positivo: un porcentaje no dice nada.', ins, { explicacion })
  const r = b.div(a).minus(1)
  return { valor: r, formula: `${monto(b, m)} ÷ ${monto(a, m)} − 1 = ${porcentaje(r, { signo: true })}`, insumos: ins, etiquetas: [], explicacion }
}

/**
 * El patrimonio neto (el mismo de la tarjeta: financiero + bienes − deudas) en
 * cada fecha de carga de los últimos `meses` meses: una foto por fecha, sin
 * traza (solo valores) y nunca un punto inventado entre cargas. Con un día sin
 * dato, ese punto es null (un hueco es un hueco). Sin bienes o sin leasing
 * cargados no hay patrimonio neto (D-126): la serie vuelve vacía con el motivo.
 */
export function seriePatrimonio(h: Hechos, hoy: Fecha, meses = 12): SeriePatrimonio {
  const todas = fechasDeCarga(h).filter((f) => f <= hoy)
  const limite = restarMeses(hoy, meses)
  const fechas = todas.filter((f) => f >= limite)
  const faltan = faltanParaElTotal(h)
  const vacia = (motivo: string): SeriePatrimonio => {
    const c = vista(sinDato(motivo))
    return { puntos: [], periodo: null, variacion: { ars: c, usd: c }, ccl: null, motivo }
  }
  if (!todas.length) return vacia('Todavía no hay cargas.')
  if (!fechas.length) return vacia(`No hay cargas en los últimos ${meses} meses.`)
  if (faltan.length) return vacia(`${faltan.map((x) => x.calc.motivo).join(' ')} Sin eso no hay patrimonio neto.`)

  const ix = indexar(h)
  const ultima = fechas[fechas.length - 1]
  const puntos: PuntoPatrimonio[] = fechas.map((d) => {
    const f = foto(h, d, { hoy: d === ultima ? hoy : d, ix, traza: false })
    const suma = (m: Moneda): string | null => {
      let s = CERO
      for (const i of f.items) {
        const v = valorEn(i, m).valor
        if (v === null) return null
        s = s.plus(v)
      }
      return s.toFixed()
    }
    return { fecha: d, ars: suma('ARS'), usd: suma('USD') }
  })
  const primera = fechas[0]
  return {
    puntos,
    periodo: { desde: primera, hasta: ultima, completo: todas.some((f) => f < limite) },
    variacion: { ars: vista(variacionSerie(puntos, 'ARS', null)), usd: vista(variacionSerie(puntos, 'USD', null)) },
    ccl: { desde: vista(cclA(ix, primera, primera).calc), hasta: vista(cclA(ix, ultima, hoy).calc) },
    motivo: null,
  }
}

// ───────────── Próximos 30 días ─────────────

const enDias = (n: number) => (n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`)

/** Un monto en pesos con su par en dólares al CCL de la base de Flujo. */
function parDesdePesos(ars: Calc, ccl: Calc, explicacionUsd: string): Par {
  if (ars.valor === null) return par(ars, sinDato(ars.motivo ?? 'Falta el monto en pesos.', [deCalc('En pesos', ars, 'ARS')], { explicacion: explicacionUsd }))
  if (ccl.valor === null || ccl.valor.isZero()) {
    return par(ars, sinDato('Falta el CCL para pasar a dólares.', [deCalc('En pesos', ars, 'ARS'), deCalc('CCL', ccl, 'ratio')], { explicacion: explicacionUsd }))
  }
  const u = ars.valor.div(ccl.valor)
  return par(
    ars,
    calc(u, `${monto(ars.valor, 'ARS', { decimales: 2 })} ÷ CCL ${numero(ccl.valor, 2)} = ${monto(u, 'USD', { decimales: 2 })}`, [deCalc('En pesos', ars, 'ARS'), deCalc('CCL', ccl, 'ratio')], {
      explicacion: explicacionUsd,
      etiquetas: ars.etiquetas,
    }),
  )
}

/**
 * "Próximos 30 días" (handoff, fila 3): lo que pasa con fecha desde hoy hasta
 * `dias` días adelante, en orden. Sale de la base de Flujo (la misma que
 * proyecta), sin guardar nada:
 * - la carga de hoy que falta (si ya cerró BYMA, D-127);
 * - las cuotas del leasing sin pagar que vencen en el período, y la más vieja
 *   que ya venció y tu planilla no marca pagada;
 * - lo que cobrás de tus bonos y letras (a menos de 15 días, en alerta);
 * - el cierre del mes, para cargar lo real.
 */
export function proximosDias(base: BaseProyeccion | null, hoy: Fecha, o: { dias?: number; cargaPendiente?: boolean } = {}): EventoProximo[] {
  const dias = o.dias ?? 30
  const hasta = sumarDias(hoy, dias)
  const out: EventoProximo[] = []
  if (o.cargaPendiente) {
    out.push({ id: 'carga-hoy', tipo: 'carga', fecha: hoy, titulo: 'Todavía no cargaste hoy', detalle: 'Ya cerró BYMA: los datos del día están para cargar.', valor: null, alerta: true, href: '/carga' })
  }
  if (base) {
    const cclD = base.ccl === null ? null : new Decimal(base.ccl)
    const ccl: Calc = cclD
      ? calc(cclD, `CCL del ${fechaCorta(base.fecha)} = ${numero(cclD, 2)}`, [], { explicacion: 'El CCL de tu última carga: pasa a dólares lo que vence.' })
      : sinDato('Falta el CCL de tu última carga.')
    const pagadorDe = new Map((base.pasivos ?? []).map((p) => [p.id, p.pagador_habitual]))
    const nombreDe = new Map((base.pasivos ?? []).map((p) => [p.id, p.nombre]))
    // La más vieja impaga de cada pasivo, si ya venció: puede que tu planilla no esté al día.
    const vencidas = new Map<number, (typeof base.cuotas)[number]>()
    for (const c of [...base.cuotas].sort((x, y) => x.nro - y.nro)) {
      if (!c.pagada && c.fecha_vencimiento < hoy && !vencidas.has(c.pasivo_id)) vencidas.set(c.pasivo_id, c)
    }
    for (const c of base.cuotas) {
      if (c.pagada || c.fecha_vencimiento > hasta) continue
      const vencida = c.fecha_vencimiento < hoy
      if (vencida && vencidas.get(c.pasivo_id) !== c) continue
      const quien = c.pagador ?? pagadorDe.get(c.pasivo_id) ?? 'titular'
      const nombre = nombreDe.get(c.pasivo_id)
      const total = new Decimal(c.total)
      const ars = calc(total, `cuota ${c.nro} = ${monto(total, 'ARS', { decimales: 2 })}`, [], {
        etiquetas: c.etiquetas,
        explicacion: 'La cuota entera del cuadro de marcha: lo que se debita (canon, IVA, seguro y percepción).',
      })
      out.push({
        id: `cuota-${c.pasivo_id}-${c.nro}`,
        tipo: 'cuota',
        fecha: c.fecha_vencimiento,
        titulo: `Cuota ${c.nro} del ${nombre && !/^leasing/i.test(nombre) ? nombre : 'leasing'}`,
        detalle: vencida ? `Venció el ${fechaCorta(c.fecha_vencimiento)} y tu planilla no la marca pagada` : quien === 'empresa' ? 'La paga la empresa' : 'La pagás vos',
        valor: parDesdePesos(ars, ccl, 'La cuota en dólares al CCL de tu última carga.'),
        alerta: vencida,
        href: '/pasivos',
      })
    }
    for (const v of base.vencimientos) {
      if (v.fecha < hoy || v.fecha > hasta) continue
      const n = diasEntre(hoy, v.fecha)
      const ars =
        v.monto_ars === null
          ? sinDato(v.motivo ?? 'Falta el pago al vencimiento.')
          : calc(
              new Decimal(v.monto_ars),
              `${numero(v.cantidad ?? '0', 0)} VN × ${monto(v.pago_por_vn ?? '0', 'ARS', { decimales: 4 })} = ${monto(v.monto_ars, 'ARS', { decimales: 2 })}`,
              [],
              { explicacion: `Lo que cobrás de ${v.ticker}: tus VN por el pago de cada VN${v.fuente ? ` (${v.fuente})` : ''}.` },
            )
      out.push({
        id: `vence-${v.ticker}-${v.fecha}`,
        tipo: 'vencimiento',
        fecha: v.fecha,
        titulo: `${v.es_ultimo ? 'Vence' : 'Paga'} ${v.ticker}`,
        detalle: `${enDias(n)} · cobrás`,
        valor: parDesdePesos(ars, ccl, `Lo que cobrás de ${v.ticker}, en dólares al CCL de tu última carga.`),
        alerta: n < 15,
        href: '/flujo',
      })
    }
  }
  const cierre = finDeMes(hoy)
  out.push({ id: `cierre-${cierre}`, tipo: 'cierre', fecha: cierre, titulo: 'Cierre del mes', detalle: 'Cargá el flujo real', valor: null, alerta: false, href: '/flujo/cargar?sentido=ingreso' })
  const orden = { carga: 0, cuota: 1, vencimiento: 2, cierre: 3 }
  return out.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : orden[x.tipo] - orden[y.tipo]))
}
