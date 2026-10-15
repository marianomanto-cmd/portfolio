import { describe, expect, it } from 'vitest'
import { conTema, TEMA_CLARO, tieneTorta } from './tema'

describe('tema de los gráficos', () => {
  const barras = {
    xAxis: { type: 'category', data: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep'] },
    yAxis: { type: 'value' },
    legend: { data: ['Ingresos'] },
    series: [{ type: 'bar', name: 'Ingresos', data: [1, 2, 3, 4, 5, 6, 7, 8, 9] }],
    dataZoom: [{ type: 'slider' }],
  }

  it('no deja pasar una torta ni una rosa (spec §UI)', () => {
    expect(tieneTorta({ series: [{ type: 'pie' }] })).toBe(true)
    expect(tieneTorta({ series: { type: 'bar', roseType: 'radius' } })).toBe(true)
    expect(tieneTorta(barras)).toBe(false)
    expect(() => conTema({ series: [{ type: 'pie', data: [] }] }, TEMA_CLARO, { movil: false, animar: true })).toThrow(/torta/)
  })

  it('tooltip confinado, sin zoom, accesible, con los colores del tema y los datos intactos', () => {
    const o = conTema(barras, TEMA_CLARO, { movil: false, animar: true })
    expect(o.dataZoom).toBeUndefined()
    expect(o.tooltip).toMatchObject({ confine: true, borderColor: TEMA_CLARO.borde })
    expect(o.aria).toMatchObject({ enabled: true })
    expect(o.series).toBe(barras.series)
    expect((o.xAxis as { axisLabel: { color: string } }).axisLabel.color).toBe(TEMA_CLARO.tenue)
    expect(o.animation).toBe(true)
  })

  it('el tooltip queda confinado aunque el gráfico pida lo contrario', () => {
    expect(conTema({ ...barras, tooltip: { confine: false, trigger: 'axis' } }, TEMA_CLARO, { movil: false, animar: true }).tooltip).toMatchObject({
      confine: true,
      trigger: 'axis',
    })
  })

  it('en el teléfono: leyenda abajo y como mucho 4 etiquetas en el eje x', () => {
    const o = conTema(barras, TEMA_CLARO, { movil: true, animar: true })
    expect(o.legend).toMatchObject({ bottom: 0, left: 'center' })
    expect((o.xAxis as { axisLabel: { interval: number } }).axisLabel.interval).toBe(2) // 9 etiquetas → cada 3
    expect(o.grid).toMatchObject({ bottom: 48 })
  })

  it('sin animación con "reducir movimiento"', () => {
    expect(conTema(barras, TEMA_CLARO, { movil: false, animar: false }).animation).toBe(false)
  })
})
