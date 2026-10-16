import { describe, expect, it } from 'vitest'
import type { CalcVista } from '@/lib/domain/calc'
import type { Segmento } from '@/lib/vistas/contratos'
import { ejemploExposicionPantalla } from '@/lib/vistas/ejemplo-balance'
import { tramosApertura } from './apertura'

const c = (valor: string | null): CalcVista => ({ valor, formula: 'x', insumos: [], etiquetas: [] })
const seg = (clave: string, peso: string | null): Segmento => ({ clave, nombre: clave.toUpperCase(), color: '#000', valor: { ars: c('1'), usd: c('1') }, peso: c(peso) })

describe('apertura de activos: tramos 100% apilados', () => {
  it('los anchos suman 100% y el rótulo depende de lo que entra', () => {
    const t = tramosApertura([seg('a', '0.67'), seg('b', '0.254'), seg('c', '0.076')])
    expect(t.reduce((a, x) => a + parseFloat(x.ancho), 0)).toBeCloseTo(100, 3)
    expect(t.map((x) => x.rotulo)).toEqual(['A 67,0%', 'B 25,4%', '7,6%'])
  })

  it('un tramo chiquito va sin texto; uno sin dato o negativo no se dibuja', () => {
    const t = tramosApertura([seg('a', '0.97'), seg('b', '0.03'), seg('c', null), seg('d', '-0.01')])
    expect(t.map((x) => x.clave)).toEqual(['a', 'b'])
    expect(t[1].rotulo).toBe('')
  })

  it('con el demo (inventado): por clase y por geografía', () => {
    const v = ejemploExposicionPantalla('financiero')
    const clase = tramosApertura(v.por_clase)
    expect(clase.length).toBe(v.por_clase.length)
    expect(clase.reduce((a, x) => a + parseFloat(x.ancho), 0)).toBeCloseTo(100, 3)
    expect(tramosApertura(v.por_geografia).map((x) => x.nombre)).toEqual(expect.arrayContaining(['Argentina', 'EE.UU.']))
  })

  it('sin pesos, ningún tramo', () => {
    expect(tramosApertura([])).toEqual([])
    expect(tramosApertura([seg('a', null)])).toEqual([])
  })
})
