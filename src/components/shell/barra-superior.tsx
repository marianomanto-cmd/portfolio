'use client'

import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { cambiarPreferencia, usePreferencias } from '@/components/preferencias'
import { clasesBoton } from '@/components/ui'
import { CARGAR, seccionActiva } from './secciones'

// La barra superior (D-156): sticky, 60 px (52 en el teléfono), vidrio sobre
// el fondo. De izquierda a derecha: el nombre de la pantalla con su
// descripción, el chip de estado de los datos, el ojo del modo privado y
// Cargar (botón primario, atajo C, con el punto de "falta cargar"). En el
// teléfono, Cargar está en el centro de la barra inferior.

/** Nombre de la pantalla (Geist 15/500) y su descripción (12 px, una línea con puntos suspensivos). */
export function TituloSeccion() {
  const s = seccionActiva(usePathname() ?? '/')
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      <p className="truncate text-[15px] font-medium leading-tight">{s?.nombre ?? 'Portfolio'}</p>
      {s?.descripcion ? <p className="hidden truncate text-[12px] leading-snug text-muted sm:block">{s.descripcion}</p> : null}
    </div>
  )
}

/** El ojo del modo privado: un círculo de 36 px con borde (44 px con el dedo). Atajo: h. */
export function BotonPrivado() {
  const { privado } = usePreferencias()
  return (
    <button
      type="button"
      className="tocable grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted transition-colors hover:border-border-strong hover:text-text max-md:size-11"
      onClick={() => cambiarPreferencia('privado', !privado)}
      aria-pressed={privado}
      aria-label={privado ? 'Mostrar los montos' : 'Ocultar los montos (modo privado)'}
      title={privado ? 'Mostrar montos (h)' : 'Ocultar montos (h)'}
    >
      {privado ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
    </button>
  )
}

/** Cargar: el botón primario de la barra superior, con su atajo y el punto de "falta cargar". */
export function BotonCargar({ puntoCarga }: { puntoCarga?: ReactNode }) {
  const actual = (usePathname() ?? '/') === CARGAR.href
  return (
    <Link
      href={CARGAR.href}
      aria-label="Cargar los datos de hoy"
      aria-current={actual ? 'page' : undefined}
      title="Cargar (c)"
      className={`${clasesBoton('primario', 'sm')} relative shrink-0 max-md:hidden`}
    >
      Cargar
      <span aria-hidden className="opacity-60">
        C
      </span>
      {puntoCarga ? <span className="absolute -right-0.5 -top-0.5">{puntoCarga}</span> : null}
    </Link>
  )
}

/** Teclado (CA-8): `c` abre Cargar y `h` el modo privado, si ningún campo tiene el foco. */
export function Atajos() {
  const router = useRouter()
  const { privado } = usePreferencias()
  useEffect(() => {
    // Marca para los tests de layout: la página ya hidrató.
    document.documentElement.setAttribute('data-hidratado', '1')
  }, [])
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (document.querySelector('dialog[open]')) return
      const k = e.key.toLowerCase()
      if (k === 'c') router.push(CARGAR.href)
      else if (k === 'h') cambiarPreferencia('privado', !privado)
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [router, privado])
  return null
}
