import { describe, expect, it } from 'vitest'
import { decidirFuente, ErrorCaptura } from '@/lib/carga/captura-verificacion'
import { avisosDeFecha, claseDeArchivo, cuentasParaElegir, fechaDeCarga, fuentesActivas, mensajeLectura, mimeDeImagen } from './fuentes'
import { lecturaGaliciaEjemplo, lecturaIEBEjemplo, lecturaMPEjemplo } from './ejemplos'

describe('claseDeArchivo', () => {
  it('reconoce el Excel y las capturas', () => {
    expect(claseDeArchivo('Portafolio.xlsx', '')).toBe('excel')
    expect(claseDeArchivo('x', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('excel')
    expect(claseDeArchivo('image.png', 'image/png')).toBe('imagen')
    expect(claseDeArchivo('captura.JPG', '')).toBe('imagen')
  })
  it('rechaza lo que no sabe leer', () => {
    expect(claseDeArchivo('resumen.pdf', 'application/pdf')).toBeNull()
    expect(claseDeArchivo('viejo.xls', 'application/vnd.ms-excel')).toBeNull()
  })
  it('completa el tipo de una imagen pegada sin tipo', () => {
    expect(mimeDeImagen('a.jpeg', '')).toBe('image/jpeg')
    expect(mimeDeImagen('a', '')).toBe('image/png')
    expect(mimeDeImagen('a.png', 'image/webp')).toBe('image/webp')
  })
})

describe('fechaDeCarga', () => {
  it('la da el Excel de IEB (B1)', () => {
    const r = fechaDeCarga([lecturaMPEjemplo(), lecturaIEBEjemplo('2026-10-14')], '2026-10-15')
    expect(r).toEqual({ fecha: '2026-10-14', origen: 'tomada del Excel de IEB, celda B1' })
  })
  it('si no hay Excel, la de una captura; si no, hoy', () => {
    const g = { ...lecturaGaliciaEjemplo(), fecha_reporte: '2026-10-13' }
    expect(fechaDeCarga([g], '2026-10-15').fecha).toBe('2026-10-13')
    expect(fechaDeCarga([lecturaMPEjemplo()], '2026-10-15')).toEqual({ fecha: '2026-10-15', origen: 'hoy' })
    expect(fechaDeCarga([], '2026-10-15').fecha).toBe('2026-10-15')
  })
  it('avisa cuando una captura sin fecha va a una carga de otro día', () => {
    const avisos = avisosDeFecha([lecturaIEBEjemplo('2026-10-14'), lecturaMPEjemplo()], '2026-10-14', '2026-10-15')
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatch(/Mercado Pago no muestra fecha/)
    expect(avisosDeFecha([lecturaMPEjemplo()], '2026-10-15', '2026-10-15')).toEqual([])
  })
})

describe('fuentesActivas', () => {
  const f = (id: string, cuenta: 'IEB' | 'Galicia' | null, agregada: number) => ({ id, cuenta, agregada })
  it('una por cuenta: la más nueva si no elegiste', () => {
    const r = fuentesActivas([f('a', 'Galicia', 1), f('b', 'Galicia', 2), f('c', 'IEB', 1), f('d', null, 3)], {})
    expect([...r.activas].sort()).toEqual(['b', 'c'])
    expect(r.repetidas).toEqual(['Galicia'])
  })
  it('la elegida gana aunque sea más vieja', () => {
    const r = fuentesActivas([f('a', 'Galicia', 1), f('b', 'Galicia', 2)], { Galicia: 'a' })
    expect([...r.activas]).toEqual(['a'])
  })
})

describe('mensajeLectura', () => {
  it('no repite "No pude leer" si el lector ya lo dice', () => {
    expect(mensajeLectura('imagen', 'Galicia', new Error('No pude leer la captura de Galicia: la segunda lectura falló.'))).toBe(
      'No pude leer la captura de Galicia: la segunda lectura falló.',
    )
  })
  it('agrega qué se quiso leer cuando el motivo no lo dice', () => {
    expect(mensajeLectura('excel', undefined, new Error('El Excel no tiene la hoja Patrimonio.'))).toBe('No pude leer el Excel: El Excel no tiene la hoja Patrimonio.')
    expect(mensajeLectura('imagen', undefined, 'Falta configurar ANTHROPIC_API_KEY')).toBe('No pude leer la captura: Falta configurar ANTHROPIC_API_KEY')
    expect(mensajeLectura('imagen', 'Mercado Pago', new Error('tiempo agotado'))).toBe('No pude leer la captura de Mercado Pago: tiempo agotado')
  })
})

describe('una captura que las lecturas atribuyen a bancos distintos (revisión fase 1a)', () => {
  it('se pregunta de qué banco es (y se vuelve a leer con esa pista); el mensaje dice eso, no "pegala en otro lugar"', () => {
    let error: unknown = null
    try {
      decidirFuente('galicia', 'mercado_pago')
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ErrorCaptura)
    expect(String((error as Error).message)).toMatch(/Decime de cuál es y la vuelvo a leer\.$/)
    expect(cuentasParaElegir(error)).toEqual(['Galicia', 'Mercado Pago'])
    // Con la pista, decide: la pantalla manda la elegida.
    expect(decidirFuente('galicia', 'mercado_pago', 'Mercado Pago').fuente).toBe('mercado_pago')
  })

  it('otros errores no preguntan nada', () => {
    expect(cuentasParaElegir(new ErrorCaptura('no_reconocida', 'no parece una pantalla de inversiones'))).toBeNull()
    expect(cuentasParaElegir(new Error('x'))).toBeNull()
    expect(cuentasParaElegir(null)).toBeNull()
  })
})
