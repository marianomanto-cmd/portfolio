'use client'

// Catálogo de activos (4.9 de la visión): tipo, moneda de riesgo, geografía,
// indexación, ratio con historia y color fijo. Tabla en desktop, tarjetas
// debajo de 768 px (D-30). La moneda de riesgo la elegís vos (D-73).

import { useEffect, useId, useRef, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import type { Activo, Fecha } from '@/lib/domain/tipos'
import { numero } from '@/lib/domain/dinero'
import { fechaLarga } from '@/lib/domain/fechas'
import { Boton, Campo, Chip, Entrada, Selector } from '../../carga/_componentes/ui'
import { editarActivo, nuevoActivo } from '../acciones'
import { ratioVigente, type Ratio } from '../_lib/calculos'
import { GEOGRAFIAS, INDEXACIONES, NOMBRE_GEOGRAFIA, NOMBRE_INDEXACION, NOMBRE_TIPO, TIPOS_ACTIVO } from '../_lib/catalogo'
import { ElegirMoneda, Mensaje, Panel, useFormulario } from './formulario'

function FormActivo({ activo, ratios, hoy, onListo }: { activo: Activo | null; ratios: Ratio[]; hoy: Fecha; onListo: () => void }) {
  const id = useId()
  const [estado, accion, enviando] = useFormulario(activo ? editarActivo : nuevoActivo)
  const [tipo, setTipo] = useState<Activo['tipo']>(activo?.tipo ?? 'cedear')
  const [moneda, setMoneda] = useState<'ARS' | 'USD' | ''>(activo?.moneda_riesgo ?? '')
  const [conColor, setConColor] = useState(Boolean(activo?.color))
  const [color, setColor] = useState(activo?.color ?? '#5b6474')
  const [enUso, setEnUso] = useState(activo?.activo_bool ?? true)
  const e = estado.errores
  const esBono = tipo === 'bono' || tipo === 'lecap'
  const vigente = activo ? ratioVigente(ratios, activo.id, hoy) : null
  const historia = activo ? ratios.filter((r) => r.activo_id === activo.id).sort((a, b) => (a.vigente_desde < b.vigente_desde ? 1 : -1)) : []
  const primerCampo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    primerCampo.current?.focus()
  }, [])
  // Un alta guardada limpia el formulario para la siguiente (el mensaje queda).
  useEffect(() => {
    if (estado.ok && estado.vez > 0 && !activo) {
      setTipo('cedear')
      setMoneda('')
      setConColor(false)
    }
  }, [estado.ok, estado.vez, activo])

  return (
    <form key={activo ? 'editar' : estado.vez} onSubmit={accion} noValidate className="space-y-3" aria-label={activo ? `Editar ${activo.ticker}` : 'Nuevo activo'}>
      {activo ? <input type="hidden" name="id" value={activo.id} /> : null}
      {activo ? <input type="hidden" name="tiene_ratio" value={historia.length ? '1' : ''} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {activo ? (
          <div className="min-w-0 space-y-1">
            <span className="block text-sm font-medium text-text">Ticker</span>
            <p className="num flex min-h-11 items-center text-lg text-text lg:min-h-10">{activo.ticker}</p>
          </div>
        ) : (
          <Campo etiqueta="Ticker" htmlFor={`${id}-ticker`} error={e.ticker}>
            <Entrada ref={primerCampo} id={`${id}-ticker`} name="ticker" autoCapitalize="characters" invalido={Boolean(e.ticker)} className="num uppercase" />
          </Campo>
        )}
        <Campo etiqueta="Nombre" htmlFor={`${id}-nombre`} error={e.nombre} className="xl:col-span-2">
          <Entrada ref={activo ? primerCampo : undefined} id={`${id}-nombre`} name="nombre" defaultValue={activo?.nombre} invalido={Boolean(e.nombre)} />
        </Campo>
        <Campo etiqueta="Tipo" htmlFor={`${id}-tipo`} error={e.tipo}>
          <Selector id={`${id}-tipo`} name="tipo" value={tipo} onChange={(ev) => setTipo(ev.target.value as Activo['tipo'])}>
            {TIPOS_ACTIVO.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TIPO[t]}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2 xl:col-span-1">
          <ElegirMoneda
            nombre="moneda_riesgo"
            valor={moneda}
            onCambio={setMoneda}
            leyenda="Moneda de riesgo"
            ayuda="¿A qué moneda te expone? Un CEDEAR es dólares."
            error={e.moneda_riesgo}
          />
        </div>
        <Campo etiqueta="Geografía" htmlFor={`${id}-geo`} error={e.geografia}>
          <Selector id={`${id}-geo`} name="geografia" defaultValue={activo?.geografia ?? (tipo === 'cedear' ? 'US' : 'AR')}>
            {GEOGRAFIAS.map((g) => (
              <option key={g} value={g}>
                {NOMBRE_GEOGRAFIA[g]}
              </option>
            ))}
          </Selector>
        </Campo>
        {esBono ? (
          <Campo etiqueta="Indexación" htmlFor={`${id}-idx`} error={e.indexacion}>
            <Selector id={`${id}-idx`} name="indexacion" defaultValue={activo?.indexacion ?? 'fija'}>
              {INDEXACIONES.map((i) => (
                <option key={i} value={i}>
                  {NOMBRE_INDEXACION[i]}
                </option>
              ))}
            </Selector>
          </Campo>
        ) : null}
        {esBono ? (
          <Campo etiqueta="Vencimiento" htmlFor={`${id}-vto`} error={e.fecha_vencimiento} ayuda="Opcional.">
            <Entrada id={`${id}-vto`} type="date" name="fecha_vencimiento" defaultValue={activo?.fecha_vencimiento ?? ''} />
          </Campo>
        ) : null}
        {tipo === 'cedear' ? (
          <Campo etiqueta="Ticker del subyacente" htmlFor={`${id}-sub`} error={e.ticker_subyacente}>
            <Entrada id={`${id}-sub`} name="ticker_subyacente" defaultValue={activo?.ticker_subyacente ?? ''} className="num uppercase" invalido={Boolean(e.ticker_subyacente)} />
          </Campo>
        ) : null}
      </div>
      {tipo === 'cedear' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Campo
            etiqueta={activo ? 'Ratio nuevo (CEDEARs por acción)' : 'Ratio (CEDEARs por acción)'}
            htmlFor={`${id}-ratio`}
            error={e.ratio}
            ayuda={
              activo
                ? vigente
                  ? `Vigente: ${numero(vigente.ratio, 4, { min: 0 })} desde ${fechaLarga(vigente.vigente_desde)}. Dejalo vacío si no cambió.`
                  : 'Sin ratio vigente: cargalo con su fecha.'
                : 'Ej.: 20.'
            }
          >
            <Entrada id={`${id}-ratio`} name="ratio" inputMode="decimal" invalido={Boolean(e.ratio)} className="num" />
          </Campo>
          {activo ? (
            <Campo etiqueta="Vigente desde" htmlFor={`${id}-ratio-desde`} error={e.ratio_desde}>
              <Entrada id={`${id}-ratio-desde`} type="date" name="ratio_desde" max={hoy} invalido={Boolean(e.ratio_desde)} />
            </Campo>
          ) : null}
          {historia.length ? (
            <div className="min-w-0 sm:col-span-2">
              <p className="text-sm font-medium text-text">Historia del ratio</p>
              <ul className="num mt-1 text-sm text-muted">
                {historia.map((r) => (
                  <li key={r.vigente_desde}>
                    {numero(r.ratio, 4, { min: 0 })} desde {fechaLarga(r.vigente_desde)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="block text-sm font-medium text-text">Color en los gráficos</span>
          <div className="flex items-center gap-2">
            {conColor ? (
              <>
                <input type="color" aria-label="Color" value={color} onChange={(ev) => setColor(ev.target.value)} className="tocable h-11 w-14 cursor-pointer rounded-lg border border-border bg-surface lg:h-10" />
                <input type="hidden" name="color" value={color} />
                <Boton variante="fantasma" onClick={() => setConColor(false)}>
                  Sin color
                </Boton>
              </>
            ) : (
              <Boton variante="secundario" onClick={() => setConColor(true)}>
                Elegir color
              </Boton>
            )}
          </div>
          {e.color ? <p className="text-sm text-negative">{e.color}</p> : null}
        </div>
        {activo ? (
          <div className="space-y-1">
            <span className="block text-sm font-medium text-text">¿Se usa?</span>
            <input type="hidden" name="activo_bool" value={enUso ? 'true' : 'false'} />
            <Boton variante="secundario" aria-pressed={enUso} onClick={() => setEnUso((v) => !v)}>
              {enUso ? 'Sí, se usa' : 'No: ya no se ofrece en las cargas'}
            </Boton>
          </div>
        ) : null}
      </div>
      <Mensaje estado={estado} />
      <div className="flex flex-wrap gap-2 [&>*]:max-sm:flex-1">
        <Boton type="submit" variante="primario" disabled={enviando}>
          {enviando ? 'Guardando…' : activo ? 'Guardar cambios' : 'Dar de alta'}
        </Boton>
        <Boton variante="fantasma" onClick={onListo}>
          {estado.ok ? 'Cerrar' : 'Cancelar'}
        </Boton>
      </div>
    </form>
  )
}

function etiquetas(a: Activo, ratios: Ratio[], hoy: Fecha) {
  const vigente = a.tipo === 'cedear' ? ratioVigente(ratios, a.id, hoy) : null
  return {
    tipo: NOMBRE_TIPO[a.tipo],
    riesgo: a.moneda_riesgo === 'USD' ? 'Dólares' : 'Pesos',
    geografia: NOMBRE_GEOGRAFIA[a.geografia],
    indexacion: a.indexacion ? NOMBRE_INDEXACION[a.indexacion] : '—',
    ratio: a.tipo !== 'cedear' ? '—' : vigente ? `${numero(vigente.ratio, 4, { min: 0 })} (desde ${fechaLarga(vigente.vigente_desde)})` : 'sin dato',
    vence: a.fecha_vencimiento ? fechaLarga(a.fecha_vencimiento) : '—',
  }
}

function Punto({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className="inline-block size-3 shrink-0 rounded-full border border-border"
      style={{ background: color ?? 'transparent' }}
      title={color ?? 'sin color'}
    />
  )
}

export function Catalogo({ activos, ratios, hoy }: { activos: Activo[]; ratios: Ratio[]; hoy: Fecha }) {
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const activo = typeof editando === 'number' ? (activos.find((a) => a.id === editando) ?? null) : null

  useEffect(() => {
    if (editando !== null) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editando])

  return (
    <div className="space-y-4">
      <div ref={panel} className="scroll-mt-20">
        {editando !== null ? (
          <Panel titulo={activo ? `Editar ${activo.ticker}` : 'Nuevo activo'}>
            <FormActivo key={String(editando)} activo={activo} ratios={ratios} hoy={hoy} onListo={() => setEditando(null)} />
          </Panel>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted">
              {activos.length} {activos.length === 1 ? 'activo' : 'activos'}. Los tickers nuevos también se dan de alta desde Cargar.
            </p>
            <Boton variante="primario" onClick={() => setEditando('nuevo')} className="max-sm:w-full sm:ml-auto">
              <Plus aria-hidden className="size-4" /> Nuevo activo
            </Boton>
          </div>
        )}
      </div>

      {activos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-4 text-sm text-muted">
          Todavía no hay activos. Dalos de alta acá o desde la bandeja de Cargar, con su moneda de riesgo elegida por vos.
        </p>
      ) : null}

      {/* Desktop: tabla densa. */}
      {activos.length ? (
        <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Ticker</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Riesgo</th>
                <th className="hidden px-3 py-2 font-medium lg:table-cell">Geografía</th>
                <th className="px-3 py-2 font-medium">Indexación / ratio</th>
                <th className="hidden px-3 py-2 font-medium xl:table-cell">Vence</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activos.map((a) => {
                const t = etiquetas(a, ratios, hoy)
                return (
                  <tr key={a.id} className={a.activo_bool ? '' : 'text-muted'}>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <Punto color={a.color} />
                        <span className="num font-medium">{a.ticker}</span>
                      </span>
                    </td>
                    <td className="max-w-64 truncate px-3 py-2" title={a.nombre}>
                      {a.nombre}
                      {a.activo_bool ? null : <Chip className="ml-2">no se usa</Chip>}
                    </td>
                    <td className="px-3 py-2">{t.tipo}</td>
                    <td className="px-3 py-2">{t.riesgo}</td>
                    <td className="hidden px-3 py-2 lg:table-cell">{t.geografia}</td>
                    <td className={`px-3 py-2 ${a.tipo === 'cedear' ? 'num' : ''}`}>{a.tipo === 'cedear' ? t.ratio : t.indexacion}</td>
                    <td className="num hidden px-3 py-2 xl:table-cell">{t.vence}</td>
                    <td className="px-3 py-1 text-right">
                      <Boton variante="fantasma" onClick={() => setEditando(a.id)} aria-label={`Editar ${a.ticker}`}>
                        <Pencil aria-hidden className="size-4" /> Editar
                      </Boton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Teléfono: tarjetas. */}
      <ul className="space-y-2 md:hidden">
        {activos.map((a) => {
          const t = etiquetas(a, ratios, hoy)
          return (
            <li key={a.id} className="rounded-2xl border border-border bg-surface p-3">
              <div className="flex min-w-0 items-center gap-2">
                <Punto color={a.color} />
                <span className="num font-semibold text-text">{a.ticker}</span>
                <span className="min-w-0 truncate text-sm text-muted">{a.nombre}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <div>
                  <dt className="text-xs text-muted">Tipo</dt>
                  <dd>{t.tipo}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Riesgo</dt>
                  <dd>{t.riesgo}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Geografía</dt>
                  <dd>{t.geografia}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted">{a.tipo === 'cedear' ? 'Ratio' : 'Indexación'}</dt>
                  <dd className={`break-words ${a.tipo === 'cedear' ? 'num' : ''}`}>{a.tipo === 'cedear' ? t.ratio : t.indexacion}</dd>
                </div>
              </dl>
              <Boton variante="secundario" className="mt-2 w-full" onClick={() => setEditando(a.id)}>
                <Pencil aria-hidden className="size-4" /> Editar {a.ticker}
              </Boton>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
