import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { etiquetaPrincipal, NOMBRE_ETIQUETA, type CalcVista, type Etiqueta } from '@/lib/domain/calc'
import type { Par } from '@/lib/vistas/contratos'
import { MontoTrazado } from './monto'

// Piezas visuales compartidas (visión §4.0; sistema visual D-157). Sin estado:
// sirven en Server y Client Components. Cada una dice arriba cómo se usa.

/**
 * Tarjeta: fondo surface, hairline, radio 14, sin sombra. No impone relleno:
 * p-5 (20 px) en las comunes, p-[22px] en las grandes, p-[16px_18px] en una
 * cifra clave.
 *   <Tarjeta className="p-5" aria-labelledby="t-expo">…</Tarjeta>
 */
export function Tarjeta({
  children,
  className = '',
  as: Tag = 'section',
  ...resto
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article' | 'aside' | 'li'
} & Record<`aria-${string}` | `data-${string}`, string | undefined>) {
  return (
    <Tag className={`rounded-tarjeta border border-border bg-surface ${className}`} {...resto}>
      {children}
    </Tag>
  )
}

/**
 * Una tarjeta que navega: toda la tarjeta es el link y al pasar el mouse el
 * borde se marca (--border-strong).
 *   <TarjetaLink href="/exposicion" className="p-5">…</TarjetaLink>
 */
export function TarjetaLink({ href, children, className = '', 'aria-label': etiqueta }: { href: string; children: ReactNode; className?: string; 'aria-label'?: string }) {
  return (
    <Link
      href={href}
      aria-label={etiqueta}
      className={`block rounded-tarjeta border border-border bg-surface transition-colors duration-200 ease-[var(--ease-out)] hover:border-border-strong ${className}`}
    >
      {children}
    </Link>
  )
}

/**
 * Rótulo de una tarjeta: JetBrains Mono 11 px, 500, mayúsculas con tracking
 * .16em, --text-muted. Es un h2 salvo que digas otra cosa.
 *   <Rotulo>Patrimonio neto · 12 meses</Rotulo>
 */
export function Rotulo({ children, className = '', as: Tag = 'h2', id }: { children: ReactNode; className?: string; as?: 'h2' | 'h3' | 'p' | 'span'; id?: string }) {
  return (
    <Tag id={id} className={`rotulo text-[11px] ${className}`}>
      {children}
    </Tag>
  )
}

/**
 * El link de una tarjeta ("Ver posiciones →"): Geist 13 px en --text-muted,
 * --text al pasar.
 *   <LinkTarjeta href="/cartera">Ver posiciones</LinkTarjeta>
 */
export function LinkTarjeta({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`tocable inline-flex shrink-0 items-center gap-1 text-[13px] text-muted transition-colors hover:text-text ${className}`}>
      {children} <span aria-hidden>→</span>
    </Link>
  )
}

/**
 * La primera línea de una tarjeta: el rótulo a la izquierda y, si hay, su link
 * (o cualquier control) alineado a la derecha.
 *   <CabezaTarjeta rotulo="Qué tenés y qué debés" link={{ href: '/cartera', texto: 'Ver posiciones' }} />
 */
export function CabezaTarjeta({ rotulo, id, link, children }: { rotulo: ReactNode; id?: string; link?: { href: string; texto: string }; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <Rotulo id={id}>{rotulo}</Rotulo>
      {link ? <LinkTarjeta href={link.href}>{link.texto}</LinkTarjeta> : null}
      {children}
    </div>
  )
}

type VarianteBoton = 'primario' | 'contorno' | 'texto'
type TamBoton = 'sm' | 'md'

/** Las clases de un botón (para un <button>, un <Link> o un <summary>). */
export function clasesBoton(variante: VarianteBoton = 'primario', tam: TamBoton = 'md'): string {
  const base = 'tocable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-mono font-semibold uppercase tracking-[0.08em] disabled:pointer-events-none disabled:opacity-50'
  const medida = tam === 'sm' ? 'min-h-9 px-4 py-[9px] text-[11px]' : 'min-h-11 px-5 py-3 text-[12px]'
  const tono =
    variante === 'primario'
      ? 'boton-primario bg-accent text-on-accent shadow-[var(--glow-accent)]'
      : variante === 'contorno'
        ? 'border border-border-strong text-text transition-colors hover:border-text active:translate-y-px'
        : 'text-muted transition-colors hover:text-text'
  return `${base} ${medida} ${tono}`
}

/**
 * Botón del sistema: pastilla en JetBrains Mono 600, mayúsculas con tracking.
 * - primario: sangría con brillo (Cargar y la acción principal de una pantalla);
 *   sube 1 px al pasar y baja al apretar.
 * - contorno: transparente con hairline fuerte; al pasar, el borde en tinta.
 * - texto: solo el texto, en --text-muted.
 * Con `href` es un link.
 *   <Boton href="/carga" tam="sm">Cargar</Boton>
 *   <Boton variante="contorno" onClick={…}>Ver como tabla</Boton>
 */
export function Boton({
  variante = 'primario',
  tam = 'md',
  href,
  className = '',
  children,
  ...resto
}: { variante?: VarianteBoton; tam?: TamBoton; href?: string; className?: string; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>) {
  const clases = `${clasesBoton(variante, tam)} ${className}`
  if (href) {
    return (
      <Link href={href} className={clases} aria-label={resto['aria-label']} title={resto.title}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={clases} {...resto}>
      {children}
    </button>
  )
}

/**
 * Badge: chip de estado en pastilla ("precio viejo", "sin dato", "manual"), en
 * mono 0.68rem con tracking. Tono neutro (superficie y hairline) o de datos (oro).
 *   <Badge>manual</Badge>   <Badge tono="dato">US$</Badge>
 */
export function Badge({ children, tono = 'neutro', className = '' }: { children: ReactNode; tono?: 'neutro' | 'dato'; className?: string }) {
  const color = tono === 'dato' ? 'border-usd-border bg-viz-soft text-viz-strong' : 'border-border bg-surface/60 text-muted'
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[0.68rem] uppercase leading-none tracking-[0.08em] ${color} ${className}`}>
      {children}
    </span>
  )
}

/**
 * Chip: el badge chico que va pegado a una cifra o en una celda (una sola
 * etiqueta por número, D-67). Lo verificado no lleva nada.
 *   <Chip>viejo · mar 13/10</Chip>
 */
export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full bg-surface-3 px-2 py-px font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.08em] text-muted ${className}`}>
      {children}
    </span>
  )
}

/** El chip de la etiqueta más grave de una cifra (D-67), o nada si es un dato verificado. */
export function ChipEtiqueta({ calc, omitir = [] }: { calc: CalcVista; omitir?: Etiqueta[] }) {
  const e = etiquetaPrincipal(calc.etiquetas.filter((x) => !omitir.includes(x)))
  return e ? <Chip>{NOMBRE_ETIQUETA[e]}</Chip> : null
}

/**
 * Par ARS/USD: ARS en tinta a la izquierda (o arriba), USD en su pastilla
 * dorada (D-68). Cada cifra abre su traza.
 *   <ParMonto par={fila.valor} titulo="GOOGL · valor" vertical />
 */
export function ParMonto({
  par,
  titulo,
  signo = false,
  color = false,
  decimalesUsd,
  vertical = false,
  className = '',
}: {
  par: Par
  titulo: string
  signo?: boolean
  color?: boolean
  decimalesUsd?: number
  vertical?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex ${vertical ? 'flex-col items-end gap-0.5' : 'flex-wrap items-baseline gap-x-2 gap-y-0.5'} ${className}`}>
      <MontoTrazado calc={par.ars} moneda="ARS" titulo={`${titulo} · en pesos`} signo={signo} color={color} />
      <MontoTrazado calc={par.usd} moneda="USD" titulo={`${titulo} · en dólares`} signo={signo} color={color} decimales={decimalesUsd} />
    </span>
  )
}

/** Aviso en una línea, en tinta neutra (nunca rojo para datos). */
export function Aviso({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`rounded-item border border-border bg-surface-2 px-3 py-2 text-sm text-muted ${className}`}>{children}</p>
}
