import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DURACION_SESION_MS,
  OPCIONES_COOKIE,
  claveCorrecta,
  claveDerivada,
  crearTokenSesion,
  modoDemo,
  tokenValido,
} from './sesion'

// Clave simple (D-21): firma de la cookie, comparación de la clave, claves
// derivadas por propósito, modo demo y que toda Server Action y todo Route
// Handler vuelvan a pedir la sesión.

const ENV = { ...process.env }
const AHORA = Date.UTC(2026, 9, 8, 12, 0, 0)

beforeEach(() => {
  process.env.APP_PASSWORD = 'clave de prueba inventada'
  delete process.env.SESSION_SECRET
  delete process.env.PORTFOLIO_DEMO
  delete process.env.VERCEL_ENV
  delete process.env.VERCEL_TARGET_ENV
})
afterEach(() => {
  process.env = { ...ENV }
})

describe('cookie de sesión', () => {
  it('un token recién creado vale hasta que vence, y después no', async () => {
    const t = await crearTokenSesion(AHORA)
    expect(t).toMatch(/^\d{13}\.[A-Za-z0-9_-]{43}$/)
    expect(await tokenValido(t, AHORA)).toBe(true)
    expect(await tokenValido(t, AHORA + DURACION_SESION_MS - 1)).toBe(true)
    expect(await tokenValido(t, AHORA + DURACION_SESION_MS)).toBe(false)
  })

  it('rechaza lo vacío, lo malformado y lo tocado', async () => {
    const t = await crearTokenSesion(AHORA)
    const [vence, firma] = t.split('.')
    const otraFirma = (firma[0] === 'A' ? 'B' : 'A') + firma.slice(1)
    for (const malo of [
      undefined,
      null,
      '',
      'x',
      vence,
      `${vence}.`,
      `.${firma}`,
      `${vence}.${otraFirma}`,
      `${Number(vence) + 1}.${firma}`,
      `${vence}.${firma}.extra`,
      `${vence}.${firma}=`,
      ` ${t}`,
      `-${t}`,
    ]) {
      expect(await tokenValido(malo, AHORA), String(malo)).toBe(false)
    }
  })

  it('un vencimiento más lejano que 30 días no vale aunque esté bien firmado', async () => {
    const lejano = await crearTokenSesion(AHORA + 90 * 24 * 3600 * 1000)
    expect(await tokenValido(lejano, AHORA)).toBe(false)
  })

  it('cambiar la clave o SESSION_SECRET cierra las sesiones abiertas', async () => {
    const t = await crearTokenSesion(AHORA)
    process.env.APP_PASSWORD = 'otra clave inventada'
    expect(await tokenValido(t, AHORA)).toBe(false)

    process.env.SESSION_SECRET = 'secreto-inventado-1'
    const conSecreto = await crearTokenSesion(AHORA)
    expect(await tokenValido(conSecreto, AHORA)).toBe(true)
    process.env.SESSION_SECRET = 'secreto-inventado-2'
    expect(await tokenValido(conSecreto, AHORA)).toBe(false)
  })

  it('sin APP_PASSWORD no hay sesión posible (aunque haya SESSION_SECRET)', async () => {
    process.env.SESSION_SECRET = 'secreto-inventado'
    const t = await crearTokenSesion(AHORA)
    delete process.env.APP_PASSWORD
    expect(await tokenValido(t, AHORA)).toBe(false)
    await expect(crearTokenSesion(AHORA)).rejects.toThrow(/APP_PASSWORD/)
  })

  it('la cookie es httpOnly, SameSite=Lax, de todo el sitio y dura lo mismo que la firma', () => {
    expect(OPCIONES_COOKIE).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: DURACION_SESION_MS / 1000 })
    // Secure en producción (vitest corre con NODE_ENV=test).
    expect(OPCIONES_COOKIE.secure).toBe(process.env.NODE_ENV === 'production')
  })
})

describe('claves derivadas', () => {
  it('cada propósito tiene su clave, distinta de la clave y del secreto', async () => {
    const sesion = await claveDerivada('sesion')
    const lectura = await claveDerivada('lectura')
    expect(sesion).toHaveLength(32)
    expect(lectura).toHaveLength(32)
    expect(Buffer.from(sesion!).equals(Buffer.from(lectura!))).toBe(false)
    const enTexto = Buffer.from(sesion!).toString('latin1') + Buffer.from(lectura!).toString('latin1')
    expect(enTexto).not.toContain(process.env.APP_PASSWORD)
    // Es determinística: otra instancia con las mismas variables firma igual.
    expect(Buffer.from((await claveDerivada('lectura'))!).equals(Buffer.from(lectura!))).toBe(true)
  })

  it('cambia con SESSION_SECRET y no existe sin APP_PASSWORD', async () => {
    const sin = await claveDerivada('lectura')
    process.env.SESSION_SECRET = 'secreto-inventado'
    const con = await claveDerivada('lectura')
    expect(Buffer.from(sin!).equals(Buffer.from(con!))).toBe(false)
    delete process.env.APP_PASSWORD
    expect(await claveDerivada('lectura')).toBeNull()
  })
})

describe('claveCorrecta', () => {
  it('acepta solo la clave exacta', async () => {
    expect(await claveCorrecta('clave de prueba inventada')).toBe(true)
    for (const mala of ['', 'clave de prueba inventad', 'clave de prueba inventadaa', 'Clave de prueba inventada', ' clave de prueba inventada', 'x'.repeat(600)]) {
      expect(await claveCorrecta(mala), mala.slice(0, 30)).toBe(false)
    }
  })

  it('sin APP_PASSWORD nada es la clave', async () => {
    delete process.env.APP_PASSWORD
    expect(await claveCorrecta('')).toBe(false)
    expect(await claveCorrecta('undefined')).toBe(false)
  })
})

describe('modoDemo', () => {
  it('solo con PORTFOLIO_DEMO=1, y nunca en producción', () => {
    expect(modoDemo()).toBe(false)
    process.env.PORTFOLIO_DEMO = '1'
    expect(modoDemo()).toBe(true)
    process.env.VERCEL_ENV = 'preview'
    expect(modoDemo()).toBe(true)
    process.env.VERCEL_ENV = 'production'
    expect(modoDemo()).toBe(false)
    delete process.env.VERCEL_ENV
    process.env.VERCEL_TARGET_ENV = 'production'
    expect(modoDemo()).toBe(false)
    process.env.PORTFOLIO_DEMO = 'true'
    delete process.env.VERCEL_TARGET_ENV
    expect(modoDemo()).toBe(false)
  })
})

// ───────────── Toda Server Action y todo Route Handler piden la sesión ─────────────

const APP = path.resolve(import.meta.dirname, '../../app')
/** Acciones que no piden sesión, a propósito. */
const ABIERTAS = new Set(['login/acciones.ts#entrar', 'login/acciones.ts#salir'])

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n)
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : []
  })
}

/** Las funciones exportadas que no llaman a exigirSesion (directo o por una función del mismo archivo que la llama). */
function desprotegidas(archivo: string, nombres?: Set<string>): string[] {
  const src = ts.createSourceFile(archivo, readFileSync(archivo, 'utf8'), ts.ScriptTarget.Latest, true)
  const cuerpos = new Map<string, ts.Node>()
  const exportadas: string[] = []
  const esExport = (n: ts.Node) => ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  for (const st of src.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && st.body) {
      cuerpos.set(st.name.text, st.body)
      if (esExport(st)) exportadas.push(st.name.text)
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
          cuerpos.set(d.name.text, d.initializer.body)
          if (esExport(st)) exportadas.push(d.name.text)
        }
      }
    }
  }
  const llama = (n: ts.Node, a: Set<string>): boolean => {
    let si = false
    const visitar = (x: ts.Node) => {
      if (si) return
      if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && a.has(x.expression.text)) si = true
      else ts.forEachChild(x, visitar)
    }
    visitar(n)
    return si
  }
  // Funciones del archivo que protegen: exigirSesion y las que la llaman (hasta punto fijo).
  const protegen = new Set(['exigirSesion'])
  for (let cambio = true; cambio; ) {
    cambio = false
    for (const [nombre, cuerpo] of cuerpos) {
      if (!protegen.has(nombre) && llama(cuerpo, protegen)) {
        protegen.add(nombre)
        cambio = true
      }
    }
  }
  return exportadas.filter((n) => (!nombres || nombres.has(n)) && !protegen.has(n))
}

describe('segunda barrera: exigirSesion en cada Server Action y Route Handler', () => {
  const todos = archivos(APP)
  const acciones = todos.filter((f) => /^\s*['"]use server['"]/.test(readFileSync(f, 'utf8')))
  const rutas = todos.filter((f) => path.basename(f) === 'route.ts')

  it('encuentra las acciones y las rutas (si no, el test no prueba nada)', () => {
    expect(acciones.length).toBeGreaterThanOrEqual(4)
    expect(rutas.map((f) => path.relative(APP, f))).toContain(path.join('(app)', 'carga', 'leer', 'route.ts'))
  })

  it('toda Server Action exportada pide la sesión (salvo entrar y salir)', () => {
    const faltan = acciones.flatMap((f) =>
      desprotegidas(f)
        .map((n) => `${path.relative(APP, f).split(path.sep).join('/')}#${n}`)
        .filter((id) => !ABIERTAS.has(id)),
    )
    expect(faltan).toEqual([])
  })

  it('todo Route Handler pide la sesión', () => {
    const METODOS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
    const faltan = rutas.flatMap((f) => desprotegidas(f, METODOS).map((n) => `${path.relative(APP, f)}#${n}`))
    expect(faltan).toEqual([])
  })
})
