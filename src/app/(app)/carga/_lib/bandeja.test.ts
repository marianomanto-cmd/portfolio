import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { proponerCarga } from '@/lib/carga/conciliar'
import { aplicarEdiciones, editarFila, toleranciaEditada } from './ediciones'
import {
  SIN_ELECCIONES,
  alternativasSaldo,
  huellaFila,
  huellaSaldo,
  resumirBandeja,
  saltoDeSaldo,
  textoBoton,
  type Elecciones,
} from './bandeja'
import { catalogoEjemplo, lecturaGaliciaEjemplo, lecturaIEBEjemplo, lecturaMPEjemplo } from './ejemplos'
import { hechosSinBase } from './demo'

const FECHA = '2026-10-14'
const propuestaEjemplo = (ccl: string | null = '1548.2') =>
  proponerCarga(
    [lecturaIEBEjemplo(FECHA), lecturaGaliciaEjemplo(), lecturaMPEjemplo()],
    hechosSinBase(catalogoEjemplo()),
    FECHA,
    { ccl: ccl === null ? null : new Decimal(ccl) },
  )

describe('resumirBandeja', () => {
  it('cuenta leídas, verificadas y a revisar como el Apéndice B', () => {
    const r = resumirBandeja(propuestaEjemplo(), SIN_ELECCIONES, 2)
    // 6 filas + 3 saldos + CCL y cripto.
    expect(r.leidas).toBe(11)
    // FIMA no está en el catálogo y MP tiene dos lecturas distintas.
    expect(r.aRevisar).toBe(2)
    expect(r.verificadas).toBe(9)
    expect(r.errores).toBe(0)
    expect(r.quedanPendientes).toBe(2)
    // Lo que no cerró va primero.
    expect(r.items[0].estado).not.toBe('verificada')
    expect(r.items.at(-1)?.estado).toBe('verificada')
  })

  it('una advertencia se acepta de a una, con su motivo', () => {
    const p = propuestaEjemplo()
    const mp = p.saldos.find((s) => s.cuenta === 'Mercado Pago')!
    const e: Elecciones = {
      ...SIN_ELECCIONES,
      saldos: { [mp.clave]: { resolucion: 'aceptada', motivo: 'elegí la lectura 1', monto: '4912300', huella: huellaSaldo(mp) } },
    }
    const r = resumirBandeja(p, e, 2)
    expect(r.verificadas).toBe(10)
    expect(r.aRevisar).toBe(1)
  })

  it('una elección hecha sobre otra propuesta no vale', () => {
    const p = propuestaEjemplo()
    const mp = p.saldos.find((s) => s.cuenta === 'Mercado Pago')!
    const e: Elecciones = {
      ...SIN_ELECCIONES,
      saldos: { [mp.clave]: { resolucion: 'aceptada', motivo: 'x', monto: '1', huella: 'otra' } },
    }
    expect(resumirBandeja(p, e, 2).verificadas).toBe(9)
  })

  it('sin CCL, una compra queda en error y frena el Enter', () => {
    // Segunda carga de IEB con una compra: la app ya tiene 8.000.000 de T30J7.
    const hechos = hechosSinBase(catalogoEjemplo())
    hechos.operaciones.push({
      id: 1, fecha: '2026-10-01', fecha_origen: null, cuenta_id: 1, activo_id: -3, tipo: 'apertura',
      cantidad: new Decimal(8_000_000), moneda: 'ARS', precio: new Decimal('1.097475'), importe: null,
      comisiones: new Decimal(0), ccl_del_dia: null, carga_id: 1, notas: null,
    })
    const ieb = lecturaIEBEjemplo(FECHA)
    ieb.filas = ieb.filas.filter((f) => f.ticker === 'T30J7')
    const p = proponerCarga([ieb], hechos, FECHA, { ccl: null })
    const t30 = p.filas.find((f) => f.ticker === 'T30J7')!
    expect(t30.accion).toBe('compra')
    const r = resumirBandeja(p, SIN_ELECCIONES, 0)
    expect(r.errores).toBe(1)
    const b = textoBoton(r, { leyendo: [], proponiendo: false, guardando: false })
    expect(b.habilitado).toBe(false)
    expect(b.texto).toBe('Resolvé 1 error para guardar')
    // Dejarla pendiente destraba el Enter.
    const e: Elecciones = { ...SIN_ELECCIONES, filas: { [t30.clave]: { resolucion: 'pendiente', motivo: 'la dejé pendiente', operacion: null, huella: huellaFila(t30) } } }
    const r2 = resumirBandeja(p, e, 0)
    expect(r2.errores).toBe(0)
    expect(textoBoton(r2, { leyendo: [], proponiendo: false, guardando: false }).habilitado).toBe(true)
  })
})

describe('textoBoton', () => {
  const base = resumirBandeja(propuestaEjemplo(), SIN_ELECCIONES, 2)
  it('dice qué va a hacer el Enter, con números', () => {
    expect(textoBoton(base, { leyendo: [], proponiendo: false, guardando: false })).toEqual({
      texto: 'Guardar 9 · dejar 2 pendientes',
      habilitado: true,
      motivo: null,
    })
  })
  it('espera a que terminen las lecturas', () => {
    expect(textoBoton(base, { leyendo: ['MP'], proponiendo: false, guardando: false }).texto).toBe('Esperando MP (leyendo…)')
  })
  it('carga express: solo los tipos de cambio', () => {
    const r = resumirBandeja(null, SIN_ELECCIONES, 2)
    expect(textoBoton(r, { leyendo: [], proponiendo: false, guardando: false }).texto).toBe('Guardar 2')
  })
  it('sin nada no guarda', () => {
    const r = resumirBandeja(null, SIN_ELECCIONES, 0)
    expect(textoBoton(r, { leyendo: [], proponiendo: false, guardando: false }).habilitado).toBe(false)
  })
})

describe('ediciones', () => {
  const f = lecturaGaliciaEjemplo().filas[0]
  it('una edición que cierra contra el valorizado queda verificada', () => {
    const r = editarFila({ ...f, estado: 'error', precio_unitario: null }, { cantidad: null, precio_unitario: '1.0852' })
    expect(r.estado).toBe('verificada')
    expect(r.chequeo?.ok).toBe(true)
  })
  it('una edición que no cierra sigue en error, con la cuenta a la vista', () => {
    // 1,09 tiene menos decimales que la fuente: no alcanza para cerrar.
    const r = editarFila(f, { cantidad: null, precio_unitario: '1.09' })
    expect(r.estado).toBe('error')
    expect(r.motivos[0]).toMatch(/no cierra/)
  })
  it('sin valorizado no hay control: queda como advertencia', () => {
    const r = editarFila({ ...f, valorizado: null }, { cantidad: '100', precio_unitario: '2' })
    expect(r.estado).toBe('advertencia')
  })
  it('tolerancia: medio último dígito por la cantidad más medio centavo (D-37)', () => {
    expect(toleranciaEditada('11500000', '1.0852').toFixed()).toBe('575.005')
  })
  it('no toca la lectura original', () => {
    const l = lecturaGaliciaEjemplo()
    const [editada] = aplicarEdiciones([l], { [f.clave]: { cantidad: '1', precio_unitario: null } })
    expect(editada.filas[0].cantidad).toBe('1')
    expect(l.filas[0].cantidad).toBe('11500000')
  })
})

describe('saltoDeSaldo', () => {
  it('la suba que explica la TNA no pregunta nada (Apéndice B: MP subió $3.700)', () => {
    const r = saltoDeSaldo('4908600', '4912300', '27.5', 1)
    expect(r.suba).toBe('3700')
    expect(r.sinExplicar).toBeNull()
  })
  it('una suba mayor pregunta "¿entró o salió plata?"', () => {
    const r = saltoDeSaldo('4908600', '5412300', '0.275', 1)
    expect(r.sinExplicar).not.toBeNull()
    expect(Number(r.sinExplicar)).toBeGreaterThan(499_000)
  })
  it('sin TNA solo muestra la diferencia', () => {
    expect(saltoDeSaldo('100', '50', null, 1)).toEqual({ suba: '-50', explicadoHasta: null, sinExplicar: null })
  })
})

describe('alternativasSaldo', () => {
  const base = lecturaMPEjemplo().saldos[0]
  it('toma las partes rotuladas como lecturas', () => {
    expect(alternativasSaldo(base)).toEqual([
      { concepto: 'lectura 1', monto: '4912300' },
      { concepto: 'lectura 2', monto: '4912800' },
    ])
  })
  it('lee el motivo del lector de capturas', () => {
    const s = { ...base, partes: [], motivos: ['Saldo — Lectura A: $ 4.912.300,00 · Lectura B: $ 4.912.800 (se propone la A).'] }
    expect(alternativasSaldo(s)).toEqual([
      { concepto: 'lectura A', monto: '4912300' },
      { concepto: 'lectura B', monto: '4912800' },
    ])
  })
  it('si una lectura es ilegible, no ofrece elegir', () => {
    const s = { ...base, partes: [], motivos: ['Saldo — Lectura A: $ 4.912.300 · Lectura B: "49l2" (ilegible) (se propone la A).'] }
    expect(alternativasSaldo(s)).toEqual([])
    expect(alternativasSaldo({ ...base, partes: [{ concepto: 'Total de la hoja Saldos', monto: '1' }], motivos: [] })).toEqual([])
  })
})
