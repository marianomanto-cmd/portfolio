import { describe, expect, it } from 'vitest'
import { calc, type Calc, type DobleCalc } from './calc'
import { agrupar, composicion, conArticulo, deLaDeuda, deudaVigente, diferencia, enLista, fechaDelDato, indicadores, liquidezDe, origenEnPalabras, participacion, patrimonioNeto, serieBalance } from './balance'
import { CAMIONETA, CASA, F13, F14, hechosBalance, PASIVO, type OpcionesFixture } from './balance.fixture'
import { Decimal } from './dinero'
import { financieros, foto, type ItemFoto } from './foto'

// Números inventados (balance.fixture.ts, D-24).

const valor = (c: Calc) => (c.valor === null ? null : c.valor.toFixed(2))
const fotoDe = (o: OpcionesFixture = {}, fecha = F14, hoy = F14) => {
  const h = hechosBalance(o)
  return { h, f: foto(h, fecha, { hoy }) }
}
const neto = (o: OpcionesFixture = {}, segun: Map<number, DobleCalc> = new Map()) => {
  const { h, f } = fotoDe(o)
  return { h, f, pn: patrimonioNeto(f, h.bienes, segun, h.pasivos) }
}
const segunCuadro = (ars: string): Map<number, DobleCalc> =>
  new Map([
    [
      1,
      {
        ars: calc(new Decimal(ars), `VP = $ ${ars}`, [], { etiquetas: ['estimado'] }),
        usd: calc(new Decimal(ars).div(1500), `VP ÷ CCL`, [], { etiquetas: ['estimado'] }),
      },
    ],
  ])

describe('activo y pasivo', () => {
  it('el activo total es la suma exacta de sus partidas, en las dos monedas', () => {
    const { f, pn } = neto()
    expect(valor(pn.financiero.ars)).toBe('105000000.00')
    expect(valor(pn.financiero.usd)).toBe('70000.00')
    expect(valor(pn.activo.ars)).toBe('411000000.00')
    expect(valor(pn.activo.usd)).toBe('274000.00')
    const suma = f.items.filter((i) => i.clase !== 'pasivo').reduce((a, i) => a.plus(i.valor_ars.valor!), new Decimal(0))
    expect(suma.toFixed(2)).toBe('411000000.00')
  })

  it('la casa vale en dólares su valuación y en pesos valuación × CCL', () => {
    const { f } = fotoDe()
    const casa = f.items.find((i) => i.clave === 'b:1')!
    expect(valor(casa.valor_usd)).toBe('180000.00')
    expect(valor(casa.valor_ars)).toBe('270000000.00')
  })

  it('activo − pasivo = patrimonio neto completo, al centavo', () => {
    for (const deuda of ['informada', 'estimada'] as const) {
      const { pn } = neto({ deuda })
      expect(pn.activo.ars.valor!.minus(pn.pasivo.ars.valor!).toFixed(2)).toBe(valor(pn.completo.ars))
      expect(pn.activo.usd.valor!.minus(pn.pasivo.usd.valor!).toFixed(6)).toBe(pn.completo.usd.valor!.toFixed(6))
    }
  })
})

describe('la deuda del leasing y su origen (D-131 revisada, D-134)', () => {
  it('estimada: el completo la usa con "estimado" y lo firme no la toca', () => {
    const { pn } = neto({ deuda: 'estimada' })
    expect(pn.origen_deuda).toBe('estimada')
    expect(valor(pn.completo.ars)).toBe('390000000.00') // 105 + 270 + (36 − 21)
    expect(pn.completo.ars.etiquetas).toContain('estimado')
    expect(pn.completo.usd.etiquetas).toContain('estimado')
    expect(valor(pn.sin_financiados.ars)).toBe('375000000.00') // 105 + 270
    expect(valor(pn.sin_financiados.usd)).toBe('250000.00')
    expect(pn.sin_financiados.ars.etiquetas).not.toContain('estimado')
    expect(pn.sin_financiados.ars.etiquetas).not.toContain('parcial')
    expect(pn.financiados[0].deuda?.fuente).toMatch(/inventado/)
  })

  it('según el cuadro de marcha gana a la estimada y pierde contra la informada', () => {
    const conEstimada = neto({ deuda: 'estimada' }, segunCuadro('20250000')).pn
    expect(conEstimada.origen_deuda).toBe('segun_cuadro')
    expect(valor(conEstimada.completo.ars)).toBe('390750000.00') // 105 + 270 + (36 − 20,25)
    expect(conEstimada.completo.ars.etiquetas).toContain('estimado')
    const conInformada = neto({ deuda: 'informada' }, segunCuadro('20250000')).pn
    expect(conInformada.origen_deuda).toBe('informada')
    expect(valor(conInformada.completo.ars)).toBe('391500000.00') // 105 + 270 + (36 − 19,5)
    expect(conInformada.completo.ars.etiquetas).not.toContain('estimado')
  })

  it('un "según cuadro" sin dato no tapa a la estimada', () => {
    const vacio: Map<number, DobleCalc> = new Map([[1, { ars: { valor: null, motivo: 'Falta la TEA.', formula: 'sin dato', insumos: [], etiquetas: [] }, usd: { valor: null, motivo: 'Falta la TEA.', formula: 'sin dato', insumos: [], etiquetas: [] } }]])
    expect(neto({ deuda: 'estimada' }, vacio).pn.origen_deuda).toBe('estimada')
  })

  it('sin ninguna deuda: completo sin dato con la suma parcial; lo firme nunca incluye la camioneta', () => {
    const { pn } = neto({ deuda: 'ninguna' })
    expect(pn.origen_deuda).toBeNull()
    expect(pn.completo.ars.valor).toBeNull()
    expect(pn.completo.ars.etiquetas).toContain('parcial')
    expect(pn.completo.ars.motivo).toMatch(/Suma parcial/)
    expect(valor(pn.sin_financiados.ars)).toBe('375000000.00')
    expect(pn.sin_financiados.ars.insumos.map((i) => i.nombre)).not.toContain('Camioneta')
    expect(pn.excluidos.map((x) => x.nombre)).toEqual(['Camioneta'])
    expect(pn.excluidos[0].motivo).toMatch(/financiada por el leasing de la camioneta/)
    expect(pn.pasivo.ars.valor).toBeNull()
  })

  it('con el valor de cancelación: completo = financiero + casa + (camioneta − cancelación)', () => {
    const { pn } = neto({ deuda: 'informada' })
    expect(pn.origen_deuda).toBe('informada')
    expect(valor(pn.completo.ars)).toBe('391500000.00')
    expect(valor(pn.financiados[0].participacion.ars)).toBe('16500000.00')
    expect(pn.financiados[0].participacion.ars.formula).toMatch(/36\.000\.000,00.*19\.500\.000,00.*16\.500\.000,00/)
    expect(valor(pn.pasivo.ars)).toBe('19500000.00')
  })

  it('deudaVigente lee la foto: informada, estimada o nada', () => {
    const inf = fotoDe({ deuda: 'informada' }).f.items.find((i) => i.clase === 'pasivo')!
    const est = fotoDe({ deuda: 'estimada' }).f.items.find((i) => i.clase === 'pasivo')!
    const nada = fotoDe({ deuda: 'ninguna' }).f.items.find((i) => i.clase === 'pasivo')!
    expect(deudaVigente(inf, null)).toMatchObject({ origen: 'informada', fecha: F13 })
    expect(valor(deudaVigente(inf, null)!.valor.ars)).toBe('19500000.00')
    expect(deudaVigente(est, null)).toMatchObject({ origen: 'estimada', fecha: '2026-10-08' })
    expect(deudaVigente(est, null)!.valor.ars.etiquetas).toContain('estimado')
    expect(deudaVigente(nada, null)).toBeNull()
    expect(deudaVigente(null, segunCuadro('20250000').get(1)!)!.origen).toBe('segun_cuadro')
  })

  it('participación sin deuda o sin valuación: sin dato con motivo, nunca cero', () => {
    const { f } = fotoDe({ deuda: 'ninguna' })
    const cam = f.items.find((i) => i.clave === 'b:2')!
    const p = participacion(cam, null, 'el leasing')
    expect(p.ars.valor).toBeNull()
    expect(p.ars.motivo).toMatch(/Falta la deuda del leasing/)
    const sinVal = fotoDe({ camionetaSinValuacion: true }).f.items.find((i) => i.clave === 'b:2')!
    const est = fotoDe({ deuda: 'estimada' }).f.items.find((i) => i.clase === 'pasivo')!
    const p2 = participacion(sinVal, deudaVigente(est, null), 'el leasing')
    expect(p2.usd.valor).toBeNull()
    expect(p2.usd.motivo).toMatch(/valuación/)
  })
})

describe('bienes y perímetro', () => {
  it('una casa sin valuación sale de lo firme y se nombra; el completo es sin dato', () => {
    const { pn } = neto({ deuda: 'estimada', casaSinValuacion: true })
    expect(valor(pn.sin_financiados.ars)).toBe('105000000.00')
    expect(pn.excluidos.find((x) => x.nombre === 'Casa')?.motivo).toBe('no tiene valuación')
    expect(pn.completo.ars.valor).toBeNull()
    expect(pn.completo.ars.etiquetas).toContain('parcial')
    expect(pn.activo.ars.valor).toBeNull()
  })

  it('sin bienes: el pasivo total es sin dato (nunca $ 0) mientras el leasing no tenga su bien', () => {
    const { pn } = neto({ sinBienes: true })
    expect(pn.pasivo.ars.valor).toBeNull()
    expect(pn.pasivo.ars.motivo).toMatch(/no se resta sin el bien que financia/)
  })

  it('sin bienes: un leasing sin su bien no se resta solo', () => {
    const { pn } = neto({ sinBienes: true, deuda: 'estimada' })
    expect(pn.huerfanas.map((d) => d.nombre)).toEqual(['Leasing de la camioneta'])
    expect(valor(pn.sin_financiados.ars)).toBe('105000000.00')
    expect(pn.completo.ars.valor).toBeNull()
  })

  it('una tarjeta (deuda sin bien) resta en las dos cifras', () => {
    const h = hechosBalance({ deuda: 'informada' })
    h.pasivos = [PASIVO, { id: 2, nombre: 'Tarjeta', tipo: 'tarjeta', moneda: 'ARS', fecha_inicio: F13, cuotas_totales: 1, opcion_compra_fecha: null }]
    h.pasivo_saldos = [...h.pasivo_saldos, { pasivo_id: 2, fecha: F14, capital_pendiente: new Decimal('500000'), naturaleza: 'informado', fuente: null, carga_id: 10 }]
    const f = foto(h, F14, { hoy: F14 })
    const pn = patrimonioNeto(f, h.bienes, new Map(), h.pasivos)
    expect(valor(pn.sin_financiados.ars)).toBe('374500000.00')
    expect(valor(pn.completo.ars)).toBe('391000000.00')
    expect(valor(pn.pasivo.ars)).toBe('20000000.00')
  })
})

describe('liquidez (D-132)', () => {
  it('saldo disponible, posición con venta en el mercado, bien ilíquido; la regla va escrita', () => {
    const { f } = fotoDe()
    const por = (clave: string) => liquidezDe(f.items.find((i) => i.clave === clave)!)
    expect(por('s:1:ARS').liquidez).toBe('disponible')
    expect(por('p:1:1').liquidez).toBe('mercado')
    expect(por('p:1:1').regla).toMatch(/BYMA/)
    expect(por('b:1').liquidez).toBe('iliquido')
    expect(por('b:1').regla).toMatch(/regla/)
  })
})

describe('agrupar', () => {
  const { f } = fotoDe()
  const fin = financieros(f)

  it('por cuenta: IEB, Mercado Pago y Galicia, cada total exacto', () => {
    const g = agrupar(fin, 'cuenta')
    expect(g.map((x) => x.nombre)).toEqual(['IEB', 'Galicia', 'Mercado Pago'])
    expect(valor(g[0].total.ars)).toBe('82400000.00') // 43.586.000 + 17.822.000 + 8.992.000 + 6.000.000 + 6.000.000
    const total = g.reduce((a, x) => a.plus(x.total.ars.valor!), new Decimal(0))
    expect(total.toFixed(2)).toBe('105000000.00')
  })

  it('por instrumento junta los saldos por moneda; por clase, por tipo', () => {
    const i = agrupar(fin, 'instrumento')
    expect(i.find((x) => x.clave === 'm:ARS')?.filas).toHaveLength(2)
    expect(valor(i.find((x) => x.clave === 'm:ARS')!.total.ars)).toBe('16600000.00')
    const c = agrupar(fin, 'clase')
    expect(c.map((x) => x.clave)).toContain('t:liquidez')
    expect(valor(c.find((x) => x.clave === 't:liquidez')!.total.ars)).toBe('22600000.00')
  })

  it('un precio viejo llega al total de su grupo', () => {
    const h = hechosBalance()
    const viejo = foto(h, F14, { hoy: '2026-10-20' })
    const g = agrupar(financieros(viejo), 'cuenta')
    expect(g[0].filas.some((x: ItemFoto) => x.viejo)).toBe(true)
    expect(g[0].total.ars.etiquetas).toContain('viejo')
  })

  it('una posición sin precio deja su grupo en sin dato, con la suma parcial', () => {
    const { f: sin } = fotoDe({ sinPrecioYpf: true })
    const g = agrupar(financieros(sin), 'cuenta')
    const ieb = g.find((x) => x.nombre === 'IEB')!
    expect(ieb.total.ars.valor).toBeNull()
    expect(ieb.total.ars.etiquetas).toContain('parcial')
    expect(g.at(-1)!.nombre).toBe('IEB') // lo sin dato va al final
  })
})

describe('composición', () => {
  const colores = { clase: { cedear: '#1', liquidez: '#2' }, nombreClase: { cedear: 'CEDEARs', liquidez: 'Liquidez' } }
  const { f } = fotoDe()
  const todo = f.items.filter((i) => i.clase !== 'pasivo')

  it('los pesos suman 1 (a la precisión de Decimal) en cada eje y cada moneda', () => {
    for (const eje of ['moneda', 'clase', 'liquidez'] as const) {
      for (const m of ['ARS', 'USD'] as const) {
        const c = composicion(todo, eje, m, colores)
        const s = c.reduce((a, p) => a.plus(p.peso.valor!), new Decimal(0))
        expect(s.minus(1).abs().lt('1e-30')).toBe(true)
      }
    }
  })

  it('por moneda, los bienes van a "Sin elegir" (D-73); por liquidez, en orden', () => {
    const m = composicion(todo, 'moneda', 'ARS', colores)
    expect(m.find((p) => p.clave === 'sin_elegir')?.valor.ars.valor?.toFixed(2)).toBe('306000000.00')
    const l = composicion(todo, 'liquidez', 'ARS', colores)
    expect(l.map((p) => p.clave)).toEqual(['disponible', 'mercado', 'iliquido'])
    expect(valor(l[0].valor.ars)).toBe('22600000.00')
    // La regla va escrita, también en la traza del peso de cada tramo (D-132).
    expect(l[1].regla).toMatch(/hay que venderlos/)
    expect(l[1].peso.explicacion).toContain(l[1].regla as string)
  })

  it('con una partida sin valor, los pesos son sin dato', () => {
    const { f: sin } = fotoDe({ sinPrecioYpf: true })
    const c = composicion(financieros(sin), 'clase', 'ARS', colores)
    expect(c.every((p) => p.peso.valor === null)).toBe(true)
  })
})

describe('serieBalance', () => {
  it('una fecha: un punto', () => {
    const h = hechosBalance({ unDia: true })
    const s = serieBalance(h, [F14], F14)
    expect(s).toHaveLength(1)
    expect(s[0].neto.ars).toBe('375000000')
    expect(s[0].completo.ars).toBe('390000000')
    expect(s[0].completo_estimado).toBe(true)
  })

  it('no inventa puntos entre cargas, y un dato que falta es null, no cero', () => {
    const h = hechosBalance({ deuda: 'ninguna' })
    const s = serieBalance(h, [F13, F14], F14)
    expect(s.map((p) => p.fecha)).toEqual([F13, F14])
    expect(s[1].completo.ars).toBeNull()
    expect(s[1].por_clase.cedear.ars).toBe('43586000')
    const sin = serieBalance(hechosBalance({ sinPrecioYpf: true }), [F13, F14], F14)
    expect(sin[1].por_clase.accion_local.ars).toBeNull()
    expect(sin[1].neto.ars).toBeNull()
  })
})

describe('comparativo (D-133)', () => {
  it('diferencia = actual − anterior, con las dos cifras en la traza y sus etiquetas', () => {
    const a = calc(new Decimal('375000000'), 'a', [], { etiquetas: ['estimado'] })
    const b = calc(new Decimal('360000000'), 'b')
    const d = diferencia(a, b, 'ARS', '2026-10-14', '2025-12-31', 'Patrimonio neto')
    expect(d.valor?.toFixed()).toBe('15000000')
    expect(d.formula).toBe('$ 375.000.000,00 (al mié 14/10) − $ 360.000.000,00 (al mié 31/12/2025) = +$ 15.000.000,00')
    expect(d.etiquetas).toContain('estimado')
    expect(d.explicacion).toMatch(/No es una ganancia/)
  })

  it('sin una de las dos: sin dato con motivo, nunca cero', () => {
    const d = diferencia(calc(new Decimal(1), 'a'), { valor: null, motivo: 'Falta el CCL.', formula: 'sin dato', insumos: [], etiquetas: [] }, 'USD', '2026-10-14', '2026-10-13', 'Activo')
    expect(d.valor).toBeNull()
    expect(d.motivo).toBe('Falta el CCL.')
  })
})

describe('indicadores (D-133)', () => {
  const de = (xs: ReturnType<typeof indicadores>, k: string) => xs.find((x) => x.clave === k)
  it('solvencia, endeudamiento e inmovilización: cocientes exactos, con "estimado" si la deuda lo es', () => {
    const { pn } = neto({ deuda: 'estimada' })
    const xs = indicadores(pn)
    expect(xs.map((x) => x.clave)).toEqual(['solvencia', 'endeudamiento', 'inmovilizacion'])
    const a = pn.activo.ars.valor as Decimal
    const p = pn.pasivo.ars.valor as Decimal
    const n = pn.completo.ars.valor as Decimal
    expect(de(xs, 'solvencia')?.valor.valor?.eq(a.div(p))).toBe(true)
    expect(de(xs, 'endeudamiento')?.valor.valor?.eq(p.div(n))).toBe(true)
    expect(de(xs, 'solvencia')?.valor.etiquetas).toContain('estimado')
    const bienes = pn.bienes_libres.concat(pn.financiados.map((x) => x.bien)).reduce((s, i) => s.plus(i.valor_ars.valor as Decimal), new Decimal(0))
    expect(de(xs, 'inmovilizacion')?.valor.valor?.eq(bienes.div(a))).toBe(true)
    expect(de(xs, 'inmovilizacion')?.valor.etiquetas).not.toContain('estimado')
    expect(de(xs, 'solvencia')?.valor.formula).toMatch(/ \(activo\) ÷ .+ \(pasivo\) = .+ veces$/)
  })

  it('con la deuda informada no hay "estimado"; sin la deuda, sin dato con motivo (nunca cero)', () => {
    expect(de(indicadores(neto({ deuda: 'informada' }).pn), 'solvencia')?.valor.etiquetas).not.toContain('estimado')
    const sin = de(indicadores(neto({ deuda: 'ninguna' }).pn), 'endeudamiento')
    expect(sin?.valor.valor).toBeNull()
    expect(sin?.valor.motivo).toMatch(/cancelación|deuda/)
  })

  it('sin bienes no hay inmovilización, y un leasing sin su bien no cuenta como deuda', () => {
    expect(indicadores(neto({ sinBienes: true }).pn)).toEqual([])
  })
})

describe('palabras', () => {
  it('artículos y listas', () => {
    expect(conArticulo('Camioneta')).toBe('la camioneta')
    expect(conArticulo('Auto')).toBe('el auto')
    expect(conArticulo('Toyota Hilux')).toBe('Toyota Hilux')
    expect(enLista(['Camioneta', 'Auto', 'Moto'])).toBe('la camioneta, el auto y la moto')
    expect(enLista([CASA.nombre])).toBe('la casa')
    expect(CAMIONETA.pasivo_id).toBe(1)
    expect(deLaDeuda('Leasing de la camioneta')).toBe('del leasing de la camioneta')
    expect(deLaDeuda('Tarjeta Visa')).toBe('de la tarjeta Visa')
    expect(deLaDeuda('su deuda')).toBe('de su deuda')
  })

  it('la fecha de un dato lleva el año si no es el del balance', () => {
    expect(fechaDelDato('2026-10-08', '2026-10-14')).toBe('jue 08/10')
    expect(fechaDelDato('2025-09-15', '2026-10-14')).toBe('lun 15/09/2025')
  })

  it('el origen de la deuda en palabras', () => {
    const { f } = fotoDe({ deuda: 'estimada' })
    const d = deudaVigente(f.items.find((i) => i.clase === 'pasivo') ?? null, null)
    expect(origenEnPalabras(d, F14)).toMatch(/^estimada por vos el .+ · provisoria$/)
    expect(origenEnPalabras(null)).toBe('sin dato · falta el valor de cancelación que te pase la leasera')
  })
})

// Revisión del 15/10: casos que fallaban (cada uno, con su arreglo).
describe('revisión: la deuda cargada no se pierde sin CCL', () => {
  it('sin ningún CCL, la deuda informada o estimada sigue con su origen y su valor en pesos; solo los dólares son sin dato', () => {
    for (const deuda of ['informada', 'estimada'] as const) {
      const h = { ...hechosBalance({ deuda }), tipos_cambio: [] }
      const f = foto(h, F14, { hoy: F14 })
      const pn = patrimonioNeto(f, h.bienes, new Map(), h.pasivos)
      const d = pn.financiados[0].deuda
      expect(d?.origen, deuda).toBe(deuda)
      expect(valor(d!.valor.ars)).toBe(deuda === 'informada' ? '19500000.00' : '21000000.00')
      expect(d!.valor.usd.valor).toBeNull()
      expect(d!.valor.usd.motivo).toMatch(/CCL/)
      // Lo que falta es el CCL, no el valor de cancelación.
      expect(origenEnPalabras(d, F14)).not.toMatch(/falta el valor de cancelación/)
      expect(valor(pn.pasivo.ars)).toBe(deuda === 'informada' ? '19500000.00' : '21000000.00')
      expect(valor(pn.financiados[0].participacion.ars)).toBe(deuda === 'informada' ? '16500000.00' : '15000000.00')
      expect(pn.financiados[0].participacion.usd.motivo).toMatch(/CCL/)
    }
  })

  it('un "según cuadro" con los pesos y sin el CCL gana igual a la estimada', () => {
    const est = fotoDe({ deuda: 'estimada' }).f.items.find((i) => i.clase === 'pasivo')!
    const sinUsd: DobleCalc = { ars: calc(new Decimal('20250000'), 'VP = $ 20.250.000', [], { etiquetas: ['estimado'] }), usd: { valor: null, motivo: 'No hay un CCL cargado.', formula: 'sin dato', insumos: [], etiquetas: [] } }
    const d = deudaVigente(est, sinUsd)
    expect(d?.origen).toBe('segun_cuadro')
    expect(valor(d!.valor.ars)).toBe('20250000.00')
    expect(d!.valor.usd.valor).toBeNull()
  })
})

describe('revisión: los nombres de las deudas en las frases', () => {
  it('"del leasing", "el bien que financia el leasing…": sin mayúsculas en el medio ni "de el"', () => {
    expect(deLaDeuda('el leasing')).toBe('del leasing')
    expect(deLaDeuda('la tarjeta Visa')).toBe('de la tarjeta Visa')
    const { f } = fotoDe({ deuda: 'ninguna' })
    const p = participacion(f.items.find((i) => i.clave === 'b:2')!, null, 'el leasing')
    expect(p.ars.motivo).toMatch(/^Falta la deuda del leasing:/)
    const { pn } = neto({ sinBienes: true, deuda: 'estimada' })
    expect(pn.completo.ars.motivo).toMatch(/^Falta el bien que financia el leasing de la camioneta\./)
    expect(pn.completo.ars.motivo).not.toMatch(/ El | Leasing/)
  })

  it('el motivo de un bien financiado dice el acreedor con su artículo y concuerda con el bien', () => {
    const { pn } = neto({ deuda: 'estimada' })
    expect(pn.excluidos.find((x) => x.nombre === 'Camioneta')?.motivo).toBe('está financiada por el leasing de la camioneta: entra junto con su deuda')
  })
})
