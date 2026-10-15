// Arma la vista del Balance (/patrimonio) a partir de los hechos. Pura: se
// testea sin base (armar-balance.test.ts). src/lib/vistas/balance.ts la llama
// con los hechos de Supabase; el modo demo, con los de ejemplo-balance.ts.
//
// Toda cifra sale de src/lib/domain/balance.ts y de la foto (foto.ts): acá
// solo se elige qué mostrar, se calculan los pesos sobre el activo y se
// redondean los porcentajes por resto mayor (lo que se ve suma 100,0%).

import { calc, deCalc, etiquetaPrincipal, NOMBRE_ETIQUETA, sinDato, unicas, vista, type Calc, type CalcVista, type DobleCalc, type Etiqueta } from '@/lib/domain/calc'
import {
  AGRUPAR,
  agrupar,
  composicion,
  conArticulo,
  deLaDeuda,
  diferencia,
  enLista,
  fechaDelDato,
  financiadoA,
  indicadores,
  laDeuda,
  liquidezDe,
  NOMBRE_LIQUIDEZ,
  origenEnPalabras,
  patrimonioNeto,
  serieBalance,
  TIPO_SINGULAR,
  type Agrupar,
  type EjeComposicion,
  type Financiado,
  type PartidaComposicion,
  type PatrimonioNeto,
} from '@/lib/domain/balance'
import { compacto, Decimal, monto, numero, porcentaje } from '@/lib/domain/dinero'
import { conjuntoFeriados, diasHabilesEntre, fechaCorta } from '@/lib/domain/fechas'
import { financieros, foto, indexar, type Foto, type ItemFoto } from '@/lib/domain/foto'
import { fechasDeCarga } from '@/lib/domain/variacion'
import type { Fecha, Hechos, Moneda } from '@/lib/domain/tipos'
import { decimalesPrecio, restoMayor } from '@/components/calculos'
import { COLOR_CLASE, NOMBRE_CLASE } from './colores'
import type { Par } from './contratos'
import type {
  Accion,
  ComparativoVista,
  FilaBalance,
  FilaPasivo,
  GrupoVista,
  IndicadorVista,
  LineaComparativa,
  LineaNeto,
  ParteFraseBalance,
  PerimetroComposicion,
  PuntoBalance,
  ReferenciaContrato,
  SegmentoBalance,
  VistaBalance,
} from './contratos-balance'

/** Lo que llega de Pasivos en la integración (plan §10.3). Vacío hasta entonces. */
export interface ExtrasBalance {
  /** La deuda según el cuadro de marcha a una fecha, por pasivo_id (Pasivos: capitalSegunCuadro). */
  segunCuadro?: (fecha: Fecha) => ReadonlyMap<number, DobleCalc>
  /** Lo que falta pagar según el contrato a una fecha, por pasivo_id (Pasivos: resumenLeasing). Nunca se resta. */
  referencia?: (fecha: Fecha) => ReadonlyMap<number, { falta: DobleCalc; cuotas: number | null; nota: string }>
}

export interface PedidoBalance {
  fecha?: string | null
  agrupar?: string | null
  /** Otra fecha de carga, anterior, para el comparativo; si no, la primera. */
  comparar?: string | null
}

const par = (d: DobleCalc): Par => ({ ars: vista(d.ars), usd: vista(d.usd) })
const parDe = (ars: Calc, usd: Calc): Par => ({ ars: vista(ars), usd: vista(usd) })
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const COLOR_FINANCIERO = '#2f5bd3'
/** Cuántas fechas de carga dibuja la evolución como mucho (un año y medio de cargas diarias). */
const MAX_SERIE = 400

export function agruparValido(x: unknown): Agrupar {
  return AGRUPAR.includes(x as Agrupar) ? (x as Agrupar) : 'cuenta'
}

// ───────────── Pesos sobre el activo ─────────────

function pesoSobre(parte: Calc, total: Calc, nombre: string, explicacion: string): CalcVista {
  if (parte.valor === null || total.valor === null || total.valor.isZero()) {
    return vista(
      sinDato(total.valor === null ? `Sin el activo total no hay porcentaje: ${total.motivo ?? 'falta una partida.'}` : (parte.motivo ?? `Falta ${nombre}.`), [deCalc(nombre, parte, 'ARS'), deCalc('Activo total', total, 'ARS')], {
        explicacion,
      }),
    )
  }
  const v = parte.valor.div(total.valor)
  return vista(
    calc(v, `${monto(parte.valor, 'ARS', { decimales: 2 })} ÷ ${monto(total.valor, 'ARS', { decimales: 2 })} = ${porcentaje(v, { decimales: 2 })}`, [deCalc(nombre, parte, 'ARS'), deCalc('Activo total', total, 'ARS')], {
      explicacion,
    }),
  )
}

/** Porcentajes con un decimal que suman exacto 100,0 (resto mayor), y el ancho exacto de cada tramo. */
export function redondearTramos<T extends { peso: CalcVista }>(xs: T[]): (T & { pct: string | null; ancho: string | null })[] {
  const pesos = xs.map((x) => x.peso.valor)
  if (xs.length === 0 || pesos.some((p) => p === null)) return xs.map((x) => ({ ...x, pct: null, ancho: null }))
  const partes = pesos.map((p) => new Decimal(p as string).times(100))
  const total = partes.reduce((a, p) => a.plus(p), new Decimal(0))
  const r = restoMayor(total, partes, 1)
  return xs.map((x, i) => {
    const exacto = partes[i]
    return {
      ...x,
      pct: r.partes[i].toFixed(1),
      ancho: exacto.gt(0) ? `${exacto.toDecimalPlaces(4).toFixed()}%` : null,
    }
  })
}

/**
 * Reparte un total ya redondeado entre partes exactas (resto mayor): cada parte
 * queda a menos de una unidad de su valor y la suma da el objetivo. Si el
 * objetivo no se puede alcanzar así, cada parte queda en su piso o su techo.
 */
export function repartir(objetivo: Decimal, partes: Decimal[], decimales = 1): Decimal[] {
  const u = new Decimal(10).pow(-decimales)
  const pisos = partes.map((x) => x.div(u).floor().times(u))
  const restos = partes.map((x, i) => x.minus(pisos[i]))
  const suma = pisos.reduce((a, x) => a.plus(x), new Decimal(0))
  const faltan = Math.min(Math.max(objetivo.minus(suma).div(u).round().toNumber(), 0), partes.length)
  const suben = new Set(
    restos
      .map((r, i) => ({ r, i }))
      .sort((a, b) => b.r.cmp(a.r) || a.i - b.i)
      .slice(0, faltan)
      .map((x) => x.i),
  )
  return pisos.map((x, i) => (suben.has(i) ? x.plus(u) : x))
}

/** El porcentaje exacto (× 100) de un peso, o null. */
const enCien = (c: CalcVista): Decimal | null => (c.valor === null ? null : new Decimal(c.valor).times(100))

/** ¿Las partes suman el total exacto? (los pesos vienen de cocientes: se tolera el último dígito de Decimal). */
const sumanExacto = (partes: Decimal[], total: Decimal) => partes.reduce((a, x) => a.plus(x), new Decimal(0)).minus(total).abs().lt('1e-20')

/**
 * Redondea los porcentajes del pasivo y del patrimonio neto para que lo que se
 * ve sume: pasivo + patrimonio neto = 100,0% (es el activo), las partes del
 * patrimonio neto (lo firme y tu parte de cada bien financiado) suman el
 * patrimonio neto, y las deudas suman el pasivo. Cambia el `pct` de las líneas
 * y de las filas en su lugar y devuelve el del pasivo total. Si algo es "sin
 * dato" o las partes no suman el total exacto, cada uno queda con su redondeo.
 */
export function cuadrarPct(lineas: LineaNeto[], filasPasivo: FilaPasivo[], pesoPasivo: CalcVista): string | null {
  let pasivoPct = pct1(pesoPasivo)
  const completo = lineas.find((l) => l.clave === 'completo')
  const pPas = enCien(pesoPasivo)
  const pNeto = completo ? enCien(completo.peso) : null
  if (!completo || pPas === null || pNeto === null || !sumanExacto([pPas, pNeto], new Decimal(100))) return pasivoPct
  const [a, b] = repartir(new Decimal(100), [pPas, pNeto], 1)
  pasivoPct = a.toFixed(1)
  completo.pct = b.toFixed(1)
  const partes = lineas.filter((l) => l.clave === 'sin_financiados' || l.clave.startsWith('participacion:'))
  const exactas = partes.map((l) => enCien(l.peso))
  if (partes.length > 1 && exactas.every((x) => x !== null) && sumanExacto(exactas as Decimal[], pNeto)) {
    repartir(b, exactas as Decimal[], 1).forEach((x, i) => (partes[i].pct = x.toFixed(1)))
  }
  const deudas = filasPasivo.map((f) => enCien(f.peso))
  if (filasPasivo.length > 1 && deudas.every((x) => x !== null) && sumanExacto(deudas as Decimal[], pPas)) {
    repartir(a, deudas as Decimal[], 1).forEach((x, i) => (filasPasivo[i].pct = x.toFixed(1)))
  }
  return pasivoPct
}

/** Un porcentaje con un decimal, para una cifra suelta (no parte de una barra). */
function pct1(c: CalcVista): string | null {
  return c.valor === null ? null : new Decimal(c.valor).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1)
}

/**
 * Los chips de una cifra, en palabras y sin repetir: primero los que dice la
 * pantalla ("estimado", "parcial"), después las etiquetas de su cálculo por
 * gravedad. "declarado" e "inferido" no van en una cifra total.
 */
export function chipsDe(c: { etiquetas: readonly Etiqueta[] }, primero: string[] = [], omitir: readonly Etiqueta[] = []): string[] {
  const resto = unicas([...c.etiquetas])
    .filter((e) => !omitir.includes(e) && e !== 'declarado' && e !== 'inferido')
    .map((e) => NOMBRE_ETIQUETA[e])
  return [...new Set([...primero, ...resto])]
}

// ───────────── Filas ─────────────

function detalleFila(i: ItemFoto, financiado: Financiado | null, ref: Fecha): string {
  const el = (f: Fecha) => fechaDelDato(f, ref)
  if (i.clase === 'posicion') {
    const tipo = TIPO_SINGULAR[i.tipo] ?? i.tipo
    if (i.ausente) return `${tipo} · ${i.cuenta?.nombre ?? 'tu cuenta'} ya no la lista desde el ${el(i.ausente.fecha)}`
    const cant = i.cantidad === null ? '' : numero(i.cantidad, 4, { min: 0 })
    const vn = i.tipo === 'bono' || i.tipo === 'lecap' ? ' VN' : ''
    if (i.precio.valor === null) return `${tipo} · ${cant}${vn} · sin precio`
    const p = i.precio.valor.toFixed()
    return `${tipo} · ${cant}${vn} × ${monto(i.precio.valor, 'ARS', { decimales: decimalesPrecio(p) })}${i.fecha_dato ? ` del ${el(i.fecha_dato)}` : ''}`
  }
  if (i.clase === 'saldo') return `saldo del ${i.fecha_dato ? el(i.fecha_dato) : '—'}`
  if (i.clase === 'bien') {
    if (i.precio.valor === null) return 'sin valuación'
    const fuente = i.precio.insumos[0]?.origen?.lugar
    const base = `${monto(i.precio.valor, i.moneda_riesgo, { decimales: 0 })}${fuente ? ` · ${fuente}` : ''}${i.fecha_dato ? ` del ${el(i.fecha_dato)}` : ''}`
    return financiado ? `${base} · sujeta a la opción de compra` : base
  }
  return ''
}

function chipsFila(i: ItemFoto, hoy: Fecha, feriados: Set<Fecha>, financiado: Financiado | null): string[] {
  const out: string[] = []
  if (i.ausente) out.push('pendiente')
  else if (i.viejo && i.fecha_dato) out.push(`viejo · hace ${diasHabilesEntre(i.fecha_dato, hoy, feriados)} d háb.`)
  if (financiado) out.push(`${financiadoA(i.nombre)} por ${laDeuda(financiado.nombre_pasivo)}`)
  return out
}

function accionFila(i: ItemFoto): Accion | null {
  if (i.clase === 'bien' && i.precio.valor === null) return { etiqueta: 'Cargar valuación', href: '/datos/bienes' }
  if (i.clase === 'posicion' && (i.ausente || i.precio.valor === null)) return { etiqueta: 'Cargar', href: '/carga' }
  return null
}

function filaDe(i: ItemFoto, activo: Calc, hoy: Fecha, feriados: Set<Fecha>, ref: Fecha, financiado: Financiado | null = null): FilaBalance {
  const liq = liquidezDe(i)
  return {
    clave: i.clave,
    nombre: i.clase === 'posicion' ? `${i.ticker} · ${i.nombre}` : i.nombre,
    detalle: detalleFila(i, financiado, ref),
    cuenta: i.cuenta?.nombre ?? null,
    clase: i.tipo,
    color: i.clase === 'bien' ? (COLOR_CLASE[i.tipo] ?? i.color) : i.color,
    liquidez: liq.liquidez,
    regla_liquidez: liq.regla,
    valor: parDe(i.valor_ars, i.valor_usd),
    // La liquidez de la partida y su regla van a la traza de su porcentaje (D-132).
    peso: pesoSobre(i.valor_ars, activo, i.nombre, `Qué parte de tu activo total es esta partida. Liquidez: ${minuscula(NOMBRE_LIQUIDEZ[liq.liquidez])}. ${liq.regla}`),
    pct: null,
    viejo: i.viejo,
    chips: chipsFila(i, hoy, feriados, financiado),
    accion: accionFila(i),
  }
}

// ───────────── Perímetro en palabras ─────────────

/** "sin la camioneta", "sin la casa, que no tiene valuación", "sin la camioneta ni la casa, que no tiene valuación". */
export function textoSin(pn: PatrimonioNeto): string | null {
  const financiados = pn.excluidos.filter((x) => x.motivo !== 'no tiene valuación' && !x.clave.startsWith('d:')).map((x) => x.nombre)
  const sinValor = pn.excluidos.filter((x) => x.motivo === 'no tiene valuación').map((x) => x.nombre)
  const partes: string[] = []
  if (financiados.length) partes.push(enLista(financiados))
  if (sinValor.length) partes.push(`${enLista(sinValor)}, que no ${sinValor.length === 1 ? 'tiene' : 'tienen'} valuación`)
  return partes.length ? `sin ${partes.join(' ni ')}` : null
}

/** "financiero + casa": lo que suma lo firme. */
function componentesFirme(pn: PatrimonioNeto): string {
  const libres = pn.bienes_libres.filter((i) => i.valor_ars.valor !== null).map((i) => minuscula(i.nombre))
  return ['financiero', ...libres].join(' + ')
}

function deudaEnPalabras(pn: PatrimonioNeto): string {
  const nombres = pn.financiados.map((x) => x.nombre_pasivo)
  return nombres.length === 1 && /leasing/i.test(nombres[0]) ? 'deuda del leasing' : 'deuda'
}

// ───────────── La frase ─────────────

const p = (texto: string, c: Calc | null = null, titulo?: string): ParteFraseBalance => ({ texto, calc: c ? vista(c) : null, ...(titulo ? { titulo } : {}) })
const fm = (c: Calc, m: Moneda) => (c.valor === null ? 'sin dato' : m === 'ARS' ? compacto(c.valor, 'ARS') : monto(c.valor, 'USD', { decimales: 0 }))

/** Partes sobre un total, con su traza, y su texto redondeado a enteros que suman 100% (resto mayor). */
function cuotas(partes: { nombre: string; calc: Calc }[], total: Calc, explicacion: string): { nombre: string; calc: Calc; texto: string }[] | null {
  if (total.valor === null || total.valor.isZero() || partes.some((x) => x.calc.valor === null)) return null
  const fr = partes.map((x) => ({
    nombre: x.nombre,
    calc: calc(
      (x.calc.valor as Decimal).div(total.valor as Decimal),
      `${monto(x.calc.valor as Decimal, 'ARS', { decimales: 2 })} ÷ ${monto(total.valor as Decimal, 'ARS', { decimales: 2 })} = ${porcentaje((x.calc.valor as Decimal).div(total.valor as Decimal), { decimales: 2 })}`,
      [deCalc(x.nombre, x.calc, 'ARS'), deCalc('Total', total, 'ARS')],
      { explicacion },
    ),
  }))
  const r = restoMayor(
    '100',
    fr.map((x) => (x.calc.valor as Decimal).times(100)),
    0,
  )
  return fr.map((x, i) => ({ ...x, texto: `${numero(r.partes[i], 0)}%` }))
}

function armarFrase(pn: PatrimonioNeto, sinTexto: string | null, sinBienes: boolean, titularParcial: boolean): ParteFraseBalance[] {
  const fin = pn.financiero
  if (sinBienes) {
    return [
      p('Lo invertible suma '),
      p(fm(fin.ars, 'ARS'), fin.ars, 'Lo invertible (financiero)'),
      p(' ('),
      p(fm(fin.usd, 'USD'), fin.usd, 'Lo invertible (financiero)'),
      p('). Para el patrimonio neto faltan tus bienes (casa, auto): los cargás en Datos › Bienes.'),
    ]
  }
  const firmeArs = pn.sin_financiados.ars
  const libres = pn.bienes_libres.filter((i) => i.valor_ars.valor !== null)
  const sobreFirme = cuotas(
    [...libres.map((i) => ({ nombre: conArticulo(i.nombre), calc: i.valor_ars })), { nombre: 'lo invertible', calc: fin.ars }],
    firmeArs,
    'Qué parte de lo firme (financiero + bienes sin deuda) es esta partida.',
  )
  const tituloFirme = sinTexto ? mayuscula(sinTexto) : 'Lo firme'
  const reparto = (cola: string, capital: boolean): ParteFraseBalance[] => {
    // Con una sola parte no hay reparto que contar ("lo invertible es el 100%").
    if (!sobreFirme || sobreFirme.length < 2) return []
    const out: ParteFraseBalance[] = [p(cola)]
    sobreFirme.forEach((c, i) => {
      if (i > 0) out.push(p(i === sobreFirme.length - 1 ? '; ' : ', '))
      out.push(p(i === 0 ? `${capital ? mayuscula(c.nombre) : c.nombre} es el ` : `${c.nombre}, el `), p(c.texto, c.calc, `${mayuscula(c.nombre)}: parte de lo firme`))
    })
    out.push(p('.'))
    return out
  }
  if (titularParcial || pn.completo.ars.valor === null) {
    if (firmeArs.valor === null) {
      return [p('Tu patrimonio neto es '), p('sin dato', pn.completo.ars, 'Patrimonio neto'), p(`: ${sinPunto(pn.completo.ars.motivo ?? 'falta una partida')}.`)]
    }
    return [
      p('Tenés '),
      p(fm(firmeArs, 'ARS'), firmeArs, tituloFirme),
      p(' ('),
      p(fm(pn.sin_financiados.usd, 'USD'), pn.sin_financiados.usd, tituloFirme),
      p(`)${sinTexto ? ` ${sinTexto.replace(/^sin /, 'sin contar ')}` : ''}.`),
      ...reparto(' ', true),
    ]
  }
  const estimado = pn.completo.ars.etiquetas.includes('estimado')
  if (estimado) {
    return [
      p('Tu patrimonio neto es '),
      p(fm(pn.completo.ars, 'ARS'), pn.completo.ars, `Patrimonio neto · ${deudaEnPalabras(pn)} estimada`),
      p(' ('),
      p(fm(pn.completo.usd, 'USD'), pn.completo.usd, `Patrimonio neto · ${deudaEnPalabras(pn)} estimada`),
      p(`), con la ${deudaEnPalabras(pn)} estimada. ${sinTexto ? mayuscula(sinTexto) : 'Sin los bienes financiados'}, `),
      p(fm(firmeArs, 'ARS'), firmeArs, tituloFirme),
      p(' ('),
      p(fm(pn.sin_financiados.usd, 'USD'), pn.sin_financiados.usd, tituloFirme),
      p(').'),
      ...reparto(' De eso, ', false),
    ]
  }
  // Firme: el patrimonio neto a secas, repartido entre lo invertible, los bienes libres y tu parte de cada bien financiado.
  const sobreNeto = cuotas(
    [
      { nombre: 'lo invertible', calc: fin.ars },
      ...libres.map((i) => ({ nombre: conArticulo(i.nombre), calc: i.valor_ars })),
      ...pn.financiados.map((x) => ({ nombre: `tu parte de ${conArticulo(x.bien.nombre)}`, calc: x.participacion.ars })),
    ],
    pn.completo.ars,
    'Qué parte de tu patrimonio neto es esta partida.',
  )
  const out: ParteFraseBalance[] = [
    p('Tu patrimonio neto es '),
    p(fm(pn.completo.ars, 'ARS'), pn.completo.ars, 'Patrimonio neto'),
    p(' ('),
    p(fm(pn.completo.usd, 'USD'), pn.completo.usd, 'Patrimonio neto'),
    p(').'),
  ]
  if (sobreNeto && sobreNeto.length > 1) {
    out.push(p(' '))
    sobreNeto.forEach((c, i) => {
      if (i > 0) out.push(p(i === sobreNeto.length - 1 ? '; ' : ', '))
      out.push(p(i === 0 ? `${mayuscula(c.nombre)} es el ` : `${c.nombre}, el `), p(c.texto, c.calc, `${mayuscula(c.nombre)}: parte del patrimonio neto`))
    })
    out.push(p('.'))
  }
  return out
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const sinPunto = (s: string) => s.trim().replace(/\.+$/, '')

// ───────────── La vista ─────────────

function vacia(h: Hechos, hoy: Fecha, agruparSel: Agrupar): VistaBalance {
  const n = sinDato('Todavía no hay cargas: el balance se arma con tu primera carga y tus bienes.')
  const nada = parDe(n, n)
  const nv = vista(n)
  const sinComp = { moneda: [], clase: [], liquidez: [] }
  void h
  return {
    estado: 'sin_cargas',
    hoy,
    fecha: null,
    fechas: [],
    ultima: true,
    ccl: vista(sinDato('Todavía no cargaste un CCL.')),
    fecha_ccl: null,
    ccl_fuente: 'sin CCL cargado',
    agrupar: agruparSel,
    sin_texto: null,
    titular: { rotulo: 'Patrimonio neto', valor: nada, parcial: false, estimado: false, chips: [], nota: null, firme: null, accion: { etiqueta: 'Hacer la primera carga', href: '/carga' } },
    frase: [p('Todavía no hay cargas: el balance se arma con tu primera carga y tus bienes.')],
    activo: { financiero: nada, financiero_peso: nv, financiero_pct: null, grupos: [], bienes: [], bienes_total: nada, bienes_peso: nv, bienes_pct: null, total: nada, total_peso: nv, total_pct: null, total_chips: [], tramos: [] },
    pasivo: { filas: [], total: nada, peso: nv, pct: null },
    neto: { completo: nada, sin_financiados: nada, origen_deuda: null, excluidos: [], lineas: [] },
    indicadores: [],
    comparativo: null,
    composicion: { financiero: sinComp, total: sinComp },
    serie: [],
  }
}

/**
 * La cifra grande del Balance sola, a la última fecha de carga: para la
 * tarjeta de patrimonio de Hoy (plan §10.5), que así dice lo mismo que el
 * Balance ("Patrimonio neto · deuda del leasing estimada" con lo firme debajo,
 * o "sin la camioneta" con parcial). null sin cargas.
 */
export function titularBalance(h: Hechos, hoy: Fecha, extras: ExtrasBalance = {}): (VistaBalance['titular'] & { fecha: Fecha }) | null {
  const fechas = fechasDeCarga(h)
  const fecha = fechas.at(-1)
  if (!fecha) return null
  const f = foto(h, fecha, { hoy })
  const pn = patrimonioNeto(f, h.bienes, extras.segunCuadro?.(fecha) ?? new Map<number, DobleCalc>(), h.pasivos)
  const sinBienes = h.bienes.filter((b) => b.activo_bool).length === 0
  return { ...armarTitular(pn, textoSin(pn), sinBienes), fecha }
}

export function armarBalance(h: Hechos, hoy: Fecha, pedido: PedidoBalance = {}, extras: ExtrasBalance = {}): VistaBalance {
  const agruparSel = agruparValido(pedido.agrupar)
  const fechas = fechasDeCarga(h)
  if (fechas.length === 0) return vacia(h, hoy, agruparSel)
  const ultima = fechas[fechas.length - 1]
  const fecha = pedido.fecha && fechas.includes(pedido.fecha) ? pedido.fecha : ultima
  // "Viejo" se mide contra el día del balance; el último, contra hoy.
  const hoyFoto = fecha === ultima ? hoy : fecha
  const feriados = conjuntoFeriados(h.feriados, 'AR')
  const ix = indexar(h)
  const f: Foto = foto(h, fecha, { hoy: hoyFoto, ix })
  const segun = extras.segunCuadro?.(fecha) ?? new Map<number, DobleCalc>()
  const pn = patrimonioNeto(f, h.bienes, segun, h.pasivos)
  const activoArs = pn.activo.ars
  const sinBienes = h.bienes.filter((b) => b.activo_bool).length === 0
  const sinTexto = textoSin(pn)

  // ── Activo
  const financiadoDe = new Map(pn.financiados.map((x) => [x.bien.clave, x]))
  const gruposBase = agrupar(financieros(f), agruparSel).map((g) => ({
    clave: g.clave,
    nombre: g.nombre,
    filas: g.filas.map((i) => filaDe(i, activoArs, hoyFoto, feriados, fecha)),
    total: par(g.total),
    peso: pesoSobre(g.total.ars, activoArs, g.nombre, 'Qué parte de tu activo total es este grupo.'),
  }))
  const itemsBien = f.items.filter((i) => i.clase === 'bien')
  const bienesBase = itemsBien.map((i) => filaDe(i, activoArs, hoyFoto, feriados, fecha, financiadoDe.get(i.clave) ?? null))
  // Redondeo por resto mayor en dos niveles: primero financiero y cada bien
  // (suman 100,0%), después las partidas de lo financiero (suman lo que se ve
  // del financiero). La tabla, los subtotales y la tarjeta muestran lo mismo.
  const filasFin = gruposBase.flatMap((g) => g.filas)
  const enPct = (c: CalcVista) => (c.valor === null ? null : new Decimal(c.valor).times(100))
  const finPeso = pesoSobre(pn.financiero.ars, activoArs, 'Financiero', 'Qué parte de tu activo es lo financiero.')
  const arriba = [finPeso, ...bienesBase.map((b) => b.peso)].map(enPct)
  const hojasFin = filasFin.map((x) => enPct(x.peso))
  const pctDe = new Map<string, string | null>()
  let financieroPct: string | null = null
  if (arriba.every((x) => x !== null) && hojasFin.every((x) => x !== null) && arriba.length) {
    const top = repartir(new Decimal(100), arriba as Decimal[], 1)
    financieroPct = top[0].toFixed(1)
    bienesBase.forEach((b, i) => pctDe.set(b.clave, top[i + 1].toFixed(1)))
    repartir(top[0], hojasFin as Decimal[], 1).forEach((x, i) => pctDe.set(filasFin[i].clave, x.toFixed(1)))
  }
  const sumaPct = (claves: string[]): string | null => {
    const xs = claves.map((k) => pctDe.get(k) ?? null)
    return xs.length === 0 || xs.some((x) => x === null) ? null : xs.reduce((a, x) => a.plus(x as string), new Decimal(0)).toFixed(1)
  }
  const grupos: GrupoVista[] = gruposBase.map((g) => ({
    ...g,
    filas: g.filas.map((x) => ({ ...x, pct: pctDe.get(x.clave) ?? null })),
    pct: sumaPct(g.filas.map((x) => x.clave)),
  }))
  const bienes: FilaBalance[] = bienesBase.map((x) => ({ ...x, pct: pctDe.get(x.clave) ?? null }))
  const bienesTotal: DobleCalc = {
    ars: sumaBienes(itemsBien, 'ARS'),
    usd: sumaBienes(itemsBien, 'USD'),
  }
  const financieroPeso = finPeso
  const anchoDe = (c: CalcVista) => (c.valor !== null && new Decimal(c.valor).gt(0) ? `${new Decimal(c.valor).times(100).toDecimalPlaces(4).toFixed()}%` : null)
  const tramos: SegmentoBalance[] = [
    { clave: 'financiero', nombre: 'Financiero', color: COLOR_FINANCIERO, valor: par(pn.financiero), peso: financieroPeso, regla: null, pct: financieroPct, ancho: anchoDe(financieroPeso) },
    ...bienes.map((b) => ({ clave: b.clave, nombre: b.nombre, color: b.color, valor: b.valor, peso: b.peso, regla: null, pct: b.pct, ancho: anchoDe(b.peso) })),
  ]

  // ── Pasivo
  const referencias = extras.referencia?.(fecha) ?? new Map()
  const posterior = posteriorDe(h, fechas, fecha)
  const filasPasivo: FilaPasivo[] = [
    ...pn.financiados.map((x) => filaPasivoFinanciado(x, activoArs, referencias.get(x.pasivo_id) ?? null, fecha, posterior(x.pasivo_id))),
    ...pn.deudas_sueltas.map((d) => filaPasivoSuelta(d, activoArs)),
    ...pn.huerfanas.map((d) => ({
      clave: d.clave,
      nombre: d.nombre,
      bien: null,
      origen: null,
      detalle: 'no se resta: falta cargar el bien que financia',
      fuente: null,
      valor: parDe(sinDato(`No cargaste el bien que financia ${laDeuda(d.nombre)}: el bien y su deuda entran juntos.`), sinDato(`No cargaste el bien que financia ${laDeuda(d.nombre)}: el bien y su deuda entran juntos.`)),
      peso: vista(sinDato('No se resta sin su bien.')),
      pct: null,
      chips: [],
      accion: { etiqueta: 'Cargar el bien', href: '/datos/bienes' },
      referencia: null,
    })),
  ]

  const pesoPasivo = pesoSobre(pn.pasivo.ars, activoArs, 'Pasivo', 'Qué parte de tu activo debés.')

  // ── Patrimonio neto
  const lineaNeto = (x: Omit<LineaNeto, 'peso' | 'pct' | 'valor'>, d: DobleCalc): LineaNeto => {
    const peso = pesoSobre(d.ars, activoArs, x.nombre, 'Qué parte de tu activo es este renglón.')
    return { ...x, valor: par(d), peso, pct: pct1(peso) }
  }
  const lineas: LineaNeto[] = [
    lineaNeto({
      clave: 'completo',
      nombre: 'Patrimonio neto',
      detalle: pn.completo.ars.etiquetas.includes('estimado') ? `activo − pasivo, con la ${deudaEnPalabras(pn)} estimada` : 'activo − pasivo',
      principal: true,
    }, pn.completo),
  ]
  if (pn.excluidos.length && sinTexto) {
    lineas.push(lineaNeto({ clave: 'sin_financiados', nombre: mayuscula(sinTexto), detalle: `${componentesFirme(pn)} · firme`, principal: false }, pn.sin_financiados))
  }
  for (const x of pn.financiados) {
    lineas.push(
      lineaNeto({
        clave: `participacion:${x.bien.clave}`,
        nombre: `Tu parte de ${conArticulo(x.bien.nombre)}`,
        detalle: x.deuda ? `valor − ${x.deuda.origen === 'informada' ? 'valor de cancelación' : 'deuda estimada'}` : 'valor − deuda: falta la deuda',
        principal: false,
      }, x.participacion),
    )
  }

  // Los porcentajes del pasivo y del patrimonio neto, por resto mayor como los
  // del activo: pasivo + patrimonio neto = 100,0%, lo firme + tu parte de cada
  // bien financiado = patrimonio neto, y las deudas suman el pasivo.
  const pctPasivo = cuadrarPct(lineas, filasPasivo, pesoPasivo)

  // ── La cifra grande
  const titular = armarTitular(pn, sinTexto, sinBienes, posterior)

  // ── Composición (del activo, sin restar deudas)
  const colores = { clase: COLOR_CLASE, nombreClase: NOMBRE_CLASE }
  const perimetros: Record<PerimetroComposicion, ItemFoto[]> = {
    financiero: financieros(f),
    total: [...financieros(f), ...itemsBien],
  }
  const ejes: EjeComposicion[] = ['moneda', 'clase', 'liquidez']
  const comp = {} as VistaBalance['composicion']
  for (const per of ['financiero', 'total'] as const) {
    comp[per] = {} as Record<EjeComposicion, SegmentoBalance[]>
    for (const eje of ejes) comp[per][eje] = redondearTramos(composicion(perimetros[per], eje, 'ARS', colores).map(segmentoDe))
  }

  // ── Comparativo: contra otra fecha de carga anterior (por defecto, la primera)
  const comparativo = armarComparativo(h, fechas, fecha, pedido.comparar ?? null, pn, itemsBien, extras, ix, sinTexto)

  // ── Evolución
  const hasta = fechas.filter((d) => d <= fecha).slice(-MAX_SERIE)
  const serie: PuntoBalance[] = serieBalance(h, hasta, hoyFoto, extras.segunCuadro)

  return {
    estado: 'con_datos',
    hoy,
    fecha,
    fechas,
    ultima: fecha === ultima,
    ccl: vista(f.ccl),
    fecha_ccl: f.fecha_ccl,
    ccl_fuente: fuenteCcl(f),
    agrupar: agruparSel,
    sin_texto: sinTexto,
    titular,
    frase: armarFrase(pn, sinTexto, sinBienes, titular.parcial),
    activo: {
      financiero: par(pn.financiero),
      financiero_peso: financieroPeso,
      financiero_pct: financieroPct,
      grupos,
      bienes,
      bienes_total: par(bienesTotal),
      bienes_peso: pesoSobre(bienesTotal.ars, activoArs, 'Bienes', 'Qué parte de tu activo son tus bienes.'),
      bienes_pct: sumaPct(bienes.map((b) => b.clave)),
      total_pct: financieroPct === null ? null : '100.0',
      total_chips: chipsDe(pn.activo.ars, [], ['parcial']),
      total: par(pn.activo),
      total_peso: pesoSobre(pn.activo.ars, activoArs, 'Activo total', 'El total contra el que se mide cada porcentaje: el activo es el 100%.'),
      tramos,
    },
    pasivo: {
      filas: filasPasivo,
      total: par(pn.pasivo),
      peso: pesoPasivo,
      pct: pctPasivo,
    },
    neto: {
      completo: par(pn.completo),
      sin_financiados: par(pn.sin_financiados),
      origen_deuda: pn.origen_deuda,
      excluidos: pn.excluidos.map((x) => ({ nombre: x.nombre, motivo: x.motivo })),
      lineas,
    },
    indicadores: indicadores(pn).map(
      (x): IndicadorVista => ({
        clave: x.clave,
        nombre: x.nombre,
        unidad: x.unidad,
        valor: vista(x.valor),
        texto: x.valor.valor === null ? null : x.unidad === 'veces' ? `${numero(x.valor.valor, 1)} veces` : porcentaje(x.valor.valor, { decimales: 1 }),
        lectura: x.lectura,
        chips: chipsDe(x.valor),
      }),
    ),
    comparativo,
    composicion: comp,
    serie,
  }
}

/** El balance de `fecha` comparado con otra fecha de carga anterior: los renglones principales y lo que cambió cada uno. */
function armarComparativo(
  h: Hechos,
  fechas: readonly Fecha[],
  fecha: Fecha,
  pedida: string | null,
  pn: PatrimonioNeto,
  itemsBien: ItemFoto[],
  extras: ExtrasBalance,
  ix: ReturnType<typeof indexar>,
  sinTexto: string | null,
): ComparativoVista | null {
  const opciones = fechas.filter((d) => d < fecha)
  if (opciones.length === 0) return null
  const porDefecto = opciones[0]
  const contra = pedida && opciones.includes(pedida) ? pedida : porDefecto
  const f0 = foto(h, contra, { hoy: contra, ix })
  const pn0 = patrimonioNeto(f0, h.bienes, extras.segunCuadro?.(contra) ?? new Map<number, DobleCalc>(), h.pasivos)
  const bienes0 = f0.items.filter((i) => i.clase === 'bien')
  const linea = (clave: LineaComparativa['clave'], nombre: string, a: DobleCalc, b: DobleCalc, principal = false): LineaComparativa => {
    const ars = diferencia(a.ars, b.ars, 'ARS', fecha, contra, nombre)
    const usd = diferencia(a.usd, b.usd, 'USD', fecha, contra, nombre)
    const principal_ = etiquetaPrincipal([...a.ars.etiquetas, ...b.ars.etiquetas.filter((e) => e !== 'parcial' || a.ars.etiquetas.includes('parcial'))])
    return {
      chip: principal_ ? NOMBRE_ETIQUETA[principal_] : null,
      clave,
      nombre,
      actual: par(a),
      anterior: par(b),
      diferencia: parDe(ars, usd),
      sin_cambios: { ars: ars.valor !== null && ars.valor.isZero(), usd: usd.valor !== null && usd.valor.isZero() },
      principal,
    }
  }
  const lineas: LineaComparativa[] = [
    linea('financiero', 'Financiero', pn.financiero, pn0.financiero),
    ...(itemsBien.length || bienes0.length
      ? [linea('bienes', 'Bienes', { ars: sumaBienes(itemsBien, 'ARS'), usd: sumaBienes(itemsBien, 'USD') }, { ars: sumaBienes(bienes0, 'ARS'), usd: sumaBienes(bienes0, 'USD') })]
      : []),
    linea('activo', 'Total del activo', pn.activo, pn0.activo, true),
    linea('pasivo', 'Total del pasivo', pn.pasivo, pn0.pasivo, true),
    linea('completo', 'Patrimonio neto', pn.completo, pn0.completo, true),
    ...(sinTexto ? [linea('sin_financiados', mayuscula(sinTexto), pn.sin_financiados, pn0.sin_financiados)] : []),
  ]
  return { fecha: contra, por_defecto: porDefecto, opciones, lineas }
}

/** "tipeado el mié 14/10 (carga #33)"; si ese día no tiene CCL, lo dice. */
function fuenteCcl(f: Foto): string {
  if (!f.fecha_ccl || f.ccl.valor === null) return 'sin CCL cargado: los dólares son "sin dato"'
  const carga = f.ccl.insumos[0]?.origen?.carga_id
  const base = `tipeado el ${fechaCorta(f.fecha_ccl)}${carga ? ` (carga #${carga})` : ''}`
  return f.fecha_ccl === f.fecha ? base : `${base}: el ${fechaCorta(f.fecha)} no tiene CCL y se usa el último tipeado`
}

function sumaBienes(items: ItemFoto[], m: Moneda): Calc {
  if (items.length === 0) return sinDato('Todavía no cargaste tus bienes (casa, auto): los cargás en Datos › Bienes.')
  const partes = items.map((i) => ({ nombre: i.nombre, calc: m === 'ARS' ? i.valor_ars : i.valor_usd }))
  const faltan = partes.filter((x) => x.calc.valor === null)
  const insumos = partes.map((x) => deCalc(x.nombre, x.calc, m))
  const expl = m === 'ARS' ? 'Tus bienes en pesos (cada uno a su valuación; los valuados en dólares, al CCL de la foto).' : 'Tus bienes en dólares (los valuados en pesos, al CCL de la foto).'
  if (faltan.length) {
    const conocida = partes.filter((x) => x.calc.valor !== null).reduce((a, x) => a.plus(x.calc.valor as Decimal), new Decimal(0))
    return faltan.length === partes.length
      ? sinDato(faltan[0].calc.motivo ?? 'Falta la valuación de tus bienes.', insumos, { explicacion: expl })
      : sinDato(`Falta ${faltan.map((x) => x.nombre).join(', ')}. Suma parcial (${partes.length - faltan.length} de ${partes.length}): ${monto(conocida, m, { decimales: 2 })}.`, insumos, { etiquetas: ['parcial'], explicacion: expl })
  }
  const s = partes.reduce((a, x) => a.plus(x.calc.valor as Decimal), new Decimal(0))
  return calc(s, `${partes.map((x) => monto(x.calc.valor as Decimal, m, { decimales: 2 })).join(' + ')} = ${monto(s, m, { decimales: 2 })}`, insumos, { explicacion: expl })
}

function segmentoDe(x: PartidaComposicion): Omit<SegmentoBalance, 'pct' | 'ancho'> {
  return { clave: x.clave, nombre: x.nombre, color: x.color, valor: par(x.valor), peso: vista(x.peso), regla: x.regla }
}

/**
 * Un valor de cancelación cargado con fecha posterior a la de este balance
 * todavía no cuenta en él: el balance está al cierre de su carga, como Hoy y
 * Flujo. En vez de pedir que lo cargues, dice desde qué balance cuenta (o que
 * entra con tu próxima carga).
 */
export function posteriorDe(h: Pick<Hechos, 'pasivo_saldos'>, fechas: readonly Fecha[], fecha: Fecha): (pasivo_id: number) => string | null {
  return (pasivo_id) => {
    const fi = h.pasivo_saldos
      .filter((s) => s.pasivo_id === pasivo_id && s.naturaleza === 'informado' && s.fecha > fecha)
      .map((s) => s.fecha)
      .sort()[0]
    if (!fi) return null
    const desde = fechas.find((x) => x >= fi)
    return `Ya cargaste el valor de cancelación del ${fechaCorta(fi)}: ${desde ? `cuenta desde el balance del ${fechaCorta(desde)}` : 'entra con tu próxima carga'}.`
  }
}

function filaPasivoFinanciado(x: Financiado, activo: Calc, ref: { falta: DobleCalc; cuotas: number | null; nota: string } | null, fecha: Fecha, posterior: string | null = null): FilaPasivo {
  const sinDeuda = sinDato(`Falta la deuda ${deLaDeuda(x.nombre_pasivo)}: el valor de cancelación (sin penalidad) que te pase la leasera.`, [], {
    explicacion: 'Un leasing no tiene "capital pendiente" como un préstamo: lo que se resta es el valor de cancelación anticipada sin la penalidad (D-130).',
  })
  const valor = x.deuda ? x.deuda.valor : { ars: sinDeuda, usd: sinDeuda }
  const referencia: ReferenciaContrato | null = ref ? { valor: par(ref.falta), cuotas: ref.cuotas, nota: ref.nota } : null
  const pesoFila = pesoSobre(valor.ars, activo, x.nombre_pasivo, 'Qué parte de tu activo debés de esta deuda.')
  return {
    clave: x.pasivo?.clave ?? `d:${x.pasivo_id}`,
    nombre: x.nombre_pasivo,
    bien: x.bien.nombre,
    origen: x.deuda?.origen ?? null,
    detalle: x.deuda?.origen !== 'informada' && posterior ? `${origenEnPalabras(x.deuda, fecha)} · ${posterior}` : origenEnPalabras(x.deuda, fecha),
    fuente: x.deuda?.fuente ?? null,
    valor: par(valor),
    peso: pesoFila,
    pct: pct1(pesoFila),
    chips: x.deuda?.origen === 'estimada' ? ['provisoria'] : [],
    accion: x.deuda?.origen === 'informada' || posterior ? null : { etiqueta: x.deuda ? 'Cargar el valor de la leasera' : 'Cargar el valor de cancelación', href: '/datos/leasing' },
    referencia,
  }
}

function filaPasivoSuelta(d: ItemFoto, activo: Calc): FilaPasivo {
  const pos = (c: Calc, m: Moneda): Calc =>
    c.valor === null ? c : calc(c.valor.negated(), `deuda = ${monto(c.valor.negated(), m, { decimales: 2 })}`, [deCalc(`${d.nombre} (resta en la foto)`, c, m)], { explicacion: 'Lo que falta pagar de esta deuda.' })
  const ars = pos(d.valor_ars, 'ARS')
  const pesoSuelta = pesoSobre(ars, activo, d.nombre, 'Qué parte de tu activo debés de esta deuda.')
  return {
    clave: d.clave,
    nombre: d.nombre,
    bien: null,
    origen: d.valor_ars.valor === null ? null : d.precio.etiquetas.includes('estimado') ? 'estimada' : 'informada',
    detalle: d.fecha_dato ? `saldo del ${fechaCorta(d.fecha_dato)}` : 'sin saldo cargado',
    fuente: null,
    valor: parDe(ars, pos(d.valor_usd, 'USD')),
    peso: pesoSuelta,
    pct: pct1(pesoSuelta),
    chips: [],
    accion: d.valor_ars.valor === null ? { etiqueta: 'Cargar el saldo', href: '/datos/leasing' } : null,
    referencia: null,
  }
}

function armarTitular(pn: PatrimonioNeto, sinTexto: string | null, sinBienes: boolean, posterior: (pasivo_id: number) => string | null = () => null): VistaBalance['titular'] {
  if (sinBienes) {
    const falta = sinDato<Decimal>('Faltan tus bienes (casa, auto): los cargás en Datos › Bienes.', [deCalc('Financiero (lo que sí cargaste)', pn.financiero.ars, 'ARS')], {
      etiquetas: ['parcial'],
      explicacion: 'Tu patrimonio neto: financiero + bienes − deudas (D-03). Sin tus bienes no hay patrimonio neto.',
    })
    const faltaUsd = sinDato<Decimal>('Faltan tus bienes (casa, auto): los cargás en Datos › Bienes.', [deCalc('Financiero (lo que sí cargaste)', pn.financiero.usd, 'USD')], {
      etiquetas: ['parcial'],
      explicacion: 'Tu patrimonio neto, en dólares: financiero + bienes − deudas (D-03).',
    })
    return {
      rotulo: 'Patrimonio neto',
      valor: parDe(falta, faltaUsd),
      parcial: true,
      estimado: false,
      chips: chipsDe(falta, ['parcial'], ['parcial']),
      nota: 'Faltan tus bienes: el patrimonio neto se arma cuando los cargues.',
      firme: { rotulo: 'Financiero · suma parcial, sin tus bienes', valor: par(pn.financiero), chips: chipsDe(pn.financiero.ars, [], ['estimado']) },
      accion: { etiqueta: 'Cargar tus bienes', href: '/datos/bienes' },
    }
  }
  const completo = pn.completo
  // Con una de las dos monedas alcanza: sin CCL, la otra es "sin dato" y su
  // motivo pide el CCL (no el valor de cancelación, que ya está).
  if (completo.ars.valor !== null || completo.usd.valor !== null) {
    const estimado = [...completo.ars.etiquetas, ...completo.usd.etiquetas].includes('estimado')
    if (!estimado) return { rotulo: 'Patrimonio neto', valor: par(completo), parcial: false, estimado: false, chips: chipsDe(completo.ars), nota: null, firme: null, accion: null }
    const fin = pn.financiados.find((x) => x.deuda && x.deuda.origen !== 'informada')
    const d = fin?.deuda ?? null
    const yaCargado = fin ? posterior(fin.pasivo_id) : null
    return {
      rotulo: `Patrimonio neto · ${deudaEnPalabras(pn)} estimada`,
      valor: par(completo),
      parcial: false,
      estimado: true,
      chips: chipsDe(completo.ars, ['estimado'], ['estimado']),
      nota: `${
        d?.origen === 'segun_cuadro'
          ? 'La deuda sale del cuadro de marcha, a la tasa del contrato, hasta que la leasera te pase el valor de cancelación.'
          : `La deuda es la que estimaste${d?.fecha ? ` el ${fechaCorta(d.fecha)}` : ''} (provisoria) hasta que la leasera te pase el valor de cancelación.`
      }${yaCargado ? ` ${yaCargado}` : ''}`,
      firme: { rotulo: `${sinTexto ? mayuscula(sinTexto) : 'Sin los bienes financiados'}: ${componentesFirme(pn)}`, valor: par(pn.sin_financiados), chips: chipsDe(pn.sin_financiados.ars) },
      accion: yaCargado ? null : { etiqueta: 'Cargar el valor de la leasera', href: '/datos/leasing' },
    }
  }
  const firme = pn.sin_financiados
  if (firme.ars.valor !== null && sinTexto) {
    const faltaDeuda = pn.financiados.filter((x) => !x.deuda)
    const faltaValor = pn.financiados.filter((x) => x.bien.valor_ars.valor === null)
    const notas: string[] = []
    const yaCargados = faltaDeuda.map((x) => posterior(x.pasivo_id))
    faltaDeuda.forEach((x, i) => {
      const v = x.bien.valor_ars.valor
      notas.push(yaCargados[i] ?? `${mayuscula(conArticulo(x.bien.nombre))}${v === null ? '' : ` (${compacto(v, 'ARS')})`} y ${/leasing/i.test(x.nombre_pasivo) ? 'su leasing' : 'su deuda'} entran juntos cuando cargues el valor de cancelación.`)
    })
    for (const x of faltaValor) if (!faltaDeuda.includes(x)) notas.push(`${mayuscula(conArticulo(x.bien.nombre))} entra con su deuda cuando cargues su valuación.`)
    const sinVal = pn.excluidos.filter((x) => x.motivo === 'no tiene valuación')
    if (sinVal.length) notas.push(`${mayuscula(enLista(sinVal.map((x) => x.nombre)))} entra cuando cargues su valuación.`)
    const accion: Accion | null = faltaDeuda.length
      ? yaCargados.every(Boolean)
        ? null
        : { etiqueta: 'Cargar el valor de cancelación', href: '/datos/leasing' }
      : { etiqueta: 'Cargar valuación', href: '/datos/bienes' }
    // La cifra grande deja algo afuera: su traza lo dice y lleva "parcial" (lo firme, en su renglón, no).
    const suDeuda = faltaDeuda.length === 1 ? (/leasing/i.test(faltaDeuda[0].nombre_pasivo) ? 'su leasing' : 'su deuda') : 'sus deudas'
    const queEs = `Lo que tenés, ${sinTexto}: ${faltaDeuda.length ? `${enLista(faltaDeuda.map((x) => x.bien.nombre))} y ${suDeuda} entran juntos cuando la leasera te pase el valor de cancelación.` : 'lo que falta entra cuando cargues su valuación.'}`
    const parcialDe = (c: CalcVista): CalcVista => ({ ...c, etiquetas: unicas([...c.etiquetas, 'parcial']), explicacion: `${queEs} ${c.explicacion ?? ''}`.trim() })
    const v = par(firme)
    return { rotulo: `Patrimonio neto ${sinTexto}`, valor: { ars: parcialDe(v.ars), usd: parcialDe(v.usd) }, parcial: true, estimado: false, chips: chipsDe(firme.ars, ['parcial'], ['parcial']), nota: notas.join(' ') || null, firme: null, accion }
  }
  // Falta algo de lo financiero (un precio, un CCL): no hay ni la cifra firme.
  return {
    rotulo: 'Patrimonio neto',
    valor: par(completo),
    parcial: true,
    estimado: false,
    chips: chipsDe(completo.ars, ['parcial'], ['parcial']),
    nota: completo.ars.motivo ?? null,
    firme: null,
    accion: { etiqueta: 'Cargar', href: '/carga' },
  }
}
