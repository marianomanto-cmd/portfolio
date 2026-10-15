'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Ellipsis, PanelLeft, X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { cambiarPreferencia, useMedia, usePreferencias } from '@/components/preferencias'
import { BARRA_INFERIOR, CARGAR, GRUPOS, itemInferiorActivo, PESTANAS_PATRIMONIO, SECCIONES, seccionActiva, seccionesDeMas, type Seccion } from './secciones'

function useActiva(): Seccion | null {
  return seccionActiva(usePathname() ?? '/')
}

// ───────────── Desktop: barra lateral de 232 px, colapsable a 68 px (D-156) ─────────────

/**
 * La barra lateral: el logo, los grupos por pregunta (Diario, Patrimonio,
 * Resultados, Compromisos y futuro) y, al pie, Registro, Datos, Ajustes y el
 * Mapa de la app. Ítem de 38 px (44 con el dedo), radio 10, ícono de 18 px;
 * el activo va en surface-2 con la barrita sangría de 2 px a la izquierda.
 * Cargar no está acá: es el botón primario de la barra superior.
 */
export function BarraLateral() {
  const activa = useActiva()
  const prefs = usePreferencias()
  const ancha = useMedia('(min-width: 1280px)', true)
  const expandida = prefs.nav === 'auto' ? ancha : prefs.nav === 'expandida'

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--nav-w)] flex-col gap-[18px] overflow-y-auto overflow-x-hidden border-r border-border bg-bg px-[10px] py-4 md:flex"
    >
      <div className="flex h-8 shrink-0 items-center gap-[10px] px-[13px]">
        <span
          aria-hidden
          className="size-[22px] shrink-0 rounded-full border-[1.5px] border-border-accent bg-[radial-gradient(circle_at_50%_40%,#2a0f1c_0%,#0b0810_70%)] shadow-[var(--glow-core)]"
        />
        <span className="nav-texto font-mono text-[13px] font-medium uppercase tracking-[0.16em]">Portfolio</span>
      </div>

      {GRUPOS.map((g) => (
        <ul key={g} className={`flex flex-col gap-0.5 ${g === 'Al pie' ? 'mt-auto' : ''}`}>
          <li aria-hidden className="nav-texto truncate px-[10px] pb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
            {g}
          </li>
          {SECCIONES.filter((s) => s.grupo === g).map((s) => {
            const actual = activa?.href === s.href
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-label={s.nombre}
                  title={expandida ? undefined : s.nombre}
                  aria-current={actual ? 'page' : undefined}
                  className={`tocable relative flex h-[38px] items-center gap-3 rounded-item px-[15px] text-[14px] transition-colors duration-200 ${
                    actual ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface hover:text-text'
                  }`}
                >
                  {actual ? <span aria-hidden className="absolute -left-[10px] bottom-[10px] top-[10px] w-[2px] rounded-full bg-accent" /> : null}
                  <s.icono aria-hidden className={`size-[18px] shrink-0 ${actual ? 'opacity-95' : 'opacity-55'}`} strokeWidth={actual ? 2.25 : 1.75} />
                  <span className="nav-texto truncate">{s.nombre}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ))}

      <button
        type="button"
        onClick={() => cambiarPreferencia('nav', expandida ? 'colapsada' : 'expandida')}
        aria-label={expandida ? 'Colapsar la barra lateral' : 'Expandir la barra lateral'}
        title={expandida ? 'Colapsar' : 'Expandir'}
        className="tocable -mt-2 flex h-[38px] shrink-0 items-center gap-3 border-t border-border px-[15px] pt-1 text-[13px] text-muted transition-colors hover:text-text"
      >
        <PanelLeft aria-hidden className="size-[18px] shrink-0 opacity-55" strokeWidth={1.75} />
        <span className="nav-texto">{expandida ? 'Colapsar' : 'Expandir'}</span>
      </button>
    </nav>
  )
}

// ───────────── Teléfono: Hoy · Patrimonio · Cargar · Resultados · Más (D-156) ─────────────

function ItemInferior({ href, nombre, icono: Icono, actual }: { href: string; nombre: string; icono: Seccion['icono']; actual: boolean }) {
  return (
    <li className="flex">
      <Link
        href={href}
        aria-current={actual ? 'page' : undefined}
        className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none ${actual ? 'font-medium text-text' : 'text-muted'}`}
      >
        {actual ? <span aria-hidden className="absolute top-0 h-[2px] w-6 rounded-full bg-accent" /> : null}
        <Icono aria-hidden className={`size-[22px] ${actual ? 'opacity-95' : 'opacity-70'}`} strokeWidth={actual ? 2.25 : 1.75} />
        <span>{nombre}</span>
      </Link>
    </li>
  )
}

/**
 * La barra inferior del teléfono: Hoy · Patrimonio (Posiciones, con la pestaña
 * de Exposición) · Cargar (al centro, sangría) · Resultados · Más (la hoja con
 * Pasivos, Flujo, Registro, Datos, Ajustes y el Mapa). Reemplaza a D-151.
 */
export function BarraInferior({ puntoCarga }: { puntoCarga?: ReactNode }) {
  const pathname = usePathname() ?? '/'
  const activa = useActiva()
  const marcado = itemInferiorActivo(pathname)
  const hoja = useRef<HTMLDialogElement>(null)
  const hoy = SECCIONES.find((s) => s.href === BARRA_INFERIOR.hoy)!
  const posiciones = SECCIONES.find((s) => s.href === BARRA_INFERIOR.patrimonio)!
  const resultados = SECCIONES.find((s) => s.href === BARRA_INFERIOR.resultados)!
  const enMas = seccionesDeMas()

  return (
    <>
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-[14px] md:hidden"
      >
        <ul className="grid h-[55px] grid-cols-5">
          <ItemInferior href={hoy.href} nombre={hoy.nombre} icono={hoy.icono} actual={marcado === 'hoy'} />
          <ItemInferior href={posiciones.href} nombre="Patrimonio" icono={posiciones.icono} actual={marcado === 'patrimonio'} />
          <li className="flex items-center justify-center">
            <Link
              href={CARGAR.href}
              aria-label="Cargar los datos de hoy"
              aria-current={marcado === 'cargar' ? 'page' : undefined}
              className="boton-primario relative flex h-12 w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl bg-accent text-on-accent shadow-[var(--glow-accent)]"
            >
              <CARGAR.icono aria-hidden className="size-5" strokeWidth={2.25} />
              <span className="font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.08em]">Cargar</span>
              {puntoCarga ? <span className="absolute -right-1 -top-1">{puntoCarga}</span> : null}
            </Link>
          </li>
          <ItemInferior href={resultados.href} nombre={resultados.corto ?? resultados.nombre} icono={resultados.icono} actual={marcado === 'resultados'} />
          <li className="flex">
            <button
              type="button"
              onClick={() => hoja.current?.showModal()}
              aria-haspopup="dialog"
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none ${marcado === 'mas' ? 'font-medium text-text' : 'text-muted'}`}
            >
              {marcado === 'mas' ? <span aria-hidden className="absolute top-0 h-[2px] w-6 rounded-full bg-accent" /> : null}
              <Ellipsis aria-hidden className={`size-[22px] ${marcado === 'mas' ? 'opacity-95' : 'opacity-70'}`} strokeWidth={marcado === 'mas' ? 2.25 : 1.75} />
              <span>Más</span>
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={hoja}
        aria-label="Más secciones"
        className="hoja fixed inset-x-0 bottom-0 top-auto m-0 w-full rounded-t-[20px] border-t border-border bg-surface p-0 text-text shadow-[var(--glass-shadow)]"
        onClick={(e) => {
          if (e.target === e.currentTarget) hoja.current?.close()
        }}
      >
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded bg-border-strong" />
          <div className="mb-1 flex items-center justify-between">
            <p className="rotulo text-[11px]">Más secciones</p>
            <button
              type="button"
              onClick={() => hoja.current?.close()}
              aria-label="Cerrar"
              className="tocable grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
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
                    className={`relative flex min-h-14 items-center gap-3 rounded-item px-2 py-2 ${actual ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
                  >
                    {actual ? <span aria-hidden className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full bg-accent" /> : null}
                    <span className="grid size-10 shrink-0 place-items-center rounded-item border border-border bg-surface-2">
                      <s.icono aria-hidden className={`size-5 ${actual ? 'text-text' : 'text-muted'}`} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium">{s.nombre}</span>
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

/**
 * Patrimonio en el teléfono: dos pestañas arriba de Posiciones y de Exposición
 * (la barra inferior tiene un solo lugar para las dos). Desde 768 px están en
 * la barra lateral y no se muestran.
 */
export function PestanasPatrimonio() {
  const activa = useActiva()
  if (!activa || activa.grupo !== 'Patrimonio') return null
  return (
    <nav aria-label="Patrimonio" className="mb-4 md:hidden">
      <ul className="grid grid-cols-2 gap-1 rounded-full border border-border p-1">
        {PESTANAS_PATRIMONIO.map((s) => {
          const actual = activa.href === s.href
          return (
            <li key={s.href} className="flex">
              <Link
                href={s.href}
                aria-current={actual ? 'page' : undefined}
                className={`tocable flex flex-1 items-center justify-center rounded-full font-mono text-[11px] uppercase tracking-[0.08em] ${actual ? 'bg-surface-3 text-text' : 'text-muted'}`}
              >
                {s.nombre}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
