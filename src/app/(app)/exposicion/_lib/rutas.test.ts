import { describe, expect, it } from 'vitest'
import { delBalance, rutaExposicion, unParametro } from './rutas'

describe('rutas de Exposición (con el balance adentro, D-156)', () => {
  it('la última fecha, "cuenta", la primera comparación y "financiero" no se escriben; el demo se conserva', () => {
    expect(rutaExposicion({ fecha: '2026-10-14', ultima: '2026-10-14', agrupar: 'cuenta' })).toBe('/exposicion')
    expect(rutaExposicion({ vista: 'financiero' })).toBe('/exposicion')
    expect(rutaExposicion({ fecha: '2026-10-13', ultima: '2026-10-14', agrupar: 'clase', demo: 'viejo' })).toBe('/exposicion?fecha=2026-10-13&agrupar=clase&demo=viejo')
    expect(rutaExposicion({ comparar: '2026-10-01', primera: '2026-10-01' })).toBe('/exposicion')
    expect(rutaExposicion({ fecha: '2026-10-13', ultima: '2026-10-14', comparar: '2026-10-08', primera: '2026-10-01' })).toBe('/exposicion?fecha=2026-10-13&comparar=2026-10-08')
  })

  it('cambiar qué netea conserva lo que eligió el balance, y al revés', () => {
    const sp = { fecha: '2026-10-08', agrupar: 'instrumento', demo: 'completo' }
    expect(rutaExposicion({ ...delBalance(sp), vista: 'total' })).toBe('/exposicion?vista=total&fecha=2026-10-08&agrupar=instrumento&demo=completo')
    expect(rutaExposicion({ vista: 'total', fecha: '2026-10-08', ultima: '2026-10-14', agrupar: 'clase' })).toBe('/exposicion?vista=total&fecha=2026-10-08&agrupar=clase')
  })

  it('un parámetro repetido vale el primero; ausente, null', () => {
    expect(unParametro(['a', 'b'])).toBe('a')
    expect(unParametro(undefined)).toBeNull()
    expect(delBalance({})).toEqual({ fecha: null, agrupar: null, comparar: null, demo: null })
  })
})
