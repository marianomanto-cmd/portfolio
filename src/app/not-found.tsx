import { ArrowRight, House } from 'lucide-react'
import type { Metadata } from 'next'
import { Marco } from '@/components/shell/marco'
import { Boton } from '@/components/ui'

// Toda dirección que no existe (y todo notFound()): en español, dentro del
// marco de la app y con un camino de vuelta. Va en la raíz y no en (app) a
// propósito: el layout de (app) lee la base, y una ruta que el proxy deja
// pasar sin sesión (/login/…, /icons/…) no tiene que leerla (arquitectura,
// "Trampas conocidas"). El marco no lee nada: sin estado de los datos.

export const metadata: Metadata = { title: 'No encontré esa página' }

export default function NoEncontrada() {
  return (
    <Marco>
      <section className="max-w-[60ch] rounded-tarjeta border border-border bg-surface p-5 md:p-8">
        <p className="eyebrow">Error 404 · ¿Dónde estoy?</p>
        <h1 className="lectura mt-3 text-[clamp(26px,5vw,34px)]">No encontré esa página</h1>
        <p className="mt-3 text-sm text-muted">
          Puede que la dirección esté mal escrita o que esa sección todavía no exista en esta fase.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Boton href="/" tam="sm" aria-label="Ir a Hoy">
            <House aria-hidden className="size-4" /> Ir a Hoy
          </Boton>
          <Boton href="/cartera" variante="contorno" tam="sm">
            Ver tus posiciones <ArrowRight aria-hidden className="size-4" />
          </Boton>
        </div>
      </section>
    </Marco>
  )
}
