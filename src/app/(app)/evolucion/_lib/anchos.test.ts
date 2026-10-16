import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import type { Par } from '@/lib/vistas/contratos'
import { anchoMontos, PX_POR_CARACTER, textoCifra } from './anchos'

const c = (valor: string | null): CalcVista => ({ valor, formula: valor === null ? 'sin dato' : `${valor} = ${valor}`, insumos: [], etiquetas: [], motivo: valor === null ? 'Falta un dato.' : undefined })
const par = (ars: string | null, usd: string | null): Par => ({ ars: c(ars), usd: c(usd) })

describe('el ancho de una columna de montos', () => {
  it('el texto de la celda: signo, flecha y "sin dato"', () => {
    expect(textoCifra('5000', 'USD', { signo: true, color: true })).toBe('+US$ 5.000,00 ▲')
    expect(textoCifra('-3737797', 'ARS', { signo: true })).toBe('−$ 3.737.797')
    expect(textoCifra('-133.13', 'USD', { signo: true, color: true })).toBe('−US$ 133,13 ▼')
    expect(textoCifra('0', 'ARS', { signo: true, color: true })).toBe('$ 0')
    expect(textoCifra(null, 'USD')).toBe('sin dato')
  })

  it('el monto más largo de la columna manda; con "Ambas", el renglón más ancho', () => {
    const pares = [par('3737797', '2432.8'), par('-185000', '-119.5'), null]
    const enPesos = anchoMontos(pares, 'ars', { signo: true, color: true, minimo: 0 })
    const enDolares = anchoMontos(pares, 'usd', { signo: true, color: true, minimo: 0 })
    expect(anchoMontos(pares, 'ambas', { signo: true, color: true, minimo: 0 })).toBe(Math.max(enPesos, enDolares))
    // "+US$ 2.432,80 ▲": 15 caracteres, la pastilla, la flecha y la celda.
    expect(enDolares).toBe(Math.ceil(15 * PX_POR_CARACTER + 18 + 6 + 17))
    // Un dígito más, un carácter más de ancho.
    expect(anchoMontos([par('37377970', null)], 'ars', { signo: true, minimo: 0 }) - anchoMontos([par('3737797', null)], 'ars', { signo: true, minimo: 0 })).toBeGreaterThanOrEqual(Math.floor(PX_POR_CARACTER))
  })

  it('nunca menos que lo que pide el título; sin filas, el mínimo', () => {
    expect(anchoMontos([par('1', '1')], 'ars', { minimo: 116 })).toBe(116)
    expect(anchoMontos([], 'usd', { minimo: 128 })).toBe(128)
  })
})
