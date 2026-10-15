// Arma la vista de Flujo y escenarios a partir de los Hechos y de lo que lee
// hechos-flujo.ts (plan §6 D.3). Puro: el servidor lo llama con la base y el
// modo demo con hechos inventados. La proyección no se arma acá: corre en el
// navegador sobre `base` (proyectar), a cada movimiento de un supuesto.

import { calc, deCalc, sinDato, vista, type Calc, type DobleCalc } from '@/lib/domain/calc'
import { CERO, Decimal, monto, numero } from '@/lib/domain/dinero'
import { fechaCorta } from '@/lib/domain/fechas'
import type { MovimientoParaControl } from '@/lib/domain/flujo/control'
import { cuotaBase, importeCargosPorCuota, motivoSinCuadro, type LeasingSinCuadro } from '@/lib/domain/flujo/cuotas'
import { excedenteMes } from '@/lib/domain/flujo/excedente'
import { nombreMes } from '@/lib/domain/flujo/proyeccion'
import { desvioMes } from '@/lib/domain/flujo/real'
import { delMes } from '@/lib/domain/flujo/recurrentes'
import { esquemaSupuestos, fechaMes, indiceMes, mesDe, rebasar, supuestosIniciales } from '@/lib/domain/flujo/supuestos'
import { temImplicitaValor } from '@/lib/domain/flujo/tem'
import type { BaseProyeccion, BienBase, FlujoReal, PartidaBase, VencimientoBase } from '@/lib/domain/flujo/tipos'
import { cclA, financieros, foto, indexar } from '@/lib/domain/foto'
import { diasEntre } from '@/lib/domain/fechas'
import type { Fecha, Hechos } from '@/lib/domain/tipos'
import { fechasDeCarga } from '@/lib/domain/variacion'
import type { DatosFlujo } from '@/lib/server/hechos-flujo'
import { amortizacionesParaFlujo, segunCuadroAl } from './integracion-pasivos'
import type { Par, ParteFrase } from './contratos'
import type {
  BonoSinCronograma,
  EscenarioVista,
  EstadoDemoFlujo,
  FilaCalendario,
  FilaCargada,
  FilaRecurrente,
  MesActual,
  MesCalendario,
  MesCerrado,
  VistaFlujo,
} from './contratos-flujo'

const fmt = (x: Decimal, m: 'ARS' | 'USD') => monto(x, m, { decimales: 2 })
const parDe = (d: DobleCalc): Par => ({ ars: vista(d.ars), usd: vista(d.usd) })

/** Un monto en su moneda, con el otro lado al tipo de cambio de tu última carga (cripto para ingresos en US$). */
function doble(valor: Calc, moneda: 'ARS' | 'USD', tc: { ccl: Decimal | null; cripto: Decimal | null }, usarCripto: boolean): DobleCalc {
  const otro = moneda === 'ARS' ? 'USD' : 'ARS'
  const tasa = usarCripto && moneda === 'USD' ? tc.cripto : tc.ccl
  const nombreTasa = usarCripto && moneda === 'USD' ? 'cripto de tu última carga' : 'CCL de tu última carga'
  let conv: Calc
  if (valor.valor === null) conv = sinDato(valor.motivo ?? 'Falta el monto.', [deCalc('Monto', valor, moneda)])
  else if (tasa === null)
    conv = sinDato(usarCripto && moneda === 'USD' ? 'Falta el dólar cripto: cargalo en tu próxima carga.' : 'Falta el CCL de tu última carga.', [deCalc('Monto', valor, moneda)])
  else {
    const v = moneda === 'USD' ? valor.valor.times(tasa) : valor.valor.div(tasa)
    conv = calc(v, `${fmt(valor.valor, moneda)} ${moneda === 'USD' ? '×' : '÷'} ${numero(tasa, 2)} = ${fmt(v, otro)}`, [deCalc('Monto', valor, moneda), { nombre: nombreTasa, valor: tasa.toFixed(), unidad: 'ratio' }], {
      etiquetas: valor.etiquetas,
      explicacion: `Al ${nombreTasa}: es una referencia de hoy, no un supuesto.`,
    })
  }
  return moneda === 'ARS' ? { ars: valor, usd: conv } : { ars: conv, usd: valor }
}

const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Arma la base serializable de la proyección: la última carga, lo declarado, el leasing y los cronogramas. */
export function armarBase(h: Hechos, d: DatosFlujo, hoy: Fecha): BaseProyeccion | null {
  const fechas = fechasDeCarga(h)
  const fecha = fechas.at(-1)
  if (!fecha) return null
  const ix = indexar(h)
  const f = foto(h, fecha, { hoy, ix })
  const ccl = cclA(ix, fecha, hoy).calc.valor
  const tcs = [...h.tipos_cambio].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  const conCripto = tcs.filter((t) => t.cripto_venta !== null && t.fecha <= fecha).at(-1) ?? null
  const fin = financieros(f)
  const flujosPorActivo = new Map<number, typeof d.flujos_bono>()
  for (const x of d.flujos_bono) flujosPorActivo.set(x.activo_id, [...(flujosPorActivo.get(x.activo_id) ?? []), x])

  const partidas: PartidaBase[] = []
  const vencimientos: VencimientoBase[] = []
  for (const i of fin.filter((x) => x.clase === 'posicion')) {
    const a = i.activo
    if (!a) continue
    const esRenta = a.tipo === 'bono' || a.tipo === 'lecap'
    const flujos = (flujosPorActivo.get(a.id) ?? []).filter((x) => x.fecha > fecha).sort((x, y) => (x.fecha < y.fecha ? -1 : 1))
    let ley: PartidaBase['ley'] = 'clase'
    if (esRenta) ley = a.indexacion === 'fija' ? (flujos.length && flujos.every((x) => x.interes !== null) ? 'cronograma' : 'sin_cronograma') : 'propia'
    let tem: string | null = null
    const cant = i.cantidad
    if (esRenta && cant !== null) {
      flujos.forEach((x, k) => {
        const pago = x.interes === null ? null : x.interes.plus(x.amortizacion)
        vencimientos.push({
          activo_id: a.id,
          clave: i.clave,
          ticker: a.ticker,
          fecha: x.fecha,
          cantidad: cant.toFixed(),
          pago_por_vn: pago?.toFixed() ?? null,
          fuente: x.fuente,
          monto_ars: pago === null ? null : pago.times(cant).toFixed(),
          motivo: pago === null ? `El interés del pago de ${a.ticker} del ${fechaCorta(x.fecha)} es a determinar.` : null,
          valor_hoy_ars: i.valor_ars.valor?.toFixed() ?? null,
          es_ultimo: k === flujos.length - 1,
        })
      })
      if (ley === 'cronograma' && i.valor_ars.valor !== null) {
        const t = temImplicitaValor(
          i.valor_ars.valor,
          flujos.map((x) => ({ dias: diasEntre(fecha, x.fecha), monto: (x.interes as Decimal).plus(x.amortizacion).times(cant) })),
        )
        tem = t?.toFixed() ?? null
      }
      if (ley === 'sin_cronograma' && a.fecha_vencimiento && a.fecha_vencimiento > fecha && !flujos.length) {
        vencimientos.push({
          activo_id: a.id,
          clave: i.clave,
          ticker: a.ticker,
          fecha: a.fecha_vencimiento,
          cantidad: cant.toFixed(),
          pago_por_vn: null,
          fuente: null,
          monto_ars: null,
          motivo: `Falta el pago al vencimiento por VN de ${a.ticker}: cargalo para saber cuánto cobrás.`,
          valor_hoy_ars: i.valor_ars.valor?.toFixed() ?? null,
          es_ultimo: true,
        })
      }
    }
    partidas.push({
      clave: i.clave,
      nombre: `${a.ticker} · ${i.cuenta?.nombre ?? ''}`.replace(/ · $/, ''),
      ticker: a.ticker,
      clase: a.tipo,
      moneda_riesgo: a.moneda_riesgo,
      activo_id: a.id,
      cuenta_id: i.cuenta?.id ?? null,
      valor: { ars: i.valor_ars.valor?.toFixed() ?? null, usd: i.valor_usd.valor?.toFixed() ?? null },
      peso: null,
      cantidad: cant?.toFixed() ?? null,
      fecha_vencimiento: a.fecha_vencimiento,
      indexacion: a.indexacion,
      ley,
      tem,
    })
  }
  // La liquidez, sumada por moneda (un saldo negativo del bróker se netea acá).
  for (const moneda of ['ARS', 'USD'] as const) {
    const ss = fin.filter((x) => x.clase === 'saldo' && x.moneda_riesgo === moneda)
    if (!ss.length) continue
    const falta = ss.some((x) => x.valor_ars.valor === null || x.valor_usd.valor === null)
    partidas.push({
      clave: `liq:${moneda}`,
      nombre: moneda === 'ARS' ? 'Liquidez en pesos' : 'Dólares en efectivo',
      ticker: moneda === 'ARS' ? 'Pesos' : 'Dólares',
      clase: 'liquidez',
      moneda_riesgo: moneda,
      activo_id: null,
      cuenta_id: null,
      valor: falta
        ? { ars: null, usd: null }
        : {
            ars: ss.reduce((acc, x) => acc.plus(x.valor_ars.valor as Decimal), CERO).toFixed(),
            usd: ss.reduce((acc, x) => acc.plus(x.valor_usd.valor as Decimal), CERO).toFixed(),
          },
      peso: null,
      cantidad: null,
      fecha_vencimiento: null,
      ley: 'clase',
    })
  }
  const positivos = partidas.filter((p) => p.valor.ars !== null && new Decimal(p.valor.ars).gt(0))
  const tot = positivos.reduce((a, p) => a.plus(p.valor.ars as string), CERO)
  if (tot.gt(0) && partidas.every((p) => p.valor.ars !== null)) {
    for (const p of positivos) p.peso = new Decimal(p.valor.ars as string).div(tot).toFixed()
  }

  const contratos = new Map(d.leasing.contratos.map((c) => [c.id, c]))
  const amortizaciones = amortizacionesParaFlujo(h, d.leasing, hoy)
  const cargos = importeCargosPorCuota(d.leasing.cuotas, d.leasing.cargos)
  // La deuda de la base, con el mismo orden que el motor, el Balance y Pasivos (D-131,
  // revisión de la entrega 4): informada › según el cuadro de marcha › estimada.
  const segunCuadro = segunCuadroAl(h, d.leasing)(fecha)
  const bienes: BienBase[] = h.bienes
    .filter((b) => b.activo_bool)
    .map((b) => {
      const v = h.valuaciones.filter((x) => x.bien_id === b.id && x.fecha <= fecha).sort((x, y) => (x.fecha < y.fecha ? -1 : 1)).at(-1)
      return { id: b.id, nombre: b.nombre, tipo: b.tipo, moneda: b.moneda_valuacion, valor: v?.valor.toFixed() ?? null, pasivo_id: b.pasivo_id }
    })
  const flujos_reales: FlujoReal[] = d.flujos
    .filter((x) => !x.revertida)
    .map((x) => ({
      id: x.id,
      fecha: x.fecha,
      sentido: x.sentido,
      concepto: x.concepto,
      moneda: x.moneda,
      monto: x.monto,
      cuenta_id: x.cuenta_id,
      cripto_usado: x.cripto_usado,
      pesos_recibidos: x.pesos_recibidos,
      anulado: x.anulado,
      carga_id: x.carga_id,
      notas: x.notas,
    }))
  const activos = new Map(h.activos.map((a) => [a.id, a]))
  return {
    fecha,
    hoy,
    ccl: ccl?.toFixed() ?? null,
    cripto: conCripto?.cripto_venta?.toFixed() ?? null,
    fecha_cripto: conCripto?.fecha ?? null,
    partidas,
    recurrentes: d.recurrentes,
    // La amortización de cada cuota sale de la apertura de Pasivos (a la tasa del contrato):
    // con ella, el neto completo proyectado deja de ser "sin dato".
    // Los cargos extra se debitan con su cuota (los sin cuota, con la del mes de su fecha).
    cuotas: d.leasing.cuotas.map((c) =>
      cuotaBase(c, contratos.get(c.pasivo_id) ?? null, amortizaciones.get(`${c.pasivo_id}-${c.nro}`) ?? null, cargos.get(`${c.pasivo_id}-${c.nro}`) ?? null),
    ),
    vencimientos,
    bienes,
    deudas: h.pasivos.map((p) => {
      const saldos = h.pasivo_saldos.filter((x) => x.pasivo_id === p.id && x.fecha <= fecha).sort((x, y) => (x.fecha < y.fecha ? -1 : 1))
      const informado = saldos.filter((x) => x.naturaleza === 'informado').at(-1)
      if (informado) return { pasivo_id: p.id, ars: informado.capital_pendiente.toFixed(), origen: 'informada' as const }
      const s = saldos.at(-1)
      const cuadro = segunCuadro.get(p.id)?.ars.valor
      if (cuadro !== undefined && cuadro !== null) return { pasivo_id: p.id, ars: cuadro.toFixed(), origen: 'segun_cuadro' as const }
      if (s) return { pasivo_id: p.id, ars: s.capital_pendiente.toFixed(), origen: 'estimada' as const }
      return { pasivo_id: p.id, ars: null, origen: null }
    }),
    flujos_reales,
    pasivos: d.leasing.contratos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      pagador_habitual: c.pagador_habitual,
      reintegra_iva: c.reintegra_iva,
      tipo: c.tipo,
      fecha_inicio: c.fecha_inicio,
      cuotas_totales: c.cuotas_totales,
    })),
    historia_tc: tcs.map((t) => ({ fecha: t.fecha, ccl: t.ccl?.toFixed() ?? null, cripto: t.cripto_venta?.toFixed() ?? null })),
    cobros_reales: h.operaciones
      .filter((o) => (o.tipo === 'vencimiento' || o.tipo === 'renta' || o.tipo === 'amortizacion') && o.importe !== null)
      .map((o) => ({
        fecha: o.fecha,
        ticker: activos.get(o.activo_id)?.ticker ?? `#${o.activo_id}`,
        // En dólares sin el CCL de su día: sin dato (null), nunca × 0.
        ars: o.moneda === 'USD' ? (o.ccl_del_dia === null ? null : (o.importe as Decimal).times(o.ccl_del_dia).toFixed()) : (o.importe as Decimal).toFixed(),
      })),
    cuentas: h.cuentas.map((c) => ({ id: c.id, nombre: c.nombre })),
  }
}

/** La frase del mes en curso, en partes tocables. */
function fraseDelMes(m: ReturnType<typeof excedenteMes>, base: BaseProyeccion, nombre: string): ParteFrase[] {
  const p: ParteFrase[] = []
  const t = (texto: string) => p.push({ texto, calc: null })
  const c = (cc: Calc, moneda: 'ARS' | 'USD') => p.push({ texto: cc.valor === null ? 'sin dato' : fmt(cc.valor, moneda), calc: vista(cc) })
  if (m.sin_declaraciones) {
    t(`${nombre}: todavía no declaraste tus ingresos ni tus gastos. Con eso calculo tu excedente del mes.`)
    return p
  }
  t(`${nombre}, ${m.reales.ingresos ? 'con lo que cargaste' : 'con lo que declaraste'}: ingresan `)
  const usd = m.ingreso_usd.usd.valor
  if (usd !== null && !usd.isZero()) {
    c(m.ingreso_usd.usd, 'USD')
    if (!m.reales.ingresos) {
      t(' × cripto ')
      p.push({ texto: base.cripto ? numero(base.cripto, 2) : 'sin dato', calc: base.cripto ? vista(calc(new Decimal(base.cripto), `Cripto del ${base.fecha_cripto ? fechaCorta(base.fecha_cripto) : '—'} = ${numero(base.cripto, 2)}`, [], { explicacion: 'El dólar cripto de tu última carga: al que vendés tus dólares de ingreso.' })) : vista(sinDato('Falta el dólar cripto: cargalo en tu próxima carga.')) })
    }
    t(' = ')
    c(m.ingreso_usd.ars, 'ARS')
    t(' más ')
  }
  c(m.ingreso_pesos.ars, 'ARS')
  t(' en pesos; salen gastos fijos por ')
  c(m.gastos.ars, 'ARS')
  if (m.sin_cuadro.length) {
    // Sin cuadro de marcha la cuota no se sabe: se nombra "sin dato", no se omite.
    t(' y la cuota del leasing, ')
    c(m.cuota.ars, 'ARS')
    t(' (falta el cuadro de marcha: importalo en Datos › Leasing)')
  } else if (m.cuotas.length) {
    t(` y ${m.cuotas.length === 1 ? `la cuota ${m.cuotas[0].nro}` : `las cuotas ${m.cuotas.map((x) => x.nro).join(' y ')}`} del leasing por `)
    c(m.cuota.ars, 'ARS')
    const quien = m.cuotas[0].quien
    t(quien === 'empresa' ? ' (la paga la empresa: no resta)' : quien === 'titular' ? ' (la pagás vos)' : ' (¿quién la paga?)')
  }
  t('. Excedente invertible: ')
  c(m.excedente.ars, 'ARS')
  if (m.excedente.ars.valor === null) {
    // Sin dato una sola vez, con su motivo a la vista (no "sin dato (sin dato)").
    t(` · ${(m.excedente.ars.motivo ?? '').replace(/\.$/, '')}.`)
    return p
  }
  t(' (')
  c(m.excedente.usd, 'USD')
  t(').')
  return p
}

export function armarFlujo(h: Hechos, d: DatosFlujo, hoy: Fecha, demo: EstadoDemoFlujo | null = null): VistaFlujo {
  const base = armarBase(h, d, hoy)
  const ix = indexar(h)
  const fechaDatos = base?.fecha ?? null
  const cclCalc = fechaDatos ? cclA(ix, fechaDatos, hoy).calc : sinDato('Todavía no hay cargas.')
  const ccl = cclCalc.valor
  const criptoD = base?.cripto ? new Decimal(base.cripto) : null
  const criptoCalc: Calc = criptoD
    ? calc(criptoD, `Cripto del ${base?.fecha_cripto ? fechaCorta(base.fecha_cripto) : '—'} = ${numero(criptoD, 2)}`, [], { explicacion: 'El dólar cripto de tu última carga: al que vendés tus dólares de ingreso.' })
    : sinDato('Falta el dólar cripto: cargalo en tu próxima carga.')
  const tc = { ccl, cripto: criptoD }
  const contratos = d.leasing.contratos
  // Quién paga la cuota: lo del contrato; si no, lo que dijiste el 14/10 (la restás de tu ingreso).
  const pagadorDeclarado = contratos.find((c) => c.pagador_habitual)?.pagador_habitual ?? 'titular'
  const reintegro = contratos.find((c) => c.reintegra_iva !== null)?.reintegra_iva ?? null

  // El mes en curso
  let mes_actual: MesActual | null = null
  const mesHoy = mesDe(hoy)
  if (base) {
    const m = excedenteMes(base, mesHoy, { pagador_declarado: pagadorDeclarado })
    const nombre = MESES_LARGOS[Number(mesHoy.slice(5, 7)) - 1]
    const ccl0 = ccl
    mes_actual = {
      mes: mesHoy,
      nombre,
      partes: fraseDelMes(m, base, nombre),
      ingresos: parDe(m.ingresos),
      gastos: parDe(m.gastos),
      cuota: parDe(m.cuota),
      excedente: parDe(m.excedente),
      cuotas: m.cuotas.map((x) => ({ nro: x.nro, fecha: x.fecha, total: parDe(doble(x.total, 'ARS', { ccl: ccl0, cripto: criptoD }, false)), quien: x.quien, chips: x.etiquetas })),
      vencimientos: base.vencimientos
        .filter((v) => v.fecha.slice(0, 7) === mesHoy.slice(0, 7) || indiceMes(mesHoy, v.fecha) === 1)
        .map((v) => ({
          ticker: v.ticker,
          fecha: v.fecha,
          valor: parDe(
            doble(
              v.monto_ars === null
                ? sinDato(v.motivo ?? 'Falta el pago al vencimiento.')
                : calc(new Decimal(v.monto_ars), `${numero(v.cantidad ?? '0', 0)} VN × ${monto(v.pago_por_vn ?? '0', 'ARS', { decimales: 4 })} = ${fmt(new Decimal(v.monto_ars), 'ARS')}`, [], {
                    explicacion: `Lo que cobrás de ${v.ticker}: tus VN × el pago por VN${v.fuente ? ` (${v.fuente})` : ''}.`,
                  }),
              'ARS',
              tc,
              false,
            ),
          ),
        })),
      reales: m.reales,
      sin_declaraciones: m.sin_declaraciones,
    }
  }

  // El calendario de la plata: los próximos 12 meses, sin supuestos.
  const calendario: MesCalendario[] = []
  // El primer leasing al que le falta la cuota de algún mes del calendario: va también en "Faltan datos".
  let sinCuadro: LeasingSinCuadro | null = null
  if (base) {
    for (let k = 0; k < 12; k++) {
      const mes = fechaMes(mesHoy, k)
      const filas: FilaCalendario[] = []
      for (const r of [...delMes(base.recurrentes, mes, 'ingreso', 'USD'), ...delMes(base.recurrentes, mes, 'ingreso', 'ARS')]) {
        const v = calc(new Decimal(r.monto), `${r.concepto} = ${fmt(new Decimal(r.monto), r.moneda)}`, [], { etiquetas: ['declarado'], explicacion: 'Lo que declaraste, vigente ese mes.' })
        filas.push({ tipo: 'ingreso', nombre: r.concepto, detalle: r.moneda === 'USD' ? 'en pesos, al cripto de hoy' : null, valor: parDe(doble(v, r.moneda, tc, true)), chips: ['declarado'], cargar_pago: null })
      }
      for (const r of [...delMes(base.recurrentes, mes, 'gasto', 'ARS'), ...delMes(base.recurrentes, mes, 'gasto', 'USD')]) {
        if (r.pagador === 'empresa') continue
        const v = calc(new Decimal(r.monto).negated(), `− ${r.concepto} = ${fmt(new Decimal(r.monto).negated(), r.moneda)}`, [], { etiquetas: ['declarado'], explicacion: 'Un gasto declarado (no es un gasto real).' })
        filas.push({ tipo: 'gasto', nombre: r.concepto, detalle: r.frecuencia !== 'mensual' ? r.frecuencia : null, valor: parDe(doble(v, r.moneda, tc, false)), chips: ['declarado'], cargar_pago: null })
      }
      for (const c of base.cuotas.filter((x) => x.fecha_vencimiento.slice(0, 7) === mes.slice(0, 7))) {
        const quien = c.pagador ?? pagadorDeclarado
        const v = calc(
          new Decimal(c.total).negated(),
          c.partes
            ? `− (canon ${fmt(new Decimal(c.partes.canon), 'ARS')} + IVA ${fmt(new Decimal(c.partes.iva), 'ARS')} + seguro ${fmt(new Decimal(c.partes.seguro), 'ARS')} + percepción ${fmt(new Decimal(c.partes.percepcion), 'ARS')}${c.partes.cargos ? ` + cargos extra ${fmt(new Decimal(c.partes.cargos), 'ARS')}` : ''}) = ${fmt(new Decimal(c.total).negated(), 'ARS')}`
            : `− cuota ${c.nro} = ${fmt(new Decimal(c.total).negated(), 'ARS')}`,
          [],
          { etiquetas: c.etiquetas, explicacion: 'La cuota entera del cuadro de marcha: lo que se debita.' },
        )
        filas.push({
          tipo: 'cuota',
          nombre: `Cuota ${c.nro} del leasing`,
          detalle: `vence el ${fechaCorta(c.fecha_vencimiento)}${quien === 'empresa' ? ' · la paga la empresa' : quien === 'titular' ? ' · la pagás vos' : ' · ¿quién la paga?'}${c.pagada ? ' · pagada' : ''}`,
          valor: parDe(doble(v, 'ARS', tc, false)),
          chips: c.etiquetas,
          cargar_pago: null,
        })
      }
      for (const v of base.vencimientos.filter((x) => x.fecha.slice(0, 7) === mes.slice(0, 7))) {
        const val =
          v.monto_ars === null
            ? sinDato(v.motivo ?? 'Falta el pago al vencimiento.')
            : calc(new Decimal(v.monto_ars), `${numero(v.cantidad ?? '0', 0)} VN × ${monto(v.pago_por_vn ?? '0', 'ARS', { decimales: 4 })} = ${fmt(new Decimal(v.monto_ars), 'ARS')}`, [], {
                explicacion: `Lo que cobrás de ${v.ticker}${v.fuente ? `, según ${v.fuente}` : ''}.`,
              })
        filas.push({
          tipo: 'vencimiento',
          nombre: `${v.es_ultimo ? 'Vence' : 'Paga'} ${v.ticker}`,
          detalle: `el ${fechaCorta(v.fecha)}`,
          valor: parDe(doble(val, 'ARS', tc, false)),
          chips: [],
          cargar_pago: v.monto_ars === null && v.pago_por_vn === null ? { activo_id: v.activo_id, ticker: v.ticker } : null,
        })
      }
      const m = excedenteMes(base, mes, { pagador_declarado: pagadorDeclarado })
      for (const l of m.sin_cuadro) {
        sinCuadro ??= l
        filas.push({
          tipo: 'cuota',
          nombre: `Cuota de ${l.nombre}`,
          detalle: l.cargadas ? 'falta esta cuota en el cuadro de marcha · importá la planilla completa en Datos › Leasing' : 'falta el cuadro de marcha · importalo en Datos › Leasing',
          valor: parDe(doble(sinDato(motivoSinCuadro(l), [], { explicacion: 'La cuota entera del mes: lo que se debita.' }), 'ARS', tc, false)),
          chips: [],
          cargar_pago: null,
        })
      }
      calendario.push({ mes, nombre: nombreMes(mes), filas, neto: parDe(m.excedente) })
    }
  }

  // Real contra proyectado: desde el primer mes con algo declarado o cargado, hasta este mes.
  const cerrados: MesCerrado[] = []
  if (base) {
    const inicios = [
      ...base.recurrentes.map((r) => mesDe(r.vigente_desde)),
      ...base.flujos_reales.map((f) => mesDe(f.fecha)),
    ].filter((x) => x <= mesHoy)
    const desde = inicios.sort()[0]
    if (desde) {
      for (let k = indiceMes(desde, mesHoy); k >= 0; k--) {
        const mes = fechaMes(desde, k)
        const filas = desvioMes(base, mes, { pagador_declarado: pagadorDeclarado })
        cerrados.push({
          mes,
          nombre: nombreMes(mes),
          estado: mes === mesHoy ? 'en_curso' : 'cerrado',
          filas: filas.map((x) => ({ linea: x.linea, nombre: x.nombre, proyectado: parDe(x.proyectado), real: parDe(x.real), desvio: parDe(x.desvio) })),
        })
      }
    }
  }

  const recurrentes: FilaRecurrente[] = d.recurrentes
    .map((r) => ({
      id: r.id,
      sentido: r.sentido,
      concepto: r.concepto,
      moneda: r.moneda,
      monto: r.monto,
      desde: r.vigente_desde,
      hasta: r.vigente_hasta,
      frecuencia: r.frecuencia,
      primer_mes: r.primer_mes,
      pagador: r.pagador,
      naturaleza: r.naturaleza,
      valor: parDe(doble(calc(new Decimal(r.monto), `${r.concepto} = ${fmt(new Decimal(r.monto), r.moneda)}`, [], { etiquetas: ['declarado'] }), r.moneda, tc, r.sentido === 'ingreso')),
      vigente: r.vigente_desde <= hoy && (r.vigente_hasta === null || r.vigente_hasta >= hoy),
    }))
    .sort((a, b) => (a.sentido === b.sentido ? (a.desde < b.desde ? -1 : 1) : a.sentido === 'ingreso' ? -1 : 1))

  const escenarios: EscenarioVista[] = d.escenarios.map((e) => {
    const r = esquemaSupuestos.safeParse(e.supuestos)
    // Sus meses, contados desde la carga de hoy (un escenario de otro mes se corre).
    return { id: e.id, nombre: e.nombre, supuestos: r.success ? rebasar(r.data, base?.fecha ?? hoy) : null, archivado: e.archivado }
  })

  const nombreCuenta = new Map(h.cuentas.map((c) => [c.id, c.nombre]))
  const cargados: FilaCargada[] = d.flujos
    .filter((x) => !x.revertida)
    .sort((a, b) => (a.fecha === b.fecha ? b.id - a.id : a.fecha < b.fecha ? 1 : -1))
    .map((x) => {
      const signo = x.sentido === 'gasto' ? -1 : 1
      const montoD = new Decimal(x.monto).times(signo)
      const v = calc(montoD, `${x.sentido === 'ingreso' ? 'Ingreso' : 'Gasto'} ${x.concepto} del ${fechaCorta(x.fecha)} = ${fmt(montoD, x.moneda)}`, [], {
        explicacion: x.cripto_usado ? `Dólares vendidos a ${numero(x.cripto_usado, 2)}: recibiste ${fmt(new Decimal(x.pesos_recibidos ?? '0'), 'ARS')}.` : 'Lo que cargaste.',
      })
      let valor: Par
      if (x.pesos_recibidos && x.moneda === 'USD') {
        const pesos = new Decimal(x.pesos_recibidos).times(signo)
        valor = { usd: vista(v), ars: vista(calc(pesos, `pesos que recibiste = ${fmt(pesos, 'ARS')}`, [deCalc('Dólares', v, 'USD'), { nombre: 'Cripto usado', valor: x.cripto_usado, unidad: 'ratio' }], { explicacion: 'Los pesos que recibiste por esos dólares.' })) }
      } else valor = parDe(doble(v, x.moneda, tc, false))
      return {
        id: x.id,
        fecha: x.fecha,
        sentido: x.sentido,
        concepto: x.concepto,
        moneda: x.moneda,
        monto: x.monto,
        cuenta: x.cuenta_id === null ? null : (nombreCuenta.get(x.cuenta_id) ?? `cuenta ${x.cuenta_id}`),
        cuenta_id: x.cuenta_id,
        cripto: x.cripto_usado,
        pesos: x.pesos_recibidos,
        lote: x.lote,
        carga_id: x.carga_id,
        anulado: x.anulado,
        movimiento: x.cuenta_id === null ? null : x.sentido === 'ingreso' ? 'aporte' : 'retiro',
        valor,
        puede_deshacer: x.lote !== null,
        puede_anular: x.cuenta_id === null && !x.anulado,
      }
    })

  const sin_cronograma: BonoSinCronograma[] = (base?.partidas ?? [])
    .filter((p) => p.ley === 'sin_cronograma' && p.activo_id !== null)
    .map((p) => ({ activo_id: p.activo_id as number, ticker: p.ticker ?? p.nombre, nombre: p.nombre, fecha_vencimiento: p.fecha_vencimiento, vn: p.cantidad }))

  const faltan_datos: VistaFlujo['faltan_datos'] = []
  if (!base) faltan_datos.push({ texto: 'Todavía no hay cargas: la proyección arranca de tu última carga.', href: '/carga', etiqueta: 'Ir a Cargar' })
  else {
    if (!base.recurrentes.length) faltan_datos.push({ texto: 'Para tu excedente faltan tus ingresos (en dólares y en pesos) y tus gastos fijos.', href: '#ingresos-y-gastos', etiqueta: 'Cargar ingresos y gastos' })
    if (!base.cripto && base.recurrentes.some((r) => r.sentido === 'ingreso' && r.moneda === 'USD'))
      faltan_datos.push({ texto: 'Falta el dólar cripto: sin él, tu ingreso en dólares no se puede pasar a pesos. Cargalo en tu próxima carga.', href: '/carga', etiqueta: 'Ir a Cargar' })
    for (const b of sin_cronograma) faltan_datos.push({ texto: `Falta el pago al vencimiento por VN de ${b.ticker} (del aviso de licitación).`, href: `#pago-${b.ticker}`, etiqueta: `Cargar el pago de ${b.ticker}` })
    if (sinCuadro)
      faltan_datos.push({
        texto: sinCuadro.cargadas
          ? `Al cuadro de marcha de ${sinCuadro.nombre} le faltan cuotas (tiene ${sinCuadro.cargadas} de ${sinCuadro.totales}): la cuota de los meses que faltan queda sin dato, y con ella el excedente y la proyección.`
          : `Falta el cuadro de marcha de ${sinCuadro.nombre}: sin él, la cuota de cada mes queda sin dato, y con ella el excedente y la proyección.`,
        href: '/datos/leasing#cuadro-de-marcha',
        etiqueta: sinCuadro.cargadas ? 'Importar la planilla completa' : 'Importar el cuadro de marcha',
      })
  }

  return {
    hoy,
    fecha_datos: fechaDatos,
    demo,
    base,
    supuestos_iniciales: supuestosIniciales(base ?? { fecha: hoy, partidas: [] }),
    ccl: vista(cclCalc),
    cripto: vista(criptoCalc),
    mes_actual,
    calendario,
    cerrados,
    recurrentes,
    escenarios,
    recordados: d.recordados,
    cargados,
    sin_cronograma,
    faltan_datos,
    cuentas: h.cuentas.filter((c) => c.activa).map((c) => ({ id: c.id, nombre: c.nombre })),
    movimientos_datos: movimientosDeDatos(h, d, hoy),
    reintegro_declarado: reintegro,
    pagador_declarado: pagadorDeclarado,
  }
}

/** Aportes y retiros de Datos › Movimientos de los últimos 62 días (sin los que creó "Cargar ingreso"), para avisar una doble carga. */
export function movimientosDeDatos(h: Hechos, d: DatosFlujo, hoy: Fecha): MovimientoParaControl[] {
  const deFlujos = new Set(d.flujos.map((f) => f.carga_id))
  const out: MovimientoParaControl[] = []
  for (const m of h.movimientos) {
    if (m.tipo === 'transferencia' || deFlujos.has(m.carga_id) || diasEntre(m.fecha, hoy) > 62) continue
    const cuenta = m.tipo === 'aporte' ? m.cuenta_destino_id : m.cuenta_origen_id
    if (cuenta === null) continue
    const montos: MovimientoParaControl['montos'] = []
    if (m.moneda_destino && m.monto_destino) montos.push({ moneda: m.moneda_destino, monto: m.monto_destino.toFixed() })
    if (m.moneda_origen && m.monto_origen) montos.push({ moneda: m.moneda_origen, monto: m.monto_origen.toFixed() })
    out.push({ fecha: m.fecha, tipo: m.tipo, cuenta_id: cuenta, montos })
  }
  return out
}

/**
 * Para Hoy (integración, plan §10.5): el excedente del mes en curso (o null sin
 * carga) y lo que vence en los próximos `dias` días, para la tarjeta "Excedente
 * de octubre" y para Atención ("Vence S13N6 el vie 13/11 · $ 12,7 M").
 */
export function resumenParaHoy(v: VistaFlujo, dias = 10): { mes: string; excedente: Par; vencimientos: MesActual['vencimientos']; href: string } | null {
  if (!v.mes_actual) return null
  const vencimientos = v.mes_actual.vencimientos.filter((x) => {
    const d = diasEntre(v.hoy, x.fecha)
    return d >= 0 && d <= dias
  })
  // En minúscula: va en medio de la frase ("Excedente de octubre"); en Flujo abre la frase.
  return { mes: v.mes_actual.nombre.toLocaleLowerCase('es-AR'), excedente: v.mes_actual.excedente, vencimientos, href: '/flujo' }
}
