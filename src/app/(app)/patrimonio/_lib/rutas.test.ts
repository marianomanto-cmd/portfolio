import { describe, expect, it } from 'vitest'
import { rutaBalance, unParametro } from './rutas'

describe('rutas del balance', () => {
  it('la última fecha y "cuenta" no se escriben; el demo se conserva', () => {
    expect(rutaBalance({ fecha: '2026-10-14', ultima: '2026-10-14', agrupar: 'cuenta' })).toBe('/patrimonio')
    expect(rutaBalance({ fecha: '2026-10-13', ultima: '2026-10-14', agrupar: 'clase', demo: 'viejo' })).toBe('/patrimonio?fecha=2026-10-13&agrupar=clase&demo=viejo')
    expect(rutaBalance({ comparar: '2026-10-01', primera: '2026-10-01' })).toBe('/patrimonio')
    expect(rutaBalance({ fecha: '2026-10-13', ultima: '2026-10-14', comparar: '2026-10-08', primera: '2026-10-01' })).toBe('/patrimonio?fecha=2026-10-13&comparar=2026-10-08')
    expect(unParametro(['a', 'b'])).toBe('a')
    expect(unParametro(undefined)).toBeNull()
  })
})
