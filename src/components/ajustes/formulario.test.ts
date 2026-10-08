// WCAG 1.4.11 (AA, calidad.md §4): lo que identifica el interruptor de Modo
// privado y su estado tiene que llegar a 3:1 contra lo que tiene al lado. axe
// no lo revisa (no tiene reglas de contraste no textual): este test lee las
// clases reales del interruptor y los tokens reales de globals.css.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8')
const css = leer('src/app/globals.css')
const tsx = leer('src/components/ajustes/formulario.tsx')

/** Los colores (#rrggbb) de un bloque de tokens de globals.css. */
function bloque(selector: string): Record<string, string> {
  const i = css.indexOf(selector)
  const cuerpo = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i))
  const out: Record<string, string> = {}
  for (const m of cuerpo.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2]
  return out
}
const TEMAS = { claro: bloque(':root {'), oscuro: bloque(':root[data-theme="dark"] {') }

// La utilidad de Tailwind → el token (el mapa @theme inline de globals.css).
const TOKEN: Record<string, string> = {
  surface: 'surface',
  'surface-3': 'surface-3',
  'border-strong': 'border-strong',
  border: 'border',
  muted: 'text-muted',
  accent: 'accent',
  faint: 'text-faint',
}

const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** La clase de color (bg-…, border-…) de un estado: `p.privado ? 'prendido' : 'apagado'`. */
function clases(fragmento: string, estado: 'prendido' | 'apagado'): string[] {
  const fijo = fragmento.replace(/\$\{p\.privado \? '([^']*)' : '([^']*)'\}/g, estado === 'prendido' ? '$1' : '$2')
  return fijo.split(/\s+/)
}
const boton = tsx.match(/role="switch"[\s\S]*?className=\{`([^`]*)`\}/)![1]
const perilla = tsx.slice(tsx.indexOf(boton)).match(/<span className=\{`([^`]*)`\}/)![1]
const color = (cs: string[], prefijo: 'bg-' | 'border-') => {
  const c = cs.find((x) => x.startsWith(prefijo) && x.slice(prefijo.length) in TOKEN)
  if (!c) throw new Error(`sin ${prefijo} en ${cs.join(' ')}`)
  return c.slice(prefijo.length)
}

describe('Modo privado: el interruptor se ve en los dos estados (WCAG 1.4.11, 3:1)', () => {
  for (const estado of ['apagado', 'prendido'] as const) {
    const pista = color(clases(boton, estado), 'bg-')
    const borde = color(clases(boton, estado), 'border-')
    const bola = color(clases(perilla, estado), 'bg-')
    for (const [tema, t] of Object.entries(TEMAS)) {
      const hex = (u: string) => t[TOKEN[u]]
      it(`${estado}, ${tema}: la perilla (${bola}) contra la pista (${pista})`, () => {
        expect(contraste(hex(bola), hex(pista))).toBeGreaterThanOrEqual(3)
      })
      it(`${estado}, ${tema}: el borde de la pista (${borde}) contra la tarjeta (surface)`, () => {
        expect(contraste(hex(borde), hex('surface'))).toBeGreaterThanOrEqual(3)
      })
    }
  }
})
