import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { proponerCarga } from '@/lib/carga/conciliar'
import type { LecturaCuenta } from '@/lib/carga/contratos'
import { SIN_ELECCIONES, claveAusente, huellaFila, huellaSaldo, type Elecciones, type RegistroAusente } from './bandeja'
import { armarConfirmacion, cotizacionesDeExcel, type EntradaConfirmacion } from './confirmacion'
import { aplicarEdiciones, type Ediciones } from './ediciones'
import { CUENTAS_SIN_BASE, hechosSinBase } from './demo'
import { catalogoEjemplo, lecturaGaliciaEjemplo, lecturaIEBEjemplo, lecturaMPEjemplo } from './ejemplos'

const FECHA = '2026-10-14'
const LOTE = '6f1c2e9a-0d4b-4c3a-9a51-2f0f1b7c8d9e'
const ARCHIVO = { path: 'cargas/x', sha256: 'abc' }

function entrada(
  lecturas: LecturaCuenta[],
  opciones: Partial<EntradaConfirmacion> & { ccl?: string | null; ediciones?: Ediciones; hechos?: ReturnType<typeof hechosSinBase> } = {},
): EntradaConfirmacion {
  const ccl = opciones.ccl === undefined ? '1548.2' : opciones.ccl
  const ediciones = opciones.ediciones ?? {}
  const propuesta = proponerCarga(aplicarEdiciones(lecturas, ediciones), opciones.hechos ?? hechosSinBase(catalogoEjemplo()), FECHA, {
    ccl: ccl === null ? null : new Decimal(ccl),
  })
  return {
    lote: LOTE,
    fecha: FECHA,
    tc: { ccl, cripto_venta: '1541' },
    propuesta,
    elecciones: SIN_ELECCIONES,
    ediciones,
    fuentes: lecturas.map((lectura) => ({ lectura, archivo: ARCHIVO })),
    cuentas: CUENTAS_SIN_BASE,
    tiempo_activo_ms: 41_234.4,
    nota: '  ',
    ...opciones,
  }
}

describe('armarConfirmacion', () => {
  it('carga express: solo CCL y cripto es una carga válida', () => {
    const r = armarConfirmacion(entrada([]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.confirmacion).toEqual({
      lote: LOTE,
      fecha: FECHA,
      tipo_cambio: { ccl: '1548.2', cripto_venta: '1541', mep: null, oficial: null },
      cuentas: [],
      tiempo_activo_ms: 41_234,
      nota: null,
    })
    expect(r.resumen.total).toBe(2)
  })

  it('sin nada no hay carga', () => {
    const r = armarConfirmacion({ ...entrada([]), tc: { ccl: null, cripto_venta: null } })
    expect(r).toEqual({ ok: false, errores: [expect.stringContaining('Nada para guardar')] })
  })

  it('primera carga de IEB: una apertura por posición con el PPP del bróker, precios y saldos', () => {
    const r = armarConfirmacion(entrada([lecturaIEBEjemplo(FECHA)]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [ieb] = r.confirmacion.cuentas
    expect(ieb.cuenta_id).toBe(1)
    expect(ieb.origen).toBe('excel')
    expect(ieb.archivo_path).toBe('cargas/x')
    expect(ieb.listado_completo).toBe(true)
    expect(ieb.cotizaciones).toEqual([
      { activo_id: -1, precio_pesos: '35150' },
      { activo_id: -2, precio_pesos: '52300' },
      { activo_id: -3, precio_pesos: '1.124' },
      { activo_id: -4, precio_pesos: '1.031' },
    ])
    expect(ieb.operaciones.map((o) => [o.tipo, o.activo_id, o.cantidad, o.precio, o.ccl_del_dia])).toEqual([
      ['apertura', -1, '1240', '30145.16', null],
      ['apertura', -2, '300', '48200', null],
      ['apertura', -3, '9000000', '1.0976', null],
      ['apertura', -4, '5000000', '1.005', null],
    ])
    expect(ieb.saldos).toEqual([
      { moneda: 'ARS', monto: '-185000' },
      { moneda: 'USD', monto: '4200' },
    ])
    expect(ieb.lectura_cruda).toEqual({ ejemplo: true })
    expect(r.resumen.total).toBe(2 + 4 + 2)
  })

  it('lo que no revisaste queda pendiente y la cuenta queda con listado incompleto', () => {
    const r = armarConfirmacion(entrada([lecturaGaliciaEjemplo(), lecturaMPEjemplo()]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [galicia, mp] = r.confirmacion.cuentas
    // FIMA no está en el catálogo: no se graba.
    expect(galicia.cotizaciones).toEqual([{ activo_id: -5, precio_pesos: '1.0852' }])
    expect(galicia.listado_completo).toBe(false)
    // MP: dos lecturas distintas, nunca las acepta el Enter general. Como no
    // graba nada, no crea su carga (no reemplaza a la buena del día): queda
    // dicho en el resumen.
    expect(mp).toBeUndefined()
    expect(r.resumen.sin_grabar).toEqual([{ cuenta: 'Mercado Pago', pendientes: 1 }])
    expect(r.resumen.pendientes).toBe(2)
  })

  it('elegir una de las dos lecturas graba ese monto, con el motivo', () => {
    const base = entrada([lecturaMPEjemplo()])
    const mp = base.propuesta.saldos[0]
    const elecciones: Elecciones = {
      ...SIN_ELECCIONES,
      saldos: { [mp.clave]: { resolucion: 'aceptada', motivo: 'elegí la lectura 2', monto: '4912800', huella: huellaSaldo(mp) } },
    }
    const r = armarConfirmacion({ ...base, elecciones })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.confirmacion.cuentas[0].saldos).toEqual([{ moneda: 'ARS', monto: '4912800' }])
    expect(r.confirmacion.cuentas[0].listado_completo).toBe(true)
    const g = r.confirmacion.cuentas[0].grabado as { saldos: { motivo: string; leido: string; grabado: string }[] }
    expect(g.saldos[0]).toMatchObject({ motivo: 'elegí la lectura 2', leido: '4912300', grabado: '4912800' })
  })

  it('una compra aceptada y corregida se graba con lo corregido y el CCL del día', () => {
    const hechos = hechosSinBase(catalogoEjemplo())
    hechos.cargas.push({ id: 1, lote: null, fecha: '2026-10-01', cuenta_id: 1, origen: 'excel', archivo_path: 'x', estado: 'vigente', creado_en: '', reemplaza_a: null, lector: null, tiempo_activo_ms: null })
    hechos.operaciones.push({
      id: 1, fecha: '2026-10-01', fecha_origen: null, cuenta_id: 1, activo_id: -3, tipo: 'apertura',
      cantidad: new Decimal(8_000_000), moneda: 'ARS', precio: new Decimal('1.097475'), importe: null,
      comisiones: new Decimal(0), ccl_del_dia: null, carga_id: 1, notas: null,
    })
    const ieb = lecturaIEBEjemplo(FECHA)
    ieb.filas = ieb.filas.filter((f) => f.ticker === 'T30J7')
    const base = entrada([ieb], { hechos })
    const d = base.propuesta.filas[0]
    expect(d.accion).toBe('compra')
    // El precio inferido del cambio de PPP (D-19): (1,0976 × 9.000.000 − 8.779.800) ÷ 1.000.000 = 1,0986.
    expect(d.operacion?.precio).toBe('1.0986')
    const elecciones: Elecciones = {
      ...SIN_ELECCIONES,
      filas: { [d.clave]: { resolucion: 'aceptada', motivo: 'acepté la compra corregida', operacion: { cantidad: '1000000', precio: null }, huella: huellaFila(d) } },
    }
    const r = armarConfirmacion({ ...base, elecciones })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.confirmacion.cuentas[0].operaciones).toEqual([
      expect.objectContaining({ tipo: 'compra', activo_id: -3, cantidad: '1000000', precio: null, ccl_del_dia: '1548.2' }),
    ])
    // IEB no trae el resto de las posiciones que la app conoce (ninguna): listado completo.
    expect(r.confirmacion.cuentas[0].listado_completo).toBe(true)
  })

  it('una fila en error frena la confirmación hasta editarla o dejarla pendiente', () => {
    const g = lecturaGaliciaEjemplo()
    g.filas[0] = { ...g.filas[0], estado: 'error', motivos: ['El precio no se pudo leer.'], precio_unitario: null }
    const r = armarConfirmacion(entrada([g]))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errores[0]).toMatch(/Galicia · S13N6/)

    // Editada (cierra contra el valorizado): se graba.
    const editada = armarConfirmacion(entrada([g], { ediciones: { [g.filas[0].clave]: { cantidad: null, precio_unitario: '1.0852' } } }))
    expect(editada.ok).toBe(true)
    if (!editada.ok) return
    expect(editada.confirmacion.cuentas[0].cotizaciones).toContainEqual({ activo_id: -5, precio_pesos: '1.0852' })
    const gr = editada.confirmacion.cuentas[0].grabado as { filas: { editada: unknown }[] }
    expect(gr.filas[0].editada).toEqual({ cantidad: null, precio_unitario: '1.0852' })
  })

  it('un mismo activo en dos cuentas: un solo precio por día, el del Excel', () => {
    const g = lecturaGaliciaEjemplo()
    g.filas = [{ ...g.filas[0], clave: 'Galicia:T30J7', ticker: 'T30J7', precio_unitario: '1.125', valorizado: null, chequeo: null }]
    const r = armarConfirmacion(entrada([g, lecturaIEBEjemplo(FECHA)]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [ieb, galicia] = r.confirmacion.cuentas
    expect(ieb.cotizaciones).toContainEqual({ activo_id: -3, precio_pesos: '1.124' })
    expect(galicia.cotizaciones).toEqual([])
    const gr = galicia.grabado as { filas: { nota: string }[] }
    expect(gr.filas[0].nota).toMatch(/vale el de IEB/)
  })

  it('cada fuente necesita su archivo guardado, salvo sin base', () => {
    const base = entrada([lecturaIEBEjemplo(FECHA)])
    const sin = { ...base, fuentes: base.fuentes.map((f) => ({ ...f, archivo: null })) }
    expect(armarConfirmacion(sin).ok).toBe(false)
    expect(armarConfirmacion({ ...sin, sinArchivos: true }).ok).toBe(true)
  })

  it('dos fuentes de la misma cuenta no se confirman juntas', () => {
    const r = armarConfirmacion(entrada([lecturaMPEjemplo(), lecturaMPEjemplo()]))
    expect(r).toEqual({ ok: false, errores: ['Hay dos fuentes de Mercado Pago: elegí una.'] })
  })

  it('la nota del día se guarda recortada', () => {
    const r = armarConfirmacion({ ...entrada([]), nota: ' el CCL saltó por la licitación ' })
    expect(r.ok && r.confirmacion.nota).toBe('el CCL saltó por la licitación')
  })
})

describe('D-19, referencia del CCL y motivo principal', () => {
  // La app tiene 1.240 SPY: 1.230 de la apertura y 10 de una compra con PPP "-".
  function hechosConPendiente() {
    const hechos = hechosSinBase(catalogoEjemplo())
    const base = { fecha_origen: null, cuenta_id: 1, activo_id: -1, moneda: 'ARS' as const, importe: null, comisiones: new Decimal(0), carga_id: 1, notas: null }
    hechos.operaciones.push(
      { ...base, id: 30, fecha: '2026-10-01', tipo: 'apertura', cantidad: new Decimal(1230), precio: new Decimal('30100'), ccl_del_dia: null },
      { ...base, id: 31, fecha: '2026-10-13', tipo: 'compra', cantidad: new Decimal(10), precio: null, ccl_del_dia: new Decimal('1540') },
    )
    hechos.cargas.push({ id: 1, lote: null, fecha: '2026-10-13', cuenta_id: 1, origen: 'excel', archivo_path: null, estado: 'vigente', creado_en: '2026-10-13T21:00:00Z', reemplaza_a: null, lector: null, tiempo_activo_ms: null })
    return hechos
  }
  const soloSPY = () => {
    const l = lecturaIEBEjemplo(FECHA)
    l.filas = l.filas.filter((f) => f.ticker === 'SPY')
    return l
  }

  it('la propuesta de completar no se graba sola: sin aceptarla, la fila queda pendiente', () => {
    const e = entrada([soloSPY()], { hechos: hechosConPendiente() })
    const spy = e.propuesta.filas.find((f) => f.ticker === 'SPY')!
    expect(spy.accion).toBe('completar_precio')
    // (30.145,16 × 1.240 − 1.230 × 30.100) ÷ 10 = 35.699,84
    expect(spy.completar).toMatchObject({ operacion_id: 31, precio: '35699.84' })
    const r = armarConfirmacion(e)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.confirmacion.cuentas[0]).not.toHaveProperty('completar_precios')
    expect(r.confirmacion.cuentas[0].cotizaciones).toEqual([])
    expect(r.resumen.cuentas[0].pendientes).toBe(1)
  })

  it('aceptada, completa el precio (el propuesto o el corregido) y graba el precio del día', () => {
    const e = entrada([soloSPY()], { hechos: hechosConPendiente() })
    const spy = e.propuesta.filas.find((f) => f.ticker === 'SPY')!
    const elegir = (extra: object): Elecciones => ({
      ...SIN_ELECCIONES,
      filas: { [spy.clave]: { resolucion: 'aceptada', motivo: 'completé', operacion: null, huella: huellaFila(spy), ...extra } },
    })
    const r = armarConfirmacion({ ...e, elecciones: elegir({}) })
    expect(r.ok && r.confirmacion.cuentas[0].completar_precios).toEqual([{ operacion_id: 31, precio: '35699.84' }])
    expect(r.ok && r.confirmacion.cuentas[0].cotizaciones).toEqual([{ activo_id: -1, precio_pesos: '35150' }])
    expect(r.ok && r.resumen.cuentas[0].precios_completados).toBe(1)
    const grabado = r.ok ? (r.confirmacion.cuentas[0].grabado as { filas: { completada: unknown }[] }) : null
    expect(grabado?.filas[0].completada).toMatchObject({ operacion_id: 31, precio: '35699.84', propuesto: '35699.84' })

    const corregido = armarConfirmacion({ ...e, elecciones: elegir({ precio_completar: '35900' }) })
    expect(corregido.ok && corregido.confirmacion.cuentas[0].completar_precios).toEqual([{ operacion_id: 31, precio: '35900' }])

    const sinCompletar = armarConfirmacion({ ...e, elecciones: elegir({ precio_completar: null }) })
    expect(sinCompletar.ok && sinCompletar.confirmacion.cuentas[0]).not.toHaveProperty('completar_precios')
    expect(sinCompletar.ok && sinCompletar.confirmacion.cuentas[0].cotizaciones).toHaveLength(1)

    const malo = armarConfirmacion({ ...e, elecciones: elegir({ precio_completar: '-1' }) })
    expect(malo).toEqual({ ok: false, errores: [expect.stringContaining('mayor que cero')] })
  })

  it('la referencia del CCL va con el tipo de cambio, recortada', () => {
    const r = armarConfirmacion({ ...entrada([]), tc: { ccl: '1548.2', cripto_venta: null, referencia: '  Ámbito, cierre  ' } })
    expect(r.ok && r.confirmacion.tipo_cambio).toEqual({ ccl: '1548.2', cripto_venta: null, mep: null, oficial: null, referencia: 'Ámbito, cierre' })
    const sin = armarConfirmacion({ ...entrada([]), tc: { ccl: '1548.2', cripto_venta: null, referencia: '   ' } })
    expect(sin.ok && sin.confirmacion.tipo_cambio).toEqual({ ccl: '1548.2', cripto_venta: null, mep: null, oficial: null })
  })

  it('una fila en error muestra su motivo principal (motivos[0]), no el último', () => {
    const l = lecturaIEBEjemplo(FECHA)
    l.filas = [{ ...l.filas[0], estado: 'error', motivos: ['La cuenta no cierra: 1.240 × $ 35.150 ≠ $ 43.000.000.', 'Detalle menor.'] }]
    const e = entrada([l])
    // Forzar la fila en error a pasar por armarConfirmacion (la bandeja no deja, pero el servidor revalida).
    const r = armarConfirmacion(e)
    expect(r).toEqual({ ok: false, errores: [expect.stringContaining('La cuenta no cierra')] })
    expect(r.ok ? '' : r.errores[0]).not.toContain('Detalle menor')
  })
})

// ───────────── Revisión de la fase 1a (números inventados) ─────────────

const cargaIEB = (id: number, fecha: string, extra: object = {}) => ({
  id, lote: null, fecha, cuenta_id: 1, origen: 'excel' as const, archivo_path: 'x', estado: 'vigente' as const,
  creado_en: `${fecha}T13:00:00Z`, reemplaza_a: null, lector: null, tiempo_activo_ms: null, ...extra,
})

describe('tenencias que la fuente ya no lista: venta, vencimiento o pendiente', () => {
  // IEB ya cargada con 1.240 SPY y 1.000.000 de la LECAP S13N6; el Excel de hoy no trae ninguna de las dos.
  function hechosConTenencias() {
    const hechos = hechosSinBase(catalogoEjemplo())
    hechos.activos = hechos.activos.map((a) => (a.ticker === 'S13N6' ? { ...a, fecha_vencimiento: '2026-10-13' } : a))
    const b = { fecha_origen: null, cuenta_id: 1, moneda: 'ARS' as const, importe: null, comisiones: new Decimal(0), carga_id: 1, notas: null, ccl_del_dia: null }
    hechos.operaciones.push(
      { ...b, id: 40, fecha: '2026-10-01', activo_id: -1, tipo: 'apertura', cantidad: new Decimal(1240), precio: new Decimal('30145.16') },
      { ...b, id: 41, fecha: '2026-10-01', activo_id: -5, tipo: 'apertura', cantidad: new Decimal(1_000_000), precio: new Decimal('1.02') },
    )
    hechos.cargas.push(cargaIEB(1, '2026-10-13'))
    return hechos
  }
  const sinPosiciones = () => ({ ...lecturaIEBEjemplo(FECHA), filas: [] })
  const elegir = (base: EntradaConfirmacion, porTicker: Record<string, 'pendiente' | Omit<RegistroAusente, 'cantidad'> & { cantidad?: string }>): Elecciones => {
    const ausentes: Record<string, Elecciones['ausentes'][string]> = {}
    for (const a of base.propuesta.ausentes) {
      const x = porTicker[a.ticker]
      if (x === undefined) continue
      ausentes[claveAusente(a)] = x === 'pendiente' ? 'pendiente' : { cantidad: a.cantidad_app, ...x }
    }
    return { ...SIN_ELECCIONES, ausentes }
  }

  it('sin elegir nada: quedan en lo grabado con su activo y su cuenta (así valen "sin dato"), y el listado queda incompleto', () => {
    const base = entrada([sinPosiciones()], { hechos: hechosConTenencias() })
    expect(base.propuesta.ausentes.map((a) => [a.ticker, a.sugerida])).toEqual([
      ['SPY', 'venta'],
      ['S13N6', 'vencimiento'],
    ])
    const r = armarConfirmacion({ ...base, elecciones: elegir(base, { S13N6: 'pendiente' }) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [ieb] = r.confirmacion.cuentas
    expect(ieb.operaciones).toEqual([])
    expect(ieb.listado_completo).toBe(false)
    expect((ieb.grabado as { ausentes: unknown[] }).ausentes).toEqual([
      { ticker: 'SPY', activo_id: -1, cuenta_id: 1, cantidad_app: '1240', resolucion: 'sin revisar al guardar' },
      { ticker: 'S13N6', activo_id: -5, cuenta_id: 1, cantidad_app: '1000000', resolucion: 'pendiente' },
    ])
    expect(r.resumen.cuentas[0].pendientes).toBe(2)
  })

  it('registrada: la venta (precio tipeado) y el vencimiento (importe cobrado) se graban con el CCL del día, nunca con el último precio', () => {
    const base = entrada([sinPosiciones()], { hechos: hechosConTenencias() })
    const r = armarConfirmacion({
      ...base,
      elecciones: elegir(base, { SPY: { tipo: 'venta', precio: '35150', importe: null }, S13N6: { tipo: 'vencimiento', precio: null, importe: '1049000' } }),
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [ieb] = r.confirmacion.cuentas
    expect(ieb.operaciones).toEqual([
      { activo_id: -1, tipo: 'venta', cantidad: '1240', moneda: 'ARS', precio: '35150', importe: null, comisiones: '0', ccl_del_dia: '1548.2', fecha_origen: null, notas: 'IEB ya no lo lista' },
      { activo_id: -5, tipo: 'vencimiento', cantidad: '1000000', moneda: 'ARS', precio: null, importe: '1049000', comisiones: '0', ccl_del_dia: '1548.2', fecha_origen: null, notas: 'IEB ya no lo lista' },
    ])
    expect(ieb.listado_completo).toBe(true)
    expect((ieb.grabado as { ausentes: { resolucion: string }[] }).ausentes.map((a) => a.resolucion)).toEqual(['registrada', 'registrada'])
    expect(r.resumen.cuentas[0]).toMatchObject({ operaciones: 2, pendientes: 0 })
  })

  it('lo que falta para registrarla frena el Enter con su motivo: el importe de un vencimiento, el CCL', () => {
    const base = entrada([sinPosiciones()], { hechos: hechosConTenencias() })
    const sinImporte = armarConfirmacion({ ...base, elecciones: elegir(base, { S13N6: { tipo: 'vencimiento', precio: null, importe: null }, SPY: 'pendiente' }) })
    expect(sinImporte).toEqual({ ok: false, errores: ['IEB · S13N6: el vencimiento necesita el importe cobrado.'] })

    const sinCcl = entrada([sinPosiciones()], { hechos: hechosConTenencias(), ccl: null })
    const r = armarConfirmacion({ ...sinCcl, elecciones: elegir(sinCcl, { SPY: { tipo: 'venta', precio: '35150', importe: null }, S13N6: 'pendiente' }) })
    expect(r).toEqual({ ok: false, errores: ['IEB · SPY: la venta necesita el CCL del día: tipealo arriba.'] })
  })

  it('sin CCL tipeado, usa el que el día ya tiene (recarga a la tarde)', () => {
    const sinCcl = entrada([sinPosiciones()], { hechos: hechosConTenencias(), ccl: null })
    const r = armarConfirmacion({
      ...sinCcl,
      ccl_del_dia: '1547.9',
      elecciones: elegir(sinCcl, { SPY: { tipo: 'venta', precio: null, importe: '43500000' }, S13N6: 'pendiente' }),
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.confirmacion.cuentas[0].operaciones).toEqual([expect.objectContaining({ tipo: 'venta', importe: '43500000', precio: null, ccl_del_dia: '1547.9' })])
    // El tipo de cambio que se graba es solo lo tipeado: el CCL del día no se vuelve a grabar.
    expect(r.confirmacion.tipo_cambio).toEqual({ ccl: null, cripto_venta: '1541', mep: null, oficial: null })
  })

  it('una elección vieja (la app tiene otra cantidad) no se graba: la ausente vuelve a quedar sin revisar', () => {
    const base = entrada([sinPosiciones()], { hechos: hechosConTenencias() })
    const vieja = elegir(base, { SPY: { tipo: 'venta', precio: '35150', importe: null, cantidad: '1000' }, S13N6: 'pendiente' })
    const r = armarConfirmacion({ ...base, elecciones: vieja })
    expect(r.ok && r.confirmacion.cuentas[0].operaciones).toEqual([])
    expect(r.ok && (r.confirmacion.cuentas[0].grabado as { ausentes: { resolucion: string }[] }).ausentes[0].resolucion).toBe('sin revisar al guardar')
  })
})

describe('una fuente que no graba nada no crea su carga', () => {
  it('Mercado Pago con el saldo pendiente: no reemplaza a la carga buena del día; el resumen lo dice', () => {
    const r = armarConfirmacion(entrada([lecturaMPEjemplo()]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.confirmacion.cuentas).toEqual([])
    expect(r.resumen.sin_grabar).toEqual([{ cuenta: 'Mercado Pago', pendientes: 1 }])
  })

  it('sin tipo de cambio y con todo pendiente: "Nada para guardar" con el porqué', () => {
    const r = armarConfirmacion({ ...entrada([lecturaMPEjemplo()]), tc: { ccl: null, cripto_venta: null } })
    expect(r).toEqual({ ok: false, errores: ['Nada para guardar: todo lo de Mercado Pago quedó pendiente.'] })
  })
})

describe('"Ya la tenía": una tenencia que quedó pendiente el Día cero entra como apertura', () => {
  it('elegida, se graba la apertura con el PPP y sin CCL, en vez de la compra', () => {
    const hechos = hechosSinBase(catalogoEjemplo())
    hechos.cargas.push(cargaIEB(1, '2026-10-07'))
    const l = lecturaIEBEjemplo(FECHA)
    l.filas = l.filas.filter((f) => f.ticker === 'T30J7')
    const base = entrada([l], { hechos, ccl: null })
    const d = base.propuesta.filas[0]
    expect(d.accion).toBe('compra')
    expect(d.estado).toBe('error') // la compra necesita el CCL del día
    expect(d.apertura_alternativa).toMatchObject({ tipo: 'apertura', cantidad: '9000000', precio: '1.0976', ccl_del_dia: null })
    const elecciones: Elecciones = {
      ...SIN_ELECCIONES,
      filas: { [d.clave]: { resolucion: 'aceptada', motivo: 'ya la tenía', operacion: null, apertura: true, huella: huellaFila(d) } },
    }
    const r = armarConfirmacion({ ...base, elecciones })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.confirmacion.cuentas[0].operaciones).toEqual([
      expect.objectContaining({ tipo: 'apertura', activo_id: -3, cantidad: '9000000', precio: '1.0976', ccl_del_dia: null }),
    ])
    expect((r.confirmacion.cuentas[0].grabado as { filas: { como_apertura?: boolean }[] }).filas[0].como_apertura).toBe(true)
  })
})

describe('un precio por activo y por día, también entre lotes: una captura no pisa el del Excel', () => {
  it('cotizacionesDeExcel: los precios del día que grabó un Excel no revertido', () => {
    const hechos = hechosSinBase(catalogoEjemplo())
    hechos.cargas.push(cargaIEB(1, FECHA), cargaIEB(2, FECHA, { estado: 'revertida' }), { ...cargaIEB(3, FECHA), cuenta_id: 2, origen: 'captura' as const })
    const c = (activo_id: number, precio: string, carga_id: number, fecha = FECHA) => ({ fecha, activo_id, precio_pesos: new Decimal(precio), precio_usd_subyacente: null, carga_id })
    hechos.cotizaciones.push(c(-3, '1.124', 1), c(-1, '35150', 2), c(-5, '1.0852', 3), c(-2, '52300', 1, '2026-10-13'))
    expect(cotizacionesDeExcel(hechos, FECHA)).toEqual([{ activo_id: -3, precio_pesos: '1.124', cuenta: 'IEB' }])
  })

  it('la captura posterior no graba su precio y lo anota: vale el de IEB, grabado antes hoy', () => {
    const g = lecturaGaliciaEjemplo()
    g.filas = [{ ...g.filas[0], clave: 'Galicia:T30J7', ticker: 'T30J7', precio_unitario: '1.125', valorizado: null, chequeo: null }]
    const r = armarConfirmacion({ ...entrada([g]), cotizaciones_excel: [{ activo_id: -3, precio_pesos: '1.124', cuenta: 'IEB' }] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.confirmacion.cuentas[0].cotizaciones).toEqual([])
    const gr = r.confirmacion.cuentas[0].grabado as { filas: { nota: string }[] }
    expect(gr.filas[0].nota).toBe('precio no grabado: vale el de IEB, grabado antes hoy (1.124); esta fuente mostraba 1.125')
  })

  it('un Excel posterior sí lo reemplaza (el Excel manda)', () => {
    const l = lecturaIEBEjemplo(FECHA)
    const r = armarConfirmacion({ ...entrada([l]), cotizaciones_excel: [{ activo_id: -3, precio_pesos: '1.12', cuenta: 'IEB' }] })
    expect(r.ok && r.confirmacion.cuentas[0].cotizaciones).toContainEqual({ activo_id: -3, precio_pesos: '1.124' })
  })
})
