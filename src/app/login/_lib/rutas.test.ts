import { describe, expect, it } from 'vitest'
import { destinoSeguro, esRutaPublica, urlDeEntrada } from './rutas'

describe('esRutaPublica', () => {
  it('deja pasar la entrada y los estáticos', () => {
    for (const r of [
      '/login',
      '/login/',
      '/_next/static/chunks/app.js',
      '/_next/image',
      '/favicon.ico',
      '/icon.png',
      '/icon0.svg',
      '/apple-icon.png',
      '/icons/192.png',
      '/manifest.webmanifest',
      '/manifest.json',
    ]) {
      expect(esRutaPublica(r), r).toBe(true)
    }
  })

  it('protege todo lo demás', () => {
    for (const r of [
      '/',
      '/carga',
      '/carga/leer',
      '/datos/catalogo',
      '/loginx',
      '/registro',
      '/api/algo',
      '/iconos-falsos/x',
      '/iconos',
      '/icon.png/x',
      '/_nextx',
      '/favicon.ico/x',
    ]) {
      expect(esRutaPublica(r), r).toBe(false)
    }
  })
})

describe('destinoSeguro', () => {
  it('acepta rutas internas con su búsqueda', () => {
    expect(destinoSeguro('/carga')).toBe('/carga')
    expect(destinoSeguro('/datos/bienes?x=1')).toBe('/datos/bienes?x=1')
    // "//" en la búsqueda no es una ruta: queda.
    expect(destinoSeguro('/carga?nota=a//b')).toBe('/carga?nota=a//b')
  })

  it('manda a Hoy lo vacío, lo externo y la propia entrada', () => {
    for (const d of [
      null,
      undefined,
      '',
      'carga',
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      '/login',
      '/login?desde=/x',
      '/a\nb',
      '/a\tb',
      '/..//evil.com',
      '/carga//x',
      '/carga\\..\\x',
      `/${'x'.repeat(3000)}`,
      '\\\\evil.com',
      ' //evil.com',
    ]) {
      expect(destinoSeguro(d), String(d)).toBe('/')
    }
  })
})

describe('urlDeEntrada', () => {
  it('recuerda adónde ibas', () => {
    expect(urlDeEntrada('/carga')).toBe('/login?desde=%2Fcarga')
    expect(urlDeEntrada('/datos/bienes', '?x=1')).toBe('/login?desde=%2Fdatos%2Fbienes%3Fx%3D1')
  })
  it('sin desde para Hoy', () => {
    expect(urlDeEntrada('/')).toBe('/login')
  })
})
