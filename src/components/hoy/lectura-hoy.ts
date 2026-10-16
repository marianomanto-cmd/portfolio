// La lectura de Hoy (D-157, anatomía 2; handoff, captura 01): una frase en
// serif con la respuesta a "¿Cómo estoy hoy?", armada con la frase del día
// (lo invertible: el patrimonio financiero, D-03) y un solo énfasis. Pura,
// con test (lectura-hoy.test.ts). Las cifras salen redondeadas como las
// muestra la pantalla (Mostrar: lo que se ve suma exacto lo que se ve) y cada
// una abre su traza. Toda cifra va en pesos y en dólares (spec: "cualquier
// número en una sola moneda está mal"). La frase completa, con cada parte,
// sigue abajo, en el detalle.

import { Decimal } from '@/lib/domain/dinero'
import { fechaCorta, sumarDias } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import type { FraseDelDia, VistaHoy } from '@/lib/vistas/contratos'
import { cifra, enfasis, texto, type ParteLectura } from '@/components/pantalla/lectura'
import { enLista, fraccionEnPalabras } from './palabras'
import type { Mostrar } from './redondeo-frase'

/** Desde cuándo mide: "Hoy", "Ayer", "El mié 14/10" o, con un hueco de días hábiles, "Desde el vie 09/10". */
export function cuandoFue(f: Pick<FraseDelDia, 'desde' | 'hasta' | 'dias_habiles'>, hoy: Fecha): string {
  if (f.dias_habiles > 1) return `Desde el ${fechaCorta(f.desde)}`
  if (f.hasta === hoy) return 'Hoy'
  if (sumarDias(f.hasta, 1) === hoy) return 'Ayer'
  return `El ${fechaCorta(f.hasta)}`
}

const signo = (v: string | null): -1 | 0 | 1 => {
  if (v === null) return 0
  const d = new Decimal(v)
  return d.isZero() ? 0 : d.isNegative() ? -1 : 1
}

const TITULO = {
  ars: 'Variación de lo invertible · en pesos',
  usd: 'Variación de lo invertible · en dólares',
}

/**
 * La segunda oración, en pesos: de dónde vino el cambio. Con las dos partes
 * del mismo lado, la que más pesa y cuánto ("Dos tercios vinieron del dólar,
 * no de tus activos"); con una a favor y otra en contra, cuál lo puso.
 */
function deDondeVino(f: FraseDelDia, m: Mostrar): ParteLectura[] {
  const va = signo(m.valor(f.variacion.ars))
  const a = m.valor(f.activos.ars)
  const t = m.valor(f.tc.ars)
  const s = f.sin_atribuir ? m.valor(f.sin_atribuir.ars) : '0'
  if (a === null || t === null || s === null) return []
  const A = new Decimal(a)
  const T = new Decimal(t)
  const S = new Decimal(s)
  if (A.isZero() && T.isZero()) return S.isZero() ? [] : [texto(' Todo quedó '), enfasis('sin atribuir'), texto(': sin precio o saldo nuevo.')]
  if (S.abs().gte(A.abs().plus(T.abs()))) return [texto(' Casi todo quedó '), enfasis('sin atribuir'), texto(': hay partidas sin precio o saldo nuevo.')]
  const sa = A.isZero() ? 0 : A.isNegative() ? -1 : 1
  const st = T.isZero() ? 0 : T.isNegative() ? -1 : 1
  if (sa !== 0 && st !== 0 && sa !== st) {
    // Una suma y la otra resta: lo dice el lado del total.
    const puso = (va >= 0 ? st > 0 : st < 0) ? 'dolar' : 'activos'
    if (va >= 0) return puso === 'dolar' ? [texto(' Lo puso el '), enfasis('dólar'), texto(': tus activos restaron.')] : [texto(' Lo pusieron tus '), enfasis('activos'), texto(': el dólar restó.')]
    return puso === 'dolar' ? [texto(' Lo restó el '), enfasis('dólar'), texto(': tus activos sumaron.')] : [texto(' Lo restaron tus '), enfasis('activos'), texto(': el dólar sumó.')]
  }
  const dolar = T.abs().gte(A.abs())
  const parte = (dolar ? T : A).abs().div(A.abs().plus(T.abs())).toNumber()
  const fr = fraccionEnPalabras(parte)
  const sujeto = `${fr.antes}${fr.nucleo}`
  const Sujeto = sujeto.charAt(0).toLocaleUpperCase('es-AR') + sujeto.slice(1)
  if (va >= 0) {
    const verbo = fr.plural ? 'vinieron' : 'vino'
    return dolar
      ? [texto(` ${Sujeto} ${verbo} del `), enfasis('dólar'), texto(', no de tus activos.')]
      : [texto(` ${Sujeto} ${verbo} de tus `), enfasis('activos'), texto(', no del dólar.')]
  }
  const verbo = fr.plural ? 'se explican' : 'se explica'
  return dolar
    ? [texto(` ${Sujeto} ${verbo} por el `), enfasis('dólar'), texto(', no por tus activos.')]
    : [texto(` ${Sujeto} ${verbo} por tus `), enfasis('activos'), texto(', no por el dólar.')]
}

/**
 * La lectura de Hoy: qué le pasó a lo invertible desde la carga anterior, en
 * pesos y en dólares, y de dónde vino. Casos:
 * - una sola carga: "Primera carga guardada. Mañana vas a ver *qué cambió* y por qué."
 * - a la variación le falta una partida (D-65): lo dice, sin cifras;
 * - carga sin CCL nuevo, o carga express (solo tipos de cambio): lo que cambió
 *   queda sin atribuir, y la lectura lo dice;
 * - pesos y dólares con el mismo signo: "Ayer sumaste $ X y US$ Y. Dos tercios
 *   vinieron del *dólar*, no de tus activos.";
 * - con signos distintos: "Ayer sumaste $ X, pero perdiste US$ Y: subió el *dólar*."
 */
export function lecturaHoy(v: Pick<VistaHoy, 'frase' | 'hoy' | 'ccl_periodo'>, m: Mostrar): ParteLectura[] {
  const f = v.frase
  if (!f) return [texto('Primera carga guardada. Mañana vas a ver '), enfasis('qué cambió'), texto(' y por qué.')]
  const cuando = cuandoFue(f, v.hoy)
  const va = m.valor(f.variacion.ars)
  const vu = m.valor(f.variacion.usd)
  if (va === null || vu === null) {
    const faltan = f.faltan?.length ? f.faltan : null
    return [texto(`${cuando} no se puede saber cuánto cambió lo invertible: `), enfasis(faltan ? `${faltan.length > 1 ? 'faltan' : 'falta'} ${enLista(faltan)}` : 'falta un dato'), texto('.')]
  }
  const sa = signo(va)
  const su = signo(vu)
  const pesos = cifra(m.texto(f.variacion.ars, 'ARS', { abs: true }), f.variacion.ars, TITULO.ars, 'ARS')
  const dolares = cifra(m.texto(f.variacion.usd, 'USD', { abs: true }), f.variacion.usd, TITULO.usd, 'USD')
  const verbo = (s: number) => (s < 0 ? 'perdiste' : 'sumaste')
  const ccl = v.ccl_periodo?.variacion.valor ?? null
  const elDolar = (porDefecto: boolean): ParteLectura[] => {
    if (f.sin_ccl_nuevo || f.solo_tipos_de_cambio) return [texto('el cambio quedó '), enfasis('sin atribuir'), texto(' hasta tu próxima carga completa.')]
    const subio = ccl === null ? porDefecto : new Decimal(ccl).gt(0)
    return [texto(subio ? 'subió el ' : 'bajó el '), enfasis('dólar'), texto('.')]
  }
  if (sa === 0 && su === 0) return [texto(`${cuando} lo invertible quedó `), enfasis('igual'), texto(', en pesos y en dólares.')]
  if (sa === 0) return [texto(`${cuando} quedaste igual en pesos y ${verbo(su)} `), dolares, texto(' en dólares: '), ...elDolar(su < 0)]
  if (su === 0) return [texto(`${cuando} ${verbo(sa)} `), pesos, texto(' y en dólares quedaste '), enfasis('igual'), texto('.')]

  // Signos distintos: lo que pasó en pesos no es lo que pasó en dólares (spec: el ejemplo del 10% y el 12%).
  if (sa !== su) return [texto(`${cuando} ${verbo(sa)} `), pesos, texto(`, pero ${verbo(su)} `), dolares, texto(': '), ...elDolar(sa > 0)]

  const inicio = [texto(`${cuando} ${verbo(sa)} `), pesos, texto(' y '), dolares, texto('.')]
  if (f.sin_ccl_nuevo) return [...inicio, texto(' Sin CCL nuevo, no se sabe '), enfasis('cuánto fue el dólar'), texto(': queda sin atribuir.')]
  if (f.solo_tipos_de_cambio) return [...inicio, texto(' Cargaste solo tipos de cambio: queda '), enfasis('sin atribuir'), texto(' hasta tu próxima carga completa.')]
  const resto = deDondeVino(f, m)
  return resto.length ? [...inicio, ...resto] : [texto(`${cuando} ${verbo(sa)} `), pesos, texto(' y '), dolares, texto(': todavía '), enfasis('sin atribuir'), texto('.')]
}
