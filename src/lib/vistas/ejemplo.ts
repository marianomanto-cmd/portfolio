// Datos de ejemplo para el modo demo (PORTFOLIO_DEMO=1) y los tests de layout.
//
// TODOS LOS NÚMEROS SON INVENTADOS (D-24): salen del set del Apéndice B de
// docs/vision.md, que cuadra entre sí, y del camino diario de octubre que el
// apéndice marca como ilustrativo. Los tickers son conocidos para que se lea
// fácil; ninguna cantidad ni precio es real ni es una propuesta de cartera.
//
// En lugar de escribir a mano cada cifra, este módulo arma unos Hechos
// inventados y los pasa por el mismo motor que usa la app con datos reales
// (./armar). Así cada número del modo demo trae su fórmula, sus insumos y sus
// etiquetas de verdad, y el demo sirve también de prueba del motor contra el
// Apéndice B (tests/unit/ejemplo.test.ts).

import { calc, deCalc, sinDato, vista, type Calc, type CalcVista } from '@/lib/domain/calc'
import { CERO, Decimal, monto, porcentaje } from '@/lib/domain/dinero'
import type {
  Activo,
  Bien,
  BienValuacion,
  CargaResumen,
  Cotizacion,
  Cuenta,
  Fecha,
  Hechos,
  Operacion,
  Pasivo,
  PasivoSaldo,
  Saldo,
  TipoCambio,
} from '@/lib/domain/tipos'
import { armarCartera, armarExposicion, armarHoy } from './armar'
import type { FilaRegistro, Segmento, VistaCartera, VistaExposicion, VistaHoy, VistaRegistro } from './contratos'

/** El "hoy" del ejemplo: jueves a la mañana, con la última carga del miércoles. */
export const HOY_EJEMPLO: Fecha = '2026-10-15'

const D = (x: string | number) => new Decimal(x)

// ───────────── Calendario y tipos de cambio (inventados) ─────────────

/** Días hábiles con carga del 01/10 al 14/10 (el lun 12/10 fue feriado). */
const DIAS: Fecha[] = [
  '2026-10-01',
  '2026-10-02',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
  '2026-10-08',
  '2026-10-09',
  '2026-10-13',
  '2026-10-14',
]

const CCL = ['1497.30', '1503.10', '1508.90', '1512.40', '1516.80', '1519.40', '1525.00', '1531.70', '1548.20']
const CRIPTO = ['1489.50', '1496.00', '1500.20', '1505.10', '1509.00', '1512.30', '1518.60', '1526.40', '1541.00']

/** Hora local (Córdoba, UTC−3) en que se guardó cada carga, y su tiempo activo. */
const HORA = ['21:55', '21:31', '21:48', '22:02', '21:37', '21:45', '21:52', '21:55', '21:41']
const TIEMPO_ACTIVO_MS = [312_000, 52_000, 47_000, 44_000, 58_000, 39_000, 43_000, 37_000, 41_000]

// ───────────── Catálogo ─────────────

const CUENTAS: Cuenta[] = [
  { id: 1, nombre: 'IEB', tipo: 'broker', formato_carga: 'excel_ieb', activa: true },
  { id: 2, nombre: 'Galicia', tipo: 'banco', formato_carga: 'captura', activa: true },
  { id: 3, nombre: 'Mercado Pago', tipo: 'billetera', formato_carga: 'captura', activa: true },
]

const IEB = 1
const GALICIA = 2
const MP = 3

function activo(a: Partial<Activo> & Pick<Activo, 'id' | 'ticker' | 'nombre' | 'tipo' | 'moneda_riesgo' | 'color'>): Activo {
  return {
    geografia: 'AR',
    indexacion: null,
    ticker_subyacente: null,
    fecha_vencimiento: null,
    activo_bool: true,
    ...a,
  }
}

// Colores fijos por activo (mismo color en todos los gráficos, spec §UI).
const ACTIVOS: Activo[] = [
  activo({ id: 1, ticker: 'SPY', nombre: 'SPDR S&P 500 (CEDEAR)', tipo: 'cedear', moneda_riesgo: 'USD', geografia: 'US', ticker_subyacente: 'SPY', color: '#2a78d6' }),
  activo({ id: 2, ticker: 'YPFD', nombre: 'YPF', tipo: 'accion_local', moneda_riesgo: 'ARS', color: '#eb6834' }),
  activo({ id: 3, ticker: 'S13N6', nombre: 'LECAP nov-26', tipo: 'lecap', moneda_riesgo: 'ARS', indexacion: 'fija', fecha_vencimiento: '2026-11-13', color: '#1baf7a' }),
  activo({ id: 4, ticker: 'T30J7', nombre: 'BONCAP jun-27', tipo: 'bono', moneda_riesgo: 'ARS', indexacion: 'fija', fecha_vencimiento: '2027-06-30', color: '#eda100' }),
  activo({ id: 5, ticker: 'FIMA', nombre: 'FIMA Premium (FCI)', tipo: 'fci', moneda_riesgo: 'ARS', color: '#e87ba4' }),
  activo({ id: 6, ticker: 'TXMJ0', nombre: 'Dual CER/TAMAR', tipo: 'bono', moneda_riesgo: 'ARS', indexacion: 'dual_cer_tamar', fecha_vencimiento: '2027-03-31', color: '#4a3aa7' }),
]

/** Precio en pesos por unidad o por 1 VN, por día (los del 13/10 y 14/10 son los del Apéndice B). */
const PRECIOS: Record<number, string[]> = {
  1: ['33850', '33990', '34120', '34050', '34310', '34420', '34500', '34700', '35150'],
  2: ['51200', '51650', '51900', '52050', '51800', '52100', '52350', '52500', '52300'],
  3: ['1.0781', '1.0789', '1.0801', '1.0809', '1.0815', '1.0822', '1.0830', '1.0845', '1.0852'],
  4: ['1.1175', '1.1182', '1.1190', '1.1198', '1.1204', '1.1212', '1.1220', '1.1232', '1.1240'],
  5: ['4.7920', '4.7945', '4.7990', '4.8010', '4.8030', '4.8050', '4.8075', '4.8105', '4.8120'],
  6: ['1.0255', '1.0262', '1.0270', '1.0278', '1.0284', '1.0291', '1.0298', '1.0306', '1.0310'],
}
const CUENTA_DE_ACTIVO: Record<number, number> = { 1: IEB, 2: IEB, 3: GALICIA, 4: IEB, 5: GALICIA, 6: IEB }

/** Saldos de liquidez por día. IEB en pesos baja con las compras del 08/10 y el 09/10. */
const SALDO_IEB_ARS = ['9193600', '9193600', '9193600', '9193600', '9193600', '8095000', '-185000', '-185000', '-185000']
const SALDO_MP = ['4860000', '4863650', '4874600', '4878250', '4881900', '4885560', '4889220', '4908600', '4912300']

// ───────────── Cargas: una por fuente y por día, agrupadas en un lote ─────────────

const idCarga = (dia: number, fuente: 'tc' | 'ieb' | 'galicia' | 'mp') =>
  dia * 4 + { tc: 1, ieb: 2, galicia: 3, mp: 4 }[fuente]
const PREFIJO_LOTE = ['3f9a1c2e', '8b2d4f61', 'c41e9a07', '5d7b3e92', 'a2f68c14', 'e9c3417b', '17d5b8e3', '6b0e2fa9', 'd38a7c56']
const lote = (dia: number) => `${PREFIJO_LOTE[dia]}-5d4b-4c1e-9a8b-0000000000${String(dia + 1).padStart(2, '0')}`
const creadoEn = (dia: number, demoraMin = 0) => {
  const [h, m] = HORA[dia].split(':').map(Number)
  const t = new Date(`${DIAS[dia]}T00:00:00Z`)
  t.setUTCHours(h, m - demoraMin)
  return t.toISOString()
}

function cargasVigentes(): CargaResumen[] {
  const out: CargaResumen[] = []
  DIAS.forEach((fecha, k) => {
    const base = { lote: lote(k), fecha, estado: 'vigente' as const, creado_en: creadoEn(k), reemplaza_a: null }
    out.push({ ...base, id: idCarga(k, 'tc'), cuenta_id: null, origen: 'manual', archivo_path: null, lector: null, tiempo_activo_ms: TIEMPO_ACTIVO_MS[k] })
    out.push({ ...base, id: idCarga(k, 'ieb'), cuenta_id: IEB, origen: 'excel', archivo_path: `cargas/${fecha}/ieb-patrimonio.xlsx`, lector: 'excel-ieb 1.0', tiempo_activo_ms: TIEMPO_ACTIVO_MS[k], reemplaza_a: k === 5 ? 38 : null })
    out.push({ ...base, id: idCarga(k, 'galicia'), cuenta_id: GALICIA, origen: 'captura', archivo_path: `cargas/${fecha}/galicia.png`, lector: 'capturas 1.0 · dos lecturas', tiempo_activo_ms: TIEMPO_ACTIVO_MS[k] })
    out.push({ ...base, id: idCarga(k, 'mp'), cuenta_id: MP, origen: 'captura', archivo_path: `cargas/${fecha}/mercadopago.png`, lector: 'capturas 1.0 · dos modelos', tiempo_activo_ms: TIEMPO_ACTIVO_MS[k] })
  })
  return out
}

// ───────────── Operaciones ─────────────

let siguienteOp = 1
function op(o: Partial<Operacion> & Pick<Operacion, 'fecha' | 'cuenta_id' | 'activo_id' | 'tipo' | 'cantidad' | 'carga_id'>): Operacion {
  return {
    id: siguienteOp++,
    fecha_origen: null,
    moneda: 'ARS',
    precio: null,
    importe: null,
    comisiones: CERO,
    ccl_del_dia: null,
    notas: null,
    ...o,
  }
}

function operaciones(): Operacion[] {
  siguienteOp = 1
  const c0ieb = idCarga(0, 'ieb')
  const c0gal = idCarga(0, 'galicia')
  return [
    // Aperturas del día cero, con el PPP del bróker como costo (D-14). El CCL de
    // compra solo está donde lo declaraste.
    op({ fecha: '2026-10-01', fecha_origen: '2026-03-03', cuenta_id: IEB, activo_id: 1, tipo: 'apertura', cantidad: D(1000), precio: D(29100), ccl_del_dia: D('1390.00'), carga_id: c0ieb }),
    op({ fecha: '2026-10-01', cuenta_id: IEB, activo_id: 2, tipo: 'apertura', cantidad: D(300), precio: D(48200), carga_id: c0ieb }),
    op({ fecha: '2026-10-01', fecha_origen: '2026-08-19', cuenta_id: GALICIA, activo_id: 3, tipo: 'apertura', cantidad: D(11_500_000), precio: D('1.0426'), ccl_del_dia: D('1502.00'), carga_id: c0gal }),
    op({ fecha: '2026-10-01', fecha_origen: '2026-07-14', cuenta_id: IEB, activo_id: 4, tipo: 'apertura', cantidad: D(8_000_000), precio: D('1.097475'), ccl_del_dia: D('1452.00'), carga_id: c0ieb }),
    op({ fecha: '2026-10-01', cuenta_id: GALICIA, activo_id: 5, tipo: 'apertura', cantidad: D(1_250_000), precio: D('4.62'), carga_id: c0gal }),
    op({ fecha: '2026-10-01', cuenta_id: IEB, activo_id: 6, tipo: 'apertura', cantidad: D(5_000_000), precio: D('1.005'), carga_id: c0ieb }),
    // Compras de octubre, cada una con el CCL de su día.
    op({ fecha: '2026-10-08', cuenta_id: IEB, activo_id: 4, tipo: 'compra', cantidad: D(1_000_000), precio: D('1.0986'), ccl_del_dia: D('1519.40'), carga_id: idCarga(5, 'ieb'), notas: 'Precio inferido del cambio de PPP (D-19).' }),
    op({ fecha: '2026-10-09', cuenta_id: IEB, activo_id: 1, tipo: 'compra', cantidad: D(240), precio: D(34500), ccl_del_dia: D('1525.00'), carga_id: idCarga(6, 'ieb') }),
  ]
}

// ───────────── Bienes y deuda ─────────────

const PASIVOS: Pasivo[] = [
  { id: 1, nombre: 'Leasing de la camioneta', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-08-17', cuotas_totales: 48, opcion_compra_fecha: '2029-08-17' },
]
const PASIVO_SALDOS: PasivoSaldo[] = [{ pasivo_id: 1, fecha: '2026-09-30', capital_pendiente: D(21_400_000), carga_id: idCarga(0, 'tc') }]
const BIENES: Bien[] = [
  { id: 1, nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null, activo_bool: true },
  { id: 2, nombre: 'Camioneta', tipo: 'vehiculo', moneda_valuacion: 'ARS', geografia: 'AR', pasivo_id: 1, activo_bool: true },
]
const VALUACIONES: BienValuacion[] = [
  { bien_id: 1, fecha: '2025-09-15', valor: D(200_000), fuente: 'tasación de una inmobiliaria', carga_id: idCarga(0, 'tc') },
  { bien_id: 2, fecha: '2026-03-16', valor: D(38_000_000), fuente: 'cotización de concesionaria', carga_id: idCarga(0, 'tc') },
]

// ───────────── Los hechos ─────────────

/** Los hechos inventados del ejemplo (Apéndice B), cargados del 01/10 al 14/10. */
export function hechosEjemplo(): Hechos {
  const tipos_cambio: TipoCambio[] = DIAS.map((fecha, k) => ({
    fecha,
    ccl: D(CCL[k]),
    mep: null,
    cripto_venta: D(CRIPTO[k]),
    oficial: null,
    carga_id: idCarga(k, 'tc'),
  }))
  const cotizaciones: Cotizacion[] = []
  for (const a of ACTIVOS) {
    DIAS.forEach((fecha, k) => {
      cotizaciones.push({
        fecha,
        activo_id: a.id,
        precio_pesos: D(PRECIOS[a.id][k]),
        precio_usd_subyacente: null,
        carga_id: idCarga(k, CUENTA_DE_ACTIVO[a.id] === IEB ? 'ieb' : 'galicia'),
      })
    })
  }
  const saldos: Saldo[] = []
  DIAS.forEach((fecha, k) => {
    saldos.push({ fecha, cuenta_id: IEB, moneda: 'USD', monto: D(4200), carga_id: idCarga(k, 'ieb') })
    saldos.push({ fecha, cuenta_id: IEB, moneda: 'ARS', monto: D(SALDO_IEB_ARS[k]), carga_id: idCarga(k, 'ieb') })
    saldos.push({ fecha, cuenta_id: MP, moneda: 'ARS', monto: D(SALDO_MP[k]), carga_id: idCarga(k, 'mp') })
  })
  return {
    cuentas: CUENTAS,
    activos: ACTIVOS,
    operaciones: operaciones(),
    cotizaciones,
    tipos_cambio,
    saldos,
    movimientos: [],
    pasivos: PASIVOS,
    pasivo_saldos: PASIVO_SALDOS,
    bienes: BIENES,
    valuaciones: VALUACIONES,
    feriados: [{ mercado: 'AR', fecha: '2026-10-12', descripcion: 'Día del Respeto a la Diversidad Cultural' }],
    cargas: cargasVigentes(),
  }
}

/** Hechos de una app recién instalada: cuentas creadas, ninguna carga (Día cero). */
export function hechosVacios(): Hechos {
  return {
    cuentas: CUENTAS,
    activos: [],
    operaciones: [],
    cotizaciones: [],
    tipos_cambio: [],
    saldos: [],
    movimientos: [],
    pasivos: [],
    pasivo_saldos: [],
    bienes: [],
    valuaciones: [],
    feriados: [],
    cargas: [],
  }
}

// ───────────── Las vistas ─────────────

export function ejemploHoy(): VistaHoy {
  return armarHoy(hechosEjemplo(), HOY_EJEMPLO)
}

/** Hoy antes de la primera carga: el estado "Día cero". */
export function ejemploHoyVacio(): VistaHoy {
  return armarHoy(hechosVacios(), HOY_EJEMPLO)
}

export function ejemploCartera(): VistaCartera {
  return armarCartera(hechosEjemplo(), HOY_EJEMPLO)
}

/**
 * Variantes del modo demo para revisar estados que el set base no muestra
 * (solo con PORTFOLIO_DEMO=1, por ?demo=…):
 * - express: el jue 15/10 cargaste solo CCL (1.560,00) y cripto: todo el cambio
 *   queda "sin atribuir" (visión §4.2, Apéndice B).
 * - viejo: abrís la app el mié 21/10 sin haber cargado desde el 14/10: los
 *   precios y saldos están viejos (D-16) y Atención lo dice.
 */
export type VarianteDemo = 'vacio' | 'express' | 'viejo'

export function varianteDemo(v: unknown): VarianteDemo | null {
  return v === 'vacio' || v === 'express' || v === 'viejo' ? v : null
}

function hechosExpress(): Hechos {
  const h = hechosEjemplo()
  const id = 40
  h.tipos_cambio.push({ fecha: '2026-10-15', ccl: D('1560.00'), mep: null, cripto_venta: D('1553.40'), oficial: null, carga_id: id })
  h.cargas.push({ id, lote: 'f1e2d3c4-5d4b-4c1e-9a8b-000000000010', fecha: '2026-10-15', cuenta_id: null, origen: 'manual', archivo_path: null, estado: 'vigente', creado_en: '2026-10-15T21:20:00.000Z', reemplaza_a: null, lector: null, tiempo_activo_ms: 9_000 })
  return h
}

export function ejemploHoyVariante(v: VarianteDemo): VistaHoy {
  if (v === 'vacio') return ejemploHoyVacio()
  if (v === 'express') return armarHoy(hechosExpress(), '2026-10-16')
  return armarHoy(hechosEjemplo(), '2026-10-21')
}

export function ejemploCarteraVariante(v: VarianteDemo): VistaCartera {
  if (v === 'vacio') return armarCartera(hechosVacios(), HOY_EJEMPLO)
  if (v === 'express') return armarCartera(hechosExpress(), '2026-10-16')
  return armarCartera(hechosEjemplo(), '2026-10-21')
}

export function ejemploExposicion(modo: 'financiero' | 'total'): VistaExposicion {
  const h = hechosEjemplo()
  const v = armarExposicion(h, HOY_EJEMPLO, modo)
  if (modo === 'financiero') return v
  return totalSinMonedaDeRiesgo(v, armarExposicion(h, HOY_EJEMPLO, 'financiero'))
}

/**
 * Vista Total del ejemplo (D-65, D-73 de la visión): la casa y la camioneta
 * todavía no tienen moneda de riesgo elegida, así que el neto total es "sin
 * dato", con la suma parcial sin ellas a la vista, y en la composición por
 * moneda los bienes van como "sin elegir" en lugar de asumir la moneda en que
 * están valuados.
 */
function totalSinMonedaDeRiesgo(v: VistaExposicion, fin: VistaExposicion): VistaExposicion {
  const netoFin = fin.resumen.neto_ars
  const parcial = netoFin.valor === null ? 'sin dato' : monto(netoFin.valor, 'ARS', { decimales: 2 })
  const motivo = `A la casa y a la camioneta les falta la moneda de riesgo (la elegís vos en Datos, la app no la asume). Suma parcial sin ellas: largo ${parcial}.`
  const insumosNeto = [
    { nombre: 'Pesos financieros − deuda del leasing (suma parcial)', valor: netoFin.valor, unidad: 'ARS' as const, calc: netoFin },
    { nombre: 'Casa · moneda de riesgo', valor: null, unidad: 'texto' as const },
    { nombre: 'Camioneta · moneda de riesgo', valor: null, unidad: 'texto' as const },
  ]
  const sinDatoVista = (m: string, explicacion: string): CalcVista => ({
    valor: null,
    motivo: m,
    formula: 'sin dato',
    explicacion,
    insumos: insumosNeto,
    etiquetas: ['parcial'],
  })
  const neto_ars = sinDatoVista(motivo, 'Tu exposición neta al peso contando tus bienes, cada uno en la moneda de riesgo que le elijas.')
  const neto_usd = sinDatoVista(motivo, 'El neto total pasado a dólares al CCL de la carga.')

  // Composición por moneda de riesgo: los bienes, "sin elegir".
  const bienes = v.por_clase.filter((s) => s.clave === 'inmueble' || s.clave === 'vehiculo')
  const financieros = fin.por_moneda
  const sumaArs = (ss: Segmento[]) => ss.reduce((a, s) => a.plus(s.valor.ars.valor ?? 0), CERO)
  const sumaUsd = (ss: Segmento[]) => ss.reduce((a, s) => a.plus(s.valor.usd.valor ?? 0), CERO)
  const total = sumaArs(financieros).plus(sumaArs(bienes))
  const peso = (ars: Decimal, nombre: string): CalcVista =>
    vista(
      calc(ars.div(total), `${monto(ars, 'ARS')} ÷ ${monto(total, 'ARS')} = ${porcentaje(ars.div(total))}`, [
        { nombre, valor: ars.toFixed(), unidad: 'ARS' },
        { nombre: 'Activos de la vista Total (sin restar deudas)', valor: total.toFixed(), unidad: 'ARS' },
      ], { explicacion: 'Qué parte de la vista representa este grupo.' }),
    )
  const conPeso = (s: Segmento): Segmento => ({ ...s, peso: peso(D(s.valor.ars.valor ?? 0), s.nombre) })
  const arsBienes = sumaArs(bienes)
  const usdBienes = sumaUsd(bienes)
  const sinElegir: Segmento = {
    clave: 'sin_elegir',
    nombre: 'Sin elegir',
    color: '#9aa1ac',
    valor: {
      ars: vista(sumaPartes(bienes, 'ARS', arsBienes)),
      usd: vista(sumaPartes(bienes, 'USD', usdBienes)),
    },
    peso: peso(arsBienes, 'Bienes sin moneda de riesgo'),
  }
  // Sin moneda de riesgo elegida, los bienes no suman ni a los pesos ni a los
  // dólares: el largo y los activos en dólares son los del financiero.
  return {
    ...v,
    activos_en_pesos: fin.activos_en_pesos,
    activos_en_dolares: fin.activos_en_dolares,
    // La concentración se mide sobre el financiero (D-03): la casa no es una posición.
    concentracion: fin.concentracion,
    resumen: {
      ...v.resumen,
      pesos_financieros: fin.resumen.pesos_financieros,
      neto_ars,
      neto_usd,
      sensibilidad_usd_1pct: vista(sinDato('Sin el neto total no hay sensibilidad.', [deCalc('Neto total', { valor: null, motivo, formula: 'sin dato', insumos: [], etiquetas: ['parcial'] }, 'ARS')], { etiquetas: ['parcial'] })),
    },
    neto_pct: sinDatoVista(motivo, 'Tu exposición neta al peso como parte de tus activos.'),
    por_moneda: [...financieros.map(conPeso), sinElegir],
  }
}

function sumaPartes(ss: Segmento[], moneda: 'ARS' | 'USD', total: Decimal): Calc {
  const partes = ss.map((s) => (moneda === 'ARS' ? s.valor.ars.valor : s.valor.usd.valor) ?? '0')
  return calc(total, `${partes.map((p) => monto(p, moneda, { decimales: 2 })).join(' + ')} = ${monto(total, moneda, { decimales: 2 })}`, ss.map((s) => ({
    nombre: s.nombre,
    valor: (moneda === 'ARS' ? s.valor.ars.valor : s.valor.usd.valor) ?? null,
    unidad: moneda,
  })), { explicacion: 'Los bienes a los que todavía no les elegiste moneda de riesgo.' })
}

// ───────────── Registro ─────────────

export function ejemploRegistro(): VistaRegistro {
  const h = hechosEjemplo()
  const nombre = new Map(CUENTAS.map((c) => [c.id, c.nombre]))
  const contar = (xs: { carga_id: number }[]) => {
    const m = new Map<number, number>()
    for (const x of xs) m.set(x.carga_id, (m.get(x.carga_id) ?? 0) + 1)
    return m
  }
  const nCot = contar(h.cotizaciones)
  const nSal = contar(h.saldos)
  const nOps = contar(h.operaciones)
  const filas: FilaRegistro[] = h.cargas.map((c) => ({
    carga_id: c.id,
    lote: c.lote,
    fecha: c.fecha,
    creado_en: c.creado_en,
    cuenta: c.cuenta_id === null ? 'Tipo de cambio' : (nombre.get(c.cuenta_id) ?? `cuenta ${c.cuenta_id}`),
    origen: c.origen,
    estado: c.estado,
    archivo_path: c.archivo_path,
    lector: c.lector,
    cotizaciones: nCot.get(c.id) ?? 0,
    saldos: nSal.get(c.id) ?? 0,
    operaciones: nOps.get(c.id) ?? 0,
    tiempo_activo_ms: c.tiempo_activo_ms,
  }))
  // Una lectura de MP revertida el 07/10 ("lectura equivocada") y un Excel de
  // IEB del 08/10 reemplazado por uno corregido: siguen en el Registro.
  filas.push({
    carga_id: 37,
    lote: lote(4),
    fecha: '2026-10-07',
    creado_en: creadoEn(4, 6),
    cuenta: 'Mercado Pago',
    origen: 'captura',
    estado: 'revertida',
    archivo_path: 'cargas/2026-10-07/mercadopago-1.png',
    lector: 'capturas 1.0 · dos modelos',
    cotizaciones: 0,
    saldos: 1,
    operaciones: 0,
    tiempo_activo_ms: TIEMPO_ACTIVO_MS[4],
  })
  filas.push({
    carga_id: 38,
    lote: '0c7e5b21-5d4b-4c1e-9a8b-000000000099',
    fecha: '2026-10-08',
    creado_en: creadoEn(5, 25),
    cuenta: 'IEB',
    origen: 'excel',
    estado: 'reemplazada',
    archivo_path: 'cargas/2026-10-08/ieb-patrimonio-v1.xlsx',
    lector: 'excel-ieb 1.0',
    cotizaciones: 4,
    saldos: 2,
    operaciones: 0,
    tiempo_activo_ms: 21_000,
  })
  filas.sort((a, b) => (a.creado_en < b.creado_en ? 1 : a.creado_en > b.creado_en ? -1 : a.carga_id - b.carga_id))
  return { filas }
}
