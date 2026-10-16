import { describe, expect, it } from 'vitest'
import { ejemploBalance } from '@/lib/vistas/ejemplo-balance'
import { filasEstado, nombreFilaEstado } from './estado'

describe('el estado de situación como filas de la grilla', () => {
  it('Activo, Pasivo y Patrimonio neto en el orden del contador, con claves únicas', () => {
    const v = ejemploBalance('estimada')
    const fs = filasEstado(v)
    expect(new Set(fs.map((f) => f.clave)).size).toBe(fs.length)
    expect(fs.filter((f) => f.tipo === 'seccion').map(nombreFilaEstado)).toEqual(['Activo', 'Pasivo', 'Patrimonio neto'])
    const nombres = fs.map(nombreFilaEstado)
    expect(nombres.indexOf('Financiero')).toBeLessThan(nombres.indexOf('Bienes'))
    expect(nombres.indexOf('Bienes')).toBeLessThan(nombres.indexOf('Total del activo'))
    expect(nombres.indexOf('Total del activo')).toBeLessThan(nombres.indexOf('Pasivo'))
    expect(nombres.indexOf('Total del pasivo')).toBeLessThan(nombres.indexOf('Patrimonio neto'))
    // Cada partida del activo y cada línea del neto está una vez.
    const partidas = fs.filter((f) => f.tipo === 'partida').length
    expect(partidas).toBe(v.activo.grupos.reduce((a, g) => a + g.filas.length, 0) + v.activo.bienes.length)
    expect(fs.filter((f) => f.seccion === 'neto' && f.tipo === 'total')).toHaveLength(v.neto.lineas.length)
  })

  it('la deuda que financia un bien lleva debajo lo que falta pagar según contrato', () => {
    const fs = filasEstado(ejemploBalance('completo'))
    const i = fs.findIndex((f) => f.tipo === 'deuda')
    expect(fs[i + 1].tipo).toBe('referencia')
  })

  it('sin bienes ni deudas lo dice, y lleva a cargarlos', () => {
    const fs = filasEstado(ejemploBalance('sin-bienes'))
    const nota = fs.find((f) => f.tipo === 'nota' && f.seccion === 'activo')
    expect(nota && nota.tipo === 'nota' ? nota.accion?.href : null).toBe('/datos/bienes')
  })

  it('por instrumento, un grupo de una sola partida va sin subtotal', () => {
    const v = ejemploBalance('estimada', { agrupar: 'instrumento' })
    const fs = filasEstado(v)
    for (const g of v.activo.grupos.filter((x) => x.filas.length === 1)) expect(fs.some((f) => f.clave === `g:${g.clave}`)).toBe(false)
  })
})
