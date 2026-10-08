import type { NextConfig } from 'next'
import { describe, expect, it } from 'vitest'
import { metodoSeguro, mismoOrigen, nuevoNonce, politicaDeContenido } from './seguridad'

// next.config.mjs es JavaScript (sin tipos): se importa con su forma declarada acá.
type Encabezado = { key: string; value: string }
const configuracion = () =>
  import('../../../../next.config.mjs' as string) as Promise<{ default: NextConfig & { agentRules?: boolean }; ENCABEZADOS_SEGURIDAD: Encabezado[] }>

const h = (o: Record<string, string>) => new Headers(o)

describe('mismoOrigen (CSRF)', () => {
  const host = { host: 'portfolio.example', 'x-forwarded-host': 'portfolio.example' }

  it('deja pasar lo que viene de una página del mismo sitio', () => {
    expect(mismoOrigen(h({ ...host, origin: 'https://portfolio.example', 'sec-fetch-site': 'same-origin' }))).toBe(true)
    expect(mismoOrigen(h({ host: 'localhost:3100', origin: 'http://localhost:3100' }))).toBe(true)
    // Vercel informa el host público en x-forwarded-host.
    expect(mismoOrigen(h({ host: 'interno', 'x-forwarded-host': 'portfolio.example', origin: 'https://portfolio.example' }))).toBe(true)
  })

  it('sin Origin ni Sec-Fetch-Site no es un navegador: pasa (y la sesión se pide igual)', () => {
    expect(mismoOrigen(h(host))).toBe(true)
  })

  it('rechaza otro sitio, otro puerto, otro subdominio y Origin null', () => {
    for (const o of ['https://evil.example', 'https://portfolio.example.evil.example', 'https://x.portfolio.example', 'https://portfolio.example:8443', 'null', 'file://', 'nada']) {
      expect(mismoOrigen(h({ ...host, origin: o })), o).toBe(false)
    }
    expect(mismoOrigen(h({ ...host, 'sec-fetch-site': 'cross-site' }))).toBe(false)
    expect(mismoOrigen(h({ ...host, 'sec-fetch-site': 'same-site', origin: 'https://portfolio.example' }))).toBe(false)
  })

  it('los métodos que no cambian nada no se controlan', () => {
    expect(['GET', 'head', 'OPTIONS'].every(metodoSeguro)).toBe(true)
    expect(['POST', 'PUT', 'PATCH', 'DELETE'].some(metodoSeguro)).toBe(false)
  })
})

describe('Content-Security-Policy', () => {
  it('solo scripts con el nonce del pedido, nada de afuera, sin iframes', () => {
    const p = politicaDeContenido('abc123', false)
    expect(p).toContain(`script-src 'self' 'nonce-abc123' 'strict-dynamic'`)
    expect(p).not.toContain('unsafe-eval')
    expect(p).not.toMatch(/script-src[^;]*unsafe-inline/)
    for (const d of [`default-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`]) {
      expect(p).toContain(d)
    }
    expect(p).not.toMatch(/https?:/)
  })

  it('en desarrollo agrega eval (React lo usa para las pilas de error)', () => {
    expect(politicaDeContenido('n', true)).toContain(`'nonce-n' 'strict-dynamic' 'unsafe-eval'`)
  })

  it('un nonce distinto por pedido, de 128 bits', () => {
    const a = nuevoNonce()
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/)
    expect(new Set(Array.from({ length: 50 }, nuevoNonce)).size).toBe(50)
  })
})

describe('next.config.mjs', () => {
  it('manda los encabezados de seguridad en toda ruta', async () => {
    const { default: nextConfig, ENCABEZADOS_SEGURIDAD } = await configuracion()
    const reglas = await nextConfig.headers!()
    expect(reglas).toEqual([{ source: '/:path*', headers: ENCABEZADOS_SEGURIDAD }])
    const valor = Object.fromEntries(ENCABEZADOS_SEGURIDAD.map((x) => [x.key.toLowerCase(), x.value]))
    expect(valor['x-frame-options']).toBe('DENY')
    expect(valor['x-content-type-options']).toBe('nosniff')
    expect(valor['referrer-policy']).toBe('same-origin')
    expect(valor['permissions-policy']).toMatch(/camera=\(\).*microphone=\(\).*geolocation=\(\)/)
    expect(valor['strict-transport-security']).toMatch(/^max-age=\d{8,}/)
    expect(valor['cross-origin-opener-policy']).toBe('same-origin')
    expect(valor['cross-origin-resource-policy']).toBe('same-origin')
    expect(valor['x-robots-tag']).toBe('noindex, nofollow')
  })

  it('no escribe en CLAUDE.md ni muestra el indicador de desarrollo', async () => {
    const { default: nextConfig } = await configuracion()
    expect(nextConfig.agentRules).toBe(false)
    expect(nextConfig.devIndicators).toBe(false)
    expect(nextConfig.poweredByHeader).toBe(false)
  })
})
