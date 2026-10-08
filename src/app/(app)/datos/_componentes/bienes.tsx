'use client'

// Bienes (D-03, D-04): la casa y la camioneta, con valuaciones fechadas y su
// fuente. La app no estima: sin valuación, "sin dato". El valor se muestra en
// las dos monedas al último CCL cargado, con su traza.

import { useEffect, useId, useState } from 'react'
import { Plus } from 'lucide-react'
import { MontoTrazado } from '@/components/monto'
import type { Fecha } from '@/lib/domain/tipos'
import { fechaLarga } from '@/lib/domain/fechas'
import { monto } from '@/lib/domain/dinero'
import { Boton, Campo, Chip, Entrada, Selector } from '../../carga/_componentes/ui'
import { nuevaValuacion, nuevoBien } from '../acciones'
import { enDosMonedas, ultimaValuacion, type CCL, type Valuacion } from '../_lib/calculos'
import { GEOGRAFIAS, NOMBRE_GEOGRAFIA } from '../_lib/catalogo'
import type { BienFila, PasivoFila } from '../_lib/servidor'
import { ElegirMoneda, Mensaje, Panel, useFormulario } from './formulario'
import { M } from '../../carga/_componentes/montos'

const NOMBRE_TIPO_BIEN = { inmueble: 'Inmueble', vehiculo: 'Vehículo', otro: 'Otro' } as const

function FormValuacion({ bien, hoy }: { bien: BienFila; hoy: Fecha }) {
  const id = useId()
  const [estado, enviar, enviando] = useFormulario(nuevaValuacion)
  const e = estado.errores
  return (
    <form key={estado.vez} onSubmit={enviar} noValidate className="mt-3 space-y-3 rounded-xl border border-border bg-surface-2 p-3" aria-label={`Nueva valuación de ${bien.nombre}`}>
      <input type="hidden" name="bien_id" value={bien.id} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[10rem_12rem_1fr]">
        <Campo etiqueta="Fecha" htmlFor={`${id}-f`} error={e.fecha}>
          <Entrada id={`${id}-f`} type="date" name="fecha" defaultValue={hoy} max={hoy} invalido={Boolean(e.fecha)} />
        </Campo>
        <Campo etiqueta={`Valor en ${bien.moneda_valuacion === 'USD' ? 'dólares' : 'pesos'}`} htmlFor={`${id}-v`} error={e.valor}>
          <Entrada id={`${id}-v`} name="valor" inputMode="decimal" className="num" invalido={Boolean(e.valor)} placeholder={bien.moneda_valuacion === 'USD' ? 'US$' : '$'} />
        </Campo>
        <Campo etiqueta="Fuente" htmlFor={`${id}-fu`} error={e.fuente} className="sm:col-span-2 xl:col-span-1">
          <Entrada id={`${id}-fu`} name="fuente" invalido={Boolean(e.fuente)} placeholder="tasación, guía de precios, escritura…" />
        </Campo>
      </div>
      <Mensaje estado={estado} />
      <Boton type="submit" variante="primario" disabled={enviando} className="max-sm:w-full">
        {enviando ? 'Guardando…' : 'Guardar valuación'}
      </Boton>
    </form>
  )
}

function FormBien({ pasivosLibres, onCerrar }: { pasivosLibres: PasivoFila[]; onCerrar: () => void }) {
  const id = useId()
  const [estado, enviar, enviando] = useFormulario(nuevoBien)
  const [moneda, setMoneda] = useState<'ARS' | 'USD' | ''>('')
  const e = estado.errores
  useEffect(() => {
    if (estado.ok && estado.vez > 0) setMoneda('')
  }, [estado.ok, estado.vez])
  return (
    <form key={estado.vez} onSubmit={enviar} noValidate className="space-y-3" aria-label="Nuevo bien">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Campo etiqueta="Nombre" htmlFor={`${id}-n`} error={e.nombre}>
          <Entrada id={`${id}-n`} name="nombre" placeholder="Casa, Camioneta…" invalido={Boolean(e.nombre)} autoFocus />
        </Campo>
        <Campo etiqueta="Tipo" htmlFor={`${id}-t`} error={e.tipo}>
          <Selector id={`${id}-t`} name="tipo" defaultValue="inmueble">
            <option value="inmueble">Inmueble</option>
            <option value="vehiculo">Vehículo</option>
            <option value="otro">Otro</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Geografía" htmlFor={`${id}-g`} error={e.geografia}>
          <Selector id={`${id}-g`} name="geografia" defaultValue="AR">
            {GEOGRAFIAS.map((g) => (
              <option key={g} value={g}>
                {NOMBRE_GEOGRAFIA[g]}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo
          etiqueta="Deuda que lo financia"
          htmlFor={`${id}-p`}
          error={e.pasivo_id}
          ayuda={pasivosLibres.length ? 'La camioneta va con su leasing: queda "sujeta a opción de compra".' : 'Sin pasivos libres: cargá el leasing primero si lo financia.'}
        >
          <Selector id={`${id}-p`} name="pasivo_id" defaultValue="">
            <option value="">Ninguna</option>
            {pasivosLibres.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>
      <div className="max-w-md">
        <ElegirMoneda nombre="moneda_valuacion" valor={moneda} onCambio={setMoneda} leyenda="¿En qué moneda lo valuás?" error={e.moneda_valuacion} />
      </div>
      <Mensaje estado={estado} />
      <div className="flex flex-wrap gap-2 [&>*]:max-sm:flex-1">
        <Boton type="submit" variante="primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Cargar bien'}
        </Boton>
        <Boton variante="fantasma" onClick={onCerrar}>
          {estado.ok ? 'Cerrar' : 'Cancelar'}
        </Boton>
      </div>
    </form>
  )
}

export function Bienes({
  bienes,
  valuaciones,
  pasivos,
  ccl,
  hoy,
}: {
  bienes: BienFila[]
  valuaciones: Valuacion[]
  pasivos: PasivoFila[]
  ccl: CCL | null
  hoy: Fecha
}) {
  const [nuevo, setNuevo] = useState(false)
  const [valuando, setValuando] = useState<number | null>(null)
  const libres = pasivos.filter((p) => !bienes.some((b) => b.pasivo_id === p.id))

  return (
    <div className="space-y-4">
      {nuevo ? (
        <Panel titulo="Nuevo bien">
          <FormBien pasivosLibres={libres} onCerrar={() => setNuevo(false)} />
        </Panel>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted">
            Valuaciones que cargás vos, con fecha y fuente. {ccl ? `En la otra moneda, al CCL del ${fechaLarga(ccl.fecha)}.` : 'Sin un CCL cargado, la otra moneda es "sin dato".'}
          </p>
          <Boton variante="primario" onClick={() => setNuevo(true)} className="max-sm:w-full sm:ml-auto">
            <Plus aria-hidden className="size-4" /> Nuevo bien
          </Boton>
        </div>
      )}

      {bienes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-4 text-sm text-muted">
          Todavía no cargaste bienes. Empezá por la casa y la camioneta (la camioneta, vinculada a su leasing).
        </p>
      ) : null}

      <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {bienes.map((b) => {
          const ultima = ultimaValuacion(valuaciones, b.id)
          const par = enDosMonedas(ultima?.valor ?? null, b.moneda_valuacion, ccl, {
            nombre: `la valuación de ${b.nombre}`,
            fecha: ultima?.fecha ?? null,
            origen: ultima?.carga_id ? { carga_id: ultima.carga_id, lugar: ultima.fuente } : undefined,
          })
          const pasivo = b.pasivo_id ? pasivos.find((p) => p.id === b.pasivo_id) : null
          const historia = valuaciones.filter((v) => v.bien_id === b.id).sort((x, y) => (x.fecha < y.fecha ? 1 : -1))
          return (
            <li key={b.id} className="min-w-0 rounded-2xl border border-border bg-surface p-4">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="font-semibold text-text">{b.nombre}</h3>
                <Chip>{NOMBRE_TIPO_BIEN[b.tipo]}</Chip>
                <Chip>valuado en {b.moneda_valuacion === 'USD' ? 'dólares' : 'pesos'}</Chip>
                {pasivo ? <Chip tono="azul">sujeto a opción de compra · {pasivo.nombre}</Chip> : null}
              </div>
              <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-lg">
                <MontoTrazado calc={par.ars} moneda="ARS" titulo={`${b.nombre} en pesos`} />
                <MontoTrazado calc={par.usd} moneda="USD" titulo={`${b.nombre} en dólares`} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {ultima ? (
                  <>
                    Última valuación: {fechaLarga(ultima.fecha)} · {ultima.fuente}
                  </>
                ) : (
                  'Sin valuación: el valor es "sin dato" hasta que cargues una.'
                )}
              </p>
              {historia.length > 1 ? (
                <details className="mt-2 text-sm">
                  <summary className="tocable flex min-h-11 cursor-pointer items-center text-muted lg:min-h-9">Historia ({historia.length})</summary>
                  <ul className="num mt-1 space-y-0.5 text-muted">
                    {historia.map((v) => (
                      <li key={v.fecha}>
                        {fechaLarga(v.fecha)} ·{' '}
                        <M usd={b.moneda_valuacion === 'USD'}>{monto(v.valor, b.moneda_valuacion, { decimales: b.moneda_valuacion === 'USD' ? 2 : 0 })}</M> · {v.fuente}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {valuando === b.id ? (
                <>
                  <FormValuacion bien={b} hoy={hoy} />
                  <Boton variante="fantasma" className="mt-2" onClick={() => setValuando(null)}>
                    Cerrar
                  </Boton>
                </>
              ) : (
                <Boton variante="secundario" className="mt-3 max-sm:w-full" onClick={() => setValuando(b.id)}>
                  Agregar valuación
                </Boton>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
