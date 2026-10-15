import { describe, expect, it } from 'vitest'
import { eleccionMostrada } from './eleccion'

// "¿Quién paga la cuota?" y "¿La empresa te reintegra el IVA?": la opción
// marcada es la que quedó guardada. Si guardar falla, vuelve la de antes:
// nunca se muestra elegido algo que no se guardó.

describe('la elección que se muestra', () => {
  it('sin tocar nada: la guardada (o ninguna, sin declarar)', () => {
    expect(eleccionMostrada({ guardada: null, tocada: null, estado: null, enviando: false })).toBeNull()
    expect(eleccionMostrada({ guardada: 'titular', tocada: null, estado: null, enviando: false })).toBe('titular')
  })

  it('mientras se guarda, la que tocaste', () => {
    expect(eleccionMostrada({ guardada: null, tocada: 'empresa', estado: null, enviando: true })).toBe('empresa')
  })

  it('guardada bien: la que tocaste', () => {
    expect(eleccionMostrada({ guardada: null, tocada: 'empresa', estado: { ok: true, mensaje: 'Guardado.' }, enviando: false })).toBe('empresa')
  })

  it('si no se pudo guardar (sesión vencida, error de la base): vuelve la guardada, no la tocada', () => {
    expect(eleccionMostrada({ guardada: null, tocada: 'empresa', estado: { ok: false, mensaje: 'Sesión vencida: volvé a entrar.' }, enviando: false })).toBeNull()
    expect(eleccionMostrada({ guardada: 'titular', tocada: 'empresa', estado: { ok: false, mensaje: 'No pude guardar' }, enviando: false })).toBe('titular')
  })
})
