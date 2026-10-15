import { describe, expect, it } from 'vitest'
import { completarConIgual } from '@/lib/domain/flujo/supuestos'
import type { FlujoCargado } from '@/lib/server/hechos-flujo'
import { ejemploFlujo } from './ejemplo-flujo'
import { DEMO_MAX, partirDemoGuardado, unirDemoGuardado } from './flujo'

// Lo que se "guarda" en el demo vive en cookies del navegador: cada una tiene
// que entrar en 4 KB (con su nombre), o el navegador la descarta sin avisar.
describe('lo guardado en el demo', () => {
  it('con lo máximo que entra, cada cookie queda debajo de 4 KB, y se lee igual que se escribió', () => {
    const v = ejemploFlujo('completo')
    const s = { ...completarConIgual(v.supuestos_iniciales, v.base!), horizonte_meses: 120 }
    const flujo = (id: number): FlujoCargado => ({
      id,
      fecha: '2026-10-15',
      sentido: 'ingreso',
      concepto: 'extraordinario',
      moneda: 'USD',
      monto: '123456.78',
      cuenta_id: 1,
      cripto_usado: '1541.25',
      pesos_recibidos: '190277641.48',
      anulado: false,
      carga_id: 9000 + id,
      notas: 'una nota de prueba bastante larga para ver el tamaño de la cookie, inventada',
      lote: '0b6f2a52-6a2e-4c43-9d3f-2b7d6c7e8f90',
      revertida: false,
      creado_en: '2026-10-15T12:00:00.000Z',
    })
    const d = {
      flujos: Array.from({ length: DEMO_MAX.flujos + 3 }, (_, i) => flujo(i + 1)),
      escenarios: Array.from({ length: DEMO_MAX.escenarios + 2 }, (_, i) => ({ id: 100 + i, nombre: `Escenario de prueba número ${i}`, supuestos: s, archivado: false, actualizado_en: '2026-10-15T12:00:00.000Z' })),
      recordados: { 'devaluacion.sube': '2.5', 'retorno.cedear.baja': '10', 'ingreso_usd.baja': '20' },
    }
    const p = partirDemoGuardado(d)
    expect(p.flujos.length + 'demo_flujo='.length).toBeLessThan(4000)
    expect(p.escenarios.length + 'demo_flujo_esc='.length).toBeLessThan(4000)
    const u = unirDemoGuardado(p.flujos, p.escenarios)
    expect(u.flujos.map((f) => f.id)).toEqual(d.flujos.slice(-DEMO_MAX.flujos).map((f) => f.id))
    expect(u.escenarios.map((e) => e.id)).toEqual([102, 103])
    expect(u.recordados).toEqual(d.recordados)
    expect(unirDemoGuardado('basura', undefined)).toEqual({ flujos: [], escenarios: [], recordados: {} })
  })
})
