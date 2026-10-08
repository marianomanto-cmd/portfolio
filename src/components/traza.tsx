'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { CalcVista, InsumoVista } from '@/lib/domain/calc'
import { monto, numero, porcentaje } from '@/lib/domain/dinero'

// Traza (spec, "requisito no negociable"; CO-1). Tocar cualquier cifra abre un
// panel: la fórmula con los valores reales, los insumos de a un nivel hasta la
// carga y el archivo, y "¿Qué es esto?". En el teléfono es una hoja inferior
// que entra en 360 px; en desktop, un panel anclado a la cifra.

const NOMBRE_ETIQUETA: Record<string, string> = {
  viejo: 'viejo',
  declarado: 'declarado',
  inferido: 'inferido',
  pendiente: 'pendiente',
  parcial: 'suma parcial',
}

function formatearInsumo(i: InsumoVista): string {
  if (i.valor === null) return 'sin dato'
  switch (i.unidad) {
    case 'ARS':
      return monto(i.valor, 'ARS', { decimales: 2 })
    case 'USD':
      return monto(i.valor, 'USD', { decimales: 2 })
    case 'cantidad':
      return numero(i.valor, 4, { min: 0 })
    case 'ratio':
      return numero(i.valor, 6, { min: 0 })
    case 'fraccion':
      return porcentaje(i.valor)
    default:
      return i.valor
  }
}

/** El símbolo de la moneda no se separa de su número al cortar el renglón. */
function sinCorte(f: string): string {
  return f.replace(/(US\$|\$) (?=[\d−-])/g, (_, simbolo: string) => `${simbolo}\u00A0`)
}

function Insumos({ insumos, nivel }: { insumos: InsumoVista[]; nivel: number }) {
  return (
    <ul className={nivel > 0 ? 'mt-1 border-l border-border pl-3' : 'mt-1'}>
      {insumos.map((i, k) => (
        <InsumoItem key={k} insumo={i} nivel={nivel} />
      ))}
    </ul>
  )
}

function InsumoItem({ insumo, nivel }: { insumo: InsumoVista; nivel: number }) {
  const [abierto, setAbierto] = useState(false)
  const tieneDetalle = Boolean(insumo.calc && (insumo.calc.insumos.length || insumo.calc.formula))
  return (
    <li className="py-1 text-sm">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className="text-muted">{insumo.nombre}</span>
        <span className="num text-text">{formatearInsumo(insumo)}</span>
        {insumo.origen ? (
          <span className="text-xs text-muted">
            carga #{insumo.origen.carga_id}
            {insumo.origen.lugar ? ` · ${insumo.origen.lugar}` : ''}
          </span>
        ) : null}
        {tieneDetalle ? (
          <button
            type="button"
            className="tocable text-xs text-accent underline-offset-2 hover:underline"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
          >
            {abierto ? 'ocultar' : 'ver cálculo ▸'}
          </button>
        ) : null}
      </div>
      {abierto && insumo.calc ? (
        <div className="mt-1 border-l border-border pl-3">
          <p className="num break-words text-xs text-text">{sinCorte(insumo.calc.formula)}</p>
          {insumo.calc.insumos.length ? (
            <Insumos insumos={insumo.calc.insumos} nivel={nivel + 1} />
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

export function PanelTraza({
  calc,
  titulo,
  moneda,
}: {
  calc: CalcVista
  titulo: string
  moneda?: 'ARS' | 'USD'
}) {
  const [verInsumos, setVerInsumos] = useState(false)
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text">{titulo}</p>
      {calc.valor === null ? (
        <p className="text-sm text-muted">
          <span className="font-medium text-text">Sin dato.</span> {calc.motivo}
        </p>
      ) : (
        <p className="num break-words text-sm text-text">
          {sinCorte(calc.formula)}
          {moneda && !calc.formula.includes('=') ? ` = ${monto(calc.valor, moneda, { decimales: 2 })}` : ''}
        </p>
      )}
      {calc.etiquetas.length ? (
        <div className="flex flex-wrap gap-1">
          {calc.etiquetas.map((e) => (
            <span key={e} className="rounded bg-surface-3 px-1.5 py-0.5 text-xs text-muted">
              {NOMBRE_ETIQUETA[e] ?? e}
            </span>
          ))}
        </div>
      ) : null}
      {calc.insumos.length ? (
        <div>
          <button
            type="button"
            className="tocable text-sm text-accent underline-offset-2 hover:underline"
            onClick={() => setVerInsumos((v) => !v)}
            aria-expanded={verInsumos}
          >
            {verInsumos ? 'Ocultar insumos' : 'Ver insumos ▸'}
          </button>
          {verInsumos ? <Insumos insumos={calc.insumos} nivel={0} /> : null}
        </div>
      ) : null}
      {calc.explicacion ? (
        <p className="border-t border-border pt-2 text-xs text-muted">
          <span className="font-medium text-text">¿Qué es esto?</span> {calc.explicacion}
        </p>
      ) : null}
      {calc.valor !== null ? (
        <button
          type="button"
          className="tocable text-xs text-muted hover:text-text"
          onClick={() => navigator.clipboard?.writeText(calc.valor ?? '')}
        >
          Copiar valor exacto
        </button>
      ) : null}
    </div>
  )
}

export function Traza({
  calc,
  titulo,
  moneda,
  children,
}: {
  calc: CalcVista
  titulo: string
  moneda?: 'ARS' | 'USD'
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const [esMovil, setEsMovil] = useState(false)
  const raiz = useRef<HTMLSpanElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()

  // En desktop el panel se ancla a la cifra, pero nunca se sale de la pantalla:
  // si no entra a la derecha se corre a la izquierda, y si no entra abajo, se
  // abre hacia arriba.
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
    const alto = window.innerHeight
    if (r.bottom > alto - margen && r.height < (raiz.current?.getBoundingClientRect().top ?? 0) - margen) {
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
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
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
    <span ref={raiz} className="relative inline-flex max-w-full">
      <button
        type="button"
        className="tocable inline-flex max-w-full items-center rounded text-left decoration-dotted underline-offset-4 hover:underline"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
      >
        {children}
      </button>
      {abierto ? (
        esMovil ? (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/30"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAbierto(false)
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
              <button
                type="button"
                className="tocable mt-3 w-full rounded-lg border border-border py-2 text-sm"
                onClick={() => setAbierto(false)}
              >
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
