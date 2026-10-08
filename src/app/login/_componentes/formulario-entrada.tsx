'use client'

import { useActionState } from 'react'
import { LockKeyhole, LogIn } from 'lucide-react'
import { entrar, type EstadoEntrada } from '../acciones'

const INICIAL: EstadoEntrada = { error: null }

export function FormularioEntrada({ desde, demo }: { desde: string; demo: boolean }) {
  const [estado, accion, enviando] = useActionState(entrar, INICIAL)
  return (
    <form action={accion} className="space-y-4" noValidate>
      <input type="hidden" name="desde" value={desde} />
      {demo ? null : (
        <div className="space-y-1.5">
          <label htmlFor="clave" className="block text-sm font-medium text-text">
            Clave
          </label>
          <div className="relative">
            <LockKeyhole
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
            />
            <input
              id="clave"
              name="clave"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              enterKeyHint="go"
              aria-invalid={estado.error ? true : undefined}
              aria-describedby={estado.error ? 'error-clave' : undefined}
              className="min-h-11 w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-base text-text outline-none focus:border-accent"
            />
          </div>
        </div>
      )}
      {estado.error ? (
        <p id="error-clave" role="alert" className="rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative">
          {estado.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={enviando}
        className="tocable flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-60"
      >
        <LogIn aria-hidden className="size-4" />
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
