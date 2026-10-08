import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/domain/dinero'
import { firmaValida, firmarLectura } from './servidor'
import { lecturaGaliciaEjemplo, lecturaIEBEjemplo } from './ejemplos'

// La lectura viaja del servidor al navegador (JSON) y vuelve en la Server
// Action de guardar: la firma tiene que sobrevivir ese viaje y romperse con
// cualquier cambio.
const ida = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

describe('firma de las lecturas', () => {
  const antes = process.env.APP_PASSWORD
  beforeEach(() => {
    process.env.APP_PASSWORD = 'clave inventada para el test'
  })
  afterEach(() => {
    if (antes === undefined) delete process.env.APP_PASSWORD
    else process.env.APP_PASSWORD = antes
  })

  it('sobrevive el viaje de ida y vuelta por JSON', async () => {
    const lectura = { ...lecturaIEBEjemplo('2026-10-14'), cruda: { celdas: [{ ref: 'B1', valor: 46309 }, { ref: 'B2', valor: 80830000.5 }], fecha: new Date('2026-10-14T21:00:00Z'), d: new Decimal('1.10'), nada: undefined } }
    const archivo = { path: '2026/10/abc.xlsx', sha256: 'abc' }
    const firma = await firmarLectura(lectura, archivo)
    expect(await firmaValida(ida(lectura), ida(archivo), firma)).toBe(true)
  })

  it('cualquier cambio en la lectura o en el archivo la rompe', async () => {
    const lectura = lecturaGaliciaEjemplo()
    const firma = await firmarLectura(lectura, null)
    const tocada = ida(lectura)
    tocada.filas[0].precio_unitario = '1.09'
    expect(await firmaValida(tocada, null, firma)).toBe(false)
    expect(await firmaValida(lectura, { path: 'x', sha256: 'y' }, firma)).toBe(false)
    expect(await firmaValida(lectura, null, firma.slice(1))).toBe(false)
    expect(await firmaValida(lectura, null, '')).toBe(false)
  })

  it('cambiar la clave invalida las firmas', async () => {
    const lectura = lecturaGaliciaEjemplo()
    const firma = await firmarLectura(lectura, null)
    process.env.APP_PASSWORD = 'otra clave inventada'
    expect(await firmaValida(lectura, null, firma)).toBe(false)
  })
})
