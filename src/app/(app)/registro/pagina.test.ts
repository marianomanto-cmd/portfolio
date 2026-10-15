// Registro (manual §4.5), renderizado como lo manda el servidor, sin base: un
// guardado de Datos se nombra "Datos" y dice qué grabó; la tarjeta dice el día
// en que se guardó si no es el de los datos. Números y nombres inventados (D-24).
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { FilaRegistro } from '@/lib/vistas/contratos'

let filas: FilaRegistro[] = []
vi.mock('@/lib/vistas', () => ({ vistaRegistro: async () => ({ filas }) }))
vi.mock('./acciones', () => ({ revertirLoteAccion: async () => ({}) }))
// El diálogo de Revertir: acá solo importa el resumen que recibe.
vi.mock('@/components/registro/revertir', () => ({
  RevertirLote: (p: { resumen: string }) => h('p', { 'data-resumen': p.resumen }, p.resumen),
}))

const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function pagina(): Promise<string> {
  const { default: PaginaRegistro } = await import('./page')
  return renderToStaticMarkup((await PaginaRegistro()) as ReactElement)
}

const fila = (p: Partial<FilaRegistro> & Pick<FilaRegistro, 'carga_id'>): FilaRegistro => ({
  lote: `lote-${p.carga_id}-0000-0000`,
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
  valuaciones: 0,
  capitales: 0,
  movimientos: 0,
  detalle: null,
  tiempo_activo_ms: 61000,
  ...p,
})

describe('Registro: un guardado de Datos', () => {
  it('se llama "Datos", dice qué grabó y su origen es "manual" (no "CCL y cripto" ni "tipeado")', async () => {
    filas = [fila({ carga_id: 31, cuenta: 'Datos', origen: 'manual', lector: 'manual', valuaciones: 1, detalle: 'valuación de Casa de prueba' })]
    const html = await pagina()
    const t = texto(html)
    expect(t).toContain('Datos · manual')
    expect(t).toContain('valuación de Casa de prueba')
    expect(t).not.toContain('CCL y cripto')
    expect(t).not.toContain('tipeado')
    // El diálogo de Revertir dice qué se revierte.
    expect(html).toContain('data-resumen="mié 14/10 · 1 carga(s) vigente(s): Datos: valuación de Casa de prueba."')
  })

  it('sin detalle, cuenta lo que grabó; la carga del CCL sigue siendo "CCL y cripto", tipeado', async () => {
    filas = [
      fila({ carga_id: 32, lote: 'lote-a', cuenta: 'Datos', origen: 'manual', lector: 'manual', capitales: 1, movimientos: 2 }),
      fila({ carga_id: 33, lote: 'lote-b', cuenta: 'Tipo de cambio', origen: 'manual', lector: 'tipeado', creado_en: '2026-10-14T21:00:00Z' }),
    ]
    const t = texto(await pagina())
    expect(t).toContain('1 capital pendiente · 2 movimientos')
    expect(t).toContain('Tipo de cambio · tipeado')
    expect(t).toContain('CCL y cripto')
  })
})

describe('Registro: el origen de las cargas sin cuenta (entrega 4)', () => {
  it('el cuadro de marcha importado es una "planilla CSV" y lo de "Cargar ingreso" es "manual", no "tipeado"', async () => {
    filas = [
      fila({ carga_id: 50, lote: 'lote-c', cuenta: 'Leasing', origen: 'manual', lector: 'cuadro-marcha-csv@1', detalle: 'cuadro de marcha de Leasing de prueba · 3 cuotas' }),
      fila({ carga_id: 51, lote: 'lote-d', cuenta: 'Flujo', origen: 'manual', lector: 'flujo_real', detalle: 'ingreso mensual · aporte a IEB' }),
    ]
    const t = texto(await pagina())
    expect(t).toContain('Leasing · planilla CSV')
    expect(t).toContain('Flujo · manual')
    expect(t).not.toContain('tipeado')
  })
})

describe('Registro: cuándo se guardó', () => {
  it('guardado otro día que el de los datos: lo dice ("guardado el jue 15/10 a las 08:00")', async () => {
    filas = [fila({ carga_id: 40, creado_en: '2026-10-15T11:00:00Z', cotizaciones: 3 })]
    expect(texto(await pagina())).toContain('mié 14/10 · guardado el jue 15/10 a las 08:00')
  })

  it('el mismo día: solo la hora', async () => {
    filas = [fila({ carga_id: 41, creado_en: '2026-10-14T21:30:00Z', cotizaciones: 3 })]
    const t = texto(await pagina())
    expect(t).toContain('mié 14/10 · guardado a las 18:30')
    expect(t).not.toContain('guardado el')
  })
})
