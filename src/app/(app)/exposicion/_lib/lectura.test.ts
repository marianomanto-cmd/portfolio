import { describe, expect, it } from 'vitest'
import { lecturaPlana, validarLectura } from '@/components/pantalla/lectura'
import type { CalcVista } from '@/lib/domain/calc'
import { ejemploExposicionPantalla } from '@/lib/vistas/ejemplo-balance'
import { lecturaExposicion } from './lectura'

const calcDe = (valor: string | null): CalcVista => ({ valor, formula: valor === null ? 'sin dato' : `x = ${valor}`, insumos: [], etiquetas: [], motivo: valor === null ? 'Falta.' : undefined })
const par = (v: string | null) => ({ ars: calcDe(v), usd: calcDe(v) })
const vista = (neto: string | null, extra: { deuda?: string | null; total?: boolean; bienes?: string[]; fecha?: string | null } = {}) => ({
  fecha_datos: extra.fecha === undefined ? '2026-10-14' : extra.fecha,
  vista: extra.total ? ('total' as const) : ('financiero' as const),
  sin_moneda_de_riesgo: extra.bienes ?? [],
  resumen: { pesos_financieros: par('100'), deuda_pesos: par(extra.deuda === undefined ? '50' : extra.deuda), neto_ars: calcDe(neto), neto_usd: calcDe(neto), sensibilidad_usd_1pct: calcDe('1') },
})

describe('la lectura de Exposición', () => {
  it('corto: "Debés más pesos de los que tenés", con el énfasis en "corto" y la cifra en positivo y trazable', () => {
    const l = lecturaExposicion(vista('-1750000'))
    expect(validarLectura(l)).toEqual({ ok: true })
    expect(lecturaPlana(l)).toBe('Debés más pesos de los que tenés: estás corto en pesos por $ 1.750.000.')
    expect(l.find((p) => p.enfasis)?.texto).toBe('corto')
    expect(l.find((p) => p.calc)?.calc?.valor).toBe('-1750000')
  })

  it('largo, con los números del demo (inventados)', () => {
    const l = lecturaExposicion(ejemploExposicionPantalla('financiero'))
    expect(validarLectura(l)).toEqual({ ok: true })
    expect(lecturaPlana(l)).toBe('Tenés más pesos de los que debés: estás largo en pesos por $ 32.783.100.')
  })

  it('neutral: se compensan', () => {
    const l = lecturaExposicion(vista('0'))
    expect(validarLectura(l)).toEqual({ ok: true })
    expect(lecturaPlana(l)).toContain('se compensan')
  })

  it('cuando falta algo lo dice con palabras, sin "sin dato" ni ceros', () => {
    const casos = [
      lecturaExposicion(vista(null, { fecha: null })),
      lecturaExposicion(vista(null, { deuda: null })),
      lecturaExposicion(vista(null)),
      lecturaExposicion(vista(null, { total: true, bienes: ['Casa', 'Camioneta'] })),
      lecturaExposicion(ejemploExposicionPantalla('total')),
      lecturaExposicion(ejemploExposicionPantalla('financiero', 'sin-deuda')),
      lecturaExposicion(ejemploExposicionPantalla('financiero', 'vacio')),
    ]
    for (const l of casos) {
      expect(validarLectura(l)).toEqual({ ok: true })
      expect(lecturaPlana(l)).not.toMatch(/sin dato|\$ 0\b/)
    }
    expect(lecturaPlana(casos[0])).toBe('Todavía no hay cargas: tu exposición aparece con la primera.')
    expect(lecturaPlana(casos[1])).toContain('Sin la deuda del leasing')
    expect(lecturaPlana(casos[3])).toContain('falta elegir la moneda de riesgo de Casa y Camioneta')
    expect(lecturaPlana(casos[4])).toContain('falta elegir la moneda de riesgo de Casa y Camioneta')
    expect(lecturaPlana(casos[5])).toContain('Sin la deuda del leasing')
  })
})
