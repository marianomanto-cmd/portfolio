import { describe, expect, it } from 'vitest'
import type { Fuente } from '@/lib/vistas/contratos'
import { resumenChip, tipoDeCambioCorto } from './estado'

// El chip de estado de los datos de la barra superior (D-156). Números inventados (D-24).

const fuente = (nombre: Fuente['nombre'], estado: Fuente['estado'], valor?: string): Fuente => ({ nombre, estado, fecha: '2026-10-15', carga_id: 1, detalle: null, valor })
const AL_DIA: Fuente[] = [fuente('IEB', 'ok'), fuente('Galicia', 'ok'), fuente('Mercado Pago', 'ok'), fuente('CCL', 'tipeado', '1485'), fuente('Cripto', 'tipeado', '1510.5')]

describe('el chip de estado de los datos', () => {
  it('con la carga de hoy: la hora (en Córdoba), el CCL y el cripto, y el punto al día', () => {
    const r = resumenChip({ hoy: '2026-10-15', fechaDatos: '2026-10-15', creadoEn: '2026-10-15T12:41:00Z', fuentes: AL_DIA })
    expect(r).toMatchObject({ punto: 'al_dia', texto: 'CARGA DE HOY · 09:41', corto: 'HOY 09:41', ccl: '1.485', cripto: '1.510,50' })
    expect(r.etiqueta).toBe('Carga de hoy a las 09:41, CCL 1.485, cripto 1.510,50, todas las fuentes al día')
  })

  it('si la última carga es de otro día, lo dice con la fecha', () => {
    const r = resumenChip({ hoy: '2026-10-16', fechaDatos: '2026-10-14', creadoEn: '2026-10-14T21:00:00Z', fuentes: AL_DIA })
    expect(r).toMatchObject({ texto: 'ÚLTIMA CARGA · 14/10', corto: '14/10' })
  })

  it('el punto avisa (oro) si una fuente tiene una diferencia, está vieja o nunca se cargó', () => {
    for (const estado of ['diferencia', 'viejo', 'sin_carga'] as const) {
      const fuentes = AL_DIA.map((f) => (f.nombre === 'IEB' ? { ...f, estado } : f))
      expect(resumenChip({ hoy: '2026-10-15', fechaDatos: '2026-10-15', fuentes }).punto, estado).toBe('atencion')
    }
  })

  it('sin cargas: lo dice, sin tipo de cambio inventado', () => {
    const r = resumenChip({ hoy: '2026-10-15', fechaDatos: null, fuentes: [] })
    expect(r).toMatchObject({ punto: 'atencion', texto: 'SIN CARGAS', ccl: null, cripto: null })
  })

  it('el tipo de cambio va sin decimales si no los tiene', () => {
    expect(tipoDeCambioCorto('1485')).toBe('1.485')
    expect(tipoDeCambioCorto('1531.7')).toBe('1.531,70')
    expect(tipoDeCambioCorto(null)).toBeNull()
  })
})
