// Proyección determinística de un escenario (plan §6 D.2; D-144, D-146, D-155).
// Isomórfica: corre en el servidor y en el navegador sobre una base serializada.
//
// Meses: el 0 es el de la última carga (en curso: cuenta solo lo que pasa
// después de la carga); del 1 al horizonte, los que siguen. Lo recurrente se
// toma a fin de mes; las cuotas y los pagos de bonos, en su fecha.
//
//   CCL_m      = CCL_{m−1} × (1 + devaluación_m)                (desde el mes 1)
//   cripto_m   = CCL_m × (1 + brecha de hoy + puntos del escenario)
//   ingreso    = US$ declarado × (1 ± % del tramo) × cripto_m + $ declarado × (1 ± % del tramo) × (1 + ajuste)^k
//   gastos     = declarados del mes (por frecuencia) × Π (1 + gastos_k)   (o la inflación del escenario)
//   cuota      = Σ cuotas del mes que pagás vos (la cuota entera: lo que se debita)
//   excedente  = ingreso − gastos − cuota (+ reintegro del IVA, solo si lo declaraste o lo elegiste)
// Tu regla (D-155): el excedente × % invertido se reparte según el peso de cada
// partida en la última carga; un excedente negativo sale de la liquidez en
// pesos (y si no alcanza, el mes dice "no se cubre"); lo que vence se reinvierte
// igual, salvo otro destino. Lo que va a bonos y letras rinde la TEM de
// renovación; las letras que ya tenés van a vencimiento a su TEM implícita.
// Cada partida crece con el retorno de su clase en su moneda de riesgo, y el
// PnL del mes sale de d35() (variacion.ts), el mismo desglose que lo real.
//
// Rendimiento: lo que no depende del escenario se prepara una vez por base
// (WeakMap) y proyectar() no arma trazas: las da trazaMes() a pedido.

import { calc, deCalc, sinDato, unicas, vista, type Calc, type CalcVista, type Etiqueta, type Insumo } from '../calc'
import { CERO, Decimal, monto, numero, porcentaje } from '../dinero'
import { diasEntre, fechaCorta } from '../fechas'
import type { Fecha, Moneda } from '../tipos'
import { d35, type Doble, type Flujo } from '../variacion'
import { delMes, finDeMes } from './recurrentes'
import { efecto, faltantes, fechaMes, indiceMes, mesDe } from './supuestos'
import type {
  BaseProyeccion,
  CampoMes,
  ClaseProyeccion,
  CuotaBase,
  FlujoReal,
  MesProyectado,
  ParNum,
  PartidaBase,
  Proyeccion,
  Supuestos,
  TramoIngreso,
} from './tipos'

const UNO = new Decimal(1)
const CIEN = new Decimal(100)
const DOCE = new Decimal(12)
export const HORIZONTE_MAXIMO = 120

const D = (x: string | null | undefined): Decimal | null => (x === null || x === undefined ? null : new Decimal(x))
const txt = (x: Decimal | null): string | null => (x === null ? null : x.toFixed())
const par = (ars: Decimal | null, usd: Decimal | null): ParNum => ({ ars: txt(ars), usd: txt(usd) })
const sumar = (a: Decimal | null, b: Decimal | null): Decimal | null => (a === null || b === null ? null : a.plus(b))

// ───────────── Lo que no depende del escenario ─────────────

interface PartidaPrep {
  p: PartidaBase
  ley: NonNullable<PartidaBase['ley']>
  /** Valor de la carga en su moneda de riesgo. */
  v0: Decimal | null
  peso: Decimal | null
  /** Cronograma: valor a fin de cada mes (VP de lo que falta a su TEM) y pagos de cada mes. */
  camino?: (Decimal | null)[]
  pagos?: Decimal[]
  /** Pagos del mes 0 que caen después de la carga (los de antes ya están en tus saldos). */
  pagoPost0?: Decimal
  /** Propia (dual…): mes en que vence, si cae en el horizonte. */
  mesVence?: number | null
}

interface CuotaPrep {
  c: CuotaBase
  total: Decimal
  iva: Decimal
  amort: Decimal | null
  /** ¿Cae después de la carga? (solo importa en el mes 0). */
  post: boolean
}

interface RealMes {
  /** Ingresos mensuales reales, por moneda de origen: los dólares (vendidos: los pesos recibidos; sin vender: dólares) y los pesos. */
  usdPesos: Decimal
  usdSinVender: Decimal
  arsIng: Decimal
  usdPesosPost: Decimal
  usdSinVenderPost: Decimal
  arsIngPost: Decimal
  hayIngUsd: boolean
  hayIngArs: boolean
  gasArs: Decimal
  gasUsd: Decimal
  gasPostArs: Decimal
  gasPostUsd: Decimal
  extraArs: Decimal
  extraUsd: Decimal
  extraPostArs: Decimal
  extraPostUsd: Decimal
  hayGas: boolean
  flujos: FlujoReal[]
}

interface Prep {
  base: BaseProyeccion
  mes0: Fecha
  ccl0: Decimal | null
  cripto0: Decimal | null
  brecha0: Decimal | null
  partidas: PartidaPrep[]
  /** Peso de cada partida en la regla (fracción, sobre lo que tiene valor positivo); null = sin dato. */
  pesos: Map<string, Decimal> | null
  motivoPesos: string | null
  financiero0: { ars: Decimal | null; usd: Decimal | null; motivo: string | null }
  meses: Fecha[]
  ingUsd: Decimal[]
  ingArs: Decimal[]
  gasArs: Decimal[]
  gasUsd: Decimal[]
  cuotas: CuotaPrep[][]
  reales: RealMes[]
  temHoy: Decimal | null
  casa: { v0: Decimal | null; moneda: Moneda; nombres: string[] } | null
  camioneta: { v0: Decimal | null; moneda: Moneda; nombres: string[]; pasivo_id: number | null } | null
  deuda0: { ars: Decimal | null; etiquetas: Etiqueta[]; pasivo_id: number | null; motivo: string | null }
}

const cache = new WeakMap<BaseProyeccion, Prep>()

function preparar(base: BaseProyeccion): Prep {
  const hit = cache.get(base)
  if (hit) return hit
  const mes0 = mesDe(base.fecha)
  const ccl0 = D(base.ccl)
  const cripto0 = D(base.cripto)
  const brecha0 = ccl0 && cripto0 ? cripto0.div(ccl0).minus(UNO) : null
  const meses = Array.from({ length: HORIZONTE_MAXIMO + 1 }, (_, m) => fechaMes(mes0, m))

  // Partidas
  const partidas: PartidaPrep[] = base.partidas.map((p) => {
    const ley = p.ley ?? 'clase'
    const v0 = D(p.moneda_riesgo === 'USD' ? p.valor.usd : p.valor.ars)
    const pp: PartidaPrep = { p, ley, v0, peso: D(p.peso) }
    if (ley === 'cronograma') {
      const tem = D(p.tem ?? null)
      const pagos = base.vencimientos.filter((x) => (x.clave ? x.clave === p.clave : x.activo_id === p.activo_id) && x.fecha > base.fecha)
      pp.pagos = meses.map(() => CERO)
      pp.pagoPost0 = CERO
      for (const x of pagos) {
        const k = indiceMes(mes0, x.fecha)
        const mx = D(x.monto_ars)
        if (k >= 0 && k <= HORIZONTE_MAXIMO && mx) pp.pagos[k] = pp.pagos[k].plus(mx)
        if (k === 0 && mx) pp.pagoPost0 = pp.pagoPost0.plus(mx)
      }
      pp.camino = meses.map((m) => {
        if (tem === null || pagos.some((x) => x.monto_ars === null)) return null
        const fin = finDeMes(m)
        let v = CERO
        for (const x of pagos) {
          if (x.fecha <= fin) continue
          v = v.plus(new Decimal(x.monto_ars as string).div(UNO.plus(tem).pow(new Decimal(diasEntre(fin, x.fecha)).div(30))))
        }
        return v
      })
    }
    if (ley === 'propia') {
      const k = p.fecha_vencimiento ? indiceMes(mes0, p.fecha_vencimiento) : null
      pp.mesVence = k !== null && k >= 0 && k <= HORIZONTE_MAXIMO ? k : null
    }
    return pp
  })

  // Pesos de la regla: sobre lo que tiene valor positivo (un saldo negativo no recibe plata).
  let pesos: Map<string, Decimal> | null = new Map()
  let motivoPesos: string | null = null
  const conValor = partidas.filter((x) => x.p.valor.ars !== null)
  const sinValor = partidas.filter((x) => x.p.valor.ars === null)
  if (sinValor.length) {
    pesos = null
    motivoPesos = `Falta el valor de ${sinValor[0].p.nombre} en tu última carga: sin él no se sabe el peso de cada partida.`
  } else {
    const positivos = conValor.filter((x) => new Decimal(x.p.valor.ars as string).gt(0))
    const total = positivos.reduce((a, x) => a.plus(x.p.valor.ars as string), CERO)
    if (total.gt(0)) for (const x of positivos) pesos.set(x.p.clave, new Decimal(x.p.valor.ars as string).div(total))
    else {
      pesos = null
      motivoPesos = 'Tu última carga no tiene partidas con valor positivo.'
    }
  }

  // Financiero de la carga
  let f0a: Decimal | null = CERO
  let f0u: Decimal | null = CERO
  let motivoF0: string | null = null
  for (const x of partidas) {
    const a = D(x.p.valor.ars)
    const u = D(x.p.valor.usd)
    if (a === null || u === null) {
      f0a = null
      f0u = null
      motivoF0 ??= `Falta el valor de ${x.p.nombre}.`
      continue
    }
    if (f0a !== null) f0a = f0a.plus(a)
    if (f0u !== null) f0u = f0u.plus(u)
  }

  // Recurrentes por mes (vigentes a fin de mes)
  const sumaR = (mes: Fecha, sentido: 'ingreso' | 'gasto', moneda: Moneda) =>
    delMes(base.recurrentes, mes, sentido, moneda).reduce((a, r) => a.plus(r.monto), CERO)
  const ingUsd = meses.map((m) => sumaR(m, 'ingreso', 'USD'))
  const ingArs = meses.map((m) => sumaR(m, 'ingreso', 'ARS'))
  const gasArs = meses.map((m) =>
    delMes(base.recurrentes, m, 'gasto', 'ARS')
      .filter((r) => r.pagador !== 'empresa')
      .reduce((a, r) => a.plus(r.monto), CERO),
  )
  const gasUsd = meses.map((m) =>
    delMes(base.recurrentes, m, 'gasto', 'USD')
      .filter((r) => r.pagador !== 'empresa')
      .reduce((a, r) => a.plus(r.monto), CERO),
  )

  // Cuotas por mes
  const cuotas: CuotaPrep[][] = meses.map(() => [])
  for (const c of base.cuotas) {
    const k = indiceMes(mes0, c.fecha_vencimiento)
    if (k < 0 || k > HORIZONTE_MAXIMO) continue
    cuotas[k].push({ c, total: new Decimal(c.total), iva: new Decimal(c.iva_y_percepcion), amort: D(c.amortizacion), post: c.fecha_vencimiento > base.fecha })
  }

  // Flujos reales por mes (las cargas revertidas y lo anulado ya no llegan)
  const reales: RealMes[] = meses.map(() => ({
    usdPesos: CERO,
    usdSinVender: CERO,
    arsIng: CERO,
    usdPesosPost: CERO,
    usdSinVenderPost: CERO,
    arsIngPost: CERO,
    hayIngUsd: false,
    hayIngArs: false,
    gasArs: CERO,
    gasUsd: CERO,
    gasPostArs: CERO,
    gasPostUsd: CERO,
    extraArs: CERO,
    extraUsd: CERO,
    extraPostArs: CERO,
    extraPostUsd: CERO,
    hayGas: false,
    flujos: [],
  }))
  for (const f of base.flujos_reales) {
    if (f.anulado) continue
    const k = indiceMes(mes0, f.fecha)
    if (k < 0 || k > HORIZONTE_MAXIMO) continue
    const r = reales[k]
    r.flujos.push(f)
    const post = f.fecha > base.fecha
    // Un ingreso en dólares vendido al cripto ya son pesos (los recibidos); sin vender, siguen siendo dólares.
    const ars = f.pesos_recibidos ? new Decimal(f.pesos_recibidos) : f.moneda === 'ARS' ? new Decimal(f.monto) : CERO
    const usd = f.pesos_recibidos ? CERO : f.moneda === 'USD' ? new Decimal(f.monto) : CERO
    const signo = f.sentido === 'ingreso' ? UNO : UNO.negated()
    if (f.concepto === 'extraordinario') {
      r.extraArs = r.extraArs.plus(ars.times(signo))
      r.extraUsd = r.extraUsd.plus(usd.times(signo))
      if (post) {
        r.extraPostArs = r.extraPostArs.plus(ars.times(signo))
        r.extraPostUsd = r.extraPostUsd.plus(usd.times(signo))
      }
    } else if (f.sentido === 'ingreso') {
      // Lo cargado reemplaza a lo declarado de su moneda: el ingreso en dólares y el fijo en pesos, cada uno.
      if (f.moneda === 'USD') {
        r.hayIngUsd = true
        r.usdPesos = r.usdPesos.plus(ars)
        r.usdSinVender = r.usdSinVender.plus(usd)
        if (post) {
          r.usdPesosPost = r.usdPesosPost.plus(ars)
          r.usdSinVenderPost = r.usdSinVenderPost.plus(usd)
        }
      } else {
        r.hayIngArs = true
        r.arsIng = r.arsIng.plus(ars)
        if (post) r.arsIngPost = r.arsIngPost.plus(ars)
      }
    } else {
      r.hayGas = true
      r.gasArs = r.gasArs.plus(ars)
      r.gasUsd = r.gasUsd.plus(usd)
      if (post) {
        r.gasPostArs = r.gasPostArs.plus(ars)
        r.gasPostUsd = r.gasPostUsd.plus(usd)
      }
    }
  }

  // TEM de hoy de tus letras (promedio ponderado por valor): la Igual de la TEM de renovación.
  let temHoy: Decimal | null = null
  {
    const cs = partidas.filter((x) => x.ley === 'cronograma' && x.p.tem != null && x.v0 !== null && x.v0.gt(0))
    const tot = cs.reduce((a, x) => a.plus(x.v0 as Decimal), CERO)
    if (tot.gt(0)) temHoy = cs.reduce((a, x) => a.plus(new Decimal(x.p.tem as string).times(x.v0 as Decimal)), CERO).div(tot)
  }

  // Bienes
  const libres = base.bienes.filter((b) => b.pasivo_id === null)
  const fin = base.bienes.filter((b) => b.pasivo_id !== null)
  const sumaBien = (bs: typeof libres, moneda: Moneda) => {
    if (bs.some((b) => b.moneda !== moneda)) return null
    if (bs.some((b) => b.valor === null)) return null
    return bs.reduce((a, b) => a.plus(b.valor as string), CERO)
  }
  const monedaDe = (bs: typeof libres): Moneda => bs[0]?.moneda ?? 'USD'
  const casa = libres.length ? { v0: sumaBien(libres, monedaDe(libres)), moneda: monedaDe(libres), nombres: libres.map((b) => b.nombre) } : null
  const camioneta = fin.length
    ? { v0: sumaBien(fin, monedaDe(fin)), moneda: monedaDe(fin), nombres: fin.map((b) => b.nombre), pasivo_id: fin[0].pasivo_id }
    : null

  // Deuda del leasing en la carga, con su origen
  const pid = camioneta?.pasivo_id ?? base.deudas[0]?.pasivo_id ?? null
  const dd = base.deudas.find((x) => x.pasivo_id === pid) ?? null
  const deuda0 = {
    ars: D(dd?.ars ?? null),
    etiquetas: (dd && (dd.origen === 'estimada' || dd.origen === 'segun_cuadro') ? ['estimado'] : []) as Etiqueta[],
    pasivo_id: pid,
    motivo: dd?.ars ? null : 'Falta la deuda del leasing a la fecha de la carga (el valor de cancelación o el estimado).',
  }

  const prep: Prep = {
    base,
    mes0,
    ccl0,
    cripto0,
    brecha0,
    partidas,
    pesos,
    motivoPesos,
    financiero0: { ars: f0a, usd: f0u, motivo: motivoF0 },
    meses,
    ingUsd,
    ingArs,
    gasArs,
    gasUsd,
    cuotas,
    reales,
    temHoy,
    casa,
    camioneta,
    deuda0,
  }
  cache.set(base, prep)
  return prep
}

// ───────────── El escenario, mes a mes ─────────────

/** Factor mensual de una tasa anual en %: (1 + r/100)^(1/12). */
function mensualDeAnual(pct: Decimal): Decimal {
  return UNO.plus(pct.div(CIEN)).pow(UNO.div(DOCE))
}

/** El tramo que rige en el mes m (de los que tienen hasta_mes). */
function tramoHasta<T extends { hasta_mes: number | null }>(ts: readonly T[], m: number): T {
  for (const t of ts) if (t.hasta_mes === null || m <= t.hasta_mes) return t
  return ts[ts.length - 1]
}

/** El tramo del ingreso que rige en el mes m ("desde el mes N"). */
function tramoDesde(ts: readonly TramoIngreso[], m: number): TramoIngreso {
  // El primer tramo rige desde ahora (también el mes 0); otro, desde su mes: uno "desde el mes 1"
  // empieza el mes que viene, no en el de la carga (el cambio de feb-2027 no se adelanta a enero).
  let r = ts[0]
  for (const t of ts) if (t.desde_mes <= m && t.desde_mes >= r.desde_mes) r = t
  return r
}

type Destino = string // clave de partida, 'renovacion' o 'nuevo:<clase>'

interface Bucket {
  clave: Destino
  nombre: string
  riesgo: Moneda
  /** Factor mensual en su moneda de riesgo (null = falta el supuesto). */
  factor: Decimal | null
}

/** Lo que se guarda de un mes para la traza (solo cuando se pide). */
interface Detalle {
  m: number
  ccl: Decimal
  cclPrev: Decimal
  cripto: Decimal | null
  dev: Decimal
  ingUsdDecl: Decimal
  ingArsDecl: Decimal
  fUsd: Decimal
  fArs: Decimal
  ingUsd: Decimal
  ingArsPesos: Decimal
  ingresoArs: Decimal
  realIng: boolean
  gasDeclArs: Decimal
  gasDeclUsd: Decimal
  fGas: Decimal
  gastosArs: Decimal
  realGas: boolean
  cuotas: { c: CuotaBase; quien: 'titular' | 'empresa' }[]
  cuotaArs: Decimal
  reintegroArs: Decimal
  vencArs: Decimal | null
  /** Qué vence en el mes, partida por partida (la traza lo muestra). */
  vencPartes: { nombre: string; ars: Decimal | null; como: string }[]
  excArs: Decimal
  postArs: Decimal | null
  pct: Decimal
  invertidoArs: Decimal
  retiroArs: Decimal
  valores: { nombre: string; riesgo: Moneda; antes: Decimal | null; despues: Decimal | null; aporte: Decimal }[]
  liquidezArs: Decimal | null
  deudaArs: Decimal | null
  amortSum: Decimal | null
  bienesLibresArs: Decimal | null
  bienesFinArs: Decimal | null
  aportadoArs: Decimal | null
  aportadoUsd: Decimal | null
  pnl: { activo: Doble; tc: Doble } | null
  etiquetas: Etiqueta[]
}

interface Corrida {
  proyeccion: Proyeccion
  detalle: Detalle | null
}

function correr(base: BaseProyeccion, s: Supuestos, mesDetalle: number | null): Corrida {
  const { bloquean, parciales } = faltantes(base, s)
  if (bloquean.length || s.horizonte_meses === null) {
    return { proyeccion: { estado: 'faltan', faltan: bloquean, faltan_parciales: parciales, meses: [], cobertura: null, debajo: null }, detalle: null }
  }
  const P = preparar(base)
  const H = Math.min(s.horizonte_meses, HORIZONTE_MAXIMO)
  const ccl0 = P.ccl0
  if (ccl0 === null) {
    return {
      proyeccion: {
        estado: 'faltan',
        faltan: [{ variable: 'ccl', texto: 'Falta el CCL de tu última carga: sin él no se puede proyectar en las dos monedas' }],
        faltan_parciales: parciales,
        meses: [],
      },
      detalle: null,
    }
  }

  // Factores mensuales de las clases
  const ef = (v: Supuestos['casa']) => efecto(v)
  const fCedear = ef(s.retorno.cedear) !== null ? mensualDeAnual(ef(s.retorno.cedear) as Decimal) : null
  const fAccion = ef(s.retorno.accion_local) !== null ? mensualDeAnual(ef(s.retorno.accion_local) as Decimal) : null
  const fLiq = ef(s.retorno.liquidez_pesos) !== null ? mensualDeAnual(ef(s.retorno.liquidez_pesos) as Decimal) : null
  const temRen =
    P.temHoy !== null && efecto(s.tem_renovacion) !== null ? P.temHoy.plus((efecto(s.tem_renovacion) as Decimal).div(CIEN)) : null
  const fRen = temRen !== null ? UNO.plus(temRen).pow(new Decimal(365).div(12).div(30)) : null
  const fCasa = ef(s.casa) !== null ? mensualDeAnual(ef(s.casa) as Decimal) : null
  const fCamioneta = ef(s.camioneta) !== null ? mensualDeAnual(ef(s.camioneta) as Decimal) : null

  const factorClase = (clase: ClaseProyeccion, riesgo: Moneda): Decimal | null => {
    if (clase === 'cedear') return fCedear
    if (clase === 'accion_local') return fAccion
    if (clase === 'fci' || (clase === 'liquidez' && riesgo === 'ARS')) return fLiq
    if (clase === 'liquidez') return UNO // dólares en efectivo: quietos en dólares
    return fRen
  }

  // Buckets: cada partida que crece por su clase o por su variable, más la renovación.
  const buckets = new Map<Destino, Bucket>()
  const valor = new Map<Destino, Decimal | null>()
  const destinoDe = (pp: PartidaPrep): Destino => (pp.ley === 'clase' ? pp.p.clave : 'renovacion')
  for (const pp of P.partidas) {
    if (pp.ley === 'clase' || pp.ley === 'propia') {
      const f = pp.ley === 'propia' ? (efecto(s.dual[pp.p.ticker ?? ''] ?? { dir: null, valor: null }) ?? null) : null
      buckets.set(pp.p.clave, {
        clave: pp.p.clave,
        nombre: pp.p.nombre,
        riesgo: pp.p.moneda_riesgo,
        factor: pp.ley === 'propia' ? (f === null ? null : mensualDeAnual(f)) : factorClase(pp.p.clase, pp.p.moneda_riesgo),
      })
      valor.set(pp.p.clave, pp.v0)
    }
  }
  buckets.set('renovacion', { clave: 'renovacion', nombre: 'Reinvertido en letras (TEM de renovación)', riesgo: 'ARS', factor: fRen })
  valor.set('renovacion', CERO)
  const liqArs = P.partidas.find((x) => x.p.clase === 'liquidez' && x.p.moneda_riesgo === 'ARS')?.p.clave ?? 'liq:ARS'
  if (!buckets.has(liqArs)) {
    buckets.set(liqArs, { clave: liqArs, nombre: 'Liquidez en pesos', riesgo: 'ARS', factor: fLiq ?? UNO })
    valor.set(liqArs, CERO)
  }

  /** Reparto de un monto en pesos según una regla: devuelve destino → pesos. */
  const reparto = (regla: 'politica' | ClaseProyeccion): Map<Destino, Decimal> | null => {
    const r = new Map<Destino, Decimal>()
    const usarClase = (clase: ClaseProyeccion) => {
      if (clase === 'bono' || clase === 'lecap') return r.set('renovacion', UNO)
      const de = P.partidas.filter((x) => x.p.clase === clase && x.ley === 'clase' && (P.pesos?.get(x.p.clave) ?? CERO).gt(0))
      const tot = de.reduce((a, x) => a.plus(P.pesos?.get(x.p.clave) ?? CERO), CERO)
      if (tot.gt(0)) for (const x of de) r.set(x.p.clave, (P.pesos?.get(x.p.clave) as Decimal).div(tot))
      else {
        const k = `nuevo:${clase}`
        if (!buckets.has(k)) {
          const riesgo: Moneda = clase === 'cedear' ? 'USD' : 'ARS'
          buckets.set(k, { clave: k, nombre: `Nuevo en ${clase}`, riesgo, factor: factorClase(clase, riesgo) })
          valor.set(k, CERO)
        }
        r.set(k, UNO)
      }
      return r
    }
    if (regla !== 'politica') return usarClase(regla)
    if (s.politica.regla === 'por_clase' && s.politica.clase) return usarClase(s.politica.clase)
    if (P.pesos === null) return null
    const incluye = s.politica.incluye_liquidez !== false
    const ps = P.partidas.filter((x) => (P.pesos as Map<string, Decimal>).has(x.p.clave) && (incluye || x.p.clase !== 'liquidez'))
    const tot = ps.reduce((a, x) => a.plus(P.pesos?.get(x.p.clave) ?? CERO), CERO)
    if (!tot.gt(0)) return null
    for (const x of ps) {
      const d = destinoDe(x)
      r.set(d, (r.get(d) ?? CERO).plus((P.pesos?.get(x.p.clave) as Decimal).div(tot)))
    }
    return r
  }
  const repPolitica = reparto('politica')
  const repVenc = s.destino_vencimientos && s.destino_vencimientos !== 'regla' ? reparto(s.destino_vencimientos) : repPolitica

  const pct = new Decimal(s.politica.pct).div(CIEN)
  const reintegra = base.pasivos?.find((x) => x.id === P.deuda0.pasivo_id)?.reintegra_iva ?? s.reintegro_iva ?? false

  const meses: MesProyectado[] = []
  let detalle: Detalle | null = null
  let ccl = ccl0
  let fGas = UNO
  let casaV = P.casa?.v0 ?? null
  let camV = P.camioneta?.v0 ?? null
  let deuda = P.deuda0.ars
  let motivoDeuda = P.deuda0.motivo
  let aportadoArs = P.financiero0.ars
  let aportadoUsd = P.financiero0.usd
  let cronoPrev = new Map<string, Decimal | null>(P.partidas.filter((x) => x.ley === 'cronograma').map((x) => [x.p.clave, x.v0]))
  const sinCrono = P.partidas.filter((x) => x.ley === 'sin_cronograma')
  const motivoSinCrono = sinCrono.length
    ? `Falta el pago al vencimiento de ${sinCrono.map((x) => x.p.ticker ?? x.p.nombre).join(' y ')}: cargalo para proyectar su valor.`
    : null
  const resultadosUsd: (Decimal | null)[] = []
  let cobertura: Proyeccion['cobertura'] = null
  /** Alguna cuota que pagás vos dentro del horizonte (si no, no hay nada que cubrir). */
  let huboCuota = false

  for (let m = 0; m <= H; m++) {
    const cclPrev = ccl
    let dev = CERO
    if (m >= 1) {
      dev = efecto(tramoHasta(s.devaluacion, m)) as Decimal
      ccl = ccl.times(UNO.plus(dev.div(CIEN)))
    }
    const brecha = P.brecha0 !== null ? P.brecha0.plus((efecto(s.brecha_cripto) ?? CERO).div(CIEN)) : null
    const cripto = m === 0 && P.cripto0 ? P.cripto0 : brecha !== null ? ccl.times(UNO.plus(brecha)) : null

    // Ingresos
    const tu = tramoDesde(s.ingreso_usd, m)
    const ta = tramoDesde(s.ingreso_pesos, m)
    const fUsd = UNO.plus((efecto(tu) ?? CERO).div(CIEN))
    let fArs = UNO.plus((efecto(ta) ?? CERO).div(CIEN))
    if (ta.ajuste_mensual) fArs = fArs.times(UNO.plus(new Decimal(ta.ajuste_mensual).div(CIEN)).pow(Math.max(0, m - ta.desde_mes + 1)))
    const real = P.reales[m]
    const ingUsdDecl = P.ingUsd[m]
    const ingArsDecl = P.ingArs[m]
    const ingUsdProy = ingUsdDecl.times(fUsd)
    const ingArsProy = ingArsDecl.times(fArs)
    if (!real.hayIngUsd && ingUsdProy.gt(0) && cripto === null) {
      // No puede pasar: faltantes() lo frena. Por las dudas, sin inventar.
      throw new Error('Falta el cripto para pasar el ingreso en dólares a pesos.')
    }
    // Si cargaste el ingreso del mes, manda lo real (por moneda); si no, lo proyectado.
    const realIng = real.hayIngUsd || real.hayIngArs
    const ingDeUsd = real.hayIngUsd ? real.usdPesos.plus(real.usdSinVender.times(ccl)) : ingUsdProy.times(cripto ?? CERO)
    const ingDeArs = real.hayIngArs ? real.arsIng : ingArsProy
    const ingUsd = real.hayIngUsd ? real.usdSinVender : ingUsdProy
    const ingPesos = ingDeArs
    const ingresoArs = ingDeUsd.plus(ingDeArs)

    // Gastos
    if (m >= 1) {
      const g = s.gastos.atado_inflacion ? efecto(tramoHasta(s.inflacion, m)) : efecto(s.gastos)
      fGas = fGas.times(UNO.plus((g ?? CERO).div(CIEN)))
    }
    const realGas = real.hayGas
    const gastosArs = realGas ? real.gasArs.plus(real.gasUsd.times(ccl)) : P.gasArs[m].times(fGas).plus(P.gasUsd[m].times(fGas).times(ccl))

    // Cuota del leasing: la entera, si la pagás vos.
    const quienPaga = (c: CuotaBase): 'titular' | 'empresa' => {
      if (c.pagador) return c.pagador
      const pc = s.pagador_cuota
      if (!pc) return 'titular'
      if (pc.desde_mes !== null && m < pc.desde_mes) return pc.quien === 'titular' ? 'empresa' : 'titular'
      return pc.quien
    }
    let cuotaArs = CERO
    let cuotaPost = CERO
    let cuotaGasto: Decimal | null = CERO
    let reintegroArs = CERO
    let reintegroPost = CERO
    let amortMes: Decimal | null = CERO
    const etiq: Etiqueta[] = m === 0 ? [] : ['proyectado', 'supuesto']
    if (m === 0) etiq.push('proyectado')
    const cuotasDet: Detalle['cuotas'] = []
    for (const cp of P.cuotas[m]) {
      const quien = quienPaga(cp.c)
      cuotasDet.push({ c: cp.c, quien })
      if (cp.post || m > 0) amortMes = cp.amort === null || amortMes === null ? null : amortMes.plus(cp.amort)
      if (quien !== 'titular') continue
      cuotaArs = cuotaArs.plus(cp.total)
      if (cp.post) cuotaPost = cuotaPost.plus(cp.total)
      cuotaGasto = cp.amort === null || cuotaGasto === null ? null : cuotaGasto.plus(cp.total.minus(cp.amort))
      if (reintegra) {
        reintegroArs = reintegroArs.plus(cp.iva)
        if (cp.post) reintegroPost = reintegroPost.plus(cp.iva)
      }
      etiq.push(...cp.c.etiquetas)
    }

    // Vencimientos: pagos de tus bonos y letras, y lo propio (dual) que vence.
    let vencArs: Decimal | null = CERO
    let vencPost: Decimal | null = CERO
    const salidas: { de: Destino | null; ars: Decimal; riesgo: Moneda }[] = []
    const vencPartes: Detalle['vencPartes'] = []
    const nombreP = (pp: (typeof P.partidas)[number]) => pp.p.ticker ?? pp.p.nombre
    for (const pp of P.partidas) {
      if (pp.ley === 'cronograma' && pp.pagos) {
        const x = pp.pagos[m]
        const xp = m === 0 ? (pp.pagoPost0 ?? CERO) : x
        vencArs = vencArs === null ? null : vencArs.plus(x)
        vencPost = vencPost === null ? null : vencPost.plus(xp)
        if (xp.gt(0)) salidas.push({ de: null, ars: xp, riesgo: 'ARS' })
        if (mesDetalle === m && x.gt(0)) vencPartes.push({ nombre: nombreP(pp), ars: x, como: 'pago por VN × tus VN (cronograma cargado)' })
      } else if (pp.ley === 'sin_cronograma' && pp.p.fecha_vencimiento && indiceMes(P.mes0, pp.p.fecha_vencimiento) === m) {
        vencArs = null
        vencPost = null
        if (mesDetalle === m) vencPartes.push({ nombre: nombreP(pp), ars: null, como: 'falta el pago al vencimiento por VN' })
      }
    }

    // Crecimiento del mes (desde el mes 1) y lo propio que vence.
    const antes = new Map<Destino, Decimal | null>(valor)
    if (m >= 1) {
      for (const [k, b] of buckets) {
        const v = valor.get(k) ?? null
        // Una partida en cero no necesita su supuesto (la renovación sin letras, por ejemplo).
        valor.set(k, v === null ? null : v.isZero() ? v : b.factor === null ? null : v.times(b.factor))
      }
    }
    for (const pp of P.partidas) {
      if (pp.ley === 'propia' && pp.mesVence === m) {
        const v = valor.get(pp.p.clave) ?? null
        const ars = v === null ? null : pp.p.moneda_riesgo === 'USD' ? v.times(ccl) : v
        vencArs = vencArs === null || ars === null ? null : vencArs.plus(ars)
        vencPost = vencPost === null || ars === null ? null : vencPost.plus(ars)
        if (ars !== null && ars.gt(0)) salidas.push({ de: pp.p.clave, ars, riesgo: pp.p.moneda_riesgo })
        if (mesDetalle === m) vencPartes.push({ nombre: nombreP(pp), ars, como: 'lo que vale al vencer, con su supuesto del escenario' })
        valor.set(pp.p.clave, ars === null ? null : CERO)
      }
    }

    // Excedente del mes (todo el mes) y la parte que pasa después de la carga.
    const excArs = ingresoArs.minus(gastosArs).minus(cuotaArs).plus(reintegroArs)
    let postArs: Decimal | null
    if (m === 0) {
      const ingPost = (real.hayIngUsd ? real.usdPesosPost.plus(real.usdSinVenderPost.times(ccl)) : ingDeUsd).plus(real.hayIngArs ? real.arsIngPost : ingDeArs)
      const gasPost = realGas ? real.gasPostArs.plus(real.gasPostUsd.times(ccl)) : gastosArs
      postArs = ingPost.minus(gasPost).minus(cuotaPost).plus(reintegroPost).plus(real.extraPostArs).plus(real.extraPostUsd.times(ccl))
    } else {
      postArs = excArs.plus(real.extraArs).plus(real.extraUsd.times(ccl))
    }
    const invertidoArs = postArs.gt(0) ? postArs.times(pct) : CERO
    const retiroArs = postArs.lt(0) ? postArs : CERO

    // Flujos del mes por agregado de moneda de riesgo (para d35) y aportes.
    const flujosAgg: Record<Moneda, Flujo[]> = { ARS: [], USD: [] }
    const flujo = (riesgo: Moneda, ars: Decimal, externo: boolean) =>
      flujosAgg[riesgo].push({ fecha: P.meses[m], descripcion: '', ars, usd: ars.div(ccl), ccl, inferido: false, carga_id: 0, externo })
    const aportes = new Map<Destino, Decimal>()
    const aportar = (d: Destino, ars: Decimal) => aportes.set(d, (aportes.get(d) ?? CERO).plus(ars))
    let repartible = true
    const repartir = (rep: Map<Destino, Decimal> | null, ars: Decimal, externo: boolean) => {
      if (ars.isZero()) return
      if (rep === null) {
        repartible = false
        return
      }
      for (const [d, w] of rep) {
        const x = ars.times(w)
        aportar(d, x)
        const b = buckets.get(d) as Bucket
        flujo(b.riesgo, x, externo)
      }
    }
    repartir(repPolitica, invertidoArs, true)
    if (retiroArs.lt(0)) {
      aportar(liqArs, retiroArs)
      flujo('ARS', retiroArs, true)
    }
    for (const sx of salidas) {
      flujo(sx.riesgo, sx.ars.negated(), false)
      repartir(repVenc, sx.ars, false)
    }
    for (const [d, ars] of aportes) {
      const b = buckets.get(d) as Bucket
      const v = valor.get(d) ?? null
      valor.set(d, v === null ? null : v.plus(b.riesgo === 'USD' ? ars.div(ccl) : ars))
    }

    // Valores a fin de mes
    let finArs: Decimal | null = CERO
    let finUsd: Decimal | null = CERO
    let motivoFin: string | null = motivoSinCrono
    if (sinCrono.length) {
      finArs = null
      finUsd = null
    }
    if (!repartible) {
      finArs = null
      finUsd = null
      motivoFin ??= P.motivoPesos
    }
    const agg: Record<Moneda, { v0: Doble; v1: Doble } | null> = {
      ARS: { v0: { ars: CERO, usd: CERO }, v1: { ars: CERO, usd: CERO } },
      USD: { v0: { ars: CERO, usd: CERO }, v1: { ars: CERO, usd: CERO } },
    }
    const sumarAgg = (riesgo: Moneda, v0: Decimal | null, v1: Decimal | null) => {
      const a = agg[riesgo]
      if (a === null) return
      if (v0 === null || v1 === null) {
        agg[riesgo] = null
        return
      }
      const v0d: Doble = riesgo === 'USD' ? { ars: v0.times(cclPrev), usd: v0 } : { ars: v0, usd: v0.div(cclPrev) }
      const v1d: Doble = riesgo === 'USD' ? { ars: v1.times(ccl), usd: v1 } : { ars: v1, usd: v1.div(ccl) }
      a.v0 = { ars: a.v0.ars.plus(v0d.ars), usd: a.v0.usd.plus(v0d.usd) }
      a.v1 = { ars: a.v1.ars.plus(v1d.ars), usd: a.v1.usd.plus(v1d.usd) }
    }
    const valoresDet: Detalle['valores'] = []
    for (const [k, b] of buckets) {
      const v = valor.get(k) ?? null
      const v0 = antes.get(k) ?? null
      sumarAgg(b.riesgo, v0, v)
      if (mesDetalle === m) valoresDet.push({ nombre: b.nombre, riesgo: b.riesgo, antes: v0, despues: v, aporte: aportes.get(k) ?? CERO })
      if (v === null) {
        finArs = null
        finUsd = null
        motivoFin ??= b.factor === null ? `Falta el supuesto de ${b.nombre}.` : `Falta el valor de ${b.nombre}.`
        continue
      }
      if (finArs !== null && finUsd !== null) {
        finArs = finArs.plus(b.riesgo === 'USD' ? v.times(ccl) : v)
        finUsd = finUsd.plus(b.riesgo === 'USD' ? v : v.div(ccl))
      }
    }
    for (const pp of P.partidas.filter((x) => x.ley === 'cronograma')) {
      const v = pp.camino?.[m] ?? null
      const v0 = cronoPrev.get(pp.p.clave) ?? null
      sumarAgg('ARS', v0, v)
      if (mesDetalle === m) valoresDet.push({ nombre: pp.p.nombre, riesgo: 'ARS', antes: v0, despues: v, aporte: CERO })
      cronoPrev.set(pp.p.clave, v)
      if (v === null) {
        finArs = null
        finUsd = null
        motivoFin ??= `Falta el pago al vencimiento de ${pp.p.ticker ?? pp.p.nombre}.`
        continue
      }
      if (finArs !== null && finUsd !== null) {
        finArs = finArs.plus(v)
        finUsd = finUsd.plus(v.div(ccl))
      }
    }
    if (sinCrono.length) {
      for (const pp of sinCrono) {
        agg.ARS = null
        if (mesDetalle === m) valoresDet.push({ nombre: pp.p.nombre, riesgo: 'ARS', antes: null, despues: null, aporte: CERO })
      }
    }

    // PnL del mes con d35 (el mismo desglose que lo real).
    const invUsd = invertidoArs.div(ccl)
    const retUsd = retiroArs.div(ccl)
    let pnl: { activo: Doble; tc: Doble } | null = { activo: { ars: CERO, usd: CERO }, tc: { ars: CERO, usd: CERO } }
    for (const riesgo of ['ARS', 'USD'] as const) {
      const a = agg[riesgo]
      if (a === null || pnl === null) {
        pnl = null
        continue
      }
      const r = d35(riesgo, a.v0, a.v1, cclPrev, ccl, flujosAgg[riesgo])
      pnl = {
        activo: { ars: pnl.activo.ars.plus(r.activo.ars), usd: pnl.activo.usd.plus(r.activo.usd) },
        tc: { ars: pnl.tc.ars.plus(r.tc.ars), usd: pnl.tc.usd.plus(r.tc.usd) },
      }
    }
    if (finArs === null) pnl = null

    // Liquidez en pesos y si el excedente negativo se cubre.
    const liq = valor.get(liqArs) ?? null
    let noCubre: ParNum | null = null
    if (retiroArs.lt(0) && liq !== null && liq.lt(0)) {
      const antesLiq = (antes.get(liqArs) ?? CERO) as Decimal
      const falta = antesLiq.gt(0) ? liq.negated() : retiroArs.negated()
      noCubre = par(falta, falta.div(ccl))
    }

    // Aportado (capital puesto): el financiero de la carga + lo invertido − lo retirado.
    aportadoArs = sumar(aportadoArs, invertidoArs.plus(retiroArs))
    aportadoUsd = sumar(aportadoUsd, invUsd.plus(retUsd))

    // Bienes y deuda
    if (m >= 1) {
      casaV = casaV === null || fCasa === null ? null : casaV.times(fCasa)
      camV = camV === null || fCamioneta === null ? null : camV.times(fCamioneta)
    }
    const bienAr = (v: Decimal | null, moneda: Moneda) => (v === null ? null : moneda === 'USD' ? v.times(ccl) : v)
    const bienUs = (v: Decimal | null, moneda: Moneda) => (v === null ? null : moneda === 'USD' ? v : v.div(ccl))
    const libresArs = P.casa ? bienAr(casaV, P.casa.moneda) : CERO
    const libresUsd = P.casa ? bienUs(casaV, P.casa.moneda) : CERO
    const finBienArs = P.camioneta ? bienAr(camV, P.camioneta.moneda) : CERO
    const finBienUsd = P.camioneta ? bienUs(camV, P.camioneta.moneda) : CERO
    if (deuda !== null) {
      if (amortMes === null) {
        deuda = null
        motivoDeuda =
          'Falta la apertura de la cuota: sin la tasa del contrato no se sabe cuánto de cada cuota baja la deuda (lo calcula Pasivos con el monto financiado).'
      } else deuda = deuda.minus(amortMes)
    }
    const deudaUsd = deuda === null ? null : deuda.div(ccl)
    const netoSinArs = finArs === null || libresArs === null ? null : finArs.plus(libresArs)
    const netoSinUsd = finUsd === null || libresUsd === null ? null : finUsd.plus(libresUsd)
    const netoArs = netoSinArs === null || finBienArs === null || deuda === null ? null : netoSinArs.plus(finBienArs).minus(P.camioneta ? deuda : CERO)
    const netoUsd = netoSinUsd === null || finBienUsd === null || deudaUsd === null ? null : netoSinUsd.plus(finBienUsd).minus(P.camioneta ? deudaUsd : CERO)

    const motivos: MesProyectado['motivos'] = {}
    if (finArs === null) {
      motivos.financiero = motivoFin ?? 'Falta un valor.'
      motivos.neto_sin_financiados = motivos.financiero
      motivos['pnl.activo'] = motivos.financiero
      motivos['pnl.tc'] = motivos.financiero
    }
    if (libresArs === null) motivos.neto_sin_financiados ??= 'Falta el supuesto de la casa (o su valuación).'
    if (deuda === null) motivos.deuda_leasing = motivoDeuda ?? 'Falta la deuda del leasing.'
    if (netoArs === null) motivos.neto_completo = motivos.neto_sin_financiados ?? motivos.deuda_leasing ?? 'Falta el supuesto de la camioneta (o su valuación).'
    if (cuotaGasto === null) motivos.cuota_gasto = 'Falta la apertura de la cuota (cuánto es amortización).'
    if (vencArs === null) motivos.vencimientos = motivoSinCrono ?? 'Falta el pago al vencimiento.'

    const reales: NonNullable<MesProyectado['reales']> = []
    if (realIng) reales.push('ingresos')
    if (realGas) reales.push('gastos')
    if (P.cuotas[m].length && P.cuotas[m].every((c) => c.c.pagada)) reales.push('cuota')
    if (P.deuda0.etiquetas.length) etiq.push(...P.deuda0.etiquetas)

    const mesP: MesProyectado = {
      mes: P.meses[m],
      real: false,
      estado: m === 0 ? 'en_curso' : 'proyectado',
      ccl: ccl.toFixed(),
      cripto: txt(cripto),
      ingresos: par(ingresoArs, ingresoArs.div(ccl)),
      gastos: par(gastosArs, gastosArs.div(ccl)),
      cuota: par(cuotaArs, cuotaArs.div(ccl)),
      cuota_gasto: par(cuotaGasto, cuotaGasto === null ? null : cuotaGasto.div(ccl)),
      vencimientos: par(vencArs, vencArs === null ? null : vencArs.div(ccl)),
      excedente: par(excArs, excArs.div(ccl)),
      invertido: par(invertidoArs, invUsd),
      financiero: par(finArs, finUsd),
      neto_sin_financiados: par(netoSinArs, netoSinUsd),
      deuda_leasing: par(deuda, deudaUsd),
      neto_completo: par(netoArs, netoUsd),
      pnl: {
        aportes: par(invertidoArs.plus(retiroArs), invUsd.plus(retUsd)),
        activo: par(pnl?.activo.ars ?? null, pnl?.activo.usd ?? null),
        tc: par(pnl?.tc.ars ?? null, pnl?.tc.usd ?? null),
      },
      etiquetas: unicas(etiq),
      extraordinarios: par(real.extraArs.plus(real.extraUsd.times(ccl)), real.extraArs.div(ccl).plus(real.extraUsd)),
      reintegro: par(reintegroArs, reintegroArs.div(ccl)),
      liquidez_pesos: par(liq, liq === null ? null : liq.div(ccl)),
      no_se_cubre: noCubre,
      bienes_libres: par(libresArs, libresUsd),
      bienes_financiados: par(finBienArs, finBienUsd),
      aportado: par(aportadoArs, aportadoUsd),
      reales,
      motivos,
    }
    meses.push(mesP)

    // Cobertura de la cuota (visión 4.15): mediana de los 12 meses anteriores del resultado sin aportes, en USD.
    resultadosUsd.push(pnl ? pnl.activo.usd.plus(pnl.tc.usd) : null)
    if (cuotaArs.gt(0)) huboCuota = true
    if (cobertura === null && m >= 12 && cuotaArs.gt(0)) {
      const ult = resultadosUsd.slice(m - 12, m)
      // Con un mes sin dato no se sabe si cruza: se dice, no se concluye "no alcanza".
      const k = ult.findIndex((x) => x === null)
      if (k >= 0) cobertura = { mes: null, texto: `Sin dato: ${meses[m - 12 + k]?.motivos?.financiero ?? 'falta el resultado de un mes.'}` }
      else {
        const orden = (ult as Decimal[]).slice().sort((a, b) => a.comparedTo(b))
        const mediana = orden[5].plus(orden[6]).div(2)
        if (mediana.gte(cuotaArs.div(ccl))) {
          cobertura = {
            mes: P.meses[m],
            texto: `En ${nombreMes(P.meses[m])} la mediana de tus 12 meses anteriores de resultado (sin aportes), ${monto(mediana, 'USD')}, alcanza la cuota de ese mes, ${monto(cuotaArs.div(ccl), 'USD')}.`,
          }
        }
      }
    }

    if (mesDetalle === m) {
      detalle = {
        m,
        ccl,
        cclPrev,
        cripto,
        dev,
        ingUsdDecl,
        ingArsDecl,
        fUsd,
        fArs,
        ingUsd,
        ingArsPesos: ingPesos,
        ingresoArs,
        realIng,
        gasDeclArs: P.gasArs[m],
        gasDeclUsd: P.gasUsd[m],
        fGas,
        gastosArs,
        realGas,
        cuotas: cuotasDet,
        cuotaArs,
        reintegroArs,
        vencArs,
        vencPartes,
        excArs,
        postArs,
        pct,
        invertidoArs,
        retiroArs,
        valores: valoresDet,
        liquidezArs: liq,
        deudaArs: deuda,
        amortSum: amortMes,
        bienesLibresArs: libresArs,
        bienesFinArs: finBienArs,
        aportadoArs,
        aportadoUsd,
        pnl,
        etiquetas: unicas(etiq),
      }
    }
  }

  const ultimo = meses[meses.length - 1]
  let debajo: Proyeccion['debajo'] = null
  if (ultimo && ultimo.financiero.ars !== null && ultimo.aportado?.ars) {
    const dA = new Decimal(ultimo.financiero.ars).minus(ultimo.aportado.ars)
    const dU = ultimo.financiero.usd !== null && ultimo.aportado.usd !== null ? new Decimal(ultimo.financiero.usd).minus(ultimo.aportado.usd) : null
    debajo = {
      diferencia: par(dA, dU),
      texto: dA.lt(0)
        ? `En ${nombreMes(ultimo.mes)} terminás ${monto(dA.abs(), 'ARS')} debajo de lo que pusiste (tu financiero de la carga más lo invertido).`
        : `En ${nombreMes(ultimo.mes)} terminás ${monto(dA, 'ARS')} arriba de lo que pusiste (tu financiero de la carga más lo invertido).`,
    }
  }
  if (cobertura === null && huboCuota) {
    cobertura =
      H < 12
        ? { mes: null, texto: 'Para medirla hace falta un horizonte de 13 meses o más: compara la mediana de tus 12 meses anteriores de resultado con la cuota.' }
        : { mes: null, texto: 'Con este escenario, el resultado de tus inversiones no alcanza la cuota antes del horizonte.' }
  }
  return { proyeccion: { estado: 'lista', faltan: [], faltan_parciales: parciales, meses, cobertura, debajo }, detalle }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "nov-26" */
export function nombreMes(mes: Fecha): string {
  const [a, m] = mes.split('-')
  return `${MESES[Number(m) - 1]}-${a.slice(2)}`
}

/** La proyección del escenario (sin trazas: las da trazaMes a pedido). */
export function proyectar(base: BaseProyeccion, s: Supuestos): Proyeccion {
  return correr(base, s, null).proyeccion
}

// ───────────── La traza de una cifra, a pedido ─────────────

const fmt = (x: Decimal, moneda: Moneda) => monto(x, moneda, { decimales: 2 })

/** La traza de una cifra de un mes, en pesos o en dólares (se arma al tocarla). */
export function trazaMes(base: BaseProyeccion, s: Supuestos, mes: Fecha, campo: CampoMes, moneda: Moneda = 'ARS'): CalcVista {
  const P = preparar(base)
  const k = indiceMes(P.mes0, mes)
  const r = correr(base, s, k)
  const d = r.detalle
  const mp = r.proyeccion.meses[k]
  if (!d || !mp) return vista(sinDato('Ese mes no está en la proyección.'))
  const et = d.etiquetas
  const nombre = nombreMes(mes)
  const ins = (n: string, v: Decimal | null, unidad: Insumo['unidad']): Insumo => ({ nombre: n, valor: txt(v), unidad })
  const insCcl = ins(`CCL de ${nombre}`, d.ccl, 'ratio')
  const enUsd = (ars: Calc, explicacion: string): Calc =>
    ars.valor === null
      ? sinDato(ars.motivo ?? 'Falta el valor en pesos.', [deCalc('En pesos', ars, 'ARS')], { etiquetas: et, explicacion })
      : calc(ars.valor.div(d.ccl), `${fmt(ars.valor, 'ARS')} ÷ CCL ${numero(d.ccl, 2)} = ${fmt(ars.valor.div(d.ccl), 'USD')}`, [deCalc('En pesos', ars, 'ARS'), insCcl], {
          etiquetas: et,
          explicacion,
        })
  const doble = (ars: Calc, explicacion: string) => (moneda === 'ARS' ? ars : enUsd(ars, explicacion))
  const motivo = mp.motivos?.[campo]

  const ingreso = (): Calc => {
    if (d.realIng) {
      return calc(d.ingresoArs, `lo que cargaste: ${fmt(d.ingArsPesos, 'ARS')}${d.ingUsd.gt(0) ? ` + ${fmt(d.ingUsd, 'USD')} × CCL ${numero(d.ccl, 2)}` : ''} = ${fmt(d.ingresoArs, 'ARS')}`, [
        ins('Pesos que cargaste', d.ingArsPesos, 'ARS'),
        ins('Dólares sin vender que cargaste', d.ingUsd, 'USD'),
        insCcl,
      ], { explicacion: 'Lo que entró de verdad este mes (Cargar ingreso): reemplaza a lo declarado.' })
    }
    const partes: string[] = []
    if (d.ingUsd.gt(0)) partes.push(`${fmt(d.ingUsdDecl, 'USD')} × ${numero(d.fUsd, 4)} × cripto ${numero(d.cripto ?? CERO, 2)}`)
    if (d.ingArsPesos.gt(0)) partes.push(`${fmt(d.ingArsDecl, 'ARS')} × ${numero(d.fArs, 4)}`)
    return calc(d.ingresoArs, `${partes.join(' + ') || 'sin ingresos declarados'} = ${fmt(d.ingresoArs, 'ARS')}`, [
      ins('Ingreso en dólares declarado', d.ingUsdDecl, 'USD'),
      ins('Factor del escenario sobre el ingreso en dólares', d.fUsd, 'ratio'),
      ins(`Cripto de ${nombre} (escenario)`, d.cripto, 'ratio'),
      ins('Ingreso en pesos declarado', d.ingArsDecl, 'ARS'),
      ins('Factor del escenario sobre el ingreso en pesos', d.fArs, 'ratio'),
    ], { etiquetas: et, explicacion: 'Lo que declaraste vigente ese mes, movido por tu escenario, con los dólares vendidos al cripto del escenario.' })
  }
  const gastos = (): Calc =>
    d.realGas
      ? calc(d.gastosArs, `lo que cargaste = ${fmt(d.gastosArs, 'ARS')}`, [], { explicacion: 'El gasto fijo del mes que cargaste: reemplaza a lo declarado.' })
      : calc(
          d.gastosArs,
          `(${fmt(d.gasDeclArs, 'ARS')}${d.gasDeclUsd.gt(0) ? ` + ${fmt(d.gasDeclUsd, 'USD')} × CCL ${numero(d.ccl, 2)}` : ''}) × ${numero(d.fGas, 4)} = ${fmt(d.gastosArs, 'ARS')}`,
          [ins('Gastos declarados del mes', d.gasDeclArs, 'ARS'), ins('Gastos declarados en dólares', d.gasDeclUsd, 'USD'), ins('Factor acumulado de los gastos', d.fGas, 'ratio')],
          { etiquetas: [...et, 'declarado'], explicacion: 'Tus gastos declarados (no son gastos reales), movidos por tu escenario.' },
        )
  const cuota = (): Calc =>
    calc(
      d.cuotaArs,
      d.cuotas.length
        ? `${d.cuotas.map((x) => `cuota ${x.c.nro} (${fechaCorta(x.c.fecha_vencimiento)}) ${x.quien === 'titular' ? fmt(new Decimal(x.c.total), 'ARS') : 'la paga la empresa'}`).join(' + ')} = ${fmt(d.cuotaArs, 'ARS')}`
        : `sin cuotas este mes = ${fmt(CERO, 'ARS')}`,
      d.cuotas.map((x) => ({
        nombre: `Cuota ${x.c.nro} · ${x.quien === 'titular' ? 'la pagás vos' : 'la paga la empresa'}`,
        valor: x.c.total,
        unidad: 'ARS' as const,
        calc: x.c.partes
          ? calc(
              new Decimal(x.c.total),
              `canon ${fmt(new Decimal(x.c.partes.canon), 'ARS')} + IVA ${fmt(new Decimal(x.c.partes.iva), 'ARS')} + seguro ${fmt(new Decimal(x.c.partes.seguro), 'ARS')} + percepción ${fmt(new Decimal(x.c.partes.percepcion), 'ARS')}${x.c.partes.cargos ? ` + cargos extra ${fmt(new Decimal(x.c.partes.cargos), 'ARS')}` : ''} = ${fmt(new Decimal(x.c.total), 'ARS')}`,
              [],
              { etiquetas: x.c.etiquetas },
            )
          : undefined,
      })),
      { etiquetas: et, explicacion: 'La cuota entera, lo que se debita: canon, IVA, seguro y percepción. Si la paga la empresa, no resta.' },
    )
  const excedente = (): Calc => {
    const i = ingreso()
    const g = gastos()
    const c = cuota()
    return calc(
      d.excArs,
      `${fmt(d.ingresoArs, 'ARS')} − ${fmt(d.gastosArs, 'ARS')} − ${fmt(d.cuotaArs, 'ARS')}${d.reintegroArs.gt(0) ? ` + ${fmt(d.reintegroArs, 'ARS')} (reintegro del IVA)` : ''} = ${fmt(d.excArs, 'ARS')}`,
      [deCalc('Ingresos', i, 'ARS'), deCalc('Gastos fijos', g, 'ARS'), deCalc('Cuota del leasing', c, 'ARS'), ins('Reintegro del IVA y la percepción', d.reintegroArs, 'ARS')],
      { etiquetas: et, explicacion: 'Lo que te queda para invertir: ingresos − gastos fijos − la cuota entera del leasing (tu regla del 14/10).' },
    )
  }
  const financiero = (): Calc => {
    if (mp.financiero.ars === null) {
      return sinDato(motivo ?? 'Falta un valor.', d.valores.map((v) => ins(v.nombre, v.despues, v.riesgo)), { etiquetas: et })
    }
    const fin = new Decimal(mp.financiero.ars)
    return calc(
      fin,
      `${d.valores
        .filter((v) => v.despues !== null && !v.despues.isZero())
        .map((v) => (v.riesgo === 'USD' ? `${fmt(v.despues as Decimal, 'USD')} × ${numero(d.ccl, 2)}` : fmt(v.despues as Decimal, 'ARS')))
        .join(' + ')} = ${fmt(fin, 'ARS')}`,
      d.valores.map((v) => ({
        nombre: v.nombre,
        valor: txt(v.despues),
        unidad: v.riesgo,
        calc:
          v.antes !== null && v.despues !== null
            ? calc(v.despues, `${fmt(v.antes, v.riesgo)} al principio del mes, crece con su supuesto, + ${fmt(v.aporte, 'ARS')} invertido = ${fmt(v.despues, v.riesgo)}`, [], {
                etiquetas: et,
              })
            : undefined,
      })),
      { etiquetas: et, explicacion: 'Tu patrimonio financiero proyectado a fin de mes: cada partida con el supuesto de su clase y lo que invertiste según tu regla.' },
    )
  }
  const desdeParNum = (pn: ParNum, explicacion: string): Calc => {
    const v = moneda === 'ARS' ? pn.ars : pn.usd
    return v === null ? sinDato(motivo ?? 'Falta un dato.', [], { etiquetas: et, explicacion }) : calc(new Decimal(v), `${fmt(new Decimal(v), moneda)}`, [], { etiquetas: et, explicacion })
  }

  let c: Calc
  switch (campo) {
    case 'ingresos':
      c = doble(ingreso(), 'Tus ingresos del mes en dólares, al CCL del mes.')
      break
    case 'gastos':
      c = doble(gastos(), 'Tus gastos del mes en dólares, al CCL del mes.')
      break
    case 'cuota':
      c = doble(cuota(), 'La cuota del mes en dólares, al CCL del mes.')
      break
    case 'excedente':
      c = doble(excedente(), 'El excedente en dólares, al CCL del mes.')
      break
    case 'invertido': {
      const e = excedente()
      const inv = calc(
        d.invertidoArs.plus(d.retiroArs),
        d.retiroArs.lt(0)
          ? `excedente ${fmt(d.postArs ?? CERO, 'ARS')} < 0: sale de tu liquidez en pesos = ${fmt(d.retiroArs, 'ARS')}`
          : `${fmt(d.postArs ?? CERO, 'ARS')} × ${porcentaje(d.pct, { decimales: 0 })} = ${fmt(d.invertidoArs, 'ARS')}`,
        [deCalc('Excedente', e, 'ARS'), ins('Lo que invertís del excedente (tu regla)', d.pct, 'fraccion')],
        {
          etiquetas: et,
          explicacion:
            k === 0
              ? 'En el mes de la carga cuenta solo lo que pasa después de la carga (lo de antes ya está en tus saldos). Se reparte según el peso de cada partida en tu última carga.'
              : 'Se reparte según el peso de cada partida en tu última carga (tu regla del 14/10).',
        },
      )
      c = doble(inv, 'Lo invertido en dólares, al CCL del mes.')
      break
    }
    case 'vencimientos':
      c =
        d.vencArs === null
          ? sinDato(motivo ?? 'Falta el pago al vencimiento.', [], { etiquetas: et })
          : doble(
              calc(
                d.vencArs,
                d.vencPartes.length
                  ? `${d.vencPartes.map((x) => `${x.nombre} ${x.ars === null ? 'sin dato' : fmt(x.ars, 'ARS')}`).join(' + ')} = ${fmt(d.vencArs, 'ARS')}`
                  : `nada vence en ${nombre} = ${fmt(d.vencArs, 'ARS')}`,
                d.vencPartes.map((x): Insumo => ({ nombre: `${x.nombre}: ${x.como}`, valor: x.ars === null ? null : x.ars.toFixed(), unidad: 'ARS' })),
                { etiquetas: et, explicacion: 'Lo que cobrás: pago por VN × tus VN (cronograma cargado), o el valor de lo que vence con su supuesto.' },
              ),
              'En dólares, al CCL del mes.',
            )
      break
    case 'financiero':
      c = doble(financiero(), 'Tu financiero en dólares, al CCL del mes.')
      break
    case 'liquidez_pesos':
      c = desdeParNum(mp.liquidez_pesos ?? { ars: null, usd: null }, 'Tus pesos líquidos a fin de mes: de acá sale un excedente negativo.')
      break
    case 'deuda_leasing':
      c = desdeParNum(mp.deuda_leasing, 'La deuda del leasing: la de la carga menos la amortización de cada cuota.')
      break
    default:
      c = desdeParNum(
        campo === 'cuota_gasto'
          ? mp.cuota_gasto
          : campo === 'neto_sin_financiados'
            ? mp.neto_sin_financiados
            : campo === 'neto_completo'
              ? mp.neto_completo
              : campo === 'pnl.aportes'
                ? mp.pnl.aportes
                : campo === 'pnl.activo'
                  ? mp.pnl.activo
                  : campo === 'pnl.tc'
                    ? mp.pnl.tc
                    : (mp.aportado ?? { ars: null, usd: null }),
        campo === 'neto_completo'
          ? 'Financiero + casa + camioneta − la deuda del leasing de ese mes.'
          : campo === 'neto_sin_financiados'
            ? 'Financiero + casa (sin la camioneta ni su deuda).'
            : campo.startsWith('pnl.')
              ? 'El resultado del mes partido como lo real (D-35): aportes, precio y dólar.'
              : 'El dato del mes.',
      )
  }
  return vista(c)
}
