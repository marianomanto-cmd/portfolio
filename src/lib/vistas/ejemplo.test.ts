import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { ejemploCartera, ejemploExposicion, ejemploHoy, ejemploHoyVacio, ejemploRegistro } from './ejemplo'

// El modo demo pasa los hechos inventados del Apéndice B de docs/vision.md por
// el motor real. Estos tests fijan que el motor reproduce las cuentas del
// apéndice: si alguno falla, o el set de ejemplo o el motor se apartaron del
// documento.

const D = (x: string | null) => {
  if (x === null) throw new Error('sin dato')
  return new Decimal(x)
}
const cerca = (x: string | null, esperado: string, tol = '0.005') => D(x).minus(esperado).abs().lte(tol)

describe('ejemplo (Apéndice B)', () => {
  const hoy = ejemploHoy()

  it('patrimonio financiero y total al 14/10', () => {
    expect(hoy.hay_datos).toBe(true)
    expect(hoy.fecha_datos).toBe('2026-10-14')
    expect(D(hoy.financiero.valor.ars.valor).toFixed(2)).toBe('104271540.00')
    expect(cerca(hoy.financiero.valor.usd.valor, '67350.1744', '0.0001')).toBe(true)
    expect(D(hoy.total.valor.ars.valor).toFixed(2)).toBe('430511540.00')
    expect(cerca(hoy.total.valor.usd.valor, '278072.3033', '0.0001')).toBe(true)
  })

  it('la frase del día: pesos, dólares, activos y CCL (D-35)', () => {
    const f = hoy.frase!
    expect(f.desde).toBe('2026-10-13')
    expect(f.hasta).toBe('2026-10-14')
    expect(D(f.variacion.ars.valor).toFixed(2)).toBe('590125.00')
    expect(cerca(f.variacion.usd.valor, '-340.2447', '0.0001')).toBe(true)
    expect(cerca(f.tc.ars.valor, '532812.44')).toBe(true)
    expect(cerca(f.activos.ars.valor, '57312.56')).toBe(true)
    expect(cerca(f.tc.usd.valor, '-377.0049', '0.0001')).toBe(true)
    expect(cerca(f.activos.usd.valor, '36.7602', '0.0001')).toBe(true)
    expect(f.sin_atribuir).toBeNull()
  })

  it('exposición: pesos financieros − deuda del leasing', () => {
    expect(D(hoy.exposicion.pesos_financieros.ars.valor).toFixed(2)).toBe('54183100.00')
    expect(D(hoy.exposicion.deuda_pesos.ars.valor).toFixed(2)).toBe('21400000.00')
    expect(D(hoy.exposicion.neto_ars.valor).toFixed(2)).toBe('32783100.00')
    expect(cerca(hoy.exposicion.neto_usd.valor, '21174.98')).toBe(true)
    expect(cerca(hoy.exposicion.sensibilidad_usd_1pct.valor, '-209.65')).toBe(true)
  })

  it('cuadre y atención', () => {
    expect(hoy.cuadre.ars_ok).toBe(true)
    expect(hoy.cuadre.usd_ok).toBe(true)
    expect(hoy.cargo_hoy).toBe(false)
    expect(hoy.es_habil_hoy).toBe(true)
    expect(hoy.atencion.map((p) => p.id).sort()).toEqual(['ccl-compra:p:1:2', 'ccl-compra:p:1:6', 'ccl-compra:p:2:5'])
  })

  it('cartera: resultados por posición y totales', () => {
    const c = ejemploCartera()
    const fila = (t: string) => c.filas.find((f) => f.ticker === t)!
    expect(D(fila('SPY').resultado.ars.valor).toFixed(2)).toBe('6206000.00')
    expect(cerca(fila('SPY').resultado.usd.valor, '1787.9335', '0.0001')).toBe(true)
    expect(cerca(fila('S13N6').resultado.usd.valor, '78.2217', '0.0001')).toBe(true)
    expect(cerca(fila('T30J7').resultado.usd.valor, '-235.7033', '0.0001')).toBe(true)
    expect(fila('T30J7').ganas_pesos_perdes_dolares).toBe(true)
    expect(fila('YPFD').resultado.usd.valor).toBeNull()
    expect(D(c.totales.resultado.ars.valor).toFixed(2)).toBe('8533500.00')
    expect(c.totales.resultado.usd.valor).toBeNull()
    expect(c.totales.resultado.usd.etiquetas).toContain('parcial')
  })

  it('exposición total: sin dato con la suma parcial a la vista (D-65, D-73)', () => {
    const t = ejemploExposicion('total')
    expect(t.resumen.neto_ars.valor).toBeNull()
    expect(t.resumen.neto_ars.motivo).toMatch(/32\.783\.100/)
    const f = ejemploExposicion('financiero')
    const top3 = D(f.concentracion.top3.valor)
    expect(top3.times(100).toDecimalPlaces(2).toFixed(2)).toBe('68.82')
  })

  it('día cero y registro', () => {
    const v = ejemploHoyVacio()
    expect(v.hay_datos).toBe(false)
    expect(v.financiero.valor.ars.valor).toBeNull()
    const r = ejemploRegistro()
    expect(r.filas.length).toBeGreaterThan(30)
    expect(r.filas.some((f) => f.estado === 'revertida')).toBe(true)
  })
})
