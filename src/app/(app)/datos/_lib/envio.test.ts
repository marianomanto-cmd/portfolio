// El lote de cada envío de Datos (revisión de la fase 1a). Números inventados (D-24).

import { describe, expect, it } from 'vitest'
import { contenidoDe, loteDelEnvio, sinConexion } from './envio'

const form = (pares: [string, string][]) => pares as Iterable<[string, FormDataEntryValue]>

describe('loteDelEnvio', () => {
  let n = 0
  const nuevo = () => `lote-${++n}`

  it('el mismo envío reintentado (se cortó la conexión) reusa su lote: la base no lo duplica', () => {
    const a = loteDelEnvio(null, 0, form([['tipo', 'aporte'], ['monto_destino', '2.000']]), nuevo)
    // El mismo contenido, en otro orden y con el lote viejo adentro: el mismo lote.
    const b = loteDelEnvio(a, 0, form([['monto_destino', '2.000'], ['lote', a.lote], ['tipo', 'aporte']]), nuevo)
    expect(b.lote).toBe(a.lote)
  })

  it('otro contenido u otro guardado (después de guardar bien) llevan un lote nuevo', () => {
    const a = loteDelEnvio(null, 0, form([['tipo', 'aporte'], ['monto_destino', '2.000']]), nuevo)
    expect(loteDelEnvio(a, 0, form([['tipo', 'aporte'], ['monto_destino', '2.500']]), nuevo).lote).not.toBe(a.lote)
    expect(loteDelEnvio(a, 1, form([['tipo', 'aporte'], ['monto_destino', '2.000']]), nuevo).lote).not.toBe(a.lote)
  })

  it('contenidoDe ignora el lote y ordena', () => {
    expect(contenidoDe(form([['b', '2'], ['lote', 'x'], ['a', '1']]))).toBe('[["a","1"],["b","2"]]')
  })

  it('un corte no dice "nada se guardó": dice que no se sabe y qué hacer, y no limpia el formulario', () => {
    const e = sinConexion({ ok: null, mensaje: null, errores: {}, vez: 3 })
    expect(e).toMatchObject({ ok: false, vez: 3 })
    expect(e.mensaje).toMatch(/^No sé si se guardó/)
    expect(e.mensaje).toMatch(/Registro/)
  })
})
