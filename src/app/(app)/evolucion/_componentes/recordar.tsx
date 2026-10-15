'use client'

// El período se recuerda en el dispositivo (visión HO-7), nunca en la base:
// con una elección en la dirección, se guarda; sin ninguna (entrás desde el
// menú o desde Hoy), vuelve la última. Todo con try/catch: sin almacenamiento
// (modo incógnito, bloqueado), la página anda igual con lo de la dirección.

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { ParametrosEvolucion } from '@/lib/vistas/contratos-evolucion'
import { destinoRecordado, leerRecordado, paraRecordar } from '../_lib/parametros'

const CLAVE = 'portfolio:evolucion:periodo'

export function RecordarPeriodo({ p, enLaUrl, demo }: { p: ParametrosEvolucion; enLaUrl: boolean; demo: string | null }) {
  const router = useRouter()
  const guardar = JSON.stringify(paraRecordar(p))
  useEffect(() => {
    // En el modo demo cada estado se ve tal cual: no se guarda ni se recupera nada.
    if (demo) return
    try {
      if (enLaUrl) {
        window.localStorage.setItem(CLAVE, guardar)
        return
      }
      const raw = window.localStorage.getItem(CLAVE)
      const r = raw ? leerRecordado(JSON.parse(raw)) : null
      if (!r) return
      // Lo recordado es el período; el escenario de la dirección (?s= o ?e=) se conserva.
      const destino = destinoRecordado(r, p)
      if (destino) router.replace(destino, { scroll: false })
    } catch {
      // Sin almacenamiento: manda la dirección.
    }
  }, [demo, enLaUrl, guardar, p, router])
  return null
}
