import { describe, expect, it } from 'vitest'
import { esquemaCargo, esquemaDesembolso, esquemaGuardarPlanilla, esquemaPago, esquemaPlanilla } from './esquemas-leasing'

// Los formularios de Datos › Leasing de la entrega 4: lo que aceptan y lo que
// rechazan, con el mensaje que ve el dueño. Números en formato argentino.

const LOTE = '0b0a8c2e-1f43-4a8e-9a55-6c1d2e3f4a5b'

describe('el pago de una cuota', () => {
  const base = { pasivo_id: '1', nro: '14', lote: LOTE }

  it('"fecha sin dato" vale: sin fecha, sin CCL', () => {
    const r = esquemaPago.safeParse({ ...base, fecha_pago: '', ccl: '', ccl_fuente: '', pagador: 'titular' })
    expect(r.success && r.data).toMatchObject({ pasivo_id: 1, nro: 14, fecha_pago: null, ccl: null, ccl_fuente: null, pagador: 'titular' })
  })

  it('el CCL en formato argentino, con su fuente y su fecha', () => {
    const r = esquemaPago.safeParse({ ...base, fecha_pago: '2026-10-01', ccl: '1.234,50', ccl_fuente: 'cierre del día', pagador: '' })
    expect(r.success && r.data).toMatchObject({ fecha_pago: '2026-10-01', ccl: '1234.5', ccl_fuente: 'cierre del día', pagador: null })
  })

  it('el CCL y su fuente van juntos', () => {
    const r = esquemaPago.safeParse({ ...base, fecha_pago: '2026-10-01', ccl: '1.234,50', ccl_fuente: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]).toMatchObject({ path: ['ccl_fuente'], message: 'El CCL del día del pago y de dónde lo sacaste van juntos.' })
  })

  it('el CCL es del día del pago: sin fecha, no', () => {
    const r = esquemaPago.safeParse({ ...base, fecha_pago: '', ccl: '1500', ccl_fuente: 'cierre' })
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(['fecha_pago'])
  })

  it('un CCL que no es número, o cero', () => {
    expect(esquemaPago.safeParse({ ...base, fecha_pago: '2026-10-01', ccl: 'mil', ccl_fuente: 'x' }).error?.issues[0].message).toBe('No lo entiendo como número (ej.: 1.234,56).')
    expect(esquemaPago.safeParse({ ...base, fecha_pago: '2026-10-01', ccl: '0', ccl_fuente: 'x' }).error?.issues[0].message).toBe('Tiene que ser mayor que cero.')
  })

  it('sin lote no se guarda (un reintento no duplica)', () => {
    expect(esquemaPago.safeParse({ pasivo_id: '1', nro: '14' }).success).toBe(false)
  })
})

describe('la planilla', () => {
  it('el texto entero y su nombre (con uno por defecto)', () => {
    const r = esquemaPlanilla.safeParse({ pasivo_id: 1, texto: 'nro_cuota\n1' })
    expect(r.success && r.data.nombre).toBe('cuadro de marcha.csv')
    expect(esquemaPlanilla.safeParse({ pasivo_id: 1, texto: '' }).error?.issues[0].message).toBe('Elegí el archivo o pegá el texto de la planilla.')
  })

  it('guardar pide el lote', () => {
    expect(esquemaGuardarPlanilla.safeParse({ pasivo_id: 1, texto: 'x' }).success).toBe(false)
    expect(esquemaGuardarPlanilla.safeParse({ pasivo_id: 1, texto: 'x', lote: LOTE }).success).toBe(true)
  })
})

describe('un cargo extra y la fecha de desembolso', () => {
  it('un cargo con su concepto, importe argentino y fuente', () => {
    const r = esquemaCargo.safeParse({ pasivo_id: '1', lote: LOTE, fecha: '2026-09-10', concepto: 'multa', detalle: '', importe: '15.000', cuota_nro: '13', fuente: 'comprobante' })
    expect(r.success && r.data).toMatchObject({ concepto: 'multa', detalle: null, importe: '15000', cuota_nro: 13, fuente: 'comprobante' })
  })

  it('sin concepto ni fuente, el mensaje de cada campo', () => {
    const r = esquemaCargo.safeParse({ pasivo_id: '1', lote: LOTE, fecha: '2026-09-10', concepto: '', importe: '15000', fuente: '' })
    expect(Object.fromEntries((r.error?.issues ?? []).map((i) => [i.path[0], i.message]))).toEqual({ concepto: 'Elegí qué es.', fuente: 'Elegí de dónde sale.' })
  })

  it('la fecha de desembolso es una fecha', () => {
    expect(esquemaDesembolso.safeParse({ pasivo_id: 1, fecha_desembolso: '2025-07-25' }).success).toBe(true)
    expect(esquemaDesembolso.safeParse({ pasivo_id: 1, fecha_desembolso: '' }).error?.issues[0].message).toBe('Elegí una fecha.')
  })
})
