import { LogOut } from 'lucide-react'
import type { Metadata } from 'next'
import { modoDemo } from '@/lib/server/sesion'
import { FormularioPreferencias } from '@/components/ajustes/formulario'
import { Tarjeta } from '@/components/ui'
import { cerrarSesion } from './acciones'

export const metadata: Metadata = { title: 'Ajustes' }

const ATAJOS: [string, string][] = [
  ['c', 'Abrir Cargar'],
  ['h', 'Modo privado'],
  ['Tab · Enter', 'En Cargar: pasar de campo y guardar'],
]

export default function PaginaAjustes() {
  const demo = modoDemo()
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <h1 className="sr-only">Ajustes</h1>
      <FormularioPreferencias />

      <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
        <Tarjeta className="p-4 md:p-6" aria-labelledby="atajos">
          <h2 id="atajos" className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Teclado
          </h2>
          <dl className="divide-y divide-border">
            {ATAJOS.map(([k, d]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-2 text-sm">
                <dt className="text-muted">{d}</dt>
                <dd>
                  <kbd className="rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-[13px]">{k}</kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[13px] text-muted">Las teclas de una letra andan solo si ningún campo tiene el foco.</p>
        </Tarjeta>

        <Tarjeta className="p-4 md:p-6" aria-labelledby="sesion">
          <h2 id="sesion" className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Sesión
          </h2>
          <p className="text-sm text-muted">
            {demo
              ? 'Estás en modo demo: datos de ejemplo inventados y sin clave. Nada de lo que hagas acá toca la base.'
              : 'La sesión dura 30 días en este dispositivo. La clave nunca viaja guardada: solo una firma.'}
          </p>
          <form action={cerrarSesion} className="mt-4">
            <button
              type="submit"
              className="tocable inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"
            >
              <LogOut aria-hidden className="size-4" /> Cerrar sesión
            </button>
          </form>
        </Tarjeta>
      </div>
    </div>
  )
}
