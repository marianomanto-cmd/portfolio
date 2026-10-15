import { describe, expect, it } from 'vitest'
import { decodificar } from '@/lib/domain/flujo/supuestos'
import { proyectar } from '@/lib/domain/flujo/proyeccion'
import { ejemploFlujo } from '@/lib/vistas/ejemplo-flujo'
import { PANTALLAS_FLUJO, S_IGUAL_12, S_MIXTO_36 } from '../e2e/pantallas/flujo'

// Los escenarios en la URL que recorre el test de layout (tests/e2e/pantallas/flujo.ts)
// se leen y proyectan con el esquema de hoy. Si cambia, regeneralos con codificar().
describe('pantallas de Flujo del test de layout', () => {
  it('los ?s= se leen y dan una proyección lista', () => {
    const base = ejemploFlujo('completo').base!
    for (const [t, meses] of [
      [S_IGUAL_12, 13],
      [S_MIXTO_36, 37],
    ] as const) {
      const s = decodificar(t)
      expect(s).not.toBeNull()
      const p = proyectar(base, s!)
      expect(p.estado).toBe('lista')
      expect(p.meses).toHaveLength(meses)
    }
  })

  it('están todos los estados demo y las dos páginas', () => {
    const rutas = PANTALLAS_FLUJO.map((p) => p.ruta)
    for (const d of ['vacio', 'sin-ingresos', 'parcial', 'comparar']) expect(rutas).toContain(`/flujo?demo=${d}`)
    expect(rutas).toContain('/flujo')
    expect(rutas).toContain('/flujo/cargar?sentido=ingreso')
    expect(rutas).toContain('/flujo/cargar?sentido=gasto')
    expect(new Set(PANTALLAS_FLUJO.map((p) => p.nombre)).size).toBe(PANTALLAS_FLUJO.length)
  })
})
