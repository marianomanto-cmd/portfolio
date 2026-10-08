'use client'

// Alta de un ticker desconocido sin salir de la carga (4.2 de la visión). La
// moneda de riesgo la elegís vos: la app no la decide (D-73). Tipo, geografía e
// indexación vienen sugeridos por la sección de la fuente, a la vista y editables.

import { useId, useState, useTransition, type FormEvent } from 'react'
import type { ActivoNuevo } from '@/lib/carga/contratos'
import {
  GEOGRAFIAS,
  INDEXACIONES,
  NOMBRE_GEOGRAFIA,
  NOMBRE_INDEXACION,
  NOMBRE_TIPO,
  TIPOS_ACTIVO,
} from '../../datos/_lib/catalogo'
import { altaActivo } from '../acciones'
import type { ActivoLocal } from '../_lib/demo'
import { Boton, Campo, Entrada, Selector } from './ui'

export function AltaActivo({
  sugerido,
  onCreado,
  onCancelar,
}: {
  sugerido: ActivoNuevo
  onCreado: (a: ActivoLocal) => void
  onCancelar: () => void
}) {
  const id = useId()
  const [tipo, setTipo] = useState<ActivoNuevo['tipo']>(sugerido.tipo)
  const [moneda, setMoneda] = useState<'ARS' | 'USD' | ''>('')
  const [color, setColor] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [pendiente, iniciar] = useTransition()
  const esBono = tipo === 'bono' || tipo === 'lecap'
  const esCedear = tipo === 'cedear'

  function enviar(evento: FormEvent<HTMLFormElement>) {
    // onSubmit y no `action`: React 19 vacía el formulario después de una acción.
    evento.preventDefault()
    const form = new FormData(evento.currentTarget)
    const datos: Record<string, string> = {}
    for (const [k, v] of form.entries()) if (typeof v === 'string') datos[k] = v
    datos.ticker = sugerido.ticker
    datos.moneda_riesgo = moneda
    if (color) datos.color = color
    if (!esBono) delete datos.indexacion
    if (!esCedear) {
      delete datos.ratio
      delete datos.ticker_subyacente
    }
    iniciar(async () => {
      const r = await altaActivo(datos)
      if (r.ok) onCreado(r.activo)
      else setErrores(r.errores)
    })
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      className="mt-3 space-y-3 rounded-xl border border-border bg-surface-2 p-3"
      aria-label={`Dar de alta ${sugerido.ticker}`}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <p className="text-sm font-medium text-text">
        Dar de alta <span className="num">{sugerido.ticker}</span> en el catálogo
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre" htmlFor={`${id}-nombre`} error={errores.nombre}>
          <Entrada id={`${id}-nombre`} name="nombre" defaultValue={sugerido.nombre} invalido={Boolean(errores.nombre)} autoFocus />
        </Campo>
        <Campo etiqueta="Tipo" htmlFor={`${id}-tipo`} error={errores.tipo}>
          <Selector id={`${id}-tipo`} name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as ActivoNuevo['tipo'])}>
            {TIPOS_ACTIVO.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TIPO[t]}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-text">¿A qué moneda te expone?</legend>
        <p className="text-xs text-muted">La elegís vos. Un CEDEAR cotiza en pesos pero arriesga dólares.</p>
        <div className="grid grid-cols-2 gap-2">
          {(['ARS', 'USD'] as const).map((m) => (
            <label
              key={m}
              className={`tocable flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium ${
                moneda === m ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text'
              }`}
            >
              <input type="radio" name="moneda_riesgo_ui" value={m} checked={moneda === m} onChange={() => setMoneda(m)} className="sr-only" />
              {m === 'ARS' ? 'Pesos' : 'Dólares'}
            </label>
          ))}
        </div>
        {errores.moneda_riesgo ? <p className="text-sm text-negative">{errores.moneda_riesgo}</p> : null}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Geografía" htmlFor={`${id}-geo`} error={errores.geografia}>
          <Selector id={`${id}-geo`} name="geografia" defaultValue={sugerido.geografia}>
            {GEOGRAFIAS.map((g) => (
              <option key={g} value={g}>
                {NOMBRE_GEOGRAFIA[g]}
              </option>
            ))}
          </Selector>
        </Campo>
        {esBono ? (
          <Campo etiqueta="Indexación" htmlFor={`${id}-idx`} error={errores.indexacion}>
            <Selector id={`${id}-idx`} name="indexacion" defaultValue={sugerido.indexacion ?? 'fija'}>
              {INDEXACIONES.map((i) => (
                <option key={i} value={i}>
                  {NOMBRE_INDEXACION[i]}
                </option>
              ))}
            </Selector>
          </Campo>
        ) : null}
        {esCedear ? (
          <>
            <Campo etiqueta="Ticker del subyacente" htmlFor={`${id}-sub`} error={errores.ticker_subyacente}>
              <Entrada id={`${id}-sub`} name="ticker_subyacente" defaultValue={sugerido.ticker_subyacente ?? sugerido.ticker} invalido={Boolean(errores.ticker_subyacente)} />
            </Campo>
            <Campo etiqueta="Ratio (CEDEARs por acción)" htmlFor={`${id}-ratio`} error={errores.ratio} ayuda="Ej.: 20. Queda con su historia en el catálogo.">
              <Entrada id={`${id}-ratio`} name="ratio" inputMode="decimal" invalido={Boolean(errores.ratio)} />
            </Campo>
          </>
        ) : null}
        <Campo etiqueta="Color en los gráficos" htmlFor={`${id}-color`} error={errores.color} ayuda={color ? undefined : 'Opcional.'}>
          <div className="flex items-center gap-2">
            <input
              id={`${id}-color`}
              type="color"
              value={color ?? '#5b6474'}
              onChange={(e) => setColor(e.target.value)}
              className="tocable h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-surface lg:h-10"
            />
            {color ? (
              <Boton variante="fantasma" onClick={() => setColor(null)}>
                Sin color
              </Boton>
            ) : null}
          </div>
        </Campo>
      </div>
      {errores._ ? (
        <p role="alert" className="text-sm text-negative">
          {errores._}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" variante="primario" disabled={pendiente} className="max-sm:w-full">
          {pendiente ? 'Guardando…' : `Dar de alta ${sugerido.ticker}`}
        </Boton>
        <Boton variante="fantasma" onClick={onCancelar} className="max-sm:w-full">
          Cancelar
        </Boton>
      </div>
    </form>
  )
}
