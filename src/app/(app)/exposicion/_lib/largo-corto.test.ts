import { describe, expect, it } from 'vitest'
import { ejemploExposicionPantalla } from '@/lib/vistas/ejemplo-balance'
import { CERO, largoCorto } from './largo-corto'

// Números inventados del demo (D-24): pesos financieros $ 54,18 M, deuda del
// leasing $ 21,40 M (estimada), neto largo $ 32,78 M; en dólares, SPY y la
// liquidez en dólares.

describe('largo y corto: barras divergentes con una sola escala', () => {
  const v = ejemploExposicionPantalla('financiero')
  const { cero, filas } = largoCorto(v)
  const fila = (k: string) => filas.find((f) => f.clave === k)!

  it('cuatro filas en el orden del diseño; el neto va destacado', () => {
    expect(filas.map((f) => f.rotulo)).toEqual(['Activos en pesos', 'Pasivos en pesos', 'Neto en pesos', 'Activos en dólares'])
    expect(filas.filter((f) => f.fuerte).map((f) => f.clave)).toEqual(['neto'])
  })

  it('el cero en el 40% del ancho, como en el diseño; los positivos crecen a la derecha y la deuda a la izquierda', () => {
    const pesos = Number(v.resumen.pesos_financieros.ars.valor)
    const deuda = Number(v.resumen.deuda_pesos.ars.valor)
    const usd = Number(v.activos_en_dolares.ars.valor)
    expect(cero).toBe(CERO)
    expect(CERO).toBe(40)
    // Lo más largo de la derecha llega justo al borde (aquí, los pesos financieros).
    expect(Math.max(pesos, usd)).toBe(pesos)
    expect(fila('pesos').barra!.desde + fila('pesos').barra!.ancho).toBeCloseTo(100, 6)
    expect(fila('pesos').barra!.desde).toBeCloseTo(cero, 6)
    expect(fila('deudas').barra!.desde + fila('deudas').barra!.ancho).toBeCloseTo(cero, 6)
    expect(fila('deudas').menos).toBe(true)
    // Nada se sale del ancho.
    for (const f of filas) if (f.barra) expect(f.barra.desde + f.barra.ancho).toBeLessThanOrEqual(100 + 1e-9)
    // La misma escala: el ancho es proporcional al monto.
    expect(fila('pesos').barra!.ancho / fila('deudas').barra!.ancho).toBeCloseTo(pesos / deuda, 6)
  })

  it('cada barra se parte por activo, la liquidez junta, y las partes suman 1', () => {
    expect(fila('pesos').tramos.map((t) => t.etiqueta)).toContain('LIQ')
    expect(fila('dolares').tramos.map((t) => t.etiqueta)).toEqual(['SPY', 'LIQ US$'])
    expect(fila('deudas').tramos.map((t) => t.etiqueta)).toEqual(['Leasing'])
    for (const f of filas) if (f.tramos.length) expect(f.tramos.reduce((a, t) => a + t.parte, 0)).toBeCloseTo(1, 9)
    expect(fila('neto').tramos[0]).toMatchObject({ etiqueta: 'LARGO', tono: 'largo' })
  })

  it('sin la deuda, el neto es "sin dato": sin barra, sin cero inventado', () => {
    const s = largoCorto(ejemploExposicionPantalla('financiero', 'sin-deuda'))
    const neto = s.filas.find((f) => f.clave === 'neto')!
    expect(neto.valor.ars.valor).toBeNull()
    expect(neto.barra).toBeNull()
    expect(s.filas.find((f) => f.clave === 'deudas')!.barra).toBeNull()
  })

  it('en la vista Total, los bienes van en su propia fila, sin moneda de riesgo y sin mover el neto', () => {
    const t = largoCorto(ejemploExposicionPantalla('total'))
    const bienes = t.filas.find((f) => f.clave === 'bienes')!
    expect(bienes.rotulo).toBe('Bienes, sin moneda elegida')
    expect(bienes.tramos.every((x) => x.tono === 'sin_elegir')).toBe(true)
    expect(t.filas.find((f) => f.clave === 'neto')!.barra).toBeNull()
  })

  it('sin ninguna carga, ninguna barra', () => {
    const vacio = largoCorto(ejemploExposicionPantalla('financiero', 'vacio'))
    expect(vacio.cero).toBe(CERO)
    expect(vacio.filas.every((f) => f.barra === null)).toBe(true)
  })

  it('una deuda más grande que lo que tenés: la izquierda se llena y nada se sale', () => {
    const base = ejemploExposicionPantalla('financiero')
    const enorme = { ...base.resumen.deuda_pesos.ars, valor: '200000000' }
    const c = largoCorto({ ...base, resumen: { ...base.resumen, deuda_pesos: { ...base.resumen.deuda_pesos, ars: enorme } } })
    const d = c.filas.find((f) => f.clave === 'deudas')!.barra!
    expect(d.desde).toBeCloseTo(0, 6)
    expect(d.ancho).toBeCloseTo(CERO, 6)
    for (const f of c.filas) if (f.barra) expect(f.barra.desde).toBeGreaterThanOrEqual(-1e-9)
  })
})
