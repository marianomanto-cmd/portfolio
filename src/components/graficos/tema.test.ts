import { describe, expect, it } from 'vitest'
import { colorTema, conAlfa, conTema, paletaSeries, resolverColores, TEMA_CLARO, TEMA_OSCURO, tieneTorta } from './tema'

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
    // El nombre del gráfico, el de la pantalla: ECharts no lo pisa con su descripción en inglés y con los datos.
    expect(conTema(barras, TEMA_CLARO, { movil: false, animar: true, nombre: 'Patrimonio neto · 12 meses' }).aria).toMatchObject({
      enabled: true,
      label: { description: 'Patrimonio neto · 12 meses' },
    })
    expect(o.series).toBe(barras.series)
    expect(o.animation).toBe(true)
  })

  it('ejes en mono 10 px con la tinta de los metadatos y líneas de grilla hairline (D-157)', () => {
    const o = conTema(barras, TEMA_OSCURO, { movil: false, animar: true })
    const x = o.xAxis as { axisLabel: { color: string; fontFamily: string; fontSize: number } }
    const y = o.yAxis as { splitLine: { lineStyle: { color: string; width: number } } }
    expect(x.axisLabel).toMatchObject({ color: TEMA_OSCURO.faint, fontFamily: TEMA_OSCURO.fuenteMono, fontSize: 10 })
    expect(y.splitLine.lineStyle).toEqual({ color: TEMA_OSCURO.borde, width: 1 })
  })

  it('el tooltip es una placa de vidrio: fondo traslúcido de la superficie, desenfoque y hairline', () => {
    const o = conTema(barras, TEMA_OSCURO, { movil: false, animar: true }).tooltip as { backgroundColor: string; extraCssText: string; textStyle: { fontFamily: string } }
    expect(o.backgroundColor).toBe('rgba(21, 19, 28, 0.78)')
    expect(o.extraCssText).toContain('backdrop-filter: blur(14px)')
    expect(o.textStyle.fontFamily).toBe(TEMA_OSCURO.fuenteMono)
  })

  it('las series sin color toman la paleta del sistema: oro primero (dólares), tinta después (pesos)', () => {
    const o = conTema(barras, TEMA_OSCURO, { movil: false, animar: true })
    expect(o.color).toEqual(paletaSeries(TEMA_OSCURO))
    expect((o.color as string[])[0]).toBe(TEMA_OSCURO.viz)
    // Si el gráfico trae su paleta, manda la suya.
    expect(conTema({ ...barras, color: ['#123456'] }, TEMA_OSCURO, { movil: false, animar: true }).color).toEqual(['#123456'])
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

describe('colores del sistema dentro de una opción (colorTema)', () => {
  it('se resuelven con el tema vigente: el mismo gráfico anda en oscuro y en claro', () => {
    const opcion = { series: [{ type: 'line', lineStyle: { color: colorTema('viz') }, areaStyle: { color: colorTema('viz', 0.14) } }] }
    const oscuro = conTema(opcion, TEMA_OSCURO, { movil: false, animar: false })
    const claro = conTema(opcion, TEMA_CLARO, { movil: false, animar: false })
    const serie = (o: Record<string, unknown>) => (o.series as { lineStyle: { color: string }; areaStyle: { color: string } }[])[0]
    expect(serie(oscuro).lineStyle.color).toBe(TEMA_OSCURO.viz)
    expect(serie(oscuro).areaStyle.color).toBe('rgba(224, 164, 88, 0.14)')
    expect(serie(claro).lineStyle.color).toBe(TEMA_CLARO.viz)
  })

  it('no toca funciones, números ni textos que no son colores del tema', () => {
    const f = () => 'x'
    const o = { a: 1, b: 'tema', c: f, d: ['tema:nada', 'tema:texto'], e: null }
    const r = resolverColores(o, TEMA_OSCURO)
    expect(r.a).toBe(1)
    expect(r.b).toBe('tema')
    expect(r.c).toBe(f)
    expect(r.d).toEqual(['tema:nada', TEMA_OSCURO.texto])
    expect(r.e).toBeNull()
    // Sin colores del tema, devuelve el mismo objeto (no copia de más).
    const igual = { x: [1, 2, 3], y: { z: '#fff' } }
    expect(resolverColores(igual, TEMA_OSCURO)).toBe(igual)
  })

  it('conAlfa: hex corto y largo, y un rgba multiplica la transparencia que ya tenía', () => {
    expect(conAlfa('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
    expect(conAlfa('#E0A458', 0.14)).toBe('rgba(224, 164, 88, 0.14)')
    expect(conAlfa('rgba(244, 241, 234, 0.1)', 0.5)).toBe('rgba(244, 241, 234, 0.05)')
    expect(conAlfa('currentColor', 0.5)).toBe('currentColor')
  })
})
