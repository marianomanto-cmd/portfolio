import { ArrowRight, House } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Marco } from '@/components/shell/marco'

// Toda dirección que no existe (y todo notFound()): en español, dentro del
// marco de la app y con un camino de vuelta. Va en la raíz y no en (app) a
// propósito: el layout de (app) lee la base, y una ruta que el proxy deja
// pasar sin sesión (/login/…, /icons/…) no tiene que leerla (arquitectura,
// "Trampas conocidas"). El marco no lee nada: sin estado de los datos.

export const metadata: Metadata = { title: 'No encontré esa página' }

export default function NoEncontrada() {
  return (
    <Marco>
      <section className="max-w-[60ch] rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow)] md:p-8">
        <h1 className="text-lg font-semibold">No encontré esa página</h1>
        <p className="mt-1 text-sm text-muted">
          Puede que la dirección esté mal escrita o que esa sección todavía no exista en esta fase.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/"
            className="tocable inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong"
          >
            <House aria-hidden className="size-4" /> Ir a Hoy
          </Link>
          <Link
            href="/cartera"
            className="tocable inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2"
          >
            Ver la cartera <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>
    </Marco>
  )
}
