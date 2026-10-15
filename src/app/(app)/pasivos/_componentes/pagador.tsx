'use client'

import { useActionState, useState } from 'react'
import { guardarDatoPasivo, type EstadoDato } from '../acciones'
import { eleccionMostrada } from '../_lib/eleccion'

/**
 * Una elección de un toque que se guarda en el contrato: quién paga la cuota
 * (Flujo lo necesita) o si la empresa te reintegra el IVA. Sin declarar no se
 * supone nada.
 */
export function ElegirDato({
  pasivoId,
  campo,
  pregunta,
  opciones,
  actual,
}: {
  pasivoId: number
  campo: 'pagador_habitual' | 'reintegra_iva'
  pregunta: string
  opciones: { valor: string; nombre: string }[]
  actual: string | null
}) {
  const [estado, enviar, enviando] = useActionState<EstadoDato | null, FormData>(guardarDatoPasivo, null)
  const [tocada, setTocada] = useState<string | null>(null)
  // Marcada, la guardada: si guardar falla, no queda elegida la que tocaste.
  const elegido = eleccionMostrada({ guardada: actual, tocada, estado, enviando })
  return (
    <form action={enviar} className="min-w-0 space-y-1">
      <input type="hidden" name="pasivo_id" value={pasivoId} />
      <input type="hidden" name="campo" value={campo} />
      <p className="text-sm text-text">
        {pregunta} <span className="text-muted">{elegido === null ? 'sin declarar' : ''}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="submit"
            name="valor"
            value={o.valor}
            disabled={enviando}
            aria-pressed={elegido === o.valor}
            onClick={() => setTocada(o.valor)}
            className={`tocable min-h-11 rounded-lg border px-3 text-sm font-medium lg:min-h-9 ${
              elegido === o.valor ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text hover:bg-surface-2'
            }`}
          >
            {o.nombre}
          </button>
        ))}
      </div>
      {estado ? (
        <p role="status" className={`text-xs ${estado.ok ? 'text-muted' : 'text-negative'}`}>
          {estado.mensaje}
        </p>
      ) : null}
    </form>
  )
}
