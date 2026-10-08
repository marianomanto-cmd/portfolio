// Formularios del catálogo (revisión de la fase 1a). Números inventados (D-24).

import { describe, expect, it } from 'vitest'
import { tickerDeNombre } from '@/lib/carga/captura-verificacion'
import { esquemaActivo, esquemaEdicionActivo, leerFormulario } from './esquemas'

describe('esquemaActivo: un fondo sin código se puede dar de alta con el ticker que arma el lector', () => {
  const alta = (ticker: string) =>
    leerFormulario(esquemaActivo, { ticker, nombre: 'Fondo de prueba', tipo: 'fci', moneda_riesgo: 'ARS', geografia: 'AR' })

  it('acepta "FIMA-PREMIUM-CLASE-A" y nombres de hasta 30 caracteres, como la base', () => {
    expect(alta(tickerDeNombre('FIMA PREMIUM CLASE A'))).toMatchObject({ ok: true, datos: { ticker: 'FIMA-PREMIUM-CLASE-A' } })
    // 25 caracteres: con el máximo viejo de 20 no entraba.
    expect(alta(tickerDeNombre('Fima Ahorro Pesos Clase A'))).toMatchObject({ ok: true, datos: { ticker: 'FIMA-AHORRO-PESOS-CLASE-A' } })
    expect(alta('X'.repeat(31))).toEqual({ ok: false, errores: { ticker: 'Hasta 30 caracteres.' } })
    expect(alta('FIMA PREMIUM')).toEqual({ ok: false, errores: { ticker: 'Solo letras, números, punto y guion.' } })
  })
})

describe('esquemaEdicionActivo: nunca queda un CEDEAR sin ratio (D-104)', () => {
  const base = { id: '5', nombre: 'Algo', tipo: 'cedear', moneda_riesgo: 'USD', geografia: 'US', ticker_subyacente: 'ALGO', activo_bool: 'on' }

  it('pasar a CEDEAR sin ratio cargado ni ratio nuevo: error en el ratio', () => {
    expect(leerFormulario(esquemaEdicionActivo, base)).toEqual({
      ok: false,
      errores: { ratio: 'Un CEDEAR necesita su ratio (CEDEARs por acción), con su fecha.' },
    })
  })

  it('con un ratio ya cargado, o con uno nuevo y su fecha, se guarda', () => {
    expect(leerFormulario(esquemaEdicionActivo, { ...base, tiene_ratio: '1' }).ok).toBe(true)
    expect(leerFormulario(esquemaEdicionActivo, { ...base, ratio: '20', ratio_desde: '2026-10-01' })).toMatchObject({ ok: true, datos: { ratio: '20' } })
  })

  it('lo que no es CEDEAR no necesita ratio', () => {
    expect(leerFormulario(esquemaEdicionActivo, { ...base, tipo: 'accion_local', moneda_riesgo: 'ARS', geografia: 'AR', ticker_subyacente: '' }).ok).toBe(true)
  })
})
