'use client'

// Leasing (4.9 de la visión): el contrato, con montos netos de IVA, y la deuda
// pendiente (pasivo_saldos), que es lo que netea Exposición desde la fase 1: la
// que informa el acreedor (para un leasing, el valor de cancelación sin
// penalidad, D-130) o, mientras no la haya, un estimado rotulado con su fuente
// (D-131, D-154). La camioneta se vincula a su leasing desde Bienes.

import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
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
}: {
  pasivos: PasivoFila[]
  saldos: SaldoPasivo[]
  bienes: BienFila[]
  ccl: CCL | null
  hoy: Fecha
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
          <p className="text-sm text-muted">La deuda que se resta en Exposición y en tu patrimonio es la última que cargaste: la que informa el acreedor o, mientras no la tengas, un estimado con su etiqueta.</p>
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

      <ul className="grid gap-3 xl:grid-cols-2">
        {pasivos.map((p) => {
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
                    ? `Estimado al ${fechaLarga(ultimo.fecha)}. No lo informó ${p.tipo === 'leasing' ? 'la leasera' : 'el acreedor'}: cuando te pase el valor, cargalo y reemplaza a este.`
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
              </dl>
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
            </li>
          )
        })}
      </ul>
    </div>
  )
}
