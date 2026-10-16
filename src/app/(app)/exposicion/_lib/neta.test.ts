import { describe, expect, it } from 'vitest'
import { conTema, TEMA_OSCURO, tieneTorta } from '@/components/graficos/tema'
import { lecturaPlana } from '@/components/pantalla/lectura'
import type { PuntoNetoExposicion } from '@/lib/vistas/contratos-exposicion'
import { ejemploExposicionPantalla } from '@/lib/vistas/ejemplo-balance'
import { mesesAntes, netoDe, notaNeta, opcionNeta, rotuloNeta, ultimos12Meses } from './neta'

type Serie = { name: string; data: (number | null)[]; markLine?: unknown; areaStyle?: { color: string } }
const series = (o: Record<string, unknown>) => o.series as Serie[]
const p = (fecha: string, neto: string | null, pesos: string | null = '100', deuda: string | null = '50'): PuntoNetoExposicion => ({
  fecha,
  neto_ars: neto,
  neto_usd: neto === null ? null : String(Number(neto) / 1000),
  pesos_ars: pesos,
  deuda_ars: deuda,
  ccl: '1000',
})

describe('exposición neta al peso en el tiempo', () => {
  it('la ventana es el último año; el rótulo dice desde cuándo si la historia es más corta', () => {
    expect(mesesAntes('2026-10-31', 1)).toBe('2026-09-30')
    expect(mesesAntes('2026-03-15', 12)).toBe('2025-03-15')
    const serie = [p('2025-09-01', '1'), p('2025-11-01', '2'), p('2026-10-14', '3')]
    const v = ultimos12Meses(serie)
    expect(v.puntos.map((x) => x.fecha)).toEqual(['2025-11-01', '2026-10-14'])
    expect(v.completa).toBe(true)
    expect(rotuloNeta(v.puntos, v.completa)).toBe('Exposición neta al peso · 12 meses')
    const corta = ultimos12Meses([p('2026-10-01', '1'), p('2026-10-14', '2')])
    expect(corta.completa).toBe(false)
    expect(rotuloNeta(corta.puntos, corta.completa)).toBe('Exposición neta al peso · desde el jue 01/10')
  })

  it('corto: un área en sangría bajo la línea punteada del cero; "sin dato" es un hueco, nunca 0', () => {
    const { opcion, tabla } = opcionNeta([p('2026-10-01', '-6100000'), p('2026-10-02', null), p('2026-10-05', '-1750000')], { privado: false })
    expect(tieneTorta(opcion)).toBe(false)
    const ss = series(opcion)
    expect(ss).toHaveLength(1)
    expect(ss[0].name).toBe('Corto en pesos')
    expect(ss[0].data).toEqual([-6100000, null, -1750000])
    expect(ss[0].areaStyle?.color).toBe('tema:acento@0.16')
    expect(ss[0].markLine).toBeDefined()
    expect(tabla.filas[1]).toEqual(['vie 02/10', 'sin dato', 'sin dato'])
    expect(() => conTema(opcion, TEMA_OSCURO, { movil: true, animar: false })).not.toThrow()
  })

  it('largo, en tinta; si cruza el cero, una serie por lado', () => {
    expect(series(opcionNeta([p('2026-10-01', '5'), p('2026-10-02', '7')], { privado: false }).opcion)[0].name).toBe('Largo en pesos')
    const ambos = series(opcionNeta([p('2026-10-01', '-5'), p('2026-10-02', '7')], { privado: false }).opcion)
    expect(ambos.map((s) => s.name)).toEqual(['Largo en pesos', 'Corto en pesos'])
    expect(ambos[0].data).toEqual([0, 7])
    expect(ambos[1].data).toEqual([-5, 0])
  })

  it('modo privado: ni el eje ni el tooltip ni la tabla dicen montos', () => {
    const { opcion, tabla } = opcionNeta([p('2026-10-01', '-5'), p('2026-10-02', '7')], { privado: true })
    // El eje vertical no lleva rótulos nunca (como en el diseño): la referencia es la línea del cero.
    expect((opcion.yAxis as { axisLabel: { show: boolean } }).axisLabel.show).toBe(false)
    const tooltip = (opcion.tooltip as { formatter: (p: { dataIndex: number }[]) => string }).formatter([{ dataIndex: 1 }])
    expect(tooltip).not.toMatch(/\$\s?[−+-]?\d/)
    expect(tabla.filas.flat().some((c) => c.includes('$'))).toBe(false)
  })

  it('la nota: de dónde a dónde, con cada cifra trazable con su cuenta', () => {
    const nota = notaNeta([p('2026-10-01', '-6100000', '3700000', '9800000'), p('2026-10-14', '-1750000', '8050000', '9800000')])
    expect(lecturaPlana(nota)).toBe('Del jue 01/10 al mié 14/10: de corto $ 6.100.000 a corto $ 1.750.000. Línea punteada = neutral: arriba, largo en pesos; abajo, corto.')
    const cifras = nota.filter((x) => x.calc)
    expect(cifras).toHaveLength(2)
    expect(cifras[0].calc?.formula).toBe('$ 3.700.000,00 − $ 9.800.000,00 = −$ 6.100.000,00')
    expect(lecturaPlana(notaNeta([p('2026-10-14', '5')]))).toContain('Un punto, el mié 14/10')
    expect(lecturaPlana(notaNeta([]))).toBe('Aparece con tu primera carga.')
    expect(netoDe(p('2026-10-14', null)).valor).toBeNull()
  })

  it('con el demo (inventado): la serie del motor, también en dólares', () => {
    const v = ejemploExposicionPantalla('financiero')
    expect(v.serie_neto.length).toBe(v.serie.length)
    const ultimo = v.serie_neto.at(-1)!
    expect(ultimo.neto_ars).toBe(v.resumen.neto_ars.valor)
    expect(Number(ultimo.neto_usd)).toBeCloseTo(Number(v.resumen.neto_usd.valor), 6)
  })
})
