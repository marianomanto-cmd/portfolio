'use client'

// Formularios de Datos con useActionState: el mensaje del servidor queda a la
// vista, los errores van al lado de cada campo y, al guardar, el formulario se
// limpia (cambia su key).

import { startTransition, useActionState, type FormEvent, type ReactNode } from 'react'
import type { EstadoFormulario } from '../acciones'

export const ESTADO_INICIAL: EstadoFormulario = { ok: null, mensaje: null, errores: {}, vez: 0 }

type Accion = (previo: EstadoFormulario, form: FormData) => Promise<EstadoFormulario>

/**
 * Se envía con onSubmit y no con `action`: React 19 vacía los campos después de
 * una acción de formulario, y con un error de validación perderías lo tipeado.
 * Al guardar bien, el formulario se limpia cambiando su key (estado.vez).
 */
export function useFormulario(accion: Accion) {
  const [estado, despachar, enviando] = useActionState(accion, ESTADO_INICIAL)
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    startTransition(() => despachar(datos))
  }
  return [estado, enviar, enviando] as const
}

export function Mensaje({ estado }: { estado: EstadoFormulario }) {
  if (!estado.mensaje) return null
  return (
    <p
      role={estado.ok ? 'status' : 'alert'}
      className={`rounded-lg px-3 py-2 text-sm ${estado.ok ? 'bg-accent-soft text-text' : 'bg-negative-soft text-negative'}`}
    >
      {estado.mensaje}
    </p>
  )
}

export function Panel({ titulo, children, acciones }: { titulo: ReactNode; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="min-w-0 text-base font-semibold text-text">{titulo}</h2>
        {acciones ? <div className="ml-auto flex flex-wrap gap-2">{acciones}</div> : null}
      </div>
      {children}
    </section>
  )
}

/** Selector de moneda con dos botones y sin valor por defecto: la elegís vos. */
export function ElegirMoneda({
  nombre,
  valor,
  onCambio,
  leyenda,
  ayuda,
  error,
}: {
  nombre: string
  valor: 'ARS' | 'USD' | ''
  onCambio: (m: 'ARS' | 'USD') => void
  leyenda: string
  ayuda?: string
  error?: string
}) {
  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className="text-sm font-medium text-text">{leyenda}</legend>
      {ayuda ? <p className="text-xs text-muted">{ayuda}</p> : null}
      <input type="hidden" name={nombre} value={valor} />
      <div className="grid grid-cols-2 gap-2">
        {(['ARS', 'USD'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={valor === m}
            onClick={() => onCambio(m)}
            className={`tocable min-h-11 rounded-lg border px-3 text-sm font-medium lg:min-h-10 ${
              valor === m ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text hover:bg-surface-2'
            }`}
          >
            {m === 'ARS' ? 'Pesos' : 'Dólares'}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
    </fieldset>
  )
}
