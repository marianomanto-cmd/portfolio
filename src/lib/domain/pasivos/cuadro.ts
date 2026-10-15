// El cuadro de marcha del leasing, en funciones puras con traza (plan §5 C.2,
// D-139 a D-143, D-152). Toda cifra sale en pesos y en dólares; lo que falta es
// "sin dato" con su motivo, nunca cero; lo que no es un hecho lleva su etiqueta:
//   proyectado  · una cuota sin factura (y la opción de compra, que no pasó)
//   supuesto    · un monto que la planilla marca SUPUESTO
//   a_confirmar · un monto que la planilla marca CONFIRMAR
//   estimado    · la apertura entre amortización e interés y la deuda según el
//                 cuadro: salen de la tasa implícita, no las informa la leasera.

import { calc, deCalc, sinDato, type Calc, type DobleCalc, type Etiqueta, type Insumo } from '../calc'
import { CERO, Decimal, monto, numero, porcentaje, UNO } from '../dinero'
import { diasEntre, fechaLarga } from '../fechas'
import { sumaCalc } from '../foto'
import type { Fecha, Moneda } from '../tipos'
import { cargosPorCuota } from './cargos'
import type { AperturaCuota, CargoExtra, ContratoPasivo, Cuota, FaltaPagar, FilaAmortizacion, FuenteCuota, OpcionDeCompra, ResumenLeasing } from './tipos'

const $ = (d: Decimal, moneda: Moneda = 'ARS') => monto(d, moneda, { decimales: 2 })
const ANIO = new Decimal(365)

export type CampoCuota = 'canon' | 'iva' | 'seguro' | 'percepcion'

export const NOMBRE_CAMPO: Record<CampoCuota, string> = {
  canon: 'canon neto',
  iva: 'IVA',
  seguro: 'seguro',
  percepcion: 'percepción RG 3337',
}

const NOMBRE_FUENTE: Record<FuenteCuota, string> = {
  comprobante: 'comprobante',
  contrato: 'contrato',
  a_confirmar: 'a confirmar',
  supuesto: 'supuesto',
  no_aplica: 'no aplica',
}

/** Las etiquetas que pone la fuente de un monto. */
export function etiquetasFuente(f: FuenteCuota): Etiqueta[] {
  return f === 'supuesto' ? ['supuesto'] : f === 'a_confirmar' ? ['a_confirmar'] : []
}

/** La fuente de cada campo. El IVA facturado es de comprobante; el de una proyectada sale del canon y el seguro. */
export function fuentesCampo(c: Cuota, campo: CampoCuota): FuenteCuota[] {
  switch (campo) {
    case 'canon':
      return [c.fuente_canon]
    case 'seguro':
      return [c.fuente_seguro]
    case 'percepcion':
      return [c.fuente_otros]
    case 'iva':
      return c.estado === 'facturada' ? ['comprobante'] : [c.fuente_canon, c.fuente_seguro]
  }
}

function valorCampo(c: Cuota, campo: CampoCuota): Decimal {
  return campo === 'canon' ? c.canon_neto : campo === 'iva' ? c.iva_canon : campo === 'seguro' ? c.seguro : c.otros_conceptos
}

/** Un monto de la cuota, con su origen y sus etiquetas. */
export function campoCuota(c: Cuota, campo: CampoCuota): Calc {
  const v = valorCampo(c, campo)
  const fuentes = fuentesCampo(c, campo)
  const etiquetas: Etiqueta[] = [...fuentes.flatMap(etiquetasFuente), ...(c.estado === 'proyectada' ? (['proyectado'] as const) : [])]
  const de = fuentes.map((f) => NOMBRE_FUENTE[f]).join(' y ')
  return calc(
    v,
    `${NOMBRE_CAMPO[campo]} de la cuota ${c.nro} = ${$(v)} (${de})`,
    [{ nombre: `${NOMBRE_CAMPO[campo]} de la cuota ${c.nro}`, valor: v.toFixed(), unidad: 'ARS', origen: { carga_id: c.carga_id, lugar: 'cuadro de marcha' } }],
    {
      etiquetas,
      explicacion:
        c.estado === 'facturada'
          ? 'Como lo facturó la leasera.'
          : `Del cuadro de marcha, todavía sin factura${fuentes.some((f) => f === 'supuesto' || f === 'a_confirmar') ? `: la planilla lo marca ${de}` : ''}.`,
    },
  )
}

/** Canon + seguro: la base del IVA de la factura. */
export function subtotalCuota(c: Cuota): Calc {
  const partes = [campoCuota(c, 'canon'), campoCuota(c, 'seguro')]
  const v = c.canon_neto.plus(c.seguro)
  return calc(v, `canon ${$(c.canon_neto)} + seguro ${$(c.seguro)} = ${$(v)}`, [deCalc('Canon neto', partes[0], 'ARS'), deCalc('Seguro neto', partes[1], 'ARS')], {
    explicacion: 'El subtotal neto de la cuota, sobre el que se factura el IVA.',
  })
}

/** La cuota entera, lo que se debita: canon + IVA + seguro + percepción. */
export function totalCuota(c: Cuota): Calc {
  const p = (['canon', 'iva', 'seguro', 'percepcion'] as const).map((k) => campoCuota(c, k))
  const v = c.canon_neto.plus(c.iva_canon).plus(c.seguro).plus(c.otros_conceptos)
  return calc(
    v,
    `canon ${$(c.canon_neto)} + IVA ${$(c.iva_canon)} + seguro ${$(c.seguro)} + percepción ${$(c.otros_conceptos)} = ${$(v)}`,
    [deCalc('Canon neto', p[0], 'ARS'), deCalc('IVA', p[1], 'ARS'), deCalc('Seguro neto', p[2], 'ARS'), deCalc('Percepción RG 3337', p[3], 'ARS')],
    {
      explicacion: c.estado === 'facturada' ? `La cuota ${c.nro}, como la facturó la leasera.` : `La cuota ${c.nro} según el cuadro de marcha: todavía no tiene factura.`,
    },
  )
}

/** Lo que se pagó de una cuota: el monto pagado si difiere del total (punitorios), si no, el total. */
export function pagadoCuota(c: Cuota): Calc {
  if (!c.pagada) return sinDato(`La cuota ${c.nro} no está pagada.`)
  if (c.monto_pagado === null) return totalCuota(c)
  return calc(c.monto_pagado, `pagado en la cuota ${c.nro} = ${$(c.monto_pagado)}`, [
    { nombre: `Monto pagado de la cuota ${c.nro}`, valor: c.monto_pagado.toFixed(), unidad: 'ARS', origen: { carga_id: c.carga_id } },
  ], { explicacion: 'Lo que pagaste, cuando difiere del total de la factura (por ejemplo, punitorios).' })
}

/** El CCL del día del pago de una cuota, con su fuente; sin dato si no se cargó. */
export function cclDelPago(c: Cuota): Calc {
  if (!c.pagada) return sinDato(`La cuota ${c.nro} no está pagada.`)
  if (c.ccl_del_dia_pago === null) {
    return sinDato(
      c.fecha_pago === null
        ? `La cuota ${c.nro} está pagada, pero falta la fecha del pago y su CCL: la planilla no los trae.`
        : `Falta el CCL del ${fechaLarga(c.fecha_pago)}, el día del pago de la cuota ${c.nro}.`,
    )
  }
  return calc(c.ccl_del_dia_pago, `CCL del pago de la cuota ${c.nro} = ${numero(c.ccl_del_dia_pago, 2)}`, [
    { nombre: 'CCL del día del pago', valor: c.ccl_del_dia_pago.toFixed(), unidad: 'ratio', origen: { carga_id: c.carga_id } },
    ...(c.fecha_pago ? [{ nombre: 'Fecha del pago', valor: c.fecha_pago, unidad: 'fecha' as const }] : []),
    ...(c.ccl_fuente ? [{ nombre: 'De dónde salió', valor: c.ccl_fuente, unidad: 'texto' as const }] : []),
  ])
}

/** Pesos → dólares a un CCL, con su traza. */
export function aDolares(ars: Calc, ccl: Calc, rotulo: string, explicacion?: string): Calc {
  const ins = [deCalc('En pesos', ars, 'ARS'), deCalc(rotulo, ccl, 'ratio')]
  if (ars.valor === null) return sinDato(ars.motivo ?? 'Falta el monto en pesos.', ins, { explicacion })
  if (ccl.valor === null) return sinDato(ccl.motivo ?? `Falta el ${rotulo}.`, ins, { explicacion })
  if (ccl.valor.lte(0)) return sinDato(`El ${rotulo} no es válido.`, ins, { explicacion })
  const v = ars.valor.div(ccl.valor)
  return calc(v, `${$(ars.valor)} ÷ ${numero(ccl.valor, 2)} (${rotulo}) = ${$(v, 'USD')}`, ins, { explicacion })
}

/** Dólares → pesos a un CCL. */
export function aPesos(usd: Calc, ccl: Calc, rotulo: string, explicacion?: string): Calc {
  const ins = [deCalc('En dólares', usd, 'USD'), deCalc(rotulo, ccl, 'ratio')]
  if (usd.valor === null) return sinDato(usd.motivo ?? 'Falta el monto en dólares.', ins, { explicacion })
  if (ccl.valor === null) return sinDato(ccl.motivo ?? `Falta el ${rotulo}.`, ins, { explicacion })
  const v = usd.valor.times(ccl.valor)
  return calc(v, `${$(usd.valor, 'USD')} × ${numero(ccl.valor, 2)} (${rotulo}) = ${$(v)}`, ins, { explicacion })
}

/**
 * La cuota en dólares: al CCL del día de su pago (una pagada; sin ese CCL, sin
 * dato) o al CCL de hoy (rotulado así: no es lo que costó).
 */
export function cuotaEnUsd(c: Cuota, cclHoy: Calc, cual: 'pago' | 'hoy'): Calc {
  if (cual === 'pago') return aDolares(pagadoCuota(c), cclDelPago(c), 'CCL del día del pago', 'Lo que pagaste, en dólares al CCL del día del pago.')
  return aDolares(totalCuota(c), cclHoy, 'CCL de hoy', 'La cuota en dólares al CCL de hoy: no es lo que va a costar, es una referencia.')
}

/** Un monto de una cuota en las dos monedas: una pagada al CCL de su pago; una impaga al CCL de hoy. */
export function dobleDeCuota(ars: Calc, c: Cuota, cclHoy: Calc): DobleCalc {
  return {
    ars,
    usd: c.pagada
      ? aDolares(ars, cclDelPago(c), 'CCL del día del pago', 'En dólares al CCL del día del pago.')
      : aDolares(ars, cclHoy, 'CCL de hoy', 'En dólares al CCL de hoy: una referencia, no lo que va a costar.'),
  }
}

/**
 * La alícuota de IVA observada en las cuotas facturadas: IVA ÷ subtotal. Si no
 * coinciden entre sí (a 4 decimales), sin dato con la lista: nunca una constante.
 */
export function alicuotaIvaObservada(cuotas: readonly Cuota[]): Calc {
  const facturadas = cuotas.filter((c) => c.estado === 'facturada' && c.canon_neto.plus(c.seguro).gt(0))
  const explicacion = 'La alícuota de IVA que factura la leasera, observada en las cuotas facturadas (IVA ÷ canon y seguro). Con ella se calcula el IVA de la opción de compra.'
  if (!facturadas.length) return sinDato('Todavía no hay cuotas facturadas para ver qué alícuota de IVA cobra la leasera.', [], { explicacion })
  const porCuota = facturadas.map((c) => ({ c, r: c.iva_canon.div(c.canon_neto.plus(c.seguro)).toDecimalPlaces(4) }))
  const distintas = [...new Set(porCuota.map((x) => x.r.toFixed(4)))]
  const insumos: Insumo[] = porCuota.slice(0, 40).map((x) => ({ nombre: `Cuota ${x.c.nro}: IVA ÷ subtotal`, valor: x.r.toFixed(), unidad: 'fraccion' as const }))
  if (distintas.length > 1) {
    return sinDato(
      `Las cuotas facturadas no tienen todas la misma alícuota de IVA (${distintas.map((d) => porcentaje(d)).join(', ')}): revisá las facturas.`,
      insumos,
      { explicacion },
    )
  }
  const a = new Decimal(distintas[0])
  return calc(a, `IVA ÷ (canon + seguro) en las ${facturadas.length} cuotas facturadas = ${porcentaje(a)}`, insumos, { explicacion })
}

function cclAplicado(ars: Calc, ccl: Calc): DobleCalc {
  return { ars, usd: aDolares(ars, ccl, 'CCL de hoy', 'En dólares al CCL de hoy: una referencia.') }
}

/** La opción de compra: el neto del contrato y su IVA a la alícuota observada. Lleva "proyectado": todavía no pasó. */
export function opcionDeCompra(contrato: ContratoPasivo, alicuota: Calc, cclHoy: Calc): OpcionDeCompra {
  const fecha = contrato.opcion_compra_fecha
  const neto =
    contrato.opcion_compra_neto === null
      ? sinDato('Falta la opción de compra en el contrato.')
      : calc(contrato.opcion_compra_neto, `opción de compra neta del contrato = ${$(contrato.opcion_compra_neto)}`, [
          { nombre: 'Opción de compra neta (contrato)', valor: contrato.opcion_compra_neto.toFixed(), unidad: 'ARS' },
          ...(fecha ? [{ nombre: 'Fecha de la opción', valor: fecha, unidad: 'fecha' as const }] : []),
        ], { etiquetas: ['proyectado'], explicacion: 'Lo que pagás al final para quedarte con el bien, neto de IVA, según el contrato.' })
  const insIva = [deCalc('Opción neta', neto, 'ARS'), deCalc('Alícuota de IVA observada', alicuota, 'fraccion')]
  const iva =
    neto.valor === null || alicuota.valor === null
      ? sinDato(neto.valor === null ? (neto.motivo as string) : (alicuota.motivo ?? 'Falta la alícuota de IVA.'), insIva)
      : calc(neto.valor.times(alicuota.valor).toDecimalPlaces(2), `${$(neto.valor)} × ${porcentaje(alicuota.valor)} = ${$(neto.valor.times(alicuota.valor).toDecimalPlaces(2))}`, insIva, {
          etiquetas: ['proyectado'],
          explicacion: 'El IVA de la opción, a la alícuota que se ve en las facturas (no una constante).',
        })
  const total =
    neto.valor === null || iva.valor === null
      ? sinDato(neto.valor === null ? (neto.motivo as string) : (iva.motivo as string), [deCalc('Opción neta', neto, 'ARS'), deCalc('IVA', iva, 'ARS')])
      : calc(neto.valor.plus(iva.valor), `${$(neto.valor)} + IVA ${$(iva.valor)} = ${$(neto.valor.plus(iva.valor))}`, [deCalc('Opción neta', neto, 'ARS'), deCalc('IVA', iva, 'ARS')], {
          explicacion: 'Lo que vas a pagar por la opción de compra, con IVA.',
        })
  return { neto: cclAplicado(neto, cclHoy), iva: cclAplicado(iva, cclHoy), total: cclAplicado(total, cclHoy), fecha }
}

/** Las cuotas que vencen en un mes ('AAAA-MM' o cualquier fecha de ese mes). */
export function cuotasDelMes(cuotas: readonly Cuota[], mes: string): Cuota[] {
  const m = mes.slice(0, 7)
  return cuotas.filter((c) => c.fecha_vencimiento.slice(0, 7) === m).sort((a, b) => a.nro - b.nro)
}

/**
 * Las cuotas como estaban a `fecha`: una que vence después todavía no estaba
 * pagada. La planilla no trae la fecha de cada débito, así que una pagada que
 * vence hasta `fecha` cuenta como pagada a esa fecha (lo que sale de acá, la
 * deuda según el cuadro a una fecha pasada, va rotulado "estimado").
 */
export function cuotasAlDia(cuotas: readonly Cuota[], fecha: Fecha): Cuota[] {
  return cuotas.map((c) => (c.pagada && c.fecha_vencimiento > fecha ? { ...c, pagada: false } : c))
}

/** Quién paga la cuota: lo que dice la cuota, o el pagador habitual del contrato; null = sin declarar. */
export function pagadorDe(c: Cuota, contrato: ContratoPasivo): 'titular' | 'empresa' | null {
  return c.pagador ?? contrato.pagador_habitual
}

function doble(partes: { nombre: string; d: DobleCalc }[], explicacion: string): DobleCalc {
  return {
    ars: motivoComun(sumaCalc(partes.map((p) => ({ nombre: p.nombre, calc: p.d.ars })), 'ARS', explicacion), partes.map((p) => p.d.ars)),
    usd: motivoComun(sumaCalc(partes.map((p) => ({ nombre: p.nombre, calc: p.d.usd })), 'USD', explicacion), partes.map((p) => p.d.usd)),
  }
}

/**
 * Una suma sin ninguna parte conocida dice por qué, no "Faltan 14 partes.": el
 * motivo de la primera, y que a las otras les pasa lo mismo (cada cuota lo dice
 * con su número, por eso los motivos no son idénticos).
 */
function motivoComun(suma: Calc, partes: readonly Calc[]): Calc {
  if (suma.valor !== null || partes.length < 2 || partes.some((p) => p.valor !== null)) return suma
  const motivos = [...new Set(partes.map((p) => p.motivo).filter((m): m is string => Boolean(m)))]
  if (motivos.length <= 1) return suma
  return { ...suma, motivo: `${motivos[0]} Lo mismo en ${partes.length === 2 ? 'la otra' : `las otras ${partes.length - 1}`}.` }
}

/** Un cargo extra en pesos, con su fuente. */
export function importeCargo(k: CargoExtra): Calc {
  return calc(k.importe, `${k.concepto.replace('_', ' ')} del ${fechaLarga(k.fecha)} = ${$(k.importe)}`, [
    { nombre: `Cargo: ${k.detalle ?? k.concepto}`, valor: k.importe.toFixed(), unidad: 'ARS', origen: { carga_id: k.carga_id } },
  ], { etiquetas: etiquetasFuente(k.fuente), explicacion: 'Un cargo fuera de la cuota (multa, comisión, reserva, interés): es gasto, no baja la deuda.' })
}

/** Lo que falta pagar del cuadro, nominal, partido por de dónde sale cada monto. */
export function faltaPagar(contrato: ContratoPasivo, cuotas: readonly Cuota[], cclHoy: Calc): FaltaPagar {
  const propias = cuotas.filter((c) => c.pasivo_id === contrato.id)
  const impagas = propias.filter((c) => !c.pagada).sort((a, b) => a.nro - b.nro)
  const sinCargar = contrato.cuotas_totales - propias.length
  const faltantes = sinCargar > 0 ? [{ nombre: `${sinCargar} cuotas que el cuadro no trae`, calc: sinDato(`El cuadro de marcha tiene ${propias.length} de ${contrato.cuotas_totales} cuotas.`) }] : []
  const explic = 'Lo que falta pagar en pesos nominales: las cuotas impagas del cuadro de marcha, sin la opción de compra. No es la deuda: incluye intereses, IVA, seguro y percepción.'
  const total = sumaCalc([...impagas.map((c) => ({ nombre: `Cuota ${c.nro}`, calc: totalCuota(c) })), ...faltantes], 'ARS', explic)
  const canon = sumaCalc([...impagas.map((c) => ({ nombre: `Canon de la cuota ${c.nro}`, calc: campoCuota(c, 'canon') })), ...faltantes], 'ARS', 'El canon neto de las cuotas impagas.')
  const resto = sumaCalc(
    [
      ...impagas.flatMap((c) => (['iva', 'seguro', 'percepcion'] as const).map((k) => ({ nombre: `${NOMBRE_CAMPO[k]} de la cuota ${c.nro}`, calc: campoCuota(c, k) }))),
      ...faltantes,
    ],
    'ARS',
    'IVA, seguro y percepción de las cuotas impagas.',
  )
  const porFuente = (f: Exclude<FuenteCuota, 'no_aplica'>): Calc => {
    const partes = impagas.flatMap((c) =>
      (['canon', 'iva', 'seguro', 'percepcion'] as const)
        .filter((k) => {
          const fs = fuentesCampo(c, k)
          // El IVA de una proyectada hereda la fuente más incierta de su base.
          const principal = fs.includes('a_confirmar') ? 'a_confirmar' : fs.includes('supuesto') ? 'supuesto' : fs[0]
          return (principal === 'no_aplica' ? 'contrato' : principal) === f
        })
        .map((k) => ({ nombre: `${NOMBRE_CAMPO[k]} de la cuota ${c.nro}`, calc: campoCuota(c, k) })),
    )
    return sumaCalc(partes, 'ARS', `Lo que falta pagar que sale de ${NOMBRE_FUENTE[f]}.`)
  }
  return {
    cuotas: impagas.length + Math.max(0, sinCargar),
    total: cclAplicado(total, cclHoy),
    canon: cclAplicado(canon, cclHoy),
    resto: cclAplicado(resto, cclHoy),
    por_fuente: { comprobante: porFuente('comprobante'), contrato: porFuente('contrato'), supuesto: porFuente('supuesto'), a_confirmar: porFuente('a_confirmar') },
  }
}

/** Todo lo que se sabe del leasing hoy (C.2). */
export function resumenLeasing(
  contrato: ContratoPasivo,
  cuotas: readonly Cuota[],
  cargos: readonly CargoExtra[],
  cclHoy: Calc,
  hoy: Fecha,
): ResumenLeasing {
  const propias = cuotas.filter((c) => c.pasivo_id === contrato.id).sort((a, b) => a.nro - b.nro)
  const pagadas = propias.filter((c) => c.pagada)
  const impagas = propias.filter((c) => !c.pagada)
  const proximaC = impagas.find((c) => c.fecha_vencimiento >= hoy) ?? impagas[0] ?? null
  const proxima = proximaC
    ? { nro: proximaC.nro, fecha_vencimiento: proximaC.fecha_vencimiento, total: dobleDeCuota(totalCuota(proximaC), proximaC, cclHoy), etiquetas: totalCuota(proximaC).etiquetas }
    : null
  const pagado = doble(
    pagadas.map((c) => ({ nombre: `Cuota ${c.nro}`, d: { ars: pagadoCuota(c), usd: cuotaEnUsd(c, cclHoy, 'pago') } })),
    'Lo que ya pagaste del leasing: en pesos, lo facturado de cada cuota pagada; en dólares, cada una al CCL del día de su pago.',
  )
  const falta = faltaPagar(contrato, propias, cclHoy)
  const ivaPer = (cs: Cuota[], nombre: string, explic: string) =>
    doble(
      cs.map((c) => {
        const ars = calc(c.iva_canon.plus(c.otros_conceptos), `IVA ${$(c.iva_canon)} + percepción ${$(c.otros_conceptos)} = ${$(c.iva_canon.plus(c.otros_conceptos))}`, [
          deCalc('IVA', campoCuota(c, 'iva'), 'ARS'),
          deCalc('Percepción RG 3337', campoCuota(c, 'percepcion'), 'ARS'),
        ])
        return { nombre: `${nombre} ${c.nro}`, d: dobleDeCuota(ars, c, cclHoy) }
      }),
      explic,
    )
  const alicuota = alicuotaIvaObservada(propias)
  const opcion = opcionDeCompra(contrato, alicuota, cclHoy)
  const ivaPagado = ivaPer(pagadas, 'Cuota', 'IVA y percepción de las cuotas pagadas: crédito fiscal de la sociedad que toma el leasing (a la que le factura la leasera). Es gasto tuyo mientras no te lo reintegre.')
  const ivaFaltaCuotas = ivaPer(impagas, 'Cuota', 'IVA y percepción de las cuotas que faltan.')
  const ivaPorPagar = doble(
    [
      { nombre: 'Cuotas que faltan', d: ivaFaltaCuotas },
      { nombre: 'IVA de la opción de compra', d: opcion.iva },
    ],
    'IVA y percepción que faltan pagar (cuotas y opción): crédito fiscal de la sociedad, gasto tuyo mientras no te lo reintegre.',
  )
  const propiosCargos = cargos.filter((k) => k.pasivo_id === contrato.id && !k.anulado)
  const cargosD = doble(
    propiosCargos.map((k) => ({ nombre: `${k.detalle ?? k.concepto} (${fechaLarga(k.fecha)})`, d: cclAplicado(importeCargo(k), cclHoy) })),
    'Cargos fuera de la cuota (multas, comisiones, reservas, intereses): gasto, no bajan la deuda.',
  )
  const costoArs = sumaCalc(
    [
      { nombre: 'Pagado', calc: pagado.ars },
      { nombre: 'Falta pagar', calc: falta.total.ars },
      { nombre: 'Opción de compra con IVA', calc: opcion.total.ars },
      { nombre: 'Cargos', calc: cargosD.ars },
    ],
    'ARS',
    'Lo que cuesta el leasing entero en pesos nominales: lo pagado, lo que falta, la opción de compra y los cargos.',
  )
  const costo_total = { ars: costoArs, usd: aDolares(costoArs, cclHoy, 'CCL de hoy', 'El costo total en dólares al CCL de hoy: una referencia (las cuotas se pagan a lo largo de los años).') }
  const valor = contrato.valor_bien
  const insCosto = [deCalc('Costo total', costoArs, 'ARS'), { nombre: 'Valor del bien (contrato)', valor: valor?.toFixed() ?? null, unidad: 'ARS' as const }]
  const costo_vs_valor =
    valor === null
      ? sinDato('Falta el valor del bien en el contrato.', insCosto)
      : costoArs.valor === null
        ? sinDato(costoArs.motivo ?? 'Falta el costo total.', insCosto)
        : calc(costoArs.valor.div(valor), `${$(costoArs.valor)} ÷ ${$(valor)} = ${numero(costoArs.valor.div(valor), 2)} veces`, insCosto, {
            explicacion: 'Cuántas veces el valor del bien (neto de IVA, del contrato) pagás en total, en pesos nominales: no descuenta la inflación ni el tiempo.',
          })
  return {
    pasivo_id: contrato.id,
    cuotas_totales: contrato.cuotas_totales,
    cargadas: propias.length,
    pagadas: pagadas.length,
    proxima,
    pagado,
    falta,
    iva_percepcion: { pagado: ivaPagado, por_pagar: ivaPorPagar },
    cargos: cargosD,
    opcion,
    alicuota_iva: alicuota,
    costo_total,
    costo_vs_valor,
  }
}

// ───────────── Apertura de la cuota (D-152) ─────────────

const centavos = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN)

/**
 * El cuadro de amortización implícito a la TEA del contrato: saldo_k =
 * saldo_{k−1} × (1 + TEA)^(días/365) − canon_k, con el interés redondeado al
 * centavo. La opción de compra paga el saldo que queda (su amortización) y el
 * resto es interés: así Σ amortizaciones + amortización de la opción = monto
 * financiado neto, al centavo. null (con motivo) si falta la tasa o el contrato.
 */
export function cuadroAmortizacion(contrato: ContratoPasivo, cuotas: readonly Cuota[], tea: Calc): { filas: FilaAmortizacion[] } | { motivo: string } {
  if (tea.valor === null) return { motivo: tea.motivo ?? 'Falta la tasa del contrato.' }
  if (contrato.monto_financiado_neto === null || contrato.fecha_desembolso === null || contrato.opcion_compra_neto === null || contrato.opcion_compra_fecha === null) {
    return { motivo: 'Completar el contrato: faltan el monto financiado, la fecha de desembolso o la opción de compra.' }
  }
  const propias = cuotas.filter((c) => c.pasivo_id === contrato.id).sort((a, b) => a.nro - b.nro)
  const base = UNO.plus(tea.valor)
  const filas: FilaAmortizacion[] = []
  let saldo = contrato.monto_financiado_neto
  let desde = contrato.fecha_desembolso
  for (const c of propias) {
    const dias = diasEntre(desde, c.fecha_vencimiento)
    const interes = centavos(saldo.times(base.pow(new Decimal(dias).div(ANIO)).minus(1)))
    const amortizacion = c.canon_neto.minus(interes)
    const final = saldo.minus(amortizacion)
    filas.push({ nro: c.nro, fecha: c.fecha_vencimiento, dias, saldo_inicial: saldo, pago: c.canon_neto, interes, amortizacion, saldo_final: final })
    saldo = final
    desde = c.fecha_vencimiento
  }
  const opcion = contrato.opcion_compra_neto
  filas.push({
    nro: null,
    fecha: contrato.opcion_compra_fecha,
    dias: diasEntre(desde, contrato.opcion_compra_fecha),
    saldo_inicial: saldo,
    pago: opcion,
    interes: opcion.minus(saldo),
    amortizacion: saldo,
    saldo_final: CERO,
  })
  return { filas }
}

/**
 * Cada cuota abierta en sus partes: amortización (lo único que baja la deuda y
 * cuenta para el patrimonio), interés implícito, IVA, seguro, percepción y
 * cargos. En dólares: una pagada al CCL de su pago, una impaga al de hoy.
 */
export function aperturasCuotas(
  contrato: ContratoPasivo,
  cuotas: readonly Cuota[],
  cargos: readonly CargoExtra[],
  tea: Calc,
  cclHoy: Calc,
): AperturaCuota[] {
  const propias = cuotas.filter((c) => c.pasivo_id === contrato.id).sort((a, b) => a.nro - b.nro)
  const cuadro = cuadroAmortizacion(contrato, propias, tea)
  const porNro = new Map<number, FilaAmortizacion>()
  if ('filas' in cuadro) for (const f of cuadro.filas) if (f.nro !== null) porNro.set(f.nro, f)
  const insTea = deCalc('TEA del contrato', tea, 'fraccion')
  // Cada cargo va con su cuota; uno sin cuota, con la del mes de su fecha (pasivos/cargos.ts).
  const porCuota = cargosPorCuota(propias, cargos.filter((k) => k.pasivo_id === contrato.id))
  return propias.map((c) => {
    const proy: Etiqueta[] = c.estado === 'proyectada' ? ['proyectado'] : []
    const f = porNro.get(c.nro)
    const canon = campoCuota(c, 'canon')
    const interesArs: Calc = f
      ? calc(
          f.interes,
          `${$(f.saldo_inicial)} × ((1 + ${porcentaje(tea.valor as Decimal)})^(${f.dias}/365) − 1) = ${$(f.interes)}`,
          [{ nombre: 'Saldo antes de la cuota', valor: f.saldo_inicial.toFixed(), unidad: 'ARS' }, { nombre: 'Días desde el pago anterior', valor: String(f.dias), unidad: 'cantidad' }, insTea],
          { etiquetas: ['estimado', ...proy], explicacion: 'El interés implícito de la cuota, a la tasa del contrato: es gasto, no baja la deuda.' },
        )
      : sinDato(`Para separar interés y amortización falta la tasa del contrato: ${'motivo' in cuadro ? cuadro.motivo : 'completar el contrato.'}`, [insTea], { etiquetas: ['estimado'] })
    const amortArs: Calc =
      f && interesArs.valor !== null
        ? calc(f.amortizacion, `canon ${$(c.canon_neto)} − interés ${$(f.interes)} = ${$(f.amortizacion)}`, [deCalc('Canon neto', canon, 'ARS'), deCalc('Interés implícito', interesArs, 'ARS')], {
            etiquetas: ['estimado'],
            explicacion: 'La parte del canon que baja la deuda: lo único de la cuota que cuenta para tu patrimonio.',
          })
        : sinDato(interesArs.motivo ?? 'Falta la tasa del contrato.', [deCalc('Canon neto', canon, 'ARS'), insTea], { etiquetas: ['estimado'] })
    const cargosCuota = porCuota.get(`${c.pasivo_id}-${c.nro}`) ?? []
    const cargosArs = cargosCuota.length
      ? sumaCalc(cargosCuota.map((k) => ({ nombre: k.detalle ?? k.concepto, calc: importeCargo(k) })), 'ARS', 'Cargos que vinieron con esta cuota.')
      : calc(CERO, `sin cargos extra en la cuota ${c.nro} = ${$(CERO)}`, [], { explicacion: 'Esta cuota no trajo cargos extra.' })
    const total = totalCuota(c)
    const totalConCargos =
      cargosArs.valor === null || cargosArs.valor.isZero()
        ? total
        : calc(total.valor!.plus(cargosArs.valor), `cuota ${$(total.valor!)} + cargos ${$(cargosArs.valor)} = ${$(total.valor!.plus(cargosArs.valor))}`, [deCalc('Cuota', total, 'ARS'), deCalc('Cargos', cargosArs, 'ARS')])
    const gastoArs: Calc =
      amortArs.valor === null
        ? sinDato(amortArs.motivo ?? 'Falta la tasa del contrato.', [deCalc('Total', totalConCargos, 'ARS'), deCalc('Amortización', amortArs, 'ARS')], { etiquetas: ['estimado'] })
        : calc(totalConCargos.valor!.minus(amortArs.valor), `total ${$(totalConCargos.valor!)} − amortización ${$(amortArs.valor)} = ${$(totalConCargos.valor!.minus(amortArs.valor))}`, [deCalc('Total', totalConCargos, 'ARS'), deCalc('Amortización', amortArs, 'ARS')], {
            explicacion: 'Todo lo que no baja la deuda: interés, IVA, seguro, percepción y cargos. Es gasto.',
          })
    return {
      pasivo_id: c.pasivo_id,
      nro: c.nro,
      fecha_vencimiento: c.fecha_vencimiento,
      amortizacion: dobleDeCuota(amortArs, c, cclHoy),
      interes: dobleDeCuota(interesArs, c, cclHoy),
      iva: dobleDeCuota(campoCuota(c, 'iva'), c, cclHoy),
      seguro: dobleDeCuota(campoCuota(c, 'seguro'), c, cclHoy),
      percepcion: dobleDeCuota(campoCuota(c, 'percepcion'), c, cclHoy),
      cargos: dobleDeCuota(cargosArs, c, cclHoy),
      total: dobleDeCuota(totalConCargos, c, cclHoy),
      gasto: dobleDeCuota(gastoArs, c, cclHoy),
    }
  })
}

/** La apertura de una cuota (la firma del plan): arma el cuadro entero y devuelve la suya. */
export function aperturaCuota(c: Cuota, contrato: ContratoPasivo, tea: Calc, cuotas: readonly Cuota[], cargos: readonly CargoExtra[], cclHoy: Calc): AperturaCuota {
  const todas = aperturasCuotas(contrato, cuotas, cargos, tea, cclHoy)
  const a = todas.find((x) => x.nro === c.nro)
  if (!a) throw new Error(`La cuota ${c.nro} no está en el cuadro de ${contrato.nombre}`)
  return a
}

/** Totales de la apertura para un conjunto de cuotas (pagadas o pendientes): cuánto fue amortización y cuánto gasto. */
export function totalesApertura(aperturas: readonly AperturaCuota[], explicacion: string): Record<'amortizacion' | 'interes' | 'iva' | 'seguro' | 'percepcion' | 'cargos' | 'total' | 'gasto', DobleCalc> {
  const campos = ['amortizacion', 'interes', 'iva', 'seguro', 'percepcion', 'cargos', 'total', 'gasto'] as const
  const out = {} as Record<(typeof campos)[number], DobleCalc>
  for (const k of campos) out[k] = doble(aperturas.map((a) => ({ nombre: `Cuota ${a.nro}`, d: a[k] })), explicacion)
  return out
}

/**
 * La deuda según el cuadro de marcha (visión 4.11, D-152): valor presente, a la
 * TEA del contrato y a `fecha`, de los cánones netos impagos más la opción de
 * compra neta. Sin IVA, seguro ni percepción: no son deuda. Lleva "estimado":
 * nunca reemplaza al valor de cancelación que informa la leasera (D-130).
 */
export function capitalSegunCuadro(contrato: ContratoPasivo, cuotas: readonly Cuota[], tea: Calc, fecha: Fecha, cclHoy: Calc, rotuloCcl = 'CCL de hoy'): DobleCalc {
  const explicacion =
    'Lo que vale, a esa fecha, lo que falta pagar de canon y opción, descontado a la tasa del contrato. Es la deuda que cuenta mientras la leasera no informe el valor de cancelación (que la reemplaza): lleva "estimado" porque es un cálculo, no un dato del acreedor.'
  const insTea = deCalc('TEA del contrato', tea, 'fraccion')
  const sd = (m: string): DobleCalc => {
    const s = sinDato(m, [insTea], { etiquetas: ['estimado'], explicacion })
    return { ars: s, usd: s }
  }
  if (tea.valor === null) return sd(`Sin la tasa del contrato no hay deuda según el cuadro de marcha: ${tea.motivo ?? 'completar el contrato.'}`)
  if (contrato.opcion_compra_neto === null || contrato.opcion_compra_fecha === null) return sd('Falta la opción de compra en el contrato.')
  const base = UNO.plus(tea.valor)
  const impagas = cuotas.filter((c) => c.pasivo_id === contrato.id && !c.pagada).sort((a, b) => a.nro - b.nro)
  const flujos = [
    ...impagas.map((c) => ({ nombre: `Canon de la cuota ${c.nro}`, fecha: c.fecha_vencimiento, monto: c.canon_neto })),
    { nombre: 'Opción de compra neta', fecha: contrato.opcion_compra_fecha, monto: contrato.opcion_compra_neto },
  ]
  let vp = CERO
  const insumos: Insumo[] = [insTea, { nombre: 'Al', valor: fecha, unidad: 'fecha' }]
  for (const f of flujos) {
    const t = new Decimal(diasEntre(fecha, f.fecha)).div(ANIO)
    const v = f.monto.div(base.pow(t))
    vp = vp.plus(v)
    insumos.push({ nombre: `${f.nombre} (${fechaLarga(f.fecha)})`, valor: v.toDecimalPlaces(2).toFixed(), unidad: 'ARS' })
  }
  vp = centavos(vp)
  const ars = calc(
    vp,
    `Σ ${impagas.length} cánones impagos y la opción, descontados a TEA ${porcentaje(tea.valor)} al ${fechaLarga(fecha)} = ${$(vp)}`,
    insumos,
    { etiquetas: ['estimado'], explicacion },
  )
  return { ars, usd: aDolares(ars, cclHoy, rotuloCcl, `La deuda según el cuadro de marcha, en dólares al ${rotuloCcl}.`) }
}

/**
 * IVA y Ganancias recuperados (spec §5): el IVA y la percepción de las cuotas
 * pagadas son crédito fiscal de la sociedad que toma el leasing; Ganancias, Σ base ×
 * alícuota de quien deduce el canon. Sin alícuota o sin base, sin dato.
 */
export function recuperoFiscal(contrato: ContratoPasivo, cuotas: readonly Cuota[], cclHoy: Calc): { iva: DobleCalc; ganancias: DobleCalc } {
  const pagadas = cuotas.filter((c) => c.pasivo_id === contrato.id && c.pagada).sort((a, b) => a.nro - b.nro)
  const iva = doble(
    pagadas.map((c) => {
      const ars = calc(c.iva_canon.plus(c.otros_conceptos), `IVA ${$(c.iva_canon)} + percepción ${$(c.otros_conceptos)} = ${$(c.iva_canon.plus(c.otros_conceptos))}`, [
        deCalc('IVA', campoCuota(c, 'iva'), 'ARS'),
        deCalc('Percepción', campoCuota(c, 'percepcion'), 'ARS'),
      ])
      return { nombre: `Cuota ${c.nro}`, d: dobleDeCuota(ars, c, cclHoy) }
    }),
    'El IVA y la percepción de las cuotas pagadas: crédito fiscal de la sociedad que toma el leasing (escudo fiscal de la empresa). Para vos es gasto mientras no te lo reintegre.',
  )
  const explicG = 'El ahorro de Ganancias de quien deduce el canon (la empresa): la base de cada cuota pagada por la alícuota. Es de la empresa, no tuyo.'
  let ganancias: DobleCalc
  const sinBase = pagadas.filter((c) => c.base_ganancias === null || c.base_ganancias === undefined)
  if (contrato.alicuota_ganancias === null) {
    const s = sinDato('Falta la alícuota de Ganancias de la empresa en el contrato.', [], { explicacion: explicG })
    ganancias = { ars: s, usd: s }
  } else if (!pagadas.length) {
    const s = sinDato('Todavía no hay cuotas pagadas.', [], { explicacion: explicG })
    ganancias = { ars: s, usd: s }
  } else if (sinBase.length) {
    const s = sinDato(`Falta la base de Ganancias de ${sinBase.length === pagadas.length ? 'las cuotas pagadas' : `las cuotas ${sinBase.map((c) => c.nro).join(', ')}`}.`, [], { explicacion: explicG })
    ganancias = { ars: s, usd: s }
  } else {
    const a = contrato.alicuota_ganancias
    ganancias = doble(
      pagadas.map((c) => {
        const v = (c.base_ganancias as Decimal).times(a)
        return {
          nombre: `Cuota ${c.nro}`,
          d: dobleDeCuota(calc(v, `${$(c.base_ganancias as Decimal)} × ${porcentaje(a)} = ${$(v)}`, [{ nombre: 'Base de Ganancias', valor: (c.base_ganancias as Decimal).toFixed(), unidad: 'ARS' }, { nombre: 'Alícuota', valor: a.toFixed(), unidad: 'fraccion' }]), c, cclHoy),
        }
      }),
      explicG,
    )
  }
  return { iva, ganancias }
}

/**
 * "Cuánto menos pagaste en dólares" (spec §5): Σ (cuota_k ÷ CCL del pago de la
 * primera − cuota_k ÷ CCL del pago k), sobre las cuotas pagadas con su CCL. Con
 * menos de dos, sin dato. En pesos, al CCL de hoy.
 */
export function licuacionPagadas(cuotas: readonly Cuota[], cclHoy: Calc): DobleCalc {
  const explicacion =
    'Cuántos dólares menos te costaron las cuotas pagadas porque el CCL subió desde la primera cuota con su CCL: cada cuota en dólares al CCL de la primera, menos al CCL de su pago. No es la licuación de la deuda.'
  const pagadas = cuotas.filter((c) => c.pagada).sort((a, b) => a.nro - b.nro)
  const con = pagadas.filter((c) => c.ccl_del_dia_pago !== null)
  if (con.length < 2) {
    const s = sinDato(
      con.length === 0
        ? 'Hacen falta al menos dos cuotas pagadas con el CCL del día del pago (la planilla no trae la fecha del pago).'
        : 'Hace falta una cuota pagada más con el CCL del día del pago.',
      [],
      { explicacion },
    )
    return { ars: s, usd: s }
  }
  const ccl1 = con[0].ccl_del_dia_pago as Decimal
  const partes = con.slice(1).map((c) => {
    const pago = pagadoCuota(c).valor as Decimal
    const v = pago.div(ccl1).minus(pago.div(c.ccl_del_dia_pago as Decimal))
    return {
      nombre: `Cuota ${c.nro}`,
      calc: calc(v, `${$(pago)} ÷ ${numero(ccl1, 2)} − ${$(pago)} ÷ ${numero(c.ccl_del_dia_pago as Decimal, 2)} = ${$(v, 'USD')}`, [
        deCalc('Pagado', pagadoCuota(c), 'ARS'),
        { nombre: `CCL del pago de la cuota ${con[0].nro}`, valor: ccl1.toFixed(), unidad: 'ratio' },
        deCalc('CCL del pago', cclDelPago(c), 'ratio'),
      ]),
    }
  })
  const faltan = pagadas.length - con.length
  const usd = sumaCalc(
    [...partes, ...(faltan ? [{ nombre: `${faltan} cuotas pagadas sin CCL del pago`, calc: sinDato(`A ${faltan} cuotas pagadas les falta el CCL del día del pago.`) }] : [])],
    'USD',
    explicacion,
  )
  return { usd, ars: aPesos(usd, cclHoy, 'CCL de hoy', 'En pesos al CCL de hoy: una referencia.') }
}

/**
 * Licuación de la deuda (visión 4.11): Σ deuda_i × (1/CCL_i − 1/CCL_{i+1}) por
 * tramo entre cargas. Con una sola carga, sin dato. Lleva las etiquetas de la
 * deuda (una estimada la hace estimada).
 */
export function licuacionDeuda(deudas: readonly { fecha: Fecha; deuda: Calc; ccl: Calc }[], cclHoy: Calc): DobleCalc {
  const explicacion = 'Cuántos dólares bajó la deuda en pesos solo porque subió el CCL, tramo por tramo entre tus cargas: deuda × (1/CCL de un día − 1/CCL del siguiente).'
  const orden = [...deudas].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  if (orden.length < 2) {
    const s = sinDato('Hace falta una segunda carga con la deuda y el CCL para ver cuánto se licuó.', [], { explicacion })
    return { ars: s, usd: s }
  }
  const partes = orden.slice(1).map((b, i) => {
    const a = orden[i]
    const nombre = `Del ${fechaLarga(a.fecha)} al ${fechaLarga(b.fecha)}`
    const ins = [deCalc('Deuda al principio del tramo', a.deuda, 'ARS'), deCalc('CCL al principio', a.ccl, 'ratio'), deCalc('CCL al final', b.ccl, 'ratio')]
    if (a.deuda.valor === null || a.ccl.valor === null || b.ccl.valor === null) return { nombre, calc: sinDato(`Falta la deuda o el CCL del tramo ${nombre.toLowerCase()}.`, ins) }
    const v = a.deuda.valor.times(UNO.div(a.ccl.valor).minus(UNO.div(b.ccl.valor)))
    return { nombre, calc: calc(v, `${$(a.deuda.valor)} × (1/${numero(a.ccl.valor, 2)} − 1/${numero(b.ccl.valor, 2)}) = ${$(v, 'USD')}`, ins) }
  })
  const usd = sumaCalc(partes, 'USD', explicacion)
  return { usd, ars: aPesos(usd, cclHoy, 'CCL de hoy', 'En pesos al CCL de hoy: una referencia.') }
}
