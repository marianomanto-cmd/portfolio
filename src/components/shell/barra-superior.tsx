'use client'

import { Eye, EyeOff, Monitor, Moon, Sun } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { cambiarPreferencia, usePreferencias, type Tema } from '@/components/preferencias'
import { seccionActiva } from './secciones'

export function TituloSeccion() {
  const s = seccionActiva(usePathname() ?? '/')
  return (
    <p className="min-w-0 truncate text-[17px] font-semibold tracking-tight md:text-lg">{s?.nombre ?? 'Portfolio'}</p>
  )
}

const BOTON =
  'tocable grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text max-md:size-11'

export function BotonPrivado() {
  const { privado } = usePreferencias()
  return (
    <button
      type="button"
      className={BOTON}
      onClick={() => cambiarPreferencia('privado', !privado)}
      aria-pressed={privado}
      aria-label={privado ? 'Mostrar los montos' : 'Ocultar los montos (modo privado)'}
      title={privado ? 'Mostrar montos (h)' : 'Ocultar montos (h)'}
    >
      {privado ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
    </button>
  )
}

const SIGUIENTE: Record<Tema, Tema> = { sistema: 'claro', claro: 'oscuro', oscuro: 'sistema' }
const NOMBRE: Record<Tema, string> = { sistema: 'el del sistema', claro: 'claro', oscuro: 'oscuro' }

export function BotonTema() {
  const { tema } = usePreferencias()
  const Icono = tema === 'claro' ? Sun : tema === 'oscuro' ? Moon : Monitor
  return (
    <button
      type="button"
      className={BOTON}
      onClick={() => cambiarPreferencia('tema', SIGUIENTE[tema])}
      aria-label={`Tema: ${NOMBRE[tema]}. Cambiar a ${NOMBRE[SIGUIENTE[tema]]}`}
      title={`Tema: ${NOMBRE[tema]}`}
    >
      <Icono aria-hidden className="size-5" />
    </button>
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
      if (e.key === 'c') router.push('/carga')
      else if (e.key === 'h') cambiarPreferencia('privado', !privado)
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [router, privado])
  return null
}
