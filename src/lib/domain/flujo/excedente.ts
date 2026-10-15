// El excedente de un mes con los datos de hoy, sin supuestos (plan §6 D.2): lo
// usan la frase del mes en Flujo y la tarjeta de Hoy (integración, §10).
//
//   ingresos  = US$ declarados × cripto de hoy + $ declarados   (o lo que cargaste del mes)
//   excedente = ingresos − gastos fijos declarados − cuotas del mes que pagás vos
// En dólares, todo ÷ CCL de hoy. Sin cripto, el ingreso en dólares no se pasa
// a pesos: "sin dato", con el motivo. La cuota es la entera (lo que se debita).

import { calc, deCalc, sinDato, type Calc, type DobleCalc, type Etiqueta, type Insumo } from '../calc'
import { CERO, Decimal, monto, numero } from '../dinero'
import { fechaCorta } from '../fechas'
import type { Fecha } from '../tipos'
import { leasingsSinCuadro, motivoSinCuadro, type LeasingSinCuadro } from './cuotas'
import { delMes, vigentesEn } from './recurrentes'
import type { BaseProyeccion, CuotaBase } from './tipos'

export interface CuotaDelMes {
  nro: number
  fecha: Fecha
  total: Calc
  quien: 'titular' | 'empresa' | null
  etiquetas: Etiqueta[]
}

export interface ExcedenteMes {
  mes: Fecha
  ingreso_usd: DobleCalc
  ingreso_pesos: DobleCalc
  ingresos: DobleCalc
  gastos: DobleCalc
  cuota: DobleCalc
  cuotas: CuotaDelMes[]
  excedente: DobleCalc
  /** Lo que ya cargaste del mes reemplaza a lo declarado. */
  reales: { ingresos: boolean; gastos: boolean }
  /** Sin ninguna declaración: el excedente es "sin dato · faltan tus ingresos y gastos". */
  sin_declaraciones: boolean
  /** Los leasings sin cuadro de marcha cuya cuota de este mes no se sabe (la cuota y el excedente son sin dato). */
  sin_cuadro: LeasingSinCuadro[]
}

const fmt = (x: Decimal, m: 'ARS' | 'USD') => monto(x, m, { decimales: 2 })

function aUsd(ars: Calc, ccl: Decimal | null, nombre: string, explicacion: string): Calc {
  if (ars.valor === null) return sinDato(ars.motivo ?? 'Falta el valor en pesos.', [deCalc(nombre, ars, 'ARS')], { explicacion })
  if (ccl === null) return sinDato('Falta el CCL de tu última carga para pasarlo a dólares.', [deCalc(nombre, ars, 'ARS')], { explicacion })
  return calc(ars.valor.div(ccl), `${fmt(ars.valor, 'ARS')} ÷ CCL ${numero(ccl, 2)} = ${fmt(ars.valor.div(ccl), 'USD')}`, [deCalc(nombre, ars, 'ARS'), { nombre: 'CCL de tu última carga', valor: ccl.toFixed(), unidad: 'ratio' }], { explicacion })
}

/** Quién paga una cuota: lo de la planilla o el contrato; si no, lo que declaraste (tu regla del 14/10). */
export function quienPaga(c: CuotaBase, declarado: 'titular' | 'empresa' | null): 'titular' | 'empresa' | null {
  return c.pagador ?? declarado
}

export function excedenteMes(base: BaseProyeccion, mes: Fecha, opciones: { pagador_declarado?: 'titular' | 'empresa' | null } = {}): ExcedenteMes {
  const ccl = base.ccl === null ? null : new Decimal(base.ccl)
  const cripto = base.cripto === null ? null : new Decimal(base.cripto)
  const declarado = opciones.pagador_declarado ?? null
  const usdDecl = delMes(base.recurrentes, mes, 'ingreso', 'USD')
  const arsDecl = delMes(base.recurrentes, mes, 'ingreso', 'ARS')
  const gasDecl = delMes(base.recurrentes, mes, 'gasto', 'ARS').filter((g) => g.pagador !== 'empresa')
  const gasDeclUsd = delMes(base.recurrentes, mes, 'gasto', 'USD').filter((g) => g.pagador !== 'empresa')
  const sin_declaraciones = !base.recurrentes.length
  const reales = base.flujos_reales.filter((f) => !f.anulado && f.concepto === 'mensual' && f.fecha.slice(0, 7) === mes.slice(0, 7))
  const realIng = reales.filter((f) => f.sentido === 'ingreso')
  const realGas = reales.filter((f) => f.sentido === 'gasto')
  const insCripto: Insumo = { nombre: `Dólar cripto de tu última carga${base.fecha_cripto ? ` (${fechaCorta(base.fecha_cripto)})` : ''}`, valor: base.cripto, unidad: 'ratio' }

  // Ingreso en dólares y en pesos: lo que cargaste del mes reemplaza a lo declarado, por moneda.
  const realUsd = realIng.filter((f) => f.moneda === 'USD')
  const realArs = realIng.filter((f) => f.moneda === 'ARS')
  let ingUsd: DobleCalc
  let ingArs: DobleCalc
  if (realUsd.length) {
    const usdTot = realUsd.reduce((a, f) => a.plus(f.monto), CERO)
    const sinVender = realUsd.filter((f) => !f.pesos_recibidos)
    const usdArs = realUsd.reduce((a, f) => a.plus(f.pesos_recibidos ?? new Decimal(f.monto).times(ccl ?? 0)), CERO)
    const insR = realUsd.map((f): Insumo => ({ nombre: `Cargaste el ${fechaCorta(f.fecha)}${f.cripto_usado ? ` (vendidos a ${numero(f.cripto_usado, 2)})` : ''}`, valor: f.monto, unidad: 'USD', origen: { carga_id: f.carga_id } }))
    ingUsd = {
      usd: calc(usdTot, `lo que cargaste = ${fmt(usdTot, 'USD')}`, insR, { explicacion: 'El ingreso en dólares que cargaste este mes.' }),
      ars:
        sinVender.length && ccl === null
          ? sinDato('Falta el CCL para pasar a pesos los dólares que no vendiste.', insR)
          : calc(usdArs, `pesos que recibiste${sinVender.length ? ' (y dólares sin vender × CCL)' : ''} = ${fmt(usdArs, 'ARS')}`, insR, { explicacion: 'Los pesos que recibiste por los dólares que vendiste al cripto.' }),
    }
  } else {
    const usdTot = usdDecl.reduce((a, r) => a.plus(r.monto), CERO)
    const insD = usdDecl.map((r): Insumo => ({ nombre: `${r.concepto} (declarado desde el ${fechaCorta(r.vigente_desde)})`, valor: r.monto, unidad: 'USD' }))
    const usdCalc = calc(usdTot, usdDecl.length ? `${usdDecl.map((r) => fmt(new Decimal(r.monto), 'USD')).join(' + ')} = ${fmt(usdTot, 'USD')}` : `sin ingreso en dólares declarado = ${fmt(CERO, 'USD')}`, insD, { etiquetas: ['declarado'], explicacion: 'Tu ingreso en dólares declarado, vigente este mes.' })
    ingUsd = {
      usd: usdCalc,
      ars: usdTot.isZero()
        ? calc(CERO, `sin ingreso en dólares = ${fmt(CERO, 'ARS')}`, [], {})
        : cripto === null
          ? sinDato('Falta el dólar cripto: cargalo en tu próxima carga para pasar tu ingreso en dólares a pesos.', [deCalc('Ingreso en dólares', usdCalc, 'USD')])
          : calc(usdTot.times(cripto), `${fmt(usdTot, 'USD')} × cripto ${numero(cripto, 2)} = ${fmt(usdTot.times(cripto), 'ARS')}`, [deCalc('Ingreso en dólares', usdCalc, 'USD'), insCripto], { etiquetas: ['declarado'], explicacion: 'Lo que recibirías hoy por tus dólares de ingreso, al cripto de tu última carga.' }),
    }
  }
  if (realArs.length) {
    const arsTot = realArs.reduce((a, f) => a.plus(f.monto), CERO)
    const arsCalc = calc(arsTot, `lo que cargaste = ${fmt(arsTot, 'ARS')}`, realArs.map((f) => ({ nombre: `Cargaste el ${fechaCorta(f.fecha)}`, valor: f.monto, unidad: 'ARS' as const, origen: { carga_id: f.carga_id } })), { explicacion: 'El ingreso en pesos que cargaste este mes.' })
    ingArs = { ars: arsCalc, usd: aUsd(arsCalc, ccl, 'Ingreso en pesos', 'Tu ingreso en pesos, en dólares al CCL de tu última carga.') }
  } else {
    const arsTot = arsDecl.reduce((a, r) => a.plus(r.monto), CERO)
    const arsCalc = calc(arsTot, arsDecl.length ? `${arsDecl.map((r) => fmt(new Decimal(r.monto), 'ARS')).join(' + ')} = ${fmt(arsTot, 'ARS')}` : `sin ingreso en pesos declarado = ${fmt(CERO, 'ARS')}`, arsDecl.map((r) => ({ nombre: `${r.concepto} (declarado)`, valor: r.monto, unidad: 'ARS' as const })), { etiquetas: ['declarado'], explicacion: 'Tu ingreso fijo en pesos declarado, vigente este mes.' })
    ingArs = { ars: arsCalc, usd: aUsd(arsCalc, ccl, 'Ingreso en pesos', 'Tu ingreso en pesos, en dólares al CCL de tu última carga.') }
  }
  const sumaDoble = (partes: { nombre: string; c: DobleCalc }[], explicacion: string): DobleCalc => {
    const una = (k: 'ars' | 'usd'): Calc => {
      const m = k === 'ars' ? 'ARS' : 'USD'
      const falta = partes.find((p) => p.c[k].valor === null)
      if (falta) return sinDato(falta.c[k].motivo ?? `Falta ${falta.nombre}.`, partes.map((p) => deCalc(p.nombre, p.c[k], m)), { explicacion })
      const v = partes.reduce((a, p) => a.plus(p.c[k].valor as Decimal), CERO)
      return calc(v, `${partes.map((p) => fmt(p.c[k].valor as Decimal, m)).join(' + ')} = ${fmt(v, m)}`, partes.map((p) => deCalc(p.nombre, p.c[k], m)), { explicacion })
    }
    return { ars: una('ars'), usd: una('usd') }
  }
  const ingresosArs = sumaDoble([{ nombre: 'Ingreso en dólares, en pesos', c: ingUsd }, { nombre: 'Ingreso en pesos', c: ingArs }], 'Lo que entra en el mes, en pesos.').ars
  // En dólares, todo ÷ CCL: vender al cripto (o recibir pesos) cuesta lo que cuesta, y se ve.
  // Sin ningún ingreso declarado vigente ni cargado en el mes, el ingreso no es 0: es sin dato.
  const vigentes = vigentesEn(base.recurrentes, mes)
  const sinIngreso = !realIng.length && !vigentes.some((r) => r.sentido === 'ingreso')
  const ingresos: DobleCalc = sinIngreso
    ? (() => {
        const c = sinDato('Todavía no declaraste tu ingreso de este mes: declaralo en «Tus ingresos y gastos» o cargá lo que entró.', [], { explicacion: 'Lo que entra en el mes.' })
        return { ars: c, usd: c }
      })()
    : { ars: ingresosArs, usd: aUsd(ingresosArs, ccl, 'Ingresos', 'Lo que entra en el mes, en dólares al CCL de tu última carga.') }

  // Gastos
  const gasTot = realGas.length ? realGas.reduce((a, f) => a.plus(f.moneda === 'ARS' ? f.monto : new Decimal(f.monto).times(ccl ?? 0)), CERO) : gasDecl.reduce((a, r) => a.plus(r.monto), CERO).plus(gasDeclUsd.reduce((a, r) => a.plus(new Decimal(r.monto).times(ccl ?? 0)), CERO))
  const gasCalc = realGas.length
    ? calc(gasTot, `lo que cargaste = ${fmt(gasTot, 'ARS')}`, realGas.map((f) => ({ nombre: `Cargaste el ${fechaCorta(f.fecha)}`, valor: f.monto, unidad: f.moneda, origen: { carga_id: f.carga_id } })), { explicacion: 'El gasto fijo del mes que cargaste.' })
    : calc(gasTot, gasDecl.length || gasDeclUsd.length ? `${[...gasDecl, ...gasDeclUsd].map((r) => fmt(new Decimal(r.monto), r.moneda)).join(' + ')} = ${fmt(gasTot, 'ARS')}` : `sin gastos declarados = ${fmt(CERO, 'ARS')}`, [...gasDecl, ...gasDeclUsd].map((r) => ({ nombre: `${r.concepto} (declarado)`, valor: r.monto, unidad: r.moneda })), { etiquetas: ['declarado'], explicacion: 'Tus gastos fijos declarados del mes. Son declarados, no gastos reales.' })
  // Sin ningún gasto declarado vigente ni cargado, los gastos no son 0: son sin dato. Y un gasto en
  // dólares sin CCL no se pasa a pesos (nunca × 0).
  const sinGasto = !realGas.length && !vigentes.some((r) => r.sentido === 'gasto')
  const usdSinCcl = ccl === null && (realGas.some((f) => f.moneda === 'USD') || (!realGas.length && gasDeclUsd.length > 0))
  const gasFinal: Calc = sinGasto
    ? sinDato('Todavía no declaraste tus gastos fijos: declaralos en «Tus ingresos y gastos».', [], { explicacion: 'Tus gastos fijos del mes.' })
    : usdSinCcl
      ? sinDato('Falta el CCL de tu última carga para pasar a pesos tus gastos en dólares.', [], { explicacion: 'Tus gastos fijos del mes.' })
      : gasCalc
  const gastos: DobleCalc = { ars: gasFinal, usd: aUsd(gasFinal, ccl, 'Gastos', 'Tus gastos del mes en dólares, al CCL de tu última carga.') }

  // Cuotas del mes
  const delMesC = base.cuotas.filter((c) => c.fecha_vencimiento.slice(0, 7) === mes.slice(0, 7))
  const cuotas: CuotaDelMes[] = delMesC.map((c) => ({
    nro: c.nro,
    fecha: c.fecha_vencimiento,
    total: calc(
      new Decimal(c.total),
      c.partes
        ? `canon ${fmt(new Decimal(c.partes.canon), 'ARS')} + IVA ${fmt(new Decimal(c.partes.iva), 'ARS')} + seguro ${fmt(new Decimal(c.partes.seguro), 'ARS')} + percepción ${fmt(new Decimal(c.partes.percepcion), 'ARS')}${c.partes.cargos ? ` + cargos extra ${fmt(new Decimal(c.partes.cargos), 'ARS')}` : ''} = ${fmt(new Decimal(c.total), 'ARS')}`
        : `cuota ${c.nro} = ${fmt(new Decimal(c.total), 'ARS')}`,
      [],
      { etiquetas: c.etiquetas, explicacion: 'La cuota entera, lo que se debita.' },
    ),
    quien: quienPaga(c, declarado),
    etiquetas: c.etiquetas,
  }))
  const sinPagador = cuotas.find((c) => c.quien === null)
  const titular = cuotas.filter((c) => c.quien === 'titular')
  const cuotaTot = titular.reduce((a, c) => a.plus(c.total.valor as Decimal), CERO)
  // Un leasing sin cuadro de marcha cargado: la cuota del mes no se sabe (nunca $ 0), salvo que la pague la empresa.
  const sin_cuadro = leasingsSinCuadro(base, mes).filter((l) => (l.pagador ?? declarado ?? 'titular') !== 'empresa')
  const cuotaArs: Calc = sin_cuadro.length
    ? sinDato(motivoSinCuadro(sin_cuadro[0]), cuotas.map((c) => deCalc(`Cuota ${c.nro}`, c.total, 'ARS')), { explicacion: 'La cuota del leasing de este mes, entera (lo que se debita).' })
    : sinPagador
    ? sinDato(`¿Quién paga la cuota ${sinPagador.nro}? Elegí Vos o La empresa.`, cuotas.map((c) => deCalc(`Cuota ${c.nro}`, c.total, 'ARS')))
    : calc(cuotaTot, titular.length ? `${titular.map((c) => `cuota ${c.nro} ${fmt(c.total.valor as Decimal, 'ARS')}`).join(' + ')} = ${fmt(cuotaTot, 'ARS')}` : cuotas.length ? `la paga la empresa = ${fmt(CERO, 'ARS')}` : `sin cuota este mes = ${fmt(CERO, 'ARS')}`, cuotas.map((c) => deCalc(`Cuota ${c.nro} (${c.quien === 'empresa' ? 'la paga la empresa' : 'la pagás vos'})`, c.total, 'ARS')), { explicacion: 'Las cuotas del leasing del mes que pagás vos, enteras (canon, IVA, seguro y percepción).' })
  const cuota: DobleCalc = { ars: cuotaArs, usd: aUsd(cuotaArs, ccl, 'Cuota', 'La cuota en dólares, al CCL de tu última carga.') }
  // Como en la proyección: si declaraste en Pasivos que la empresa te reintegra el IVA, el IVA y la percepción
  // de tus cuotas del mes vuelven y suman al excedente (sin declararlo, no se supone ningún reintegro).
  const reintegraIva = (pasivo_id: number) => base.pasivos?.find((x) => x.id === pasivo_id)?.reintegra_iva === true
  const reintegro = delMesC
    .filter((c) => quienPaga(c, declarado) === 'titular' && reintegraIva(c.pasivo_id))
    .reduce((a, c) => a.plus(c.iva_y_percepcion), CERO)

  const resta = (k: 'ars' | 'usd'): Calc => {
    const m = k === 'ars' ? 'ARS' : 'USD'
    const partes = [
      { n: 'Ingresos', c: ingresos[k] },
      { n: 'Gastos fijos', c: gastos[k] },
      { n: 'Cuota del leasing', c: cuota[k] },
    ]
    const explicacion = 'Lo que te queda para invertir este mes: ingresos − gastos fijos − la cuota entera del leasing.'
    if (sin_declaraciones) return sinDato('Faltan tus ingresos y gastos: cargalos para ver tu excedente.', [], { explicacion })
    const falta = partes.find((p) => p.c.valor === null)
    if (falta) return sinDato(falta.c.motivo ?? `Falta ${falta.n}.`, partes.map((p) => deCalc(p.n, p.c, m)), { explicacion })
    if (reintegro.gt(0) && k === 'usd') {
      // En dólares, el excedente es el de pesos al CCL (el reintegro va en pesos).
      return aUsd(resta('ars'), ccl, 'Excedente', 'Tu excedente del mes en dólares, al CCL de tu última carga.')
    }
    const v = (ingresos[k].valor as Decimal).minus(gastos[k].valor as Decimal).minus(cuota[k].valor as Decimal).plus(reintegro)
    const conReintegro = reintegro.gt(0) ? ` + ${fmt(reintegro, m)} (reintegro del IVA y la percepción)` : ''
    const insReintegro: Insumo[] = reintegro.gt(0) ? [{ nombre: 'Reintegro del IVA y la percepción de tus cuotas (lo declaraste en Pasivos)', valor: reintegro.toFixed(), unidad: m }] : []
    return calc(v, `${fmt(ingresos[k].valor as Decimal, m)} − ${fmt(gastos[k].valor as Decimal, m)} − ${fmt(cuota[k].valor as Decimal, m)}${conReintegro} = ${fmt(v, m)}`, [...partes.map((p) => deCalc(p.n, p.c, m)), ...insReintegro], {
      explicacion: reintegro.gt(0) ? `${explicacion} La empresa te reintegra el IVA y la percepción (lo declaraste): vuelven al excedente.` : explicacion,
    })
  }
  const excArs = resta('ars')
  return {
    mes,
    ingreso_usd: ingUsd,
    ingreso_pesos: ingArs,
    ingresos,
    gastos,
    cuota,
    cuotas,
    excedente: { ars: excArs, usd: aUsd(excArs, ccl, 'Excedente', 'Tu excedente del mes en dólares, al CCL de tu última carga.') },
    reales: { ingresos: realIng.length > 0, gastos: realGas.length > 0 },
    sin_declaraciones,
    sin_cuadro,
  }
}
