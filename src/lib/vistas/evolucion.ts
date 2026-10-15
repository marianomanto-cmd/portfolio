import 'server-only'

// Evolución y PnL: lee los hechos de Supabase y arma la vista con la función
// pura de ./armar-evolucion. En modo demo, los datos inventados de
// ./ejemplo-evolucion (con ?demo=vacio|un-dia|semana|mes).
//
// Lo que traen Pasivos y Flujo entra por `entradas` (leerEntradas, abajo).

import type { AperturaCuota, Cuota } from '@/lib/domain/pasivos/tipos'
import { aperturasCuotas, pagadorDe } from '@/lib/domain/pasivos/cuadro'
import { tirContrato } from '@/lib/domain/pasivos/tir'
import { mesesSinCuota } from '@/lib/domain/flujo/cuotas'
import { proyectar } from '@/lib/domain/flujo/proyeccion'
import { codificar, decodificar, esquemaSupuestos, rebasar } from '@/lib/domain/flujo/supuestos'
import type { FlujoReal, ProyeccionVista } from '@/lib/domain/flujo/tipos'
import { hoyCordoba } from '@/lib/domain/fechas'
import type { Fecha, Hechos } from '@/lib/domain/tipos'
import { leerFlujo } from '@/lib/server/hechos-flujo'
import { leerPasivos } from '@/lib/server/hechos-pasivos'
import { modoDemo } from '@/lib/server/sesion'
import { armarBase } from './armar-flujo'
import { armarEvolucion, type EntradasEvolucion } from './armar-evolucion'
import { cclDeHoy } from './armar-pasivos'
import type { ParametrosEvolucion, VistaEvolucion } from './contratos-evolucion'
import { ejemploEvolucion, type DemoEvolucion } from './ejemplo-evolucion'
import { leerHechosVista } from './hechos-vista'

/**
 * Lo que traen Pasivos y Flujo (plan §10, punto 4):
 * - las cuotas que pagás vos, para el puente, y su apertura (aperturasCuotas,
 *   a la tasa del contrato y al CCL de hoy) para el estado de resultados;
 * - lo cargado con "Cargar ingreso" y "Cargar gasto" (sin las cargas
 *   revertidas; las anuladas las saca el motor) y lo declarado;
 * - la proyección del escenario guardado que elegiste (?e=), la del que estás
 *   probando (?s= de Flujo) o, si no hay ninguno, la del último guardado.
 */
async function leerEntradas(h: Hechos, hoy: Fecha, p: ParametrosEvolucion): Promise<EntradasEvolucion> {
  const [hp, flu] = await Promise.all([leerPasivos(), leerFlujo()])
  const cuotas: Cuota[] = []
  const leasing: AperturaCuota[] = []
  const ccl = cclDeHoy(h, hoy)
  let conCuadro = false
  const sinCuota: { motivo: string; meses: Fecha[] }[] = []
  for (const contrato of hp.contratos) {
    const propias = hp.cuotas.filter((c) => c.pasivo_id === contrato.id)
    if (propias.length) conCuadro = true
    // Un cuadro incompleto (una planilla corta, un Deshacer): el mes sin su cuota es "sin dato", como en Flujo y en Hoy.
    const meses = (contrato.pagador_habitual ?? 'titular') === 'titular' ? mesesSinCuota(contrato, propias.map((c) => c.fecha_vencimiento)) : []
    if (meses.length)
      sinCuota.push({
        motivo: `El cuadro de marcha de «${contrato.nombre}» tiene ${propias.length} de ${contrato.cuotas_totales} cuotas y no la de un mes del período: importá la planilla completa en Datos › Leasing (no se cuenta como $ 0).`,
        meses,
      })
    // Sin decir quién paga, la pagás vos (lo que dijiste el 14/10, D-155), como en Flujo y en Hoy.
    const delTitular = propias.filter((c) => (pagadorDe(c, contrato) ?? 'titular') === 'titular')
    if (!delTitular.length) continue
    cuotas.push(...delTitular)
    const tea = tirContrato(contrato, propias)
    const nros = new Set(delTitular.map((c) => c.nro))
    const aperturas = aperturasCuotas(contrato, propias, hp.cargos.filter((x) => x.pasivo_id === contrato.id), tea, ccl)
    leasing.push(...aperturas.filter((a) => nros.has(a.nro)))
  }
  const flujos: FlujoReal[] = flu.flujos
    .filter((f) => !f.revertida)
    .map((f) => ({
      id: f.id,
      fecha: f.fecha,
      sentido: f.sentido,
      concepto: f.concepto,
      moneda: f.moneda,
      monto: f.monto,
      cuenta_id: f.cuenta_id,
      cripto_usado: f.cripto_usado,
      pesos_recibidos: f.pesos_recibidos,
      anulado: f.anulado,
      carga_id: f.carga_id,
      notas: f.notas,
    }))
  const escenarios = flu.escenarios.filter((e) => !e.archivado).sort((a, b) => (a.actualizado_en < b.actualizado_en ? -1 : 1))
  let futuro: ProyeccionVista | null = null
  const deLaUrl = decodificar(p.s)
  const guardado = escenarios.find((e) => e.id === p.e) ?? (deLaUrl ? undefined : escenarios.at(-1))
  const delGuardado = guardado
    ? (() => {
        const r = esquemaSupuestos.safeParse(guardado.supuestos)
        return r.success ? { id: guardado.id, nombre: guardado.nombre, supuestos: r.data } : null
      })()
    : null
  const elegido = delGuardado ?? (deLaUrl ? { id: null, nombre: 'El escenario que estás probando', supuestos: deLaUrl } : null)
  if (elegido) {
    const base = armarBase(h, flu, hoy)
    // Los meses del escenario, contados desde la carga de hoy (uno guardado otro mes se corre).
    if (base) futuro = { escenario: { id: elegido.id, nombre: elegido.nombre }, proyeccion: proyectar(base, rebasar(elegido.supuestos, base.fecha)) }
  }
  const leasingContrato = hp.contratos.find((c) => c.tipo === 'leasing') ?? null
  return {
    cuotas,
    leasing,
    flujos,
    recurrentes: flu.recurrentes,
    reintegra_iva: leasingContrato?.reintegra_iva ?? null,
    // Con el cuadro importado y ninguna cuota tuya: las paga la empresa.
    leasing_vacio: leasing.length || !conCuadro ? null : 'empresa',
    sin_cuota: sinCuota,
    futuro,
    // "Ajustar supuestos" abre en Flujo el escenario que se muestra, también uno guardado.
    futuro_s: elegido ? codificar(elegido.supuestos) : null,
    escenarios: escenarios.map((e) => ({ id: e.id, nombre: e.nombre })).reverse(),
    hay_escenarios: escenarios.length > 0,
  }
}

export async function vistaEvolucion(p: ParametrosEvolucion, demo: DemoEvolucion | null): Promise<VistaEvolucion> {
  if (modoDemo()) return ejemploEvolucion(p, demo)
  const hoy = hoyCordoba()
  const h = await leerHechosVista()
  return armarEvolucion(h, hoy, p, await leerEntradas(h, hoy, p))
}
