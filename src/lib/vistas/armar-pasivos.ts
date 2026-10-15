// Arma la vista de Pasivos a partir de los hechos (puro: corre en el servidor
// y en los tests). Toda cifra sale de las funciones de src/lib/domain/pasivos
// con su traza, en pesos y en dólares; acá solo se ordena y se arma la frase.

import { calc, deCalc, sinDato, vista, type Calc, type CalcVista, type DobleCalc } from '@/lib/domain/calc'
import { compacto, Decimal, monto, numero } from '@/lib/domain/dinero'
import { conjuntoFeriados, esViejo, fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import {
  aDolares,
  aperturasCuotas,
  aPesos,
  campoCuota,
  capitalSegunCuadro,
  cclDelPago,
  cuotasAlDia,
  cuotaEnUsd,
  licuacionDeuda,
  licuacionPagadas,
  recuperoFiscal,
  resumenLeasing,
  subtotalCuota,
  totalCuota,
  totalesApertura,
} from '@/lib/domain/pasivos/cuadro'
import { cargosPorCuota } from '@/lib/domain/pasivos/cargos'
import { faltanParaTasa, temDeTea, tirContrato } from '@/lib/domain/pasivos/tir'
import type { AperturaCuota, ContratoPasivo, Cuota, FuenteCuota, HechosPasivos } from '@/lib/domain/pasivos/tipos'
import type { Fecha, Hechos } from '@/lib/domain/tipos'
import { fechasDeCarga } from '@/lib/domain/variacion'
import type { CargoVista, DeudaConOrigen, FilaCuota, Par, ParteFrase, TotalesApertura, VistaLeasing, VistaPasivos } from './contratos-pasivos'

const par = (d: DobleCalc): Par => ({ ars: vista(d.ars), usd: vista(d.usd) })

/** La fecha del último CCL cargado hasta hoy (null si no hay ninguno). */
export function fechaCclDeHoy(h: Pick<Hechos, 'tipos_cambio'>, hoy: Fecha): Fecha | null {
  return [...h.tipos_cambio].filter((x) => x.ccl !== null && x.fecha <= hoy).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0]?.fecha ?? null
}

/** El CCL de hoy: el último cargado hasta hoy, "viejo" si pasaron más de 2 días hábiles. */
export function cclDeHoy(h: Pick<Hechos, 'tipos_cambio' | 'feriados'>, hoy: Fecha): Calc {
  const t = [...h.tipos_cambio].filter((x) => x.ccl !== null && x.fecha <= hoy).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0]
  if (!t || t.ccl === null) return sinDato('Todavía no cargaste ningún CCL.')
  const viejo = esViejo(t.fecha, hoy, conjuntoFeriados(h.feriados))
  return calc(t.ccl, `CCL del ${fechaCorta(t.fecha)} = ${numero(t.ccl, 2)}`, [{ nombre: `CCL del ${fechaLarga(t.fecha)}`, valor: t.ccl.toFixed(), unidad: 'ratio', origen: { carga_id: t.carga_id } }], {
    etiquetas: viejo ? ['viejo'] : [],
    explicacion: 'El último CCL que cargaste. Pasa a dólares lo que falta pagar como referencia: no es lo que va a costar.',
  })
}

const NOMBRE_FUENTE: Record<FuenteCuota, string> = { comprobante: 'comprobante', contrato: 'contrato', supuesto: 'supuesto', a_confirmar: 'a confirmar', no_aplica: 'no aplica' }

function fuenteTexto(c: Cuota): string {
  const fs = [c.fuente_canon, c.fuente_seguro, c.fuente_otros]
  if (fs.includes('supuesto')) return 'supuesto'
  if (fs.includes('a_confirmar')) return 'a confirmar'
  return c.estado === 'facturada' ? 'comprobante' : 'contrato'
}

function estadoTexto(c: Cuota, hoy: Fecha): string {
  if (c.pagada) return c.fecha_pago ? `pagada el ${fechaCorta(c.fecha_pago).slice(4)}` : 'pagada · fecha sin dato'
  return c.fecha_vencimiento < hoy ? 'vencida, sin pagar' : 'pendiente'
}

function totalesVista(as: readonly AperturaCuota[], explicacion: string): TotalesApertura {
  const t = totalesApertura(as, explicacion)
  return {
    amortizacion: par(t.amortizacion),
    interes: par(t.interes),
    iva: par(t.iva),
    seguro: par(t.seguro),
    percepcion: par(t.percepcion),
    cargos: par(t.cargos),
    gasto: par(t.gasto),
    total: par(t.total),
  }
}

/**
 * La última deuda cargada de una naturaleza hasta `hasta` (la fecha de tu
 * última carga): la misma que restan el Balance, Hoy y Flujo, que están al
 * cierre de esa carga. Una cargada después entra con la próxima carga.
 */
function deudaDe(h: Pick<Hechos, 'pasivo_saldos'>, contrato: ContratoPasivo, naturaleza: 'informado' | 'estimado', ccl: Calc, hasta: Fecha): DeudaConOrigen | null {
  const s = h.pasivo_saldos.filter((x) => x.pasivo_id === contrato.id && x.naturaleza === naturaleza && x.fecha <= hasta).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0]
  return s ? deudaDeSaldo(s, contrato, ccl) : null
}

/** Lo cargado después de tu última carga (la informada antes que la estimada): se muestra, pero todavía no cuenta. */
function deudaPosterior(h: Pick<Hechos, 'pasivo_saldos'>, contrato: ContratoPasivo, ccl: Calc, despuesDe: Fecha): VistaLeasing['deuda']['posterior'] {
  const despues = h.pasivo_saldos.filter((x) => x.pasivo_id === contrato.id && x.fecha > despuesDe).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  const s = despues.find((x) => x.naturaleza === 'informado') ?? despues[0]
  return s ? { ...deudaDeSaldo(s, contrato, ccl), naturaleza: s.naturaleza === 'estimado' ? 'estimado' : 'informado' } : null
}

function deudaDeSaldo(s: Hechos['pasivo_saldos'][number], contrato: ContratoPasivo, ccl: Calc): DeudaConOrigen {
  const estimado = s.naturaleza === 'estimado'
  const ars = calc(
    s.capital_pendiente,
    `${estimado ? 'deuda estimada' : 'valor de cancelación informado'} del ${fechaLarga(s.fecha)} = ${monto(s.capital_pendiente, 'ARS', { decimales: 2 })}`,
    [
      { nombre: estimado ? 'Deuda estimada' : 'Valor de cancelación (sin penalidad)', valor: s.capital_pendiente.toFixed(), unidad: 'ARS', origen: { carga_id: s.carga_id } },
      ...(s.fuente ? [{ nombre: estimado ? 'Cómo se estimó' : 'Quién lo informó', valor: s.fuente, unidad: 'texto' as const }] : []),
    ],
    estimado
      ? { etiquetas: ['estimado'], explicacion: 'La deuda provisoria que aprobaste: un estimado, no lo informó la leasera. La reemplaza el valor de cancelación cuando lo cargues.' }
      : { explicacion: 'Lo que la leasera te informó que cuesta cancelar el leasing hoy, sin penalidad (D-130). Es la deuda que cuenta.' },
  )
  const d: DobleCalc =
    contrato.moneda === 'ARS'
      ? { ars, usd: aDolares(ars, ccl, 'CCL de hoy', 'La deuda en dólares al CCL de hoy.') }
      : { usd: ars, ars: aPesos(ars, ccl, 'CCL de hoy', 'La deuda en pesos al CCL de hoy.') }
  return { par: par(d), fecha: s.fecha, fuente: s.fuente }
}

/**
 * La deuda a cada fecha con CCL cargado, para la licuación (visión 4.11), con
 * el mismo orden que el motor (D-131, revisión de la entrega 4): la última
 * informada hasta esa fecha › la según el cuadro de marcha a esa fecha › la
 * última estimada (con su etiqueta).
 */
export function deudasPorFecha(h: Pick<Hechos, 'tipos_cambio' | 'pasivo_saldos'>, contrato: ContratoPasivo, cuotas: readonly Cuota[], tea: Calc): { fecha: Fecha; deuda: Calc; ccl: Calc }[] {
  const tcs = [...h.tipos_cambio].filter((t) => t.ccl !== null).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  return tcs.map((t) => {
    const ccl = calc(t.ccl as Decimal, `CCL del ${fechaCorta(t.fecha)} = ${numero(t.ccl as Decimal, 2)}`, [
      { nombre: `CCL del ${fechaLarga(t.fecha)}`, valor: (t.ccl as Decimal).toFixed(), unidad: 'ratio', origen: { carga_id: t.carga_id } },
    ])
    const hasta = h.pasivo_saldos.filter((x) => x.pasivo_id === contrato.id && x.fecha <= t.fecha).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    // La informada les gana a las otras dos aunque haya un estimado posterior (como el motor).
    const s = hasta.find((x) => x.naturaleza === 'informado') ?? hasta[0]
    const cuadro = capitalSegunCuadro(contrato, cuotasAlDia(cuotas, t.fecha), tea, t.fecha, ccl).ars
    const deuda =
      s && (s.naturaleza === 'informado' || cuadro.valor === null)
        ? calc(
            s.capital_pendiente,
            `${s.naturaleza === 'estimado' ? 'deuda estimada' : 'valor de cancelación informado'} del ${fechaLarga(s.fecha)} = ${monto(s.capital_pendiente, 'ARS', { decimales: 2 })}`,
            [{ nombre: s.naturaleza === 'estimado' ? 'Deuda estimada' : 'Valor de cancelación', valor: s.capital_pendiente.toFixed(), unidad: 'ARS', origen: { carga_id: s.carga_id } }],
            s.naturaleza === 'estimado' ? { etiquetas: ['estimado'] } : {},
          )
        : cuadro
    return { fecha: t.fecha, deuda, ccl }
  })
}

const p = (texto: string, c: Calc | null = null): ParteFrase => ({ texto, calc: c ? vista(c) : null })
const pesosCortos = (c: Calc) => (c.valor === null ? 'sin dato' : compacto(c.valor, 'ARS'))
const pesos = (c: Calc) => (c.valor === null ? 'sin dato' : monto(c.valor, 'ARS'))
const dolares = (c: Calc) => (c.valor === null ? 'sin dato' : monto(c.valor, 'USD'))

function fraseLeasing(contrato: ContratoPasivo, r: ReturnType<typeof resumenLeasing>, proxima: Cuota | null, deuda: VistaLeasing['deuda'], cuotas: Cuota[], hoy: Fecha): ParteFrase[] {
  const nombre = contrato.nombre
  if (!cuotas.length) {
    return [p(`${nombre}: todavía no importaste el cuadro de marcha. Con la planilla de cuotas ves cuánto pagaste, cuánto falta y cuánto es en dólares.`)]
  }
  const out: ParteFrase[] = [p(`${nombre}: pagaste ${r.pagadas} de ${contrato.cuotas_totales} cuotas.`)]
  // Una cuota que ya venció y la planilla no marca pagada no se saltea: se dice (puede ser que la planilla no esté al día).
  const vencidas = cuotas.filter((c) => !c.pagada && c.fecha_vencimiento < hoy)
  if (vencidas.length === 1) {
    const v = vencidas[0]
    out.push(p(` La cuota ${v.nro} venció el ${fechaCorta(v.fecha_vencimiento)} y tu planilla no la marca pagada: si ya se debitó, importá la planilla actualizada.`))
  } else if (vencidas.length > 1) {
    const nros = vencidas.map((c) => c.nro)
    out.push(p(` Las cuotas ${nros.slice(0, -1).join(', ')} y ${nros[nros.length - 1]} vencieron y tu planilla no las marca pagadas: si ya se debitaron, importá la planilla actualizada.`))
  }
  if (proxima && r.proxima) {
    const t = totalCuota(proxima)
    out.push(
      p(` La próxima, la ${proxima.nro}, vence el ${fechaCorta(proxima.fecha_vencimiento)}: `),
      p(pesos(t), t),
      p(
        ` (canon ${pesos(campoCuota(proxima, 'canon'))} + seguro ${pesos(campoCuota(proxima, 'seguro'))} + IVA ${pesos(campoCuota(proxima, 'iva'))} + percepción ${pesos(campoCuota(proxima, 'percepcion'))}), hoy `,
      ),
      p(dolares(r.proxima.total.usd), r.proxima.total.usd),
      p('.'),
    )
  }
  const f = r.falta
  if (f.cuotas > 0) {
    const inciertos: string[] = []
    const impagas = cuotas.filter((c) => !c.pagada)
    if (impagas.some((c) => c.fuente_seguro === 'a_confirmar')) inciertos.push('el seguro a confirmar')
    if (impagas.some((c) => c.fuente_seguro === 'supuesto')) inciertos.push('el seguro supuesto')
    if (impagas.some((c) => c.fuente_otros === 'supuesto')) inciertos.push('la percepción supuesta')
    if (impagas.some((c) => c.fuente_otros === 'a_confirmar')) inciertos.push('la percepción a confirmar')
    out.push(
      p(` Faltan ${f.cuotas} cuotas: `),
      p(`${pesosCortos(f.total.ars)} nominales`, f.total.ars),
      p(` (${pesosCortos(f.canon.ars)} de canon según contrato y ${pesosCortos(f.resto.ars)} de IVA, seguro y percepción${inciertos.length ? `, con ${inciertos.join(' y ')} según tu planilla` : ''}), hoy `),
      p(dolares(f.total.usd), f.total.usd),
      p(' al CCL de hoy, más la opción de compra.'),
    )
  } else {
    out.push(p(' No falta pagar ninguna cuota: queda la opción de compra.'))
  }
  if (deuda.informada) {
    out.push(p(' Valor de cancelación que informó la leasera: '), p(pesos(calcDe(deuda.informada.par.ars)), calcDe(deuda.informada.par.ars)), p(` (al ${fechaLarga(deuda.informada.fecha)}).`))
  } else if (deuda.posterior?.naturaleza === 'informado') {
    const d = deuda.posterior
    out.push(p(' Valor de cancelación que informó la leasera: '), p(pesos(calcDe(d.par.ars)), calcDe(d.par.ars)), p(` (al ${fechaLarga(d.fecha)}): entra en tu patrimonio con tu próxima carga.`))
  } else {
    out.push(p(' Valor de cancelación: sin dato (pedíselo a la leasera).'))
  }
  return out
}

/**
 * Las cifras de la frase, cada una en pesos y en dólares con su traza: con el
 * dedo la frase es texto (una cifra en línea no llega a 44 px), y este detalle
 * se abre aparte, una fila tocable por cifra (como la frase de Hoy).
 */
function detalleFrase(r: ReturnType<typeof resumenLeasing>, proxima: Cuota | null, deuda: VistaLeasing['deuda'], cuotas: Cuota[]): VistaLeasing['frase_detalle'] {
  if (!cuotas.length) return []
  const out: VistaLeasing['frase_detalle'] = []
  if (proxima && r.proxima) out.push({ etiqueta: `Próxima cuota (la ${proxima.nro})`, ars: vista(r.proxima.total.ars), usd: vista(r.proxima.total.usd) })
  if (r.falta.cuotas > 0) {
    out.push(
      { etiqueta: `Falta pagar (${r.falta.cuotas} cuotas)`, ars: vista(r.falta.total.ars), usd: vista(r.falta.total.usd) },
      { etiqueta: 'Canon que falta', ars: vista(r.falta.canon.ars), usd: vista(r.falta.canon.usd) },
      { etiqueta: 'IVA, seguro y percepción que faltan', ars: vista(r.falta.resto.ars), usd: vista(r.falta.resto.usd) },
    )
  }
  if (deuda.informada) out.push({ etiqueta: 'Valor de cancelación (informado)', ars: deuda.informada.par.ars, usd: deuda.informada.par.usd })
  return out
}

/** Un CalcVista de vuelta a Calc (solo para formatear su valor en la frase). */
function calcDe(c: CalcVista): Calc {
  return c.valor === null ? sinDato(c.motivo ?? 'sin dato') : calc(new Decimal(c.valor), c.formula)
}

function indexado(cuotas: Cuota[]): { filas: VistaLeasing['indexado']; motivo: string | null } {
  const con = cuotas.filter((c) => c.pagada && c.ccl_del_dia_pago !== null).sort((a, b) => a.nro - b.nro)
  if (con.length < 2) {
    return {
      filas: [],
      motivo:
        con.length === 0
          ? 'Para ver la cuota en pesos contra la cuota en dólares hacen falta al menos dos cuotas pagadas con el CCL del día del pago: la planilla no trae la fecha del pago. Cargalas desde Datos › Leasing.'
          : 'Hace falta una cuota pagada más con el CCL del día del pago para comparar la cuota en pesos contra la cuota en dólares.',
    }
  }
  const base = con[0]
  const t0 = totalCuota(base).valor as Decimal
  const u0 = t0.div(base.ccl_del_dia_pago as Decimal)
  return {
    filas: con.map((c) => {
      const t = totalCuota(c).valor as Decimal
      const u = t.div(c.ccl_del_dia_pago as Decimal)
      return { nro: c.nro, fecha: c.fecha_pago ?? c.fecha_vencimiento, ars: t.div(t0).times(100).toDecimalPlaces(4).toFixed(), usd: u.div(u0).times(100).toDecimalPlaces(4).toFixed() }
    }),
    motivo: null,
  }
}

/** La vista de un leasing (o cualquier pasivo con cuadro de marcha). */
export function armarLeasing(h: Hechos, hp: HechosPasivos, contrato: ContratoPasivo, ccl: Calc, hoy: Fecha, alDia: Fecha = hoy): VistaLeasing {
  const cuotas = hp.cuotas.filter((c) => c.pasivo_id === contrato.id).sort((a, b) => a.nro - b.nro)
  const cargos = hp.cargos.filter((k) => k.pasivo_id === contrato.id)
  const r = resumenLeasing(contrato, cuotas, cargos, ccl, hoy)
  const tea = tirContrato(contrato, cuotas)
  const aperturas = aperturasCuotas(contrato, cuotas, cargos, tea, ccl)
  const aperturaDe = new Map(aperturas.map((a) => [a.nro, a]))
  const proxima = r.proxima ? (cuotas.find((c) => c.nro === r.proxima!.nro) ?? null) : null
  // La deuda, al cierre de tu última carga, como en el Balance, Hoy y Flujo: una sola deuda en toda la app.
  const segun = capitalSegunCuadro(contrato, cuotasAlDia(cuotas, alDia), tea, alDia, ccl)
  const informada = deudaDe(h, contrato, 'informado', ccl, alDia)
  const estimada = deudaDe(h, contrato, 'estimado', ccl, alDia)
  const deuda: VistaLeasing['deuda'] = {
    al: alDia,
    informada,
    segun_cuadro: par(segun),
    estimada,
    falta_pagar: par(r.falta.total),
    // La que cuenta, en el orden de D-131. Sin ninguna, null: nada dice "estimada" si no hay estimado.
    vigente: informada ? 'informada' : segun.ars.valor !== null ? 'segun_cuadro' : estimada ? 'estimada' : null,
    posterior: deudaPosterior(h, contrato, ccl, alDia),
  }
  // El bien que financia y su última valuación.
  const bien = h.bienes.find((b) => b.pasivo_id === contrato.id) ?? null
  let bienVista: VistaLeasing['bien'] = null
  let vsValuacion: CalcVista | null = null
  if (bien) {
    const v = h.valuaciones.filter((x) => x.bien_id === bien.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0]
    if (v) {
      const base = calc(v.valor, `valuación del ${fechaLarga(v.fecha)} = ${monto(v.valor, bien.moneda_valuacion, { decimales: 2 })}`, [
        { nombre: `Valuación de ${bien.nombre}`, valor: v.valor.toFixed(), unidad: bien.moneda_valuacion, origen: { carga_id: v.carga_id } },
        { nombre: 'Fuente', valor: v.fuente, unidad: 'texto' },
      ])
      const d: DobleCalc =
        bien.moneda_valuacion === 'ARS'
          ? { ars: base, usd: aDolares(base, ccl, 'CCL de hoy', 'La valuación en dólares al CCL de hoy.') }
          : { usd: base, ars: aPesos(base, ccl, 'CCL de hoy', 'La valuación en pesos al CCL de hoy.') }
      bienVista = { nombre: bien.nombre, valuacion: par(d), fecha: v.fecha, fuente: v.fuente }
      const costo = r.costo_total.ars
      const ins = [deCalc('Costo total', costo, 'ARS'), deCalc(`Valuación de ${bien.nombre}`, d.ars, 'ARS')]
      vsValuacion = vista(
        costo.valor === null || d.ars.valor === null
          ? sinDato(costo.valor === null ? (costo.motivo ?? 'Falta el costo total.') : (d.ars.motivo ?? 'Falta la valuación en pesos.'), ins)
          : calc(costo.valor.div(d.ars.valor), `${monto(costo.valor, 'ARS')} ÷ ${monto(d.ars.valor, 'ARS')} = ${numero(costo.valor.div(d.ars.valor), 2)} veces`, ins, {
              explicacion: `Cuántas veces lo que vale hoy ${bien.nombre} (según su última valuación) pagás en total por el leasing, en pesos nominales.`,
            }),
      )
    } else {
      bienVista = { nombre: bien.nombre, valuacion: null, fecha: null, fuente: null }
    }
  }
  const cargosDeCuota = cargosPorCuota(cuotas, cargos)
  const filas: FilaCuota[] = cuotas.map((c) => {
    const a = aperturaDe.get(c.nro) as AperturaCuota
    const t = totalCuota(c)
    return {
      nro: c.nro,
      fecha_vencimiento: c.fecha_vencimiento,
      periodo: c.periodo,
      estado: c.estado,
      pagada: c.pagada,
      fecha_pago: c.fecha_pago,
      estado_texto: estadoTexto(c, hoy),
      canon: vista(campoCuota(c, 'canon')),
      seguro: vista(campoCuota(c, 'seguro')),
      subtotal: vista(subtotalCuota(c)),
      iva: vista(campoCuota(c, 'iva')),
      percepcion: vista(campoCuota(c, 'percepcion')),
      total: vista(t),
      ccl_pago: vista(c.pagada ? cclDelPago(c) : sinDato(`La cuota ${c.nro} no está pagada.`)),
      total_usd: vista(cuotaEnUsd(c, ccl, c.pagada ? 'pago' : 'hoy')),
      usd_rotulo: c.pagada ? 'al CCL del pago' : 'al CCL de hoy',
      fuentes: { canon: c.fuente_canon, seguro: c.fuente_seguro, percepcion: c.fuente_otros },
      fuente_texto: fuenteTexto(c),
      apertura: {
        amortizacion: par(a.amortizacion),
        interes: par(a.interes),
        iva: par(a.iva),
        seguro: par(a.seguro),
        percepcion: par(a.percepcion),
        cargos: par(a.cargos),
        gasto: par(a.gasto),
        total: par(a.total),
      },
      pagador: c.pagador,
      etiquetas: t.etiquetas,
      hay_cargos: (cargosDeCuota.get(`${c.pasivo_id}-${c.nro}`) ?? []).length > 0,
    }
  })
  const porFuente = (ars: Calc): Par => par({ ars, usd: aDolares(ars, ccl, 'CCL de hoy', 'En dólares al CCL de hoy: una referencia, no lo que va a costar.') })
  const recupero = recuperoFiscal(contrato, cuotas, ccl)
  const idx = indexado(cuotas)
  const cargosVista: CargoVista[] = cargos.map((k) => {
    const ars = calc(k.importe, `${k.detalle ?? k.concepto} = ${monto(k.importe, 'ARS', { decimales: 2 })}`, [
      { nombre: k.detalle ?? k.concepto, valor: k.importe.toFixed(), unidad: 'ARS', origen: { carga_id: k.carga_id } },
    ], { etiquetas: k.fuente === 'supuesto' ? ['supuesto'] : k.fuente === 'a_confirmar' ? ['a_confirmar'] : [] })
    return {
      id: k.id,
      fecha: k.fecha,
      concepto: k.concepto,
      detalle: k.detalle,
      importe: par({ ars, usd: aDolares(ars, ccl, 'CCL de hoy', 'En dólares al CCL de hoy.') }),
      cuota_nro: k.cuota_nro,
      fuente: NOMBRE_FUENTE[k.fuente],
    }
  })
  return {
    contrato: {
      id: contrato.id,
      nombre: contrato.nombre,
      tipo: contrato.tipo,
      moneda: contrato.moneda,
      fecha_inicio: contrato.fecha_inicio,
      fecha_desembolso: contrato.fecha_desembolso,
      cuotas_totales: contrato.cuotas_totales,
      monto_financiado_neto: contrato.monto_financiado_neto?.toFixed() ?? null,
      anticipo_neto: contrato.anticipo_neto?.toFixed() ?? null,
      valor_bien: contrato.valor_bien?.toFixed() ?? null,
      opcion_compra_neto: contrato.opcion_compra_neto?.toFixed() ?? null,
      opcion_compra_fecha: contrato.opcion_compra_fecha,
      pagador_habitual: contrato.pagador_habitual,
      reintegra_iva: contrato.reintegra_iva,
      faltan_para_tasa: faltanParaTasa(contrato, cuotas),
    },
    bien: bienVista,
    frase: fraseLeasing(contrato, r, proxima, deuda, cuotas, hoy),
    frase_detalle: detalleFrase(r, proxima, deuda, cuotas),
    hoy,
    tarjetas: {
      vencidas: cuotas.filter((c) => !c.pagada && c.fecha_vencimiento < hoy).map((c) => ({ nro: c.nro, fecha: c.fecha_vencimiento })),
      pagadas: r.pagadas,
      cargadas: r.cargadas,
      total: contrato.cuotas_totales,
      progreso: contrato.cuotas_totales > 0 ? Math.min(100, Math.round((r.pagadas / contrato.cuotas_totales) * 100)) : 0,
      proxima: r.proxima ? { nro: r.proxima.nro, fecha: r.proxima.fecha_vencimiento, total: par(r.proxima.total), etiquetas: r.proxima.etiquetas } : null,
      falta: { cuotas: r.falta.cuotas, total: par(r.falta.total), canon: par(r.falta.canon), resto: par(r.falta.resto) },
      costo: { total: par(r.costo_total), vs_valor: vista(r.costo_vs_valor), vs_valuacion: vsValuacion },
    },
    cuotas: filas,
    totales: {
      pagado: par(r.pagado),
      falta: par(r.falta.total),
      falta_por_fuente: {
        comprobante: porFuente(r.falta.por_fuente.comprobante),
        contrato: porFuente(r.falta.por_fuente.contrato),
        supuesto: porFuente(r.falta.por_fuente.supuesto),
        a_confirmar: porFuente(r.falta.por_fuente.a_confirmar),
      },
      iva_percepcion_pagado: par(r.iva_percepcion.pagado),
      iva_percepcion_por_pagar: par(r.iva_percepcion.por_pagar),
      cargos: par(r.cargos),
      hay_cargos: cargos.some((k) => !k.anulado),
      apertura_pagadas: totalesVista(
        aperturas.filter((a) => cuotas.find((c) => c.nro === a.nro)?.pagada),
        'Lo pagado, abierto: la amortización bajó la deuda; el interés, el IVA, el seguro, la percepción y los cargos fueron gasto.',
      ),
      apertura_pendientes: totalesVista(
        aperturas.filter((a) => !cuotas.find((c) => c.nro === a.nro)?.pagada),
        'Lo que falta, abierto: la amortización va a bajar la deuda; el resto es gasto.',
      ),
    },
    opcion: { neto: par(r.opcion.neto), iva: par(r.opcion.iva), total: par(r.opcion.total), fecha: r.opcion.fecha, alicuota: vista(r.alicuota_iva) },
    tea: vista(tea),
    tem: vista(temDeTea(tea)),
    deuda,
    recupero: { iva: par(recupero.iva), ganancias: par(recupero.ganancias) },
    licuacion_pagadas: par(licuacionPagadas(cuotas, ccl)),
    licuacion_deuda:
      contrato.moneda === 'ARS'
        ? par(licuacionDeuda(deudasPorFecha(h, contrato, cuotas, tea), ccl))
        : par({ ars: sinDato('La deuda es en dólares: el CCL no la licúa.'), usd: sinDato('La deuda es en dólares: el CCL no la licúa.') }),
    falta_pesos_hoy: vista(
      sinDato('Para pasar lo que falta a pesos de hoy hace falta la inflación de cada mes (IPC), y la app todavía no la tiene.', [deCalc('Lo que falta, nominal', r.falta.total.ars, 'ARS')]),
    ),
    cargos: cargosVista,
    indexado: idx.filas,
    indexado_motivo: idx.motivo,
  }
}

export function armarPasivos(h: Hechos, hp: HechosPasivos, hoy: Fecha): VistaPasivos {
  const ccl = cclDeHoy(h, hoy)
  // La fecha de tus datos (la última carga): la deuda que cuenta es la de esa fecha, como en el resto de la app.
  const alDia = fechasDeCarga(h).filter((f) => f <= hoy).at(-1) ?? hoy
  const leasings = hp.contratos.map((c) => armarLeasing(h, hp, c, ccl, hoy, alDia))
  return {
    hoy,
    ccl: vista(ccl),
    ccl_fecha: fechaCclDeHoy(h, hoy),
    leasings,
    aviso: leasings.length ? null : 'Todavía no cargaste ningún pasivo. Cargá el contrato del leasing en Datos › Leasing y después importá su cuadro de marcha.',
  }
}
