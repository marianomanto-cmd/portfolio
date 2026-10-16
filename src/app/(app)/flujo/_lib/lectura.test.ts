import { describe, expect, it } from 'vitest'
import { lecturaPlana, validarLectura } from '@/components/pantalla/lectura'
import { proyectar } from '@/lib/domain/flujo/proyeccion'
import { supuestosDeArranque } from '@/lib/domain/flujo/supuestos'
import { ejemploFlujo } from '@/lib/vistas/ejemplo-flujo'
import { enCuanto, lecturaFlujo } from './lectura'

// La lectura de Flujo (handoff, captura 10), sobre el demo inventado (D-24).

const v = ejemploFlujo('completo')
const base = v.base!
const mes = { excedente: v.mes_actual!.excedente.ars, nombre: v.mes_actual!.nombre }
const proy = proyectar(base, supuestosDeArranque(base))

describe('lecturaFlujo', () => {
  it('cuánto te sobra este mes y adónde llegás con todo igual, con un solo énfasis (la cifra del escenario)', () => {
    const l = lecturaFlujo({ mes, proy, escenario: { tipo: 'igual' }, trazaFinal: () => mes.excedente })
    expect(validarLectura(l)).toEqual({ ok: true })
    expect(lecturaPlana(l)).toMatch(/^Este mes te sobran \$ 2\.916\.600\. Con todo igual, en un año llegás a US\$ [\d.]+ en lo financiero\.$/)
    const e = l.find((p) => p.enfasis)!
    expect(e.texto).toMatch(/^US\$ /)
    expect(e.obtener).toBeTypeOf('function')
    // La cifra del mes abre su traza (la del excedente de la vista).
    expect(l.find((p) => p.calc)?.calc).toBe(mes.excedente)
  })

  it('el escenario elegido se nombra; con tus cambios, también', () => {
    expect(lecturaPlana(lecturaFlujo({ mes, proy, escenario: { tipo: 'guardado', nombre: 'Dólar quieto' } }))).toContain('En «Dólar quieto», en un año llegás a')
    expect(lecturaPlana(lecturaFlujo({ mes, proy, escenario: { tipo: 'cambios' } }))).toContain('Con tus supuestos, en un año llegás a')
    // Un guardado abierto al que le moviste una barra ya no es ese escenario: lo dice.
    expect(lecturaPlana(lecturaFlujo({ mes, proy, escenario: { tipo: 'guardado', nombre: 'Dólar quieto', cambios: true } }))).toContain('En «Dólar quieto» con tus cambios, en un año llegás a')
  })

  it('un excedente negativo: te faltan, y salen de tus pesos; en cero, no te sobra nada; sin dato, lo dice con palabras', () => {
    const neg = lecturaFlujo({ mes: { ...mes, excedente: { ...mes.excedente, valor: '-500000' } }, proy, escenario: { tipo: 'igual' } })
    expect(lecturaPlana(neg)).toMatch(/^Este mes te faltan \$ 500\.000: salen de tus pesos\./)
    const cero = lecturaFlujo({ mes: { ...mes, excedente: { ...mes.excedente, valor: '0' } }, proy, escenario: { tipo: 'igual' } })
    expect(lecturaPlana(cero)).toMatch(/^Este mes no te sobra nada\./)
    const sin = lecturaFlujo({ mes: { ...mes, excedente: { ...mes.excedente, valor: null } }, proy, escenario: { tipo: 'igual' } })
    expect(lecturaPlana(sin)).toMatch(/^Este mes todavía no se sabe cuánto te sobra\./)
    for (const l of [neg, cero, sin]) expect(validarLectura(l)).toEqual({ ok: true })
  })

  it('sin proyección, el énfasis va en lo que falta; sin cargas, en las cargas', () => {
    const b = ejemploFlujo('parcial').base!
    const faltan = proyectar(b, supuestosDeArranque(b))
    expect(faltan.estado).toBe('faltan')
    const l = lecturaFlujo({ mes, proy: faltan, escenario: { tipo: 'igual' } })
    expect(validarLectura(l)).toEqual({ ok: true })
    expect(lecturaPlana(l)).toMatch(/Para proyectar (falta un dato|faltan \d+ datos) de tus supuestos\.$/)
    const vacia = lecturaFlujo({ mes: null, proy: null, escenario: { tipo: 'igual' } })
    expect(validarLectura(vacia)).toEqual({ ok: true })
    expect(lecturaPlana(vacia)).toBe('Todavía no hay cargas: con la primera ves cuánto te sobra por mes y adónde te lleva.')
  })

  it('un financiero sin dato al horizonte no se inventa: lo dice', () => {
    const ult = proy.meses.at(-1)!
    const hueco = { ...proy, meses: [...proy.meses.slice(0, -1), { ...ult, financiero: { ars: null, usd: null }, motivos: { financiero: 'Falta el pago al vencimiento de S13N6.' } }] }
    const l = lecturaFlujo({ mes, proy: hueco, escenario: { tipo: 'igual' } })
    expect(validarLectura(l)).toEqual({ ok: true })
    expect(lecturaPlana(l)).toContain('en un año tu financiero no se puede proyectar: Falta el pago al vencimiento de S13N6.')
  })
})

describe('enCuanto', () => {
  it('en años si es exacto, en meses si no', () => {
    expect(enCuanto(12)).toBe('en un año')
    expect(enCuanto(36)).toBe('en tres años')
    expect(enCuanto(18)).toBe('en 18 meses')
    expect(enCuanto(1)).toBe('en un mes')
    expect(enCuanto(132)).toBe('en 11 años')
  })
})
