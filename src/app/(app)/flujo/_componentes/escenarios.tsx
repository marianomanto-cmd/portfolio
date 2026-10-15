'use client'

// Escenarios (plan §6 D.1 bloque 3; D-144 a D-148, D-155): el panel de
// supuestos y la proyección, que corre acá, en el navegador, como función pura
// sobre la base serializada (proyectar). Mientras se tantea, los supuestos
// viven en la URL (?s=): recargar no pierde nada y Atrás recorre lo probado.
// Nada proyectado se guarda: un escenario guarda sus supuestos.

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { codificar, decodificar, rebasar } from '@/lib/domain/flujo/supuestos'
import { proyectar } from '@/lib/domain/flujo/proyeccion'
import type { BaseProyeccion, Supuestos } from '@/lib/domain/flujo/tipos'
import type { EscenarioVista } from '@/lib/vistas/contratos-flujo'
import { PanelSupuestos } from '@/components/escenarios/panel-supuestos'
import { Guardados } from './guardados'
import { Franja, Resultado } from './resultado'

export interface PropsEscenarios {
  base: BaseProyeccion
  inicial: Supuestos
  /** ?s= de la URL, tal como llegó (se valida acá). */
  sUrl: string | null
  escenarios: EscenarioVista[]
  recordados: Record<string, string>
  reintegroDeclarado: boolean | null
  pagadorDeclarado: 'titular' | 'empresa' | null
  /** Lo que va arriba de la proyección en la columna ancha (el mes en curso, el calendario). */
  arriba?: ReactNode
  /** El escenario guardado que se abre al llegar (?e= de "Ajustar supuestos" en Evolución): guardar los cambios lo actualiza. */
  abiertoInicial?: { id: number; nombre: string } | null
}

function urlCon(s: Supuestos): string {
  const u = new URL(window.location.href)
  u.searchParams.set('s', codificar(s))
  return `${u.pathname}${u.search}${u.hash}`
}

export function Escenarios({ base, inicial, sUrl, escenarios, recordados, reintegroDeclarado, pagadorDeclarado, arriba, abiertoInicial = null }: PropsEscenarios) {
  // Un ?s= de otro mes se corre a la carga de hoy (rebasar): sus meses siguen en el mismo mes del calendario.
  const leer = useCallback((t: string | null) => {
    const d = decodificar(t)
    return d ? rebasar(d, base.fecha) : null
  }, [base.fecha])
  const [s, setS] = useState<Supuestos>(() => leer(sUrl) ?? inicial)
  const [abierto, setAbierto] = useState<{ id: number; nombre: string } | null>(abiertoInicial)
  const urlInvalida = useMemo(() => sUrl !== null && decodificar(sUrl) === null, [sUrl])
  const pendiente = useRef<number | null>(null)

  // Atrás y Adelante recorren lo probado.
  useEffect(() => {
    const alVolver = () => {
      const d = leer(new URL(window.location.href).searchParams.get('s'))
      setS(d ?? inicial)
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [inicial, leer])

  const cambiar = useCallback((n: Supuestos, opciones?: { discreto?: boolean }) => {
    setS(n)
    if (pendiente.current !== null) window.clearTimeout(pendiente.current)
    if (opciones?.discreto) {
      window.history.pushState(null, '', urlCon(n))
      return
    }
    // El deslizante: una sola entrada de historial, escrita al soltar.
    pendiente.current = window.setTimeout(() => {
      window.history.replaceState(null, '', urlCon(n))
      pendiente.current = null
    }, 200)
  }, [])

  // La proyección sigue al deslizante sin trabarlo (< 200 ms, calidad.md §3).
  const diferido = useDeferredValue(s)
  const proy = useMemo(() => proyectar(base, diferido), [base, diferido])

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
        {arriba}
        <Resultado base={base} s={diferido} proy={proy} nombre={abierto?.nombre ?? null} />
        <Guardados
          base={base}
          s={s}
          abierto={abierto}
          escenarios={escenarios}
          onAbrir={(e) => {
            if (!e.supuestos) return
            setAbierto({ id: e.id, nombre: e.nombre })
            cambiar(e.supuestos, { discreto: true })
          }}
          onGuardado={(id, nombre) => setAbierto({ id, nombre })}
        />
      </div>
      <aside
        aria-labelledby="titulo-supuestos"
        id="supuestos"
        className="min-w-0 scroll-mt-4 rounded-xl border border-border bg-surface-2 p-3 lg:sticky lg:top-4 lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:max-h-[calc(100svh-2rem)] lg:overflow-y-auto"
      >
        <Franja base={base} s={diferido} proy={proy} />
        <h2 id="titulo-supuestos" className="text-base font-semibold text-text">
          Tus supuestos
        </h2>
        <p className="mb-3 mt-0.5 text-xs text-muted">Baja · Igual · Sube, variable por variable. Nada arranca elegido salvo tu regla del 14/10.</p>
        {urlInvalida ? <p className="mb-3 rounded-lg border border-border bg-surface p-2 text-xs text-muted">El escenario de la dirección no se pudo leer (otra versión o fuera de rango): arrancás de cero.</p> : null}
        <PanelSupuestos
          base={base}
          supuestos={s}
          onCambio={cambiar}
          recordados={recordados}
          faltan={proy.faltan}
          parciales={proy.faltan_parciales}
          reintegroDeclarado={reintegroDeclarado}
          pagadorDeclarado={pagadorDeclarado}
        />
      </aside>
    </div>
  )
}
