'use client'

// Leasing (4.9 de la visión): el contrato, con montos netos de IVA, y la deuda
// pendiente (pasivo_saldos), que es lo que netea Exposición desde la fase 1: la
// que informa el acreedor (para un leasing, el valor de cancelación sin
// penalidad, D-130) o, mientras no la haya, un estimado rotulado con su fuente
// (D-131, D-154). La camioneta se vincula a su leasing desde Bienes.
//
// Entrega 4 (plan §5 C.4): al lado de la informada y la estimada, la deuda
// según el cuadro de marcha (valor presente a la tasa del contrato, chip
// estimado), que nunca reemplaza a la informada; la fecha de desembolso, quién
// paga la cuota y si la empresa te reintegra el IVA; y el cuadro de marcha:
// importar la planilla, completar el pago de una cuota y los cargos extra.

import Link from 'next/link'
import { useEffect, useId, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { MontoTrazado } from '@/components/monto'
import { ConMontos, M } from '../../carga/_componentes/montos'
import { monto } from '@/lib/domain/dinero'
import { fechaLarga } from '@/lib/domain/fechas'
import type { Fecha } from '@/lib/domain/tipos'
import { Boton, Campo, Chip, Entrada, Selector } from '../../carga/_componentes/ui'
import { editarPasivo, nuevoPasivo, nuevoSaldoPasivo } from '../acciones'
import { enDosMonedas, ultimoSaldoPasivo, type CCL, type SaldoPasivo } from '../_lib/calculos'
import type { BienFila, PasivoFila } from '../_lib/servidor'
import { ElegirMoneda, Mensaje, Panel, useFormulario } from './formulario'
import { CargosExtra, ImportarCuadro, PagoDeCuota } from './cuadro-marcha'
import { ElegirDato } from '../../pasivos/_componentes/pagador'
import { guardarDesembolso, type ResultadoSimple } from '../leasing/acciones'
import type { ExtraPasivo, RevisionAbierta } from '../_lib/servidor-leasing'
import { Porcentaje } from '@/components/monto'

const NOMBRE_TIPO = { leasing: 'Leasing', tarjeta: 'Tarjeta', prestamo: 'Préstamo' } as const

/** Cómo se llama lo que informa el acreedor: en un leasing, el valor de cancelación (D-130). */
function nombreInformado(p: PasivoFila): string {
  return p.tipo === 'leasing' ? 'Valor de cancelación' : 'Capital pendiente'
}

/** El valor que informó el acreedor. Un estimado no se carga desde acá (D-154). */
function FormSaldo({ pasivo, hoy }: { pasivo: PasivoFila; hoy: Fecha }) {
  const id = useId()
  const [estado, enviar, enviando] = useFormulario(nuevoSaldoPasivo)
  const e = estado.errores
  const leasing = pasivo.tipo === 'leasing'
  return (
    <form key={estado.vez} onSubmit={enviar} noValidate className="mt-3 space-y-3 rounded-xl border border-border bg-surface-2 p-3" aria-label={`${nombreInformado(pasivo)} de ${pasivo.nombre}`}>
      <input type="hidden" name="pasivo_id" value={pasivo.id} />
      <p className="text-sm text-muted">
        {leasing
          ? 'El valor de cancelación anticipada que te informe la leasera, sin la penalidad. Desde su fecha reemplaza al estimado.'
          : 'El capital pendiente que te informe el acreedor.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Informado al" htmlFor={`${id}-f`} error={e.fecha}>
          <Entrada id={`${id}-f`} type="date" name="fecha" defaultValue={hoy} max={hoy} invalido={Boolean(e.fecha)} />
        </Campo>
        <Campo etiqueta={`${nombreInformado(pasivo)} (${pasivo.moneda === 'USD' ? 'US$' : '$'})`} htmlFor={`${id}-m`} error={e.capital_pendiente}>
          <Entrada id={`${id}-m`} name="capital_pendiente" inputMode="decimal" className="num" invalido={Boolean(e.capital_pendiente)} />
        </Campo>
        <div className="sm:col-span-2">
          <Campo etiqueta="Quién lo informó (opcional)" htmlFor={`${id}-q`} error={e.fuente} ayuda={leasing ? 'Ej.: nota de la leasera del 20/10.' : undefined}>
            <Entrada id={`${id}-q`} name="fuente" invalido={Boolean(e.fuente)} />
          </Campo>
        </div>
      </div>
      <Mensaje estado={estado} />
      <Boton type="submit" variante="primario" disabled={enviando} className="max-sm:w-full">
        {enviando ? 'Guardando…' : 'Guardar el valor informado'}
      </Boton>
    </form>
  )
}

/** Alta de un pasivo o, con `pasivo`, la corrección del contrato de uno cargado. */
function FormPasivo({ onCerrar, pasivo = null }: { onCerrar: () => void; pasivo?: PasivoFila | null }) {
  const id = useId()
  const [estado, enviar, enviando] = useFormulario(pasivo ? editarPasivo : nuevoPasivo)
  const [moneda, setMoneda] = useState<'ARS' | 'USD' | ''>(pasivo?.moneda ?? '')
  const e = estado.errores
  useEffect(() => {
    if (estado.ok && estado.vez > 0 && !pasivo) setMoneda('')
  }, [estado.ok, estado.vez, pasivo])
  /** Un monto guardado ("42000000") → como se tipea ("42000000,5"). */
  const tipeable = (v: string | null | undefined) => (v === null || v === undefined ? undefined : v.replace('.', ','))
  const campo = (nombre: string, etiqueta: string, opciones: { tipo?: string; ayuda?: string; decimal?: boolean; defecto?: string } = {}) => (
    <Campo etiqueta={etiqueta} htmlFor={`${id}-${nombre}`} error={e[nombre]} ayuda={opciones.ayuda}>
      <Entrada
        id={`${id}-${nombre}`}
        name={nombre}
        type={opciones.tipo ?? 'text'}
        inputMode={opciones.decimal ? 'decimal' : undefined}
        defaultValue={opciones.defecto}
        className={opciones.decimal ? 'num' : ''}
        invalido={Boolean(e[nombre])}
      />
    </Campo>
  )
  return (
    <form key={pasivo ? 'corregir' : estado.vez} onSubmit={enviar} noValidate className="space-y-3" aria-label={pasivo ? `Corregir ${pasivo.nombre}` : 'Nuevo pasivo'}>
      {pasivo ? <input type="hidden" name="id" value={pasivo.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {campo('nombre', 'Nombre', { defecto: pasivo?.nombre ?? 'Leasing camioneta' })}
        <Campo etiqueta="Tipo" htmlFor={`${id}-tipo`} error={e.tipo}>
          <Selector id={`${id}-tipo`} name="tipo" defaultValue={pasivo?.tipo ?? 'leasing'}>
            <option value="leasing">Leasing</option>
            <option value="prestamo">Préstamo</option>
            <option value="tarjeta">Tarjeta</option>
          </Selector>
        </Campo>
        {campo('fecha_inicio', 'Inicio', { tipo: 'date', defecto: pasivo?.fecha_inicio })}
        {campo('cuotas_totales', 'Cuotas', { decimal: true, ayuda: 'Cantidad total, ej.: 48.', defecto: pasivo ? String(pasivo.cuotas_totales) : undefined })}
      </div>
      <div className="max-w-md">
        <ElegirMoneda nombre="moneda" valor={moneda} onCambio={setMoneda} leyenda="Moneda de la deuda" error={e.moneda} />
      </div>
      <p className="text-sm text-muted">Montos del contrato, netos de IVA. Todos opcionales: lo que no tengas a mano queda "sin dato".</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {campo('monto_financiado_neto', 'Monto financiado', { decimal: true, defecto: tipeable(pasivo?.monto_financiado_neto) })}
        {campo('anticipo_neto', 'Anticipo', { decimal: true, defecto: tipeable(pasivo?.anticipo_neto) })}
        {campo('valor_bien', 'Valor del bien', { decimal: true, defecto: tipeable(pasivo?.valor_bien) })}
        {campo('opcion_compra_neto', 'Opción de compra', { decimal: true, defecto: tipeable(pasivo?.opcion_compra_neto) })}
        {campo('opcion_compra_fecha', 'Fecha de la opción', { tipo: 'date', defecto: pasivo?.opcion_compra_fecha ?? undefined })}
        <div className="sm:col-span-2 xl:col-span-3">{campo('notas', 'Notas', { defecto: pasivo?.notas ?? undefined })}</div>
      </div>
      <Mensaje estado={estado} />
      <div className="flex flex-wrap gap-2 [&>*]:max-sm:flex-1">
        <Boton type="submit" variante="primario" disabled={enviando}>
          {enviando ? 'Guardando…' : pasivo ? 'Guardar la corrección' : 'Cargar pasivo'}
        </Boton>
        <Boton variante="fantasma" onClick={onCerrar}>
          {estado.ok ? 'Cerrar' : 'Cancelar'}
        </Boton>
      </div>
    </form>
  )
}

/**
 * La deuda según el cuadro de marcha: la que se resta mientras la leasera no
 * informe el valor de cancelación, en lugar de tu estimado (D-131); con el
 * valor informado, queda de referencia.
 */
function SegunCuadro({ x, nombre, hayInformada }: { x: ExtraPasivo; nombre: string; hayInformada: boolean }) {
  const sin = x.segun_cuadro.ars.valor === null
  return (
    <div className="mt-3 rounded-xl border border-dashed border-border-strong p-3">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        Según el cuadro de marcha <Chip>estimado</Chip>
      </p>
      {sin ? (
        <p className="text-sm">
          <span className="italic text-muted">sin dato</span> · <span className="text-muted">{x.segun_cuadro.ars.motivo}</span>
        </p>
      ) : (
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-base">
          <MontoTrazado calc={x.segun_cuadro.ars} moneda="ARS" titulo={`Deuda de ${nombre} según el cuadro de marcha, en pesos`} />
          <MontoTrazado calc={x.segun_cuadro.usd} moneda="USD" titulo={`Deuda de ${nombre} según el cuadro de marcha, en dólares`} />
        </div>
      )}
      <p className="mt-1 text-xs text-muted">
        Valor presente, al cierre de tu última carga, de los cánones netos que faltan y de la opción, a la tasa del contrato.{' '}
        {hayInformada
          ? 'Con el valor que informó la leasera, este queda de referencia: se resta el informado.'
          : sin
            ? 'Sin él, se resta tu estimado, si lo hay.'
            : 'Es la deuda que se resta mientras la leasera no informe el valor de cancelación, en lugar de tu estimado.'}
      </p>
    </div>
  )
}

/** La fecha de desembolso (la entrega del bien): desde ahí corre la financiación para la tasa del contrato. */
function FormDesembolso({ pasivoId, actual, hoy }: { pasivoId: number; actual: Fecha | null; hoy: Fecha }) {
  const id = useId()
  const [res, setRes] = useState<ResultadoSimple | null>(null)
  const [enviando, iniciar] = useTransition()
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault()
        const f = String(new FormData(ev.currentTarget).get('fecha_desembolso') ?? '')
        iniciar(async () => setRes(await guardarDesembolso({ pasivo_id: pasivoId, fecha_desembolso: f })))
      }}
      noValidate
      className="min-w-0 space-y-2"
      aria-label="Fecha de desembolso"
    >
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <Campo etiqueta="Fecha de desembolso (la entrega del bien)" htmlFor={`${id}-d`} error={res?.errores?.fecha_desembolso} className="min-w-[12rem] flex-1 sm:flex-none">
          <Entrada id={`${id}-d`} type="date" name="fecha_desembolso" defaultValue={actual ?? ''} max={hoy} />
        </Campo>
        <Boton type="submit" variante="secundario" disabled={enviando} className="max-sm:w-full">
          {enviando ? 'Guardando…' : 'Guardar la fecha'}
        </Boton>
      </div>
      {res ? (
        <p role={res.ok ? 'status' : 'alert'} className={`text-sm ${res.ok ? 'text-muted' : 'text-negative'}`}>
          {res.mensaje}
        </p>
      ) : null}
    </form>
  )
}

/** El cuadro de marcha del pasivo: lo cargado, importar la planilla, el pago de una cuota y los cargos. */
function CuadroDelPasivo({
  p,
  x,
  hoy,
  demo,
  anclar,
}: {
  p: PasivoFila
  x: ExtraPasivo
  hoy: Fecha
  demo: { variante: string; csv: string; revision: RevisionAbierta | null } | null
  anclar: boolean
}) {
  const pagadas = x.cuotas.filter((c) => c.pagada).length
  const proyectadas = x.cuotas.filter((c) => c.estado === 'proyectada').length
  const revision = demo?.revision && demo.revision.pasivo_id === p.id ? demo.revision : null
  return (
    <section id={anclar ? 'cuadro-de-marcha' : `cuadro-de-marcha-${p.id}`} aria-labelledby={`cuadro-${p.id}`} className="mt-4 min-w-0 space-y-3 border-t border-border pt-4">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <h3 id={`cuadro-${p.id}`} className="font-semibold text-text">
          Cuadro de marcha
        </h3>
        <Link href={demo ? `/pasivos?demo=${demo.variante === 'revision' ? 'cuadro' : demo.variante}` : '/pasivos'} className="tocable inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline lg:min-h-9">
          Verlo en Pasivos
        </Link>
      </div>
      <p className="text-sm text-muted">
        {x.cargadas
          ? `${x.cargadas} de ${p.cuotas_totales} cuotas cargadas · ${pagadas} pagadas · ${proyectadas} proyectadas (sin factura todavía).`
          : 'Todavía no importaste el cuadro de marcha: con la planilla de cuotas ves cuánto pagaste, cuánto falta y cuánto es en dólares.'}
      </p>
      <ImportarCuadro pasivoId={p.id} hayCuotas={x.cargadas > 0} demo={demo?.variante ?? null} ejemplo={demo?.csv ?? null} inicial={revision} />
      {x.cargadas ? (
        <details className="min-w-0 rounded-xl border border-border p-3">
          <summary className="tocable flex min-h-11 cursor-pointer items-center text-sm font-medium text-text lg:min-h-9">Completar el pago de una cuota (fecha y CCL)</summary>
          <div className="mt-3">
            <PagoDeCuota pasivoId={p.id} cuotas={x.cuotas} hoy={hoy} demo={demo?.variante ?? null} />
          </div>
        </details>
      ) : null}
      <details className="min-w-0 rounded-xl border border-border p-3">
        <summary className="tocable flex min-h-11 cursor-pointer items-center text-sm font-medium text-text lg:min-h-9">Cargos extra ({x.cargos.length})</summary>
        <div className="mt-3">
          <CargosExtra pasivoId={p.id} cargos={x.cargos} hoy={hoy} demo={demo?.variante ?? null} />
        </div>
      </details>
    </section>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{etiqueta}</dt>
      {/* Los montos del contrato se tapan en el modo privado (manual §4.7). */}
      <dd className={`num break-words text-sm ${valor === null ? 'text-muted italic' : 'text-text'}`}>{valor === null ? 'sin dato' : <ConMontos texto={valor} />}</dd>
    </div>
  )
}

export function Leasing({
  pasivos,
  saldos,
  bienes,
  ccl,
  hoy,
  extra = {},
  demo = null,
}: {
  pasivos: PasivoFila[]
  saldos: SaldoPasivo[]
  bienes: BienFila[]
  ccl: CCL | null
  hoy: Fecha
  /** Lo de la entrega 4 por pasivo (deuda según cuadro, tasa, cuotas, cargos); vacío si no se pudo leer. */
  extra?: Record<number, ExtraPasivo>
  demo?: { variante: string; csv: string; revision: RevisionAbierta | null } | null
}) {
  const [nuevo, setNuevo] = useState(false)
  const [informando, setInformando] = useState<number | null>(null)
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null)
  return (
    <div className="space-y-4">
      {nuevo ? (
        <Panel titulo="Nuevo pasivo">
          <FormPasivo onCerrar={() => setNuevo(false)} />
        </Panel>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted">
            La deuda que se resta en tu patrimonio es una sola en toda la app: la que informa el acreedor o, mientras no la tengas, la según el cuadro de marcha (si lo importaste) o
            tu estimado, con su etiqueta. Todo está al cierre de tu última carga: una deuda con fecha posterior entra con tu próxima carga.
          </p>
          <Boton variante="primario" onClick={() => setNuevo(true)} className="max-sm:w-full sm:ml-auto">
            <Plus aria-hidden className="size-4" /> Nuevo pasivo
          </Boton>
        </div>
      )}

      {pasivos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-4 text-sm text-muted">
          Todavía no cargaste el leasing. Con el contrato y el valor de cancelación que informe la leasera, Exposición ya lo netea.
        </p>
      ) : null}

      <ul className={`grid gap-3 ${pasivos.length > 1 ? 'xl:grid-cols-2' : ''}`}>
        {pasivos.map((p, i) => {
          const x = extra[p.id] ?? null
          const ultimo = ultimoSaldoPasivo(saldos, p.id)
          const estimado = ultimo?.naturaleza === 'estimado'
          const que = estimado ? 'Deuda estimada' : `${nombreInformado(p)} informado`
          const par = enDosMonedas(ultimo?.capital_pendiente ?? null, p.moneda, ccl, {
            nombre: estimado ? 'la deuda estimada' : `el ${nombreInformado(p).toLowerCase()} informado`,
            fecha: ultimo?.fecha ?? null,
            origen: ultimo?.carga_id ? { carga_id: ultimo.carga_id } : undefined,
            etiquetas: estimado ? ['estimado'] : [],
          })
          const bien = bienes.find((b) => b.pasivo_id === p.id) ?? null
          const historia = saldos.filter((s) => s.pasivo_id === p.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
          const m = (v: string | null) => (v === null ? null : monto(v, p.moneda, { decimales: p.moneda === 'USD' ? 2 : 0 }))
          return (
            <li key={p.id} className="min-w-0 rounded-2xl border border-border bg-surface p-4">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="font-semibold text-text">{p.nombre}</h2>
                <Chip>{NOMBRE_TIPO[p.tipo]}</Chip>
                <Chip>en {p.moneda === 'USD' ? 'dólares' : 'pesos'}</Chip>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                {ultimo ? que : `${nombreInformado(p)} informado`}
                {estimado ? <Chip>estimado</Chip> : null}
              </p>
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-lg">
                <MontoTrazado calc={par.ars} moneda="ARS" titulo={`${que} de ${p.nombre} en pesos`} />
                <MontoTrazado calc={par.usd} moneda="USD" titulo={`${que} de ${p.nombre} en dólares`} />
              </div>
              <p className="text-sm text-muted">
                {!ultimo
                  ? `Sin ${nombreInformado(p).toLowerCase()} informado: cargalo para que Exposición lo netee.`
                  : estimado
                    ? x && p.tipo === 'leasing' && x.segun_cuadro.ars.valor !== null
                      ? `Estimado al ${fechaLarga(ultimo.fecha)}. No se resta: con el cuadro de marcha y su tasa se resta la deuda según el cuadro (abajo). Cuando la leasera te pase el valor de cancelación, cargalo: reemplaza a los dos.`
                      : `Estimado al ${fechaLarga(ultimo.fecha)}. No lo informó ${p.tipo === 'leasing' ? 'la leasera' : 'el acreedor'}: cuando te pase el valor, cargalo y reemplaza a este.`
                    : `Informado al ${fechaLarga(ultimo.fecha)}.`}
              </p>
              {ultimo?.fuente ? (
                <p className="mt-1 text-sm text-muted">
                  {estimado ? 'Cómo se estimó: ' : 'Quién lo informó: '}
                  <span className="text-text">
                    <ConMontos texto={ultimo.fuente} />
                  </span>
                </p>
              ) : null}
              {x && p.tipo === 'leasing' ? <SegunCuadro x={x} nombre={p.nombre} hayInformada={Boolean(ultimo) && !estimado} /> : null}
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <Dato etiqueta="Inicio" valor={fechaLarga(p.fecha_inicio)} />
                <Dato etiqueta="Cuotas" valor={String(p.cuotas_totales)} />
                <Dato etiqueta="Monto financiado (neto)" valor={m(p.monto_financiado_neto)} />
                <Dato etiqueta="Anticipo (neto)" valor={m(p.anticipo_neto)} />
                <Dato etiqueta="Valor del bien" valor={m(p.valor_bien)} />
                <Dato
                  etiqueta="Opción de compra"
                  valor={p.opcion_compra_neto === null && p.opcion_compra_fecha === null ? null : `${m(p.opcion_compra_neto) ?? 'sin dato'}${p.opcion_compra_fecha ? ` · ${fechaLarga(p.opcion_compra_fecha)}` : ''}`}
                />
                {x ? <Dato etiqueta="Desembolso (entrega)" valor={x.fecha_desembolso ? fechaLarga(x.fecha_desembolso) : null} /> : null}
                {x ? (
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">Tasa del contrato</dt>
                    <dd className="text-sm">
                      {x.tea.valor === null ? (
                        <span className="italic text-muted">sin dato</span>
                      ) : (
                        <>
                          TEA <Porcentaje calc={x.tea} titulo="TEA implícita del contrato" signo={false} />
                        </>
                      )}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {x && x.tea.valor === null && x.faltan_para_tasa.length ? (
                <p className="mt-2 text-sm text-muted">Para la tasa del contrato falta {x.faltan_para_tasa.join(' y ')}. Completar el contrato abajo.</p>
              ) : null}
              <p className="mt-3 text-sm">
                {bien ? (
                  <span className="text-text">
                    Financia: <span className="font-medium">{bien.nombre}</span> (sujeto a opción de compra).
                  </span>
                ) : (
                  <span className="text-muted">
                    Sin bien vinculado. Cargá la camioneta en{' '}
                    <Link href="/datos/bienes" className="text-accent underline-offset-2 hover:underline">
                      Bienes
                    </Link>{' '}
                    eligiendo este leasing.
                  </span>
                )}
              </p>
              {p.notas ? <p className="mt-1 text-sm text-muted">{p.notas}</p> : null}
              {x && p.tipo === 'leasing' ? (
                <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
                  <ElegirDato
                    pasivoId={p.id}
                    campo="pagador_habitual"
                    pregunta="¿Quién paga la cuota?"
                    actual={x.pagador_habitual}
                    opciones={[
                      { valor: 'titular', nombre: 'Vos' },
                      { valor: 'empresa', nombre: 'La empresa' },
                    ]}
                  />
                  <ElegirDato
                    pasivoId={p.id}
                    campo="reintegra_iva"
                    pregunta="¿La empresa te reintegra el IVA y la percepción?"
                    actual={x.reintegra_iva === null ? null : x.reintegra_iva ? 'si' : 'no'}
                    opciones={[
                      { valor: 'si', nombre: 'Sí' },
                      { valor: 'no', nombre: 'No' },
                    ]}
                  />
                  <div className="md:col-span-2">
                    <FormDesembolso pasivoId={p.id} actual={x.fecha_desembolso} hoy={hoy} />
                  </div>
                </div>
              ) : null}
              {historia.length > 1 ? (
                <details className="mt-2 text-sm">
                  <summary className="tocable flex min-h-11 cursor-pointer items-center text-muted lg:min-h-9">Deuda cargada antes ({historia.length})</summary>
                  <ul className="num mt-1 space-y-0.5 text-muted">
                    {historia.map((s) => (
                      <li key={s.fecha} className="flex flex-wrap items-center gap-x-2">
                        <span>
                          {fechaLarga(s.fecha)} · <M usd={p.moneda === 'USD'}>{m(s.capital_pendiente) ?? 'sin dato'}</M>
                        </span>
                        {s.naturaleza === 'estimado' ? <Chip>estimado</Chip> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {informando === p.id ? (
                <>
                  <FormSaldo pasivo={p} hoy={hoy} />
                  <Boton variante="fantasma" className="mt-2" onClick={() => setInformando(null)}>
                    Cerrar
                  </Boton>
                </>
              ) : corrigiendo === p.id ? (
                <div className="mt-3 rounded-xl border border-border bg-surface-2 p-3">
                  <FormPasivo pasivo={p} onCerrar={() => setCorrigiendo(null)} />
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2 [&>*]:max-sm:flex-1">
                  <Boton variante="secundario" onClick={() => setInformando(p.id)}>
                    {p.tipo === 'leasing' ? 'Cargar el valor que informó la leasera' : 'Registrar capital pendiente'}
                  </Boton>
                  <Boton variante="fantasma" onClick={() => setCorrigiendo(p.id)}>
                    Corregir el contrato
                  </Boton>
                </div>
              )}
              {x && p.tipo === 'leasing' ? <CuadroDelPasivo p={p} x={x} hoy={hoy} demo={demo} anclar={i === pasivos.findIndex((q) => q.tipo === 'leasing')} /> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
