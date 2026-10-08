'use client'

import { useSyncExternalStore } from 'react'

// Preferencias del dispositivo (visión §4.10): tema, paleta daltónica, modo
// privado y barra lateral. La fuente de verdad son los atributos de <html> (los
// aplica el script del layout raíz antes de pintar); localStorage solo las
// recuerda, y si no está disponible (ventana privada, datos bloqueados) todo
// sigue andando en esta pestaña.

export type Tema = 'sistema' | 'claro' | 'oscuro'
export type Paleta = 'normal' | 'daltonica'
export type Nav = 'auto' | 'expandida' | 'colapsada'

export interface Preferencias {
  tema: Tema
  paleta: Paleta
  privado: boolean
  nav: Nav
}

const CLAVE = {
  tema: 'portfolio:tema',
  paleta: 'portfolio:paleta',
  privado: 'portfolio:privado',
  nav: 'portfolio:nav',
} as const

const EVENTO = 'portfolio:preferencias'

const POR_DEFECTO: Preferencias = { tema: 'sistema', paleta: 'normal', privado: false, nav: 'auto' }

function leer(): Preferencias {
  if (typeof document === 'undefined') return POR_DEFECTO
  const d = document.documentElement
  const t = d.getAttribute('data-theme')
  const n = d.getAttribute('data-nav')
  return {
    tema: t === 'light' ? 'claro' : t === 'dark' ? 'oscuro' : 'sistema',
    paleta: d.getAttribute('data-paleta') === 'daltonica' ? 'daltonica' : 'normal',
    privado: d.getAttribute('data-privado') === '1',
    nav: n === 'expandida' || n === 'colapsada' ? n : 'auto',
  }
}

function guardar(clave: string, valor: string | null) {
  try {
    if (valor === null) window.localStorage.removeItem(clave)
    else window.localStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento: la preferencia vale solo para esta pestaña.
  }
}

function attr(nombre: string, valor: string | null) {
  const d = document.documentElement
  if (valor === null) d.removeAttribute(nombre)
  else d.setAttribute(nombre, valor)
}

export function cambiarPreferencia<K extends keyof Preferencias>(k: K, v: Preferencias[K]) {
  switch (k) {
    case 'tema': {
      const t = v as Tema
      attr('data-theme', t === 'claro' ? 'light' : t === 'oscuro' ? 'dark' : null)
      guardar(CLAVE.tema, t === 'sistema' ? null : t)
      break
    }
    case 'paleta':
      attr('data-paleta', v === 'daltonica' ? 'daltonica' : null)
      guardar(CLAVE.paleta, v === 'daltonica' ? 'daltonica' : null)
      break
    case 'privado':
      attr('data-privado', v ? '1' : null)
      guardar(CLAVE.privado, v ? '1' : null)
      break
    case 'nav':
      attr('data-nav', v === 'auto' ? null : (v as string))
      guardar(CLAVE.nav, v === 'auto' ? null : (v as string))
      break
  }
  window.dispatchEvent(new Event(EVENTO))
}

function suscribir(cb: () => void) {
  window.addEventListener(EVENTO, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENTO, cb)
    window.removeEventListener('storage', cb)
  }
}

// useSyncExternalStore compara por identidad: se cachea el objeto por su firma.
let cache: { firma: string; valor: Preferencias } = { firma: '', valor: POR_DEFECTO }
function instantanea(): Preferencias {
  const p = leer()
  const firma = `${p.tema}|${p.paleta}|${p.privado}|${p.nav}`
  if (firma !== cache.firma) cache = { firma, valor: p }
  return cache.valor
}

export function usePreferencias(): Preferencias {
  return useSyncExternalStore(suscribir, instantanea, () => POR_DEFECTO)
}

/** true cuando el tema efectivo es oscuro (elegido o por el sistema). */
export function temaOscuroEfectivo(p: Preferencias): boolean {
  if (p.tema === 'oscuro') return true
  if (p.tema === 'claro') return false
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

const suscripciones = new Map<string, (cb: () => void) => () => void>()
function suscribirMedia(q: string) {
  let s = suscripciones.get(q)
  if (!s) {
    s = (cb: () => void) => {
      const mq = window.matchMedia(q)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    }
    suscripciones.set(q, s)
  }
  return s
}

/** Media query reactiva; en el servidor devuelve `inicial`. */
export function useMedia(q: string, inicial = false): boolean {
  return useSyncExternalStore(
    suscribirMedia(q),
    () => window.matchMedia(q).matches,
    () => inicial,
  )
}
