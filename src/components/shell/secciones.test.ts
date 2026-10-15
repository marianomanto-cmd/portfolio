import { describe, expect, it } from 'vitest'
import { CARGAR, GRUPOS, itemInferiorActivo, PESTANAS_PATRIMONIO, SECCIONES, seccionActiva, seccionesDeMas } from './secciones'

// La navegación por pregunta (D-156).

describe('el menú', () => {
  it('cinco grupos, en el orden del diseño, y cada sección en uno', () => {
    expect(GRUPOS).toEqual(['Diario', 'Patrimonio', 'Resultados', 'Compromisos y futuro', 'Al pie'])
    for (const s of SECCIONES) expect(GRUPOS).toContain(s.grupo)
    expect(SECCIONES.filter((s) => s.grupo !== 'Al pie').map((s) => s.nombre)).toEqual(['Hoy', 'Posiciones', 'Exposición', 'Evolución y PnL', 'Pasivos', 'Flujo y escenarios'])
    expect(SECCIONES.filter((s) => s.grupo === 'Al pie').map((s) => s.nombre)).toEqual(['Registro', 'Datos', 'Ajustes', 'Mapa de la app'])
  })

  it('Cargar sale del menú (es la acción fija) y Balance vive en Exposición', () => {
    expect(SECCIONES.some((s) => s.href === CARGAR.href)).toBe(false)
    expect(SECCIONES.some((s) => s.href === '/patrimonio')).toBe(false)
  })

  it('Cartera se llama Posiciones y la ruta sigue siendo /cartera', () => {
    expect(SECCIONES.find((s) => s.href === '/cartera')?.nombre).toBe('Posiciones')
  })

  it('cada pantalla principal dice la pregunta que contesta', () => {
    for (const s of SECCIONES.filter((x) => x.grupo !== 'Al pie')) expect(s.pregunta, s.nombre).toMatch(/^¿.+\?$/)
  })
})

describe('la sección activa (el título de la barra superior)', () => {
  it('Hoy en la raíz, Cargar en /carga y la sección madre en una subruta', () => {
    expect(seccionActiva('/')?.nombre).toBe('Hoy')
    expect(seccionActiva('/carga')?.nombre).toBe('Cargar')
    expect(seccionActiva('/flujo/cargar')?.nombre).toBe('Flujo y escenarios')
    expect(seccionActiva('/datos/leasing')?.nombre).toBe('Datos')
    expect(seccionActiva('/no-existe')).toBeNull()
  })
})

describe('la barra inferior del teléfono: Hoy · Patrimonio · Cargar · Resultados · Más', () => {
  it('Patrimonio son Posiciones y Exposición (sus dos pestañas)', () => {
    expect(PESTANAS_PATRIMONIO.map((s) => s.href)).toEqual(['/cartera', '/exposicion'])
    expect(itemInferiorActivo('/cartera')).toBe('patrimonio')
    expect(itemInferiorActivo('/exposicion')).toBe('patrimonio')
  })

  it('Resultados es Evolución; Cargar, Cargar; el resto, Más', () => {
    expect(itemInferiorActivo('/')).toBe('hoy')
    expect(itemInferiorActivo('/evolucion')).toBe('resultados')
    expect(itemInferiorActivo('/carga')).toBe('cargar')
    for (const r of ['/pasivos', '/flujo', '/registro', '/datos/catalogo', '/ajustes', '/mapa']) expect(itemInferiorActivo(r), r).toBe('mas')
  })

  it('la hoja "Más" tiene todo lo que no está abajo', () => {
    expect(seccionesDeMas().map((s) => s.nombre)).toEqual(['Pasivos', 'Flujo y escenarios', 'Registro', 'Datos', 'Ajustes', 'Mapa de la app'])
  })
})
