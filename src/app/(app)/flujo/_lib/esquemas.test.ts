import { describe, expect, it } from 'vitest'
import { esquemaFlujoReal, esquemaPago, esquemaRecurrente, leer } from './esquemas'

// Los formularios de Flujo: números en formato argentino, errores en castellano
// (también cuando falta un campo entero, como una cuenta sin elegir).
const form = (o: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}

describe('Cargar ingreso / Cargar gasto', () => {
  const base = { sentido: 'ingreso', concepto: 'mensual', moneda: 'USD', monto: '3.800', fecha: '2026-10-15', cuenta: '1' }

  it('lee el monto argentino y la cuenta', () => {
    const r = leer(esquemaFlujoReal, form(base))
    expect(r).toEqual({ ok: true, datos: { ...base, monto: '3800', cripto: null, pesos: null, notas: null } })
    const afuera = leer(esquemaFlujoReal, form({ ...base, cuenta: 'afuera', monto: '1.234,56', moneda: 'ARS' }))
    expect(afuera.ok && afuera.datos.monto).toBe('1234.56')
  })

  it('sin concepto, sin moneda o sin cuenta: el error dice qué elegir, en castellano', () => {
    const { concepto: _c, moneda: _m, cuenta: _a, ...resto } = base
    const r = leer(esquemaFlujoReal, form(resto))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errores.concepto).toBe('Elegí el concepto.')
    expect(r.errores.moneda).toBe('Elegí US$ o $.')
    expect(r.errores.cuenta).toBe('Elegí la cuenta (o «Afuera»).')
    for (const m of Object.values(r.errores)) expect(m).not.toMatch(/Invalid|expected|received/)
  })

  it('el cripto y los pesos van juntos, y solo con dólares de ingreso', () => {
    const solo = leer(esquemaFlujoReal, form({ ...base, cripto: '1.541' }))
    expect(!solo.ok && solo.errores.pesos).toBe('El cripto y los pesos van juntos: completá los dos o ninguno.')
    const pesos = leer(esquemaFlujoReal, form({ ...base, moneda: 'ARS', cripto: '1.541', pesos: '5.855.800' }))
    expect(!pesos.ok && pesos.errores.cripto).toBe('El cripto va solo con dólares que vendiste.')
    const ok = leer(esquemaFlujoReal, form({ ...base, cripto: '1.541', pesos: '5.855.800' }))
    expect(ok.ok && [ok.datos.cripto, ok.datos.pesos]).toEqual(['1541', '5855800'])
  })

  it('un monto que no es número o es cero no pasa', () => {
    expect(leer(esquemaFlujoReal, form({ ...base, monto: 'mil' }))).toMatchObject({ ok: false, errores: { monto: 'Escribí un número, como 1.234,56.' } })
    expect(leer(esquemaFlujoReal, form({ ...base, monto: '0' }))).toMatchObject({ ok: false, errores: { monto: 'Tiene que ser mayor que cero.' } })
  })
})

describe('ingresos y gastos declarados, y pago al vencimiento', () => {
  it('cambiar desde pide monto y desde; un gasto no mensual pide su primer mes', () => {
    const r = leer(esquemaRecurrente, form({ accion: 'cambiar_desde', sentido: 'ingreso', id: '3' }))
    expect(!r.ok && r.errores).toMatchObject({ monto: 'Poné el monto.', desde: 'Elegí desde cuándo.' })
    const g = leer(esquemaRecurrente, form({ accion: 'alta', sentido: 'gasto', concepto: 'Seguro', moneda: 'ARS', monto: '180.000', desde: '2026-10-01', frecuencia: 'trimestral' }))
    expect(!g.ok && g.errores.primer_mes).toBe('Elegí el primer mes en que se paga.')
  })

  it('el pago por VN se tipea con coma y exige la fuente', () => {
    const p = leer(esquemaPago, form({ activo_id: '3', fecha: '2026-11-13', pago_por_vn: '1,1046', fuente: 'aviso de licitación' }))
    expect(p.ok && p.datos.pago_por_vn).toBe('1.1046')
    const sin = leer(esquemaPago, form({ activo_id: '3', fecha: '2026-11-13', pago_por_vn: '1,1046', fuente: ' ' }))
    expect(!sin.ok && sin.errores.fuente).toContain('Decí de dónde lo sacaste')
  })
})
