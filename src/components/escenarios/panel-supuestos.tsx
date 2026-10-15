'use client'

// Panel de supuestos de un escenario (plan §6 D.1; D-08, D-88, D-145, D-155).
// Lo usa Flujo y lo puede abrir Evolución en una hoja (B.1 bloque 7): recibe
// la base serializada y los supuestos, y devuelve los supuestos nuevos. No
// calcula nada: el texto de "Igual", el deslizante y los cambios salen de
// panel.ts y supuestos.ts (funciones puras con test).
//
// Reglas: nada de mercado arranca elegido; Baja o Sube sin número es "falta";
// "Completar lo que falta con Igual" lo toca el dueño; la única regla
// precargada es la que declaró el 14/10, rotulada; sin palabras de valoración.

import { HelpCircle, Plus, X } from 'lucide-react'
import { memo, useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { NOMBRE_CLASE } from '@/lib/vistas/colores'
import {
  AJUSTE_MAXIMO,
  agregarTramo,
  atajosHorizonte,
  claveDeRuta,
  claveRecordada,
  conAjuste,
  conVar,
  elegirDireccion,
  leerVar,
  nombreMesN,
  nombreVariable,
  rutasDelPanel,
  sacarTramo,
  textoIgual,
  type RutaVar,
} from '@/lib/domain/flujo/panel'
import { leasingsSinCuadro } from '@/lib/domain/flujo/cuotas'
import { completarConIgual, metaVariable, supuestosVacios, textoBoton } from '@/lib/domain/flujo/supuestos'
import type { BaseProyeccion, ClaseProyeccion, Direccion, Supuestos } from '@/lib/domain/flujo/tipos'
import { TextoConMontos } from '@/components/monto'
import { Casilla } from './casilla'
import { Deslizante } from './deslizante'

export interface PropsPanelSupuestos {
  base: BaseProyeccion
  supuestos: Supuestos
  /** discreto = un toque (Baja, Igual, Sube, un atajo): va al historial; el deslizante, no. */
  onCambio: (s: Supuestos, opciones?: { discreto?: boolean }) => void
  recordados: Record<string, string>
  /** Lo que falta para proyectar (de proyectar()). */
  faltan: { variable: string; texto: string }[]
  parciales?: { variable: string; texto: string }[]
  /** Lo declarado en Pasivos: si la empresa te reintegra el IVA (null = sin declarar). */
  reintegroDeclarado: boolean | null
  pagadorDeclarado: 'titular' | 'empresa' | null
  /** Prefijo de los ids (dos paneles en la misma página no chocan). */
  id?: string
}

const CLASES_DESTINO: ClaseProyeccion[] = ['cedear', 'accion_local', 'bono', 'lecap', 'fci', 'liquidez']

const BOTON = 'tocable inline-flex min-h-9 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors'
const ELEGIDO = 'border-accent bg-accent-soft text-accent'
const LIBRE = 'border-border bg-surface text-text hover:bg-surface-2'

function Ayuda({ texto, nombre }: { texto: string; nombre: string }) {
  return (
    <details className="group shrink-0">
      <summary
        className="tocable inline-flex size-8 cursor-pointer list-none items-center justify-center rounded-full text-muted hover:text-text [&::-webkit-details-marker]:hidden"
        aria-label={`¿Qué es ${nombre}?`}
      >
        <HelpCircle aria-hidden className="size-4" />
      </summary>
      <p className="mt-1 max-w-prose text-xs text-muted">{texto}</p>
    </details>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{titulo}</h3>
      {children}
    </section>
  )
}

type CambiarCon = (f: (x: Supuestos) => Supuestos, opciones?: { discreto?: boolean }) => void
type VariablePorTramos = 'ingreso_usd' | 'ingreso_pesos' | 'devaluacion' | 'inflacion'

interface PropsTarjeta {
  ruta: RutaVar
  base: BaseProyeccion
  recordados: Record<string, string>
  /** Cambia los supuestos a partir de los últimos (no de los que vio la tarjeta al dibujarse). */
  cambiarCon: CambiarCon
  nombre: string
  dir: Direccion | null
  valor: string | null
  /** Solo gastos: atados a la inflación del escenario. */
  atado?: boolean
  /** Solo ingreso en pesos: el ajuste mensual del tramo (null = nominal). */
  ajuste?: string | null
  /** Si va por tramos: su número, cuántos hay y desde qué mes propone el que sigue. */
  tramo?: { i: number; n: number; inicial: number; variable: VariablePorTramos }
}

/**
 * Una variable: Baja · Igual · Sube, el texto de Igual y, con Baja o Sube, el
 * deslizante. Memorizada: al mover un deslizante se vuelve a dibujar solo su
 * tarjeta (el teléfono lo nota), y cada cambio se aplica sobre los últimos
 * supuestos.
 */
const TarjetaVariable = memo(
  function TarjetaVariable({ ruta, base, recordados, cambiarCon, nombre, dir, valor, atado, ajuste, tramo }: PropsTarjeta) {
    const clave = claveDeRuta(ruta)
    const meta = metaVariable(clave)
    const elegir = (d: Direccion) => {
      const rec = d === 'igual' ? null : (recordados[claveRecordada(ruta, d)] ?? null)
      cambiarCon((x) => conVar(x, ruta, elegirDireccion(leerVar(x, ruta) ?? { dir, valor }, d, rec)), { discreto: true })
    }
    const falta = dir === null ? 'Elegí Baja, Igual o Sube.' : dir !== 'igual' && valor === null ? 'Mové el deslizante para decir cuánto.' : null
    return (
      <div className="rounded-lg border border-border bg-surface p-3" data-variable={ruta}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-text">{nombre}</h4>
            <p className="mt-0.5 text-xs text-muted">
              Igual = <TextoConMontos texto={textoIgual(ruta, base)} />
            </p>
          </div>
          <Ayuda texto={meta.ayuda} nombre={meta.nombre} />
        </div>
        <div role="group" aria-label={`${nombre}: Baja, Igual o Sube`} className="mt-2 grid grid-cols-3 gap-1">
          {(['baja', 'igual', 'sube'] as const).map((d) => {
            const activo = dir === d
            // El número va en el botón, en un segundo renglón: entra en 360 px sin cortarse.
            const [palabra, ...resto] = (activo ? textoBoton(clave, d, valor) : d === 'baja' ? 'Baja' : d === 'igual' ? 'Igual' : 'Sube').split(' ')
            return (
              <button key={d} type="button" aria-pressed={activo} className={`${BOTON} ${activo ? ELEGIDO : LIBRE} flex-col px-1 leading-tight`} onClick={() => elegir(d)} data-dir={d}>
                <span>{palabra}</span>
                {resto.length ? (
                  <>
                    {' '}
                    <span className="num text-xs">{resto.join(' ')}</span>
                  </>
                ) : null}
              </button>
            )
          })}
        </div>
        {dir === 'baja' || dir === 'sube' ? (
          <>
            <p className="mt-2 text-xs text-muted">
              {dir === 'baja' ? `Baja: ${meta.baja}` : `Sube: ${meta.sube}`} (de 0 a {dir === 'baja' ? meta.max.baja : meta.max.sube})
            </p>
            <Deslizante
              nombre={nombre}
              valor={valor}
              max={dir === 'baja' ? meta.max.baja : meta.max.sube}
              unidad={meta.unidad}
              signo={dir === 'baja' ? '−' : '+'}
              onCambio={(nuevo) => cambiarCon((x) => conVar(x, ruta, { dir, valor: nuevo }))}
            />
          </>
        ) : null}
        {falta ? <p className="mt-2 text-xs font-medium text-warn">{falta}</p> : null}
        {ajuste !== undefined && tramo ? (
          <>
            <Casilla className="mt-2" marcada={ajuste !== null} onCambio={(m) => cambiarCon((x) => conAjuste(x, tramo.i, m ? '0.0' : null), { discreto: true })}>
              Se ajusta todos los meses
            </Casilla>
            {ajuste !== null ? (
              <Deslizante
                nombre={`Ajuste mensual de ${nombre.toLowerCase()}`}
                valor={ajuste}
                max={AJUSTE_MAXIMO}
                unidad="%/mes"
                signo="+"
                onCambio={(nuevo) => cambiarCon((x) => conAjuste(x, tramo.i, nuevo))}
              />
            ) : null}
          </>
        ) : null}
        {atado !== undefined ? (
          <Casilla className="mt-2" marcada={atado} onCambio={(m) => cambiarCon((x) => ({ ...x, gastos: { ...x.gastos, atado_inflacion: m } }), { discreto: true })}>
            Atados a la inflación del escenario
          </Casilla>
        ) : null}
        {tramo && tramo.i > 0 ? (
          <button
            type="button"
            className="tocable mt-2 inline-flex min-h-9 items-center gap-1 text-sm text-muted hover:text-text"
            onClick={() => cambiarCon((x) => sacarTramo(x, tramo.variable, tramo.i), { discreto: true })}
          >
            <X aria-hidden className="size-4" /> Sacar este tramo
          </button>
        ) : null}
        {tramo && tramo.i === tramo.n - 1 && tramo.n < 6 ? (
          <div className="mt-2">
            <AgregarTramo base={base} inicial={tramo.inicial} texto="Otro tramo desde el" onAgregar={(mes) => cambiarCon((x) => agregarTramo(x, tramo.variable, mes), { discreto: true })} />
          </div>
        ) : null}
      </div>
    )
  },
  (a, b) =>
    a.ruta === b.ruta &&
    a.base === b.base &&
    a.recordados === b.recordados &&
    a.cambiarCon === b.cambiarCon &&
    a.nombre === b.nombre &&
    a.dir === b.dir &&
    a.valor === b.valor &&
    a.atado === b.atado &&
    a.ajuste === b.ajuste &&
    a.tramo?.i === b.tramo?.i &&
    a.tramo?.n === b.tramo?.n &&
    a.tramo?.inicial === b.tramo?.inicial &&
    a.tramo?.variable === b.tramo?.variable,
)

/** "Desde el mes N" con − y +: arma un tramo nuevo (el ingreso cambia en feb-2027, D-147). */
function AgregarTramo({ base, texto, onAgregar, inicial }: { base: BaseProyeccion; texto: string; onAgregar: (mes: number) => void; inicial: number }) {
  const [mes, setMes] = useState(inicial)
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  if (!abierto) {
    return (
      <button type="button" className="tocable inline-flex min-h-9 items-center gap-1 text-sm text-accent hover:underline" onClick={() => setAbierto(true)}>
        <Plus aria-hidden className="size-4" /> Otro tramo
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-2 text-sm">
      <span id={id} className="text-muted">
        {texto}
      </span>
      <div role="group" aria-labelledby={id} className="flex items-center gap-1">
        <button type="button" className={`${BOTON} ${LIBRE} size-9 px-0`} aria-label="Un mes antes" onClick={() => setMes((m) => Math.max(2, m - 1))}>
          −
        </button>
        <span className="num min-w-[6.5rem] text-center">
          mes {mes} · {nombreMesN(base, mes)}
        </span>
        <button type="button" className={`${BOTON} ${LIBRE} size-9 px-0`} aria-label="Un mes después" onClick={() => setMes((m) => Math.min(120, m + 1))}>
          +
        </button>
      </div>
      <button type="button" className={`${BOTON} ${LIBRE} gap-1`} onClick={() => onAgregar(mes)}>
        <Plus aria-hidden className="size-4" /> Agregar tramo
      </button>
    </div>
  )
}

function Opciones<T extends string | boolean>({
  etiqueta,
  valor,
  opciones,
  onElegir,
}: {
  etiqueta: string
  valor: T | null
  opciones: { valor: T; texto: string }[]
  onElegir: (v: T) => void
}) {
  return (
    <div role="group" aria-label={etiqueta} className="mt-2 flex flex-wrap gap-1">
      {opciones.map((o) => (
        <button key={String(o.valor)} type="button" aria-pressed={valor === o.valor} className={`${BOTON} ${valor === o.valor ? ELEGIDO : LIBRE}`} onClick={() => onElegir(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  )
}

export function PanelSupuestos({ base, supuestos: s, onCambio, recordados, faltan, parciales = [], reintegroDeclarado, pagadorDeclarado, id = 'sup' }: PropsPanelSupuestos) {
  const [verTodo, setVerTodo] = useState(false)
  // Los últimos supuestos, para que las tarjetas memorizadas cambien sobre ellos y no sobre los de su dibujo.
  const ultimos = useRef(s)
  useLayoutEffect(() => {
    ultimos.current = s
  }, [s])
  const cambiarCon = useCallback<CambiarCon>(
    (f, opciones) => {
      const n = f(ultimos.current)
      ultimos.current = n
      onCambio(n, opciones)
    },
    [onCambio],
  )
  const grupos = rutasDelPanel(base, s)
  const atajos = atajosHorizonte(base)
  const tuRegla = s.politica.origen === 'declarada_14_10'
  const cambiarPolitica = (p: Partial<Supuestos['politica']>) => onCambio({ ...s, politica: { ...s.politica, ...p, origen: 'elegida' } }, { discreto: true })
  // Con cuotas por venir, o con un leasing vigente cuyo cuadro de marcha todavía no cargaste.
  const hayCuotas = base.cuotas.some((c) => c.fecha_vencimiento > base.fecha) || leasingsSinCuadro(base, base.fecha).length > 0
  const visibles = verTodo ? faltan : faltan.slice(0, 4)

  return (
    <div className="space-y-4" id={id}>
      {faltan.length ? (
        <div className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm" role="status">
          <p className="font-medium text-text">Para proyectar faltan {faltan.length === 1 ? 'un dato' : `${faltan.length} datos`}:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
            {visibles.map((f) => (
              <li key={f.variable}>{f.texto}</li>
            ))}
          </ul>
          {faltan.length > 4 ? (
            <button type="button" className="tocable mt-1 text-sm text-accent hover:underline" onClick={() => setVerTodo((x) => !x)} aria-expanded={verTodo}>
              {verTodo ? 'Ver menos' : `Ver los ${faltan.length}`}
            </button>
          ) : null}
          <button
            type="button"
            className="tocable mt-2 flex min-h-10 w-full items-center justify-center rounded-lg border border-accent bg-surface px-3 text-sm font-medium text-accent hover:bg-accent-soft"
            onClick={() => onCambio(completarConIgual(s, base), { discreto: true })}
          >
            Completar lo que falta con Igual
          </button>
          <p className="mt-1 text-xs text-muted">Pone Igual solo en lo que no elegiste; no toca lo demás. El horizonte lo elegís vos.</p>
        </div>
      ) : null}

      <Grupo titulo="Horizonte">
        <div className="rounded-lg border border-border bg-surface p-3">
          <div role="group" aria-label="Hasta cuándo proyectar" className="flex flex-wrap gap-1">
            {atajos.map((a) => (
              <button
                key={a.meses}
                type="button"
                aria-pressed={s.horizonte_meses === a.meses}
                className={`${BOTON} ${s.horizonte_meses === a.meses ? ELEGIDO : LIBRE}`}
                onClick={() => onCambio({ ...s, horizonte_meses: a.meses }, { discreto: true })}
              >
                {a.texto}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <button
              type="button"
              className={`${BOTON} ${LIBRE} size-9 px-0`}
              aria-label="Un mes menos"
              onClick={() => onCambio({ ...s, horizonte_meses: Math.max(1, (s.horizonte_meses ?? 2) - 1) })}
            >
              −
            </button>
            <span className="num min-w-24 text-center" aria-live="polite">
              {s.horizonte_meses === null ? 'sin elegir' : `${s.horizonte_meses} ${s.horizonte_meses === 1 ? 'mes' : 'meses'} · ${nombreMesN(base, s.horizonte_meses)}`}
            </span>
            <button
              type="button"
              className={`${BOTON} ${LIBRE} size-9 px-0`}
              aria-label="Un mes más"
              onClick={() => onCambio({ ...s, horizonte_meses: Math.min(120, (s.horizonte_meses ?? 0) + 1) })}
            >
              +
            </button>
          </div>
        </div>
      </Grupo>

      <Grupo titulo="Qué hacés con lo que sobra">
        <div className="rounded-lg border border-border bg-surface p-3 text-sm" data-variable="politica">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium text-text">Tu regla de reinversión</h4>
            <span className={`rounded-md px-1.5 py-px text-[11px] font-medium ${tuRegla ? 'bg-accent-soft text-accent' : 'bg-surface-3 text-muted'}`}>{tuRegla ? 'tu regla · 14/10' : 'elegida por vos'}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Cada mes, lo que sobra = ingresos − gastos fijos − la cuota entera del leasing (lo que se debita). Se invierte el {s.politica.pct.replace('.', ',')}%{' '}
            {s.politica.regla === 'proporcional_ultima_carga'
              ? `repartido según el peso de cada posición en tu última carga${s.politica.incluye_liquidez === false ? ' (sin contar la liquidez)' : ', liquidez incluida'}`
              : `en ${s.politica.clase ? NOMBRE_CLASE[s.politica.clase] : 'la clase que elijas'}`}
            .{Number(s.politica.pct) < 100 ? ' Lo que no invertís no se cuenta como patrimonio financiero (no se sabe adónde va).' : ''} Si un mes no alcanza, sale de tus pesos y el mes lo dice («no se cubre» si se terminan).
          </p>
          <Deslizante nombre="Lo que invertís del excedente" valor={s.politica.pct} max={100} unidad="%" signo="+" onCambio={(pct) => onCambio({ ...s, politica: { ...s.politica, pct, origen: 'elegida' } })} />
          <Opciones
            etiqueta="Cómo se reparte"
            valor={s.politica.regla}
            opciones={[
              { valor: 'proporcional_ultima_carga', texto: 'Como tu última carga' },
              { valor: 'por_clase', texto: 'Todo a una clase' },
            ]}
            onElegir={(regla) => cambiarPolitica({ regla, clase: regla === 'por_clase' ? (s.politica.clase ?? 'cedear') : null })}
          />
          {s.politica.regla === 'por_clase' ? (
            <Opciones etiqueta="A qué clase" valor={s.politica.clase} opciones={CLASES_DESTINO.map((c) => ({ valor: c, texto: NOMBRE_CLASE[c] }))} onElegir={(clase) => cambiarPolitica({ clase })} />
          ) : (
            <Casilla className="mt-2" marcada={s.politica.incluye_liquidez !== false} onCambio={(v) => cambiarPolitica({ incluye_liquidez: v })}>
              Contar la liquidez (pesos y dólares) en el reparto
            </Casilla>
          )}
          <p className="mt-2 text-xs font-medium text-muted">Lo que vence (letras, bonos)</p>
          <Opciones
            etiqueta="Adónde va lo que vence"
            valor={s.destino_vencimientos}
            opciones={[{ valor: 'regla' as const, texto: 'Con la misma regla' }, ...CLASES_DESTINO.map((c) => ({ valor: c, texto: NOMBRE_CLASE[c] }))]}
            onElegir={(destino_vencimientos) => onCambio({ ...s, destino_vencimientos }, { discreto: true })}
          />
          {!tuRegla ? (
            <button
              type="button"
              className="tocable mt-2 text-sm text-accent hover:underline"
              onClick={() => {
                const v = supuestosVacios()
                onCambio({ ...s, politica: v.politica, destino_vencimientos: v.destino_vencimientos }, { discreto: true })
              }}
            >
              Volver a tu regla del 14/10
            </button>
          ) : null}
        </div>
      </Grupo>

      {hayCuotas ? (
        <Grupo titulo="El leasing">
          <div className="rounded-lg border border-border bg-surface p-3 text-sm" data-variable="pagador_cuota">
            <h4 className="font-medium text-text">¿Quién paga la cuota?</h4>
            <Opciones
              etiqueta="Quién paga la cuota"
              valor={s.pagador_cuota?.quien ?? null}
              opciones={[
                { valor: 'titular' as const, texto: 'Vos' },
                { valor: 'empresa' as const, texto: 'La empresa' },
              ]}
              onElegir={(quien) => onCambio({ ...s, pagador_cuota: { quien, desde_mes: null } }, { discreto: true })}
            />
            <p className="mt-1 text-xs text-muted">
              {s.pagador_cuota?.quien === 'titular'
                ? `La cuota entera resta de tu excedente${pagadorDeclarado === 'titular' ? ' (lo dijiste el 14/10)' : ''}.`
                : s.pagador_cuota?.quien === 'empresa'
                  ? 'La cuota no resta de tu excedente.'
                  : 'Sin elegir: el excedente queda sin dato.'}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3 text-sm" data-variable="reintegro_iva">
            <h4 className="font-medium text-text">¿La empresa te reintegra el IVA y la percepción?</h4>
            {reintegroDeclarado !== null ? (
              <p className="mt-1 text-xs text-muted">Lo declaraste en Pasivos: {reintegroDeclarado ? 'sí' : 'no'}. Para cambiarlo, cambialo ahí.</p>
            ) : (
              <>
                <Opciones
                  etiqueta="La empresa te reintegra el IVA"
                  valor={s.reintegro_iva}
                  opciones={[
                    { valor: true, texto: 'Sí' },
                    { valor: false, texto: 'No' },
                  ]}
                  onElegir={(reintegro_iva) => onCambio({ ...s, reintegro_iva }, { discreto: true })}
                />
                <p className="mt-1 text-xs text-muted">
                  Lo que sale de tu cuenta es la cuota entera. El reintegro entra como ingreso solo si lo declarás en Pasivos o lo elegís acá
                  {s.reintegro_iva === null ? ': sin elegir, no se cuenta ninguno.' : '.'}
                </p>
              </>
            )}
          </div>
        </Grupo>
      ) : null}

      {grupos.map((g) => (
        <Grupo key={g.grupo} titulo={g.grupo}>
          {g.rutas.map((ruta) => {
            const v = leerVar(s, ruta)
            if (!v) return null
            const [a, b] = ruta.split('.')
            const i = Number(b)
            const porTramos = a === 'ingreso_usd' || a === 'ingreso_pesos' || a === 'devaluacion' || a === 'inflacion'
            let tramo: PropsTarjeta['tramo']
            if (porTramos) {
              const variable = a as VariablePorTramos
              const n = s[variable].length
              const desde = variable === 'ingreso_usd' || variable === 'ingreso_pesos' ? (s[variable][i]?.desde_mes ?? 1) : (s[variable][Math.max(0, i - 1)]?.hasta_mes ?? 0)
              tramo = { i, n, inicial: Math.min(120, desde + 6), variable }
            }
            return (
              <TarjetaVariable
                key={ruta}
                ruta={ruta}
                base={base}
                recordados={recordados}
                cambiarCon={cambiarCon}
                nombre={nombreVariable(ruta, s, base)}
                dir={v.dir}
                valor={v.valor}
                atado={a === 'gastos' ? s.gastos.atado_inflacion === true : undefined}
                ajuste={a === 'ingreso_pesos' ? (s.ingreso_pesos[i]?.ajuste_mensual ?? null) : undefined}
                tramo={tramo}
              />
            )
          })}
        </Grupo>
      ))}

      {parciales.length ? (
        <div className="text-xs text-muted">
          <p>Se proyecta igual, con esto sin dato:</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {parciales.map((p) => (
              <li key={p.variable}>{p.texto}.</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
