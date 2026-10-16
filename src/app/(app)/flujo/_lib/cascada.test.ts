import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { ejemploFlujo } from '@/lib/vistas/ejemplo-flujo'
import { cascada } from './cascada'

// La cascada del mes (handoff, captura 10: "de ingreso a excedente"), sobre el
// demo inventado (D-24): ordena y apila las cifras de la vista; no calcula
// nada nuevo. Lo que falta no se dibuja a medias.

const v = ejemploFlujo('completo')
const mes = v.mes_actual!
const c = cascada(mes)

describe('cascada', () => {
  it('ingresos en dólares al cripto, pesos fijos, gastos, cuota y excedente: cada barra donde termina la anterior', () => {
    expect(c.motivo).toBeNull()
    const b = c.barras!
    expect(b.map((x) => x.clave)).toEqual(['usd', 'pesos', 'gastos', 'cuota', 'excedente'])
    expect(b.map((x) => x.nombre)).toEqual(['Ingresos USD × cripto', 'Pesos fijos', 'Gastos fijos', 'Cuota leasing', 'Excedente'])
    expect(b[0]).toMatchObject({ desde: 0, hasta: Number(mes.ingreso_usd.ars.valor) })
    expect(b[1].desde).toBe(b[0].hasta)
    expect(b[2].valor).toBe(-Number(mes.gastos.ars.valor))
    expect(b[3].hasta).toBe(b[2].desde)
    // El último escalón llega exactamente al excedente de la vista.
    expect(b[3].desde).toBeCloseTo(Number(mes.excedente.ars.valor), 6)
    expect(b[4]).toMatchObject({ desde: 0, valor: Number(mes.excedente.ars.valor) })
    // Cada barra es la cifra de la vista, con su traza (no una copia).
    expect(b[0].par).toBe(mes.ingreso_usd)
    expect(b[4].par).toBe(mes.excedente)
  })

  it('los pasos suman el excedente, al centavo', () => {
    const pasos = c.barras!.slice(0, -1).reduce((a, x) => a.plus(x.valor), new Decimal(0))
    expect(pasos.toFixed(2)).toBe(new Decimal(mes.excedente.ars.valor!).toFixed(2))
  })

  it('un paso en cero no se dibuja (no declaraste ingreso en dólares, la cuota la paga la empresa): es un cero real', () => {
    const sinUsd = cascada({ ...mes, ingreso_usd: { ars: { ...mes.ingreso_usd.ars, valor: '0' }, usd: { ...mes.ingreso_usd.usd, valor: '0' } } })
    expect(sinUsd.barras!.map((x) => x.clave)).toEqual(['pesos', 'gastos', 'cuota', 'excedente'])
    const sinCuota = cascada({ ...mes, cuota: { ars: { ...mes.cuota.ars, valor: '0' }, usd: { ...mes.cuota.usd, valor: '0' } } })
    expect(sinCuota.barras!.map((x) => x.clave)).toEqual(['usd', 'pesos', 'gastos', 'excedente'])
  })

  it('un paso sin dato frena la cascada y dice qué falta: nunca un cero', () => {
    const sinDato = cascada({ ...mes, ingreso_usd: { ars: { ...mes.ingreso_usd.ars, valor: null, motivo: 'Falta el dólar cripto.' }, usd: mes.ingreso_usd.usd } })
    expect(sinDato).toEqual({ barras: null, motivo: 'Falta el dólar cripto.' })
    const sinCuota = cascada({ ...mes, cuota: { ars: { ...mes.cuota.ars, valor: null, motivo: '' }, usd: mes.cuota.usd } })
    expect(sinCuota.barras).toBeNull()
    expect(sinCuota.motivo).toBe('Falta un dato: cuota leasing.')
    const sinExcedente = cascada({ ...mes, excedente: { ars: { ...mes.excedente.ars, valor: null, motivo: 'Falta la cuota.' }, usd: mes.excedente.usd } })
    expect(sinExcedente).toEqual({ barras: null, motivo: 'Falta la cuota.' })
  })

  it('el reintegro del IVA, si lo declaraste, entra antes de los gastos', () => {
    const conReintegro = cascada({ ...mes, reintegro: { ars: { ...mes.gastos.ars, valor: '100000' }, usd: mes.gastos.usd } })
    expect(conReintegro.barras!.map((x) => x.clave)).toEqual(['usd', 'pesos', 'reintegro', 'gastos', 'cuota', 'excedente'])
    expect(conReintegro.barras![2]).toMatchObject({ valor: 100000, desde: conReintegro.barras![1].hasta })
  })

  it('un excedente negativo va de su valor al cero', () => {
    const neg = cascada({ ...mes, gastos: { ...mes.gastos, ars: { ...mes.gastos.ars, valor: '9000000' } }, excedente: { ...mes.excedente, ars: { ...mes.excedente.ars, valor: '-3633200' } } })
    expect(neg.barras!.at(-1)).toMatchObject({ desde: -3633200, hasta: 0, valor: -3633200 })
  })
})
