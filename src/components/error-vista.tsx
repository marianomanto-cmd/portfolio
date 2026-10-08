import { DatabaseZap, TriangleAlert } from 'lucide-react'
import { FaltaConfiguracion } from '@/lib/server/supabase'
import { BotonReintentar } from './reintentar'

function faltaConfig(e: unknown): string | null {
  if (e instanceof FaltaConfiguracion) return e.variable
  if (e instanceof Error && /Falta la variable de entorno (\S+)/.test(e.message)) return e.message.split(' ').at(-1) ?? null
  return null
}

/**
 * Nunca una pantalla en blanco (calidad.md §5): si falta configurar la base,
 * dice qué hacer; si es otro error, lo muestra con su mensaje.
 */
export function ErrorVista({ error, que = 'los datos' }: { error: unknown; que?: string }) {
  const variable = faltaConfig(error)
  if (variable) {
    return (
      <section className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow)] md:p-6" aria-labelledby="falta-config">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <DatabaseZap aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 space-y-2">
            <h2 id="falta-config" className="text-lg font-semibold">
              Falta configurar la base: {variable} en Vercel
            </h2>
            <p className="text-sm text-muted">
              La app no encuentra la clave secreta de Supabase, así que no puede leer tus datos. No muestra ceros: espera a la base.
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>En Vercel, abrí el proyecto <span className="font-medium">portfolio</span> → Settings → Environment Variables.</li>
              <li>
                Agregá <code className="rounded bg-surface-2 px-1 font-mono text-[13px]">{variable}</code> con la clave secreta (service_role) del proyecto
                Portfolio de Supabase, solo para Production.
              </li>
              <li>Volvé a desplegar. La clave nunca llega al navegador: solo la usa el servidor.</li>
            </ol>
          </div>
        </div>
      </section>
    )
  }
  const mensaje = error instanceof Error ? error.message : String(error)
  return (
    <section role="alert" className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow)] md:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-warn-soft text-warn">
          <TriangleAlert aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 space-y-2">
          <h2 className="text-lg font-semibold">No pude leer {que}</h2>
          <p className="break-words font-mono text-[13px] text-muted">{mensaje}</p>
          <p className="text-sm text-muted">Nada se guardó ni se cambió. Probá de nuevo; si sigue, el detalle de arriba dice qué falló.</p>
          <BotonReintentar />
        </div>
      </div>
    </section>
  )
}
