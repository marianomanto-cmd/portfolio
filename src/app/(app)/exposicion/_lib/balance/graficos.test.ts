import { describe, expect, it } from 'vitest'
import { conTema, TEMA_CLARO, tieneTorta } from '@/components/graficos/tema'
import { ejemploBalance } from '@/lib/vistas/ejemplo-balance'
import type { PuntoBalance } from '@/lib/vistas/contratos-balance'
import { clasesDe, leyendaEvolucion, opcionEvolucion, tablaEvolucion } from './graficos'

// Los datos del gráfico son los de la vista: mismo largo, ningún NaN, null
// donde hay "sin dato" (plan §8). Sin tortas.

type Serie = { name: string; data: (number | null)[]; type: string; stack?: string; lineStyle?: { type?: string } }
const series = (o: Record<string, unknown>) => o.series as Serie[]
const base = { moneda: 'ARS' as const, privado: false, oscuro: false, rotuloFirme: 'Sin la camioneta' }

describe('evolución del balance', () => {
  const v = ejemploBalance('estimada')

  it('una serie por clase apilada y las dos líneas, con el largo de la vista y sin NaN', () => {
    const o = opcionEvolucion(v.serie, base)
    expect(tieneTorta(o)).toBe(false)
    const ss = series(o)
    expect(ss.length).toBe(clasesDe(v.serie).length + 2)
    for (const s of ss) {
      expect(s.data).toHaveLength(v.serie.length)
      expect(s.data.some((x) => typeof x === 'number' && Number.isNaN(x))).toBe(false)
    }
    expect(ss.filter((s) => s.stack === 'activo')).toHaveLength(clasesDe(v.serie).length)
    const neto = ss.find((s) => s.name.startsWith('Patrimonio neto'))!
    expect(neto.lineStyle?.type).toBe('dashed') // deuda estimada
    expect(neto.data.at(-1)).toBe(Number(v.serie.at(-1)!.completo.ars))
    // pasa por el tema compartido sin errores
    expect(() => conTema(o, TEMA_CLARO, { movil: true, animar: false })).not.toThrow()
  })

  it('un "sin dato" es null en el gráfico y "sin dato" en la tabla, nunca 0', () => {
    const nada = { ars: null, usd: null }
    const serie: PuntoBalance[] = [
      { fecha: '2026-10-13', por_clase: { cedear: nada, liquidez: { ars: '100', usd: '0.1' } }, por_rubro: { liquidez: { ars: '100', usd: '0.1' }, titulos: nada, bienes: nada }, neto: nada, completo: nada, completo_estimado: false },
      { fecha: '2026-10-14', por_clase: { cedear: { ars: '200', usd: '0.2' }, liquidez: { ars: '100', usd: '0.1' } }, por_rubro: { liquidez: { ars: '100', usd: '0.1' }, titulos: { ars: '200', usd: '0.2' }, bienes: nada }, neto: { ars: '300', usd: '0.3' }, completo: { ars: '300', usd: '0.3' }, completo_estimado: false },
    ]
    const o = opcionEvolucion(serie, { ...base, rotuloFirme: null })
    const cedear = series(o).find((s) => s.name === 'CEDEARs')!
    expect(cedear.data).toEqual([null, 200])
    const t = tablaEvolucion(serie, { moneda: 'ARS', privado: false, rotuloFirme: null })
    expect(t.columnas).toEqual(['Fecha', 'Liquidez', 'Títulos', 'Bienes', 'Patrimonio neto'])
    expect(t.filas[0]).toEqual(['mar 13/10', '$ 100', 'sin dato', 'sin dato', 'sin dato'])
    expect(t.filas[1][2]).toBe('$ 200')
  })

  it('en dólares usa los dólares; una sola carga es un punto', () => {
    const u = ejemploBalance('un-dia')
    const o = opcionEvolucion(u.serie, { ...base, moneda: 'USD' })
    const ss = series(o)
    expect(ss.every((s) => s.data.length === 1)).toBe(true)
    expect(ss.find((s) => s.name.startsWith('Patrimonio neto'))!.data[0]).toBe(Number(u.serie[0].completo.usd))
  })

  it('la leyenda (en HTML): una entrada por capa y por línea, con su forma', () => {
    const l = leyendaEvolucion(v.serie, 'Sin la camioneta')
    expect(l.at(-2)).toEqual({ nombre: 'Patrimonio neto (deuda estimada)', color: null, forma: 'rayada' })
    expect(l.at(-1)?.forma).toBe('punteada')
    expect(l.filter((x) => x.forma === 'area')).toHaveLength(clasesDe(v.serie).length)
  })

  it('modo privado: sin montos en el eje ni en la tabla', () => {
    const o = opcionEvolucion(v.serie, { ...base, privado: true })
    expect((o.yAxis as { axisLabel: { show: boolean } }).axisLabel.show).toBe(false)
    const t = tablaEvolucion(v.serie, { moneda: 'ARS', privado: true, rotuloFirme: null })
    expect(t.filas.flat().some((c) => c.includes('$'))).toBe(false)
  })
})
