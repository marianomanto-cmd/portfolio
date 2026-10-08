'use client'

import { Undo2, X } from 'lucide-react'
import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { MOTIVOS, type EstadoReversion } from './motivos'

type Accion = (previo: EstadoReversion | null, datos: FormData) => Promise<EstadoReversion>

/**
 * Revertir el lote (visión §4.3): pide el motivo (una opción; "otro" pide el
 * texto) y confirma. La carga no desaparece del Registro: queda revertida.
 */
export function RevertirLote({ lote, resumen, accion }: { lote: string; resumen: string; accion: Accion }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [estado, enviar, pendiente] = useActionState(accion, null)
  const [motivo, setMotivo] = useState<string>('')
  const id = useId()

  useEffect(() => {
    if (estado?.ok) dialogo.current?.close()
  }, [estado])

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => {
          setMotivo('')
          dialogo.current?.showModal()
        }}
        className="tocable inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text hover:border-border-strong hover:bg-surface-2"
      >
        <Undo2 aria-hidden className="size-4" /> Revertir el lote
      </button>
      {estado ? (
        <p role="status" className={`text-[13px] ${estado.ok ? 'text-muted' : 'text-negative'}`}>
          {estado.mensaje}
        </p>
      ) : null}

      <dialog
        ref={dialogo}
        aria-labelledby={`${id}-t`}
        className="hoja m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-text shadow-lg max-md:mb-0 max-md:w-full max-md:rounded-b-none"
      >
        <form action={enviar} className="flex flex-col gap-4 p-5">
          <input type="hidden" name="lote" value={lote} />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={`${id}-t`} className="text-base font-semibold">
                Revertir el lote
              </h2>
              <p className="mt-1 text-sm text-muted">{resumen}</p>
            </div>
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              aria-label="Cerrar"
              className="tocable grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <p className="text-sm">
            Se borran sus filas y se restaura lo que pisaron. Cada carga queda en el Registro, marcada como revertida, con el motivo. Si algo
            posterior depende de este lote, la base no lo revierte y te dice qué.
          </p>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">Motivo</legend>
            {MOTIVOS.map((m) => (
              <label key={m} className="tocable flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-2">
                <input type="radio" name="motivo" value={m} required checked={motivo === m} onChange={() => setMotivo(m)} className="size-4 accent-[var(--accent)]" />
                <span className="text-sm">{m[0].toUpperCase() + m.slice(1)}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-d`} className="text-sm font-medium">
              Detalle {motivo === 'otro' ? '(obligatorio)' : '(opcional)'}
            </label>
            <textarea
              id={`${id}-d`}
              name="detalle"
              rows={2}
              maxLength={300}
              required={motivo === 'otro'}
              minLength={motivo === 'otro' ? 3 : undefined}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>
          {estado && !estado.ok ? (
            <p role="alert" className="rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative">
              {estado.mensaje}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="tocable inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pendiente || !motivo}
              className="tocable inline-flex h-10 items-center justify-center rounded-lg bg-negative px-4 text-sm font-semibold text-on-accent hover:opacity-90 disabled:opacity-50"
            >
              {pendiente ? 'Revirtiendo…' : 'Revertir el lote'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
