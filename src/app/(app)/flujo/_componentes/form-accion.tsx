'use client'

// Un formulario chico de Flujo con useActionState: el mensaje del servidor
// queda a la vista y un error de validación no borra lo tipeado (se envía con
// onSubmit, no con `action`, porque React 19 vacía los campos después de una
// acción). Después de un guardado bien hecho, `vez` sube y quien lo usa puede
// limpiarse.

import { startTransition, useActionState, type ReactNode } from 'react'
import { clasesBoton } from '@/components/ui'
import type { EstadoFlujo } from '../acciones'

const INICIAL: EstadoFlujo = { ok: null, mensaje: null, errores: {}, vez: 0 }

export function FormAccion({
  accion,
  boton,
  children,
  className = '',
  ocultos = {},
}: {
  accion: (previo: EstadoFlujo, form: FormData) => Promise<EstadoFlujo>
  boton: string
  children: (errores: Record<string, string>) => ReactNode
  className?: string
  ocultos?: Record<string, string>
}) {
  const [estado, despachar, enviando] = useActionState(accion, INICIAL)
  return (
    <form
      noValidate
      className={`space-y-3 ${className}`}
      onSubmit={(ev) => {
        ev.preventDefault()
        const fd = new FormData(ev.currentTarget)
        startTransition(() => despachar(fd))
      }}
    >
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div key={estado.vez} className="contents">
        {children(estado.errores)}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={clasesBoton('primario', 'sm')}>
          {enviando ? 'Guardando…' : boton}
        </button>
        {estado.mensaje ? (
          <p role="status" className={`min-w-0 text-sm ${estado.ok ? 'text-text' : 'text-negative'}`}>
            {estado.mensaje}
          </p>
        ) : null}
      </div>
    </form>
  )
}

export const CAMPO = 'tocable min-h-10 w-full min-w-0 rounded-item border border-border-strong bg-surface-2 px-3 text-base text-text placeholder:text-faint md:text-sm'

export function Campo({ etiqueta, error, children, htmlFor }: { etiqueta: string; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="text-[13px] text-muted">
        {etiqueta}
      </label>
      <div className="mt-1">{children}</div>
      {error ? <p className="mt-1 text-sm text-negative">{error}</p> : null}
    </div>
  )
}
