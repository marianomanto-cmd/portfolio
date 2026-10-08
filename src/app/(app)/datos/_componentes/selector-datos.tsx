'use client'

// "Datos · Catálogo ▾": el título es el selector de subpantalla (3.2 de la
// visión: sin pestañas horizontales). En el teléfono abre una hoja inferior.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export const SUBPANTALLAS = [
  { href: '/datos/catalogo', nombre: 'Catálogo', descripcion: 'Activos: tipo, moneda de riesgo, geografía, ratio y color' },
  { href: '/datos/cuentas', nombre: 'Cuentas', descripcion: 'IEB, Galicia y Mercado Pago' },
  { href: '/datos/bienes', nombre: 'Bienes', descripcion: 'Casa y camioneta, con valuaciones fechadas' },
  { href: '/datos/leasing', nombre: 'Leasing', descripcion: 'Contrato y capital pendiente informado' },
] as const

export function SelectorDatos() {
  const ruta = usePathname() ?? ''
  const actual = SUBPANTALLAS.find((s) => ruta.startsWith(s.href)) ?? SUBPANTALLAS[0]
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => setAbierto(false), [ruta])
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent | TouchEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', fuera)
    document.addEventListener('touchstart', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('touchstart', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="tocable -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-left hover:bg-surface-2"
      >
        <span className="text-base font-semibold text-muted md:text-lg">Datos ·</span>
        <span className="text-base font-semibold text-text md:text-lg">{actual.nombre}</span>
        <ChevronDown aria-hidden className={`size-4 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 md:hidden" aria-hidden onClick={() => setAbierto(false)} />
          <nav
            aria-label="Subpantallas de Datos"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:mt-1 md:w-96 md:rounded-xl md:border md:pb-3"
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded bg-border-strong md:hidden" />
            <ul className="space-y-1">
              {SUBPANTALLAS.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    aria-current={s.href === actual.href ? 'page' : undefined}
                    className="tocable flex min-h-11 items-start gap-3 rounded-lg px-3 py-2 hover:bg-surface-2"
                    onClick={() => setAbierto(false)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-text">{s.nombre}</span>
                      <span className="block text-sm text-muted">{s.descripcion}</span>
                    </span>
                    {s.href === actual.href ? <Check aria-hidden className="mt-1 size-4 shrink-0 text-accent" /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      ) : null}
    </div>
  )
}
