import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { armarPasivos } from './armar-pasivos'
import { HOY_PASIVOS, hechosEjemploPasivos } from './ejemplo-pasivos'
import { foto } from '@/lib/domain/foto'
import { armarBalance } from './armar-balance'
import { amortizacionesParaFlujo, conDeudaSegunCuadro, cuotasQueVencen, referenciaAl, segunCuadroAl } from './integracion-pasivos'

// Lo que Pasivos le da a Balance, Flujo y Hoy en la integración, sobre el
// ejemplo inventado (D-24): 35 cánones de $ 1.000.000, 14 pagados.

describe('para Balance', () => {
  const { h, hp } = hechosEjemploPasivos('cuadro')

  it('la deuda según el cuadro a hoy es la misma que muestra Pasivos, con "estimado"', () => {
    const d = segunCuadroAl(h, hp)(HOY_PASIVOS).get(1)
    const v = armarPasivos(h, hp, HOY_PASIVOS).leasings[0]
    expect(d?.ars.valor?.toFixed(2)).toBe(new Decimal(v.deuda.segun_cuadro.ars.valor as string).toFixed(2))
    expect(d?.ars.etiquetas).toContain('estimado')
    expect(d?.usd.valor).not.toBeNull()
  })

  it('en dólares, al CCL de esa fecha de carga, y la traza lo dice así (no "CCL de hoy")', () => {
    const { h: h2, hp: hp2 } = hechosEjemploPasivos('completo')
    const d = segunCuadroAl(h2, hp2)('2026-09-30').get(1)
    expect(d?.usd.insumos.map((i) => i.nombre)).toEqual(['En pesos', 'CCL del 30/09/2026'])
    expect(d?.usd.formula).toContain('(CCL del 30/09/2026)')
  })

  it('a una fecha anterior faltaban más cuotas: la deuda era mayor', () => {
    const f = segunCuadroAl(h, hp)
    const antes = f('2026-03-15').get(1)?.ars.valor as Decimal
    const hoy = f(HOY_PASIVOS).get(1)?.ars.valor as Decimal
    expect(antes.gt(hoy)).toBe(true)
  })

  it('sin la tasa del contrato: sin dato, con el motivo', () => {
    const s = hechosEjemploPasivos('sin-tasa')
    const d = segunCuadroAl(s.h, s.hp)(HOY_PASIVOS).get(1)
    expect(d?.ars.valor).toBeNull()
    expect(d?.ars.motivo).toMatch(/Completar el contrato/)
  })

  it('sin cuadro de marcha, el pasivo no está en el mapa (Balance usa la informada o la estimada)', () => {
    const s = hechosEjemploPasivos('sin-cuadro')
    expect(segunCuadroAl(s.h, s.hp)(HOY_PASIVOS).size).toBe(0)
  })

  it('lo que falta pagar como referencia: 21 cuotas, nominal, nunca la deuda', () => {
    const r = referenciaAl(h, hp)(HOY_PASIVOS).get(1)
    expect(r?.cuotas).toBe(21)
    expect(r?.falta.ars.valor?.toFixed(2)).toBe('27602400.00')
    expect(r?.nota).toMatch(/No es la deuda/)
  })
})

describe('para Flujo', () => {
  it('la amortización de cada una de las 35 cuotas, a la tasa del contrato, en pesos', () => {
    const { h, hp } = hechosEjemploPasivos('cuadro')
    const a = amortizacionesParaFlujo(h, hp, HOY_PASIVOS)
    expect(a.size).toBe(35)
    const v = armarPasivos(h, hp, HOY_PASIVOS).leasings[0].cuotas.find((c) => c.nro === 15)!.apertura.amortizacion.ars.valor as string
    expect(a.get('1-15')).toBe(new Decimal(v).toFixed(2))
    // Lo que queda de lo financiado (22.000.000) después de las 35 amortizaciones lo
    // paga la opción, que vence el mismo día que la última cuota: es su neto
    // (1.000.000), a menos de un peso por el redondeo de la tasa.
    const suma = [...a.values()].reduce((s, x) => s.plus(x as string), new Decimal(0))
    const saldo = new Decimal(22_000_000).minus(suma)
    expect(saldo.minus(1_000_000).abs().lt(1)).toBe(true)
  })

  it('sin la tasa, la amortización es null (sin dato), nunca cero', () => {
    const { h, hp } = hechosEjemploPasivos('sin-tasa')
    expect([...amortizacionesParaFlujo(h, hp, HOY_PASIVOS).values()].every((x) => x === null)).toBe(true)
  })

  it('sin cuadro de marcha, nada', () => {
    const { h, hp } = hechosEjemploPasivos('sin-cuadro')
    expect(amortizacionesParaFlujo(h, hp, HOY_PASIVOS).size).toBe(0)
  })
})

describe('para Hoy (Atención)', () => {
  const { h, hp } = hechosEjemploPasivos('cuadro')

  it('a 18 días del vencimiento no dice nada; a 7, la próxima cuota', () => {
    expect(cuotasQueVencen(h, hp, HOY_PASIVOS)).toEqual([])
    const r = cuotasQueVencen(h, hp, '2026-10-25')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ nro: 15, fecha: '2026-11-01', vencida: false })
    expect(r[0].texto).toMatch(/^Próxima cuota del leasing: /)
    expect(r[0].total.ars.valor?.toFixed(2)).toBe('1314400.00')
  })

  it('una cuota vencida sin pagar se dice vencida', () => {
    const r = cuotasQueVencen(h, hp, '2026-11-03')
    expect(r[0]).toMatchObject({ nro: 15, vencida: true })
  })
})

// Una sola deuda en toda la app (D-131, revisión de la entrega 4): la informada
// por el acreedor › la según el cuadro de marcha › la estimada a mano. El motor
// (Hoy, Exposición, Evolución), el Balance y Pasivos dicen la misma.
describe('una sola deuda: el motor, el Balance y Pasivos', () => {
  const deudaDelMotor = (hh: typeof h, fecha = HOY_PASIVOS) => foto(hh, fecha).items.find((i) => i.clase === 'pasivo')
  const { h, hp } = hechosEjemploPasivos('cuadro')

  it('con el cuadro de marcha y una deuda estimada, el motor usa la según cuadro (baja con cada cuota), con "estimado"', () => {
    expect(h.pasivo_saldos.map((s) => s.naturaleza)).toEqual(['estimado'])
    const segun = segunCuadroAl(h, hp)(HOY_PASIVOS).get(1)?.ars.valor as Decimal
    const d = deudaDelMotor(conDeudaSegunCuadro(h, hp))
    expect(d?.valor_ars.valor?.toFixed(2)).toBe(segun.negated().toFixed(2))
    expect(d?.valor_ars.etiquetas).toContain('estimado')
    expect(d?.valor_ars.formula).toMatch(/^− deuda según el cuadro de marcha al /)
    expect(d?.valor_usd.valor).not.toBeNull()
    // Sin el proveedor (Cargar, Datos, los tests de siempre), la deuda es la cargada.
    expect(deudaDelMotor(h)?.valor_ars.valor?.toFixed(0)).toBe('-18900000')
  })

  it('Pasivos y el Balance dicen la misma deuda que el motor', () => {
    const hc = conDeudaSegunCuadro(h, hp)
    const motor = deudaDelMotor(hc)?.valor_ars.valor?.negated().toFixed(2)
    const pasivos = armarPasivos(hc, hp, HOY_PASIVOS).leasings[0].deuda
    expect(pasivos.vigente).toBe('segun_cuadro')
    expect(new Decimal(pasivos.segun_cuadro.ars.valor as string).toFixed(2)).toBe(motor)
    const balance = armarBalance(hc, HOY_PASIVOS, {}, { segunCuadro: segunCuadroAl(hc, hp), referencia: referenciaAl(hc, hp) })
    expect(balance.neto.origen_deuda).toBe('segun_cuadro')
    expect(new Decimal(balance.pasivo.total.ars.valor as string).toFixed(2)).toBe(motor)
  })

  it('una deuda informada por el acreedor les gana a las dos', () => {
    const conInformada = {
      ...h,
      pasivo_saldos: [...h.pasivo_saldos, { pasivo_id: 1, fecha: HOY_PASIVOS, capital_pendiente: new Decimal(17_000_000), naturaleza: 'informado' as const, fuente: 'la leasera', carga_id: 7 }],
    }
    const d = deudaDelMotor(conDeudaSegunCuadro(conInformada, hp))
    expect(d?.valor_ars.valor?.toFixed(0)).toBe('-17000000')
    expect(d?.valor_ars.etiquetas).not.toContain('estimado')
    expect(armarPasivos(conInformada, hp, HOY_PASIVOS).leasings[0].deuda.vigente).toBe('informada')
  })

  it('una informada anterior a un estimado igual gana (la del acreedor), en el motor y en Pasivos', () => {
    const conAmbos = {
      ...h,
      pasivo_saldos: [
        { pasivo_id: 1, fecha: '2026-09-30', capital_pendiente: new Decimal(17_500_000), naturaleza: 'informado' as const, fuente: 'la leasera', carga_id: 6 },
        ...h.pasivo_saldos,
      ],
    }
    expect(deudaDelMotor(conDeudaSegunCuadro(conAmbos, hp))?.valor_ars.valor?.toFixed(0)).toBe('-17500000')
    expect(armarPasivos(conAmbos, hp, HOY_PASIVOS).leasings[0].deuda.vigente).toBe('informada')
  })

  it('un valor de cancelación con fecha posterior a la última carga: todas siguen con la misma deuda y dicen cuándo entra', () => {
    // La última carga es la del 14/10; el formulario propone la fecha de hoy (15/10).
    const despues = '2026-10-15'
    const conPosterior = {
      ...h,
      pasivo_saldos: [...h.pasivo_saldos, { pasivo_id: 1, fecha: despues, capital_pendiente: new Decimal(17_000_000), naturaleza: 'informado' as const, fuente: 'la leasera', carga_id: 8 }],
    }
    const hc = conDeudaSegunCuadro(conPosterior, hp)
    const motor = deudaDelMotor(hc)?.valor_ars.valor?.negated().toFixed(2)
    const pasivos = armarPasivos(hc, hp, despues).leasings[0]
    expect(pasivos.deuda).toMatchObject({ al: HOY_PASIVOS, vigente: 'segun_cuadro', informada: null, posterior: { naturaleza: 'informado', fecha: despues } })
    expect(new Decimal(pasivos.deuda.segun_cuadro.ars.valor as string).toFixed(2)).toBe(motor)
    expect(pasivos.frase.map((x) => x.texto).join('')).toMatch(/\(al 15\/10\/2026\): entra en tu patrimonio con tu próxima carga\./)
    const balance = armarBalance(hc, despues, {}, { segunCuadro: segunCuadroAl(hc, hp), referencia: referenciaAl(hc, hp) })
    expect(balance.neto.origen_deuda).toBe('segun_cuadro')
    expect(new Decimal(balance.pasivo.total.ars.valor as string).toFixed(2)).toBe(motor)
    // No pide cargar lo que ya cargaste: dice que entra con la próxima carga.
    expect(balance.titular.accion).toBeNull()
    expect(balance.titular.nota).toMatch(/Ya cargaste el valor de cancelación del jue 15\/10: entra con tu próxima carga\.$/)
    expect(balance.pasivo.filas[0].accion).toBeNull()
    expect(balance.pasivo.filas[0].detalle).toMatch(/entra con tu próxima carga/)
  })

  it('sin la tasa del contrato, la según cuadro es sin dato y el motor usa la estimada', () => {
    const s = hechosEjemploPasivos('sin-tasa')
    const d = deudaDelMotor(conDeudaSegunCuadro(s.h, s.hp))
    expect(d?.valor_ars.valor?.toFixed(0)).toBe('-18900000')
    expect(d?.valor_ars.etiquetas).toContain('estimado')
    expect(armarPasivos(s.h, s.hp, HOY_PASIVOS).leasings[0].deuda.vigente).toBe('estimada')
  })

  it('sin cuadro de marcha, los hechos no cambian', () => {
    const s = hechosEjemploPasivos('sin-cuadro')
    expect(conDeudaSegunCuadro(s.h, s.hp)).toBe(s.h)
  })

  it('a una fecha pasada, la deuda del motor es la según cuadro de esa fecha (con las cuotas pagadas hasta ahí)', () => {
    const hc = conDeudaSegunCuadro(h, hp)
    const antes = deudaDelMotor(hc, '2026-03-16')?.valor_ars.valor as Decimal
    expect(antes.toFixed(2)).toBe((segunCuadroAl(h, hp)('2026-03-16').get(1)?.ars.valor as Decimal).negated().toFixed(2))
    expect(antes.lt(deudaDelMotor(hc)?.valor_ars.valor as Decimal)).toBe(true)
  })
})
