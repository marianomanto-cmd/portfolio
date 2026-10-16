// Supuestos de un escenario (plan §6 D.1 y D.2; D-08, D-88, D-147, D-155, D-164).
//
// Reglas:
// - Todo arranca en Igual (D-164, lo pidió el dueño el 15/10: "en flujos y
//   escenarios quiero ver graficos"): cada variable de mercado, como en la
//   última carga, y el horizonte en 12 meses, así la proyección y sus gráficos
//   se ven al abrir. Es un supuesto y va rotulado. Lo que no tiene Igual
//   posible (la brecha sin el cripto, la TEM de renovación sin la TEM de hoy)
//   queda sin elegir y dice qué falta: nunca se inventa un número.
// - Lo otro precargado es lo que DECLARÓ el dueño el 14/10: su regla de
//   reinversión (todo el excedente, proporcional a la última carga; los
//   vencimientos, igual) y que la cuota del leasing la paga él (la resta de su
//   ingreso). Va rotulado "tu regla · 14/10" y se puede cambiar.
// - Un supuesto sin elegir (un `?s=` o un escenario de antes) arranca en Igual
//   (conArranque); Baja o Sube sin número, también.
// - Los valores viajan como texto decimal (D-32). Sin Decimal acá: el esquema
//   corre igual en el navegador.
// - Una variable nueva sube `v` (D-08): un escenario guardado con otra versión
//   no se lee a medias.

import { z } from 'zod'
import { Decimal } from '../dinero'
import { leasingsSinCuadro, motivoSinCuadro } from './cuotas'
import type { BaseProyeccion, ClaseProyeccion, Direccion, Supuestos, Tramo, TramoIngreso, Var } from './tipos'

export const VERSION_SUPUESTOS = 1 as const

export type ClaveVariable =
  | 'devaluacion'
  | 'inflacion'
  | 'brecha_cripto'
  | 'ingreso_usd'
  | 'ingreso_pesos'
  | 'gastos'
  | 'retorno.cedear'
  | 'retorno.accion_local'
  | 'retorno.liquidez_pesos'
  | 'tem_renovacion'
  | 'casa'
  | 'camioneta'
  | `dual.${string}`

export interface MetaVariable {
  nombre: string
  /** "¿Qué es esto?" en una línea. */
  ayuda: string
  unidad: '%/mes' | '%/año' | 'puntos' | '%'
  /** Hasta dónde llega el deslizante en cada dirección (siempre desde 0, de a 0,1). */
  max: { baja: number; sube: number }
  /** Qué hace Baja y qué hace Sube, en palabras. */
  baja: string
  sube: string
}

const META_FIJA: Record<Exclude<ClaveVariable, `dual.${string}`>, MetaVariable> = {
  devaluacion: {
    nombre: 'Devaluación (CCL)',
    ayuda: 'Cuánto se mueve el dólar contado con liquidación por mes. Mueve todo lo que está en dólares cuando lo mirás en pesos, y al revés.',
    unidad: '%/mes',
    max: { baja: 15, sube: 15 },
    baja: 'el CCL baja',
    sube: 'el CCL sube',
  },
  inflacion: {
    nombre: 'Inflación',
    ayuda: 'Solo mueve lo que ataste a la inflación (tus gastos, si elegís "atados a la inflación").',
    unidad: '%/mes',
    max: { baja: 5, sube: 15 },
    baja: 'los precios bajan',
    sube: 'los precios suben',
  },
  brecha_cripto: {
    nombre: 'Brecha del cripto contra el CCL',
    ayuda: 'A qué dólar vendés tus dólares de ingreso: el cripto, como diferencia con el CCL del mes.',
    unidad: 'puntos',
    max: { baja: 25, sube: 25 },
    baja: 'el cripto queda más abajo del CCL',
    sube: 'el cripto queda más arriba del CCL',
  },
  ingreso_usd: {
    nombre: 'Ingreso en dólares',
    ayuda: 'Tu ingreso mensual en dólares, por tramos: desde el mes que digas puede cambiar (como el de feb-2027).',
    unidad: '%',
    max: { baja: 100, sube: 200 },
    baja: 'cobrás menos que lo declarado',
    sube: 'cobrás más que lo declarado',
  },
  ingreso_pesos: {
    nombre: 'Ingreso en pesos',
    ayuda: 'Tu ingreso mensual fijo en pesos, por tramos, sobre lo declarado.',
    unidad: '%',
    max: { baja: 100, sube: 200 },
    baja: 'cobrás menos que lo declarado',
    sube: 'cobrás más que lo declarado',
  },
  gastos: {
    nombre: 'Gastos fijos',
    ayuda: 'Tus gastos declarados, nominales, o creciendo por mes (o atados a la inflación del escenario).',
    unidad: '%/mes',
    max: { baja: 15, sube: 15 },
    baja: 'bajan por mes',
    sube: 'suben por mes',
  },
  'retorno.cedear': {
    nombre: 'Retorno de los CEDEARs (en dólares)',
    ayuda: 'Cuánto rinden por año, en dólares, tus CEDEARs y lo que se invierte en ellos.',
    unidad: '%/año',
    max: { baja: 60, sube: 60 },
    baja: 'pierden por año',
    sube: 'ganan por año',
  },
  'retorno.accion_local': {
    nombre: 'Retorno de las acciones locales',
    ayuda: 'Cuánto rinden por año, en su moneda de riesgo, tus acciones locales.',
    unidad: '%/año',
    max: { baja: 60, sube: 60 },
    baja: 'pierden por año',
    sube: 'ganan por año',
  },
  'retorno.liquidez_pesos': {
    nombre: 'Rendimiento de la liquidez en pesos',
    ayuda: 'Cuánto rinden por año tus pesos y tus FCI en pesos (una cuenta remunerada, un money market).',
    unidad: '%/año',
    max: { baja: 60, sube: 60 },
    baja: 'pierden por año',
    sube: 'rinden por año',
  },
  tem_renovacion: {
    nombre: 'TEM de renovación',
    ayuda:
      'Lo que rinde por mes lo que se reinvierte en letras después de un vencimiento. Las letras que ya tenés van a vencimiento a su TEM implícita y no dependen de esto (D-146).',
    unidad: 'puntos',
    max: { baja: 10, sube: 10 },
    baja: 'renovás a menos TEM',
    sube: 'renovás a más TEM',
  },
  casa: {
    nombre: 'Casa (en dólares)',
    ayuda: 'Cuánto cambia por año el valor de la casa, en dólares. La app no valúa bienes: es tu supuesto (D-04).',
    unidad: '%/año',
    max: { baja: 30, sube: 30 },
    baja: 'vale menos por año',
    sube: 'vale más por año',
  },
  camioneta: {
    nombre: 'Camioneta (en pesos)',
    ayuda: 'Cuánto cambia por año el valor de la camioneta, en pesos (Baja = se deprecia).',
    unidad: '%/año',
    max: { baja: 40, sube: 40 },
    baja: 'se deprecia por año',
    sube: 'vale más por año',
  },
}

export function metaVariable(clave: ClaveVariable): MetaVariable {
  if (clave.startsWith('dual.')) {
    const ticker = clave.slice(5)
    return {
      nombre: `${ticker} (pago a determinar)`,
      ayuda: `${ticker} no tiene un pago fijo (dual, CER o TAMAR): su valor sale de este supuesto, sobre el precio de hoy, hasta su vencimiento.`,
      unidad: '%/año',
      max: { baja: 60, sube: 60 },
      baja: 'vale menos por año',
      sube: 'vale más por año',
    }
  }
  return META_FIJA[clave as Exclude<ClaveVariable, `dual.${string}`>]
}

// ───────────── Esquema (zod 4) ─────────────

const RE_DECIMAL = /^-?\d+(\.\d+)?$/
const decimal = z.string().regex(RE_DECIMAL, 'Un número decimal como texto (D-32).')
const direccion = z.enum(['baja', 'igual', 'sube']).nullable()
const mes = z.number().int().min(1).max(120)

const esqVar = z.object({ dir: direccion, valor: decimal.nullable() })
// "Hasta el mes 0": un tramo que, corrido a una carga posterior, rige solo el mes de la carga.
const esqTramo = esqVar.extend({ hasta_mes: z.number().int().min(0).max(120).nullable() })
const esqTramoIngreso = esqVar.extend({
  desde_mes: mes,
  crecimiento_anual: decimal.nullable(),
  ajuste_mensual: decimal.nullable().optional(),
})
const CLASES = ['cedear', 'accion_local', 'bono', 'lecap', 'fci', 'liquidez'] as const satisfies readonly ClaseProyeccion[]

export const esquemaSupuestos = z.object({
  v: z.literal(VERSION_SUPUESTOS),
  base_mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, 'El mes de la base: AAAA-MM-01.').optional(),
  horizonte_meses: mes.nullable(),
  devaluacion: z.array(esqTramo).min(1).max(6),
  inflacion: z.array(esqTramo).min(1).max(6),
  brecha_cripto: esqVar,
  ingreso_usd: z.array(esqTramoIngreso).min(1).max(6),
  ingreso_pesos: z.array(esqTramoIngreso).min(1).max(6),
  tem_renovacion: esqVar,
  reintegro_iva: z.boolean().nullable(),
  gastos: esqVar.extend({ atado_inflacion: z.boolean().optional() }),
  retorno: z.object({ cedear: esqVar, accion_local: esqVar, liquidez_pesos: esqVar }),
  dual: z.record(z.string().regex(/^[A-Z0-9]{1,20}$/), esqVar),
  destino_vencimientos: z.union([z.literal('regla'), z.enum(CLASES)]).nullable(),
  casa: esqVar,
  camioneta: esqVar,
  shock_ingreso: z.object({ desde_mes: mes, usd: decimal }).nullable(),
  pagador_cuota: z.object({ quien: z.enum(['titular', 'empresa']), desde_mes: mes.nullable() }).nullable(),
  opcion_compra: z.object({ ejerce: z.boolean(), mes: mes.nullable() }).nullable(),
  politica: z.object({
    regla: z.enum(['proporcional_ultima_carga', 'por_clase']),
    pct: decimal,
    clase: z.enum(CLASES).nullable(),
    origen: z.enum(['declarada_14_10', 'elegida']),
    incluye_liquidez: z.boolean().optional(),
  }),
}) satisfies z.ZodType<Supuestos>

// ───────────── El arranque ─────────────

const varVacia = (): Var => ({ dir: null, valor: null })
const tramoVacio = (): Tramo => ({ dir: null, valor: null, hasta_mes: null })
const tramoIngreso = (desde_mes: number): TramoIngreso => ({ dir: null, valor: null, desde_mes, crecimiento_anual: null, ajuste_mensual: null })

/** El horizonte con que arranca un escenario (D-164): 12 meses. */
export const HORIZONTE_ARRANQUE = 12

/**
 * La estructura de un escenario, sin nada de mercado elegido: solo la regla
 * que declaró el dueño (D-155) y que la cuota la paga él; los dos, editables.
 * La pantalla no arranca de acá sino de supuestosDeArranque (todo en Igual).
 */
export function supuestosVacios(): Supuestos {
  return {
    v: VERSION_SUPUESTOS,
    horizonte_meses: null,
    devaluacion: [tramoVacio()],
    inflacion: [tramoVacio()],
    brecha_cripto: varVacia(),
    ingreso_usd: [tramoIngreso(1)],
    ingreso_pesos: [tramoIngreso(1)],
    tem_renovacion: varVacia(),
    reintegro_iva: null,
    gastos: { ...varVacia(), atado_inflacion: false },
    retorno: { cedear: varVacia(), accion_local: varVacia(), liquidez_pesos: varVacia() },
    dual: {},
    destino_vencimientos: 'regla',
    casa: varVacia(),
    camioneta: varVacia(),
    shock_ingreso: null,
    pagador_cuota: { quien: 'titular', desde_mes: null },
    opcion_compra: null,
    politica: { regla: 'proporcional_ultima_carga', pct: '100', clase: null, origen: 'declarada_14_10', incluye_liquidez: true },
  }
}

/** Primer día del mes de una fecha. */
export function mesDe(f: string): string {
  return `${f.slice(0, 7)}-01`
}

/** Meses entre el mes de la base (mes 0) y el de una fecha. */
export function indiceMes(base: string, f: string): number {
  const [a0, m0] = base.split('-').map(Number)
  const [a1, m1] = f.split('-').map(Number)
  return (a1 - a0) * 12 + (m1 - m0)
}

/** El mes N contado desde el mes de la base (mes 0 = el de la carga). */
export function fechaMes(base: string, n: number): string {
  const [a, m] = base.split('-').map(Number)
  const t = a * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`
}

/** El cambio de ingreso que anunció el dueño el 14/10 (respuesta 3): feb-2027. Es estructura, no un monto. */
export const CAMBIO_DE_INGRESO_DECLARADO = '2027-02-01'

/**
 * La estructura de los supuestos de una base: los vacíos, más los tramos que
 * ya se saben (el ingreso cambia en feb-2027) y una variable por cada bono con
 * pago a determinar. Todo sin elegir: el arranque de la pantalla es
 * supuestosDeArranque.
 */
export function supuestosIniciales(base: Pick<BaseProyeccion, 'fecha' | 'partidas'>): Supuestos {
  const s: Supuestos = { ...supuestosVacios(), base_mes: mesDe(base.fecha) }
  const n = indiceMes(base.fecha, CAMBIO_DE_INGRESO_DECLARADO)
  if (n >= 1 && n <= 120) {
    s.ingreso_usd.push(tramoIngreso(n))
    s.ingreso_pesos.push(tramoIngreso(n))
  }
  for (const p of base.partidas) if (p.ley === 'propia' && p.ticker) s.dual[p.ticker] = varVacia()
  return s
}

/**
 * Los supuestos con sus meses contados desde otra carga. Los meses de un
 * escenario ("desde el mes N", "hasta el mes N") se cuentan desde la carga con
 * que se armó (`base_mes`): abierto con una carga de otro mes, se corren para
 * que sigan cayendo en el mismo mes del calendario (el cambio de ingreso de
 * feb-2027 sigue en feb-2027). Un tramo que ya empezó rige desde el mes 1 (si
 * empezaron varios, el último); uno que ya terminó sale. Sin `base_mes` (un
 * `?s=` de antes), se toman contados desde esta carga.
 */
export function rebasar(s: Supuestos, fechaBase: string): Supuestos {
  const base_mes = mesDe(fechaBase)
  const k = s.base_mes ? indiceMes(s.base_mes, base_mes) : 0
  if (k === 0) return s.base_mes === base_mes ? s : { ...s, base_mes }
  const correr = (n: number) => Math.min(120, n - k)
  const desde = (ts: TramoIngreso[]): TramoIngreso[] => {
    const corridos = ts.map((t) => ({ ...t, desde_mes: correr(t.desde_mes) })).sort((a, b) => a.desde_mes - b.desde_mes)
    // Empezó el que cae en el mes de la carga o antes; uno "desde el mes 1" empieza el mes que viene.
    const empezados = corridos.filter((t) => t.desde_mes <= 0)
    const vigente = empezados.at(-1)
    const futuros = corridos.filter((t) => t.desde_mes >= 1)
    return vigente ? [{ ...vigente, desde_mes: 1 }, ...futuros] : futuros.length ? futuros : [tramoIngreso(1)]
  }
  const hasta = (ts: Tramo[]): Tramo[] => {
    // Uno que termina en el mes de la carga (hasta el mes 0) todavía rige ese mes.
    const vivos = ts.map((t) => (t.hasta_mes === null ? t : { ...t, hasta_mes: correr(t.hasta_mes) })).filter((t) => t.hasta_mes === null || t.hasta_mes >= 0)
    return vivos.length ? vivos : [tramoVacio()]
  }
  const pc = s.pagador_cuota
  return {
    ...s,
    base_mes,
    devaluacion: hasta(s.devaluacion),
    inflacion: hasta(s.inflacion),
    ingreso_usd: desde(s.ingreso_usd),
    ingreso_pesos: desde(s.ingreso_pesos),
    shock_ingreso: s.shock_ingreso ? { ...s.shock_ingreso, desde_mes: Math.max(1, correr(s.shock_ingreso.desde_mes)) } : null,
    // "Desde el mes 1": el mes de la carga todavía la paga el otro.
    pagador_cuota: pc && pc.desde_mes !== null ? { ...pc, desde_mes: correr(pc.desde_mes) >= 1 ? correr(pc.desde_mes) : null } : pc,
    opcion_compra: s.opcion_compra && s.opcion_compra.mes !== null ? { ...s.opcion_compra, mes: Math.max(1, correr(s.opcion_compra.mes)) } : s.opcion_compra,
  }
}

// ───────────── Lo que falta elegir ─────────────

export interface Faltante {
  variable: string
  texto: string
}

function falta(v: Var): 'sin_dir' | 'sin_valor' | null {
  if (v.dir === null) return 'sin_dir'
  if (v.dir !== 'igual' && v.valor === null) return 'sin_valor'
  return null
}

// La pantalla arranca todo en Igual (conArranque): esto solo lo ve un escenario armado afuera de ella.
function textoFalta(nombre: string, f: 'sin_dir' | 'sin_valor'): string {
  return f === 'sin_dir' ? `${nombre}: sin elegir (mové su barra o tocá Igual)` : `${nombre}: falta el número (mové su barra)`
}

/** Qué necesita la base para proyectar (las variables que no se usan no se piden). */
export interface Necesidades {
  ingreso_usd: boolean
  ingreso_pesos: boolean
  gastos: boolean
  cedear: boolean
  accion_local: boolean
  liquidez_pesos: boolean
  letras: boolean
  casa: boolean
  camioneta: boolean
  cuotas: boolean
  propias: string[]
  /** Hay una TEM de hoy para la Igual de la TEM de renovación. */
  tem_hoy: boolean
  /** Hay cripto (o CCL y brecha) para la Igual de la brecha. */
  brecha_hoy: boolean
}

export function necesidades(base: BaseProyeccion): Necesidades {
  const p = base.partidas
  const ley = (x: (typeof p)[number]) => x.ley ?? 'clase'
  return {
    ingreso_usd: base.recurrentes.some((r) => r.sentido === 'ingreso' && r.moneda === 'USD'),
    ingreso_pesos: base.recurrentes.some((r) => r.sentido === 'ingreso' && r.moneda === 'ARS'),
    gastos: base.recurrentes.some((r) => r.sentido === 'gasto'),
    cedear: p.some((x) => x.clase === 'cedear'),
    accion_local: p.some((x) => x.clase === 'accion_local'),
    liquidez_pesos: p.some((x) => (x.clase === 'liquidez' || x.clase === 'fci') && x.moneda_riesgo === 'ARS'),
    letras: p.some((x) => ley(x) === 'cronograma' || ley(x) === 'sin_cronograma'),
    casa: base.bienes.some((b) => b.pasivo_id === null),
    camioneta: base.bienes.some((b) => b.pasivo_id !== null),
    cuotas: base.cuotas.some((c) => c.fecha_vencimiento > base.fecha),
    propias: p.filter((x) => ley(x) === 'propia' && x.ticker).map((x) => x.ticker as string),
    tem_hoy: p.some((x) => ley(x) === 'cronograma' && x.tem != null),
    brecha_hoy: base.cripto !== null && base.ccl !== null,
  }
}

/**
 * Las variables que faltan para proyectar (bloquean: con una sola, no se
 * inventa ningún mes) y las que faltan solo para una parte (la casa y la
 * camioneta: sin ellas, el patrimonio neto queda "sin dato").
 */
export function faltantes(base: BaseProyeccion, s: Supuestos): { bloquean: Faltante[]; parciales: Faltante[] } {
  const nec = necesidades(base)
  const bloquean: Faltante[] = []
  const parciales: Faltante[] = []
  const ver = (variable: string, nombre: string, v: Var, lista = bloquean) => {
    const f = falta(v)
    if (f) lista.push({ variable, texto: textoFalta(nombre, f) })
  }
  if (s.horizonte_meses === null) bloquean.push({ variable: 'horizonte', texto: 'Horizonte: elegí hasta cuándo proyectar' })
  // Lo no declarado no es cero: sin ingresos o sin gastos declarados no se proyecta.
  if (!base.recurrentes.some((r) => r.sentido === 'ingreso')) {
    bloquean.push({ variable: 'ingresos_declarados', texto: 'Tus ingresos: todavía no declaraste ninguno (abajo, en «Tus ingresos y gastos declarados»); no se proyecta un ingreso de cero' })
  }
  if (!base.recurrentes.some((r) => r.sentido === 'gasto')) {
    bloquean.push({ variable: 'gastos_declarados', texto: 'Tus gastos fijos: todavía no declaraste ninguno (abajo, en «Tus ingresos y gastos declarados»)' })
  }
  s.devaluacion.forEach((t, i) => ver(`devaluacion.${i}`, s.devaluacion.length > 1 ? `Devaluación, tramo ${i + 1}` : 'Devaluación', t))
  if (s.gastos.atado_inflacion) s.inflacion.forEach((t, i) => ver(`inflacion.${i}`, s.inflacion.length > 1 ? `Inflación, tramo ${i + 1}` : 'Inflación', t))
  if (nec.ingreso_usd) {
    if (!nec.brecha_hoy) {
      bloquean.push({
        variable: 'brecha_cripto',
        texto: 'Brecha del cripto: falta el dólar cripto de tu última carga; cargalo en tu próxima carga para pasar tu ingreso en dólares a pesos',
      })
    } else ver('brecha_cripto', 'Brecha del cripto', s.brecha_cripto)
    s.ingreso_usd.forEach((t, i) => ver(`ingreso_usd.${i}`, `Ingreso en dólares desde el mes ${t.desde_mes}`, t))
  }
  if (nec.ingreso_pesos) s.ingreso_pesos.forEach((t, i) => ver(`ingreso_pesos.${i}`, `Ingreso en pesos desde el mes ${t.desde_mes}`, t))
  if (nec.gastos) ver('gastos', 'Gastos fijos', s.gastos)
  if (nec.cedear || (s.politica.regla === 'por_clase' && s.politica.clase === 'cedear')) ver('retorno.cedear', 'Retorno de los CEDEARs', s.retorno.cedear)
  if (nec.accion_local) ver('retorno.accion_local', 'Retorno de las acciones locales', s.retorno.accion_local)
  if (nec.liquidez_pesos) ver('retorno.liquidez_pesos', 'Rendimiento de la liquidez en pesos', s.retorno.liquidez_pesos)
  if (nec.letras) {
    // Sin la TEM de hoy no hay "Igual" para la renovación: no frena la proyección de la caja; lo que
    // va a letras (y el financiero) queda "sin dato" con el nombre de la letra que falta (plan D.1).
    if (!nec.tem_hoy) {
      parciales.push({
        variable: 'tem_renovacion',
        texto:
          'TEM de renovación: falta el pago al vencimiento de tus letras para saber la TEM de hoy (cargalo abajo); mientras tanto, lo que va a letras queda sin dato, y con eso el patrimonio financiero y el neto proyectados',
      })
    } else ver('tem_renovacion', 'TEM de renovación', s.tem_renovacion)
  }
  // Un leasing sin cuadro de marcha: su cuota no se sabe y no se proyecta como $ 0 (salvo que la pague la empresa).
  const mes0 = mesDe(base.fecha)
  for (let m = 0; m <= Math.min(s.horizonte_meses ?? 0, 120); m++) {
    const pc = s.pagador_cuota
    const elegido = pc ? (pc.desde_mes !== null && m < pc.desde_mes ? (pc.quien === 'titular' ? 'empresa' : 'titular') : pc.quien) : 'titular'
    const l = leasingsSinCuadro(base, fechaMes(mes0, m)).find((x) => (x.pagador ?? elegido) !== 'empresa')
    if (l) {
      bloquean.push({ variable: 'cuadro_leasing', texto: `Cuota del leasing: ${motivoSinCuadro(l)}` })
      break
    }
  }
  for (const t of nec.propias) ver(`dual.${t}`, `${t} (pago a determinar)`, s.dual[t] ?? varVacia())
  if (nec.cuotas && s.pagador_cuota === null && base.cuotas.some((c) => c.pagador === null)) {
    bloquean.push({ variable: 'pagador_cuota', texto: '¿Quién paga la cuota del leasing? Elegí Vos o La empresa' })
  }
  const sinNeto: Faltante[] = []
  if (nec.casa) ver('casa', 'Casa', s.casa, sinNeto)
  if (nec.camioneta) ver('camioneta', 'Camioneta', s.camioneta, sinNeto)
  for (const f of sinNeto) parciales.push({ ...f, texto: `${f.texto}; sin eso, el patrimonio neto proyectado queda sin dato` })
  return { bloquean, parciales }
}

/**
 * Lo sin elegir, a Igual (D-164; antes era el botón "Completar lo que falta
 * con Igual", D-145). No pisa nada elegido: Baja o Sube con su número quedan
 * como están; sin número (o con 0) son Igual. Lo que no tiene Igual posible
 * (la brecha sin el cripto de la base, la TEM de renovación sin la TEM de hoy)
 * queda sin elegir, y faltantes() dice qué falta.
 */
export function completarConIgual(s: Supuestos, base: BaseProyeccion): Supuestos {
  const nec = necesidades(base)
  const igual = <T extends Var>(v: T): T =>
    v.dir === null || (v.dir !== 'igual' && (v.valor === null || new Decimal(v.valor).isZero())) ? { ...v, dir: 'igual', valor: null } : v
  const out: Supuestos = structuredClone(s)
  out.devaluacion = out.devaluacion.map(igual)
  out.inflacion = out.inflacion.map(igual)
  if (nec.brecha_hoy) out.brecha_cripto = igual(out.brecha_cripto)
  out.ingreso_usd = out.ingreso_usd.map(igual)
  out.ingreso_pesos = out.ingreso_pesos.map(igual)
  out.gastos = igual(out.gastos)
  out.retorno = { cedear: igual(out.retorno.cedear), accion_local: igual(out.retorno.accion_local), liquidez_pesos: igual(out.retorno.liquidez_pesos) }
  if (nec.tem_hoy) out.tem_renovacion = igual(out.tem_renovacion)
  for (const t of nec.propias) out.dual[t] = igual(out.dual[t] ?? varVacia())
  out.casa = igual(out.casa)
  out.camioneta = igual(out.camioneta)
  return out
}

/**
 * Un escenario listo para la pantalla (D-164): lo sin elegir, en Igual
 * (completarConIgual), y el horizonte sin elegir, en 12 meses. Es lo que pasa
 * con un `?s=` de antes y con un escenario guardado con algo sin elegir:
 * arrancan en Igual. Lo elegido no se toca.
 */
export function conArranque(s: Supuestos, base: BaseProyeccion): Supuestos {
  const out = completarConIgual(s, base)
  if (out.horizonte_meses === null) out.horizonte_meses = HORIZONTE_ARRANQUE
  return out
}

/**
 * Con qué arranca Flujo (D-164): todo en Igual (cada variable como en tu
 * última carga) y 12 meses, con tu regla del 14/10 y la cuota que pagás vos.
 * Así la proyección y sus gráficos se ven sin tocar nada. Es un supuesto, y
 * la pantalla lo dice.
 */
export function supuestosDeArranque(base: BaseProyeccion): Supuestos {
  return conArranque(supuestosIniciales(base), base)
}

/** El efecto con signo de una variable: Baja resta, Sube suma, Igual es 0. null = falta. */
export function efecto(v: Var): Decimal | null {
  if (v.dir === null) return null
  if (v.dir === 'igual') return new Decimal(0)
  if (v.valor === null) return null
  const x = new Decimal(v.valor).abs()
  return v.dir === 'baja' ? x.negated() : x
}

/** Fuera de rango para su variable: el deslizante no deja, pero la URL sí. */
export function fueraDeRango(clave: ClaveVariable, v: Var): string | null {
  if (v.dir === null || v.dir === 'igual' || v.valor === null) return null
  const m = metaVariable(clave)
  const x = Number(v.valor)
  const max = v.dir === 'baja' ? m.max.baja : m.max.sube
  if (!(x >= 0 && x <= max)) return `${m.nombre}: ${v.dir === 'baja' ? 'Baja' : 'Sube'} va de 0 a ${max} ${m.unidad}`
  return null
}

/** Todos los rangos de un escenario (vacío si está todo bien). */
export function erroresDeRango(s: Supuestos): string[] {
  const e: (string | null)[] = []
  s.devaluacion.forEach((t) => e.push(fueraDeRango('devaluacion', t)))
  s.inflacion.forEach((t) => e.push(fueraDeRango('inflacion', t)))
  e.push(fueraDeRango('brecha_cripto', s.brecha_cripto))
  s.ingreso_usd.forEach((t) => e.push(fueraDeRango('ingreso_usd', t)))
  s.ingreso_pesos.forEach((t) => e.push(fueraDeRango('ingreso_pesos', t)))
  e.push(fueraDeRango('gastos', s.gastos))
  e.push(fueraDeRango('retorno.cedear', s.retorno.cedear))
  e.push(fueraDeRango('retorno.accion_local', s.retorno.accion_local))
  e.push(fueraDeRango('retorno.liquidez_pesos', s.retorno.liquidez_pesos))
  e.push(fueraDeRango('tem_renovacion', s.tem_renovacion))
  for (const [t, v] of Object.entries(s.dual)) e.push(fueraDeRango(`dual.${t}`, v))
  e.push(fueraDeRango('casa', s.casa))
  e.push(fueraDeRango('camioneta', s.camioneta))
  for (const t of s.ingreso_pesos) {
    const a = t.ajuste_mensual === null || t.ajuste_mensual === undefined ? null : Number(t.ajuste_mensual)
    if (a !== null && !(a >= 0 && a <= 15)) e.push('El ajuste mensual del ingreso en pesos va de 0 a 15 %/mes')
  }
  const pct = Number(s.politica.pct)
  if (!(pct >= 0 && pct <= 100)) e.push('Lo que invertís del excedente va de 0% a 100%')
  return e.filter((x): x is string => x !== null)
}

// ───────────── En la URL (?s=) ─────────────

function aBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deBase64Url(t: string): string {
  const b64 = t.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (t.length % 4)) % 4)
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Supuestos → texto para `?s=` (base64url del JSON). */
export function codificar(s: Supuestos): string {
  return aBase64Url(JSON.stringify(s))
}

/** `?s=` → supuestos validados, o null si no se puede leer (otra versión, otra forma, fuera de rango). */
export function decodificar(t: string | null | undefined): Supuestos | null {
  if (!t || t.length > 8000) return null
  try {
    const r = esquemaSupuestos.safeParse(JSON.parse(deBase64Url(t)))
    if (!r.success) return null
    return erroresDeRango(r.data).length ? null : r.data
  } catch {
    return null
  }
}

/** La unidad como se escribe al lado del número: "%/mes", "%/año", "%" o "pts". */
export function unidadCorta(clave: ClaveVariable): string {
  const u = metaVariable(clave).unidad
  return u === 'puntos' ? 'pts' : u
}

/**
 * El valor de una variable en palabras, como se ve al lado de su barra y en
 * Comparar: "Igual", "Sube +2,0 %/mes", "Baja −1,5 pts", "Baja −10,0 %/año".
 * Sin elegir (solo en un escenario de antes, que arranca en Igual): "sin elegir".
 */
export function textoValor(clave: ClaveVariable, dir: Direccion | null, valor: string | null): string {
  if (dir === null) return 'sin elegir'
  if (dir === 'igual') return 'Igual'
  const nombre = dir === 'baja' ? 'Baja' : 'Sube'
  if (valor === null) return `${nombre} (sin número)`
  const n = new Decimal(valor).abs().toFixed(1).replace('.', ',')
  return `${nombre} ${dir === 'baja' ? '−' : '+'}${n} ${unidadCorta(clave)}`
}
