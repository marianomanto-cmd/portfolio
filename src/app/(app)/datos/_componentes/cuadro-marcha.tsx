'use client'

// El cuadro de marcha en Datos › Leasing (plan §5 C.4): importar la planilla
// (elegir o pegar → revisión → Enter → guardado → Deshacer), completar el pago
// de una cuota (fecha, CCL de ese día y quién pagó) y los cargos extra. La
// revisión tiene la forma de la bandeja de Cargar: los errores frenan el Enter
// con su fila y su columna; las advertencias se aceptan de a una (D-106). Los
// montos van marcados para el modo privado.

import Link from 'next/link'
import { ArrowRight, FileUp, Undo2 } from 'lucide-react'
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import type { RevisionCuadro } from '@/lib/carga/cuadro-marcha'
import { monto } from '@/lib/domain/dinero'
import { fechaCorta, fechaLarga } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import type { CargoVista } from '@/lib/vistas/contratos-pasivos'
import { ParMonto } from '@/components/ui'
import { ConMontos, M } from '../../carga/_componentes/montos'
import { Aviso, Boton, Campo, Chip, Entrada, Selector } from '../../carga/_componentes/ui'
import {
  agregarCargo,
  anularCargoAccion,
  deshacerPlanilla,
  guardarOpcionEnContrato,
  guardarPlanilla,
  registrarPago,
  revisarPlanilla,
  type ResultadoPlanilla,
  type ResultadoSimple,
} from '../leasing/acciones'
import type { CuotaResumen, RevisionAbierta } from '../_lib/servidor-leasing'

const pesos = (v: string) => monto(v, 'ARS', { decimales: 2 })
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Enter guarda desde cualquier lugar que no sea un campo, un botón o un enlace (como en Cargar). */
function esCampo(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && Boolean(t.closest('input, textarea, select, button, a, [contenteditable="true"]'))
}

function Linea({ children, ok }: { children: ReactNode; ok?: boolean }) {
  return (
    <li className="min-w-0">
      {children}
      {ok ? (
        <span className="ml-1 text-accent" aria-label="bien">
          ✓
        </span>
      ) : null}
    </li>
  )
}

function Resultado({ r }: { r: ResultadoSimple | null }) {
  if (!r) return null
  return (
    <p role={r.ok ? 'status' : 'alert'} className={`rounded-lg px-3 py-2 text-sm ${r.ok ? 'bg-accent-soft text-text' : 'bg-negative-soft text-negative'}`}>
      {r.mensaje}
    </p>
  )
}

/** La revisión de la planilla, antes del Enter. */
function Revision({
  r,
  aceptadas,
  onAceptar,
  opcion,
}: {
  r: RevisionCuadro
  aceptadas: string[]
  onAceptar: (a: string, si: boolean) => void
  opcion: ReactNode
}) {
  const idBase = useId()
  const proyectadas = [
    r.a_confirmar.seguro ? `seguro a confirmar en ${r.a_confirmar.seguro}` : null,
    r.supuestas.seguro ? `seguro supuesto en ${r.supuestas.seguro}` : null,
    r.a_confirmar.percepcion ? `percepción a confirmar en ${r.a_confirmar.percepcion}` : null,
    r.supuestas.percepcion ? `percepción supuesta en ${r.supuestas.percepcion}` : null,
  ].filter(Boolean)
  const cierra = r.total_planilla === r.total_app
  return (
    <div className="min-w-0 space-y-3">
      <ul className="space-y-1.5 text-sm text-text">
        <Linea ok={r.leidas > 0 && !r.errores.length}>
          <span>
            <span className="font-medium">{plural(r.leidas, 'cuota leída', 'cuotas leídas')}</span>: {plural(r.facturadas, 'facturada', 'facturadas')} (
            {plural(r.pagadas, 'pagada', 'pagadas')}) y {plural(r.proyectadas, 'proyectada', 'proyectadas')}
            {proyectadas.length ? <span className="text-muted"> ({proyectadas.join(', ')})</span> : null}.
          </span>
        </Linea>
        <Linea>
          <span>
            <span className="text-muted">Contra lo que ya tenés: </span>
            {[r.nuevas ? plural(r.nuevas, 'nueva', 'nuevas') : null, r.actualizadas ? plural(r.actualizadas, 'actualizada', 'actualizadas') : null, r.iguales ? plural(r.iguales, 'igual', 'iguales') : null]
              .filter(Boolean)
              .join(' · ') || 'nada'}
            .
          </span>
        </Linea>
        {r.cambios.length ? (
          <li>
            <ul className="ml-4 list-disc space-y-0.5 text-muted">
              {r.cambios.slice(0, 8).map((c) => (
                <li key={c.nro}>
                  Cuota {c.nro}: {c.campos.join(', ')}
                </li>
              ))}
              {r.cambios.length > 8 ? <li>y {r.cambios.length - 8} más</li> : null}
            </ul>
          </li>
        ) : null}
        {r.cargos ? (
          <Linea>
            <span>
              {plural(r.cargos, 'cargo extra', 'cargos extra')}
              <span className="text-muted">{r.cargos === 1 ? ': va aparte, es gasto y no baja la deuda.' : ': van aparte, son gasto y no bajan la deuda.'}</span>
            </span>
          </Linea>
        ) : null}
        <Linea ok={cierra}>
          <span>
            <span className="text-muted">Total de la planilla </span>
            <M>{pesos(r.total_planilla)}</M>
            {cierra ? (
              <span className="text-muted">: cierra al centavo con canon + IVA + seguro + percepción.</span>
            ) : (
              <>
                <span className="text-muted">: no cierra; canon + IVA + seguro + percepción da </span>
                <M>{pesos(r.total_app)}</M>. <Chip tono="error">no cierra</Chip>
              </>
            )}
          </span>
        </Linea>
        <li className="min-w-0">{opcion}</li>
      </ul>
      {r.errores.length ? (
        <div role="alert" className="space-y-1 rounded-xl border border-negative/30 bg-negative-soft p-3 text-sm text-negative">
          <p className="font-medium">{r.errores.length === 1 ? 'Un error frena el guardado:' : `${r.errores.length} errores frenan el guardado:`}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {r.errores.slice(0, 12).map((e, i) => (
              <li key={i}>
                {e.fila !== null ? `Fila ${e.fila}` : 'El archivo'}
                {e.columna ? ` · columna ${e.columna}` : ''}: <ConMontos texto={e.mensaje} />
              </li>
            ))}
            {r.errores.length > 12 ? <li>y {r.errores.length - 12} más</li> : null}
          </ul>
        </div>
      ) : null}
      {r.advertencias.length ? (
        <fieldset className="min-w-0 space-y-1 rounded-xl border border-warn/30 bg-warn-soft p-3 text-sm">
          <legend className="px-1 font-medium text-warn">Advertencias: aceptalas de a una</legend>
          {r.advertencias.map((a, i) => {
            const si = aceptadas.includes(a)
            return (
              // La casilla real es invisible (sr-only): el objetivo táctil es el renglón entero, de 44 px.
              <label
                key={i}
                htmlFor={`${idBase}-a${i}`}
                className="tocable flex min-h-11 cursor-pointer items-start gap-2 rounded-lg px-1 py-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent lg:min-h-9"
              >
                <input id={`${idBase}-a${i}`} type="checkbox" className="sr-only" checked={si} onChange={(e) => onAceptar(a, e.target.checked)} />
                <span
                  aria-hidden
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${si ? 'border-accent bg-accent text-on-accent' : 'border-border-strong bg-surface'}`}
                >
                  {si ? '✓' : ''}
                </span>
                <span className="text-text">
                  <ConMontos texto={a} />
                </span>
              </label>
            )
          })}
        </fieldset>
      ) : null}
    </div>
  )
}

/** Lo que dice la planilla de la opción de compra, contra el contrato. */
function Opcion({ r, pasivoId, demo }: { r: RevisionCuadro; pasivoId: number; demo: string | null }) {
  const [res, setRes] = useState<ResultadoSimple | null>(null)
  const [enviando, iniciar] = useTransition()
  const o = r.opcion.leida
  if (!o) return <span className="text-muted">La planilla no trae la fila de la opción de compra (OC).</span>
  const guardar = () =>
    iniciar(async () => {
      setRes(await guardarOpcionEnContrato({ pasivo_id: pasivoId, neto: o.neto, fecha: o.fecha, demo }))
    })
  return (
    <span className="block min-w-0">
      <span className="text-muted">Opción de compra: </span>
      <M>{pesos(o.neto)}</M>
      <span className="text-muted"> + IVA </span>
      <M>{pesos(o.iva)}</M>
      <span className="text-muted"> al {fechaLarga(o.fecha)}</span>
      {r.opcion.estado === 'igual' ? (
        <>
          <span className="text-muted">: igual a la del contrato.</span>
          <span className="ml-1 text-accent" aria-label="bien">
            ✓
          </span>
        </>
      ) : (
        <>
          <span className="text-muted">
            :{' '}
            {r.opcion.estado === 'falta_en_contrato' ? (
              'el contrato no la tiene.'
            ) : (
              <>
                el contrato dice <M>{r.opcion.contrato.neto ? pesos(r.opcion.contrato.neto) : 'sin dato'}</M>
                {r.opcion.contrato.fecha ? ` al ${fechaLarga(r.opcion.contrato.fecha)}` : ''}.
              </>
            )}
          </span>
          {res?.ok ? null : (
            <span className="mt-1 block">
              <Boton variante="suave" onClick={guardar} disabled={enviando}>
                {enviando ? 'Guardando…' : r.opcion.estado === 'falta_en_contrato' ? 'Guardarla en el contrato' : 'Usar la de la planilla'}
              </Boton>
            </span>
          )}
        </>
      )}
      {res ? <span className={`mt-1 block text-xs ${res.ok ? 'text-muted' : 'text-negative'}`}>{res.mensaje}</span> : null}
    </span>
  )
}

/** Importar el cuadro de marcha: elegir o pegar, revisar, Enter, guardado, Deshacer. */
export function ImportarCuadro({
  pasivoId,
  hayCuotas,
  demo,
  ejemplo,
  inicial,
}: {
  pasivoId: number
  hayCuotas: boolean
  demo: string | null
  ejemplo: string | null
  inicial: RevisionAbierta | null
}) {
  const id = useId()
  const [abierto, setAbierto] = useState(Boolean(inicial))
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [textoCsv, setTextoCsv] = useState(inicial?.texto ?? '')
  const [res, setRes] = useState<ResultadoPlanilla | null>(
    inicial
      ? { ok: inicial.revision.errores.length === 0, mensaje: 'Revisá y guardá con Enter.', revision: inicial.revision, sha256: inicial.sha256, guardado: null }
      : null,
  )
  const [aceptadas, setAceptadas] = useState<string[]>([])
  const [deshecho, setDeshecho] = useState<ResultadoSimple | null>(null)
  const [enviando, iniciar] = useTransition()
  const lote = useRef<string | null>(null)

  const revisar = (texto: string, archivo: string) => {
    lote.current = null
    setAceptadas([])
    setDeshecho(null)
    iniciar(async () => {
      setRes(await revisarPlanilla({ pasivo_id: pasivoId, nombre: archivo, texto, demo }))
    })
  }
  const elegir = async (f: File | undefined) => {
    if (!f) return
    const t = await f.text()
    setNombre(f.name)
    setTextoCsv(t)
    revisar(t, f.name)
  }
  const r = res?.revision ?? null
  const listo = Boolean(r && !r.errores.length && r.advertencias.every((a) => aceptadas.includes(a)) && res?.sha256 && !res.guardado)
  const guardar = () => {
    if (!listo || !res?.sha256 || enviando) return
    // El mismo contenido reintentado lleva el mismo lote: la base no lo duplica.
    lote.current ??= crypto.randomUUID()
    const l = lote.current
    iniciar(async () => {
      setRes(await guardarPlanilla({ pasivo_id: pasivoId, nombre: nombre || 'cuadro de marcha.csv', texto: textoCsv, lote: l, sha256: res.sha256 as string, aceptadas, demo }))
    })
  }
  const guardarRef = useRef(guardar)
  guardarRef.current = guardar
  useEffect(() => {
    if (!abierto) return
    const enter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (esCampo(e.target)) return
      e.preventDefault()
      guardarRef.current()
    }
    window.addEventListener('keydown', enter)
    return () => window.removeEventListener('keydown', enter)
  }, [abierto])
  const deshacer = () => {
    const l = res?.guardado?.lote
    if (!l) return
    iniciar(async () => {
      setDeshecho(await deshacerPlanilla({ lote: l }))
    })
  }
  const empezarDeNuevo = () => {
    setRes(null)
    setTextoCsv('')
    setNombre('')
    setAceptadas([])
    setDeshecho(null)
    lote.current = null
  }

  if (!abierto) {
    return (
      <Boton variante={hayCuotas ? 'secundario' : 'primario'} onClick={() => setAbierto(true)} className="max-sm:w-full">
        <FileUp aria-hidden className="size-4" /> {hayCuotas ? 'Importar la planilla actualizada (CSV)' : 'Importar cuadro de marcha (CSV)'}
      </Boton>
    )
  }

  return (
    <section aria-labelledby={`${id}-t`} className="min-w-0 space-y-3 rounded-xl border border-border bg-surface-2 p-3">
      <h3 id={`${id}-t`} className="text-sm font-semibold text-text">
        {res?.guardado ? 'Cuadro de marcha guardado' : r ? `Revisión de ${nombre || 'la planilla'}` : 'Importar cuadro de marcha (CSV)'}
      </h3>

      {res?.guardado ? (
        <div className="space-y-3">
          <Aviso tono="azul">
            {res.mensaje}
            {res.guardado.demo ? null : ' Lo pisado queda en la auditoría.'}
          </Aviso>
          <Resultado r={deshecho} />
          <div className="flex flex-wrap gap-2 [&>*]:max-sm:flex-1">
            {deshecho?.ok ? null : (
              <Boton variante="secundario" onClick={deshacer} disabled={enviando}>
                <Undo2 aria-hidden className="size-4" /> {enviando ? 'Deshaciendo…' : 'Deshacer'}
              </Boton>
            )}
            <Link
              href={demo ? `/pasivos?demo=${demo === 'revision' ? 'cuadro' : demo}` : '/pasivos'}
              className="tocable inline-flex min-h-11 items-center justify-center gap-1 rounded-lg px-3 text-sm font-medium text-accent hover:bg-surface lg:min-h-9"
            >
              Ver en Pasivos <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Boton
              variante="fantasma"
              onClick={() => {
                empezarDeNuevo()
                setAbierto(false)
              }}
            >
              Cerrar
            </Boton>
          </div>
        </div>
      ) : r ? (
        <>
          <Revision
            r={r}
            aceptadas={aceptadas}
            onAceptar={(a, si) => setAceptadas((xs) => (si ? [...xs, a] : xs.filter((x) => x !== a)))}
            opcion={<Opcion r={r} pasivoId={pasivoId} demo={demo} />}
          />
          {res && !res.ok && !r.errores.length ? (
            <p role="alert" className="text-sm text-negative">
              {res.mensaje}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 [&>*]:max-sm:flex-1">
            <Boton variante="primario" onClick={guardar} disabled={!listo || enviando}>
              {enviando ? 'Guardando…' : 'Guardar (Enter)'}
            </Boton>
            <Boton variante="fantasma" onClick={empezarDeNuevo} disabled={enviando}>
              Elegir otro archivo
            </Boton>
          </div>
          <p className="text-xs text-muted">
            Guardar pisa las cuotas que ya tenías por número: lo facturado reemplaza a lo proyectado. Una cuota con factura no vuelve a proyectada.
          </p>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            La planilla de cuotas que te pasa la leasera (o la tuya), en CSV: una fila por cuota, la de la opción de compra (OC) y, si hay, los cargos extra. Podés volver a
            importarla cada vez que pagues: se actualiza por número de cuota.
          </p>
          <label
            htmlFor={`${id}-archivo`}
            className="tocable flex min-h-11 cursor-pointer flex-wrap items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-3 py-3 text-sm font-medium text-accent hover:bg-surface-2"
          >
            <FileUp aria-hidden className="size-4" /> Elegí el archivo CSV
            <input id={`${id}-archivo`} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => void elegir(e.target.files?.[0])} />
          </label>
          <Campo etiqueta="O pegá el texto de la planilla" htmlFor={`${id}-texto`}>
            <textarea
              id={`${id}-texto`}
              value={textoCsv}
              onChange={(e) => setTextoCsv(e.target.value)}
              rows={4}
              spellCheck={false}
              className="tocable min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-accent"
              placeholder="nro_cuota,fecha_vencimiento,mes_del_canon,canon_neto,…"
            />
          </Campo>
          {res && !res.ok ? (
            <p role="alert" className="text-sm text-negative">
              {res.mensaje}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 [&>*]:max-sm:flex-1">
            <Boton variante="primario" onClick={() => revisar(textoCsv, nombre || 'texto pegado')} disabled={enviando || !textoCsv.trim()}>
              {enviando ? 'Leyendo…' : 'Revisar'}
            </Boton>
            {ejemplo ? (
              <Boton
                variante="secundario"
                onClick={() => {
                  setNombre('cuadro de marcha (ejemplo).csv')
                  setTextoCsv(ejemplo)
                  revisar(ejemplo, 'cuadro de marcha (ejemplo).csv')
                }}
                disabled={enviando}
              >
                Usar la planilla de ejemplo
              </Boton>
            ) : null}
            <Boton variante="fantasma" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Boton>
          </div>
        </div>
      )}
    </section>
  )
}

/** Completar el pago de una cuota facturada: fecha (opcional), CCL de ese día con su fuente, quién pagó. */
export function PagoDeCuota({ pasivoId, cuotas, hoy, demo }: { pasivoId: number; cuotas: CuotaResumen[]; hoy: Fecha; demo: string | null }) {
  const id = useId()
  const facturadas = cuotas.filter((c) => c.estado === 'facturada')
  const [nro, setNro] = useState<number | null>(facturadas.find((c) => c.pagada && c.fecha_pago === null)?.nro ?? facturadas[0]?.nro ?? null)
  const [res, setRes] = useState<ResultadoSimple | null>(null)
  const [enviando, iniciar] = useTransition()
  const lote = useRef<{ clave: string; lote: string } | null>(null)
  if (!facturadas.length) {
    return <p className="text-sm text-muted">Cuando tengas cuotas facturadas, acá les cargás la fecha y el CCL del pago.</p>
  }
  const c = facturadas.find((x) => x.nro === nro) ?? facturadas[0]
  const sinFecha = facturadas.filter((x) => x.pagada && x.fecha_pago === null).length
  const sinCcl = facturadas.filter((x) => x.pagada && x.ccl === null).length
  const e = res?.errores ?? {}
  const enviar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const datos = Object.fromEntries(new FormData(ev.currentTarget)) as Record<string, string>
    const clave = JSON.stringify(datos)
    if (lote.current?.clave !== clave) lote.current = { clave, lote: crypto.randomUUID() }
    const l = lote.current.lote
    iniciar(async () => {
      setRes(await registrarPago({ ...datos, pasivo_id: pasivoId, lote: l, demo }))
    })
  }
  return (
    <form onSubmit={enviar} noValidate className="min-w-0 space-y-3" aria-label="Completar el pago de una cuota">
      <p className="text-sm text-muted">
        {sinFecha || sinCcl
          ? `De las pagadas: ${plural(sinFecha, 'sin fecha de pago', 'sin fecha de pago')} y ${plural(sinCcl, 'sin el CCL del pago', 'sin el CCL del pago')}. Con el CCL de cada pago, lo pagado se ve en dólares.`
          : 'Todas las pagadas tienen su fecha y su CCL.'}{' '}
        La planilla no trae la fecha del débito: si no la sabés, dejala vacía (queda "fecha sin dato").
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Campo etiqueta="Cuota" htmlFor={`${id}-nro`}>
          <Selector id={`${id}-nro`} name="nro" value={c.nro} onChange={(ev) => setNro(Number(ev.target.value))}>
            {facturadas.map((x) => (
              <option key={x.nro} value={x.nro}>
                {x.nro} · vence {fechaLarga(x.fecha_vencimiento)} · {x.pagada ? (x.fecha_pago ? `pagada el ${fechaLarga(x.fecha_pago)}` : 'pagada, fecha sin dato') : 'facturada, sin pagar'}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Fecha del pago (opcional)" htmlFor={`${id}-f`} error={e.fecha_pago}>
          <Entrada key={`f${c.nro}`} id={`${id}-f`} type="date" name="fecha_pago" defaultValue={c.fecha_pago ?? ''} max={hoy} invalido={Boolean(e.fecha_pago)} />
        </Campo>
        <Campo etiqueta="CCL de ese día" htmlFor={`${id}-ccl`} error={e.ccl} ayuda="Ej.: 1.234,50">
          <Entrada key={`c${c.nro}`} id={`${id}-ccl`} name="ccl" inputMode="decimal" className="num" defaultValue={c.ccl?.replace('.', ',') ?? ''} invalido={Boolean(e.ccl)} />
        </Campo>
        <Campo etiqueta="De dónde sacaste el CCL" htmlFor={`${id}-cf`} error={e.ccl_fuente} ayuda="Ej.: cierre del día en tu bróker.">
          <Entrada key={`cf${c.nro}`} id={`${id}-cf`} name="ccl_fuente" defaultValue={c.ccl_fuente ?? ''} invalido={Boolean(e.ccl_fuente)} />
        </Campo>
      </div>
      <fieldset className="min-w-0">
        <legend className="mb-1 text-sm font-medium text-text">¿Quién la pagó?</legend>
        <div key={`p${c.nro}`} className="flex flex-wrap gap-2">
          {(
            [
              ['', 'Sin decir'],
              ['titular', 'Vos'],
              ['empresa', 'La empresa'],
            ] as const
          ).map(([v, n]) => (
            // El radio real es invisible (sr-only): el botón entero es el objetivo, de 44 px.
            <label
              key={v}
              className="tocable inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border bg-surface px-3 text-sm text-text has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent lg:min-h-9"
            >
              <input type="radio" name="pagador" value={v} defaultChecked={(c.pagador ?? '') === v} className="sr-only" />
              {n}
            </label>
          ))}
        </div>
      </fieldset>
      <Resultado r={res} />
      <Boton type="submit" variante="primario" disabled={enviando} className="max-sm:w-full">
        {enviando ? 'Guardando…' : `Guardar el pago de la cuota ${c.nro}`}
      </Boton>
    </form>
  )
}

const CONCEPTOS = [
  ['multa', 'Multa'],
  ['comision', 'Comisión'],
  ['reserva_fondos', 'Reserva de fondos'],
  ['interes', 'Interés'],
  ['otro', 'Otro'],
] as const

const FUENTES = [
  ['comprobante', 'Comprobante'],
  ['contrato', 'Contrato'],
  ['a_confirmar', 'A confirmar'],
  ['supuesto', 'Supuesto'],
] as const

/** Los cargos extra que cuentan, con Anular, y el alta a mano. */
export function CargosExtra({ pasivoId, cargos, hoy, demo }: { pasivoId: number; cargos: CargoVista[]; hoy: Fecha; demo: string | null }) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const [res, setRes] = useState<ResultadoSimple | null>(null)
  const [vez, setVez] = useState(0)
  const [enviando, iniciar] = useTransition()
  const lote = useRef<{ clave: string; lote: string } | null>(null)
  const e = res?.errores ?? {}
  const enviar = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const datos = Object.fromEntries(new FormData(ev.currentTarget)) as Record<string, string>
    const clave = JSON.stringify(datos)
    if (lote.current?.clave !== clave) lote.current = { clave, lote: crypto.randomUUID() }
    const l = lote.current.lote
    iniciar(async () => {
      const r = await agregarCargo({ ...datos, pasivo_id: pasivoId, lote: l, demo })
      setRes(r)
      if (r.ok) setVez((v) => v + 1)
    })
  }
  const anular = (cargo: number) =>
    iniciar(async () => {
      setRes(await anularCargoAccion({ id: cargo }))
    })
  return (
    <div className="min-w-0 space-y-3">
      {cargos.length ? (
        <ul className="space-y-2 text-sm">
          {cargos.map((k) => (
            <li key={k.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3 py-2">
              <span className="text-muted">{fechaCorta(k.fecha)}</span>
              <span className="min-w-0 text-text">{k.detalle ?? k.concepto}</span>
              {k.cuota_nro ? <span className="text-muted">cuota {k.cuota_nro}</span> : null}
              <ParMonto par={k.importe} titulo={k.detalle ?? k.concepto} />
              <Chip>{k.fuente}</Chip>
              {k.id > 0 ? (
                <Boton variante="fantasma" className="ml-auto" onClick={() => anular(k.id)} disabled={enviando}>
                  Anular
                </Boton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Sin cargos extra. Si la planilla trae uno (multa, comisión, reserva de fondos, interés), entra solo al importarla.</p>
      )}
      {abierto ? (
        <form key={vez} onSubmit={enviar} noValidate className="min-w-0 space-y-3 rounded-xl border border-border bg-surface-2 p-3" aria-label="Agregar un cargo extra">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Campo etiqueta="Fecha" htmlFor={`${id}-f`} error={e.fecha}>
              <Entrada id={`${id}-f`} type="date" name="fecha" defaultValue={hoy} invalido={Boolean(e.fecha)} />
            </Campo>
            <Campo etiqueta="Qué es" htmlFor={`${id}-c`} error={e.concepto}>
              <Selector id={`${id}-c`} name="concepto" defaultValue="" invalido={Boolean(e.concepto)}>
                <option value="" disabled>
                  Elegí
                </option>
                {CONCEPTOS.map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Importe en pesos, con IVA si lo lleva" htmlFor={`${id}-i`} error={e.importe}>
              <Entrada id={`${id}-i`} name="importe" inputMode="decimal" className="num" invalido={Boolean(e.importe)} />
            </Campo>
            <Campo etiqueta="Detalle (opcional)" htmlFor={`${id}-d`} error={e.detalle}>
              <Entrada id={`${id}-d`} name="detalle" invalido={Boolean(e.detalle)} />
            </Campo>
            <Campo etiqueta="Cuota (opcional)" htmlFor={`${id}-n`} error={e.cuota_nro}>
              <Entrada id={`${id}-n`} name="cuota_nro" inputMode="numeric" className="num" invalido={Boolean(e.cuota_nro)} />
            </Campo>
            <Campo etiqueta="De dónde sale" htmlFor={`${id}-s`} error={e.fuente}>
              <Selector id={`${id}-s`} name="fuente" defaultValue="" invalido={Boolean(e.fuente)}>
                <option value="" disabled>
                  Elegí
                </option>
                {FUENTES.map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>
          <Resultado r={res} />
          <div className="flex flex-wrap gap-2 [&>*]:max-sm:flex-1">
            <Boton type="submit" variante="primario" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar el cargo'}
            </Boton>
            <Boton variante="fantasma" onClick={() => setAbierto(false)}>
              Cerrar
            </Boton>
          </div>
        </form>
      ) : (
        <>
          {res && !abierto ? <Resultado r={res} /> : null}
          <Boton variante="secundario" onClick={() => setAbierto(true)} className="max-sm:w-full">
            Agregar un cargo a mano
          </Boton>
        </>
      )}
    </div>
  )
}
