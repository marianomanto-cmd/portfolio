import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// El freno a los intentos de clave (D-112) también con pedidos en paralelo:
// desde el tercer error seguido del mismo origen, la entrada queda trabada y
// la clave ni se mira. Antes, mirar la traba y anotar el error quedaban
// separados por la comparación de la clave (un await) y una ráfaga probaba
// todas sus claves. Claves inventadas.

const IP = '203.0.113.7'
const CORRECTA = 'clave de prueba inventada'
const T0 = Date.UTC(2026, 9, 8, 12, 0, 0)
const ENV = { ...process.env }

let cookiesPuestas: string[] = []

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': IP }),
  cookies: async () => ({
    get: () => undefined,
    set: (nombre: string) => {
      cookiesPuestas.push(nombre)
    },
  }),
}))
vi.mock('next/navigation', () => ({
  // Como el de Next: corta la acción con una excepción.
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))

let entrar: typeof import('./acciones').entrar
let ahora = T0

beforeEach(async () => {
  process.env.APP_PASSWORD = CORRECTA
  delete process.env.SESSION_SECRET
  delete process.env.PORTFOLIO_DEMO
  delete process.env.VERCEL_ENV
  delete process.env.VERCEL_TARGET_ENV
  cookiesPuestas = []
  ahora = T0
  // El reloj de la traba lo maneja el test; la demora de cada respuesta es real.
  vi.spyOn(Date, 'now').mockImplementation(() => ahora)
  vi.resetModules() // un registro de intentos nuevo en cada caso
  ;({ entrar } = await import('./acciones'))
})
afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...ENV }
})

/** Un intento: el error que contesta, o "entró" si redirigió. */
async function intento(clave: string): Promise<string> {
  const f = new FormData()
  f.set('clave', clave)
  f.set('desde', '/')
  try {
    return (await entrar({ error: null }, f)).error ?? 'sin error'
  } catch (e) {
    if (e instanceof Error && e.message === 'REDIRECT /') return 'entró'
    throw e
  }
}

const malas = (n: number, prefijo = 'mala') => Array.from({ length: n }, (_, i) => `${prefijo}-${i}`)
const probadas = (r: string[]) => r.filter((x) => x.startsWith('Esa no es la clave')).length
const trabadas = (r: string[]) => r.filter((x) => x.startsWith('Demasiados intentos')).length

describe('freno a los intentos de clave (D-112)', () => {
  it('en serie: el tercer error traba, y trabada ni la clave correcta entra', async () => {
    const r: string[] = []
    for (const c of [...malas(3), CORRECTA]) r.push(await intento(c))
    expect(r).toEqual([
      'Esa no es la clave. Probá de nuevo.',
      'Esa no es la clave. Probá de nuevo.',
      'Esa no es la clave. Esperá 1 segundo antes de probar otra vez.',
      'Demasiados intentos seguidos. Esperá 1 segundo y probá de nuevo.',
    ])
    expect(cookiesPuestas).toEqual([])
  })

  it('en paralelo: una ráfaga del mismo origen prueba como mucho 3 claves', async () => {
    const r = await Promise.all([...malas(49), CORRECTA].map(intento))
    expect(probadas(r)).toBe(3)
    expect(trabadas(r)).toBe(47)
    expect(r.at(-1)).toBe('Demasiados intentos seguidos. Esperá 1 segundo y probá de nuevo.')
    expect(cookiesPuestas).toEqual([])
  })

  it('pasada la traba, otra ráfaga prueba una sola clave y la traba se duplica', async () => {
    await Promise.all(malas(10).map(intento))
    ahora += 1000 // venció la traba de 1 s
    const r = await Promise.all(malas(20, 'otra').map(intento))
    expect(probadas(r)).toBe(1)
    expect(r).toContain('Esa no es la clave. Esperá 2 segundos antes de probar otra vez.')
    expect(trabadas(r)).toBe(19)
  })

  it('la clave correcta en el tercer intento entra y deja el origen limpio', async () => {
    expect(await intento('mala-1')).toBe('Esa no es la clave. Probá de nuevo.')
    expect(await intento('mala-2')).toBe('Esa no es la clave. Probá de nuevo.')
    expect(await intento(CORRECTA)).toBe('entró')
    expect(cookiesPuestas).toEqual(['sesion'])
    // El intento anotado por adelantado se borró al entrar: el contador arranca de cero.
    expect(await intento('mala-3')).toBe('Esa no es la clave. Probá de nuevo.')
  })
})
