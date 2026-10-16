import { describe, expect, it } from 'vitest'
import { conTema, TEMA_CLARO, tieneTorta } from '@/components/graficos/tema'
import { armarPasivos } from '@/lib/vistas/armar-pasivos'
import { ejemploPasivos, hechosEjemploPasivos } from '@/lib/vistas/ejemplo-pasivos'
import { enEje, graficoApertura, graficoCuota, graficoIndexado, indiceHoy, techo } from './graficos'

// Los gráficos de Pasivos muestran los datos de la vista: mismo largo, ningún
// NaN, null donde hay "sin dato" (plan §8). Números inventados (D-24).

type Serie = { type: string; name: string; data: ({ value: number | null } | number | null)[] }
const valores = (s: Serie) => s.data.map((d) => (typeof d === 'object' && d !== null ? d.value : d))

describe('cada cuota, abierta', () => {
  const [l] = ejemploPasivos('cuadro').leasings

  it('una barra por cuota más la opción, apiladas, con amortización e interés si hay tasa', () => {
    const g = graficoApertura(l, false)
    const series = g.opcion.series as Serie[]
    expect(tieneTorta(g.opcion)).toBe(false)
    // Sin cargos extra en ninguna cuota, no hay serie de cargos (es un cero real, no un dato que falta).
    expect(series.map((s) => s.name)).toEqual(['Amortización', 'Interés implícito', 'IVA', 'Seguro', 'Percepción'])
    for (const s of series) {
      expect(s.data).toHaveLength(36)
      expect(valores(s).some((v) => typeof v === 'number' && Number.isNaN(v))).toBe(false)
    }
    // Cada cuota: las partes suman el total de la vista.
    const c20 = series.reduce((a, s) => a + (valores(s)[19] ?? 0), 0)
    expect(c20).toBeCloseTo(Number(l.cuotas[19].apertura.total.ars.valor), 2)
    expect(g.tabla.filas).toHaveLength(36)
    expect(() => conTema(g.opcion, TEMA_CLARO, { movil: true, animar: false })).not.toThrow()
  })

  it('sin tasa, el canon entero (nunca un interés inventado)', () => {
    const [s] = ejemploPasivos('sin-tasa').leasings
    const series = graficoApertura(s, false).opcion.series as Serie[]
    expect(series.map((x) => x.name)).toEqual(['Canon', 'IVA', 'Seguro', 'Percepción'])
  })

  it('con un cargo extra (la multa de la cuota 7 del demo completo), la serie de cargos', () => {
    const [c] = ejemploPasivos('completo').leasings
    const g = graficoApertura(c, false)
    const series = g.opcion.series as Serie[]
    const cargos = series.find((x) => x.name === 'Cargos') as Serie
    expect(valores(cargos)[6]).toBe(15000)
    expect(valores(cargos)[0]).toBe(0)
  })

  it('en el teléfono, la leyenda se parte en renglones y el gráfico le deja lugar abajo', () => {
    const g = graficoApertura(l, false, true)
    expect(g.opcion.legend).toMatchObject({ type: 'plain' })
    expect(g.opcion.grid).toMatchObject({ bottom: 64 })
  })

  it('en modo privado, ni el eje ni la tabla dicen montos', () => {
    const g = graficoApertura(l, true)
    expect(g.tabla.filas.flat().some((x) => /\$/.test(x))).toBe(false)
    const f = (g.opcion.yAxis as { axisLabel: { formatter: (v: number) => string } }).axisLabel.formatter
    expect(f(1_000_000)).toBe('•••')
  })

  it('el eje, compacto y sin ",0", como el de la cuota', () => {
    const f = (graficoApertura(l, false).opcion.yAxis as { axisLabel: { formatter: (v: number) => string } }).axisLabel.formatter
    expect(f(900_000)).toBe(enEje(900_000, 'ARS', false))
    expect(f(900_000)).not.toContain(',0')
    expect(f(1_200_000)).toBe('$ 1,2 M')
  })
})

describe('revisión: la línea "hoy"', () => {
  type ConLinea = { markLine?: { data: { xAxis: string }[] } }
  const linea = (g: ReturnType<typeof graficoApertura>) => ((g.opcion.series as ConLinea[])[0].markLine?.data[0]?.xAxis ?? null)

  it('al día, antes de la próxima cuota (la 15)', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    expect(linea(graficoApertura(l, false))).toBe('15')
  })

  it('con la 15 vencida sin pagar, "hoy" va en la 16 (la primera que vence desde hoy), no en la vencida', () => {
    const { h, hp } = hechosEjemploPasivos('cuadro')
    const [l] = armarPasivos(h, hp, '2026-11-05').leasings
    expect(linea(graficoApertura(l, false))).toBe('16')
  })

  it('al final: en la última cuota si todavía no venció; en la opción si solo falta ella; después, sin línea', () => {
    const { h, hp } = hechosEjemploPasivos('cuadro')
    const [l] = armarPasivos(h, hp, '2028-06-15').leasings
    expect(linea(graficoApertura(l, false))).toBe('35')
    const tarde = { ...hp, contratos: hp.contratos.map((c) => ({ ...c, opcion_compra_fecha: '2028-08-01' })) }
    const [l2] = armarPasivos(h, tarde, '2028-07-15').leasings
    expect(linea(graficoApertura(l2, false))).toBe('OC')
    const [l3] = armarPasivos(h, tarde, '2028-08-02').leasings
    expect(linea(graficoApertura(l3, false))).toBeNull()
  })
})

describe('pesos contra dólares', () => {
  it('dos series indexadas a 100, del largo de la vista', () => {
    const [l] = ejemploPasivos('completo').leasings
    const g = graficoIndexado(l.indexado)
    const series = g.opcion.series as Serie[]
    expect(series).toHaveLength(2)
    expect(series[0].data[0]).toBe(100)
    expect(series[1].data).toHaveLength(l.indexado.length)
    expect(series[1].data.every((v) => typeof v === 'number' && !Number.isNaN(v))).toBe(true)
  })
})

describe('la cuota en pesos y en dólares (handoff, captura 08)', () => {
  type Linea = { name: string; data: (number | null)[]; yAxisIndex: number; lineStyle: { type?: unknown }; markLine?: { data: { xAxis: string }[] } }
  const series = (g: ReturnType<typeof graficoCuota>) => g.opcion.series as Linea[]

  it('pesos en el eje izquierdo; dólares en el derecho, sólida hasta hoy y punteada después', () => {
    const [l] = ejemploPasivos('completo').leasings
    const g = graficoCuota(l, false)
    const [ars, pagadas, porPagar] = series(g)
    expect(tieneTorta(g.opcion)).toBe(false)
    expect(ars.yAxisIndex).toBe(0)
    expect(pagadas.yAxisIndex).toBe(1)
    expect(porPagar.yAxisIndex).toBe(1)
    for (const s of series(g)) {
      expect(s.data).toHaveLength(35)
      expect(s.data.some((v) => typeof v === 'number' && Number.isNaN(v))).toBe(false)
    }
    // En pesos, el total de cada cuota de la vista.
    expect(ars.data[19]).toBeCloseTo(Number(l.cuotas[19].total.valor), 2)
    // Las pagadas, al CCL de su pago (sólida); las que faltan, al CCL de hoy (punteada).
    expect(pagadas.data[0]).toBeCloseTo(Number(l.cuotas[0].total_usd.valor), 6)
    expect(pagadas.data[20]).toBeNull()
    expect(porPagar.lineStyle.type).toEqual([4, 4])
    expect(porPagar.data[20]).toBeCloseTo(Number(l.cuotas[20].total_usd.valor), 6)
    // La punteada arranca en la última pagada: las dos líneas se tocan.
    expect(porPagar.data[13]).toBe(pagadas.data[13])
    expect(porPagar.data[12]).toBeNull()
    // "Hoy", en la última que venció (la 14).
    expect(ars.markLine?.data[0].xAxis).toBe('14')
    expect(() => conTema(g.opcion, TEMA_CLARO, { movil: true, animar: false })).not.toThrow()
  })

  it('sin el CCL de los pagos, lo pagado en dólares es un hueco, nunca un cero', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    const [, pagadas, porPagar] = series(graficoCuota(l, false))
    expect(pagadas.data.every((v) => v === null)).toBe(true)
    expect(porPagar.data.slice(14).every((v) => typeof v === 'number' && v > 0)).toBe(true)
    expect(porPagar.data[13]).toBeNull()
  })

  it('el eje de abajo: la primera, la de hoy y la última', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    const x = graficoCuota(l, false).opcion.xAxis as { axisLabel: { interval: (i: number) => boolean; formatter: (v: string, i: number) => string; rich: { hoy: { color: string } } } }
    expect([0, 13, 34].every((i) => x.axisLabel.interval(i))).toBe(true)
    expect(x.axisLabel.interval(5)).toBe(false)
    expect(x.axisLabel.formatter('1', 0)).toBe('Cuota 1')
    expect(x.axisLabel.formatter('14', 13)).toBe('{hoy|Hoy · 14}')
    expect(x.axisLabel.formatter('35', 34)).toBe('Cuota 35')
    // "Hoy · 14", en la sangría clara del diseño (--accent-glow).
    expect(conTema({ xAxis: x }, TEMA_CLARO, { movil: false, animar: false }).xAxis).toMatchObject({ axisLabel: { rich: { hoy: { color: TEMA_CLARO.acentoBrillo } } } })
    expect(indiceHoy(l.cuotas, '2025-08-01')).toBe(-1)
  })

  it('como en el diseño: sin líneas de grilla ni línea de eje; lo pasado con un tinte y la línea de hoy en sangría', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    const o = graficoCuota(l, false).opcion as { xAxis: { axisLine: { show: boolean } }; yAxis: { splitLine: { show: boolean } }[] }
    expect(o.xAxis.axisLine.show).toBe(false)
    expect(o.yAxis.map((y) => y.splitLine.show)).toEqual([false, false])
    const [ars] = series(graficoCuota(l, false)) as unknown as { markArea: { data: [{ xAxis: string }, { xAxis: string }][] }; markLine: { lineStyle: { color: string; width: number } } }[]
    expect(ars.markArea.data[0].map((d) => d.xAxis)).toEqual(['1', '14'])
    expect(ars.markLine.lineStyle).toMatchObject({ color: 'tema:acento', width: 1 })
    // Sin ninguna cuota vencida todavía, ni tinte ni línea.
    const [antes] = series(graficoCuota({ ...l, hoy: '2025-08-01' }, false)) as unknown as { markArea?: unknown; markLine?: unknown }[]
    expect(antes.markArea).toBeUndefined()
    expect(antes.markLine).toBeUndefined()
  })

  it('en el modo privado, ni los ejes, ni el tooltip, ni la tabla dicen montos', () => {
    const [l] = ejemploPasivos('completo').leasings
    const g = graficoCuota(l, true)
    expect(g.tabla.filas.flat().some((x) => /\$/.test(x))).toBe(false)
    const ejes = g.opcion.yAxis as { axisLabel: { formatter: (v: number) => string } }[]
    expect(ejes.map((e) => e.axisLabel.formatter(1_000))).toEqual(['•••', '•••'])
    const tip = (series(g)[0] as unknown as { tooltip: { valueFormatter: (v: number) => string } }).tooltip
    expect(tip.valueFormatter(1_000)).toBe('•••')
  })
})

describe('techo de un eje', () => {
  it('el primer número redondo que no queda debajo', () => {
    expect(techo(1_314_400 * 1.15)).toBe(1_600_000)
    expect(techo(876 * 1.8)).toBe(1_600)
    expect(techo(1000)).toBe(1000)
    expect(techo(1001)).toBe(1200)
    expect(techo(2600)).toBe(3000)
    expect(techo(0)).toBe(1)
    // Sin 2,5: su mitad no se lee en el rótulo compacto ("US$ 1,3k" por 1.250).
    expect(techo(2201)).toBe(3000)
    expect(techo(2_201_000)).toBe(3_000_000)
  })
  it('el techo y su mitad se leen exactos en el eje', () => {
    for (const x of [130, 876 * 1.8, 1500, 2201, 9_999, 14_000, 1_511_560, 2_400_000, 47_000_000]) {
      const t = techo(x)
      for (const v of [t, t / 2]) {
        const r = enEje(v, 'USD', false)
        // El rótulo vuelve al número: "US$ 1,5k" → 1500, "US$ 800" → 800, "US$ 1,6 M" → 1.600.000.
        const m = /([\d.]+)(?:,(\d))?\s?(k|M)?$/.exec(r)!
        const n = Number(m[1].replace(/\./g, '') + (m[2] ? `.${m[2]}` : '')) * (m[3] === 'k' ? 1e3 : m[3] === 'M' ? 1e6 : 1)
        expect(n, `${x} → ${v} → ${r}`).toBeCloseTo(v, 6)
      }
    }
  })
  it('los pesos con aire arriba y los dólares por debajo: las dos líneas no se pisan', () => {
    const [l] = ejemploPasivos('cuadro').leasings
    const [izq, der] = graficoCuota(l, false).opcion.yAxis as { max: number; interval: number }[]
    expect(izq.max).toBe(1_600_000)
    expect(izq.interval).toBe(800_000)
    expect(der.max).toBeGreaterThan(876 * 1.5)
  })
})
