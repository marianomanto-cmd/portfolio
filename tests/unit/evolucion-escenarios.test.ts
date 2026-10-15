import { describe, expect, it, vi } from 'vitest'
import { decodificar } from '@/lib/domain/flujo/supuestos'
import { POR_DEFECTO } from '@/app/(app)/evolucion/_lib/parametros'

// Evolución › Futuro con escenarios guardados (revisión de pantallas, entrega 4):
// sin ?s= muestra el último guardado y "Ajustar supuestos" lo abre en Flujo con
// sus supuestos (antes abría Flujo vacío); ?e= elige otro guardado, y los
// archivados no se ofrecen. Datos del modo demo, números inventados (D-24).

vi.mock('@/lib/server/sesion', () => ({ modoDemo: () => false }))
vi.mock('@/lib/server/hechos', () => ({ leerHechos: async () => (await datos()).h }))
vi.mock('@/lib/server/hechos-pasivos', () => ({ leerPasivos: async () => (await datos()).d.leasing }))
vi.mock('@/lib/server/hechos-flujo', () => ({ leerFlujo: async () => (await datos()).d }))

async function datos() {
  const { datosEjemplo, ejemploFlujo } = await import('@/lib/vistas/ejemplo-flujo')
  const { h, d } = datosEjemplo('completo')
  const iniciales = ejemploFlujo('completo').supuestos_iniciales
  const sup = (horizonte_meses: number) => ({ ...iniciales, horizonte_meses })
  d.escenarios = [
    { id: 7, nombre: 'Dólar quieto', supuestos: sup(6), archivado: false, actualizado_en: '2026-10-10T12:00:00Z' },
    { id: 8, nombre: 'Dólar al 2% por mes', supuestos: sup(12), archivado: false, actualizado_en: '2026-10-12T12:00:00Z' },
    { id: 9, nombre: 'Uno archivado', supuestos: sup(24), archivado: true, actualizado_en: '2026-10-13T12:00:00Z' },
  ]
  return { h, d }
}

const horizonte = (ajustar: string | undefined) => decodificar(new URL(`http://x${ajustar}`).searchParams.get('s'))?.horizonte_meses

describe('Evolución con escenarios guardados', () => {
  it('sin elegir: el último guardado, y "Ajustar supuestos" lo abre en Flujo (no vacío)', async () => {
    const { vistaEvolucion } = await import('@/lib/vistas/evolucion')
    const v = await vistaEvolucion(POR_DEFECTO, null)
    expect(v.futuro?.escenario).toEqual({ id: 8, nombre: 'Dólar al 2% por mes' })
    expect(horizonte(v.futuro?.ajustar)).toBe(12)
    expect(v.futuro?.otros).toEqual([{ id: 7, nombre: 'Dólar quieto' }])
  })

  it('?e= elige otro guardado; uno archivado o que no existe no se elige', async () => {
    const { vistaEvolucion } = await import('@/lib/vistas/evolucion')
    const v = await vistaEvolucion({ ...POR_DEFECTO, e: 7 }, null)
    expect(v.futuro?.escenario.nombre).toBe('Dólar quieto')
    expect(horizonte(v.futuro?.ajustar)).toBe(6)
    expect(v.futuro?.otros).toEqual([{ id: 8, nombre: 'Dólar al 2% por mes' }])
    for (const e of [9, 99]) expect((await vistaEvolucion({ ...POR_DEFECTO, e }, null)).futuro?.escenario.id).toBe(8)
  })
})
