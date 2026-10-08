// La foto del patrimonio a una fecha: cada posición, saldo, bien y deuda
// valuados en ARS y en USD con el último dato conocido a esa fecha, marcado
// como viejo si tiene más de 2 días hábiles (D-16, CO-5).
//
// Valor de un título = cantidad × precio en pesos por 1 VN / 1 unidad (D-12,
// D-18). Valor en USD = valor en pesos ÷ CCL del día de la foto.
// Saldo en USD: monto × CCL en pesos. Bien en USD: valuación × CCL.

import { calc, deCalc, sinDato, type Calc, type Etiqueta, type Insumo } from './calc'
import { CERO, Decimal, monto, numero } from './dinero'
import { conjuntoFeriados, esViejo, fechaCorta } from './fechas'
import { tenencias, type Tenencia } from './posiciones'
import type {
  Activo,
  Ausente,
  Bien,
  BienValuacion,
  Cotizacion,
  Cuenta,
  Fecha,
  Geografia,
  Hechos,
  Moneda,
  Pasivo,
  PasivoSaldo,
  Saldo,
  TipoActivo,
  TipoCambio,
} from './tipos'

export type ClaseItem = 'posicion' | 'saldo' | 'bien' | 'pasivo'

export interface ItemFoto {
  clave: string
  clase: ClaseItem
  nombre: string
  ticker: string
  cuenta: Cuenta | null
  activo: Activo | null
  tipo: TipoActivo | 'liquidez' | 'inmueble' | 'vehiculo' | 'otro' | 'deuda'
  moneda_riesgo: Moneda
  geografia: Geografia
  color: string
  tenencia: Tenencia | null
  cantidad: Decimal | null
  /** Precio por unidad en pesos (posiciones), o el monto (saldos/bienes/deudas). */
  precio: Calc
  fecha_dato: Fecha | null
  carga_dato: number | null
  viejo: boolean
  /** Positivo para activos, negativo para deudas. */
  valor_ars: Calc
  valor_usd: Calc
  /**
   * Posición que la fuente de su cuenta ya no lista desde `fecha` (venta total
   * o vencimiento sin registrar): vale "sin dato" con `motivo` (ver Ausente).
   */
  ausente?: { fecha: Fecha; carga_id: number; motivo: string } | null
}

export interface Foto {
  fecha: Fecha
  ccl: Calc
  fecha_ccl: Fecha | null
  items: ItemFoto[]
}

// ───────────── Índices: último dato a una fecha ─────────────

function ultimoA<T extends { fecha: Fecha }>(xs: readonly T[], fecha: Fecha): T | null {
  // xs ordenado por fecha ascendente
  let r: T | null = null
  for (const x of xs) {
    if (x.fecha <= fecha) r = x
    else break
  }
  return r
}

function agrupar<T>(xs: readonly T[], k: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const c = k(x)
    const l = m.get(c)
    if (l) l.push(x)
    else m.set(c, [x])
  }
  for (const l of m.values()) l.sort((a, b) => ((a as { fecha: Fecha }).fecha < (b as { fecha: Fecha }).fecha ? -1 : 1))
  return m
}

export interface Indices {
  cotizaciones: Map<string, Cotizacion[]>
  saldos: Map<string, Saldo[]>
  valuaciones: Map<string, BienValuacion[]>
  pasivoSaldos: Map<string, PasivoSaldo[]>
  tipos: TipoCambio[]
  feriados: Set<Fecha>
  activos: Map<number, Activo>
  cuentas: Map<number, Cuenta>
  /** Ausentes por `${cuenta_id}:${activo_id}`, por fecha ascendente. */
  ausentes: Map<string, Ausente[]>
}

export function indexar(h: Hechos): Indices {
  return {
    cotizaciones: agrupar(h.cotizaciones, (c) => String(c.activo_id)),
    saldos: agrupar(h.saldos, (s) => `${s.cuenta_id}:${s.moneda}`),
    valuaciones: agrupar(h.valuaciones, (v) => String(v.bien_id)),
    pasivoSaldos: agrupar(h.pasivo_saldos, (p) => String(p.pasivo_id)),
    tipos: [...h.tipos_cambio].filter((t) => t.ccl !== null).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    feriados: conjuntoFeriados(h.feriados, 'AR'),
    activos: new Map(h.activos.map((a) => [a.id, a])),
    cuentas: new Map(h.cuentas.map((c) => [c.id, c])),
    ausentes: agrupar(h.ausentes ?? [], (a) => `${a.cuenta_id}:${a.activo_id}`),
  }
}

/**
 * La ausencia que rige a una fecha: la primera declarada en o antes de esa
 * fecha (la fuente no la lista desde entonces). Antes de esa fecha la tenencia
 * se valúa como siempre.
 */
export function ausenteA(ix: Indices, cuenta_id: number, activo_id: number, fecha: Fecha): Ausente | null {
  return (ix.ausentes.get(`${cuenta_id}:${activo_id}`) ?? []).find((a) => a.fecha <= fecha) ?? null
}

/** "IEB ya no la lista desde el mar 06/10: registrá la venta o el vencimiento en Cargar." */
export function motivoAusente(cuenta: Cuenta | null, a: Ausente): string {
  return `${cuenta?.nombre ?? 'Tu cuenta'} ya no la lista desde el ${fechaCorta(a.fecha)}: registrá la venta o el vencimiento en Cargar.`
}

/** CCL vigente a una fecha (el último cargado en o antes de esa fecha). */
export function cclA(ix: Indices, fecha: Fecha, hoy: Fecha = fecha): { calc: Calc; fecha: Fecha | null } {
  const t = ultimoA(ix.tipos, fecha)
  if (!t || t.ccl === null) {
    return {
      calc: sinDato('No hay un CCL cargado en o antes de esta fecha.', [], {
        explicacion: 'El dólar contado con liquidación que cargás cada día.',
      }),
      fecha: null,
    }
  }
  const etiquetas: Etiqueta[] = esViejo(t.fecha, hoy, ix.feriados) ? ['viejo'] : []
  // Sin CCL tipeado ese día se usa el último conocido, como con los precios
  // (decisión B de la fase 1a): la traza muestra su fecha y lleva "viejo" con
  // la misma regla de 2 días hábiles (D-16). La atribución no lo usa (D-35).
  const arrastrado = t.fecha !== fecha
  return {
    calc: calc(
      t.ccl,
      arrastrado
        ? `CCL del ${fechaCorta(t.fecha)} = ${numero(t.ccl, 2)} (el ${fechaCorta(fecha)} no tiene CCL: se usa el último tipeado)`
        : `CCL del ${fechaCorta(t.fecha)} = ${numero(t.ccl, 2)}`,
      [{ nombre: `CCL del ${fechaCorta(t.fecha)}`, valor: t.ccl.toFixed(), unidad: 'ratio', origen: { carga_id: t.carga_id } }],
      {
        etiquetas,
        explicacion: arrastrado
          ? 'El último dólar contado con liquidación que tipeaste. Ese día no cargaste CCL: convierte con el último conocido, como un precio de ayer.'
          : 'El dólar contado con liquidación que tipeaste ese día. Convierte pesos a dólares.',
      },
    ),
    fecha: t.fecha,
  }
}

const COLORES = [
  '#2f5bd3', '#0f8b8d', '#c2621f', '#7a4fc9', '#3b8f3e', '#b8336a', '#8a6d1f', '#4a6fa5',
  '#d1495b', '#2e7d6b', '#9c6644', '#5d5fef',
]

function colorDe(id: number, propio: string | null): string {
  return propio ?? COLORES[id % COLORES.length]
}

function convertir(
  valorArs: Calc,
  valorUsd: Calc,
): { ars: Calc; usd: Calc } {
  return { ars: valorArs, usd: valorUsd }
}

// ───────────── La foto ─────────────

// Las fotos internas de la atribución (variacion.ts) solo necesitan valores:
// sin traza no se arman fórmulas ni insumos, que es lo que más cuesta con un
// año de cargas diarias. foto() es sincrónica, así que la bandera no se cruza.
let conTraza = true

function trazado(valor: Decimal, formula: () => string, insumos: () => Insumo[], opciones: { etiquetas?: Etiqueta[]; explicacion?: string }): Calc {
  if (conTraza) return calc(valor, formula(), insumos(), opciones)
  return { valor, formula: '', insumos: [], etiquetas: opciones.etiquetas ?? [] }
}

export function foto(h: Hechos, fecha: Fecha, opciones: { hoy?: Fecha; ix?: Indices; traza?: boolean } = {}): Foto {
  const previo = conTraza
  conTraza = opciones.traza ?? true
  try {
    return armarFoto(h, fecha, opciones)
  } finally {
    conTraza = previo
  }
}

function armarFoto(h: Hechos, fecha: Fecha, opciones: { hoy?: Fecha; ix?: Indices }): Foto {
  const ix = opciones.ix ?? indexar(h)
  const hoy = opciones.hoy ?? fecha
  const { calc: ccl, fecha: fechaCcl } = cclA(ix, fecha, hoy)
  const items: ItemFoto[] = []
  const insCcl = deCalc('CCL', ccl, 'ratio')

  // Posiciones
  for (const t of tenencias(h.operaciones, fecha).values()) {
    const activo = ix.activos.get(t.activo_id) ?? null
    const cuenta = ix.cuentas.get(t.cuenta_id) ?? null
    if (!activo) continue
    const cotUlt = ultimoA(ix.cotizaciones.get(String(t.activo_id)) ?? [], fecha)
    // B07: un precio anterior a un cambio de ratio no sirve para la cantidad nueva.
    const ratio = t.operaciones.filter((o) => o.tipo === 'ajuste_ratio' && o.fecha <= fecha).map((o) => o.fecha).sort().at(-1) ?? null
    const cot = cotUlt && ratio && cotUlt.fecha < ratio ? null : cotUlt
    const viejo = cot ? esViejo(cot.fecha, hoy, ix.feriados) : false
    const etiq: Etiqueta[] = viejo ? ['viejo'] : []
    const insCant: Insumo = { nombre: `Cantidad de ${activo.ticker}`, valor: t.cantidad.toFixed(), unidad: 'cantidad' }
    const dp = cot ? Math.max(2, cot.precio_pesos.decimalPlaces()) : 2
    const motivoSinPrecio =
      cotUlt && !cot
        ? `El último precio de ${activo.ticker} (${fechaCorta(cotUlt.fecha)}) es anterior al cambio de ratio del ${fechaCorta(ratio!)}: hace falta un precio nuevo.`
        : `No hay un precio cargado de ${activo.ticker} en o antes del ${fechaCorta(fecha)}.`
    const precio: Calc = cot
      ? trazado(
          cot.precio_pesos,
          () => `Precio del ${fechaCorta(cot.fecha)} = ${monto(cot.precio_pesos, 'ARS', { decimales: dp })} por ${activo.tipo === 'bono' || activo.tipo === 'lecap' ? '1 VN' : 'unidad'}`,
          () => [{ nombre: `Precio de ${activo.ticker}`, valor: cot.precio_pesos.toFixed(), unidad: 'ARS', origen: { carga_id: cot.carga_id } }],
          { etiquetas: etiq, explicacion: 'El último precio que cargaste para este título.' },
        )
      : sinDato(motivoSinPrecio)
    // La fuente de la cuenta ya no la lista y la venta (o el vencimiento) no
    // está registrada: valuarla al último precio la contaría dos veces (la
    // plata de la venta ya está en el saldo). Vale "sin dato" hasta que se
    // registre, y todo total que la incluya muestra la suma parcial (D-65).
    const aus = ausenteA(ix, t.cuenta_id, t.activo_id, fecha)
    const motivoAus = aus ? motivoAusente(cuenta, aus) : null
    const valorArs: Calc =
      aus && motivoAus
        ? sinDato(
            motivoAus,
            [
              insCant,
              deCalc('Último precio cargado', precio, 'ARS'),
              { nombre: `${cuenta?.nombre ?? 'La cuenta'} no trae ${activo.ticker} desde el`, valor: aus.fecha, unidad: 'fecha', origen: { carga_id: aus.carga_id } },
            ],
            {
              etiquetas: ['pendiente'],
              explicacion: `La última carga de ${cuenta?.nombre ?? 'la cuenta'} ya no trae ${activo.ticker} y dejaste la fila pendiente. Si la vendiste o venció, la plata ya está en tu saldo: valuarla además al último precio la contaría dos veces.`,
            },
          )
        : cot === null
        ? sinDato(cotUlt ? motivoSinPrecio : `Falta el precio de ${activo.ticker}.`, [insCant])
        : trazado(
            t.cantidad.times(cot.precio_pesos),
            () => `${numero(t.cantidad, 4, { min: 0 })} × ${monto(cot.precio_pesos, 'ARS', { decimales: dp })} = ${monto(t.cantidad.times(cot.precio_pesos), 'ARS', { decimales: 2 })}`,
            () => [insCant, deCalc('Precio', precio, 'ARS')],
            { explicacion: `Lo que valen tus ${activo.ticker} en pesos al último precio cargado.` },
          )
    const valorUsd = aUsd(valorArs, ccl, insCcl, `Lo que valen tus ${activo.ticker} si los pasás a dólares al CCL de la foto.`)
    items.push({
      clave: `p:${t.cuenta_id}:${t.activo_id}`,
      clase: 'posicion',
      nombre: activo.nombre,
      ticker: activo.ticker,
      cuenta,
      activo,
      tipo: activo.tipo,
      moneda_riesgo: activo.moneda_riesgo,
      geografia: activo.geografia,
      color: colorDe(activo.id, activo.color),
      tenencia: t,
      cantidad: t.cantidad,
      precio,
      fecha_dato: cot?.fecha ?? null,
      carga_dato: cot?.carga_id ?? null,
      viejo,
      valor_ars: valorArs,
      valor_usd: valorUsd,
      ausente: aus && motivoAus ? { fecha: aus.fecha, carga_id: aus.carga_id, motivo: motivoAus } : null,
    })
  }

  // Saldos de liquidez (último por cuenta y moneda)
  for (const [k, lista] of ix.saldos) {
    const s = ultimoA(lista, fecha)
    if (!s) continue
    const [cid, moneda] = k.split(':') as [string, Moneda]
    const cuenta = ix.cuentas.get(Number(cid)) ?? null
    const viejo = esViejo(s.fecha, hoy, ix.feriados)
    const etiq: Etiqueta[] = viejo ? ['viejo'] : []
    const ins: Insumo = {
      nombre: `Saldo ${moneda} de ${cuenta?.nombre ?? 'cuenta'} del ${fechaCorta(s.fecha)}`,
      valor: s.monto.toFixed(),
      unidad: moneda,
      origen: { carga_id: s.carga_id },
    }
    const base = trazado(s.monto, () => `Saldo del ${fechaCorta(s.fecha)} = ${monto(s.monto, moneda, { decimales: 2 })}`, () => [ins], {
      etiquetas: etiq,
      explicacion: 'El último saldo que cargaste de esta cuenta.',
    })
    const par =
      moneda === 'ARS'
        ? convertir(base, aUsd(base, ccl, insCcl, 'Tus pesos pasados a dólares al CCL de la foto.'))
        : convertir(aArs(base, ccl, insCcl, 'Tus dólares pasados a pesos al CCL de la foto.'), base)
    items.push({
      clave: `s:${cid}:${moneda}`,
      clase: 'saldo',
      nombre: `${moneda === 'ARS' ? 'Pesos' : 'Dólares'} en ${cuenta?.nombre ?? 'cuenta'}`,
      ticker: moneda === 'ARS' ? 'ARS' : 'USD',
      cuenta,
      activo: null,
      tipo: 'liquidez',
      moneda_riesgo: moneda,
      geografia: 'AR',
      color: moneda === 'ARS' ? '#6b7a90' : '#3d6fb6',
      tenencia: null,
      cantidad: null,
      precio: base,
      fecha_dato: s.fecha,
      carga_dato: s.carga_id,
      viejo,
      valor_ars: par.ars,
      valor_usd: par.usd,
    })
  }

  // Bienes
  for (const b of h.bienes.filter((x) => x.activo_bool)) {
    const v = ultimoA(ix.valuaciones.get(String(b.id)) ?? [], fecha)
    items.push(itemBien(b, v, ccl, insCcl))
  }

  // Pasivos (capital pendiente informado), con signo negativo
  for (const p of h.pasivos) {
    const s = ultimoA(ix.pasivoSaldos.get(String(p.id)) ?? [], fecha)
    items.push(itemPasivo(p, s, ccl, insCcl, hoy, ix))
  }

  return { fecha, ccl, fecha_ccl: fechaCcl, items }
}

function aUsd(ars: Calc, ccl: Calc, insCcl: Insumo, explicacion: string): Calc {
  if (ars.valor === null) return sinDato(ars.motivo ?? 'Falta el valor en pesos.', [deCalc('Valor en pesos', ars, 'ARS')], { explicacion })
  if (ccl.valor === null) return sinDato('Falta el CCL para pasar a dólares.', [deCalc('Valor en pesos', ars, 'ARS'), insCcl], { explicacion })
  const v = ars.valor.div(ccl.valor)
  return trazado(
    v,
    () => `${monto(ars.valor as Decimal, 'ARS', { decimales: 2 })} ÷ CCL ${numero(ccl.valor as Decimal, 2)} = ${monto(v, 'USD', { decimales: 2 })}`,
    () => [deCalc('Valor en pesos', ars, 'ARS'), insCcl],
    { explicacion },
  )
}

function aArs(usd: Calc, ccl: Calc, insCcl: Insumo, explicacion: string): Calc {
  if (usd.valor === null) return sinDato(usd.motivo ?? 'Falta el valor en dólares.', [deCalc('Valor en dólares', usd, 'USD')], { explicacion })
  if (ccl.valor === null) return sinDato('Falta el CCL para pasar a pesos.', [deCalc('Valor en dólares', usd, 'USD'), insCcl], { explicacion })
  const v = usd.valor.times(ccl.valor)
  return trazado(
    v,
    () => `${monto(usd.valor as Decimal, 'USD', { decimales: 2 })} × CCL ${numero(ccl.valor as Decimal, 2)} = ${monto(v, 'ARS', { decimales: 2 })}`,
    () => [deCalc('Valor en dólares', usd, 'USD'), insCcl],
    { explicacion },
  )
}

function itemBien(b: Bien, v: BienValuacion | null, ccl: Calc, insCcl: Insumo): ItemFoto {
  const base: Calc = v
    ? trazado(v.valor, () => `Valuación del ${fechaCorta(v.fecha)} (${v.fuente}) = ${monto(v.valor, b.moneda_valuacion, { decimales: 0 })}`, () => [
        { nombre: `Valuación de ${b.nombre}`, valor: v.valor.toFixed(), unidad: b.moneda_valuacion, origen: { carga_id: v.carga_id, lugar: v.fuente } },
      ], { explicacion: 'La última valuación que cargaste. La app no estima valores de bienes (D-04).' })
    : sinDato(`No cargaste una valuación de ${b.nombre}.`)
  const par =
    b.moneda_valuacion === 'USD'
      ? { ars: aArs(base, ccl, insCcl, `${b.nombre} en pesos al CCL de la foto.`), usd: base }
      : { ars: base, usd: aUsd(base, ccl, insCcl, `${b.nombre} en dólares al CCL de la foto.`) }
  return {
    clave: `b:${b.id}`,
    clase: 'bien',
    nombre: b.nombre,
    ticker: b.nombre,
    cuenta: null,
    activo: null,
    tipo: b.tipo,
    moneda_riesgo: b.moneda_valuacion,
    geografia: b.geografia,
    color: '#8a8f98',
    tenencia: null,
    cantidad: null,
    precio: base,
    fecha_dato: v?.fecha ?? null,
    carga_dato: v?.carga_id ?? null,
    viejo: false,
    valor_ars: par.ars,
    valor_usd: par.usd,
  }
}

function itemPasivo(p: Pasivo, s: PasivoSaldo | null, ccl: Calc, insCcl: Insumo, hoy: Fecha, ix: Indices): ItemFoto {
  const viejo = s ? esViejo(s.fecha, hoy, ix.feriados) : false
  const base: Calc = s
    ? trazado(
        s.capital_pendiente.negated(),
        () => `− capital pendiente informado del ${fechaCorta(s.fecha)} = ${monto(s.capital_pendiente.negated(), p.moneda, { decimales: 2 })}`,
        () => [{ nombre: `Capital pendiente de ${p.nombre}`, valor: s.capital_pendiente.toFixed(), unidad: p.moneda, origen: { carga_id: s.carga_id } }],
        { explicacion: 'Lo que falta pagar de capital según el acreedor. Resta en el patrimonio total.' },
      )
    : sinDato(`No cargaste el capital pendiente de ${p.nombre}.`)
  const par =
    p.moneda === 'ARS'
      ? { ars: base, usd: aUsd(base, ccl, insCcl, 'La deuda en dólares al CCL de la foto.') }
      : { ars: aArs(base, ccl, insCcl, 'La deuda en pesos al CCL de la foto.'), usd: base }
  return {
    clave: `d:${p.id}`,
    clase: 'pasivo',
    nombre: p.nombre,
    ticker: p.nombre,
    cuenta: null,
    activo: null,
    tipo: 'deuda',
    moneda_riesgo: p.moneda,
    geografia: 'AR',
    color: '#9a5b5b',
    tenencia: null,
    cantidad: null,
    precio: base,
    fecha_dato: s?.fecha ?? null,
    carga_dato: s?.carga_id ?? null,
    viejo,
    valor_ars: par.ars,
    valor_usd: par.usd,
  }
}

// ───────────── Sumas con "sin dato" ─────────────

/**
 * Suma estricta con traza: si falta una parte, el total es "sin dato" y la
 * suma parcial queda a la vista en los insumos (D-65).
 */
export function sumaCalc(
  partes: { nombre: string; calc: Calc }[],
  moneda: Moneda,
  explicacion: string,
): Calc {
  const insumos = partes.map((p) => deCalc(p.nombre, p.calc, moneda))
  const faltan = partes.filter((p) => p.calc.valor === null)
  const parcial = partes.reduce((a, p) => (p.calc.valor === null ? a : a.plus(p.calc.valor)), CERO)
  if (faltan.length) {
    return sinDato(
      `Falta ${faltan.length === 1 ? faltan[0].nombre : `${faltan.length} partes`}. Suma parcial (${partes.length - faltan.length} de ${partes.length}): ${monto(parcial, moneda, { decimales: 2 })}.`,
      insumos,
      { etiquetas: ['parcial'], explicacion },
    )
  }
  const formula = partes.length
    ? `${partes.map((p) => monto(p.calc.valor as Decimal, moneda, { decimales: 2 })).join(' + ')} = ${monto(parcial, moneda, { decimales: 2 })}`
    : `nada que sumar = ${monto(CERO, moneda)}`
  return calc(parcial, formula, insumos, { explicacion })
}

export function financieros(f: Foto): ItemFoto[] {
  return f.items.filter((i) => i.clase === 'posicion' || i.clase === 'saldo')
}
