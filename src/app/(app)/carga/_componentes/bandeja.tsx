'use client'

// La bandeja de revisión (4.2.1 de la visión): primero lo que no cerró, lo
// verificado plegado en una línea. Las advertencias se aceptan de a una (nunca
// con el Enter general); los errores se editan o se dejan pendientes.
// Teclado: ↑/↓ entre filas; con una fila enfocada, A acepta, E edita y P la
// deja pendiente (solo si ningún campo tiene el foco).

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { AusentePropuesto, DecisionFila, DecisionSaldo, FilaLeida, PropuestaCarga } from '@/lib/carga/contratos'
import { monto, numero, porcentaje } from '@/lib/domain/dinero'
import { diasEntre, fechaCorta } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import {
  alternativasFila,
  alternativasSaldo,
  diferenciaDolarIEB,
  enlaceMovimiento,
  precioACompletar,
  problemaRegistroAusente,
  saltoDeSaldo,
  type EleccionAusente,
  type EleccionFila,
  type EleccionSaldo,
  type EstadoItem,
  type ItemBandeja,
  type RegistroAusente,
  type ResumenBandeja,
} from '../_lib/bandeja'
import type { ActivoLocal } from '../_lib/demo'
import type { EdicionFila } from '../_lib/ediciones'
import { leerMonto } from '../_lib/entrada'
import { AltaActivo } from './alta-activo'
import { ConMontos, M } from './montos'
import { Boton, Chip, Entrada } from './ui'

// ───────────── Formato ─────────────

function decimalesDe(v: string): number {
  const i = v.indexOf('.')
  return i === -1 ? 0 : v.length - i - 1
}

const pesos = (v: string, dec = 2) => monto(v, 'ARS', { decimales: dec })
const precio = (v: string, m: 'ARS' | 'USD' = 'ARS') => monto(v, m, { decimales: Math.min(6, Math.max(2, decimalesDe(v))) })
const cantidad = (v: string) => numero(v, 6, { min: 0 })
const montoMoneda = (v: string, m: 'ARS' | 'USD') => monto(v, m, { decimales: 2 })
/** Decimal normalizado → texto para editar ("1.0986" → "1,0986"). */
const aEditable = (v: string | null) => (v === null ? '' : v.replace('.', ','))

const ETIQUETA: Record<EstadoItem, { texto: string; tono: 'azul' | 'aviso' | 'error' | 'neutro' }> = {
  verificada: { texto: '✓ verificada', tono: 'azul' },
  aceptada: { texto: '✓ aceptada', tono: 'azul' },
  advertencia: { texto: '! a revisar', tono: 'aviso' },
  sin_alta: { texto: '! ticker nuevo', tono: 'aviso' },
  error: { texto: '✕ error', tono: 'error' },
  pendiente: { texto: '○ pendiente', tono: 'neutro' },
}

const NOMBRE_ACCION: Record<DecisionFila['accion'], string> = {
  ninguna: 'sin cambio de cantidad',
  apertura: 'apertura (primera carga)',
  compra: 'compra',
  venta: 'venta',
  completar_precio: 'completar el precio de una compra pendiente',
  revisar: 'a revisar',
}

const NOMBRE_OPERACION: Record<string, string> = {
  apertura: 'apertura',
  compra: 'compra',
  venta: 'venta',
  vencimiento: 'vencimiento',
  renta: 'renta',
  amortizacion: 'amortización',
  ajuste_ratio: 'ajuste de ratio',
}
const nombreOperacion = (t: string) => NOMBRE_OPERACION[t] ?? t

// ───────────── Teclado ─────────────

function moverFoco(desde: HTMLElement, paso: 1 | -1) {
  const filas = Array.from(document.querySelectorAll<HTMLElement>('[data-item-bandeja]'))
  const i = filas.indexOf(desde)
  filas[i + paso]?.focus()
}

function teclasFila(e: KeyboardEvent<HTMLLIElement>, acciones: { a?: () => void; e?: () => void; p?: () => void }) {
  if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return
  const k = e.key.toLowerCase()
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    moverFoco(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1)
  } else if (k === 'a' && acciones.a) {
    e.preventDefault()
    acciones.a()
  } else if (k === 'e' && acciones.e) {
    e.preventDefault()
    acciones.e()
  } else if (k === 'p' && acciones.p) {
    e.preventDefault()
    acciones.p()
  }
}

// ───────────── Piezas ─────────────

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className="num break-words text-sm text-text">{children}</dd>
    </div>
  )
}

/** Los motivos de una fila; el primero es el principal (en un error, el que frena). */
function Motivos({ motivos, principal = false }: { motivos: string[]; principal?: boolean }) {
  if (!motivos.length) return null
  return (
    <ul className="mt-1 space-y-0.5 text-sm text-muted">
      {motivos.map((m, i) => (
        <li key={i} className={`break-words ${principal && i === 0 ? 'font-medium text-negative' : ''}`}>
          <ConMontos texto={m} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Las dos lecturas de una captura que no coinciden, lado a lado: un toque
 * elige una (4.2.1). La propuesta (la que cierra la cuenta) acepta la fila;
 * la otra corrige ese número y la fila se vuelve a controlar.
 */
function DosLecturas({
  campos,
}: {
  campos: {
    etiqueta: string
    /** El valor es plata (se tapa en el modo privado). */
    monto?: boolean
    /** "cierra" solo si la propuesta salió de un control aritmético que cerró; si no, "propuesta". */
    rotulo: 'cierra' | 'propuesta'
    opciones: { lectura: 'A' | 'B'; texto: string; propuesta: boolean; elegida: boolean; onElegir: (() => void) | null }[]
  }[]
}) {
  if (!campos.length) return null
  return (
    <div className="mt-2 space-y-2" onKeyDown={(e) => e.stopPropagation()}>
      {campos.map((c) => (
        <fieldset key={c.etiqueta} className="min-w-0">
          <legend className="text-xs text-muted">{c.etiqueta}: las dos lecturas no coinciden</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {c.opciones.map((o) =>
              o.onElegir ? (
                <button
                  key={o.lectura}
                  type="button"
                  aria-pressed={o.elegida}
                  onClick={o.onElegir}
                  className={`tocable min-h-11 min-w-0 rounded-lg border px-2 py-1.5 text-left text-sm lg:min-h-9 ${
                    o.elegida ? 'border-accent bg-accent-soft text-text' : 'border-border bg-surface text-text hover:bg-surface-2'
                  }`}
                >
                  <span className="block text-xs text-muted">
                    Lectura {o.lectura}
                    {o.propuesta ? ` · ${c.rotulo}` : ''}
                  </span>
                  <span className={`num block break-words ${c.monto ? 'monto' : ''}`}>{o.texto}</span>
                </button>
              ) : (
                <div key={o.lectura} className="min-w-0 rounded-lg border border-dashed border-border px-2 py-1.5 text-sm">
                  <span className="block text-xs text-muted">
                    Lectura {o.lectura}
                    {o.propuesta ? ' · propuesta' : ''}
                  </span>
                  <span className={`num block break-words text-text ${c.monto ? 'monto' : ''}`}>{o.texto}</span>
                </div>
              ),
            )}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

function Fila({
  estado,
  titulo,
  subtitulo,
  children,
  onKeyDown,
}: {
  estado: EstadoItem
  titulo: ReactNode
  subtitulo?: ReactNode
  children?: ReactNode
  onKeyDown?: (e: KeyboardEvent<HTMLLIElement>) => void
}) {
  const et = ETIQUETA[estado]
  return (
    <li
      tabIndex={0}
      data-item-bandeja=""
      onKeyDown={onKeyDown}
      className={`min-w-0 rounded-xl border bg-surface p-3 outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        estado === 'error' ? 'border-negative/40' : estado === 'advertencia' || estado === 'sin_alta' ? 'border-warn/40' : 'border-border'
      }`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Chip tono={et.tono}>{et.texto}</Chip>
        <span className="min-w-0 font-medium text-text">{titulo}</span>
        {subtitulo ? <span className="min-w-0 text-sm text-muted">{subtitulo}</span> : null}
      </div>
      {children}
    </li>
  )
}

/** Botones de una fila. `dosPorFila`: en el teléfono van de a dos (cuando son cuatro). */
function Acciones({ children, dosPorFila = false }: { children: ReactNode; dosPorFila?: boolean }) {
  return (
    <div className={`mt-2 flex flex-wrap gap-2 [&>*]:max-sm:flex-1 ${dosPorFila ? '[&>*]:max-sm:basis-[calc(50%-0.25rem)]' : ''}`}>{children}</div>
  )
}

// ───────────── Fila leída (posición) ─────────────

function EditorOperacion({
  d,
  onAceptar,
  onCancelar,
}: {
  d: DecisionFila
  onAceptar: (op: { cantidad: string; precio: string | null }) => void
  onCancelar: () => void
}) {
  const id = useId()
  const op = d.operacion!
  const [q, setQ] = useState(aEditable(op.cantidad))
  const [p, setP] = useState(aEditable(op.precio))
  const [error, setError] = useState<string | null>(null)
  const puedeSinPrecio = op.tipo === 'compra' || op.tipo === 'apertura'
  const sinPrecio = op.tipo === 'ajuste_ratio'
  function aceptar() {
    const cq = leerMonto(q, { positivo: true })
    if (cq.error) return setError(`Cantidad: ${cq.error}`)
    let precioFinal: string | null = null
    if (sinPrecio) {
      precioFinal = null
    } else if (p.trim() !== '') {
      const cp = leerMonto(p, { positivo: true })
      if (cp.error) return setError(`Precio: ${cp.error}`)
      precioFinal = cp.valor
    } else if (!puedeSinPrecio) {
      return setError('La venta necesita el precio.')
    }
    onAceptar({ cantidad: cq.valor!, precio: precioFinal })
  }
  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-border bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_auto]" onKeyDown={(e) => e.stopPropagation()}>
      <div className="min-w-0 space-y-1">
        <label htmlFor={`${id}-q`} className="text-sm font-medium">
          Cantidad {sinPrecio ? 'que agrega el ajuste de ratio' : `de la ${nombreOperacion(op.tipo)}`}
        </label>
        <Entrada
          id={`${id}-q`}
          inputMode="decimal"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="num"
          autoFocus
          onKeyDown={(e) => {
            if (sinPrecio && e.key === 'Enter') {
              e.preventDefault()
              aceptar()
            }
          }}
        />
      </div>
      {sinPrecio ? (
        <p className="min-w-0 self-end text-sm text-muted">Un ajuste de ratio no lleva precio: el costo total no cambia.</p>
      ) : (
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${id}-p`} className="text-sm font-medium">
            Precio por 1 VN / unidad {puedeSinPrecio ? <span className="font-normal text-muted">(vacío = pendiente)</span> : null}
          </label>
          <Entrada
            id={`${id}-p`}
            inputMode="decimal"
            value={p}
            onChange={(e) => setP(e.target.value)}
            className="num"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                aceptar()
              }
            }}
          />
        </div>
      )}
      <div className="flex items-end gap-2 [&>*]:max-sm:flex-1">
        <Boton variante="primario" onClick={aceptar}>
          Aceptar así
        </Boton>
        <Boton variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
      {error ? <p role="alert" className="text-sm text-negative sm:col-span-3">{error}</p> : null}
    </div>
  )
}

/** D-19: corregir el precio inferido de la compra pendiente antes de completarla. */
function EditorPrecioCompra({
  d,
  inicial,
  onAceptar,
  onCancelar,
}: {
  d: DecisionFila
  inicial: string
  onAceptar: (precio: string) => void
  onCancelar: () => void
}) {
  const id = useId()
  const [p, setP] = useState(aEditable(inicial))
  const [error, setError] = useState<string | null>(null)
  function aceptar() {
    const cp = leerMonto(p, { positivo: true })
    if (cp.error || cp.valor === null) return setError(`Precio: ${cp.error ?? 'falta'}`)
    onAceptar(cp.valor)
  }
  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-border bg-surface-2 p-3 sm:grid-cols-[1fr_auto]" onKeyDown={(e) => e.stopPropagation()}>
      <div className="min-w-0 space-y-1">
        <label htmlFor={`${id}-p`} className="text-sm font-medium">
          Precio de la compra del {d.completar ? fechaCorta(d.completar.fecha) : ''}, por 1 VN / unidad
        </label>
        <Entrada
          id={`${id}-p`}
          inputMode="decimal"
          value={p}
          onChange={(e) => setP(e.target.value)}
          className="num"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              aceptar()
            }
          }}
        />
      </div>
      <div className="flex items-end gap-2 [&>*]:max-sm:flex-1">
        <Boton variante="primario" onClick={aceptar}>
          Completar así
        </Boton>
        <Boton variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
      {error ? <p role="alert" className="text-sm text-negative sm:col-span-2">{error}</p> : null}
    </div>
  )
}

function EditorLectura({
  d,
  edicion,
  onGuardar,
  onQuitar,
  onCancelar,
}: {
  d: DecisionFila
  edicion: EdicionFila | null
  onGuardar: (e: EdicionFila) => void
  onQuitar: () => void
  onCancelar: () => void
}) {
  const id = useId()
  const [q, setQ] = useState(aEditable(edicion?.cantidad ?? d.fila.cantidad))
  const [p, setP] = useState(aEditable(edicion?.precio_unitario ?? d.fila.precio_unitario))
  const [error, setError] = useState<string | null>(null)
  function guardar() {
    const cq = leerMonto(q, { positivo: true })
    if (cq.error) return setError(`Cantidad: ${cq.error}`)
    const cp = leerMonto(p, { positivo: true })
    if (cp.error) return setError(`Precio: ${cp.error}`)
    onGuardar({
      cantidad: cq.valor !== d.fila.cantidad ? cq.valor : null,
      precio_unitario: cp.valor !== d.fila.precio_unitario ? cp.valor : null,
    })
  }
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-surface-2 p-3" onKeyDown={(e) => e.stopPropagation()}>
      <p className="text-sm text-muted">
        Corregí lo que la fuente muestra. Vuelvo a controlar contra el valorizado
        {d.fila.valorizado ? (
          <>
            {' '}
            (<M>{pesos(d.fila.valorizado)}</M>)
          </>
        ) : (
          ' (esta fila no trae valorizado: no hay control)'
        )}
        .
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${id}-q`} className="text-sm font-medium">
            Cantidad
          </label>
          <Entrada id={`${id}-q`} inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} className="num" autoFocus />
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${id}-p`} className="text-sm font-medium">
            Precio por 1 VN / unidad
          </label>
          <Entrada
            id={`${id}-p`}
            inputMode="decimal"
            value={p}
            onChange={(e) => setP(e.target.value)}
            className="num"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                guardar()
              }
            }}
          />
        </div>
        <div className="flex items-end gap-2 [&>*]:max-sm:flex-1">
          <Boton variante="primario" onClick={guardar}>
            Controlar
          </Boton>
          {edicion ? (
            <Boton variante="secundario" onClick={onQuitar}>
              Volver a lo leído
            </Boton>
          ) : null}
          <Boton variante="fantasma" onClick={onCancelar}>
            Cancelar
          </Boton>
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-negative">{error}</p> : null}
    </div>
  )
}

const mismaEdicion = (a: EdicionFila, b: EdicionFila | null) =>
  b !== null && a.cantidad === b.cantidad && a.precio_unitario === b.precio_unitario && (a.valorizado ?? null) === (b.valorizado ?? null)

function textoOperacion(d: DecisionFila, el: EleccionFila | null): string | null {
  const base = el?.apertura && d.apertura_alternativa ? d.apertura_alternativa : d.operacion
  const op = el?.operacion && base ? { ...base, ...el.operacion } : base
  if (!op) return null
  const q = cantidad(op.cantidad)
  const p = op.precio ? ` a ${precio(op.precio)}` : op.tipo === 'apertura' ? ' (costo sin dato)' : ' (precio pendiente)'

  const ccl = op.tipo !== 'apertura' && op.ccl_del_dia ? ` · CCL ${numero(op.ccl_del_dia, 2)}` : ''
  const nombre = nombreOperacion(op.tipo)
  const sinPrecio = op.tipo === 'ajuste_ratio' ? ' (sin precio: el costo no cambia)' : p
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} de ${op.tipo === 'ajuste_ratio' ? '+' : ''}${q}${sinPrecio}${ccl}${el?.operacion ? ' (corregida)' : ''}`
}

function ItemFila({
  d,
  estado,
  eleccion,
  edicion,
  original,
  onElegir,
  onEditar,
  onAlta,
  onIrAlCcl,
  onAceptarAlVolver,
}: {
  d: DecisionFila
  estado: EstadoItem
  eleccion: EleccionFila | null
  edicion: EdicionFila | null
  /** La fila tal como la leyó el lector, sin ediciones (para elegir entre lecturas). */
  original: FilaLeida | null
  /** Aceptar la fila cuando vuelva sin la edición (elegir la lectura propuesta después de otra). */
  onAceptarAlVolver?: (clave: string, motivo: string) => void
  onElegir: (d: DecisionFila, e: Omit<EleccionFila, 'huella'> | null) => void
  onEditar: (clave: string, e: EdicionFila | null) => void
  onAlta: (a: ActivoLocal) => void
  onIrAlCcl: () => void
}) {
  const [modo, setModo] = useState<'ver' | 'operacion' | 'lectura' | 'alta' | 'precio'>('ver')
  const f = d.fila
  const faltaCcl = d.motivos.some((m) => m.startsWith('Falta el CCL'))
  // Galicia muestra "Bonos en dólares" en U$D: se ve en dólares y no se graba (queda en error).
  const mon: 'ARS' | 'USD' = f.moneda_precio === 'USD' || (d.cuenta !== 'IEB' && f.moneda_emision === 'USD') ? 'USD' : 'ARS'
  const enDolares = mon === 'USD'
  const comoApertura = Boolean(eleccion?.apertura && d.apertura_alternativa)
  // "Ya la tenía": la otra opción de una compra de una tenencia nueva en una cuenta ya cargada.
  const puedeApertura = Boolean(d.apertura_alternativa) && f.estado !== 'error' && (estado === 'advertencia' || (estado === 'error' && faltaCcl))
  const operacion = textoOperacion(d, eleccion)
  const completa = d.accion === 'completar_precio' && d.completar ? d.completar : null
  const precioElegido = completa ? precioACompletar(d, eleccion) : null

  const aceptar = () => {
    if (estado === 'sin_alta') return setModo('alta')
    if (estado === 'error') return setModo('lectura')
    if (estado === 'advertencia') {
      onElegir(d, {
        resolucion: 'aceptada',
        motivo: completa
          ? `completé el precio de la compra del ${fechaCorta(completa.fecha)} con el inferido del PPP`
          : d.operacion
            ? `acepté la ${nombreOperacion(d.operacion.tipo)} propuesta`
            : 'acepté la fila leída',
        operacion: null,
      })
    }
  }
  const pendiente = () => onElegir(d, { resolucion: 'pendiente', motivo: 'la dejé pendiente', operacion: null })
  const yaLaTenia = () =>
    onElegir(d, { resolucion: 'aceptada', motivo: 'ya la tenía: apertura con el PPP, sin pago de hoy', operacion: null, apertura: true })
  const editar = () =>
    enDolares ? undefined : setModo(completa && estado !== 'error' ? 'precio' : d.operacion && estado !== 'error' && !comoApertura ? 'operacion' : 'lectura')

  const escala =
    f.escala && f.escala !== '1' && f.precio_mostrado
      ? `La fuente muestra ${numero(f.precio_mostrado, 4, { min: 2 })} cada ${f.escala === '0.01' ? '100' : '1.000'} VN`
      : ''

  // Las dos lecturas de una captura, para elegir con un toque.
  const fuente = original ?? f
  const lecturas = alternativasFila(fuente, edicion).map((a) => ({
    etiqueta: a.etiqueta,
    monto: !['cantidad', 'rendimiento_porcentaje', 'ticker'].includes(a.campo),
    rotulo: (fuente.chequeo?.ok ? 'cierra' : 'propuesta') as 'cierra' | 'propuesta',
    opciones: a.opciones.map((o) => {
      const decimal = /^-?\d+(\.\d+)?$/.test(o.valor)
      const texto = !decimal
        ? o.valor
        : a.campo === 'cantidad'
          ? cantidad(o.valor)
          : a.campo === 'rendimiento_porcentaje'
            ? `${numero(o.valor, 2)}%`
            : precio(o.valor, mon)
      const editada = o.edicion !== null && o.edicion !== 'aceptar'
      // Elegida: la que coincide con lo que hoy usa la fila.
      const elegida =
        o.edicion === 'aceptar'
          ? !edicion && (estado === 'aceptada' || estado === 'verificada')
          : editada && mismaEdicion(o.edicion as EdicionFila, edicion)
      const onElegirLectura =
        o.edicion === null || estado === 'pendiente'
          ? null
          : o.edicion === 'aceptar'
            ? () => {
                const motivo = `elegí la lectura ${o.lectura} (${a.etiqueta.toLowerCase()})`
                if (edicion) {
                  // Volver a lo leído: la fila se vuelve a armar y recién ahí se acepta.
                  onEditar(d.clave, null)
                  onAceptarAlVolver?.(d.clave, motivo)
                } else if (d.estado === 'advertencia') {
                  onElegir(d, { resolucion: 'aceptada', motivo, operacion: null })
                }
              }
            : () => onEditar(d.clave, o.edicion as EdicionFila)
      return { lectura: o.lectura, texto, propuesta: o.propuesta, elegida, onElegir: onElegirLectura }
    }),
  }))

  return (
    <Fila
      estado={estado}
      titulo={
        <>
          {d.cuenta} · <span className="num">{d.ticker}</span>
        </>
      }
      subtitulo={d.nombre ?? undefined}
      onKeyDown={(e) => teclasFila(e, { a: estado === 'pendiente' ? undefined : aceptar, e: editar, p: pendiente })}
    >
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <Dato etiqueta="Leí">{d.cantidad_leida !== null ? cantidad(d.cantidad_leida) : 'sin dato'}</Dato>
        <Dato etiqueta="La app tiene">{d.cantidad_app !== null ? cantidad(d.cantidad_app) : 'sin dato'}</Dato>
        <Dato etiqueta="Precio por 1 VN">{f.precio_unitario ? <M usd={enDolares}>{precio(f.precio_unitario, mon)}</M> : 'sin dato'}</Dato>
        <Dato etiqueta="Valorizado">{f.valorizado ? <M usd={enDolares}>{montoMoneda(f.valorizado, mon)}</M> : 'sin dato'}</Dato>
      </dl>
      {escala ? <p className="mt-1 text-xs text-muted">{escala}.</p> : null}
      {f.chequeo ? (
        <p className={`num mt-1 break-words text-xs ${f.chequeo.ok ? 'text-muted' : 'text-negative'}`}>
          {f.chequeo.ok ? '✓' : '≠'} {f.chequeo.regla}: <M usd={enDolares}>{montoMoneda(f.chequeo.calculado, mon)}</M> {f.chequeo.ok ? '≈' : 'contra'}{' '}
          <M usd={enDolares}>{montoMoneda(f.chequeo.esperado, mon)}</M> (±<M usd={enDolares}>{montoMoneda(f.chequeo.tolerancia, mon)}</M>)
        </p>
      ) : null}
      {completa ? (
        <p className="mt-1 text-sm text-text">
          <span className="text-muted">Propuesta: </span>
          {precioElegido !== null || estado !== 'aceptada' ? (
            <>
              completar el precio de la compra del {fechaCorta(completa.fecha)}: <span className="num monto">{precio(precioElegido ?? completa.precio)}</span>
              {eleccion?.precio_completar ? ' (corregido)' : ', inferido del PPP'}
            </>
          ) : (
            'grabar la fila sin completar el precio (la compra sigue pendiente)'
          )}
          <span className="num block break-words text-xs text-muted">
            <ConMontos texto={completa.formula} />
          </span>
        </p>
      ) : operacion ? (
        <p className="mt-1 text-sm text-text">
          <span className="text-muted">Propuesta: </span>
          <ConMontos texto={operacion} />
        </p>
      ) : d.accion === 'ninguna' ? null : (
        <p className="mt-1 text-sm text-muted">{NOMBRE_ACCION[d.accion]}</p>
      )}
      <Motivos
        // La propuesta de completar ya está arriba, con su fórmula: no se repite.
        motivos={estado === 'pendiente' || estado === 'aceptada' ? [] : completa ? d.motivos.filter((m) => !m.startsWith('Completar el precio')) : d.motivos}
        principal={estado === 'error'}
      />
      {eleccion?.motivo && (estado === 'pendiente' || estado === 'aceptada') ? (
        <p className="mt-1 text-sm text-muted">Elegiste: {eleccion.motivo}.</p>
      ) : null}
      {modo === 'ver' ? <DosLecturas campos={lecturas} /> : null}

      {modo === 'operacion' && d.operacion ? (
        <EditorOperacion
          d={d}
          onCancelar={() => setModo('ver')}
          onAceptar={(op) => {
            onElegir(d, { resolucion: 'aceptada', motivo: `acepté la ${nombreOperacion(d.operacion!.tipo)} corregida`, operacion: op })
            setModo('ver')
          }}
        />
      ) : null}
      {modo === 'precio' && completa ? (
        <EditorPrecioCompra
          d={d}
          inicial={precioElegido ?? completa.precio}
          onCancelar={() => setModo('ver')}
          onAceptar={(p) => {
            onElegir(d, {
              resolucion: 'aceptada',
              motivo: `completé el precio de la compra del ${fechaCorta(completa.fecha)} a mano`,
              operacion: null,
              precio_completar: p,
            })
            setModo('ver')
          }}
        />
      ) : null}
      {modo === 'lectura' ? (
        <EditorLectura
          d={d}
          edicion={edicion}
          onCancelar={() => setModo('ver')}
          onQuitar={() => {
            onEditar(d.clave, null)
            setModo('ver')
          }}
          onGuardar={(e) => {
            onEditar(d.clave, e)
            setModo('ver')
          }}
        />
      ) : null}
      {modo === 'alta' && d.activo_nuevo ? (
        <AltaActivo
          sugerido={d.activo_nuevo}
          onCancelar={() => setModo('ver')}
          onCreado={(a) => {
            onAlta(a)
            setModo('ver')
          }}
        />
      ) : null}

      {modo === 'ver' ? (
        <Acciones dosPorFila={Boolean(completa)}>
          {estado === 'advertencia' && completa ? (
            <Boton variante="primario" onClick={aceptar} title="Completar (A)">
              Completar<span className="max-sm:hidden">
                {' '}
                a <span className="num monto">{precio(completa.precio)}</span>
              </span>
            </Boton>
          ) : estado === 'advertencia' ? (
            <Boton variante="primario" onClick={aceptar} title="Aceptar (A)">
              {d.operacion ? `Aceptar ${nombreOperacion(d.operacion.tipo)}` : d.accion === 'revisar' ? 'Grabar solo el precio' : 'Aceptar'}
            </Boton>
          ) : null}
          {puedeApertura ? (
            <Boton variante="secundario" onClick={yaLaTenia} title="Ya la tenía: entra como apertura con el PPP">
              Ya la tenía (apertura)
            </Boton>
          ) : null}
          {estado === 'sin_alta' ? (
            <Boton variante="primario" onClick={() => setModo('alta')} title="Dar de alta (A)">
              Dar de alta {d.ticker}
            </Boton>
          ) : null}
          {estado === 'error' && faltaCcl ? (
            <Boton variante="primario" onClick={onIrAlCcl}>
              Tipear el CCL
            </Boton>
          ) : null}
          {estado === 'error' && !faltaCcl && !enDolares ? (
            <Boton variante="primario" onClick={() => setModo('lectura')} title="Editar (E)">
              Editar
            </Boton>
          ) : null}
          {(estado === 'advertencia' || estado === 'aceptada') && completa ? (
            <>
              <Boton variante="secundario" onClick={() => setModo('precio')} title="Editar (E)">
                Editar precio
              </Boton>
              {estado === 'advertencia' ? (
                <Boton
                  variante="secundario"
                  onClick={() =>
                    onElegir(d, { resolucion: 'aceptada', motivo: 'grabé la fila sin completar el precio', operacion: null, precio_completar: null })
                  }
                >
                  Grabar sin completar
                </Boton>
              ) : null}
            </>
          ) : null}
          {(estado === 'advertencia' || estado === 'aceptada') && d.operacion && !comoApertura ? (
            <Boton variante="secundario" onClick={() => setModo('operacion')} title="Editar (E)">
              Editar {nombreOperacion(d.operacion.tipo)}
            </Boton>
          ) : null}
          {estado !== 'pendiente' && estado !== 'error' && !d.operacion && !completa ? (
            <Boton variante="secundario" onClick={() => setModo('lectura')} title="Editar (E)">
              Corregir lectura
            </Boton>
          ) : null}
          {edicion && estado !== 'error' ? (
            <Boton variante="fantasma" onClick={() => onEditar(d.clave, null)}>
              Volver a lo leído
            </Boton>
          ) : null}
          {estado === 'pendiente' || estado === 'aceptada' ? (
            <Boton variante="fantasma" onClick={() => onElegir(d, null)}>
              Deshacer elección
            </Boton>
          ) : (
            <Boton variante="fantasma" onClick={pendiente} title="Dejar pendiente (P)">
              Dejar pendiente
            </Boton>
          )}
        </Acciones>
      ) : null}
    </Fila>
  )
}

// ───────────── Saldo ─────────────

function ItemSaldo({
  d,
  estado,
  eleccion,
  fecha,
  onElegir,
}: {
  d: DecisionSaldo
  estado: EstadoItem
  eleccion: EleccionSaldo | null
  fecha: Fecha
  onElegir: (d: DecisionSaldo, e: Omit<EleccionSaldo, 'huella'> | null) => void
}) {
  const id = useId()
  const [tipeando, setTipeando] = useState(false)
  const [texto, setTexto] = useState(aEditable(d.monto))
  const [error, setError] = useState<string | null>(null)
  const alternativas = alternativasSaldo(d.saldo)
  const partes = d.saldo.partes.filter((p) => !/lectura/i.test(p.concepto))
  const mostrado = eleccion?.monto ?? d.monto
  const moneda = d.moneda
  const salto = d.anterior ? saltoDeSaldo(d.anterior.monto, mostrado, d.saldo.tna, diasEntre(d.anterior.fecha, fecha)) : null

  const elegirPrimera = () => {
    if (alternativas.length) {
      const a = alternativas.find((x) => x.propuesta) ?? alternativas[0]
      onElegir(d, { resolucion: 'aceptada', monto: a.monto, motivo: `elegí la ${a.concepto}` })
    } else if (estado === 'error') {
      setTipeando(true)
    } else if (estado === 'advertencia') {
      onElegir(d, { resolucion: 'aceptada', monto: null, motivo: 'acepté el saldo leído' })
    }
  }
  const tipear = () => {
    const r = leerMonto(texto)
    if (r.error) return setError(r.error)
    onElegir(d, { resolucion: 'aceptada', monto: r.valor, motivo: 'lo tipeé a mano' })
    setTipeando(false)
  }

  return (
    <Fila
      estado={estado}
      titulo={`${d.cuenta} · saldo en ${moneda === 'ARS' ? 'pesos' : 'dólares'}`}
      onKeyDown={(e) =>
        teclasFila(e, {
          a: estado === 'pendiente' ? undefined : elegirPrimera,
          e: () => setTipeando(true),
          p: () => onElegir(d, { resolucion: 'pendiente', monto: null, motivo: 'lo dejé pendiente' }),
        })
      }
    >
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <Dato etiqueta={eleccion?.monto ? 'Elegido' : 'Leí'}>
          <M usd={moneda === 'USD'}>{montoMoneda(mostrado, moneda)}</M>
        </Dato>
        <Dato etiqueta="Antes">
          {d.anterior ? (
            <>
              <M usd={moneda === 'USD'}>{montoMoneda(d.anterior.monto, moneda)}</M> <span className="text-xs text-muted">({fechaCorta(d.anterior.fecha)})</span>
            </>
          ) : (
            'primera carga'
          )}
        </Dato>
        {salto ? (
          <Dato etiqueta="Cambio">
            <M usd={moneda === 'USD'}>{monto(salto.suba, moneda, { decimales: 2, signo: true })}</M>
          </Dato>
        ) : null}
        {/* El lector guarda la TNA en porcentaje, como la muestra la captura. */}
        {d.saldo.tna ? <Dato etiqueta="TNA de la captura">{numero(d.saldo.tna, 2, { min: 1 })}%</Dato> : null}
      </dl>
      {partes.length ? (
        <p className="num mt-1 break-words text-xs text-muted">
          ={' '}
          {partes.map((p, i) => (
            <span key={i}>
              {i ? ' + ' : ''}
              {p.concepto} <M usd={moneda === 'USD'}>{montoMoneda(p.monto, moneda)}</M>
            </span>
          ))}
        </p>
      ) : null}
      {salto?.sinExplicar || salto?.baja ? (
        <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-text">
          <span className="font-medium">¿Entró o salió plata?</span>{' '}
          {salto.sinExplicar ? (
            <>
              Subió <M usd={moneda === 'USD'}>{montoMoneda(salto.sinExplicar, moneda)}</M> más de lo que explica la TNA de la captura.
            </>
          ) : (
            <>
              Bajó <M usd={moneda === 'USD'}>{montoMoneda(salto.baja!, moneda)}</M>, y los intereses no restan.
            </>
          )}{' '}
          Sin registrar el movimiento, se lee como {salto.sinExplicar ? 'ganancia' : 'pérdida'} (D-06).{' '}
          <Link
            href={enlaceMovimiento({
              tipo: salto.sinExplicar ? 'aporte' : 'retiro',
              cuenta_id: d.cuenta_id,
              moneda,
              monto: (salto.sinExplicar ?? salto.baja)!,
              fecha,
            })}
            target="_blank"
            rel="noopener"
            className="tocable inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-2 lg:min-h-0"
          >
            Registrar el {salto.sinExplicar ? 'aporte' : 'retiro'} en Datos › Movimientos (se abre aparte)
          </Link>
        </p>
      ) : null}
      <Motivos motivos={estado === 'pendiente' || estado === 'aceptada' ? [] : d.motivos} />
      {eleccion?.motivo && (estado === 'pendiente' || estado === 'aceptada') ? (
        <p className="mt-1 text-sm text-muted">Elegiste: {eleccion.motivo}.</p>
      ) : null}
      {!tipeando && alternativas.length >= 2 && estado !== 'pendiente' ? (
        <DosLecturas
          campos={[
            {
              etiqueta: 'Saldo',
              monto: true,
              // Un saldo no tiene control aritmético (manual §12): la propuesta no "cierra" nada.
              rotulo: 'propuesta',
              opciones: alternativas.slice(0, 2).map((a, i) => ({
                lectura: i === 0 ? ('A' as const) : ('B' as const),
                texto: montoMoneda(a.monto, moneda),
                propuesta: a.propuesta,
                elegida: eleccion?.monto === a.monto,
                onElegir: () => onElegir(d, { resolucion: 'aceptada', monto: a.monto, motivo: `elegí la ${a.concepto}` }),
              })),
            },
          ]}
        />
      ) : null}
      {tipeando ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-border bg-surface-2 p-3 sm:grid-cols-[1fr_auto]" onKeyDown={(e) => e.stopPropagation()}>
          <div className="min-w-0 space-y-1">
            <label htmlFor={`${id}-m`} className="text-sm font-medium">
              Saldo en {moneda === 'ARS' ? 'pesos' : 'dólares'} (puede ser negativo)
            </label>
            <Entrada
              id={`${id}-m`}
              inputMode="decimal"
              value={texto}
              autoFocus
              className="num"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  tipear()
                }
              }}
            />
            {error ? <p className="text-sm text-negative">{error}</p> : null}
          </div>
          <div className="flex items-end gap-2 [&>*]:max-sm:flex-1">
            <Boton variante="primario" onClick={tipear}>
              Usar este saldo
            </Boton>
            <Boton variante="fantasma" onClick={() => setTipeando(false)}>
              Cancelar
            </Boton>
          </div>
        </div>
      ) : (
        <Acciones>

          {estado === 'advertencia' && !alternativas.length ? (
            <Boton variante="primario" onClick={elegirPrimera} title="Aceptar (A)">
              Aceptar saldo
            </Boton>
          ) : null}
          {estado !== 'pendiente' ? (
            <Boton variante={estado === 'error' && !alternativas.length ? 'primario' : 'secundario'} onClick={() => setTipeando(true)} title="Editar (E)">
              Tipear el saldo
            </Boton>
          ) : null}
          {estado === 'pendiente' || estado === 'aceptada' ? (
            <Boton variante="fantasma" onClick={() => onElegir(d, null)}>
              Deshacer elección
            </Boton>
          ) : (
            <Boton variante="fantasma" onClick={() => onElegir(d, { resolucion: 'pendiente', monto: null, motivo: 'lo dejé pendiente' })} title="Dejar pendiente (P)">
              Dejar pendiente
            </Boton>
          )}
        </Acciones>
      )}
    </Fila>
  )
}

// ───────────── Tenencia que la fuente ya no lista ─────────────

function EditorAusente({
  a,
  tipo,
  inicial,
  onRegistrar,
  onCancelar,
}: {
  a: AusentePropuesto
  tipo: 'venta' | 'vencimiento'
  inicial: RegistroAusente | null
  onRegistrar: (r: RegistroAusente) => void
  onCancelar: () => void
}) {
  const id = useId()
  const [p, setP] = useState(aEditable(inicial?.tipo === tipo ? inicial.precio : null))
  const [imp, setImp] = useState(aEditable(inicial?.tipo === tipo ? inicial.importe : null))
  const [error, setError] = useState<string | null>(null)
  function registrar() {
    let precioFinal: string | null = null
    let importe: string | null = null
    if (tipo === 'venta' && p.trim() !== '') {
      const cp = leerMonto(p, { positivo: true })
      if (cp.error) return setError(`Precio: ${cp.error}`)
      precioFinal = cp.valor
    }
    if (imp.trim() !== '') {
      const ci = leerMonto(imp, { positivo: true })
      if (ci.error) return setError(`Importe: ${ci.error}`)
      importe = ci.valor
    }
    const r: RegistroAusente = { tipo, cantidad: a.cantidad_app, precio: precioFinal, importe }
    const problema = problemaRegistroAusente({ ...a, ccl_del_dia: a.ccl_del_dia ?? '1' }, r)
    if (problema) return setError(`${problema.charAt(0).toUpperCase()}${problema.slice(1)}.`)
    onRegistrar(r)
  }
  const alEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      registrar()
    }
  }
  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-border bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_auto]" onKeyDown={(e) => e.stopPropagation()}>
      {tipo === 'venta' ? (
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${id}-p`} className="text-sm font-medium">
            Precio de venta por 1 VN / unidad, en pesos
          </label>
          <Entrada id={`${id}-p`} inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} className="num" autoFocus onKeyDown={alEnter} />
        </div>
      ) : null}
      <div className="min-w-0 space-y-1">
        <label htmlFor={`${id}-i`} className="text-sm font-medium">
          {tipo === 'venta' ? (
            <>
              o el importe total cobrado <span className="font-normal text-muted">(en pesos)</span>
            </>
          ) : (
            'Importe cobrado, en pesos (el total)'
          )}
        </label>
        <Entrada
          id={`${id}-i`}
          inputMode="decimal"
          value={imp}
          onChange={(e) => setImp(e.target.value)}
          className="num"
          autoFocus={tipo === 'vencimiento'}
          onKeyDown={alEnter}
        />
      </div>
      <div className="flex items-end gap-2 [&>*]:max-sm:flex-1">
        <Boton variante="primario" onClick={registrar}>
          Registrar así
        </Boton>
        <Boton variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
      {error ? <p role="alert" className="text-sm text-negative sm:col-span-3">{error}</p> : null}
    </div>
  )
}

function ItemAusente({
  a,
  estado,
  eleccion,
  onElegir,
  onIrAlCcl,
  clave,
}: {
  a: AusentePropuesto
  clave: string
  estado: EstadoItem
  eleccion: EleccionAusente | null
  onElegir: (clave: string, e: EleccionAusente | null) => void
  onIrAlCcl: () => void
}) {
  const [editando, setEditando] = useState<'venta' | 'vencimiento' | null>(null)
  const registro = eleccion && typeof eleccion === 'object' ? eleccion : null
  const problema = registro ? problemaRegistroAusente(a, registro) : null
  const renta = a.tipo_activo === 'bono' || a.tipo_activo === 'lecap'
  const nombreOp = (t: 'venta' | 'vencimiento') => (t === 'venta' ? 'venta' : 'vencimiento')
  return (
    <Fila
      estado={estado}
      titulo={
        <>
          {a.cuenta} · <span className="num">{a.ticker}</span>
        </>
      }
      subtitulo="la fuente no lo trae"
      onKeyDown={(e) =>
        teclasFila(e, {
          e: () => setEditando(a.sugerida),
          p: () => onElegir(clave, 'pendiente'),
        })
      }
    >
      <p className="mt-1 text-sm text-muted">
        La app tiene <span className="num">{cantidad(a.cantidad_app)}</span> y {a.cuenta} ya no lo lista: ¿lo vendiste todo{renta ? ' o venció' : ''}?
        Registralo con lo que cobraste. Si lo dejás pendiente, desde esta carga vale «sin dato» hasta que lo registres.
      </p>
      {a.ultimo_precio ? (
        <p className="mt-1 text-xs text-muted">
          Último precio en la app: <M>{precio(a.ultimo_precio.precio_pesos)}</M> por 1 VN ({fechaCorta(a.ultimo_precio.fecha)}). Es solo una referencia: no se usa
          solo.
        </p>
      ) : null}
      {registro ? (
        <p className="mt-1 text-sm text-text">
          <span className="text-muted">Registrás: </span>
          {nombreOp(registro.tipo).charAt(0).toUpperCase()}
          {nombreOp(registro.tipo).slice(1)} de <span className="num">{cantidad(registro.cantidad)}</span>
          {registro.precio ? (
            <>
              {' '}
              a <M>{precio(registro.precio)}</M>
            </>
          ) : null}
          {registro.importe ? (
            <>
              {' '}
              por <M>{pesos(registro.importe)}</M> cobrados
            </>
          ) : null}
          {a.ccl_del_dia ? <> · CCL {numero(a.ccl_del_dia, 2)}</> : null}
        </p>
      ) : null}
      {problema ? <Motivos motivos={[`${problema.charAt(0).toUpperCase()}${problema.slice(1)}.`]} principal /> : null}
      {!registro && a.ccl_del_dia === null && estado !== 'pendiente' ? (
        <p className="mt-1 text-sm text-muted">Para registrarlo hace falta el CCL del día.</p>
      ) : null}
      {editando ? (
        <EditorAusente
          a={a}
          tipo={editando}
          inicial={registro}
          onCancelar={() => setEditando(null)}
          onRegistrar={(r) => {
            onElegir(clave, r)
            setEditando(null)
          }}
        />
      ) : (
        <Acciones>
          {estado === 'pendiente' || estado === 'aceptada' || registro ? (
            <Boton variante="fantasma" onClick={() => onElegir(clave, null)}>
              Deshacer elección
            </Boton>
          ) : null}
          {estado !== 'pendiente'
            ? a.opciones.map((t, i) => (
                <Boton key={t} variante={i === 0 && !registro ? 'primario' : 'secundario'} onClick={() => setEditando(t)} title={i === 0 ? 'Registrar (E)' : undefined}>
                  {registro?.tipo === t ? `Editar ${nombreOp(t)}` : `Registrar ${nombreOp(t)}`}
                </Boton>
              ))
            : null}
          {a.ccl_del_dia === null && estado !== 'pendiente' ? (
            <Boton variante="secundario" onClick={onIrAlCcl}>
              Tipear el CCL
            </Boton>
          ) : null}
          {estado !== 'pendiente' && !registro ? (
            <Boton variante="fantasma" onClick={() => onElegir(clave, 'pendiente')} title="Dejar pendiente (P)">
              Dejar pendiente
            </Boton>
          ) : null}
        </Acciones>
      )}
    </Fila>
  )
}

// ───────────── Bandeja ─────────────

export function Bandeja({
  resumen,
  propuesta,
  eleccionDe,
  edicionDe,
  avisos,
  fecha,
  proponiendo,
  error,
  onFila,
  onSaldo,
  onAusente,
  onEditar,
  onAlta,
  onIrAlCcl,
  tiposTipeados,
  originalDe,
  dolarIEB,
  ccl,
  onAceptarAlVolver,
}: {
  onAceptarAlVolver?: (clave: string, motivo: string) => void
  tiposTipeados: string[]
  /** La fila tal como la leyó el lector (sin ediciones), por clave. */
  originalDe?: (clave: string) => FilaLeida | null
  /** Precio de DOLARUSA del Excel de IEB (D-66). */
  dolarIEB?: string | null
  /** CCL tipeado (decimal normalizado). */
  ccl?: string | null
  resumen: ResumenBandeja
  propuesta: PropuestaCarga | null
  eleccionDe: {
    fila: (d: DecisionFila) => EleccionFila | null
    saldo: (d: DecisionSaldo) => EleccionSaldo | null
    ausente: (clave: string) => EleccionAusente | null
  }
  edicionDe: (clave: string) => EdicionFila | null
  avisos: string[]
  fecha: Fecha
  proponiendo: boolean
  error: string | null
  onFila: (d: DecisionFila, e: Omit<EleccionFila, 'huella'> | null) => void
  onSaldo: (d: DecisionSaldo, e: Omit<EleccionSaldo, 'huella'> | null) => void
  onAusente: (clave: string, e: EleccionAusente | null) => void
  onEditar: (clave: string, e: EdicionFila | null) => void
  onAlta: (a: ActivoLocal) => void
  onIrAlCcl: () => void
}) {
  const [verVerificadas, setVerVerificadas] = useState(false)
  const items = resumen.items
  const verificadas = items.filter((i) => i.estado === 'verificada')
  const resto = items.filter((i) => i.estado !== 'verificada')

  const render = (i: ItemBandeja) => {
    if (i.tipo === 'fila' && i.fila) {
      return (
        <ItemFila
          key={i.clave}
          d={i.fila}
          estado={i.estado}
          eleccion={eleccionDe.fila(i.fila)}
          edicion={edicionDe(i.clave)}
          original={originalDe?.(i.clave) ?? null}
          onAceptarAlVolver={onAceptarAlVolver}
          onElegir={onFila}
          onEditar={onEditar}
          onAlta={onAlta}
          onIrAlCcl={onIrAlCcl}
        />
      )
    }
    if (i.tipo === 'saldo' && i.saldo) {
      return <ItemSaldo key={i.clave} d={i.saldo} estado={i.estado} eleccion={eleccionDe.saldo(i.saldo)} fecha={fecha} onElegir={onSaldo} />
    }
    if (i.tipo === 'ausente' && i.ausente) {
      return (
        <ItemAusente
          key={i.clave}
          clave={i.clave}
          a={i.ausente}
          estado={i.estado}
          eleccion={eleccionDe.ausente(i.clave)}
          onElegir={onAusente}
          onIrAlCcl={onIrAlCcl}
        />
      )
    }
    return null
  }

  return (
    <section aria-labelledby="titulo-bandeja" className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="titulo-bandeja" className="text-sm font-semibold tracking-wide text-muted uppercase">
          Bandeja
        </h2>
        <p className="text-sm text-text tabular-nums" aria-live="polite">
          {resumen.leidas} leídas · {resumen.verificadas} verificadas · {resumen.aRevisar} a revisar
          {resumen.pendientes ? ` · ${resumen.pendientes} pendientes` : ''}
        </p>
        {proponiendo ? <span className="text-sm text-muted">revisando…</span> : null}
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative">
          {error}
        </p>
      ) : null}
      {avisos.length ? (
        <ul className="space-y-1">
          {avisos.map((a) => (
            <li key={a} className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
              {a}
            </li>
          ))}
        </ul>
      ) : null}

      {resto.length ? <ul className="space-y-2">{resto.map(render)}</ul> : null}

      {verificadas.length ? (
        <div className="rounded-xl border border-border bg-surface">
          <button
            type="button"
            className="tocable flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm"
            aria-expanded={verVerificadas}
            onClick={() => setVerVerificadas((v) => !v)}
          >
            <ChevronRight aria-hidden className={`size-4 shrink-0 text-muted transition-transform ${verVerificadas ? 'rotate-90' : ''}`} />
            <Chip tono="azul">✓</Chip>
            <span className="min-w-0 text-text">
              {verificadas.length} {verificadas.length === 1 ? 'verificada' : 'verificadas'}
              {(() => {
                const sinCambio = verificadas.filter((i) => i.fila?.accion === 'ninguna').length
                const aperturas = verificadas.filter((i) => i.fila?.accion === 'apertura').length
                const partes = [sinCambio ? `${sinCambio} sin cambio de cantidad` : null, aperturas ? `${aperturas} aperturas` : null].filter(Boolean)
                return partes.length ? <span className="text-muted"> · {partes.join(' · ')}</span> : null
              })()}
            </span>
            <span className="ml-auto shrink-0 text-xs text-muted">se guardan con el Enter</span>
          </button>
          {verVerificadas ? <ul className="space-y-2 border-t border-border p-2">{verificadas.map(render)}</ul> : null}
        </div>
      ) : null}

      {tiposTipeados.length ? (
        <p className="text-sm text-muted">
          <Chip tono="neutro">○</Chip> {tiposTipeados.join(' y ')} {tiposTipeados.length === 1 ? 'tipeado' : 'tipeados'}: se guarda{tiposTipeados.length === 1 ? '' : 'n'} tal cual, sin control
          posible.
        </p>
      ) : null}

      {(() => {
        const dif = diferenciaDolarIEB(dolarIEB, ccl ?? null)
        if (!dif) return null
        return (
          <p className="num break-words text-sm text-muted">
            <Chip tono="neutro">≠</Chip> DOLARUSA al dólar de IEB <M>{pesos(dif.dolar)}</M> vs tu CCL <M>{pesos(dif.ccl)}</M>: diferencia{' '}
            <M>{monto(dif.diferencia, 'ARS', { decimales: 2, signo: true })}</M> ({porcentaje(dif.fraccion, { signo: true })}). IEB valúa tus dólares con el suyo; la
            app, con tu CCL.
          </p>
        )
      })()}
      {propuesta?.controles.length ? (
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-muted">Controles</h3>
          <ul className="space-y-1">
            {propuesta.controles.map(({ cuenta, control: c }, k) => (
              <li key={k} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
                <Chip tono={c.ok === false ? 'aviso' : c.ok ? 'azul' : 'neutro'}>{c.ok === false ? '≠' : c.ok ? '✓' : '○'}</Chip>
                <span className="text-text">
                  {cuenta} · {c.tipo === 'ieb_b2' ? 'cierra contra B2' : c.tipo === 'ieb_subtotal' ? `subtotal ${c.seccion ?? ''}` : 'total de la captura'}
                </span>
                <span className="num min-w-0 break-words text-muted">
                  <M usd={c.moneda === 'USD'}>{montoMoneda(c.informado, c.moneda ?? 'ARS')}</M>
                  {c.calculado !== null ? (
                    <>
                      {` ${c.ok ? '=' : '≠'} `}
                      <M usd={c.moneda === 'USD'}>{montoMoneda(c.calculado, c.moneda ?? 'ARS')}</M>
                    </>
                  ) : null}
                </span>
                {c.detalle ? (
                  <span className="min-w-0 text-xs text-muted">
                    <ConMontos texto={c.detalle} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
