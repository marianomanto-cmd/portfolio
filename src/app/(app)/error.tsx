'use client'

import { TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { BotonReintentar } from '@/components/reintentar'

// Nunca una pantalla en blanco (calidad.md §5). Las pantallas atajan sus
// propios errores de datos; esto es la red de abajo de todo.
export default function ErrorApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  const falta = /SUPABASE_SECRET_KEY|Falta la variable de entorno/.test(error.message)
  // En producción Next no manda al navegador el mensaje de un error del
  // servidor (puede tener datos): queda en los registros de Vercel con su referencia.
  const oculto = !error.message || /omitted in production builds/.test(error.message)
  const detalle = oculto ? 'El detalle quedó en los registros del servidor (Vercel → Logs).' : error.message
  return (
    <section role="alert" className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow)] md:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-warn-soft text-warn">
          <TriangleAlert aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 space-y-2">
          <h1 className="text-lg font-semibold">{falta ? 'Falta configurar la base: SUPABASE_SECRET_KEY en Vercel' : 'Algo falló al mostrar esta pantalla'}</h1>
          <p className={`break-words text-[13px] text-muted ${oculto ? '' : 'font-mono'}`}>
            {detalle}
            {error.digest ? ` Referencia: ${error.digest}.` : ''}
          </p>
          <p className="text-sm text-muted">Nada se guardó ni se cambió.</p>
          <div className="flex flex-wrap gap-2">
            <BotonReintentar onReintentar={reset} />
            <Link href="/" className="tocable inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-accent hover:bg-surface-2">
              Ir a Hoy
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
