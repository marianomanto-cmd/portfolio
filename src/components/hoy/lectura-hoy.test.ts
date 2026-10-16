// La lectura de Hoy (D-157, anatomía 2): una frase con un solo énfasis que
// contesta "¿Cómo estoy hoy?" con lo invertible, en pesos y en dólares, y de
// dónde vino. Las cifras son las que muestra la pantalla (redondeadas juntas)
// y cada una abre su traza. Lo que falta se dice con palabras. Números
// inventados (D-24).
import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import type { FraseDelDia, VistaHoy } from '@/lib/vistas/contratos'
import { ejemploHoy, ejemploHoyVariante } from '@/lib/vistas/ejemplo'
import { lecturaPlana, validarLectura, type ParteLectura } from '@/components/pantalla/lectura'
import { cuandoFue, lecturaHoy } from './lectura-hoy'
import { Mostrar } from './redondeo-frase'

let n = 0
/** Un cálculo con fórmula propia (Mostrar los distingue por valor y fórmula). */
const c = (valor: string | null): CalcVista =>
  valor === null ? { valor: null, motivo: 'Falta un precio.', formula: 'sin dato', insumos: [], etiquetas: [] } : { valor, formula: `f${n++}`, insumos: [], etiquetas: [] }

/** Una frase del día: la variación y sus partes, en pesos y en dólares (activos + tc + sin atribuir = variación). */
function frase(x: {
  va: string | null
  vu: string | null
  aa?: string
  au?: string
  ta?: string
  tu?: string
  sa?: [string, string]
  desde?: string
  hasta?: string
  dias_habiles?: number
  solo?: boolean
  sinCcl?: boolean
  faltan?: string[]
}): FraseDelDia {
  return {
    desde: x.desde ?? '2026-10-13',
    hasta: x.hasta ?? '2026-10-14',
    dias_habiles: x.dias_habiles ?? 1,
    partes: [],
    variacion: { ars: c(x.va), usd: c(x.vu) },
    activos: { ars: c(x.aa ?? '0'), usd: c(x.au ?? '0') },
    tc: { ars: c(x.ta ?? '0'), usd: c(x.tu ?? '0') },
    sin_atribuir: x.sa ? { ars: c(x.sa[0]), usd: c(x.sa[1]) } : null,
    solo_tipos_de_cambio: x.solo ?? false,
    sin_ccl_nuevo: x.sinCcl ?? false,
    faltan: x.faltan,
  }
}

function partes(f: FraseDelDia | null, o: { hoy?: string; ccl?: string | null } = {}): ParteLectura[] {
  const v: Pick<VistaHoy, 'frase' | 'hoy' | 'ccl_periodo'> = {
    frase: f,
    hoy: o.hoy ?? '2026-10-15',
    ccl_periodo: o.ccl === undefined || o.ccl === null ? null : { desde: c('1500'), hasta: c('1515'), variacion: c(o.ccl) },
  }
  return lecturaHoy(v, new Mostrar(f, []))
}
const leer = (f: FraseDelDia | null, o: { hoy?: string; ccl?: string | null } = {}) => {
  const p = partes(f, o)
  // Toda lectura está bien armada: un solo énfasis, ninguna parte vacía y ninguna cifra en "sin dato".
  expect(validarLectura(p)).toEqual({ ok: true })
  return lecturaPlana(p)
}

describe('lecturaHoy', () => {
  it('con los datos del ejemplo: pesos y dólares con signos distintos, y por qué', () => {
    const v = ejemploHoy()
    expect(lecturaPlana(lecturaHoy(v, new Mostrar(v.frase, [v.financiero, v.total])))).toBe('Ayer sumaste $ 590.125, pero perdiste US$ 340: subió el dólar.')
    // Cada cifra abre la traza de la variación de lo invertible.
    const cifras = lecturaHoy(v, new Mostrar(v.frase, [v.financiero, v.total])).filter((p) => p.calc)
    expect(cifras.map((p) => [p.calc, p.titulo, p.moneda])).toEqual([
      [v.frase!.variacion.ars, 'Variación de lo invertible · en pesos', 'ARS'],
      [v.frase!.variacion.usd, 'Variación de lo invertible · en dólares', 'USD'],
    ])
  })

  it('carga express (solo tipos de cambio) y datos viejos', () => {
    const x = ejemploHoyVariante('express')
    expect(lecturaPlana(lecturaHoy(x, new Mostrar(x.frase, [x.financiero, x.total])))).toBe(
      'Ayer sumaste $ 49.560, pero perdiste US$ 478: el cambio quedó sin atribuir hasta tu próxima carga completa.',
    )
    const y = ejemploHoyVariante('viejo')
    expect(lecturaPlana(lecturaHoy(y, new Mostrar(y.frase, [y.financiero, y.total])))).toBe('El mié 14/10 sumaste $ 590.125, pero perdiste US$ 340: subió el dólar.')
  })

  it('sin frase (una sola carga): lo dice, sin cifras', () => {
    expect(leer(null)).toBe('Primera carga guardada. Mañana vas a ver qué cambió y por qué.')
  })

  it('a la variación le falta una partida (D-65): qué falta, nunca un cero', () => {
    expect(leer(frase({ va: null, vu: null, faltan: ['SPDR S&P 500 (CEDEAR)'] }))).toBe('Ayer no se puede saber cuánto cambió lo invertible: falta SPDR S&P 500 (CEDEAR).')
    expect(leer(frase({ va: null, vu: null, faltan: ['YPF', 'Pesos en IEB'] }))).toBe('Ayer no se puede saber cuánto cambió lo invertible: faltan YPF y Pesos en IEB.')
    expect(leer(frase({ va: '1000', vu: null }))).toBe('Ayer no se puede saber cuánto cambió lo invertible: falta un dato.')
  })

  it('el mismo signo en las dos monedas: cuánto vino del dólar y cuánto de tus activos', () => {
    expect(leer(frase({ va: '900000', vu: '600', aa: '300000', ta: '600000', au: '200', tu: '400' }))).toBe(
      'Ayer sumaste $ 900.000 y US$ 600. Dos tercios vinieron del dólar, no de tus activos.',
    )
    expect(leer(frase({ va: '1000000', vu: '640', aa: '800000', ta: '200000', au: '600', tu: '40' }))).toBe(
      'Ayer sumaste $ 1.000.000 y US$ 640. Más de tres cuartos vinieron de tus activos, no del dólar.',
    )
    expect(leer(frase({ va: '-900000', vu: '-600', aa: '-300000', ta: '-600000', au: '-200', tu: '-400' }))).toBe(
      'Ayer perdiste $ 900.000 y US$ 600. Dos tercios se explican por el dólar, no por tus activos.',
    )
    expect(leer(frase({ va: '-1000', vu: '-1', aa: '-500', ta: '-500', au: '-1', tu: '0' }))).toBe('Ayer perdiste $ 1.000 y US$ 1. La mitad se explica por el dólar, no por tus activos.')
  })

  it('una parte suma y la otra resta: cuál lo puso', () => {
    expect(leer(frase({ va: '100000', vu: '60', aa: '-200000', ta: '300000', au: '60', tu: '0' }))).toBe('Ayer sumaste $ 100.000 y US$ 60. Lo puso el dólar: tus activos restaron.')
    expect(leer(frase({ va: '100000', vu: '60', aa: '300000', ta: '-200000', au: '60', tu: '0' }))).toBe('Ayer sumaste $ 100.000 y US$ 60. Lo pusieron tus activos: el dólar restó.')
    expect(leer(frase({ va: '-100000', vu: '-60', aa: '200000', ta: '-300000', au: '-60', tu: '0' }))).toBe('Ayer perdiste $ 100.000 y US$ 60. Lo restó el dólar: tus activos sumaron.')
    expect(leer(frase({ va: '-100000', vu: '-60', aa: '-300000', ta: '200000', au: '-60', tu: '0' }))).toBe('Ayer perdiste $ 100.000 y US$ 60. Lo restaron tus activos: el dólar sumó.')
  })

  it('pesos y dólares con signos distintos: el CCL dice si subió o bajó el dólar', () => {
    const f = () => frase({ va: '590125', vu: '-340', aa: '57313', ta: '532812', au: '37', tu: '-377' })
    expect(leer(f(), { ccl: '0.0108' })).toBe('Ayer sumaste $ 590.125, pero perdiste US$ 340: subió el dólar.')
    expect(leer(f(), { ccl: '-0.01' })).toBe('Ayer sumaste $ 590.125, pero perdiste US$ 340: bajó el dólar.')
    // Sin el CCL del período, lo que dicen los signos: ganar en pesos y perder en dólares es que subió.
    expect(leer(f())).toBe('Ayer sumaste $ 590.125, pero perdiste US$ 340: subió el dólar.')
    expect(leer(frase({ va: '-500', vu: '20', aa: '-500', au: '20' }))).toBe('Ayer perdiste $ 500, pero sumaste US$ 20: bajó el dólar.')
  })

  it('sin CCL nuevo o con solo tipos de cambio, el cambio queda sin atribuir', () => {
    expect(leer(frase({ va: '1000', vu: '1', sa: ['1000', '1'], sinCcl: true }))).toBe('Ayer sumaste $ 1.000 y US$ 1. Sin CCL nuevo, no se sabe cuánto fue el dólar: queda sin atribuir.')
    expect(leer(frase({ va: '1000', vu: '1', sa: ['1000', '1'], solo: true }))).toBe(
      'Ayer sumaste $ 1.000 y US$ 1. Cargaste solo tipos de cambio: queda sin atribuir hasta tu próxima carga completa.',
    )
    expect(leer(frase({ va: '1000', vu: '-1', sa: ['1000', '-1'], sinCcl: true }))).toBe(
      'Ayer sumaste $ 1.000, pero perdiste US$ 1: el cambio quedó sin atribuir hasta tu próxima carga completa.',
    )
  })

  it('lo sin atribuir: todo, o casi todo', () => {
    expect(leer(frase({ va: '1000', vu: '1', sa: ['1000', '1'] }))).toBe('Ayer sumaste $ 1.000 y US$ 1. Todo quedó sin atribuir: sin precio o saldo nuevo.')
    expect(leer(frase({ va: '1000', vu: '1', aa: '100', ta: '100', sa: ['800', '1'] }))).toBe('Ayer sumaste $ 1.000 y US$ 1. Casi todo quedó sin atribuir: hay partidas sin precio o saldo nuevo.')
  })

  it('sin cambios, o igual en una moneda', () => {
    expect(leer(frase({ va: '0', vu: '0' }))).toBe('Ayer lo invertible quedó igual, en pesos y en dólares.')
    expect(leer(frase({ va: '0', vu: '-340', au: '-340' }))).toBe('Ayer quedaste igual en pesos y perdiste US$ 340 en dólares: subió el dólar.')
    expect(leer(frase({ va: '1000', vu: '0', aa: '1000' }))).toBe('Ayer sumaste $ 1.000 y en dólares quedaste igual.')
  })
})

describe('cuandoFue', () => {
  it('Hoy, Ayer, el día o desde cuándo (si volviste después de un hueco)', () => {
    expect(cuandoFue({ desde: '2026-10-14', hasta: '2026-10-15', dias_habiles: 1 }, '2026-10-15')).toBe('Hoy')
    expect(cuandoFue({ desde: '2026-10-13', hasta: '2026-10-14', dias_habiles: 1 }, '2026-10-15')).toBe('Ayer')
    expect(cuandoFue({ desde: '2026-10-13', hasta: '2026-10-14', dias_habiles: 1 }, '2026-10-21')).toBe('El mié 14/10')
    expect(cuandoFue({ desde: '2026-10-09', hasta: '2026-10-14', dias_habiles: 2 }, '2026-10-15')).toBe('Desde el vie 09/10')
  })
})
