// El balance (estado de situación patrimonial, plan de la entrega 4 §3 A.2):
// activo, pasivo y patrimonio neto a una fecha de carga, en pesos y en
// dólares, con su traza. No vuelve a valuar nada: lee la foto (foto.ts) y
// arma el perímetro.
//
// La regla de la deuda de un bien financiado (D-131 revisada, D-134): se toma
// informada (el valor de cancelación de la leasera) › según el cuadro de
// marcha (lo calcula Pasivos) › estimada (la que aprobó el dueño). Un bien
// financiado y su deuda entran o salen juntos (D-03 suma la participación,
// valor − deuda): nunca se suma la camioneta sin su leasing. Lo firme, "sin
// la camioneta", es financiero + bienes libres − deudas sin bien.

import { calc, deCalc, sinDato, unicas, type Calc, type DobleCalc, type Etiqueta, type Insumo } from './calc'
import { CERO, monto, numero, porcentaje, type Decimal } from './dinero'
import { fechaCorta } from './fechas'
import { financieros, foto, indexar, sumaCalc, type Foto, type ItemFoto } from './foto'
import type { Bien, Fecha, Hechos, Moneda, Pasivo } from './tipos'
import { COLOR_MONEDA, COLOR_POR_LIQUIDEZ, COLOR_SIN_ELEGIR } from './colores'

export type Liquidez = 'disponible' | 'mercado' | 'iliquido'
export type Agrupar = 'cuenta' | 'instrumento' | 'clase'
export type OrigenDeuda = 'informada' | 'segun_cuadro' | 'estimada'
export type EjeComposicion = 'moneda' | 'clase' | 'liquidez'

export const AGRUPAR: readonly Agrupar[] = ['cuenta', 'instrumento', 'clase']

export const NOMBRE_LIQUIDEZ: Record<Liquidez, string> = {
  disponible: 'Disponible hoy',
  mercado: 'Con venta en el mercado',
  iliquido: 'Bienes (ilíquido)',
}
export const COLOR_LIQUIDEZ: Record<Liquidez, string> = { ...COLOR_POR_LIQUIDEZ }

/** Nombres de los tipos de partida en singular, para el detalle de una fila. */
export const TIPO_SINGULAR: Record<string, string> = {
  cedear: 'CEDEAR',
  accion_local: 'acción local',
  bono: 'bono',
  lecap: 'letra',
  fci: 'FCI',
  liquidez: 'liquidez',
  inmueble: 'inmueble',
  vehiculo: 'vehículo',
  otro: 'bien',
  deuda: 'deuda',
}

// ───────────── Liquidez (D-132) ─────────────

/**
 * Qué tan rápido se hace plata una partida, por regla (no por opinión): un
 * saldo está disponible hoy, un título o un FCI con cotización se vende en el
 * mercado, un bien es ilíquido. La regla va a la traza.
 */
export function liquidezDe(i: ItemFoto): { liquidez: Liquidez; regla: string } {
  switch (i.clase) {
    case 'saldo':
      return {
        liquidez: 'disponible',
        regla: `${i.nombre}: es un saldo de tu cuenta, lo usás hoy (regla: los saldos de tus cuentas son disponibles).`,
      }
    case 'posicion':
      return {
        liquidez: 'mercado',
        regla: `${i.ticker}: ${i.tipo === 'fci' ? 'se rescata en el fondo' : 'cotiza en BYMA'}; para usar la plata hay que venderla (regla: CEDEAR, acción, bono, letra y FCI con cotización son "con venta en el mercado").`,
      }
    case 'bien':
      return {
        liquidez: 'iliquido',
        regla: `${i.nombre}: un bien se hace plata solo vendiéndolo, sin un precio de mercado de todos los días (regla: los bienes son ilíquidos).`,
      }
    default:
      return { liquidez: 'iliquido', regla: `${i.nombre}: una deuda no es parte del activo.` }
  }
}

// ───────────── La deuda de un bien financiado ─────────────

export interface DeudaVigente {
  /** Lo que se debe, en positivo, en las dos monedas. */
  valor: DobleCalc
  origen: OrigenDeuda
  /** Fecha del saldo (informado o estimado); null para la del cuadro de marcha (es a la fecha del balance). */
  fecha: Fecha | null
  /** Quién la informó o cómo se estimó, si se sabe. */
  fuente: string | null
}

const esEstimada = (p: ItemFoto) => p.precio.etiquetas.includes('estimado')

/** La fuente que foto.ts deja en la traza del saldo ("Quién lo informó" o "Cómo se estimó"). */
function fuenteDe(p: ItemFoto): string | null {
  return p.precio.insumos.find((i) => i.unidad === 'texto' && i.valor !== null)?.valor ?? null
}

const EXPL_DEUDA: Record<OrigenDeuda, string> = {
  informada: 'El valor de cancelación que informó el acreedor (para un leasing, sin la penalidad: D-130). Es lo que se resta en el patrimonio.',
  segun_cuadro:
    'Lo que falta pagar de capital según el cuadro de marcha: el valor presente de los cánones netos que faltan más la opción de compra, a la tasa del contrato. Es un cálculo, no un dato del acreedor: lleva "estimado" hasta que cargues el valor de cancelación (D-131).',
  estimada:
    'Un estimado que aprobaste mientras la leasera no informe el valor de cancelación (D-131). No es un dato del acreedor: lleva "estimado" en esta cifra y en todo lo que la incluye.',
}

const NOMBRE_ORIGEN: Record<OrigenDeuda, string> = {
  informada: 'deuda informada por el acreedor',
  segun_cuadro: 'deuda según el cuadro de marcha',
  estimada: 'deuda estimada',
}

/** La deuda en positivo, a partir del ítem de la foto (que la trae con signo negativo). */
function enPositivo(c: Calc, m: Moneda, nombre: string, origen: OrigenDeuda): Calc {
  const etiquetas: Etiqueta[] = origen === 'informada' ? [] : ['estimado']
  if (c.valor === null) return sinDato(c.motivo ?? 'Falta la deuda.', [deCalc(nombre, c, m)], { etiquetas, explicacion: EXPL_DEUDA[origen] })
  const v = c.valor.negated()
  return calc(v, `${NOMBRE_ORIGEN[origen]} = ${monto(v, m, { decimales: 2 })}`, [deCalc(`${nombre} (resta en la foto)`, c, m)], {
    etiquetas,
    explicacion: EXPL_DEUDA[origen],
  })
}

/** La del cuadro de marcha, con su origen escrito y siempre "estimado". */
function delCuadro(c: Calc, m: Moneda, nombre: string): Calc {
  if (c.valor === null) return sinDato(c.motivo ?? 'Falta la deuda según el cuadro de marcha.', [deCalc(`${nombre} según el cuadro de marcha`, c, m)], { etiquetas: ['estimado'], explicacion: EXPL_DEUDA.segun_cuadro })
  return calc(c.valor, `${NOMBRE_ORIGEN.segun_cuadro} = ${monto(c.valor, m, { decimales: 2 })}`, [deCalc(`${nombre} según el cuadro de marcha`, c, m)], {
    etiquetas: ['estimado'],
    explicacion: EXPL_DEUDA.segun_cuadro,
  })
}

/**
 * La deuda que se usa para un bien financiado (D-131 revisada): informada ›
 * según el cuadro de marcha (de Pasivos; un mapa vacío hasta la integración) ›
 * estimada por el dueño. null si no hay ninguna: el bien y su deuda quedan
 * afuera de la cifra firme y el patrimonio completo es "sin dato".
 */
export function deudaVigente(pasivo: ItemFoto | null, segunCuadro: DobleCalc | null): DeudaVigente | null {
  const nombre = pasivo?.nombre ?? 'La deuda'
  // Hay deuda si hay un saldo en su moneda. Sin CCL, la otra moneda es "sin
  // dato" (su motivo lo dice), pero la deuda y su origen no se pierden: lo que
  // falta es el CCL, no el valor de cancelación.
  const conValor = pasivo !== null && pasivo.precio.valor !== null
  if (pasivo && conValor && !esEstimada(pasivo)) {
    return {
      valor: { ars: enPositivo(pasivo.valor_ars, 'ARS', nombre, 'informada'), usd: enPositivo(pasivo.valor_usd, 'USD', nombre, 'informada') },
      origen: 'informada',
      fecha: pasivo.fecha_dato,
      fuente: fuenteDe(pasivo),
    }
  }
  if (segunCuadro && (segunCuadro.ars.valor !== null || segunCuadro.usd.valor !== null)) {
    return {
      valor: { ars: delCuadro(segunCuadro.ars, 'ARS', nombre), usd: delCuadro(segunCuadro.usd, 'USD', nombre) },
      origen: 'segun_cuadro',
      fecha: null,
      fuente: 'valor presente de los cánones netos que faltan y la opción de compra, a la tasa del contrato',
    }
  }
  if (pasivo && conValor) {
    return {
      valor: { ars: enPositivo(pasivo.valor_ars, 'ARS', nombre, 'estimada'), usd: enPositivo(pasivo.valor_usd, 'USD', nombre, 'estimada') },
      origen: 'estimada',
      fecha: pasivo.fecha_dato,
      fuente: fuenteDe(pasivo),
    }
  }
  return null
}

/**
 * La fecha de un dato, dicha contra la fecha del balance: "mié 08/10" si es
 * del mismo año; "lun 15/09/2025" si no (una tasación de hace un año no
 * puede leerse como de este).
 */
export function fechaDelDato(f: Fecha, ref: Fecha): string {
  return f.slice(0, 4) === ref.slice(0, 4) ? fechaCorta(f) : `${fechaCorta(f)}/${f.slice(0, 4)}`
}

/** "estimada por vos el mié 08/10 · provisoria", "valor de cancelación informado el mar 13/10". */
export function origenEnPalabras(d: DeudaVigente | null, ref: Fecha | null = null): string {
  if (!d) return 'sin dato · falta el valor de cancelación que te pase la leasera'
  const el = d.fecha ? ` el ${ref ? fechaDelDato(d.fecha, ref) : fechaCorta(d.fecha)}` : ''
  switch (d.origen) {
    case 'informada':
      return `valor de cancelación informado${el}`
    case 'segun_cuadro':
      return 'según el cuadro de marcha, a la tasa del contrato · estimada'
    case 'estimada':
      return `estimada por vos${el} · provisoria`
  }
}

/**
 * Tu parte de un bien financiado: valor − deuda (D-03), con la etiqueta de la
 * deuda. Sin la deuda o sin la valuación, "sin dato" con lo que falta.
 */
export function participacion(bien: ItemFoto, deuda: DeudaVigente | null, nombreDeuda = 'su deuda'): DobleCalc {
  const explicacion = `Tu parte de ${conArticulo(bien.nombre)}: lo que vale menos lo que todavía debés ${deLaDeuda(nombreDeuda)} (D-03). Entran juntos: nunca se suma el bien sin su deuda.`
  const una = (m: Moneda): Calc => {
    const v = m === 'ARS' ? bien.valor_ars : bien.valor_usd
    if (v.valor === null) return sinDato(v.motivo ?? `Falta la valuación de ${bien.nombre}.`, [deCalc(bien.nombre, v, m)], { explicacion })
    if (!deuda) {
      return sinDato(`Falta la deuda ${deLaDeuda(nombreDeuda)}: el valor de cancelación que te pase la leasera.`, [deCalc(bien.nombre, v, m)], { explicacion })
    }
    const d = m === 'ARS' ? deuda.valor.ars : deuda.valor.usd
    if (d.valor === null) return sinDato(d.motivo ?? 'Falta la deuda.', [deCalc(bien.nombre, v, m), deCalc(nombreDeuda, d, m)], { explicacion })
    const r = v.valor.minus(d.valor)
    return calc(
      r,
      `${monto(v.valor, m, { decimales: 2 })} (${bien.nombre}) − ${monto(d.valor, m, { decimales: 2 })} (${NOMBRE_ORIGEN[deuda.origen]}) = ${monto(r, m, { decimales: 2 })}`,
      [deCalc(bien.nombre, v, m), deCalc(nombreDeuda, d, m)],
      { explicacion },
    )
  }
  return { ars: una('ARS'), usd: una('USD') }
}

// ───────────── El patrimonio neto ─────────────

export interface Financiado {
  bien: ItemFoto
  pasivo_id: number
  pasivo: ItemFoto | null
  nombre_pasivo: string
  deuda: DeudaVigente | null
  participacion: DobleCalc
}

export interface PatrimonioNeto {
  /** Financiero + bienes libres + participaciones − deudas sin bien (D-03). "estimado" si alguna deuda no es la informada. */
  completo: DobleCalc
  /** Financiero + bienes libres con valuación − deudas sin bien: lo firme, sin ningún estimado. */
  sin_financiados: DobleCalc
  /** De dónde sale la deuda de los bienes financiados (la menos firme si hay varios); null si falta alguna o no hay. */
  origen_deuda: OrigenDeuda | null
  /** Lo que la cifra firme deja afuera, y por qué. */
  excluidos: { clave: string; nombre: string; motivo: string }[]
  financiero: DobleCalc
  /** Bienes sin deuda: en la cifra firme si tienen valuación. */
  bienes_libres: ItemFoto[]
  financiados: Financiado[]
  /** Deudas que no financian un bien (una tarjeta, un préstamo): restan en las dos cifras. */
  deudas_sueltas: ItemFoto[]
  /** Leasings sin su bien cargado: no se restan solos (el bien y su deuda entran juntos). */
  huerfanas: ItemFoto[]
  /** Activo total: financiero + todos los bienes, en bruto. */
  activo: DobleCalc
  /** Pasivo total: la deuda vigente de cada bien financiado + las deudas sueltas, en positivo. */
  pasivo: DobleCalc
}

const EXPL = {
  financiero: {
    ARS: 'Todo lo invertible: títulos y liquidez de tus cuentas, en pesos (D-03).',
    USD: 'Todo lo invertible: títulos y liquidez de tus cuentas, en dólares al CCL de la foto (D-03).',
  },
  activo: {
    ARS: 'Todo lo que tenés, sin restar deudas: lo financiero más tus bienes, en pesos.',
    USD: 'Todo lo que tenés, sin restar deudas: lo financiero más tus bienes, en dólares al CCL de la foto.',
  },
  pasivo: {
    ARS: 'Lo que debés: la deuda de cada bien financiado (con su origen) y cualquier otra deuda, en pesos.',
    USD: 'Lo que debés, en dólares al CCL de la foto.',
  },
  completo: {
    ARS: 'Patrimonio neto = activo − pasivo: financiero + bienes libres + tu parte de cada bien financiado (valor − deuda), en pesos (D-03).',
    USD: 'Patrimonio neto = activo − pasivo, en dólares al CCL de la foto (D-03).',
  },
  firme: {
    ARS: 'Lo firme: financiero + tus bienes sin deuda, en pesos. Deja afuera cada bien financiado junto con su deuda, que entran juntos (D-131).',
    USD: 'Lo firme: financiero + tus bienes sin deuda, en dólares al CCL de la foto. Deja afuera cada bien financiado junto con su deuda (D-131).',
  },
}

const idDe = (clave: string) => Number(clave.split(':')[1])

/** El patrimonio con el perímetro escrito (D-03, D-131). `segunCuadro`: deuda de Pasivos por pasivo_id (vacío hasta la integración). */
export function patrimonioNeto(f: Foto, bienes: readonly Bien[], segunCuadro: ReadonlyMap<number, DobleCalc> = new Map(), pasivos: readonly Pasivo[] = []): PatrimonioNeto {
  const fin = financieros(f)
  const itemsBien = f.items.filter((i) => i.clase === 'bien')
  const itemsDeuda = f.items.filter((i) => i.clase === 'pasivo')
  const bienDe = new Map(bienes.map((b) => [b.id, b]))
  const deudaDe = new Map(itemsDeuda.map((d) => [idDe(d.clave), d]))

  const financiero: DobleCalc = {
    ars: sumaCalc(fin.map((i) => ({ nombre: i.nombre, calc: i.valor_ars })), 'ARS', EXPL.financiero.ARS),
    usd: sumaCalc(fin.map((i) => ({ nombre: i.nombre, calc: i.valor_usd })), 'USD', EXPL.financiero.USD),
  }

  const financiados: Financiado[] = []
  const libres: ItemFoto[] = []
  for (const i of itemsBien) {
    const b = bienDe.get(idDe(i.clave))
    if (b?.pasivo_id != null) {
      const p = deudaDe.get(b.pasivo_id) ?? null
      const nombre = p?.nombre ?? pasivos.find((x) => x.id === b.pasivo_id)?.nombre ?? 'su deuda'
      const deuda = deudaVigente(p, segunCuadro.get(b.pasivo_id) ?? null)
      financiados.push({ bien: i, pasivo_id: b.pasivo_id, pasivo: p, nombre_pasivo: nombre, deuda, participacion: participacion(i, deuda, nombre) })
    } else {
      libres.push(i)
    }
  }
  const vinculadas = new Set(financiados.map((x) => x.pasivo_id))
  const tipoDe = new Map(pasivos.map((p) => [p.id, p.tipo]))
  const noVinculadas = itemsDeuda.filter((d) => !vinculadas.has(idDe(d.clave)))
  // Un leasing financia siempre un bien: sin su bien cargado no se resta solo.
  const huerfanas = noVinculadas.filter((d) => tipoDe.get(idDe(d.clave)) === 'leasing')
  const sueltas = noVinculadas.filter((d) => tipoDe.get(idDe(d.clave)) !== 'leasing')

  const libresConValor = libres.filter((i) => i.valor_ars.valor !== null && i.valor_usd.valor !== null)
  const excluidos: PatrimonioNeto['excluidos'] = [
    ...financiados.map((x) => ({
      clave: x.bien.clave,
      nombre: x.bien.nombre,
      motivo: `está ${financiadoA(x.bien.nombre)} por ${laDeuda(x.nombre_pasivo)}: entra junto con su deuda`,
    })),
    ...libres
      .filter((i) => !libresConValor.includes(i))
      .map((i) => ({ clave: i.clave, nombre: i.nombre, motivo: 'no tiene valuación' })),
    ...huerfanas.map((d) => ({ clave: d.clave, nombre: d.nombre, motivo: 'no tiene cargado el bien que financia' })),
  ]

  const valorM = (i: ItemFoto, m: Moneda) => (m === 'ARS' ? i.valor_ars : i.valor_usd)
  const parte = (nombre: string, d: DobleCalc, m: Moneda) => ({ nombre, calc: m === 'ARS' ? d.ars : d.usd })

  const firme = (m: Moneda) =>
    sumaCalc(
      [parte('Financiero', financiero, m), ...libresConValor.map((i) => ({ nombre: i.nombre, calc: valorM(i, m) })), ...sueltas.map((d) => ({ nombre: `${d.nombre} (resta)`, calc: valorM(d, m) }))],
      m,
      EXPL.firme[m],
    )
  const completo = (m: Moneda) =>
    sumaCalc(
      [
        parte('Financiero', financiero, m),
        ...libres.map((i) => ({ nombre: i.nombre, calc: valorM(i, m) })),
        // En minúscula: el motivo de un "sin dato" lo nombra ("Falta tu parte de la camioneta…").
        ...financiados.map((x) => parte(`tu parte de ${conArticulo(x.bien.nombre)} (valor − deuda)`, x.participacion, m)),
        ...sueltas.map((d) => ({ nombre: `${d.nombre} (resta)`, calc: valorM(d, m) })),
        ...huerfanas.map((d) => ({ nombre: `el bien que financia ${laDeuda(d.nombre)}`, calc: sinDato(`No cargaste el bien que financia ${laDeuda(d.nombre)}: se carga en Datos › Bienes.`) })),
      ],
      m,
      EXPL.completo[m],
    )
  const activo = (m: Moneda) => sumaCalc([parte('Financiero', financiero, m), ...itemsBien.map((i) => ({ nombre: i.nombre, calc: valorM(i, m) }))], m, EXPL.activo[m])
  const deudaPos = (d: ItemFoto, m: Moneda): Calc => {
    const c = valorM(d, m)
    if (c.valor === null) return c
    const v = c.valor.negated()
    return calc(v, `deuda = ${monto(v, m, { decimales: 2 })}`, [deCalc(`${d.nombre} (resta en la foto)`, c, m)], { explicacion: 'Lo que falta pagar de esta deuda.' })
  }
  const pasivo = (m: Moneda) =>
    sumaCalc(
      [
        ...financiados.map((x) => ({
          nombre: x.nombre_pasivo,
          calc: x.deuda ? (m === 'ARS' ? x.deuda.valor.ars : x.deuda.valor.usd) : sinDato(`Falta la deuda ${deLaDeuda(x.nombre_pasivo)}: el valor de cancelación que te pase la leasera.`),
        })),
        ...sueltas.map((d) => ({ nombre: d.nombre, calc: deudaPos(d, m) })),
        // Un leasing sin su bien no se resta solo, pero existe: el total no puede decir $ 0.
        ...huerfanas.map((d) => ({ nombre: d.nombre, calc: sinDato(`${d.nombre} no se resta sin el bien que financia: cargalo en Datos › Bienes.`) })),
      ],
      m,
      EXPL.pasivo[m],
    )

  const origenes = financiados.map((x) => x.deuda?.origen ?? null)
  const origen_deuda: OrigenDeuda | null =
    origenes.length === 0 || origenes.includes(null)
      ? null
      : origenes.includes('estimada')
        ? 'estimada'
        : origenes.includes('segun_cuadro')
          ? 'segun_cuadro'
          : 'informada'

  return {
    completo: { ars: completo('ARS'), usd: completo('USD') },
    sin_financiados: { ars: firme('ARS'), usd: firme('USD') },
    origen_deuda,
    excluidos,
    financiero,
    bienes_libres: libres,
    financiados,
    deudas_sueltas: sueltas,
    huerfanas,
    activo: { ars: activo('ARS'), usd: activo('USD') },
    pasivo: { ars: pasivo('ARS'), usd: pasivo('USD') },
  }
}

// ───────────── Agrupar lo financiero ─────────────

export interface GrupoBalance {
  clave: string
  nombre: string
  filas: ItemFoto[]
  total: DobleCalc
}

const NOMBRE_GRUPO_CLASE: Record<string, string> = {
  cedear: 'CEDEARs',
  accion_local: 'Acciones locales',
  bono: 'Bonos',
  lecap: 'Letras',
  fci: 'FCI',
  liquidez: 'Liquidez',
}

/** De mayor a menor por su valor en pesos; lo "sin dato" al final; empate, por nombre. */
function porValor<T>(valor: (x: T) => Decimal | null, nombre: (x: T) => string) {
  return (a: T, b: T) => {
    const va = valor(a)
    const vb = valor(b)
    if (va === null && vb === null) return nombre(a).localeCompare(nombre(b), 'es')
    if (va === null) return 1
    if (vb === null) return -1
    return vb.cmp(va) || nombre(a).localeCompare(nombre(b), 'es')
  }
}

/** Lo financiero por cuenta (IEB › SPY…), por instrumento (SPY, todas las cuentas juntas) o por clase. */
export function agrupar(items: readonly ItemFoto[], por: Agrupar): GrupoBalance[] {
  const grupos = new Map<string, { nombre: string; filas: ItemFoto[] }>()
  for (const i of items) {
    let clave: string
    let nombre: string
    if (por === 'cuenta') {
      clave = `c:${i.cuenta?.id ?? 0}`
      nombre = i.cuenta?.nombre ?? 'Sin cuenta'
    } else if (por === 'instrumento') {
      if (i.clase === 'saldo') {
        clave = `m:${i.moneda_riesgo}`
        nombre = i.moneda_riesgo === 'ARS' ? 'Pesos en tus cuentas' : 'Dólares en tus cuentas'
      } else {
        clave = `a:${i.activo?.id ?? i.clave}`
        nombre = i.activo ? `${i.ticker} · ${i.activo.nombre}` : i.nombre
      }
    } else {
      clave = `t:${i.tipo}`
      nombre = NOMBRE_GRUPO_CLASE[i.tipo] ?? i.tipo
    }
    const g = grupos.get(clave)
    if (g) g.filas.push(i)
    else grupos.set(clave, { nombre, filas: [i] })
  }
  const filaOrden = porValor<ItemFoto>(
    (i) => i.valor_ars.valor,
    (i) => i.nombre,
  )
  const out: GrupoBalance[] = [...grupos.entries()].map(([clave, g]) => {
    const filas = [...g.filas].sort(filaOrden)
    return {
      clave,
      nombre: g.nombre,
      filas,
      total: {
        ars: sumaCalc(filas.map((i) => ({ nombre: i.nombre, calc: i.valor_ars })), 'ARS', `Suma de ${g.nombre}, en pesos.`),
        usd: sumaCalc(filas.map((i) => ({ nombre: i.nombre, calc: i.valor_usd })), 'USD', `Suma de ${g.nombre}, en dólares al CCL de la foto.`),
      },
    }
  })
  return out.sort(
    porValor<GrupoBalance>(
      (g) => g.total.ars.valor,
      (g) => g.nombre,
    ),
  )
}

// ───────────── Composición ─────────────

export interface PartidaComposicion {
  clave: string
  nombre: string
  color: string
  valor: DobleCalc
  /** Fracción exacta del total, en la moneda pedida (la pantalla redondea por resto mayor). */
  peso: Calc
  regla: string | null
}

const NOMBRE_MONEDA: Record<string, string> = { ARS: 'Pesos', USD: 'Dólares', sin_elegir: 'Sin elegir' }
const ORDEN_LIQUIDEZ: Liquidez[] = ['disponible', 'mercado', 'iliquido']

/**
 * Cómo se reparte el activo: por moneda de riesgo (los bienes van a "Sin
 * elegir" hasta que les elijas una, D-73), por clase o por liquidez. Si a una
 * partida le falta el valor, los pesos son "sin dato" (D-65).
 */
export function composicion(
  items: readonly ItemFoto[],
  eje: EjeComposicion,
  moneda: Moneda,
  colores: { clase: Record<string, string>; nombreClase: Record<string, string> },
): PartidaComposicion[] {
  const activos = items.filter((i) => i.clase !== 'pasivo')
  const claveDe = (i: ItemFoto): string =>
    eje === 'moneda' ? (i.clase === 'bien' ? 'sin_elegir' : i.moneda_riesgo) : eje === 'clase' ? i.tipo : liquidezDe(i).liquidez
  const nombreDe = (k: string) =>
    eje === 'moneda' ? (NOMBRE_MONEDA[k] ?? k) : eje === 'clase' ? (colores.nombreClase[k] ?? k) : NOMBRE_LIQUIDEZ[k as Liquidez]
  const colorDe = (k: string) => (eje === 'moneda' ? (COLOR_MONEDA[k as keyof typeof COLOR_MONEDA] ?? COLOR_SIN_ELEGIR) : eje === 'clase' ? (colores.clase[k] ?? '#888') : COLOR_LIQUIDEZ[k as Liquidez])
  const reglaDe = (k: string): string | null => {
    if (eje === 'liquidez') {
      return k === 'disponible'
        ? 'Saldos de tus cuentas: los usás hoy.'
        : k === 'mercado'
          ? 'CEDEARs, acciones, bonos, letras y FCI con cotización: hay que venderlos.'
          : 'Casa, camioneta y otros bienes: solo vendiéndolos, sin precio de todos los días.'
    }
    if (eje === 'moneda' && k === 'sin_elegir') return 'Tus bienes no tienen moneda de riesgo elegida (D-73): van aparte, nunca repartidos entre pesos y dólares.'
    return null
  }
  const grupos = new Map<string, ItemFoto[]>()
  for (const i of activos) {
    const k = claveDe(i)
    grupos.set(k, [...(grupos.get(k) ?? []), i])
  }
  const total = sumaCalc(
    activos.map((i) => ({ nombre: i.nombre, calc: moneda === 'ARS' ? i.valor_ars : i.valor_usd })),
    moneda,
    moneda === 'ARS' ? 'El total de esta composición, en pesos.' : 'El total de esta composición, en dólares.',
  )
  const out: PartidaComposicion[] = [...grupos.entries()].map(([k, is]) => {
    const nombre = nombreDe(k)
    const valor: DobleCalc = {
      ars: sumaCalc(is.map((i) => ({ nombre: i.nombre, calc: i.valor_ars })), 'ARS', `${nombre}, en pesos.`),
      usd: sumaCalc(is.map((i) => ({ nombre: i.nombre, calc: i.valor_usd })), 'USD', `${nombre}, en dólares al CCL de la foto.`),
    }
    const parte = moneda === 'ARS' ? valor.ars : valor.usd
    // La regla del grupo (D-132, D-73) va también a la traza de su peso.
    const regla = reglaDe(k)
    const peso =
      parte.valor === null || total.valor === null || total.valor.isZero()
        ? sinDato(total.valor === null ? `Sin el total no hay peso: ${total.motivo ?? 'falta una partida.'}` : (parte.motivo ?? 'Falta el valor de este grupo.'), [deCalc(nombre, parte, moneda), deCalc('Total', total, moneda)], {
            explicacion: `Qué parte del total es este grupo.${regla ? ` ${regla}` : ''}`,
          })
        : calc(
            parte.valor.div(total.valor),
            `${monto(parte.valor, moneda, { decimales: 2 })} ÷ ${monto(total.valor, moneda, { decimales: 2 })} = ${porcentaje(parte.valor.div(total.valor), { decimales: 4 })}`,
            [deCalc(nombre, parte, moneda), deCalc('Total', total, moneda)],
            { explicacion: `Qué parte del total es este grupo. El número exacto está acá; la pantalla lo redondea de modo que la suma dé 100%.${regla ? ` ${regla}` : ''}` },
          )
    return { clave: k, nombre, color: colorDe(k), valor, peso, regla }
  })
  if (eje === 'liquidez') return out.sort((a, b) => ORDEN_LIQUIDEZ.indexOf(a.clave as Liquidez) - ORDEN_LIQUIDEZ.indexOf(b.clave as Liquidez))
  return out.sort(
    porValor<PartidaComposicion>(
      (p) => (moneda === 'ARS' ? p.valor.ars.valor : p.valor.usd.valor),
      (p) => p.nombre,
    ),
  )
}

// ───────────── Evolución: una foto por fecha de carga ─────────────

export type Rubro = 'liquidez' | 'titulos' | 'bienes'

export interface PuntoSerieBalance {
  fecha: Fecha
  /** El activo por clase (tipo de partida): texto decimal o null = sin dato. */
  por_clase: Record<string, { ars: string | null; usd: string | null }>
  /** El activo por rubro: saldos, títulos (todas las posiciones) y bienes. */
  por_rubro: Record<Rubro, { ars: string | null; usd: string | null }>
  /** Lo firme: financiero + bienes libres (sin la camioneta). */
  neto: { ars: string | null; usd: string | null }
  /** Con cada bien financiado neto de su deuda. */
  completo: { ars: string | null; usd: string | null }
  /** La deuda que usa `completo` no es la informada. */
  completo_estimado: boolean
}

const texto = (c: Calc): string | null => (c.valor === null ? null : c.valor.toFixed())

/**
 * La evolución del balance: una foto por fecha de carga, nunca un punto
 * inventado entre cargas (un hueco es un hueco). Indexa los hechos una sola
 * vez y arma las fotos sin traza (solo valores), como la atribución.
 */
export function serieBalance(
  h: Hechos,
  fechas: readonly Fecha[],
  hoy: Fecha,
  segunCuadro: (fecha: Fecha) => ReadonlyMap<number, DobleCalc> = () => new Map(),
): PuntoSerieBalance[] {
  const ix = indexar(h)
  const ultima = fechas.at(-1)
  return fechas.map((d) => {
    const f = foto(h, d, { hoy: d === ultima ? hoy : d, ix, traza: false })
    const pn = patrimonioNeto(f, h.bienes, segunCuadro(d), h.pasivos)
    const por_clase: PuntoSerieBalance['por_clase'] = {}
    const porTipo = new Map<string, ItemFoto[]>()
    for (const i of f.items.filter((x) => x.clase !== 'pasivo')) porTipo.set(i.tipo, [...(porTipo.get(i.tipo) ?? []), i])
    for (const [t, is] of porTipo) {
      por_clase[t] = {
        ars: texto(sumaCalc(is.map((i) => ({ nombre: i.nombre, calc: i.valor_ars })), 'ARS', '')),
        usd: texto(sumaCalc(is.map((i) => ({ nombre: i.nombre, calc: i.valor_usd })), 'USD', '')),
      }
    }
    const rubro = (r: Rubro) => {
      const is = f.items.filter((i) => (r === 'liquidez' ? i.clase === 'saldo' : r === 'titulos' ? i.clase === 'posicion' : i.clase === 'bien'))
      return {
        ars: is.length ? texto(sumaCalc(is.map((i) => ({ nombre: i.nombre, calc: i.valor_ars })), 'ARS', '')) : null,
        usd: is.length ? texto(sumaCalc(is.map((i) => ({ nombre: i.nombre, calc: i.valor_usd })), 'USD', '')) : null,
      }
    }
    return {
      fecha: d,
      por_clase,
      por_rubro: { liquidez: rubro('liquidez'), titulos: rubro('titulos'), bienes: rubro('bienes') },
      neto: { ars: texto(pn.sin_financiados.ars), usd: texto(pn.sin_financiados.usd) },
      completo: { ars: texto(pn.completo.ars), usd: texto(pn.completo.usd) },
      completo_estimado: pn.completo.ars.etiquetas.includes('estimado'),
    }
  })
}

// ───────────── Comparativo (D-133) ─────────────

/**
 * Lo que cambió un renglón del balance entre dos fechas de carga: actual −
 * anterior, en la moneda pedida y con las dos cifras en la traza. No es una
 * ganancia: incluye lo que pusiste o sacaste (el resultado separado es de
 * Evolución y PnL). Sin una de las dos, "sin dato".
 */
export function diferencia(actual: Calc, anterior: Calc, m: Moneda, fActual: Fecha, fAnterior: Fecha, nombre: string): Calc {
  const explicacion = `Cuánto cambió ${nombre.toLowerCase()} del ${fechaDelDato(fAnterior, fActual)} al ${fechaCorta(fActual)}. No es una ganancia: incluye lo que pusiste o sacaste de tus cuentas; el resultado, separado, está en Evolución y PnL.`
  const insumos = [deCalc(`${nombre} al ${fechaCorta(fActual)}`, actual, m), deCalc(`${nombre} al ${fechaDelDato(fAnterior, fActual)}`, anterior, m)]
  if (actual.valor === null) return sinDato(actual.motivo ?? `Falta ${nombre.toLowerCase()} al ${fechaCorta(fActual)}.`, insumos, { explicacion })
  if (anterior.valor === null) return sinDato(anterior.motivo ?? `Falta ${nombre.toLowerCase()} al ${fechaDelDato(fAnterior, fActual)}.`, insumos, { explicacion })
  const v = actual.valor.minus(anterior.valor)
  return calc(
    v,
    `${monto(actual.valor, m, { decimales: 2 })} (al ${fechaCorta(fActual)}) − ${monto(anterior.valor, m, { decimales: 2 })} (al ${fechaDelDato(fAnterior, fActual)}) = ${monto(v, m, { decimales: 2, signo: true })}`,
    insumos,
    { explicacion },
  )
}

// ───────────── Indicadores del balance (D-133) ─────────────

export type ClaveIndicador = 'solvencia' | 'endeudamiento' | 'inmovilizacion'

export interface Indicador {
  clave: ClaveIndicador
  nombre: string
  /** "veces" (21,1 veces) o "fraccion" (0,05 = 5%). */
  unidad: 'veces' | 'fraccion'
  valor: Calc
  /** Qué mide, en una línea y sin juicio: no hay umbral de bueno o malo. */
  lectura: string
}

/** num ÷ den con su traza; sin dato si falta alguno o el divisor es cero. */
function cociente(num: Calc, den: Calc, nNum: string, nDen: string, unidad: Indicador['unidad'], explicacion: string): Calc {
  const insumos = [deCalc(nNum, num, 'ARS'), deCalc(nDen, den, 'ARS')]
  if (num.valor === null) return sinDato(num.motivo ?? `Falta ${nNum.toLowerCase()}.`, insumos, { explicacion })
  if (den.valor === null) return sinDato(den.motivo ?? `Falta ${nDen.toLowerCase()}.`, insumos, { explicacion })
  if (den.valor.isZero()) return sinDato(`${nDen} es cero: no hay cociente.`, insumos, { explicacion })
  const v = num.valor.div(den.valor)
  const r = unidad === 'veces' ? `${numero(v, 2)} veces` : porcentaje(v, { decimales: 2 })
  return calc(v, `${monto(num.valor, 'ARS', { decimales: 2 })} (${nNum.toLowerCase()}) ÷ ${monto(den.valor, 'ARS', { decimales: 2 })} (${nDen.toLowerCase()}) = ${r}`, insumos, { explicacion })
}

/**
 * Tres indicadores clásicos de un estado de situación patrimonial, en pesos
 * (en dólares dan lo mismo: las dos partes van al mismo CCL). Describen, no
 * juzgan: la app no tiene umbrales (D-42). Con una deuda estimada llevan
 * "estimado". Sin deudas no hay solvencia ni endeudamiento; sin bienes, no hay
 * inmovilización.
 */
export function indicadores(pn: PatrimonioNeto): Indicador[] {
  const out: Indicador[] = []
  const hayDeudas = pn.financiados.length > 0 || pn.deudas_sueltas.length > 0
  if (hayDeudas) {
    out.push({
      clave: 'solvencia',
      nombre: 'Solvencia',
      unidad: 'veces',
      valor: cociente(pn.activo.ars, pn.pasivo.ars, 'Activo', 'Pasivo', 'veces', 'Activo ÷ pasivo: cuántas veces lo que tenés cubre lo que debés.'),
      lectura: 'Cuántas veces lo que tenés cubre lo que debés.',
    })
    out.push({
      clave: 'endeudamiento',
      nombre: 'Endeudamiento',
      unidad: 'fraccion',
      valor: cociente(pn.pasivo.ars, pn.completo.ars, 'Pasivo', 'Patrimonio neto', 'fraccion', 'Pasivo ÷ patrimonio neto: qué parte de lo tuyo debés.'),
      lectura: 'Qué parte de tu patrimonio neto debés.',
    })
  }
  const bienes = pn.bienes_libres.length + pn.financiados.length
  if (bienes > 0) {
    const items = [...pn.bienes_libres, ...pn.financiados.map((x) => x.bien)]
    const totalBienes = sumaCalc(items.map((i) => ({ nombre: i.nombre, calc: i.valor_ars })), 'ARS', 'Tus bienes, en pesos.')
    out.push({
      clave: 'inmovilizacion',
      nombre: 'Inmovilización',
      unidad: 'fraccion',
      valor: cociente(totalBienes, pn.activo.ars, 'Bienes', 'Activo', 'fraccion', 'Bienes ÷ activo: qué parte de lo que tenés no se vende en el mercado de un día para otro (D-132).'),
      lectura: 'Qué parte de tu activo está en bienes, que no se venden de un día para otro.',
    })
  }
  return out
}

// ───────────── Palabras ─────────────

const FEMENINO = /^(camioneta|casa|moto|motocicleta|lancha|chacra|quinta|cochera|oficina|parcela|propiedad|finca|casilla|embarcación|bicicleta)\b/i
const MASCULINO = /^(auto|automóvil|vehículo|departamento|depto|terreno|lote|campo|local|galpón|camión|barco|velero|inmueble|monoambiente|dúplex|ph)\b/i

/** "Camioneta" → "la camioneta"; "Casa de Córdoba" → "la casa de Córdoba"; "Toyota Hilux" → "Toyota Hilux". */
export function conArticulo(nombre: string): string {
  const n = nombre.trim()
  const minuscula = n.charAt(0).toLowerCase() + n.slice(1)
  if (FEMENINO.test(n)) return `la ${minuscula}`
  if (MASCULINO.test(n)) return `el ${minuscula}`
  return n
}

/** "el leasing de la camioneta", "la tarjeta Visa", "su deuda", "Banco Ejemplo": el nombre de una deuda en medio de una frase. */
export function laDeuda(nombre: string): string {
  const n = nombre.trim()
  const min = n.charAt(0).toLowerCase() + n.slice(1)
  if (/^(el|la|los|las|su|sus|tu|tus)\s/i.test(n)) return min
  if (/^(leasing|préstamo|prestamo|crédito|credito)\b/i.test(n)) return `el ${min}`
  if (/^(tarjeta|deuda|hipoteca)\b/i.test(n)) return `la ${min}`
  return n
}

/** "del leasing de la camioneta", "de su deuda", "de Banco Ejemplo": el nombre de una deuda después de "debés" (nunca "de el"). */
export function deLaDeuda(nombre: string): string {
  const l = laDeuda(nombre)
  return l.startsWith('el ') ? `del ${l.slice(3)}` : `de ${l}`
}

/** "financiada" (la camioneta) o "financiado" (el auto, o un nombre sin artículo). */
export function financiadoA(bien: string): string {
  return conArticulo(bien).startsWith('la ') ? 'financiada' : 'financiado'
}

/** "la camioneta", "la camioneta y el auto", "la camioneta, el auto y la moto". */
export function enLista(nombres: readonly string[]): string {
  const xs = nombres.map(conArticulo)
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`
}

/** Las etiquetas de todas las partes, sin repetir (para chips de totales armados a mano). */
export function etiquetasDe(cs: readonly Calc[]): Etiqueta[] {
  return unicas(cs.flatMap((c) => c.etiquetas))
}

export { CERO }
export type { Insumo }
