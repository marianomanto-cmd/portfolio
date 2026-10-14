// Los campos de Cargar y Datos miden 44 px con el dedo también a 1024 px (D-100):
// `tocable` le gana a lg:min-h-10 (está fuera de las capas de Tailwind).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CLASE_CAMPO, Entrada, Selector } from './ui'

describe('CLASE_CAMPO', () => {
  it('lleva tocable, y cada campo también', () => {
    expect(CLASE_CAMPO.split(/\s+/)).toContain('tocable')
    expect(renderToStaticMarkup(createElement(Entrada, { id: 'ccl', name: 'ccl' }))).toMatch(/<input[^>]*class="tocable /)
    expect(renderToStaticMarkup(createElement(Selector, { id: 'cuenta', name: 'cuenta' }))).toMatch(/<select[^>]*class="tocable /)
  })
})
