'use client'

// Panel de supuestos de un escenario (plan §6 D.1; D-08, D-88, D-155, D-164).
// Lo usa Flujo: recibe la base serializada y los supuestos, y devuelve los
// supuestos nuevos. No calcula nada: el texto de "Igual", la barra y los
// cambios salen de panel.ts y supuestos.ts (funciones puras con test).
//
// Reglas (D-164, el dueño el 15/10: «en flujos y escenarios quiero ver
// graficos» y «seleccionar los valores de las variables con barras»):
// - Todo arranca en Igual (como en tu última carga): la proyección y sus
//   gráficos se ven sin tocar nada. Es un supuesto, y se dice.
// - Una sola barra por variable, de Baja a Sube, con Igual en el medio; el
//   número a la vista, − y + de a 0,1 y "Volver a Igual" de un toque.
// - Lo que no tiene Igual posible (la brecha sin el cripto, la TEM de
//   renovación sin la TEM de hoy) no tiene barra: dice qué falta.
// - La única regla precargada es la que declaraste el 14/10, rotulada.
// - Sin palabras de valoración.

import { HelpCircle, Plus, RotateCcw, X } from 'lucide-react'
import { memo, useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { NOMBRE_CLASE } from '@/lib/vistas/colores'
import {
  AJUSTE_MAXIMO,
  acotarHorizonte,
  agregarTramo,
  atajosHorizonte,
  claveDeRuta,
  conAjuste,
  conVar,
  esTodoIgual,
  extremosBarra,
  leerPosicion,
  leerVar,
  limitesBarra,
  nombreMesN,
  nombreVariable,
  pasoBarra,
  posicionDe,
  recordadosDeRuta,
  rutasDelPanel,
  sacarTramo,
  sentidoPosicion,
  sinIgualPosible,
  textoIgual,
  textoPosicion,
  todoIgualDe,
  varDePosicion,
  type RutaVar,
} from '@/lib/domain/flujo/panel'
import { leasingsSinCuadro } from '@/lib/domain/flujo/cuotas'
import { metaVariable, supuestosVacios } from '@/lib/domain/flujo/supuestos'
import type { BaseProyeccion, ClaseProyeccion, Direccion, Supuestos } from '@/lib/domain/flujo/tipos'
import { TextoConMontos } from '@/components/monto'
import { Barra } from './barra'
import { Casilla } from './casilla'
import { Deslizante } from './deslizante'

export interface PropsPanelSupuestos {
  base: BaseProyeccion
  supuestos: Supuestos
  /** discreto = un toque (Igual, un atajo, un número recordado): va al historial; la barra, no. */
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

const BOTON = 'tocable inline-flex min-h-9 items-center justify-center rounded-full border px-3 text-[13px] transition-colors'
const ELEGIDO = 'border-text bg-surface-3 text-text'
const LIBRE = 'border-border-strong text-muted hover:border-text hover:text-text'
const TARJETA = 'min-w-0 rounded-item border border-border bg-surface-2 p-4'

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

function Grupo({ titulo, children, ancho = false }: { titulo: string; children: ReactNode; ancho?: boolean }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="rotulo text-[10px]">{titulo}</h3>
      <div className={ancho ? 'grid items-start gap-3 lg:grid-cols-2' : 'grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3'}>{children}</div>
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
 * Una variable: su barra de Baja a Sube con Igual en el medio, el número a la
 * vista, "Igual =" con los datos de hoy y "Volver a Igual". Memorizada: al
 * mover una barra se vuelve a dibujar solo su tarjeta, y cada cambio se aplica
 * sobre los últimos supuestos.
 */
const TarjetaVariable = memo(
  function TarjetaVariable({ ruta, base, recordados, cambiarCon, nombre, dir, valor, atado, ajuste, tramo }: PropsTarjeta) {
    const clave = claveDeRuta(ruta)
    const meta = metaVariable(clave)
    const { min, max } = limitesBarra(clave)
    const pos = posicionDe({ dir, valor })
    const texto = textoPosicion(pos, clave)
    const sentido = sentidoPosicion(pos, clave)
    const sinIgual = sinIgualPosible(ruta, base)
    const poner = (p: string, discreto = false) => cambiarCon((x) => conVar(x, ruta, varDePosicion(p, clave)), { discreto })
    const recuerdos = recordadosDeRuta(ruta, recordados, pos)
    return (
      <div className={TARJETA} data-variable={ruta}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[14px] font-medium text-text">{nombre}</h4>
            <p className="mt-0.5 text-[12px] leading-snug text-muted">
              Igual = <TextoConMontos texto={textoIgual(ruta, base)} />
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <output className={`num text-right text-[12px] ${pos === null || pos === '0.0' ? 'text-muted' : 'text-text'}`} aria-live="polite" data-valor>
              {sinIgual ? 'sin dato' : texto}
            </output>
            <Ayuda texto={meta.ayuda} nombre={meta.nombre} />
          </div>
        </div>
        {sinIgual ? (
          <p className="mt-2 text-[12px] text-muted">{sinIgual}</p>
        ) : (
          <>
            <div className="mt-2">
              <Barra
                nombre={nombre}
                min={min}
                max={max}
                paso={0.1}
                posicion={pos}
                texto={sentido ? `${texto}: ${sentido}` : texto}
                conIgual
                extremos={extremosBarra(clave)}
                etiquetas={{ menos: `${nombre}: 0,1 menos`, mas: `${nombre}: 0,1 más` }}
                onPosicion={(t) => {
                  const p = leerPosicion(t, clave)
                  if (p !== null) poner(p)
                }}
                onMenos={() => poner(pasoBarra(pos, -0.1, clave))}
                onMas={() => poner(pasoBarra(pos, 0.1, clave))}
              />
            </div>
            {pos !== '0.0' || recuerdos.length ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {pos !== '0.0' ? (
                  <button type="button" className={`${BOTON} ${LIBRE} gap-1`} onClick={() => poner('0.0', true)} data-igual>
                    <RotateCcw aria-hidden className="size-3.5" /> Volver a Igual
                  </button>
                ) : null}
                {recuerdos.map((r) => (
                  <button key={r.pos} type="button" className={`${BOTON} ${LIBRE} num`} onClick={() => poner(r.pos, true)} aria-label={`${nombre}: tu último número, ${r.texto}`}>
                    {r.texto}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
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
                enCero="nominal"
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
            className="tocable mt-2 inline-flex min-h-9 items-center gap-1 text-[13px] text-muted hover:text-text"
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
      <button type="button" className="tocable inline-flex min-h-9 items-center gap-1 text-[13px] text-muted hover:text-text" onClick={() => setAbierto(true)}>
        <Plus aria-hidden className="size-4" /> Otro tramo
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-item border border-dashed border-border-strong p-2 text-[13px]">
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
    <div role="group" aria-label={etiqueta} className="mt-2 flex flex-wrap gap-1.5">
      {opciones.map((o) => (
        <button key={String(o.valor)} type="button" aria-pressed={valor === o.valor} className={`${BOTON} ${valor === o.valor ? ELEGIDO : LIBRE}`} onClick={() => onElegir(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  )
}

/**
 * Memorizado: en el render diferido de una barra (la proyección nueva) no se
 * vuelve a dibujar; en el urgente, solo la tarjeta de la barra que se movió.
 */
export const PanelSupuestos = memo(function PanelSupuestos({ base, supuestos: s, onCambio, recordados, faltan, parciales = [], reintegroDeclarado, pagadorDeclarado, id = 'sup' }: PropsPanelSupuestos) {
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
  const todoIgual = esTodoIgual(s)

  return (
    <div className="flex flex-col gap-5" id={id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[13px] text-muted">
          Cada variable arranca en <span className="text-text">Igual</span>: como en tu última carga. Mové una barra y los gráficos de arriba cambian; nada se guarda
          hasta que lo guardes.
        </p>
        <button
          type="button"
          className={`${BOTON} ${LIBRE} gap-1.5`}
          disabled={todoIgual}
          onClick={() => onCambio(todoIgualDe(s), { discreto: true })}
          aria-describedby={`${id}-todo-igual`}
        >
          <RotateCcw aria-hidden className="size-3.5" /> Todo en Igual
        </button>
        <span id={`${id}-todo-igual`} className="sr-only">
          Pone todas las barras en Igual y el ingreso en pesos sin ajuste. No cambia el horizonte ni tu regla.
        </span>
      </div>

      {faltan.length ? (
        <div className="rounded-item border border-border-strong bg-surface-2 p-3 text-[13px]" role="status">
          <p className="font-medium text-text">Para proyectar {faltan.length === 1 ? 'falta un dato' : `faltan ${faltan.length} datos`}:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
            {visibles.map((f) => (
              <li key={f.variable}>{f.texto}</li>
            ))}
          </ul>
          {faltan.length > 4 ? (
            <button type="button" className="tocable mt-1 text-[13px] text-text underline-offset-2 hover:underline" onClick={() => setVerTodo((x) => !x)} aria-expanded={verTodo}>
              {verTodo ? 'Ver menos' : `Ver los ${faltan.length}`}
            </button>
          ) : null}
          <p className="mt-1 text-xs text-muted">Esto no se elige con una barra: es un dato que falta. No se inventa.</p>
        </div>
      ) : null}

      <Grupo titulo="Horizonte" ancho>
        <div className={TARJETA}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-[14px] font-medium text-text">Hasta cuándo proyectar</h4>
            <span className="num text-[12px] text-text" aria-live="polite">
              {s.horizonte_meses === null ? 'sin elegir' : `${s.horizonte_meses} ${s.horizonte_meses === 1 ? 'mes' : 'meses'} · ${nombreMesN(base, s.horizonte_meses)}`}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <div role="group" aria-label="Hasta cuándo proyectar" className="flex flex-wrap gap-1.5">
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
            <button
              type="button"
              className={`${BOTON} ${LIBRE} size-9 px-0`}
              aria-label="Un mes menos"
              onClick={() => onCambio({ ...s, horizonte_meses: acotarHorizonte((s.horizonte_meses ?? 2) - 1) })}
            >
              −
            </button>
            <button
              type="button"
              className={`${BOTON} ${LIBRE} size-9 px-0`}
              aria-label="Un mes más"
              onClick={() => onCambio({ ...s, horizonte_meses: acotarHorizonte((s.horizonte_meses ?? 0) + 1) })}
            >
              +
            </button>
          </div>
        </div>
      </Grupo>

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

      <Grupo titulo="Qué hacés con lo que sobra" ancho>
        <div className={`${TARJETA} text-[13px]`} data-variable="politica">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[14px] font-medium text-text">Tu regla de reinversión</h4>
            <span className={`rounded-full px-2 py-px font-mono text-[10px] uppercase tracking-[0.08em] ${tuRegla ? 'bg-surface-3 text-text' : 'bg-surface-3 text-muted'}`}>{tuRegla ? 'tu regla · 14/10' : 'elegida por vos'}</span>
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
              className="tocable mt-2 text-[13px] text-text underline-offset-2 hover:underline"
              onClick={() => {
                const v = supuestosVacios()
                onCambio({ ...s, politica: v.politica, destino_vencimientos: v.destino_vencimientos }, { discreto: true })
              }}
            >
              Volver a tu regla del 14/10
            </button>
          ) : null}
        </div>
        {hayCuotas ? (
          <div className="flex min-w-0 flex-col gap-3">
            <div className={`${TARJETA} text-[13px]`} data-variable="pagador_cuota">
              <h4 className="text-[14px] font-medium text-text">¿Quién paga la cuota del leasing?</h4>
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
            <div className={`${TARJETA} text-[13px]`} data-variable="reintegro_iva">
              <h4 className="text-[14px] font-medium text-text">¿La empresa te reintegra el IVA y la percepción?</h4>
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
          </div>
        ) : null}
      </Grupo>

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
})
