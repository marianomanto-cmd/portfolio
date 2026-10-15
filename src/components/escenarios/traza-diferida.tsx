'use client'

// Una cifra de la proyección con su traza A PEDIDO (plan §6 D.2: proyectar()
// no arma trazas; trazaMes() la arma al tocar). Mismo aspecto y mismo panel
// que la Traza de siempre (components/traza.tsx): en el teléfono, una hoja
// inferior; en desktop, un panel anclado que no se sale de la pantalla.

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { CalcVista } from '@/lib/domain/calc'
import { PanelTraza } from '@/components/traza'

export function TrazaDiferida({
  obtener,
  titulo,
  moneda,
  children,
  className = '',
}: {
  /** Arma la traza (se llama recién al abrir). */
  obtener: () => CalcVista
  titulo: string
  moneda?: 'ARS' | 'USD'
  children: ReactNode
  className?: string
}) {
  const [calc, setCalc] = useState<CalcVista | null>(null)
  const [esMovil, setEsMovil] = useState(false)
  const raiz = useRef<HTMLSpanElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const abierto = calc !== null

  useLayoutEffect(() => {
    const el = panel.current
    if (!abierto || esMovil || !el) return
    el.style.transform = ''
    el.style.top = ''
    el.style.bottom = ''
    const r = el.getBoundingClientRect()
    const margen = 8
    const ancho = document.documentElement.clientWidth
    let dx = 0
    if (r.right > ancho - margen) dx = ancho - margen - r.right
    if (r.left + dx < margen) dx = margen - r.left
    if (dx) el.style.transform = `translateX(${Math.round(dx)}px)`
    if (r.bottom > window.innerHeight - margen && r.height < (raiz.current?.getBoundingClientRect().top ?? 0) - margen) {
      el.style.top = 'auto'
      el.style.bottom = '100%'
    }
  }, [abierto, esMovil])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const f = () => setEsMovil(mq.matches)
    f()
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent | TouchEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setCalc(null)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setCalc(null)
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('touchstart', cerrar)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('touchstart', cerrar)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  return (
    <span ref={raiz} className={`relative inline-flex max-w-full ${className}`}>
      <button
        type="button"
        className="tocable inline-flex max-w-full items-center rounded text-left decoration-dotted underline-offset-4 hover:underline"
        aria-expanded={abierto}
        aria-controls={id}
        data-cifra=""
        onClick={() => setCalc((c) => (c ? null : obtener()))}
      >
        {children}
      </button>
      {calc ? (
        esMovil ? (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/30"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setCalc(null)
            }}
          >
            <div
              id={id}
              role="dialog"
              aria-label={titulo}
              className="max-h-[80svh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-left font-sans text-base font-normal normal-case tracking-normal whitespace-normal text-text shadow-lg"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded bg-border-strong" />
              <PanelTraza calc={calc} titulo={titulo} moneda={moneda} />
              <button type="button" className="tocable mt-3 w-full rounded-lg border border-border py-2 text-sm" onClick={() => setCalc(null)}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={titulo}
            className="absolute left-0 top-full z-50 mt-1 w-[min(28rem,80vw)] rounded-xl border border-border bg-surface p-3 text-left font-sans text-base font-normal normal-case tracking-normal whitespace-normal text-text shadow-lg"
          >
            <PanelTraza calc={calc} titulo={titulo} moneda={moneda} />
          </div>
        )
      ) : null}
    </span>
  )
}
