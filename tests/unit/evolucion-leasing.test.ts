import { describe, expect, it, vi } from 'vitest'
import { POR_DEFECTO } from '@/app/(app)/evolucion/_lib/parametros'

// Evolución › estado de resultados con el leasing, a través de la vista entera
// (revisión de los arreglos, 15/10): con el cuadro importado y la cuota de la
// empresa, el costo es $ 0 y lo dice (no "falta el cuadro"); con el cuadro
// incompleto, un período sin su cuota es "sin dato" (nunca $ 0), como Flujo y
// Hoy. Ejemplo de Pasivos del modo demo, números inventados (D-24).

let variante: 'empresa' | 'incompleto' | 'completo' = 'completo'

vi.mock('@/lib/server/sesion', () => ({ modoDemo: () => false }))
vi.mock('@/lib/server/hechos', () => ({ leerHechos: async () => (await datos()).h }))
vi.mock('@/lib/server/hechos-pasivos', () => ({ leerPasivos: async () => (await datos()).hp }))
vi.mock('@/lib/server/hechos-flujo', () => ({
  leerFlujo: async () => {
    const { hp } = await datos()
    return { recurrentes: [], flujos_bono: [], escenarios: [], recordados: {}, flujos: [], leasing: hp }
  },
}))

async function datos() {
  const { hechosEjemploPasivos } = await import('@/lib/vistas/ejemplo-pasivos')
  const { h, hp } = hechosEjemploPasivos('cuadro')
  if (variante === 'empresa') hp.contratos = hp.contratos.map((c) => ({ ...c, pagador_habitual: 'empresa' as const }))
  // Sin la cuota que vence en el período (la 14, del 01/10): 34 de 35.
  if (variante === 'incompleto') hp.cuotas = hp.cuotas.filter((c) => c.nro !== 14)
  return { h, hp }
}

async function lineaLeasing() {
  const { vistaEvolucion } = await import('@/lib/vistas/evolucion')
  const v = await vistaEvolucion({ ...POR_DEFECTO, periodo: 'todo' }, null)
  return v.resultados?.lineas.find((l) => l.clave === 'leasing')
}

describe('Evolución: el costo del leasing en el estado de resultados', () => {
  it('con el cuadro completo y la cuota tuya, la cuota del período tiene su costo', async () => {
    variante = 'completo'
    const l = await lineaLeasing()
    expect(l?.valor.ars.valor).not.toBeNull()
    expect(Number(l?.valor.ars.valor)).toBeGreaterThan(0)
  })

  it('con la cuota a cargo de la empresa: $ 0 y "la cuota la paga la empresa" (no "falta el cuadro de marcha")', async () => {
    variante = 'empresa'
    const l = await lineaLeasing()
    expect(l?.nota).toBe('la cuota la paga la empresa')
    expect(l?.valor.ars.valor).toBe('0')
    expect(JSON.stringify(l)).not.toMatch(/Falta el cuadro de marcha/)
  })

  it('con el cuadro incompleto y el período sobre el mes que falta: sin dato con su motivo, nunca $ 0', async () => {
    variante = 'incompleto'
    const l = await lineaLeasing()
    expect(l?.valor.ars.valor).toBeNull()
    expect(JSON.stringify(l)).toMatch(/tiene 34 de 35 cuotas y no la de un mes del período/)
  })
})
