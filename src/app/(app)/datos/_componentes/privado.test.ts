// Modo privado (manual §4.7): el CSS desenfoca todo lo que lleve la clase
// `monto`. Datos › Leasing y Datos › Bienes no pueden dejar un monto afuera
// (revisión de la fase 1a). Números inventados (D-24).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { partirMontos } from '../../carga/_componentes/montos'

// Las Server Actions no corren en este render.
vi.mock('../acciones', () => ({
  nuevoPasivo: async () => ({}),
  nuevoSaldoPasivo: async () => ({}),
  nuevoBien: async () => ({}),
  nuevaValuacion: async () => ({}),
}))

const { Leasing } = await import('./leasing')
const { Bienes } = await import('./bienes')

const VACIOS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

/** Cada texto con "$ dígito" y si algún ancestro lleva la clase `monto`. */
function montosSueltos(html: string): string[] {
  const pila: string[][] = []
  const sueltos: string[] = []
  const re = /<\/?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[3] !== undefined) {
      const t = m[3].replace(/&nbsp;/g, ' ').trim()
      if (/(US)?\$\s?[−-]?\d/.test(t) && !pila.some((c) => c.includes('monto'))) sueltos.push(t)
      continue
    }
    if (m[0].startsWith('</')) {
      pila.pop()
      continue
    }
    const clases = (/class="([^"]*)"/.exec(m[2])?.[1] ?? '').split(/\s+/).filter(Boolean)
    if (!VACIOS.has(m[1].toLowerCase()) && !m[0].endsWith('/>')) pila.push(clases)
  }
  return sueltos
}

describe('modo privado en Datos', () => {
  it('Leasing: el contrato y la historia del capital quedan bajo .monto', () => {
    const pasivo = {
      id: 7, nombre: 'Leasing de prueba', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-01-10', cuotas_totales: 36,
      monto_financiado_neto: '11111111', anticipo_neto: '2222222', opcion_compra_neto: '333333', opcion_compra_fecha: '2028-01-10',
      valor_bien: '13333333', notas: null,
    }
    const saldos = [
      { pasivo_id: 7, fecha: '2026-08-31', capital_pendiente: '9876543', carga_id: null },
      { pasivo_id: 7, fecha: '2026-09-30', capital_pendiente: '9123456', carga_id: null },
    ]
    const html = renderToStaticMarkup(
      createElement(Leasing as never, { pasivos: [pasivo], saldos, bienes: [], ccl: { fecha: '2026-09-30', valor: '1500' }, hoy: '2026-10-08' } as never),
    )
    expect(html).toContain('11.111.111')
    expect(montosSueltos(html)).toEqual([])
  })

  it('Bienes: la historia de valuaciones queda bajo .monto', () => {
    const bien = { id: 3, nombre: 'Casa de prueba', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null, activo_bool: true }
    const valuaciones = [
      { bien_id: 3, fecha: '2026-06-30', valor: '123456', fuente: 'tasación', carga_id: 1 },
      { bien_id: 3, fecha: '2026-09-30', valor: '130000', fuente: 'tasación', carga_id: 2 },
    ]
    const html = renderToStaticMarkup(
      createElement(Bienes as never, { bienes: [bien], valuaciones, pasivos: [], ccl: { fecha: '2026-09-30', valor: '1500' }, hoy: '2026-10-08' } as never),
    )
    expect(html).toContain('123.456')
    expect(montosSueltos(html)).toEqual([])
  })
})

describe('partirMontos (textos armados de Cargar: motivos, controles, fórmulas)', () => {
  it('marca cada monto en pesos o en dólares y deja el resto', () => {
    expect(partirMontos('Leí $ 4.912.300 y US$ 620,00; diferencia −$ 3,5 (0,1%).')).toEqual([
      { texto: 'Leí ', monto: false },
      { texto: '$ 4.912.300', monto: true },
      { texto: ' y ', monto: false },
      { texto: 'US$ 620,00', monto: true },
      { texto: '; diferencia ', monto: false },
      { texto: '−$ 3,5', monto: true },
      { texto: ' (0,1%).', monto: false },
    ])
  })
})
