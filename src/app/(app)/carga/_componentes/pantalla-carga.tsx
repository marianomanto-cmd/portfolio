'use client'

// Cargar (4.2 de la visión): una sola pantalla, sin wizard. Dos campos (CCL y
// cripto), una zona para soltar o pegar todo, la bandeja y Enter. Lo que no se
// revisó queda pendiente, dicho en el botón; nada se guarda en silencio.

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Undo2 } from 'lucide-react'
import type { DecisionFila, DecisionSaldo, FilaLeida, NombreCuenta, PropuestaCarga } from '@/lib/carga/contratos'
import { fechaCorta } from '@/lib/domain/fechas'
import {
  SIN_ELECCIONES,
  eleccionFila,
  eleccionSaldo,
  huellaFila,
  huellaSaldo,
  resumirBandeja,
  textoBoton,
  type EleccionAusente,
  type EleccionFila,
  type EleccionSaldo,
  type Elecciones,
} from '../_lib/bandeja'
import type { ResumenGuardado } from '../_lib/confirmacion'
import type { ActivoLocal } from '../_lib/demo'
import { sinCruda, type EdicionFila } from '../_lib/ediciones'
import { interpretarTC } from '../_lib/entrada'
import { avisosDeFecha, claseDeArchivo, fechaDeCarga, fuentesActivas, type RespuestaLectura } from '../_lib/fuentes'
import type { ContextoCarga } from '../_lib/servidor'
import { registrarGesto, relojNuevo, textoDuracion } from '../_lib/tiempo'
import { deshacer, ejemploSinBase, guardar, proponer } from '../acciones'
import { BarraGuardar } from './barra-guardar'
import { Bandeja } from './bandeja'
import { CamposTC } from './campos-tc'
import type { FuenteCarga } from './tipos'
import { Aviso, Boton, CLASE_CAMPO } from './ui'
import { ZonaFuentes, nombreCorto } from './zona-fuentes'

const CLAVE_REFERENCIA = 'portfolio:carga:referencia-ccl'

function nuevoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

function leerLocal(clave: string): string {
  try {
    return window.localStorage.getItem(clave) ?? ''
  } catch {
    return ''
  }
}

function escribirLocal(clave: string, valor: string) {
  try {
    window.localStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento (ventana privada): no pasa nada, es una comodidad.
  }
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

const esCampo = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(t.tagName))

interface Guardado {
  lote: string
  modo: ContextoCarga['modo']
  resumen: ResumenGuardado
  activoMs: number
  repetido: boolean
  deshaciendo: boolean
  error: string | null
}

export function PantallaCarga({ contexto }: { contexto: ContextoCarga }) {
  const [lote, setLote] = useState(nuevoId)
  const [textoCcl, setTextoCcl] = useState('')
  const [textoCripto, setTextoCripto] = useState('')
  const [referencia, setReferencia] = useState('')
  const [nota, setNota] = useState('')
  const [verNota, setVerNota] = useState(false)
  const [fechaManual, setFechaManual] = useState<string | null>(null)
  const [cambiandoFecha, setCambiandoFecha] = useState(false)
  const [fuentes, setFuentes] = useState<FuenteCarga[]>([])
  const [elegidas, setElegidas] = useState<Partial<Record<NombreCuenta, string>>>({})
  const [ediciones, setEdiciones] = useState<Record<string, EdicionFila>>({})
  const [elecciones, setElecciones] = useState<Elecciones>(SIN_ELECCIONES)
  const [activosLocales, setActivosLocales] = useState<ActivoLocal[]>([])
  const [propuesta, setPropuesta] = useState<PropuestaCarga | null>(null)
  const [proponiendo, setProponiendo] = useState(false)
  const [errorPropuesta, setErrorPropuesta] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [erroresGuardar, setErroresGuardar] = useState<string[]>([])
  const [guardado, setGuardado] = useState<Guardado | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [activoMs, setActivoMs] = useState(0)
  const reloj = useRef(relojNuevo())
  const refCcl = useRef<HTMLInputElement>(null)
  const contador = useRef(0)

  const sinBase = contexto.modo !== 'real'
  const guardadoRef = useRef<Guardado | null>(null)
  guardadoRef.current = guardado

  /** Una carga nueva: lote nuevo y todo vacío (después de guardar, el lote no se reusa). */
  const reiniciar = useCallback(() => {
    setGuardado(null)
    setLote(nuevoId())
    setTextoCcl('')
    setTextoCripto('')
    setNota('')
    setVerNota(false)
    setFechaManual(null)
    setFuentes([])
    setElegidas({})
    setEdiciones({})
    setElecciones(SIN_ELECCIONES)
    setPropuesta(null)
    setErroresGuardar([])
    reloj.current = relojNuevo()
    setActivoMs(0)
  }, [])

  // Referencia del CCL: viene con la última que usaste en este dispositivo (EX-8).
  useEffect(() => {
    setReferencia(leerLocal(CLAVE_REFERENCIA))
  }, [])

  // ───────────── Tiempo activo (D-62) ─────────────
  // El gesto se anota en el acto, pero el contador se redibuja en el próximo
  // cuadro: un render en medio de un evento de teclado le pisaría el valor a un
  // campo controlado antes de que React vea el cambio.
  const cuadro = useRef<number | null>(null)
  const gesto = useCallback(() => {
    reloj.current = registrarGesto(reloj.current, Date.now())
    if (cuadro.current !== null) return
    cuadro.current = requestAnimationFrame(() => {
      cuadro.current = null
      setActivoMs(reloj.current.activoMs)
    })
  }, [])
  useEffect(() => {
    const opciones = { passive: true } as const
    const eventos = ['keydown', 'input', 'pointerdown', 'paste', 'drop', 'wheel', 'touchmove'] as const
    for (const ev of eventos) window.addEventListener(ev, gesto, opciones)
    return () => {
      for (const ev of eventos) window.removeEventListener(ev, gesto)
    }
  }, [gesto])

  // ───────────── Fuentes: leer cada archivo ─────────────
  const actualizarFuente = useCallback((id: string, cambio: Partial<FuenteCarga>) => {
    setFuentes((fs) => fs.map((f) => (f.id === id ? { ...f, ...cambio } : f)))
  }, [])

  const leer = useCallback(
    async (id: string, archivo: File) => {
      const fd = new FormData()
      fd.append('archivo', archivo, archivo.name || 'captura.png')
      try {
        const res = await fetch('/carga/leer', { method: 'POST', body: fd })
        const json = (await res.json().catch(() => null)) as RespuestaLectura | { error?: string } | null
        if (json && 'ok' in json && json.ok) {
          actualizarFuente(id, { estado: 'leida', cuenta: json.lectura.cuenta, respuesta: json, error: null })
          return
        }
        const motivo =
          (json && 'error' in json && json.error) || (res.status === 401 ? 'Sesión vencida: volvé a entrar.' : `el servidor respondió ${res.status}.`)
        actualizarFuente(id, { estado: 'error', error: motivo })
      } catch (e) {
        actualizarFuente(id, {
          estado: 'error',
          error: `No pude leer «${archivo.name || 'la captura'}»: ${e instanceof Error ? e.message : 'se cortó la conexión'}.`,
        })
      }
    },
    [actualizarFuente],
  )

  const agregarArchivos = useCallback(
    (archivos: File[]) => {
      // Un archivo nuevo después de guardar arranca la carga siguiente.
      if (guardadoRef.current) reiniciar()
      setErroresGuardar([])
      const nuevas: FuenteCarga[] = archivos.map((archivo, i) => {
        const clase = claseDeArchivo(archivo.name, archivo.type)
        return {
          id: nuevoId(),
          nombre: archivo.name || 'captura pegada',
          clase: clase ?? 'imagen',
          archivo,
          agregada: Date.now() + i,
          estado: clase ? 'leyendo' : 'error',
          cuenta: null,
          respuesta: null,
          error: clase ? null : `No sé leer «${archivo.name}»: solo el Excel de IEB (.xlsx) o capturas.`,
        }
      })
      setFuentes((fs) => [...fs, ...nuevas])
      for (const f of nuevas) if (f.estado === 'leyendo' && f.archivo) void leer(f.id, f.archivo)
    },
    [leer, reiniciar],
  )

  // Ctrl+V en cualquier lugar de la pantalla; soltar archivos en cualquier lugar.
  useEffect(() => {
    const pegar = (e: ClipboardEvent) => {
      const archivos = Array.from(e.clipboardData?.files ?? [])
      if (!archivos.length) return
      e.preventDefault()
      agregarArchivos(archivos)
    }
    const conArchivos = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'))
    const sobre = (e: DragEvent) => {
      if (!conArchivos(e)) return
      e.preventDefault()
      setArrastrando(true)
    }
    const sale = (e: DragEvent) => {
      if (e.relatedTarget === null) setArrastrando(false)
    }
    const suelta = (e: DragEvent) => {
      if (!conArchivos(e)) return
      e.preventDefault()
      setArrastrando(false)
      agregarArchivos(Array.from(e.dataTransfer?.files ?? []))
    }
    window.addEventListener('paste', pegar)
    window.addEventListener('dragover', sobre)
    window.addEventListener('dragleave', sale)
    window.addEventListener('drop', suelta)
    return () => {
      window.removeEventListener('paste', pegar)
      window.removeEventListener('dragover', sobre)
      window.removeEventListener('dragleave', sale)
      window.removeEventListener('drop', suelta)
    }
  }, [agregarArchivos])

  // ───────────── Derivados ─────────────
  const ccl = interpretarTC(textoCcl)
  const cripto = interpretarTC(textoCripto)
  const tiposDeCambio = (ccl.valor ? 1 : 0) + (cripto.valor ? 1 : 0)

  const { activas, repetidas } = useMemo(
    () => fuentesActivas(fuentes.filter((f) => f.estado === 'leida'), elegidas),
    [fuentes, elegidas],
  )
  const fuentesListas = useMemo(() => fuentes.filter((f) => f.estado === 'leida' && activas.has(f.id) && f.respuesta), [fuentes, activas])
  const lecturas = useMemo(() => fuentesListas.map((f) => f.respuesta!.lectura), [fuentesListas])
  const fechaAuto = fechaDeCarga(lecturas, contexto.hoy)
  const fecha = fechaManual ?? fechaAuto.fecha
  // Lo que todavía se está leyendo, con nombre: el Excel siempre es de IEB.
  const leyendo = [...new Set(fuentes.filter((f) => f.estado === 'leyendo').map((f) => (f.clase === 'excel' ? 'IEB' : 'la captura')))]
  const nombreLeyendo = leyendo.length === 1 ? leyendo[0] : leyendo.length ? 'las fuentes' : ''

  // ───────────── Propuesta (bandeja), armada en el servidor ─────────────
  const claveLecturas = fuentesListas.map((f) => f.id).join(',')
  const claveLocales = activosLocales.map((a) => a.id).join(',')
  const claveEdiciones = JSON.stringify(ediciones)
  useEffect(() => {
    if (!lecturas.length) {
      contador.current++
      setPropuesta(null)
      setProponiendo(false)
      setErrorPropuesta(null)
      return
    }
    setProponiendo(true)
    const n = ++contador.current
    const t = setTimeout(async () => {
      try {
        const r = await proponer({ lecturas: lecturas.map(sinCruda), ediciones, ccl: ccl.valor, fecha, activosLocales })
        if (n !== contador.current) return
        if (r.ok) {
          setPropuesta(r.propuesta)
          setErrorPropuesta(null)
        } else {
          setErrorPropuesta(r.error)
        }
      } catch (e) {
        if (n === contador.current) setErrorPropuesta(`No pude armar la bandeja: ${e instanceof Error ? e.message : 'error de conexión'}.`)
      } finally {
        if (n === contador.current) setProponiendo(false)
      }
    }, 250)
    return () => clearTimeout(t)
    // Las claves resumen lecturas, ediciones y altas: no hace falta comparar objetos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveLecturas, claveEdiciones, claveLocales, ccl.valor, fecha])

  const resumen = resumirBandeja(lecturas.length ? propuesta : null, elecciones, tiposDeCambio)
  // Las filas tal como las leyó cada lector (sin ediciones): para elegir entre las dos lecturas.
  const originales = useMemo(() => {
    const m = new Map<string, FilaLeida>()
    for (const l of lecturas) for (const f of l.filas) m.set(f.clave, f)
    return m
  }, [lecturas])
  const dolarIEB = lecturas.find((l) => l.cuenta === 'IEB')?.tipo_cambio_fuente?.dolar_ieb ?? null
  const boton = textoBoton(resumen, { leyendo: nombreLeyendo ? [nombreLeyendo] : [], proponiendo, guardando })
  const avisos = useMemo(() => {
    const todos = [...(propuesta?.advertencias ?? []), ...avisosDeFecha(lecturas, fecha, contexto.hoy)]
    return [...new Set(todos)]
  }, [propuesta, lecturas, fecha, contexto.hoy])

  // ───────────── Elecciones ─────────────
  const elegirFila = useCallback((d: DecisionFila, e: Omit<EleccionFila, 'huella'> | null) => {
    setElecciones((x) => {
      const filas = { ...x.filas }
      if (e === null) delete filas[d.clave]
      else filas[d.clave] = { ...e, huella: huellaFila(d) }
      return { ...x, filas }
    })
  }, [])
  const elegirSaldo = useCallback((d: DecisionSaldo, e: Omit<EleccionSaldo, 'huella'> | null) => {
    setElecciones((x) => {
      const saldos = { ...x.saldos }
      if (e === null) delete saldos[d.clave]
      else saldos[d.clave] = { ...e, huella: huellaSaldo(d) }
      return { ...x, saldos }
    })
  }, [])
  const elegirAusente = useCallback((clave: string, e: EleccionAusente | null) => {
    setElecciones((x) => {
      const ausentes = { ...x.ausentes }
      if (e !== null) ausentes[clave] = e
      else delete ausentes[clave]
      return { ...x, ausentes }
    })
  }, [])
  const editarFila = useCallback((clave: string, e: EdicionFila | null) => {
    setEdiciones((x) => {
      const y = { ...x }
      if (e === null || (e.cantidad === null && e.precio_unitario === null && (e.valorizado ?? null) === null)) delete y[clave]
      else y[clave] = e
      return y
    })
  }, [])

  // Elegir la lectura propuesta después de haber elegido la otra: se saca la
  // edición y, cuando la fila vuelve tal como se leyó, se acepta.
  const aceptarAlVolver = useRef(new Map<string, string>())
  useEffect(() => {
    if (!propuesta || aceptarAlVolver.current.size === 0) return
    for (const [clave, motivo] of aceptarAlVolver.current) {
      const d = propuesta.filas.find((f) => f.clave === clave)
      if (!d) {
        aceptarAlVolver.current.delete(clave)
        continue
      }
      const sinEditar = !ediciones[clave] && !d.motivos.some((m) => m.startsWith('Editada a mano'))
      if (!sinEditar) continue
      if (d.estado === 'advertencia') elegirFila(d, { resolucion: 'aceptada', motivo, operacion: null })
      aceptarAlVolver.current.delete(clave)
    }
  }, [propuesta, ediciones, elegirFila])

  // ───────────── Guardar ─────────────
  const enfocarProblema = () => {
    const primero = document.querySelector<HTMLElement>('[data-item-bandeja]')
    if (primero) primero.focus()
    else refCcl.current?.focus()
  }

  async function guardarAhora(sinLasQueLeen = false) {
    if (guardando || guardado) return
    const listo = boton.habilitado || (sinLasQueLeen && !proponiendo && resumen.errores === 0 && resumen.verificadas > 0)
    if (!listo) {
      if (resumen.errores > 0) enfocarProblema()
      return
    }
    setGuardando(true)
    setErroresGuardar([])
    try {
      const r = await guardar({
        lote,
        fecha,
        ccl: ccl.valor,
        cripto: cripto.valor,
        // La referencia se guarda con el tipo de cambio (y se recuerda en este dispositivo).
        referencia: ccl.valor && referencia.trim() ? referencia.trim().slice(0, 200) : null,
        nota: nota.trim() ? nota.trim() : null,
        tiempo_activo_ms: reloj.current.activoMs,
        fuentes: fuentesListas.map((f) => ({ lectura: f.respuesta!.lectura, archivo: f.respuesta!.archivo, firma: f.respuesta!.firma })),
        ediciones,
        elecciones,
        activosLocales,
      })
      if (r.ok) {
        if (referencia.trim()) escribirLocal(CLAVE_REFERENCIA, referencia.trim())
        setGuardado({
          lote,
          modo: r.modo,
          resumen: r.resumen,
          activoMs: reloj.current.activoMs,
          repetido: r.resultado?.repetido ?? false,
          deshaciendo: false,
          error: null,
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setErroresGuardar(r.errores)
      }
    } catch (e) {
      setErroresGuardar([`No pude guardar: ${e instanceof Error ? e.message : 'error de conexión'}. Probá de nuevo: el mismo Enter no duplica nada.`])
    } finally {
      setGuardando(false)
    }
  }

  async function deshacerAhora() {
    if (!guardado) return
    setGuardado({ ...guardado, deshaciendo: true, error: null })
    try {
      const r = await deshacer(guardado.lote)
      if (r.ok) {
        // Todo vuelve a la pantalla, editable, con un lote nuevo.
        setGuardado(null)
        setLote(nuevoId())
      } else {
        setGuardado({ ...guardado, deshaciendo: false, error: r.error })
      }
    } catch (e) {
      setGuardado({ ...guardado, deshaciendo: false, error: `No pude deshacer: ${e instanceof Error ? e.message : 'error de conexión'}.` })
    }
  }

  function nuevaCarga() {
    reiniciar()
    setTimeout(() => refCcl.current?.focus(), 0)
  }

  async function cargarEjemplo() {
    const r = await ejemploSinBase(contexto.hoy)
    if (!r.ok) return setErroresGuardar([r.error])
    setActivosLocales((xs) => [...xs.filter((a) => !r.catalogo.some((c) => c.ticker === a.ticker)), ...r.catalogo])
    setFuentes((fs) => [
      ...fs,
      ...r.fuentes.map((f, i) => ({
        id: nuevoId(),
        nombre: `${f.lectura.cuenta} (ejemplo)`,
        clase: f.lectura.origen === 'excel' ? ('excel' as const) : ('imagen' as const),
        archivo: null,
        agregada: Date.now() + i,
        estado: 'leida' as const,
        cuenta: f.lectura.cuenta,
        respuesta: { ok: true as const, lectura: f.lectura, archivo: f.archivo, firma: f.firma, ms: 0 },
        error: null,
      })),
    ])
  }

  // Enter guarda desde cualquier lugar que no sea un campo o un botón.
  useEffect(() => {
    const enter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (esCampo(e.target)) return
      if (e.target instanceof HTMLElement && e.target.closest('[role="dialog"]')) return
      e.preventDefault()
      void guardarAhoraRef.current()
    }
    window.addEventListener('keydown', enter)
    return () => window.removeEventListener('keydown', enter)
  }, [])
  const guardarAhoraRef = useRef(() => guardarAhora())
  guardarAhoraRef.current = () => guardarAhora()

  // ───────────── Después del Enter ─────────────
  if (guardado) {
    const r = guardado.resumen
    const cuentas = r.cuentas.map((c) => nombreCorto(c.cuenta)).join(', ')
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-border bg-surface p-4 md:p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <CheckCircle2 aria-hidden className="mt-0.5 size-6 shrink-0 text-accent" />
            <div className="min-w-0 space-y-1">
              {guardado.modo === 'real' ? (
                <h2 className="text-lg font-semibold text-text">
                  {guardado.repetido ? 'Ya estaba guardado' : 'Guardado'} · {textoDuracion(guardado.activoMs)} activos
                </h2>
              ) : (
                <h2 className="text-lg font-semibold text-text">
                  {guardado.modo === 'demo' ? 'Modo demo: no se guarda nada' : 'Sin base configurada: no se guardó nada'}
                </h2>
              )}
              <p className="text-sm text-muted">
                {guardado.modo === 'real' ? '' : 'Se habría guardado: '}
                {plural(r.total, 'dato', 'datos')} del {fechaCorta(fecha)}
                {r.tipo_cambio.ccl || r.tipo_cambio.cripto
                  ? ` · ${[r.tipo_cambio.ccl ? 'CCL' : null, r.tipo_cambio.cripto ? 'cripto' : null].filter(Boolean).join(' y ')}`
                  : ''}
                {cuentas ? ` · ${cuentas}` : ''}
                {r.pendientes ? ` · ${r.pendientes} ${r.pendientes === 1 ? 'pendiente' : 'pendientes'}` : ''}
              </p>
              {r.cuentas.length ? (
                <ul className="num text-sm text-muted">
                  {r.cuentas.map((c) => (
                    <li key={c.cuenta}>
                      {c.cuenta}: {plural(c.cotizaciones, 'precio', 'precios')} · {plural(c.saldos, 'saldo', 'saldos')} ·{' '}
                      {plural(c.operaciones, 'operación', 'operaciones')}
                      {c.precios_completados ? ` · ${plural(c.precios_completados, 'precio completado', 'precios completados')}` : ''}
                      {c.listado_completo ? '' : ' · listado incompleto'}
                    </li>
                  ))}
                </ul>
              ) : null}
              {r.sin_grabar?.length ? (
                <ul className="text-sm text-muted">
                  {r.sin_grabar.map((c) => (
                    <li key={c.cuenta}>
                      {c.cuenta}: no se grabó nada ({plural(c.pendientes, 'pendiente', 'pendientes')}). Lo que ya tenía del día sigue como estaba.
                    </li>
                  ))}
                </ul>
              ) : null}
              {guardado.error ? (
                <p role="alert" className="text-sm text-negative">
                  {guardado.error}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 [&>*]:max-sm:flex-1">
            <Link href="/" className="tocable inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong lg:min-h-9">
              Ver Hoy
            </Link>
            {guardado.modo === 'real' ? (
              <Boton variante="secundario" onClick={deshacerAhora} disabled={guardado.deshaciendo}>
                <Undo2 aria-hidden className="size-4" />
                {guardado.deshaciendo ? 'Deshaciendo…' : 'Deshacer'}
              </Boton>
            ) : (
              <Boton variante="secundario" onClick={() => setGuardado(null)}>
                Volver a la bandeja
              </Boton>
            )}
            <Boton variante="fantasma" onClick={nuevaCarga}>
              Nueva carga
            </Boton>
          </div>
        </section>
      </div>
    )
  }

  // ───────────── La pantalla ─────────────
  const tiempo = activoMs ? `carga en curso: ${textoDuracion(activoMs)} activos` : 'el tiempo activo arranca con tu primer gesto'
  return (
    <div className="space-y-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <h1 className="text-base font-semibold text-text md:text-lg">Datos del {fechaCorta(fecha)}</h1>
        <span className="text-sm text-muted">
          ({fechaManual ? 'elegida por vos' : fechaAuto.origen === 'hoy' ? 'hoy' : `fecha ${fechaAuto.origen}`})
        </span>
        {cambiandoFecha ? (
          <input
            type="date"
            aria-label="Fecha de los datos"
            className={`${CLASE_CAMPO} w-auto`}
            value={fecha}
            max={contexto.hoy}
            onChange={(e) => setFechaManual(e.target.value || null)}
            onBlur={() => setCambiandoFecha(false)}
            autoFocus
          />
        ) : (
          <Boton variante="fantasma" onClick={() => setCambiandoFecha(true)}>
            Cambiar fecha
          </Boton>
        )}
        {fechaManual ? (
          <Boton variante="fantasma" onClick={() => setFechaManual(null)}>
            Usar la de la fuente
          </Boton>
        ) : null}
      </div>

      {contexto.modo === 'demo' ? <Aviso>Modo demo: podés leer archivos y revisar la bandeja, pero no se guarda nada.</Aviso> : null}
      {contexto.modo === 'sin_base' ? (
        <Aviso tono="aviso">Falta configurar la base (SUPABASE_SECRET_KEY): podés leer y revisar, pero no se guarda nada.</Aviso>
      ) : null}
      {contexto.aviso ? <Aviso tono="error">{contexto.aviso}</Aviso> : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)] lg:items-start">
        <form
          className="min-w-0 space-y-3 rounded-2xl border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault()
            void guardarAhora()
          }}
          onKeyDown={(e) => {
            // Enter en un campo guarda. En el CCL con el cripto vacío, pasa al
            // cripto: así el "siguiente" del teclado del teléfono no guarda a medias.
            if (e.key !== 'Enter' || e.nativeEvent.isComposing || !(e.target instanceof HTMLInputElement)) return
            e.preventDefault()
            if (e.target.id === 'tc-ccl' && !textoCripto.trim()) {
              document.getElementById('tc-cripto')?.focus()
              return
            }
            void guardarAhora()
          }}
        >
          <CamposTC
            ref={refCcl}
            fecha={fecha}
            ccl={ccl}
            cripto={cripto}
            referencia={referencia}
            ultimo={contexto.ultimo}
            onCcl={setTextoCcl}
            onCripto={setTextoCripto}
            onReferencia={setReferencia}
          />
          {verNota ? (
            <div className="space-y-1">
              <label htmlFor="nota-dia" className="block text-sm font-medium text-text">
                Nota del día
              </label>
              <input
                id="nota-dia"
                className={CLASE_CAMPO}
                value={nota}
                maxLength={500}
                onChange={(e) => setNota(e.target.value)}
                placeholder="el CCL saltó por la licitación"
                enterKeyHint="done"
              />
            </div>
          ) : (
            <Boton variante="fantasma" onClick={() => setVerNota(true)} className="w-full justify-start">
              + Nota del día
            </Boton>
          )}
        </form>

        <div className="min-w-0 space-y-4">
          <ZonaFuentes
            fuentes={fuentes}
            activas={activas}
            repetidas={repetidas}
            arrastrando={arrastrando}
            onArchivos={agregarArchivos}
            onReintentar={(id) => {
              const f = fuentes.find((x) => x.id === id)
              if (!f?.archivo) return
              actualizarFuente(id, { estado: 'leyendo', error: null })
              void leer(id, f.archivo)
            }}
            onQuitar={(id) => setFuentes((fs) => fs.filter((f) => f.id !== id))}
            onUsar={(id) => {
              const f = fuentes.find((x) => x.id === id)
              if (f?.cuenta) setElegidas((e) => ({ ...e, [f.cuenta!]: id }))
            }}
            onEjemplo={sinBase ? cargarEjemplo : undefined}
          />

          {lecturas.length || tiposDeCambio ? (
            <Bandeja
              resumen={resumen}
              propuesta={lecturas.length ? propuesta : null}
              eleccionDe={{
                fila: (d) => eleccionFila(elecciones, d),
                saldo: (d) => eleccionSaldo(elecciones, d),
                ausente: (clave) => elecciones.ausentes[clave] ?? null,
              }}
              edicionDe={(clave) => ediciones[clave] ?? null}
              avisos={avisos}
              fecha={fecha}
              proponiendo={proponiendo}
              error={errorPropuesta}
              onFila={elegirFila}
              onSaldo={elegirSaldo}
              onAusente={elegirAusente}
              onEditar={editarFila}
              onAlta={(a) => setActivosLocales((xs) => [...xs.filter((x) => x.ticker !== a.ticker), a])}
              onIrAlCcl={() => refCcl.current?.focus()}
              tiposTipeados={[ccl.valor ? 'CCL' : null, cripto.valor ? 'cripto' : null].filter((x): x is string => x !== null)}
              originalDe={(clave) => originales.get(clave) ?? null}
              onAceptarAlVolver={(clave, motivo) => aceptarAlVolver.current.set(clave, motivo)}
              dolarIEB={dolarIEB}
              ccl={ccl.valor}
            />
          ) : (
            <p className="text-sm text-muted">
              Una carga express (solo CCL y cripto) también vale: el resto queda con su último valor, marcado como viejo cuando pase los 2 días hábiles.
            </p>
          )}

          {erroresGuardar.length ? (
            <div role="alert" className="space-y-1 rounded-xl border border-negative/30 bg-negative-soft px-3 py-2 text-sm text-negative">
              {erroresGuardar.map((e) => (
                <p key={e}>{e}</p>
              ))}
              {/* Si no sabés si se guardó (se cortó la conexión) o el lote ya se usó: mirá el Registro o empezá de nuevo. */}
              <div className="flex flex-wrap gap-2 pt-1 [&>*]:max-sm:flex-1">
                <Link
                  href="/registro"
                  className="tocable inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text lg:min-h-9"
                >
                  Ver Registro
                </Link>
                <Boton variante="fantasma" onClick={nuevaCarga}>
                  Nueva carga
                </Boton>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Lugar para la barra de Guardar, que es fija. */}
      <div aria-hidden className="h-28 md:h-16" />
      <BarraGuardar
        texto={boton.texto}
        habilitado={boton.habilitado}
        motivo={boton.motivo}
        estado={tiempo}
        secundario={
          leyendo.length && !proponiendo && resumen.verificadas > 0 && resumen.errores === 0
            ? { texto: `Guardar sin ${nombreLeyendo}`, onClick: () => void guardarAhora(true) }
            : null
        }
        onGuardar={() => void guardarAhora()}
      />
    </div>
  )
}
