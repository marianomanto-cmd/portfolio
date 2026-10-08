import { describe, expect, it } from 'vitest'
import { enDosMonedas, ratioVigente, ultimaValuacion, ultimoSaldoPasivo } from './calculos'
import { leerFormulario, esquemaActivo, esquemaBien, esquemaEdicionActivo, esquemaPasivo, esquemaPasivoSaldo, esquemaValuacion } from './esquemas'

describe('ratioVigente', () => {
  const ratios = [
    { activo_id: 1, vigente_desde: '2024-01-01', ratio: '10' },
    { activo_id: 1, vigente_desde: '2026-05-01', ratio: '20' },
    { activo_id: 2, vigente_desde: '2025-01-01', ratio: '3' },
  ]
  it('toma el último vigente a la fecha', () => {
    expect(ratioVigente(ratios, 1, '2026-10-14')?.ratio).toBe('20')
    expect(ratioVigente(ratios, 1, '2026-04-30')?.ratio).toBe('10')
  })
  it('sin ratio vigente es null, no un ratio inventado', () => {
    expect(ratioVigente(ratios, 1, '2023-12-31')).toBeNull()
    expect(ratioVigente(ratios, 9, '2026-10-14')).toBeNull()
  })
})

describe('ultimaValuacion y ultimoSaldoPasivo', () => {
  it('toman la más reciente de cada uno', () => {
    const vs = [
      { bien_id: 1, fecha: '2025-09-15', valor: '200000', fuente: 'tasación', carga_id: 1 },
      { bien_id: 1, fecha: '2024-09-15', valor: '180000', fuente: 'tasación', carga_id: 2 },
      { bien_id: 2, fecha: '2026-03-10', valor: '38000000', fuente: 'guía', carga_id: 3 },
    ]
    expect(ultimaValuacion(vs, 1)?.valor).toBe('200000')
    expect(ultimaValuacion(vs, 3)).toBeNull()
    const ss = [
      { pasivo_id: 1, fecha: '2026-09-30', capital_pendiente: '21400000', carga_id: 1 },
      { pasivo_id: 1, fecha: '2026-08-31', capital_pendiente: '22100000', carga_id: 2 },
    ]
    expect(ultimoSaldoPasivo(ss, 1)?.capital_pendiente).toBe('21400000')
  })
})

describe('enDosMonedas', () => {
  const ccl = { fecha: '2026-10-14', valor: '1548.2' }
  it('la casa en dólares pasa a pesos al CCL (Apéndice B: $ 309.640.000)', () => {
    const r = enDosMonedas('200000', 'USD', ccl, { nombre: 'la valuación de Casa', fecha: '2025-09-15' })
    expect(r.usd.valor).toBe('200000')
    expect(r.ars.valor).toBe('309640000')
    expect(r.ars.formula).toContain('× CCL 1.548,20')
  })
  it('la camioneta en pesos pasa a dólares', () => {
    const r = enDosMonedas('38000000', 'ARS', ccl, { nombre: 'la valuación de Camioneta', fecha: '2026-03-10' })
    expect(r.ars.valor).toBe('38000000')
    expect(r.usd.valor?.slice(0, 11)).toBe('24544.63247')
  })
  it('sin CCL, la otra moneda es "sin dato"', () => {
    const r = enDosMonedas('200000', 'USD', null, { nombre: 'la valuación', fecha: null })
    expect(r.usd.valor).toBe('200000')
    expect(r.ars.valor).toBeNull()
    expect(r.ars.motivo).toMatch(/Falta un CCL/)
  })
  it('sin valuación, las dos son "sin dato"', () => {
    const r = enDosMonedas(null, 'USD', ccl, { nombre: 'una valuación', fecha: null })
    expect(r.ars.valor).toBeNull()
    expect(r.usd.valor).toBeNull()
  })
})

describe('esquemas de Datos', () => {
  it('un activo nuevo exige la moneda de riesgo elegida', () => {
    const r = leerFormulario(esquemaActivo, { ticker: 'ypfd', nombre: 'YPF', tipo: 'accion_local', geografia: 'AR', moneda_riesgo: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.moneda_riesgo).toMatch(/Elegila vos/)
  })
  it('un CEDEAR necesita subyacente y ratio, en formato argentino', () => {
    const malo = leerFormulario(esquemaActivo, { ticker: 'SPY', nombre: 'SPY', tipo: 'cedear', moneda_riesgo: 'USD', geografia: 'US' })
    expect(malo.ok).toBe(false)
    const bueno = leerFormulario(esquemaActivo, {
      ticker: 'spy',
      nombre: 'SPDR S&P 500',
      tipo: 'cedear',
      moneda_riesgo: 'USD',
      geografia: 'US',
      ticker_subyacente: 'spy',
      ratio: '20,5',
      color: '',
    })
    expect(bueno).toEqual({
      ok: true,
      datos: expect.objectContaining({ ticker: 'SPY', ticker_subyacente: 'SPY', ratio: '20.5', color: null, indexacion: null }),
    })
  })
  it('un bono necesita su indexación y una acción no la tiene', () => {
    expect(leerFormulario(esquemaActivo, { ticker: 'T30J7', nombre: 'BONCAP', tipo: 'bono', moneda_riesgo: 'ARS', geografia: 'AR' }).ok).toBe(false)
    expect(leerFormulario(esquemaActivo, { ticker: 'T30J7', nombre: 'BONCAP', tipo: 'bono', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: 'fija' }).ok).toBe(true)
    expect(leerFormulario(esquemaActivo, { ticker: 'YPFD', nombre: 'YPF', tipo: 'accion_local', moneda_riesgo: 'ARS', geografia: 'AR', indexacion: 'cer' }).ok).toBe(false)
  })
  it('editar el ratio pide desde cuándo vale', () => {
    const base = { id: '3', nombre: 'SPY', tipo: 'cedear', moneda_riesgo: 'USD', geografia: 'US', ticker_subyacente: 'SPY', activo_bool: 'on' }
    expect(leerFormulario(esquemaEdicionActivo, { ...base, ratio: '20' }).ok).toBe(false)
    const r = leerFormulario(esquemaEdicionActivo, { ...base, ratio: '20', ratio_desde: '2026-10-01' })
    expect(r).toEqual({ ok: true, datos: expect.objectContaining({ id: 3, ratio: '20', ratio_desde: '2026-10-01', activo_bool: true }) })
  })
  it('valuaciones, pasivos y saldos leen números argentinos y nunca devuelven number para la plata', () => {
    expect(leerFormulario(esquemaValuacion, { bien_id: '1', fecha: '2025-09-15', valor: 'US$ 200.000', fuente: 'tasación' })).toEqual({
      ok: true,
      datos: { bien_id: 1, fecha: '2025-09-15', valor: '200000', fuente: 'tasación' },
    })
    expect(leerFormulario(esquemaValuacion, { bien_id: '1', fecha: '2025-09-15', valor: '0', fuente: 'x' }).ok).toBe(false)
    const p = leerFormulario(esquemaPasivo, {
      nombre: 'Leasing camioneta',
      tipo: 'leasing',
      moneda: 'ARS',
      fecha_inicio: '2025-08-17',
      cuotas_totales: '48',
      monto_financiado_neto: '30.000.000',
      anticipo_neto: '',
      opcion_compra_neto: '0',
    })
    expect(p).toEqual({
      ok: true,
      datos: expect.objectContaining({ cuotas_totales: 48, monto_financiado_neto: '30000000', anticipo_neto: null, opcion_compra_neto: '0', notas: null }),
    })
    expect(leerFormulario(esquemaPasivoSaldo, { pasivo_id: '1', fecha: '2026-09-30', capital_pendiente: '21.400.000' })).toEqual({
      ok: true,
      datos: { pasivo_id: 1, fecha: '2026-09-30', capital_pendiente: '21400000' },
    })
    expect(leerFormulario(esquemaBien, { nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', pasivo_id: '' })).toEqual({
      ok: true,
      datos: { nombre: 'Casa', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null },
    })
  })
})
