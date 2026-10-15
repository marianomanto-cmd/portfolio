import { describe, expect, it } from 'vitest'
import type { FilaRegistro } from '@/lib/vistas/contratos'
import { agrupar, conteo, duracion, guardado, nombreFuente, resumenLote } from './lotes'

// Registro: las cargas por lote y cómo se dicen (lo que dibujan la tabla y las
// tarjetas). Números y nombres inventados (D-24).

const fila = (p: Partial<FilaRegistro> & Pick<FilaRegistro, 'carga_id'>): FilaRegistro => ({
  lote: 'lote-a',
  fecha: '2026-10-14',
  creado_en: '2026-10-14T21:30:00Z',
  cuenta: 'IEB',
  origen: 'excel',
  estado: 'vigente',
  archivo_path: null,
  lector: 'ieb-excel@1',
  cotizaciones: 0,
  saldos: 0,
  operaciones: 0,
  detalle: null,
  tiempo_activo_ms: 48_000,
  ...p,
})

describe('las cargas por lote', () => {
  it('agrupa por lote, del guardado más nuevo al más viejo, con sus cargas por número', () => {
    const lotes = agrupar([
      fila({ carga_id: 3, lote: 'viejo', creado_en: '2026-10-13T20:00:00Z' }),
      fila({ carga_id: 7, lote: 'nuevo', creado_en: '2026-10-14T21:31:00Z' }),
      fila({ carga_id: 6, lote: 'nuevo', creado_en: '2026-10-14T21:30:00Z' }),
      fila({ carga_id: 9, lote: null, creado_en: '2026-10-12T10:00:00Z' }),
    ])
    expect(lotes.map((l) => l.clave)).toEqual(['nuevo', 'viejo', 'carga-9'])
    expect(lotes[0].filas.map((f) => f.carga_id)).toEqual([6, 7])
    // El lote se guardó cuando se guardó su última carga.
    expect(lotes[0].creado).toBe('2026-10-14T21:31:00Z')
  })

  it('el resumen: el tiempo activo (la carga más larga), las fuentes vigentes y lo que dice Revertir', () => {
    const [l] = agrupar([
      fila({ carga_id: 1, cuenta: 'IEB', tiempo_activo_ms: 41_000 }),
      fila({ carga_id: 2, cuenta: 'Tipo de cambio', origen: 'manual', lector: 'tipeado', tiempo_activo_ms: 52_000 }),
      fila({ carga_id: 3, cuenta: 'Galicia', origen: 'captura', estado: 'revertida' }),
    ])
    const r = resumenLote(l)
    expect(r.activoMs).toBe(52_000)
    expect(r.fuentes).toEqual(['IEB', 'CCL y cripto'])
    expect(r.hayVigentes).toBe(true)
    expect(r.todasRevertidas).toBe(false)
    expect(r.resumen).toBe('mié 14/10 · 2 carga(s) vigente(s): IEB, CCL y cripto.')
  })

  it('sin tiempo medido es null (la pantalla dice "sin dato", nunca 0 s)', () => {
    const [l] = agrupar([fila({ carga_id: 1, tiempo_activo_ms: null })])
    expect(resumenLote(l).activoMs).toBeNull()
  })
})

describe('cómo se dice', () => {
  it('la duración, con espacio fino', () => {
    expect(duracion(48_400)).toBe('48 s')
    expect(duracion(65_000)).toBe('1 min 5 s')
    expect(duracion(120_000)).toBe('2 min')
  })

  it('cuándo se guardó: la hora en Córdoba, y el día si no es el de los datos', () => {
    expect(guardado('2026-10-14', '2026-10-14T21:30:00Z')).toBe('guardado a las 18:30')
    expect(guardado('2026-10-14', '2026-10-15T11:00:00Z')).toBe('guardado el jue 15/10 a las 08:00')
  })

  it('qué grabó: cuenta lo grabado; un guardado de Datos dice qué; el CCL es "CCL y cripto"', () => {
    expect(conteo(fila({ carga_id: 1, cotizaciones: 12, saldos: 1 }))).toBe('12 precios · 1 saldo')
    expect(conteo(fila({ carga_id: 1, cuenta: 'Datos', detalle: 'valuación de Casa de prueba' }))).toBe('valuación de Casa de prueba')
    expect(conteo(fila({ carga_id: 1, cuenta: 'Tipo de cambio' }))).toBe('CCL y cripto')
    expect(conteo(fila({ carga_id: 1 }))).toBe('sin filas')
    expect(nombreFuente(fila({ carga_id: 1, cuenta: 'Datos', detalle: 'aporte a MP' }))).toBe('Datos: aporte a MP')
  })
})
