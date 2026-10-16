// El gráfico de Hoy (handoff, fila 3): dos gráficos chicos (en dólares y en
// pesos) con el mismo eje de fechas, sin montos en los ejes, sin tortas y,
// en el modo privado, sin montos en el tooltip ni en la tabla. Con la serie
// del ejemplo (números inventados, D-24).
import { describe, expect, it } from 'vitest'
import { hechosEjemplo, HOY_EJEMPLO } from '@/lib/vistas/ejemplo'
import { seriePatrimonio } from '@/lib/vistas/armar-hoy'
import type { SeriePatrimonio } from '@/lib/vistas/contratos-hoy'
import { OCULTO, tieneTorta } from '@/components/graficos/tema'
import { ALTO_MINI, ALTO_TOTAL, etiquetaEje, instante, opcionPatrimonio, rotuloSerie, SEPARACION, tablaPatrimonio } from './graficos'

type Opcion = {
  grid: { top: number; height: number }[]
  xAxis: { gridIndex: number; min: number; max: number; axisLabel: { show?: boolean; formatter?: (v: number) => string } }[]
  yAxis: { gridIndex: number; show: boolean }[]
  series: { name: string; xAxisIndex: number; data: [number, number | null][]; connectNulls: boolean; showSymbol: boolean }[]
  tooltip: { formatter: (p: { dataIndex: number }[]) => string }
}

const serie = () => seriePatrimonio(hechosEjemplo(), HOY_EJEMPLO)

describe('opcionPatrimonio', () => {
  it('dos grillas apiladas (dólares arriba, pesos abajo) con el mismo eje de fechas; los montos no van en ningún eje', () => {
    const o = opcionPatrimonio(serie(), { privado: false }) as unknown as Opcion
    expect(o.grid.map((g) => [g.top, g.height])).toEqual([
      [0, ALTO_MINI],
      [ALTO_MINI + SEPARACION, ALTO_MINI],
    ])
    expect(o.series.map((s) => [s.name, s.xAxisIndex])).toEqual([
      ['En dólares', 0],
      ['En pesos', 1],
    ])
    expect(o.xAxis[0].min).toBe(o.xAxis[1].min)
    expect(o.xAxis[0].max).toBe(o.xAxis[1].max)
    // Solo el de abajo lleva fechas; ningún eje lleva montos.
    expect(o.xAxis[0].axisLabel.show).toBe(false)
    expect(o.xAxis[1].axisLabel.formatter!(instante('2026-10-14'))).toBe('14/10')
    expect(o.yAxis.every((y) => y.show === false)).toBe(true)
    expect(tieneTorta(o as never)).toBe(false)
    expect(ALTO_TOTAL).toBeGreaterThan(ALTO_MINI * 2)
  })

  it('un punto por fecha de carga, con el valor de cada moneda', () => {
    const s = serie()
    const o = opcionPatrimonio(s, { privado: false }) as unknown as Opcion
    expect(o.series[1].data).toHaveLength(s.puntos.length)
    expect(o.series[1].data.at(-1)).toEqual([instante('2026-10-14'), 430511540])
    expect(o.series.every((x) => x.connectNulls === false)).toBe(true)
  })

  it('un hueco es un hueco: un punto sin dato no se une con una línea', () => {
    const s: SeriePatrimonio = { ...serie() }
    s.puntos = s.puntos.map((p, i) => (i === 3 ? { ...p, ars: null } : p))
    const o = opcionPatrimonio(s, { privado: false }) as unknown as Opcion
    expect(o.series[1].data[3]).toEqual([instante(s.puntos[3].fecha), null])
  })

  it('el tooltip: la fecha y los dos montos; en el modo privado, tapados', () => {
    const o = opcionPatrimonio(serie(), { privado: false }) as unknown as Opcion
    const ultimo = o.tooltip.formatter([{ dataIndex: 8 }])
    expect(ultimo).toBe('mié 14/10<br/>US$ 278.072<br/>$ 430.511.540')
    const p = opcionPatrimonio(serie(), { privado: true }) as unknown as Opcion
    expect(p.tooltip.formatter([{ dataIndex: 8 }])).toBe(`mié 14/10<br/>${OCULTO}<br/>${OCULTO}`)
  })

  it('una sola carga: el punto se ve y el eje tiene aire; sin puntos, sin series', () => {
    const una = seriePatrimonio(hechosEjemplo(), '2026-10-01')
    const o = opcionPatrimonio(una, { privado: false }) as unknown as Opcion
    expect(o.series[0].showSymbol).toBe(true)
    expect(o.xAxis[0].max - o.xAxis[0].min).toBe(2 * 86_400_000)
    expect(opcionPatrimonio({ ...una, puntos: [] }, { privado: false })).toEqual({ series: [] })
  })
})

describe('tablaPatrimonio (el lector de pantalla y "Ver como tabla")', () => {
  it('fecha, en dólares y en pesos; "sin dato" si falta; el modo privado tapa los montos', () => {
    const s = serie()
    const t = tablaPatrimonio(s, { privado: false })
    expect(t.columnas).toEqual(['Fecha', 'En dólares', 'En pesos'])
    expect(t.filas[0]).toEqual(['jue 01/10', 'US$ 279.215', '$ 418.067.910'])
    const hueco = tablaPatrimonio({ ...s, puntos: [{ fecha: '2026-10-01', ars: null, usd: '1' }] }, { privado: false })
    expect(hueco.filas[0][2]).toBe('sin dato')
    expect(tablaPatrimonio(s, { privado: true }).filas.every((f) => f[1] === OCULTO && f[2] === OCULTO)).toBe(true)
  })
})

describe('etiquetaEje y rotuloSerie', () => {
  it('meses si la serie es larga, día y mes si es corta', () => {
    expect(etiquetaEje(instante('2026-10-14'), true)).toBe('OCT')
    expect(etiquetaEje(instante('2026-01-05'), false)).toBe('05/01')
  })

  it('"12 meses" con la historia completa; si no, desde cuándo hay', () => {
    expect(rotuloSerie(serie())).toBe('Patrimonio neto · desde el jue 01/10')
    expect(rotuloSerie({ ...serie(), periodo: { desde: '2025-10-15', hasta: '2026-10-14', completo: true } })).toBe('Patrimonio neto · 12 meses')
    expect(rotuloSerie({ ...serie(), periodo: null })).toBe('Patrimonio neto · 12 meses')
  })
})
