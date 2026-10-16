'use client'

// Flujo y escenarios en el navegador (plan §6 D.1; D-144 a D-148, D-155,
// D-164 a D-166; handoff, captura 10). Arriba, lo del diseño: la lectura, la
// cascada del mes y el patrimonio en dólares del escenario elegido. Debajo,
// tus supuestos, una barra por variable, y después el detalle. La proyección
// corre acá, como función pura sobre la base serializada (proyectar), a cada
// movimiento de una barra. Arranca todo en Igual y en 12 meses (D-164): los
// gráficos se ven al abrir. Mientras se tantea, los supuestos viven en la URL
// (?s=): recargar no pierde nada y Atrás recorre lo probado. Nada proyectado
// se guarda: un escenario guarda sus supuestos.
//
// Rendimiento (calidad.md §3: el gráfico, en menos de 200 ms con la CPU × 4):
// la barra se mueve en el render urgente y la proyección, la lectura y el
// patrimonio en dólares en uno diferido (useDeferredValue); lo que no depende
// de la barra está memorizado y no se vuelve a dibujar (la cascada, el panel
// salvo la tarjeta que se mueve, los guardados, el encabezado en el render
// urgente). El detalle de abajo (la proyección mes a mes, sus gráficos y su
// grilla) se pone al día cuando la barra se queda quieta.

import { memo, startTransition, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { esTodoIgual, todoIgualDe } from '@/lib/domain/flujo/panel'
import { proyectar, trazaMes } from '@/lib/domain/flujo/proyeccion'
import { codificar, conArranque, decodificar, rebasar } from '@/lib/domain/flujo/supuestos'
import type { BaseProyeccion, Supuestos } from '@/lib/domain/flujo/tipos'
import type { EscenarioVista, MesActual } from '@/lib/vistas/contratos-flujo'
import { PanelSupuestos } from '@/components/escenarios/panel-supuestos'
import { Encabezado } from '@/components/pantalla/encabezado'
import { Rotulo, Tarjeta } from '@/components/ui'
import { lecturaFlujo, type QueEscenario } from '../_lib/lectura'
import { CascadaMes } from './cascada'
import { Guardados } from './guardados'
import { PatrimonioUsd, type OpcionEscenario } from './patrimonio'
import { Franja, Resultado } from './resultado'

/** La pregunta de la pantalla (handoff, captura 10). */
export const PREGUNTA_FLUJO = 'Futuro · ¿Cuánto me sobra y adónde me lleva?'

export interface PropsEscenarios {
  base: BaseProyeccion
  inicial: Supuestos
  /** ?s= de la URL, tal como llegó (se valida acá). */
  sUrl: string | null
  escenarios: EscenarioVista[]
  recordados: Record<string, string>
  reintegroDeclarado: boolean | null
  pagadorDeclarado: 'titular' | 'empresa' | null
  /** El mes en curso, con lo declarado y tu última carga (la cascada y la lectura). */
  mes: MesActual | null
  /** Debajo del encabezado (lo que falta cargar). */
  arriba?: ReactNode
  /** El resto del detalle, armado en el servidor (el mes, el calendario, proyectado contra real…). */
  detalle?: ReactNode
  /** El escenario guardado que se abre al llegar (?e= de "Ajustar supuestos" en Evolución): guardar los cambios lo actualiza. */
  abiertoInicial?: { id: number; nombre: string } | null
}

/**
 * Cuánto tiene que quedarse quieta una barra para que el detalle de abajo (la
 * grilla mes a mes y sus dos gráficos, lo más pesado de redibujar) se ponga al
 * día. Largo a propósito: si se pone al día mientras la barra todavía se
 * mueve, React lo dibuja junto con la proyección nueva y demora la lectura y
 * el gráfico de arriba.
 */
const QUIETA_MS = 900
/** Cuánto tiene que quedarse quieta una barra para escribir la dirección (una sola entrada de historial). */
const URL_MS = 600

/** El encabezado no cambia en el render urgente de una barra: memorizado, no se vuelve a dibujar. */
const EncabezadoFlujo = memo(Encabezado)

/** El mismo arreglo mientras su contenido no cambie (lo que falta para proyectar). */
function useEstable<T>(x: T): T {
  const clave = JSON.stringify(x ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => x, [clave])
}

function urlCon(s: Supuestos): string {
  const u = new URL(window.location.href)
  u.searchParams.set('s', codificar(s))
  return `${u.pathname}${u.search}${u.hash}`
}

export function Escenarios({
  base,
  inicial,
  sUrl,
  escenarios,
  recordados,
  reintegroDeclarado,
  pagadorDeclarado,
  mes,
  arriba,
  detalle,
  abiertoInicial = null,
}: PropsEscenarios) {
  // Un ?s= de otro mes se corre a la carga de hoy (rebasar): sus meses siguen en el mismo mes del calendario.
  // Lo que llegue sin elegir (un ?s= o un escenario de antes) arranca en Igual, y sin horizonte, en 12 meses.
  const leer = useCallback(
    (t: string | null) => {
      const d = decodificar(t)
      return d ? conArranque(rebasar(d, base.fecha), base) : null
    },
    [base],
  )
  const arranque = useMemo(() => conArranque(inicial, base), [inicial, base])
  const abiertoGuardado = abiertoInicial ? escenarios.find((e) => e.id === abiertoInicial.id) : undefined
  const [s, setS] = useState<Supuestos>(() => leer(sUrl) ?? (abiertoGuardado?.supuestos ? conArranque(abiertoGuardado.supuestos, base) : arranque))
  const [abierto, setAbierto] = useState<{ id: number; nombre: string } | null>(abiertoInicial)
  const urlInvalida = useMemo(() => sUrl !== null && decodificar(sUrl) === null, [sUrl])
  const pendiente = useRef<number | null>(null)
  // El último cambio fue de un toque (Igual, un atajo, abrir un escenario): el detalle se pone al día enseguida.
  const deUnToque = useRef(false)
  // Los últimos supuestos, para las acciones que no tienen que volver a dibujarse con cada barra.
  const ultimos = useRef(s)
  useLayoutEffect(() => {
    ultimos.current = s
  }, [s])

  // Atrás y Adelante recorren lo probado.
  useEffect(() => {
    const alVolver = () => {
      const d = leer(new URL(window.location.href).searchParams.get('s'))
      setS(d ?? arranque)
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [arranque, leer])

  const cambiar = useCallback((n: Supuestos, opciones?: { discreto?: boolean }) => {
    ultimos.current = n
    deUnToque.current = Boolean(opciones?.discreto)
    setS(n)
    if (pendiente.current !== null) window.clearTimeout(pendiente.current)
    if (opciones?.discreto) {
      window.history.pushState(null, '', urlCon(n))
      return
    }
    // La barra: una sola entrada de historial, escrita cuando se queda quieta.
    pendiente.current = window.setTimeout(() => {
      window.history.replaceState(null, '', urlCon(n))
      pendiente.current = null
    }, URL_MS)
  }, [])

  // La proyección sigue a la barra sin trabarla: se arma con el valor diferido.
  const diferido = useDeferredValue(s)
  const proy = useMemo(() => proyectar(base, diferido), [base, diferido])
  const todoIgual = useMemo(() => esTodoIgual(diferido), [diferido])
  // "Todo igual" de referencia: el mismo escenario con todas las barras en Igual (solo si no lo es ya). Mover
  // una barra no lo cambia: se proyecta de nuevo solo si cambia lo demás (el horizonte, los tramos, tu regla).
  const igual = useMemo(() => todoIgualDe(diferido), [diferido])
  const claveIgual = useMemo(() => codificar(igual), [igual])
  // `igual` cambia de identidad con cada barra; su contenido, solo cuando cambia claveIgual.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const referencia = useMemo(() => (todoIgual ? null : proyectar(base, igual)), [base, claveIgual, todoIgual])

  // El detalle de abajo (la proyección mes a mes, sus gráficos y su grilla) se pone al día cuando la barra
  // se queda quieta un momento, en otra pasada: mientras la movés, lo de arriba (la lectura y el patrimonio
  // en dólares) la sigue sin esperar a la grilla, que es lo que más cuesta redibujar. Después de un toque
  // (Igual, un atajo del horizonte, abrir un escenario), enseguida.
  const [abajo, setAbajo] = useState(() => ({ s: diferido, proy, referencia }))
  useEffect(() => {
    const t = window.setTimeout(() => startTransition(() => setAbajo({ s: diferido, proy, referencia })), deUnToque.current ? 0 : QUIETA_MS)
    return () => window.clearTimeout(t)
  }, [diferido, proy, referencia])

  // Lo que falta, estable mientras no cambie: si no, cada proyección nueva redibuja el panel entero.
  const faltan = useEstable(proy.faltan)
  const parciales = useEstable(proy.faltan_parciales)

  const activos = useMemo(() => escenarios.filter((e) => !e.archivado && e.supuestos), [escenarios])
  const opciones: OpcionEscenario[] = useMemo(() => [{ id: 'igual', nombre: 'Igual' }, ...activos.map((e) => ({ id: e.id, nombre: e.nombre }))], [activos])
  // Un guardado abierto al que le moviste una barra ya no es ese escenario: la lectura, la leyenda y la pastilla lo dicen
  // («Guardar cambios» lo actualiza y, al volver del servidor, deja de estar tocado).
  const guardadoAbierto = abierto ? activos.find((e) => e.id === abierto.id) : undefined
  const tocado = useMemo(
    () => (guardadoAbierto?.supuestos ? codificar(diferido) !== codificar(conArranque(guardadoAbierto.supuestos, base)) : false),
    [guardadoAbierto, diferido, base],
  )
  const activo: number | 'igual' | null = abierto ? abierto.id : todoIgual ? 'igual' : null
  const tipo: QueEscenario['tipo'] = abierto ? 'guardado' : todoIgual ? 'igual' : 'cambios'
  const nombre = abierto ? (tocado ? `${abierto.nombre}, con tus cambios` : abierto.nombre) : todoIgual ? 'Todo igual' : 'Con tus supuestos'

  const abrir = useCallback(
    (e: EscenarioVista) => {
      if (!e.supuestos) return
      setAbierto({ id: e.id, nombre: e.nombre })
      cambiar(conArranque(e.supuestos, base), { discreto: true })
    },
    [base, cambiar],
  )
  // Estable: elegir en la pastilla no depende de la barra (lee los últimos supuestos al tocar).
  const elegir = useCallback(
    (id: number | 'igual') => {
      if (id === 'igual') {
        setAbierto(null)
        cambiar(todoIgualDe(ultimos.current), { discreto: true })
        return
      }
      const e = activos.find((x) => x.id === id)
      if (e) abrir(e)
    },
    [abrir, activos, cambiar],
  )
  const obtenerSupuestos = useCallback(() => ultimos.current, [])
  const alGuardar = useCallback((id: number, n: string) => setAbierto({ id, nombre: n }), [])

  const ultimo = proy.estado === 'lista' ? proy.meses[proy.meses.length - 1] : null
  const nombreAbierto = abierto?.nombre ?? null
  const lectura = useMemo(
    () =>
      lecturaFlujo({
        mes: mes ? { excedente: mes.excedente.ars, nombre: mes.nombre } : null,
        proy,
        escenario: tipo === 'guardado' && nombreAbierto !== null ? { tipo, nombre: nombreAbierto, cambios: tocado } : tipo === 'igual' ? { tipo } : { tipo: 'cambios' },
        trazaFinal: ultimo ? () => trazaMes(base, diferido, ultimo.mes, 'financiero', 'USD') : undefined,
      }),
    [mes, proy, tipo, nombreAbierto, tocado, ultimo, base, diferido],
  )

  return (
    <>
      <EncabezadoFlujo pregunta={PREGUNTA_FLUJO} lectura={lectura} />
      {arriba}
      {urlInvalida ? <p className="rounded-item border border-border bg-surface-2 p-3 text-[13px] text-muted">El escenario de la dirección no se pudo leer (otra versión o fuera de rango): arrancás con todo en Igual.</p> : null}

      {/* La cascada del mes y el patrimonio en dólares (handoff: 1fr y 1,5fr, del mismo alto, desde 1280 px). */}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <CascadaMes mes={mes} />
        <PatrimonioUsd base={base} s={diferido} proy={proy} referencia={referencia} nombre={nombre} opciones={opciones} activo={activo} cambios={activo === null || tocado} onElegir={elegir} />
      </div>

      <Tarjeta className="min-w-0 p-5" aria-labelledby="titulo-supuestos" data-supuestos>
        <div id="supuestos" className="scroll-mt-24">
          <Franja base={base} s={diferido} proy={proy} />
          <Rotulo id="titulo-supuestos" className="mb-3">
            Tus supuestos · una barra por variable
          </Rotulo>
          <PanelSupuestos
            base={base}
            supuestos={s}
            onCambio={cambiar}
            recordados={recordados}
            faltan={faltan}
            parciales={parciales}
            reintegroDeclarado={reintegroDeclarado}
            pagadorDeclarado={pagadorDeclarado}
          />
        </div>
      </Tarjeta>

      <h2 className="eyebrow mt-2">El detalle</h2>
      <Resultado base={base} s={abajo.s} proy={abajo.proy} nombre={nombreAbierto} referencia={abajo.referencia} />
      <Guardados base={base} obtenerSupuestos={obtenerSupuestos} abierto={abierto} escenarios={escenarios} onAbrir={abrir} onGuardado={alGuardar} />
      {detalle}
    </>
  )
}
