// Piezas chicas de interfaz para Cargar y Datos: botones con tocables de 44 px
// (D-30, D-100), campos con su error al lado y chips de estado (tinta neutra o
// azul para los estados de datos, HO-4; rojo solo para lo que frena).

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { forwardRef } from 'react'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'suave'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-accent text-on-accent hover:bg-accent-strong',
  secundario: 'border border-border bg-surface text-text hover:bg-surface-2',
  fantasma: 'text-muted hover:bg-surface-2 hover:text-text',
  suave: 'bg-accent-soft text-accent hover:brightness-95',
}

export function clasesBoton(variante: Variante = 'secundario', extra = ''): string {
  return `tocable inline-flex min-h-11 lg:min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${extra}`
}

export const Boton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }>(
  function Boton({ variante = 'secundario', className = '', type = 'button', ...resto }, ref) {
    return <button ref={ref} type={type} className={clasesBoton(variante, className)} {...resto} />
  },
)

export const CLASE_CAMPO =
  'min-h-11 lg:min-h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-base text-text outline-none placeholder:text-faint focus:border-accent aria-[invalid=true]:border-negative'

export function Campo({
  etiqueta,
  error,
  ayuda,
  children,
  htmlFor,
  className = '',
}: {
  etiqueta: ReactNode
  error?: string | null
  ayuda?: ReactNode
  children: ReactNode
  htmlFor: string
  className?: string
}) {
  return (
    <div className={`min-w-0 space-y-1 ${className}`}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text">
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-negative">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-xs text-muted">{ayuda}</p>
      ) : null}
    </div>
  )
}

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalido?: boolean }>(
  function Entrada({ className = '', invalido, id, ...resto }, ref) {
    return (
      <input
        ref={ref}
        id={id}
        aria-invalid={invalido ? true : undefined}
        aria-describedby={invalido && id ? `${id}-error` : undefined}
        className={`${CLASE_CAMPO} ${className}`}
        {...resto}
      />
    )
  },
)

export function Selector({ className = '', invalido, id, children, ...resto }: SelectHTMLAttributes<HTMLSelectElement> & { invalido?: boolean }) {
  return (
    <select
      id={id}
      aria-invalid={invalido ? true : undefined}
      aria-describedby={invalido && id ? `${id}-error` : undefined}
      className={`${CLASE_CAMPO} ${className}`}
      {...resto}
    >
      {children}
    </select>
  )
}

export type TonoChip = 'neutro' | 'azul' | 'aviso' | 'error'

const TONOS: Record<TonoChip, string> = {
  neutro: 'bg-surface-3 text-muted',
  azul: 'bg-accent-soft text-accent',
  aviso: 'bg-warn-soft text-warn',
  error: 'bg-negative-soft text-negative',
}

export function Chip({ tono = 'neutro', children, className = '' }: { tono?: TonoChip; children: ReactNode; className?: string }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${TONOS[tono]} ${className}`}>{children}</span>
}

/** Aviso de una línea o un bloque (demo, sin base, errores). */
export function Aviso({ tono = 'neutro', children, className = '' }: { tono?: TonoChip; children: ReactNode; className?: string }) {
  const borde = tono === 'error' ? 'border-negative/30' : tono === 'aviso' ? 'border-warn/30' : 'border-border'
  return (
    <div role={tono === 'error' ? 'alert' : 'status'} className={`rounded-xl border ${borde} ${TONOS[tono]} px-3 py-2 text-sm ${className}`}>
      {children}
    </div>
  )
}
