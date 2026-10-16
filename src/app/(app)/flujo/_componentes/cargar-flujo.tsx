'use client'

// "Cargar ingreso" / "Cargar gasto" (pedido del dueño del 14/10; plan §6 D.9;
// D-149): un formulario de diez segundos. Monto, moneda, fecha (hoy), concepto
// obligatorio y a qué cuenta entró; si eran dólares vendidos al cripto, el
// cripto y los pesos (los dos o ninguno, con el control de D-37 a la vista).
// Se graba en una transacción con su carga y, si entró a una cuenta seguida,
// su aporte (la próxima carga no lo lee como ganancia).

import { startTransition, useActionState, useRef, useState } from 'react'
import Link from 'next/link'
import { leerNumeroAR } from '@/lib/domain/dinero'
import { avisoCripto, posibleDobleCarga, type MovimientoParaControl } from '@/lib/domain/flujo/control'
import { fechaCorta } from '@/lib/domain/fechas'
import { loteDelEnvio, type LoteEnvio } from '@/app/(app)/datos/_lib/envio'
import { TextoConMontos } from '@/components/monto'
import { clasesBoton } from '@/components/ui'
import { cargarFlujoReal, type EstadoFlujo } from '../acciones'

const INICIAL: EstadoFlujo = { ok: null, mensaje: null, errores: {}, vez: 0 }

// Las opciones son pastillas (sistema visual, D-157): la elegida, en surface-3 con borde de tinta; el foco, con su anillo.
const OPCION =
  'tocable flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-3 text-center text-[14px] leading-tight text-muted transition-colors hover:border-text hover:text-text has-[:checked]:border-text has-[:checked]:bg-surface-3 has-[:checked]:text-text has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus)]'
const CAMPO = 'tocable min-h-11 w-full min-w-0 rounded-item border border-border-strong bg-surface-2 px-3 text-base text-text placeholder:text-faint md:text-sm'
const ROTULO = 'text-[13px] text-muted'

function Error({ texto, id }: { texto?: string; id: string }) {
  return texto ? (
    <p id={id} className="mt-1 text-sm text-negative">
      {texto}
    </p>
  ) : null
}

export function CargarFlujo({
  sentido,
  hoy,
  cuentas,
  criptoHoy,
  movimientos = [],
}: {
  sentido: 'ingreso' | 'gasto'
  hoy: string
  cuentas: { id: number; nombre: string }[]
  /** El cripto de tu última carga, como referencia ("1.541,00"); null sin cripto. */
  criptoHoy: string | null
  /** Aportes y retiros de Datos › Movimientos, para avisar una posible doble carga. */
  movimientos?: MovimientoParaControl[]
}) {
  const [estado, accion, enviando] = useActionState(cargarFlujoReal, INICIAL)
  // Un formulario nuevo después de cada guardado bien hecho.
  return <Formulario key={estado.vez} sentido={sentido} hoy={hoy} cuentas={cuentas} criptoHoy={criptoHoy} movimientos={movimientos} estado={estado} accion={accion} enviando={enviando} />
}

function Formulario({
  sentido,
  hoy,
  cuentas,
  criptoHoy,
  movimientos,
  estado,
  accion,
  enviando,
}: {
  sentido: 'ingreso' | 'gasto'
  hoy: string
  cuentas: { id: number; nombre: string }[]
  criptoHoy: string | null
  movimientos: MovimientoParaControl[]
  estado: EstadoFlujo
  accion: (f: FormData) => void
  enviando: boolean
}) {
  const [moneda, setMoneda] = useState<'USD' | 'ARS' | null>(null)
  const [montoT, setMonto] = useState('')
  const [cripto, setCripto] = useState('')
  const [pesos, setPesos] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [cuenta, setCuenta] = useState<string | null>(null)
  const lote = useRef<LoteEnvio | null>(null)
  const e = estado.errores
  const ingreso = sentido === 'ingreso'
  const conCripto = ingreso && moneda === 'USD'
  const aviso = conCripto ? avisoCripto(montoT, cripto, pesos, leerNumeroAR) : null
  const doble = posibleDobleCarga(movimientos, {
    fecha,
    sentido,
    cuenta_id: cuenta === null || cuenta === 'afuera' ? null : Number(cuenta),
    moneda,
    monto: montoT.trim() ? leerNumeroAR(montoT) : null,
  })
  const nombreCuenta = cuentas.find((c) => String(c.id) === cuenta)?.nombre ?? ''
  const conceptos = ingreso
    ? [
        { valor: 'mensual', texto: 'Ingreso mensual' },
        { valor: 'extraordinario', texto: 'Ingreso extraordinario' },
      ]
    : [
        { valor: 'mensual', texto: 'Gasto fijo del mes' },
        { valor: 'extraordinario', texto: 'Gasto extraordinario' },
      ]

  return (
    <form
      noValidate
      className="space-y-4"
      // Con onSubmit y no con `action`: React 19 vacía los campos después de una
      // acción, y un error de validación no tiene que borrar lo que tipeaste.
      onSubmit={(ev) => {
        ev.preventDefault()
        const fd = new FormData(ev.currentTarget)
        lote.current = loteDelEnvio(lote.current, estado.vez, fd, () => crypto.randomUUID())
        fd.set('lote', lote.current.lote)
        startTransition(() => accion(fd))
      }}
      aria-describedby={estado.mensaje ? 'mensaje-cargar' : undefined}
    >
      <input type="hidden" name="sentido" value={sentido} />

      <fieldset>
        <legend className={ROTULO}>Concepto</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {conceptos.map((c) => (
            <label key={c.valor} className={`${OPCION} border-border-strong`}>
              <input type="radio" name="concepto" value={c.valor} className="sr-only" aria-describedby={e.concepto ? 'error-concepto' : undefined} />
              {c.texto}
            </label>
          ))}
        </div>
        <Error id="error-concepto" texto={e.concepto} />
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <label htmlFor="monto" className={ROTULO}>
            Monto
          </label>
          <input
            id="monto"
            name="monto"
            inputMode="decimal"
            autoComplete="off"
            placeholder={ingreso ? 'Ej.: 3.800' : 'Ej.: 250.000'}
            value={montoT}
            onChange={(ev) => setMonto(ev.target.value)}
            className={`${CAMPO} mt-1`}
            aria-invalid={Boolean(e.monto)}
            aria-describedby={e.monto ? 'error-monto' : undefined}
          />
          <Error id="error-monto" texto={e.monto} />
        </div>
        <fieldset className="min-w-0">
          <legend className={ROTULO}>Moneda</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(['USD', 'ARS'] as const).map((m) => (
              <label key={m} className={`${OPCION} min-w-16 border-border-strong font-mono`}>
                <input type="radio" name="moneda" value={m} className="sr-only" onChange={() => setMoneda(m)} />
                {m === 'USD' ? 'US$' : '$'}
              </label>
            ))}
          </div>
          <Error id="error-moneda" texto={e.moneda} />
        </fieldset>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="fecha" className={ROTULO}>
            Fecha
          </label>
          <input id="fecha" name="fecha" type="date" value={fecha} onChange={(ev) => setFecha(ev.target.value)} max={hoy} className={`${CAMPO} mt-1`} aria-invalid={Boolean(e.fecha)} />
          <Error id="error-fecha" texto={e.fecha} />
        </div>
      </div>

      <fieldset>
        <legend className={ROTULO}>{ingreso ? '¿A qué cuenta entró?' : '¿De qué cuenta salió?'}</legend>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[...cuentas.map((c) => ({ valor: String(c.id), texto: c.nombre })), { valor: 'afuera', texto: 'Afuera' }].map((c) => (
            <label key={c.valor} className={`${OPCION} border-border-strong`}>
              <input type="radio" name="cuenta" value={c.valor} className="sr-only" onChange={() => setCuenta(c.valor)} />
              {c.texto}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">
          {ingreso
            ? '«Afuera» es plata que no entró a IEB, Galicia ni Mercado Pago. Si entró a una de ellas, queda como aporte: la próxima carga no lo lee como ganancia.'
            : '«Afuera» es plata que no salió de tus cuentas seguidas. Si salió de una, queda como retiro: la próxima carga no lo lee como pérdida.'}
        </p>
        <Error id="error-cuenta" texto={e.cuenta} />
        {doble ? (
          <p role="status" className="mt-2 rounded-item border border-warn/40 bg-warn-soft p-2 text-sm text-text">
            Ojo: el {fechaCorta(doble.fecha)} ya cargaste en Datos › Movimientos {sentido === 'ingreso' ? 'un aporte igual a' : 'un retiro igual de'} {nombreCuenta}. Si es el mismo,
            no lo cargues de nuevo: contaría dos veces.
          </p>
        ) : null}
      </fieldset>

      {conCripto ? (
        <fieldset className="rounded-item border border-border bg-surface-2 p-3">
          <legend className="px-1 text-[13px] text-text">¿Vendiste los dólares al cripto?</legend>
          <p className="text-xs text-muted">
            Los dos o ninguno.{criptoHoy ? <> El cripto de tu última carga: <TextoConMontos texto={`$ ${criptoHoy}`} />.</> : null}
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="cripto" className={ROTULO}>
                Dólar cripto que usaste
              </label>
              <input id="cripto" name="cripto" inputMode="decimal" autoComplete="off" placeholder="Ej.: 1.541,00" value={cripto} onChange={(ev) => setCripto(ev.target.value)} className={`${CAMPO} mt-1`} aria-invalid={Boolean(e.cripto)} />
              <Error id="error-cripto" texto={e.cripto} />
            </div>
            <div className="min-w-0">
              <label htmlFor="pesos" className={ROTULO}>
                Pesos que recibiste
              </label>
              <input id="pesos" name="pesos" inputMode="decimal" autoComplete="off" placeholder="Ej.: 5.855.800" value={pesos} onChange={(ev) => setPesos(ev.target.value)} className={`${CAMPO} mt-1`} aria-invalid={Boolean(e.pesos)} />
              <Error id="error-pesos" texto={e.pesos} />
            </div>
          </div>
          {aviso ? (
            <p className={`mt-2 text-sm ${aviso.estado === 'no_cierra' ? 'font-medium text-warn' : 'text-muted'}`} role="status">
              <TextoConMontos texto={aviso.texto} />
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div>
        <label htmlFor="notas" className={ROTULO}>
          Notas <span className="text-faint">(opcional)</span>
        </label>
        <input id="notas" name="notas" maxLength={500} autoComplete="off" className={`${CAMPO} mt-1`} />
      </div>

      <button type="submit" disabled={enviando} className={`${clasesBoton('primario', 'md')} w-full sm:w-auto`}>
        {enviando ? 'Guardando…' : ingreso ? 'Guardar el ingreso' : 'Guardar el gasto'}
      </button>

      {estado.mensaje ? (
        <div id="mensaje-cargar" role="status" className={`rounded-item border p-3 text-sm ${estado.ok ? 'border-border bg-surface-2 text-text' : 'border-negative/40 bg-negative-soft text-text'}`}>
          <p>
            <TextoConMontos texto={estado.mensaje} />
          </p>
          {estado.ok ? (
            <p className="mt-1">
              <Link href="/flujo#real-contra-proyectado" className="tocable inline-flex min-h-9 items-center font-medium text-accent hover:underline">
                Verlo en su mes, en Flujo
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}
