// Proyectado contra real, mes a mes (plan §6 D.9; spec §6, visión 4.12): "las
// proyecciones se van transformando en datos reales a medida que pasa el
// tiempo". Nada proyectado se guarda: lo proyectado de un mes que ya pasó se
// recalcula de lo que declaraste vigente ese mes, con el cripto y el CCL de las
// cargas de ese mes. Lo real sale de lo que cargaste. Los gastos reales son
// "sin dato" salvo los que cargaste (el cierre por diferencia de saldos, D-79,
// sigue afuera). Lo extraordinario va aparte: no cambia lo recurrente.

import { calc, deCalc, sinDato, type Calc, type DobleCalc } from '../calc'
import { CERO, Decimal, monto, numero } from '../dinero'
import type { Fecha } from '../tipos'
import { leasingsSinCuadro, motivoSinCuadro } from './cuotas'
import { delMes, finDeMes } from './recurrentes'
import type { BaseProyeccion, FlujoReal } from './tipos'

const fmt = (x: Decimal, m: 'ARS' | 'USD') => monto(x, m, { decimales: 2 })

/** Los flujos cargados de un mes (sin los anulados). */
export function flujosDelMes(flujos: readonly FlujoReal[], mes: Fecha): FlujoReal[] {
  return flujos.filter((f) => !f.anulado && f.fecha.slice(0, 7) === mes.slice(0, 7))
}

/** El CCL y el cripto de las cargas de ese mes (el último hasta fin de mes). */
function tcDelMes(base: BaseProyeccion, mes: Fecha): { ccl: Decimal | null; cripto: Decimal | null } {
  const fin = finDeMes(mes)
  let ccl: Decimal | null = null
  let cripto: Decimal | null = null
  for (const t of [...(base.historia_tc ?? [])].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))) {
    if (t.fecha > fin) break
    if (t.ccl) ccl = new Decimal(t.ccl)
    if (t.cripto) cripto = new Decimal(t.cripto)
  }
  return { ccl: ccl ?? (base.ccl ? new Decimal(base.ccl) : null), cripto: cripto ?? (base.cripto ? new Decimal(base.cripto) : null) }
}

const SIN_CCL = 'Falta el CCL de ese mes: sin él, lo cargado en dólares no se pasa a pesos (nunca × 0).'

/** Un flujo en dólares sin vender (sin pesos recibidos) que haría falta pasar a pesos sin CCL. */
function sinCclPara(f: FlujoReal, ccl: Decimal | null): boolean {
  return ccl === null && f.moneda === 'USD' && !f.pesos_recibidos
}

export type LineaDesvio = 'ingresos' | 'gastos' | 'cuota' | 'vencimientos' | 'extraordinarios'

export interface FilaDesvio {
  linea: LineaDesvio
  nombre: string
  proyectado: DobleCalc
  real: DobleCalc
  desvio: DobleCalc
}

function doble(ars: Calc, ccl: Decimal | null, explicacion: string): DobleCalc {
  if (ars.valor === null) return { ars, usd: sinDato(ars.motivo ?? 'Falta el valor en pesos.', [deCalc('En pesos', ars, 'ARS')], { explicacion }) }
  if (ccl === null) return { ars, usd: sinDato('Falta el CCL de ese mes.', [deCalc('En pesos', ars, 'ARS')], { explicacion }) }
  return {
    ars,
    usd: calc(ars.valor.div(ccl), `${fmt(ars.valor, 'ARS')} ÷ CCL ${numero(ccl, 2)} = ${fmt(ars.valor.div(ccl), 'USD')}`, [deCalc('En pesos', ars, 'ARS'), { nombre: 'CCL del mes', valor: ccl.toFixed(), unidad: 'ratio' }], { explicacion }),
  }
}

function resta(a: DobleCalc, b: DobleCalc, nombre: string): DobleCalc {
  const una = (k: 'ars' | 'usd'): Calc => {
    const m = k === 'ars' ? 'ARS' : 'USD'
    const ins = [deCalc('Real', a[k], m), deCalc('Proyectado', b[k], m)]
    const explicacion = `El desvío de ${nombre}: real − proyectado.`
    if (a[k].valor === null) return sinDato(a[k].motivo ?? 'Falta lo real.', ins, { explicacion })
    if (b[k].valor === null) return sinDato(b[k].motivo ?? 'Falta lo proyectado.', ins, { explicacion })
    const v = (a[k].valor as Decimal).minus(b[k].valor as Decimal)
    return calc(v, `${fmt(a[k].valor as Decimal, m)} − ${fmt(b[k].valor as Decimal, m)} = ${fmt(v, m)}`, ins, { explicacion })
  }
  return { ars: una('ars'), usd: una('usd') }
}

/** Real contra proyectado de un mes, por línea. */
export function desvioMes(base: BaseProyeccion, mes: Fecha, opciones: { pagador_declarado?: 'titular' | 'empresa' | null } = {}): FilaDesvio[] {
  const { ccl, cripto } = tcDelMes(base, mes)
  const fl = flujosDelMes(base.flujos_reales, mes)
  const out: FilaDesvio[] = []

  // Ingresos
  const usdDecl = delMes(base.recurrentes, mes, 'ingreso', 'USD').reduce((a, r) => a.plus(r.monto), CERO)
  const arsDecl = delMes(base.recurrentes, mes, 'ingreso', 'ARS').reduce((a, r) => a.plus(r.monto), CERO)
  const proyIng: Calc =
    usdDecl.gt(0) && cripto === null
      ? sinDato('Falta el cripto de ese mes para pasar tu ingreso en dólares a pesos.')
      : calc(usdDecl.times(cripto ?? 0).plus(arsDecl), `${fmt(usdDecl, 'USD')} × cripto ${numero(cripto ?? CERO, 2)} + ${fmt(arsDecl, 'ARS')} = ${fmt(usdDecl.times(cripto ?? 0).plus(arsDecl), 'ARS')}`, [], {
          etiquetas: ['declarado'],
          explicacion: 'Lo que declaraste vigente ese mes, con el cripto de las cargas de ese mes.',
        })
  const ingR = fl.filter((f) => f.sentido === 'ingreso' && f.concepto === 'mensual')
  const realIngArs = ingR.reduce((a, f) => a.plus(f.pesos_recibidos ?? (f.moneda === 'ARS' ? f.monto : new Decimal(f.monto).times(ccl ?? 0))), CERO)
  const realIng: Calc = ingR.some((f) => sinCclPara(f, ccl))
    ? sinDato(SIN_CCL)
    : ingR.length
    ? calc(realIngArs, `lo que cargaste = ${fmt(realIngArs, 'ARS')}`, ingR.map((f) => ({ nombre: `Cargaste el ${f.fecha}`, valor: f.monto, unidad: f.moneda, origen: { carga_id: f.carga_id } })), { explicacion: 'El ingreso mensual que cargaste.' })
    : sinDato('No cargaste el ingreso de ese mes (Cargar ingreso).')
  const pIng = doble(proyIng, ccl, 'En dólares, al CCL del mes.')
  const rIng = doble(realIng, ccl, 'En dólares, al CCL del mes.')
  out.push({ linea: 'ingresos', nombre: 'Ingreso mensual', proyectado: pIng, real: rIng, desvio: resta(rIng, pIng, 'tus ingresos') })

  // Gastos
  const gasDecl = delMes(base.recurrentes, mes, 'gasto', 'ARS').filter((g) => g.pagador !== 'empresa').reduce((a, r) => a.plus(r.monto), CERO)
  // Los gastos declarados en dólares también son gasto del mes (al CCL del mes; sin CCL, sin dato).
  const gasDeclUsd = delMes(base.recurrentes, mes, 'gasto', 'USD').filter((g) => g.pagador !== 'empresa').reduce((a, r) => a.plus(r.monto), CERO)
  const pGas = doble(
    gasDeclUsd.gt(0) && ccl === null
      ? sinDato(SIN_CCL)
      : calc(
          gasDecl.plus(gasDeclUsd.times(ccl ?? 0)),
          gasDeclUsd.gt(0)
            ? `${fmt(gasDecl, 'ARS')} + ${fmt(gasDeclUsd, 'USD')} × CCL ${numero(ccl ?? CERO, 2)} = ${fmt(gasDecl.plus(gasDeclUsd.times(ccl ?? 0)), 'ARS')}`
            : `declarados = ${fmt(gasDecl, 'ARS')}`,
          [],
          { etiquetas: ['declarado'], explicacion: 'Tus gastos declarados ese mes.' },
        ),
    ccl,
    'En dólares.',
  )
  const gasR = fl.filter((f) => f.sentido === 'gasto' && f.concepto === 'mensual')
  const realGasArs = gasR.reduce((a, f) => a.plus(f.moneda === 'ARS' ? f.monto : new Decimal(f.monto).times(ccl ?? 0)), CERO)
  const rGas = doble(
    gasR.some((f) => sinCclPara(f, ccl)) ? sinDato(SIN_CCL) : gasR.length ? calc(realGasArs, `lo que cargaste = ${fmt(realGasArs, 'ARS')}`, [], { explicacion: 'El gasto fijo del mes que cargaste.' }) : sinDato('No cargaste el gasto de ese mes: los gastos reales son "sin dato" salvo los que cargás.'),
    ccl,
    'En dólares.',
  )
  out.push({ linea: 'gastos', nombre: 'Gastos fijos', proyectado: pGas, real: rGas, desvio: resta(rGas, pGas, 'tus gastos') })

  // Cuota
  const cs = base.cuotas.filter((c) => c.fecha_vencimiento.slice(0, 7) === mes.slice(0, 7) && (c.pagador ?? opciones.pagador_declarado ?? 'titular') === 'titular')
  if (cs.length) {
    const tot = cs.reduce((a, c) => a.plus(c.total), CERO)
    const pag = cs.filter((c) => c.pagada)
    const totPag = pag.reduce((a, c) => a.plus(c.total), CERO)
    const pC = doble(calc(tot, `${cs.map((c) => `cuota ${c.nro}`).join(' + ')} = ${fmt(tot, 'ARS')}`, [], { etiquetas: cs.flatMap((c) => c.etiquetas), explicacion: 'Las cuotas del cuadro de marcha de ese mes.' }), ccl, 'En dólares.')
    const rC = doble(pag.length ? calc(totPag, `pagadas = ${fmt(totPag, 'ARS')}`, [], { explicacion: 'Las cuotas de ese mes que figuran pagadas.' }) : sinDato('Todavía no figura pagada.'), ccl, 'En dólares.')
    out.push({ linea: 'cuota', nombre: 'Cuota del leasing', proyectado: pC, real: rC, desvio: resta(rC, pC, 'la cuota') })
  }

  // Un leasing sin cuadro de marcha: la cuota proyectada de ese mes no se sabe (no se omite ni se cuenta como $ 0).
  const sinCuadro = cs.length ? [] : leasingsSinCuadro(base, mes).filter((l) => (l.pagador ?? opciones.pagador_declarado ?? 'titular') === 'titular')
  if (sinCuadro.length) {
    const pC = doble(sinDato(motivoSinCuadro(sinCuadro[0])), ccl, 'En dólares.')
    const rC = doble(sinDato('Sin el cuadro de marcha no se sabe si figura pagada.'), ccl, 'En dólares.')
    out.push({ linea: 'cuota', nombre: 'Cuota del leasing', proyectado: pC, real: rC, desvio: resta(rC, pC, 'la cuota') })
  }

  // Vencimientos
  const vs = base.vencimientos.filter((v) => v.fecha.slice(0, 7) === mes.slice(0, 7))
  const cobros = (base.cobros_reales ?? []).filter((c) => c.fecha.slice(0, 7) === mes.slice(0, 7))
  if (vs.length || cobros.length) {
    const falta = vs.find((v) => v.monto_ars === null)
    const totV = vs.reduce((a, v) => a.plus(v.monto_ars ?? 0), CERO)
    const pV = doble(falta ? sinDato(falta.motivo ?? 'Falta el pago al vencimiento.') : calc(totV, `${vs.map((v) => v.ticker).join(' + ')} = ${fmt(totV, 'ARS')}`, [], { explicacion: 'Lo que vence según el cronograma.' }), ccl, 'En dólares.')
    const totC = cobros.reduce((a, c) => a.plus(c.ars ?? 0), CERO)
    const cobroSinCcl = cobros.find((c) => c.ars === null)
    const rV = doble(cobroSinCcl ? sinDato(`Falta el CCL del día del cobro de ${cobroSinCcl.ticker}: sin él, lo cobrado en dólares no se pasa a pesos.`) : cobros.length ? calc(totC, `cobrado = ${fmt(totC, 'ARS')}`, [], { explicacion: 'Lo que cobraste de bonos y letras ese mes (tus cargas).' }) : sinDato('Todavía no lo cobraste (o no cargaste el cobro).'), ccl, 'En dólares.')
    out.push({ linea: 'vencimientos', nombre: 'Vencimientos', proyectado: pV, real: rV, desvio: resta(rV, pV, 'los vencimientos') })
  }

  // Extraordinarios: solo reales (no se proyectan).
  const ex = fl.filter((f) => f.concepto === 'extraordinario')
  if (ex.length) {
    const tot = ex.reduce((a, f) => {
      const ars = f.pesos_recibidos ? new Decimal(f.pesos_recibidos) : f.moneda === 'ARS' ? new Decimal(f.monto) : new Decimal(f.monto).times(ccl ?? 0)
      return f.sentido === 'ingreso' ? a.plus(ars) : a.minus(ars)
    }, CERO)
    const r = doble(
      ex.some((f) => sinCclPara(f, ccl))
        ? sinDato(SIN_CCL)
        : calc(tot, `ingresos − gastos extraordinarios = ${fmt(tot, 'ARS')}`, [], { explicacion: 'Lo extraordinario que cargaste: va aparte y no cambia la proyección.' }),
      ccl,
      'En dólares.',
    )
    const p = doble(calc(CERO, 'lo extraordinario no se proyecta = $ 0', [], {}), ccl, 'En dólares.')
    out.push({ linea: 'extraordinarios', nombre: 'Extraordinarios (aparte)', proyectado: p, real: r, desvio: resta(r, p, 'lo extraordinario') })
  }
  return out
}
