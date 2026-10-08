import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { proponerCarga } from '@/lib/carga/conciliar'
import type { LecturaCuenta } from '@/lib/carga/contratos'
import { SIN_ELECCIONES, huellaFila, huellaSaldo, type Elecciones } from './bandeja'
import { armarConfirmacion, type EntradaConfirmacion } from './confirmacion'
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
    // MP: dos lecturas distintas, nunca las acepta el Enter general.
    expect(mp.saldos).toEqual([])
    expect(mp.listado_completo).toBe(false)
    expect(r.resumen.pendientes).toBe(2)
    const grabadoMP = mp.grabado as { saldos: { resolucion: string; motivo: string }[] }
    expect(grabadoMP.saldos[0]).toMatchObject({ resolucion: 'pendiente', motivo: 'sin revisar al guardar' })
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
