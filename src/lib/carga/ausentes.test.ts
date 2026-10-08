// Hechos.ausentes: las tenencias que la última carga vigente de cada cuenta
// declaró ausentes y quedaron pendientes. Números inventados (D-24).

import { describe, expect, it } from 'vitest'
import { ausentesVigentes, type CargaConAusentes } from './ausentes'

const ACTIVOS = [
  { id: 1, ticker: 'SPY' },
  { id: 2, ticker: 'S09O6' },
  { id: 3, ticker: 'T15E7' },
]
const carga = (p: Partial<CargaConAusentes> & Pick<CargaConAusentes, 'id' | 'fecha'>): CargaConAusentes => ({
  cuenta_id: 1,
  estado: 'vigente',
  ausentes: null,
  ...p,
})
const pendiente = (activo_id: number, ticker: string) => ({ ticker, activo_id, cuenta_id: 1, cantidad_app: '100', resolucion: 'pendiente' })

describe('ausentesVigentes', () => {
  it('lee las pendientes de la última carga vigente de cada cuenta; las registradas no cuentan', () => {
    const r = ausentesVigentes(
      [
        carga({ id: 1, fecha: '2026-10-06', ausentes: [pendiente(3, 'T15E7')] }),
        carga({
          id: 4,
          fecha: '2026-10-08',
          ausentes: [pendiente(1, 'SPY'), { ...pendiente(2, 'S09O6'), resolucion: 'registrada' }, { ...pendiente(3, 'T15E7'), resolucion: 'sin revisar al guardar' }],
        }),
        carga({ id: 5, fecha: '2026-10-08', cuenta_id: 2, ausentes: [{ ...pendiente(2, 'S09O6'), cuenta_id: 2 }] }),
      ],
      ACTIVOS,
    )
    expect(r).toEqual([
      { cuenta_id: 1, activo_id: 1, fecha: '2026-10-08', carga_id: 4 },
      { cuenta_id: 1, activo_id: 3, fecha: '2026-10-08', carga_id: 4 },
      { cuenta_id: 2, activo_id: 2, fecha: '2026-10-08', carga_id: 5 },
    ])
  })

  it('una carga posterior que ya trae la tenencia (o que no declara ausentes) la saca', () => {
    const r = ausentesVigentes(
      [carga({ id: 1, fecha: '2026-10-06', ausentes: [pendiente(1, 'SPY')] }), carga({ id: 2, fecha: '2026-10-07', ausentes: [] })],
      ACTIVOS,
    )
    expect(r).toEqual([])
  })

  it('en el mismo día manda la última confirmada; las reemplazadas y revertidas no cuentan', () => {
    const r = ausentesVigentes(
      [
        carga({ id: 7, fecha: '2026-10-08', ausentes: [pendiente(1, 'SPY')] }),
        carga({ id: 6, fecha: '2026-10-08', ausentes: [pendiente(3, 'T15E7')] }),
        carga({ id: 9, fecha: '2026-10-09', estado: 'revertida', ausentes: [] }),
        carga({ id: 8, fecha: '2026-10-09', estado: 'reemplazada', ausentes: [] }),
      ],
      ACTIVOS,
    )
    expect(r).toEqual([{ cuenta_id: 1, activo_id: 1, fecha: '2026-10-08', carga_id: 7 }])
  })

  it('JSON sin forma: se ignora sin romper; lo grabado antes de activo_id se resuelve por el ticker', () => {
    const r = ausentesVigentes(
      [
        carga({ id: 1, fecha: '2026-10-08', ausentes: [null, 'SPY', 3, [1], { ticker: 'spy', cantidad_app: '100', resolucion: 'pendiente' }, { activo_id: 99 }, { activo_id: '2' }, { activo_id: 1.5 }, { activo_id: -3 }] }),
        carga({ id: 2, fecha: '2026-10-08', cuenta_id: 2, ausentes: { no: 'es una lista' } }),
        carga({ id: 3, fecha: '2026-10-08', cuenta_id: null, ausentes: [pendiente(3, 'T15E7')] }),
      ],
      ACTIVOS,
    )
    expect(r).toEqual([
      { cuenta_id: 1, activo_id: 1, fecha: '2026-10-08', carga_id: 1 },
      { cuenta_id: 1, activo_id: 2, fecha: '2026-10-08', carga_id: 1 },
    ])
  })
})
