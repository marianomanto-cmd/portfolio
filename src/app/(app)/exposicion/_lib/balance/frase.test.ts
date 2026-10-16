import { describe, expect, it } from 'vitest'
import { ejemploBalance } from '@/lib/vistas/ejemplo-balance'
import { detalleFrase, partesMostradas } from './frase'

describe('la frase del balance para FraseBalance', () => {
  it('montos ocultables en modo privado, porcentajes no; sin verde ni rojo', () => {
    const p = partesMostradas(ejemploBalance('estimada').frase)
    expect(p.filter((x) => x.esMonto).length).toBe(4)
    expect(p.filter((x) => x.calc && !x.esMonto).every((x) => x.texto.endsWith('%'))).toBe(true)
    expect(p.every((x) => x.tono === null)).toBe(true)
  })

  it('la hoja del teléfono: una fila por cifra, pesos y dólares juntos', () => {
    const d = detalleFrase(ejemploBalance('estimada').frase)
    expect(d.map((f) => f.etiqueta)).toEqual(['Patrimonio neto · deuda del leasing estimada', 'Sin la camioneta', 'La casa: parte de lo firme', 'Lo invertible: parte de lo firme'])
    expect(d[0].ars?.texto).toMatch(/^\$ /)
    expect(d[0].usd?.texto).toMatch(/^US\$ /)
    expect(d[2].usd).toBeNull()
  })
})
