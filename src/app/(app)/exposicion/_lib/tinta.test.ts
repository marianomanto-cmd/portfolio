import { describe, expect, it } from 'vitest'
import { COLOR_BIEN, COLOR_LIQUIDEZ_ARS, COLOR_LIQUIDEZ_USD, COLOR_SIN_ELEGIR, PALETA_DOLAR, PALETA_PESOS, TINTA_SOBRE_SEGMENTO } from '@/lib/domain/colores'
import { contraste, luminancia, TINTA_CLARA, tintaSobre } from './tinta'

describe('la tinta de un rótulo adentro de un tramo', () => {
  it('la luminancia y el contraste de WCAG: blanco contra negro es 21', () => {
    expect(luminancia('#FFFFFF')).toBeCloseTo(1, 6)
    expect(luminancia('#000000')).toBe(0)
    expect(contraste('#FFFFFF', '#000000')).toBeCloseTo(21, 6)
    expect(contraste('#777777', '#777777')).toBeCloseTo(1, 6)
    expect(luminancia('rojo')).toBeNull()
    expect(contraste('#FFF', '#000000')).toBeNull()
  })

  it('casi negra sobre los colores claros del diseño, clara sobre los oscuros', () => {
    for (const c of [...PALETA_PESOS, PALETA_DOLAR[0], PALETA_DOLAR[1], COLOR_LIQUIDEZ_ARS, COLOR_LIQUIDEZ_USD, COLOR_BIEN]) expect(tintaSobre(c), c).toBe(TINTA_SOBRE_SEGMENTO)
    for (const c of [COLOR_SIN_ELEGIR, PALETA_DOLAR[4], '#3A3542']) expect(tintaSobre(c), c).toBe(TINTA_CLARA)
  })

  it('con cualquier color de la app, el rótulo se lee con contraste AA (4,5:1)', () => {
    for (const c of [...PALETA_PESOS, ...PALETA_DOLAR, COLOR_LIQUIDEZ_ARS, COLOR_LIQUIDEZ_USD, COLOR_BIEN, COLOR_SIN_ELEGIR]) {
      expect(contraste(c, tintaSobre(c)) as number, c).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('un tono medio, donde ninguna de las dos llega a AA: negro o blanco puros, y cualquier color llega', () => {
    expect(tintaSobre(PALETA_DOLAR[3])).toBe('#FFFFFF')
    for (let gris = 0; gris <= 255; gris += 5) {
      const c = `#${gris.toString(16).padStart(2, '0').repeat(3)}`
      expect(contraste(c, tintaSobre(c)) as number, c).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('un color que no se entiende lleva la tinta del diseño', () => {
    expect(tintaSobre('var(--viz)')).toBe(TINTA_SOBRE_SEGMENTO)
  })
})
