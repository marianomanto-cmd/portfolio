'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Ellipsis, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { cambiarPreferencia, useMedia, usePreferencias } from '@/components/preferencias'
import { SECCIONES, seccionActiva, type Seccion } from './secciones'

function useActiva(): Seccion | null {
  return seccionActiva(usePathname() ?? '/')
}

// ───────────── Desktop: barra lateral de 240 px, colapsable a 64 px ─────────────

export function BarraLateral({ puntoCarga }: { puntoCarga?: ReactNode }) {
  const activa = useActiva()
  const prefs = usePreferencias()
  const ancha = useMedia('(min-width: 1280px)', true)
  const expandida = prefs.nav === 'auto' ? ancha : prefs.nav === 'expandida'
  const cargar = SECCIONES.find((s) => s.href === '/carga')!
  const resto = SECCIONES.filter((s) => s.href !== '/carga')
  const grupos = ['Diario', 'Patrimonio', 'Al pie'] as const

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--nav-w)] flex-col border-r border-border bg-surface md:flex"
    >
      <div className="flex h-[var(--barra-sup)] shrink-0 items-center gap-3 px-[18px]">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-text text-[13px] font-semibold text-bg"
        >
          P
        </span>
        <span className="nav-texto truncate text-[15px] font-semibold tracking-tight">Portfolio</span>
      </div>

      <div className="px-2 pb-2">
        <Link
          href={cargar.href}
          aria-label="Cargar los datos de hoy"
          title="Cargar (c)"
          aria-current={activa?.href === cargar.href ? 'page' : undefined}
          className="relative flex h-10 items-center gap-3 rounded-lg bg-accent px-[14px] text-sm font-medium text-on-accent shadow-sm transition-colors hover:bg-accent-strong"
        >
          <cargar.icono aria-hidden className="size-5 shrink-0" strokeWidth={2} />
          <span className="nav-texto">Cargar</span>
          {puntoCarga ? <span className="absolute right-1.5 top-1.5">{puntoCarga}</span> : null}
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-2">
        {grupos.map((g) => (
          <ul key={g} className={`flex flex-col gap-0.5 ${g === 'Al pie' ? 'mt-auto' : ''}`}>
            <li aria-hidden className="nav-texto px-[14px] pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
              {g}
            </li>
            {resto
              .filter((s) => s.grupo === g)
              .map((s) => {
                const actual = activa?.href === s.href
                return (
                  <li key={s.href}>
                    <Link
                      href={s.href}
                      aria-label={s.nombre}
                      title={expandida ? undefined : s.nombre}
                      aria-current={actual ? 'page' : undefined}
                      className={`flex h-10 items-center gap-3 rounded-lg px-[14px] text-sm transition-colors ${
                        actual ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'
                      }`}
                    >
                      <s.icono aria-hidden className="size-5 shrink-0" strokeWidth={actual ? 2.25 : 1.75} />
                      <span className="nav-texto truncate">{s.nombre}</span>
                    </Link>
                  </li>
                )
              })}
          </ul>
        ))}
      </div>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={() => cambiarPreferencia('nav', expandida ? 'colapsada' : 'expandida')}
          aria-label={expandida ? 'Colapsar la barra lateral' : 'Expandir la barra lateral'}
          title={expandida ? 'Colapsar' : 'Expandir'}
          className="flex h-10 w-full items-center gap-3 rounded-lg px-[14px] text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          {expandida ? (
            <PanelLeftClose aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
          ) : (
            <PanelLeftOpen aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
          )}
          <span className="nav-texto">Colapsar</span>
        </button>
      </div>
    </nav>
  )
}

// ───────────── Teléfono: barra inferior con Cargar al centro ─────────────

const INFERIOR = ['/', '/cartera', '/carga', '/exposicion'] as const

export function BarraInferior({ puntoCarga }: { puntoCarga?: ReactNode }) {
  const activa = useActiva()
  const hoja = useRef<HTMLDialogElement>(null)
  const items = INFERIOR.map((h) => SECCIONES.find((s) => s.href === h)!)
  const enMas = SECCIONES.filter((s) => !(INFERIOR as readonly string[]).includes(s.href))
  const masActiva = activa ? enMas.some((s) => s.href === activa.href) : false

  const item = (s: Seccion) => {
    const actual = activa?.href === s.href
    if (s.href === '/carga') {
      return (
        <li key={s.href} className="flex items-center justify-center">
          <Link
            href={s.href}
            aria-label="Cargar los datos de hoy"
            aria-current={actual ? 'page' : undefined}
            className="relative flex h-12 w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl bg-accent text-on-accent shadow-sm active:bg-accent-strong"
          >
            <s.icono aria-hidden className="size-5" strokeWidth={2.25} />
            <span className="text-[11px] font-semibold leading-none">Cargar</span>
            {puntoCarga ? <span className="absolute right-1 top-1">{puntoCarga}</span> : null}
          </Link>
        </li>
      )
    }
    return (
      <li key={s.href} className="flex">
        <Link
          href={s.href}
          aria-current={actual ? 'page' : undefined}
          className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none ${
            actual ? 'font-semibold text-accent' : 'text-muted'
          }`}
        >
          <s.icono aria-hidden className="size-[22px]" strokeWidth={actual ? 2.25 : 1.75} />
          <span>{s.nombre}</span>
        </Link>
      </li>
    )
  }

  return (
    <>
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid h-[55px] grid-cols-5">
          {items.slice(0, 2).map(item)}
          {item(items[2])}
          {item(items[3])}
          <li className="flex">
            <button
              type="button"
              onClick={() => hoja.current?.showModal()}
              aria-haspopup="dialog"
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none ${
                masActiva ? 'font-semibold text-accent' : 'text-muted'
              }`}
            >
              <Ellipsis aria-hidden className="size-[22px]" strokeWidth={masActiva ? 2.25 : 1.75} />
              <span>Más</span>
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={hoja}
        aria-label="Más secciones"
        className="hoja fixed inset-x-0 bottom-0 top-auto m-0 w-full rounded-t-2xl border-t border-border bg-surface p-0 text-text shadow-lg"
        onClick={(e) => {
          if (e.target === e.currentTarget) hoja.current?.close()
        }}
      >
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded bg-border-strong" />
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold">Más secciones</p>
            <button
              type="button"
              onClick={() => hoja.current?.close()}
              aria-label="Cerrar"
              className="tocable grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <ul className="flex flex-col">
            {enMas.map((s) => {
              const actual = activa?.href === s.href
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    onClick={() => hoja.current?.close()}
                    aria-current={actual ? 'page' : undefined}
                    className={`flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 ${actual ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2">
                      <s.icono aria-hidden className={`size-5 ${actual ? 'text-accent' : 'text-muted'}`} />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[15px] font-medium ${actual ? 'text-accent' : ''}`}>{s.nombre}</span>
                      <span className="block text-[13px] text-muted">{s.descripcion}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </dialog>
    </>
  )
}
