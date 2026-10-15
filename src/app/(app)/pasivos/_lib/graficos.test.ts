import { describe, expect, it } from 'vitest'
import { conTema, TEMA_CLARO, tieneTorta } from '@/components/graficos/tema'
import { armarPasivos } from '@/lib/vistas/armar-pasivos'
import { ejemploPasivos, hechosEjemploPasivos } from '@/lib/vistas/ejemplo-pasivos'
import { graficoApertura, graficoIndexado } from './graficos'

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
