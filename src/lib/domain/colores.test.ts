import { describe, expect, it } from 'vitest'
import { COLOR_MONEDA, COLOR_PASIVO, COLOR_POR_LIQUIDEZ, colorDeFamilia, coloresDeActivos, familiaDe, oklchAHex, PALETA_DOLAR, PALETA_PESOS } from './colores'

// Un color por activo (spec §UI, D-157): estable, por familia y por orden de alta.

const cedear = (id: number, color: string | null = null) => ({ id, tipo: 'cedear', moneda_riesgo: 'USD' as const, color })
const lecap = (id: number, color: string | null = null) => ({ id, tipo: 'lecap', moneda_riesgo: 'ARS' as const, color })

describe('familia de color', () => {
  it('la decide la moneda de riesgo: un CEDEAR y un bono en dólares son dorados; una LECAP y una acción local, piedra', () => {
    expect(familiaDe({ tipo: 'cedear', moneda_riesgo: 'USD' })).toBe('dolar')
    expect(familiaDe({ tipo: 'bono', moneda_riesgo: 'USD' })).toBe('dolar')
    expect(familiaDe({ tipo: 'lecap', moneda_riesgo: 'ARS' })).toBe('pesos')
    expect(familiaDe({ tipo: 'accion_local', moneda_riesgo: 'ARS' })).toBe('pesos')
    expect(familiaDe({ tipo: 'liquidez', moneda_riesgo: 'ARS' })).toBe('liquidez')
  })
})

describe('colores por activo', () => {
  it('por orden de alta dentro de cada familia, con la paleta del diseño', () => {
    const m = coloresDeActivos([lecap(4), cedear(3), cedear(1), lecap(2)])
    expect(m.get(1)).toBe(PALETA_DOLAR[0])
    expect(m.get(3)).toBe(PALETA_DOLAR[1])
    expect(m.get(2)).toBe(PALETA_PESOS[0])
    expect(m.get(4)).toBe(PALETA_PESOS[1])
  })

  it('es estable: un activo nuevo no le cambia el color a ninguno de los anteriores', () => {
    const antes = coloresDeActivos([cedear(1), cedear(2), lecap(3)])
    const despues = coloresDeActivos([cedear(1), cedear(2), lecap(3), cedear(9), lecap(10)])
    for (const id of [1, 2, 3]) expect(despues.get(id)).toBe(antes.get(id))
  })

  it('un color elegido a mano manda, y no corre el de los que vienen después', () => {
    const sinPropio = coloresDeActivos([cedear(1), cedear(2), cedear(3)])
    const conPropio = coloresDeActivos([cedear(1), cedear(2, '#123abc'), cedear(3)])
    expect(conPropio.get(2)).toBe('#123abc')
    expect(conPropio.get(3)).toBe(sinPropio.get(3))
  })

  it('después de la paleta base sigue en la misma familia, sin repetir colores', () => {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1)
    const m = coloresDeActivos(ids.map((id) => cedear(id)))
    const colores = ids.map((id) => m.get(id)!)
    expect(new Set(colores).size).toBe(12)
    for (const c of colores) expect(c).toMatch(/^#[0-9A-F]{6}$/i)
    // Siguen siendo dorados: el rojo le gana al azul.
    for (const c of colores.slice(PALETA_DOLAR.length)) {
      const [r, , b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
      expect(r).toBeGreaterThan(b)
    }
  })

  it('el color k de una familia depende solo de k', () => {
    expect(colorDeFamilia('dolar', 7)).toBe(colorDeFamilia('dolar', 7))
    expect(colorDeFamilia('pesos', 0)).toBe(PALETA_PESOS[0])
  })
})

describe('reglas de color (D-157)', () => {
  it('por moneda de riesgo: los dólares en oro, los pesos en piedra y lo sin elegir en ninguna de las dos', () => {
    expect(PALETA_DOLAR).toContain(COLOR_MONEDA.USD)
    expect(PALETA_PESOS).toContain(COLOR_MONEDA.ARS)
    expect([...PALETA_DOLAR, ...PALETA_PESOS]).not.toContain(COLOR_MONEDA.sin_elegir)
  })

  it('ni la liquidez ni la moneda usan la sangría, que es de la deuda y la pérdida', () => {
    for (const c of [...Object.values(COLOR_MONEDA), ...Object.values(COLOR_POR_LIQUIDEZ)]) expect(c.toUpperCase()).not.toBe(COLOR_PASIVO.toUpperCase())
    expect(new Set(Object.values(COLOR_POR_LIQUIDEZ)).size).toBe(3)
  })
})

describe('OKLCH a sRGB', () => {
  it('blanco, negro y un gris quedan donde tienen que quedar', () => {
    expect(oklchAHex(1, 0, 0)).toBe('#FFFFFF')
    expect(oklchAHex(0, 0, 0)).toBe('#000000')
    // L = 0,5 sin croma: un gris neutro.
    const g = oklchAHex(0.5, 0, 0)
    expect(g.slice(1, 3)).toBe(g.slice(3, 5))
    expect(g.slice(3, 5)).toBe(g.slice(5, 7))
  })
})
