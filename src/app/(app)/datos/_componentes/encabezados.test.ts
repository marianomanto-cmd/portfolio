// Orden de encabezados en Datos (axe heading-order): el h1 de Datos y, debajo,
// cada bien y cada pasivo con su h2 (antes h3, salteaba un nivel). Datos inventados (D-24).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../acciones', () => ({
  nuevoPasivo: async () => ({}),
  nuevoSaldoPasivo: async () => ({}),
  nuevoBien: async () => ({}),
  nuevaValuacion: async () => ({}),
  editarBien: async () => ({}),
  editarPasivo: async () => ({}),
}))

const { Leasing } = await import('./leasing')
const { Bienes } = await import('./bienes')

describe('Datos: cada bien y cada pasivo lleva un h2', () => {
  it('Bienes', () => {
    const bien = { id: 3, nombre: 'Casa de prueba', tipo: 'inmueble', moneda_valuacion: 'USD', geografia: 'AR', pasivo_id: null, activo_bool: true }
    const html = renderToStaticMarkup(
      createElement(Bienes as never, { bienes: [bien], valuaciones: [], pasivos: [], ccl: { fecha: '2026-09-30', valor: '1500' }, hoy: '2026-10-08' } as never),
    )
    expect(html).toContain('<h2 class="font-semibold text-text">Casa de prueba</h2>')
    expect(html).not.toContain('<h3')
  })

  it('Leasing', () => {
    const pasivo = {
      id: 7, nombre: 'Leasing de prueba', tipo: 'leasing', moneda: 'ARS', fecha_inicio: '2025-01-10', cuotas_totales: 36,
      monto_financiado_neto: '1000000', anticipo_neto: '200000', opcion_compra_neto: '30000', opcion_compra_fecha: '2028-01-10',
      valor_bien: '1230000', notas: null,
    }
    const html = renderToStaticMarkup(
      createElement(Leasing as never, { pasivos: [pasivo], saldos: [], bienes: [], ccl: { fecha: '2026-09-30', valor: '1500' }, hoy: '2026-10-08' } as never),
    )
    expect(html).toContain('<h2 class="font-semibold text-text">Leasing de prueba</h2>')
    expect(html).not.toContain('<h3')
  })
})
