'use client'

// La bandeja de revisión (4.2.1 de la visión): primero lo que no cerró, lo
// verificado plegado en una línea. Las advertencias se aceptan de a una (nunca
// con el Enter general); los errores se editan o se dejan pendientes.
// Teclado: ↑/↓ entre filas; con una fila enfocada, A acepta, E edita y P la
// deja pendiente (solo si ningún campo tiene el foco).

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { DecisionFila, DecisionSaldo, PropuestaCarga } from '@/lib/carga/contratos'
import { monto, numero } from '@/lib/domain/dinero'
import { diasEntre, fechaCorta } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import { alternativasSaldo, saltoDeSaldo, type EleccionFila, type EleccionSaldo, type EstadoItem, type ItemBandeja, type ResumenBandeja } from '../_lib/bandeja'
import type { ActivoLocal } from '../_lib/demo'
import type { EdicionFila } from '../_lib/ediciones'
import { leerMonto } from '../_lib/entrada'
import { AltaActivo } from './alta-activo'
import { Boton, Chip, Entrada } from './ui'

// ───────────── Formato ─────────────

function decimalesDe(v: string): number {
  const i = v.indexOf('.')
  return i === -1 ? 0 : v.length - i - 1
}

const pesos = (v: string, dec = 2) => monto(v, 'ARS', { decimales: dec })
const precio = (v: string) => monto(v, 'ARS', { decimales: Math.min(6, Math.max(2, decimalesDe(v))) })
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
  revisar: 'a revisar',
}

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

function Motivos({ motivos }: { motivos: string[] }) {
  if (!motivos.length) return null
  return (
    <ul className="mt-1 space-y-0.5 text-sm text-muted">
      {motivos.map((m, i) => (
        <li key={i} className="break-words">
          {m}
        </li>
      ))}
    </ul>
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

function Acciones({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-wrap gap-2 [&>*]:max-sm:flex-1">{children}</div>
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
  function aceptar() {
    const cq = leerMonto(q, { positivo: true })
    if (cq.error) return setError(`Cantidad: ${cq.error}`)
    let precioFinal: string | null = null
    if (p.trim() !== '') {
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
          Cantidad de la {op.tipo}
        </label>
        <Entrada id={`${id}-q`} inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} className="num" autoFocus />
      </div>
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
        {d.fila.valorizado ? <> ({pesos(d.fila.valorizado)})</> : ' (esta fila no trae valorizado: no hay control)'}.
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

function textoOperacion(d: DecisionFila, el: EleccionFila | null): string | null {
  const op = el?.operacion ? { ...d.operacion!, ...el.operacion } : d.operacion
  if (!op) return null
  const q = cantidad(op.cantidad)
  const p = op.precio ? ` a ${precio(op.precio)}` : op.tipo === 'apertura' ? ' (costo sin dato)' : ' (precio pendiente)'
  const ccl = op.tipo !== 'apertura' && op.ccl_del_dia ? ` · CCL ${numero(op.ccl_del_dia, 2)}` : ''
  const nombre = op.tipo === 'apertura' ? 'Apertura' : op.tipo === 'compra' ? 'Compra' : op.tipo === 'venta' ? 'Venta' : op.tipo
  return `${nombre} de ${q}${p}${ccl}${el?.operacion ? ' (corregida)' : ''}`
}

function ItemFila({
  d,
  estado,
  eleccion,
  edicion,
  onElegir,
  onEditar,
  onAlta,
  onIrAlCcl,
}: {
  d: DecisionFila
  estado: EstadoItem
  eleccion: EleccionFila | null
  edicion: EdicionFila | null
  onElegir: (d: DecisionFila, e: Omit<EleccionFila, 'huella'> | null) => void
  onEditar: (clave: string, e: EdicionFila | null) => void
  onAlta: (a: ActivoLocal) => void
  onIrAlCcl: () => void
}) {
  const [modo, setModo] = useState<'ver' | 'operacion' | 'lectura' | 'alta'>('ver')
  const f = d.fila
  const faltaCcl = d.motivos.some((m) => m.startsWith('Falta el CCL'))
  const operacion = textoOperacion(d, eleccion)

  const aceptar = () => {
    if (estado === 'sin_alta') return setModo('alta')
    if (estado === 'error') return setModo('lectura')
    if (estado === 'advertencia') {
      onElegir(d, {
        resolucion: 'aceptada',
        motivo: d.operacion ? `acepté la ${d.operacion.tipo} propuesta` : 'acepté la fila leída',
        operacion: null,
      })
    }
  }
  const pendiente = () => onElegir(d, { resolucion: 'pendiente', motivo: 'la dejé pendiente', operacion: null })
  const editar = () => setModo(d.operacion && estado !== 'error' ? 'operacion' : 'lectura')

  const escala =
    f.escala && f.escala !== '1' && f.precio_mostrado
      ? `La fuente muestra ${numero(f.precio_mostrado, 4, { min: 2 })} cada ${f.escala === '0.01' ? '100' : '1.000'} VN`
      : ''

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
        <Dato etiqueta="Precio por 1 VN">{f.precio_unitario ? precio(f.precio_unitario) : 'sin dato'}</Dato>
        <Dato etiqueta="Valorizado">{f.valorizado ? pesos(f.valorizado) : 'sin dato'}</Dato>
      </dl>
      {escala ? <p className="mt-1 text-xs text-muted">{escala}.</p> : null}
      {f.chequeo ? (
        <p className={`num mt-1 break-words text-xs ${f.chequeo.ok ? 'text-muted' : 'text-negative'}`}>
          {f.chequeo.ok ? '✓' : '≠'} {f.chequeo.regla}: {pesos(f.chequeo.calculado)} {f.chequeo.ok ? '≈' : 'contra'} {pesos(f.chequeo.esperado)} (±{pesos(f.chequeo.tolerancia)})
        </p>
      ) : null}
      {operacion ? (
        <p className="mt-1 text-sm text-text">
          <span className="text-muted">Propuesta: </span>
          {operacion}
        </p>
      ) : d.accion === 'ninguna' ? null : (
        <p className="mt-1 text-sm text-muted">{NOMBRE_ACCION[d.accion]}</p>
      )}
      <Motivos motivos={estado === 'pendiente' || estado === 'aceptada' ? [] : d.motivos} />
      {eleccion?.motivo && (estado === 'pendiente' || estado === 'aceptada') ? (
        <p className="mt-1 text-sm text-muted">Elegiste: {eleccion.motivo}.</p>
      ) : null}

      {modo === 'operacion' && d.operacion ? (
        <EditorOperacion
          d={d}
          onCancelar={() => setModo('ver')}
          onAceptar={(op) => {
            onElegir(d, { resolucion: 'aceptada', motivo: `acepté la ${d.operacion!.tipo} corregida`, operacion: op })
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
        <Acciones>
          {estado === 'advertencia' ? (
            <Boton variante="primario" onClick={aceptar} title="Aceptar (A)">
              Aceptar{d.operacion ? ` ${d.operacion.tipo}` : ''}
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
          {estado === 'error' && !faltaCcl ? (
            <Boton variante="primario" onClick={() => setModo('lectura')} title="Editar (E)">
              Editar
            </Boton>
          ) : null}
          {(estado === 'advertencia' || estado === 'aceptada') && d.operacion ? (
            <Boton variante="secundario" onClick={() => setModo('operacion')} title="Editar (E)">
              Editar {d.operacion.tipo}
            </Boton>
          ) : null}
          {estado !== 'pendiente' && estado !== 'error' && !d.operacion ? (
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
      onElegir(d, { resolucion: 'aceptada', monto: alternativas[0].monto, motivo: `elegí la ${alternativas[0].concepto}` })
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
          <span className={moneda === 'USD' ? 'usd' : ''}>{montoMoneda(mostrado, moneda)}</span>
        </Dato>
        <Dato etiqueta="Antes">
          {d.anterior ? (
            <>
              {montoMoneda(d.anterior.monto, moneda)} <span className="text-xs text-muted">({fechaCorta(d.anterior.fecha)})</span>
            </>
          ) : (
            'primera carga'
          )}
        </Dato>
        {salto ? (
          <Dato etiqueta="Cambio">{monto(salto.suba, moneda, { decimales: 2, signo: true })}</Dato>
        ) : null}
        {d.saldo.tna ? <Dato etiqueta="TNA de la captura">{numero(d.saldo.tna, 2, { min: 1 })}{Number(d.saldo.tna) > 1 ? '%' : ''}</Dato> : null}
      </dl>
      {partes.length ? (
        <p className="num mt-1 break-words text-xs text-muted">
          = {partes.map((p) => `${p.concepto} ${montoMoneda(p.monto, moneda)}`).join(' + ')}
        </p>
      ) : null}
      {salto?.sinExplicar ? (
        <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-text">
          <span className="font-medium">¿Entró o salió plata?</span> Subió {montoMoneda(salto.sinExplicar, moneda)} más de lo que explica
          la TNA de la captura. Por ahora solo te lo marco: anotalo en la nota del día si fue un movimiento.
        </p>
      ) : null}
      <Motivos motivos={estado === 'pendiente' || estado === 'aceptada' ? [] : d.motivos} />
      {eleccion?.motivo && (estado === 'pendiente' || estado === 'aceptada') ? (
        <p className="mt-1 text-sm text-muted">Elegiste: {eleccion.motivo}.</p>
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
          {(estado === 'advertencia' || estado === 'error') && alternativas.length
            ? alternativas.map((a, i) => (
                <Boton key={a.concepto} variante={i === 0 ? 'primario' : 'secundario'} onClick={() => onElegir(d, { resolucion: 'aceptada', monto: a.monto, motivo: `elegí la ${a.concepto}` })}>
                  Elegir <span className="num">{montoMoneda(a.monto, moneda)}</span>
                </Boton>
              ))
            : null}
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
}: {
  tiposTipeados: string[]
  resumen: ResumenBandeja
  propuesta: PropuestaCarga | null
  eleccionDe: { fila: (d: DecisionFila) => EleccionFila | null; saldo: (d: DecisionSaldo) => EleccionSaldo | null }
  edicionDe: (clave: string) => EdicionFila | null
  avisos: string[]
  fecha: Fecha
  proponiendo: boolean
  error: string | null
  onFila: (d: DecisionFila, e: Omit<EleccionFila, 'huella'> | null) => void
  onSaldo: (d: DecisionSaldo, e: Omit<EleccionSaldo, 'huella'> | null) => void
  onAusente: (clave: string, pendiente: boolean) => void
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
      const a = i.ausente
      return (
        <Fila
          key={i.clave}
          estado={i.estado}
          titulo={
            <>
              {a.cuenta} · <span className="num">{a.ticker}</span>
            </>
          }
          subtitulo="la fuente no lo trae"
          onKeyDown={(e) => teclasFila(e, { p: () => onAusente(i.clave, true) })}
        >
          <p className="mt-1 text-sm text-muted">
            La app tiene <span className="num">{cantidad(a.cantidad_app)}</span> y la fuente no lo lista. Si lo vendiste todo, todavía no
            lo puedo registrar desde acá: queda pendiente y la carga de {a.cuenta} queda con el listado incompleto.
          </p>
          <Acciones>
            {i.estado === 'pendiente' ? (
              <Boton variante="fantasma" onClick={() => onAusente(i.clave, false)}>
                Deshacer elección
              </Boton>
            ) : (
              <Boton variante="secundario" onClick={() => onAusente(i.clave, true)} title="Dejar pendiente (P)">
                Dejar pendiente
              </Boton>
            )}
          </Acciones>
        </Fila>
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
                  {pesos(c.informado)}
                  {c.calculado !== null ? ` ${c.ok ? '=' : '≠'} ${pesos(c.calculado)}` : ''}
                </span>
                {c.detalle ? <span className="min-w-0 text-xs text-muted">{c.detalle}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
