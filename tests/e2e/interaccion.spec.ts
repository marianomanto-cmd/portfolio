import { devices, expect, test } from '@playwright/test'
import { esperarHidratacion, montosALaVista, revisarGrillas, sinIndicadorDev } from './ayudas'

// Interacciones que el layout no ve: Hoy arriba del pliegue en el teléfono,
// la traza al tocar un número (hoja inferior en el teléfono, panel en
// desktop), la navegación (D-156: la barra de abajo, la hoja "Más", Cargar y
// su atajo, el Mapa, /patrimonio → /exposicion), el modo privado, el tema, la
// grilla (D-157) y revertir un lote.

// El descriptor de iPhone 13 trae WebKit por defecto: acá se usa su viewport,
// su densidad y el puntero táctil, con Chromium.
const { defaultBrowserType: _webkit, ...IPHONE_13 } = devices['iPhone 13']

test.describe('teléfono (iPhone 13, 390 × 664)', () => {
  test.use(IPHONE_13)

  test('Hoy entra arriba del pliegue: frase, dos tarjetas, exposición, Atención y "Todavía no cargaste hoy"', async ({ page }) => {
    await page.goto('/')
    expect(await esperarHidratacion(page)).toBe(true)
    await sinIndicadorDev(page)
    const vp = page.viewportSize()!
    expect(vp).toEqual({ width: 390, height: 664 })
    const barra = await page.getByRole('navigation', { name: 'Secciones' }).boundingBox()
    expect(barra).not.toBeNull()
    expect(Math.round(barra!.height)).toBe(56)
    const pliegue = vp.height - 56 // 608 px (visión §4.1 y Apéndice B)

    const fondo = async (loc: ReturnType<typeof page.locator>) => {
      await expect(loc).toBeVisible()
      const b = await loc.boundingBox()
      return b!.y + b!.height
    }
    const frase = page.getByLabel('Qué pasó desde la última carga')
    const financiero = page.getByRole('region', { name: 'Patrimonio financiero' })
    const total = page.getByRole('region', { name: 'Patrimonio total' })
    const exposicion = page.getByRole('link', { name: 'Pesos fin. − leasing' })
    const atencion = page.locator('summary', { hasText: 'Atención' })
    const cargar = page.getByRole('link', { name: /Todavía no cargaste hoy/ })
    for (const [nombre, loc] of [
      ['frase', frase],
      ['financiero', financiero],
      ['total', total],
      ['exposición', exposicion],
      ['atención', atencion],
      ['todavía no cargaste hoy', cargar],
    ] as const) {
      const y = await fondo(loc)
      expect(y, `${nombre} termina en ${Math.round(y)} px (pliegue: ${pliegue})`).toBeLessThanOrEqual(pliegue)
    }
    // Las tarjetas miden lo que calcula la visión (112 px).
    expect(Math.round((await financiero.boundingBox())!.height)).toBeLessThanOrEqual(112)
  })

  test('tocar un número abre su traza como hoja inferior, y se cierra', async ({ page }) => {
    await page.goto('/')
    expect(await esperarHidratacion(page)).toBe(true)
    await sinIndicadorDev(page)
    const financiero = page.getByRole('region', { name: 'Patrimonio financiero' })
    await financiero.getByRole('button', { name: /104\.271\.540/ }).first().tap()
    const hoja = page.getByRole('dialog', { name: 'Patrimonio financiero · en pesos' })
    await expect(hoja).toBeVisible()
    const b = (await hoja.boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(390.5)
    expect(Math.round(b.y + b.height)).toBe(664) // pegada abajo
    await expect(hoja).toContainText('=')
    await expect(hoja).toContainText('¿Qué es esto?')
    // Los insumos están a la vista (D-157: la placa los lista, cada uno con su valor).
    await expect(hoja).toContainText('De dónde sale')
    await expect(hoja).toContainText('Pesos en Mercado Pago')
    await hoja.getByRole('button', { name: 'Cerrar' }).tap()
    await expect(hoja).toBeHidden()
  })

  test('la frase completa, cifra por cifra, en una hoja', async ({ page }) => {
    await page.goto('/')
    expect(await esperarHidratacion(page)).toBe(true)
    await page.getByRole('button', { name: /Ver la frase completa/ }).tap()
    const hoja = page.getByRole('dialog', { name: 'La frase del día, cifra por cifra' })
    await expect(hoja).toBeVisible()
    await expect(hoja).toContainText('Por el CCL')
    await hoja.getByRole('button', { name: '+$ 532.812' }).tap()
    await expect(page.getByRole('dialog', { name: 'El CCL, en pesos' })).toBeVisible()
  })

  test('la barra de abajo: Hoy · Patrimonio · Cargar · Resultados · Más (D-156)', async ({ page }) => {
    await page.goto('/')
    expect(await esperarHidratacion(page)).toBe(true)
    const barra = page.getByRole('navigation', { name: 'Secciones' })
    await expect(barra.getByRole('link')).toHaveText(['Hoy', 'Patrimonio', 'Cargar', 'Resultados'])
    await expect(barra.getByRole('link', { name: 'Hoy', exact: true })).toHaveAttribute('aria-current', 'page')
    // Patrimonio abre Posiciones, con la pestaña de Exposición arriba.
    await barra.getByRole('link', { name: 'Patrimonio' }).tap()
    await expect(page).toHaveURL(/\/cartera$/)
    const pestanas = page.getByRole('navigation', { name: 'Patrimonio' })
    await expect(pestanas.getByRole('link', { name: 'Posiciones' })).toHaveAttribute('aria-current', 'page')
    await pestanas.getByRole('link', { name: 'Exposición' }).tap()
    await expect(page).toHaveURL(/\/exposicion$/)
    await expect(barra.getByRole('link', { name: 'Patrimonio' })).toHaveAttribute('aria-current', 'page')
    await barra.getByRole('link', { name: 'Resultados' }).tap()
    await expect(page).toHaveURL(/\/evolucion$/)
  })

  test('"Más" abre la hoja con Pasivos, Flujo, Registro, Datos, Ajustes y el Mapa', async ({ page }) => {
    await page.goto('/')
    expect(await esperarHidratacion(page)).toBe(true)
    await page.getByRole('button', { name: 'Más' }).tap()
    const hoja = page.getByRole('dialog', { name: 'Más secciones' })
    await expect(hoja).toBeVisible()
    for (const nombre of ['Pasivos', 'Flujo y escenarios', 'Registro', 'Datos', 'Ajustes', 'Mapa de la app']) await expect(hoja.getByRole('link', { name: new RegExp(nombre) })).toBeVisible()
    await hoja.getByRole('link', { name: /Ajustes/ }).tap()
    await expect(page).toHaveURL(/\/ajustes$/)
  })

  test('Cartera en tarjetas: el chip único cuando los signos difieren', async ({ page }) => {
    await page.goto('/cartera')
    expect(await esperarHidratacion(page)).toBe(true)
    const t30 = page.locator('[data-tarjeta="T30J7"]')
    await expect(t30).toBeVisible()
    await expect(t30).toContainText('ganás en pesos, perdés en dólares')
    await expect(page.locator('[data-tarjeta="SPY"]')).not.toContainText('ganás en pesos')
    await expect(page.locator('table:visible')).toHaveCount(0)
  })
})

test.describe('ventana angosta con mouse (640 × 900)', () => {
  test.use({ viewport: { width: 640, height: 900 } })

  test('la frase se lee entera, o hay cómo verla entera', async ({ page }) => {
    for (const ruta of ['/', '/?demo=express']) {
      await page.goto(ruta)
      expect(await esperarHidratacion(page)).toBe(true)
      const frase = page.getByLabel('Qué pasó desde la última carga').locator('p').first()
      const { recortada } = await frase.evaluate((el) => ({ recortada: el.scrollHeight > el.clientHeight + 1 }))
      const boton = page.getByRole('button', { name: /Ver la frase completa/ })
      if (recortada) await expect(boton, `${ruta}: la frase está recortada y no hay cómo verla entera`).toBeVisible()
      // Con mouse, cada cifra de la frase abre su traza en el lugar.
      if (!recortada) expect(await frase.getByRole('button').count(), ruta).toBeGreaterThan(0)
    }
  })
})

test.describe('desktop (1280 × 900)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('pasar el mouse no hace falta: un clic en un número abre el panel, que entra en la pantalla', async ({ page }) => {
    await page.goto('/')
    expect(await esperarHidratacion(page)).toBe(true)
    await sinIndicadorDev(page)
    const financiero = page.getByRole('region', { name: 'Patrimonio financiero' })
    await financiero.getByRole('button', { name: /104\.271\.540/ }).last().click()
    const panel = page.getByRole('dialog', { name: 'Patrimonio financiero · en pesos' })
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('$ 43.586.000,00')
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
  })

  test('el panel de una cifra pegada al borde derecho no se sale de la pantalla', async ({ page }) => {
    await page.goto('/cartera')
    expect(await esperarHidratacion(page)).toBe(true)
    const fila = page.locator('tr[data-fila="SPY"]')
    const celdas = fila.locator('td:visible')
    const ultima = celdas.last()
    await ultima.getByRole('button').first().click()
    const panel = page.getByRole('dialog').first()
    await expect(panel).toBeVisible()
    const b = (await panel.boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(1280)
  })

  test('los resultados en dólares van en verde o en rojo también dentro de la pastilla', async ({ page }) => {
    for (const ruta of ['/', '/cartera']) {
      await page.goto(ruta)
      expect(await esperarHidratacion(page)).toBe(true)
      const r = await page.evaluate(() => {
        const sonda = (clase: string) => {
          const s = document.createElement('span')
          s.className = clase
          document.body.appendChild(s)
          const c = getComputedStyle(s).color
          s.remove()
          return c
        }
        const tono = { 'text-negative': sonda('text-negative'), 'text-positive': sonda('text-positive') }
        const tinta = sonda('usd')
        const conTono = Array.from(document.querySelectorAll('.usd.text-negative, .usd.text-positive'))
        const mal = conTono
          .filter((el) => getComputedStyle(el).color !== tono[el.classList.contains('text-negative') ? 'text-negative' : 'text-positive'])
          .map((el) => `${el.textContent}: ${getComputedStyle(el).color}`)
        // Sin resultado, la pastilla conserva su tinta.
        const neutra = document.querySelector('.usd:not(.text-negative):not(.text-positive)')
        return { cuantos: conTono.length, mal, neutra: neutra ? getComputedStyle(neutra).color === tinta : null }
      })
      expect(r.cuantos, ruta).toBeGreaterThan(0)
      expect(r.mal, ruta).toEqual([])
      expect(r.neutra, ruta).toBe(true)
    }
  })

  test('Cartera: ordenar por una columna y filtrar', async ({ page }) => {
    await page.goto('/cartera')
    expect(await esperarHidratacion(page)).toBe(true)
    await page.getByRole('button', { name: 'Res. ARS' }).click() // de mayor a menor
    await expect(page.locator('tbody tr[data-fila]').first()).toHaveAttribute('data-fila', 'SPY')
    await page.getByLabel('Moneda de riesgo').selectOption('USD')
    await expect(page.locator('tbody tr[data-fila]')).toHaveCount(1)
    await page.getByRole('button', { name: 'Limpiar filtros' }).click()
    await expect(page.locator('tbody tr[data-fila]')).toHaveCount(6)
  })

  test('el ojo oculta montos y deja porcentajes; el tema (oscuro por defecto) se elige en Ajustes y se recuerda', async ({ page }) => {
    await page.goto('/')
    expect(await esperarHidratacion(page)).toBe(true)
    // Sin preferencia, el oscuro (D-157): ningún data-theme y el fondo del sistema.
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(10, 8, 16)')
    await page.getByRole('button', { name: /Ocultar los montos/ }).click()
    await expect(page.locator('html')).toHaveAttribute('data-privado', '1')
    const filtro = await page.locator('.monto').first().evaluate((el) => getComputedStyle(el).filter)
    expect(filtro).toContain('blur')
    const pct = page.getByRole('region', { name: 'Patrimonio financiero' }).getByRole('button', { name: '+0,57%' }).last()
    expect(await pct.evaluate((el) => getComputedStyle(el.querySelector('span')!).filter)).toBe('none')
    await page.goto('/ajustes')
    expect(await esperarHidratacion(page)).toBe(true)
    await page.getByRole('radiogroup', { name: 'Tema' }).getByRole('radio', { name: 'Claro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.reload()
    expect(await esperarHidratacion(page)).toBe(true)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('html')).toHaveAttribute('data-privado', '1')
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(250, 248, 244)')
  })

  test('con el modo privado no se lee ningún monto, en ninguna pantalla', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('portfolio:privado', '1'))
    const rutas = ['/', '/?demo=express', '/?demo=viejo', '/cartera', '/exposicion', '/exposicion?vista=total', '/registro', '/carga', '/datos/catalogo', '/datos/cuentas', '/datos/bienes', '/datos/leasing', '/datos/movimientos']
    const vistos: string[] = []
    for (const ruta of rutas) {
      await page.goto(ruta)
      expect(await esperarHidratacion(page), ruta).toBe(true)
      await expect(page.locator('html')).toHaveAttribute('data-privado', '1')
      if (ruta === '/carga') {
        // Cargar muestra montos recién con las fuentes leídas.
        await page.getByRole('button', { name: 'Probar con un ejemplo' }).click()
        await expect(page.getByText(/IEB/).first()).toBeVisible()
        await page.waitForTimeout(300)
      }
      vistos.push(...(await montosALaVista(page)).map((m) => `${ruta} · ${m}`))
    }
    expect(vistos, `Montos que se leen con el modo privado:\n${vistos.join('\n')}`).toEqual([])
  })

  test('con el teclado, el foco se ve sin deformar el control', async ({ page }) => {
    await page.goto('/ajustes')
    expect(await esperarHidratacion(page)).toBe(true)
    const interruptor = page.getByRole('switch', { name: 'Modo privado' })
    for (let i = 0; i < 60 && !(await interruptor.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
    const r = await interruptor.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { foco: el.matches(':focus-visible'), radio: parseFloat(cs.borderRadius), anillo: `${cs.outlineStyle} ${cs.outlineWidth}` }
    })
    expect(r.foco).toBe(true)
    expect(r.radio, 'el interruptor sigue siendo una pastilla').toBeGreaterThanOrEqual(16)
    expect(r.anillo).toBe('solid 2px')
    // Lo que trae su propio indicador de foco (outline-none) no suma un segundo contorno.
    const principal = page.locator('main')
    await principal.evaluate((el) => (el as HTMLElement).focus())
    expect(await principal.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none')
  })

  test('Exposición: el selector dice qué netea y Total muestra "sin dato" con la suma parcial', async ({ page }) => {
    await page.goto('/exposicion')
    expect(await esperarHidratacion(page)).toBe(true)
    const financiero = page.getByRole('link', { name: /^Financiero/ })
    await expect(financiero).toHaveAttribute('aria-current', 'page')
    await expect(financiero).toContainText('pesos financieros − deuda del leasing')
    await page.getByRole('link', { name: /^Total/ }).click()
    await expect(page).toHaveURL(/vista=total/)
    await expect(page.getByLabel('Tu exposición al peso')).toContainText('sin dato')
    // La redacción exacta es de la pantalla; lo que importa: "sin dato" y la suma parcial a la vista (D-65).
    await expect(page.getByLabel('Tu exposición al peso')).toContainText(/Suma parcial sin ell[ao]s: (largo )?\+?\$ 32\.783\.100,00/)
  })

  test('Registro: revertir un lote pide motivo y confirma', async ({ page }) => {
    await page.goto('/registro')
    expect(await esperarHidratacion(page)).toBe(true)
    await page.getByRole('button', { name: 'Revertir el lote' }).first().click()
    const dialogo = page.getByRole('dialog', { name: 'Revertir el lote' })
    await expect(dialogo).toBeVisible()
    const confirmar = dialogo.getByRole('button', { name: 'Revertir el lote' })
    await expect(confirmar).toBeDisabled()
    await dialogo.getByRole('radio', { name: 'Otro', exact: true }).check()
    await confirmar.click()
    await expect(dialogo).toBeVisible() // "otro" pide el texto
    await dialogo.getByLabel(/Detalle/).fill('el Excel era de otra cuenta')
    await confirmar.click()
    await expect(page.getByRole('status').first()).toContainText('Modo demo')
  })

  test('Registro es una grilla: se pinta con la CSP, se recorre con el teclado y ordena por columna (D-157)', async ({ page }) => {
    const csp: string[] = []
    page.on('console', (m) => {
      if (/Content Security Policy|Refused to (execute|load|apply|connect)/i.test(m.text())) csp.push(m.text())
    })
    await page.goto('/registro')
    expect(await esperarHidratacion(page)).toBe(true)
    const grilla = page.getByRole('grid', { name: 'Registro de cargas: un lote por fila' })
    await expect(grilla).toBeVisible()
    // El tema de AG Grid (CSS que la grilla inyecta; la CSP lo deja con style-src 'unsafe-inline'):
    // las filas en surface y el encabezado en mono de 10 px, en mayúsculas.
    const estilo = await grilla.evaluate((g) => {
      const sonda = document.createElement('span')
      sonda.className = 'bg-surface'
      document.body.appendChild(sonda)
      const surface = getComputedStyle(sonda).backgroundColor
      sonda.remove()
      const enc = getComputedStyle(g.querySelector('.ag-header-cell-text')!)
      return { fila: getComputedStyle(g.querySelector('.ag-row')!).backgroundColor, surface, fuente: enc.fontFamily, tam: enc.fontSize, mayus: enc.textTransform }
    })
    expect(estilo.fila).toBe(estilo.surface)
    expect(estilo).toMatchObject({ tam: '10px', mayus: 'uppercase' })
    expect(estilo.fuente).toMatch(/jetbrains/i)
    const fecha = grilla.getByRole('columnheader', { name: /Datos del/ })
    const tiempo = grilla.getByRole('columnheader', { name: 'Tiempo activo' })
    await expect(fecha).toHaveAttribute('aria-sort', 'descending')

    // Teclado: las flechas recorren las celdas; Enter entra a lo de adentro y Escape vuelve a la celda.
    const fila = grilla.locator('.ag-row[row-index="0"]')
    await fila.locator('[col-id="tiempo"]').click()
    await expect(fila.locator('[col-id="tiempo"]')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    const lote = fila.locator('[col-id="lote"]')
    await expect(lote).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(lote.getByRole('button', { name: 'Revertir el lote' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(lote).toBeFocused()

    // Orden: los números, de mayor a menor al primer clic, con "sin dato" al final.
    await tiempo.click()
    await expect(tiempo).toHaveAttribute('aria-sort', 'descending')
    await expect(fecha).toHaveAttribute('aria-sort', 'none')
    const textos = await grilla.locator('.ag-row [col-id="tiempo"]').allInnerTexts()
    const segundos = textos.map((t) => {
      const m = /(?:(\d+) min)?\s*(?:(\d+) s)?/.exec(t.trim())
      return t.includes('sin dato') ? null : Number(m?.[1] ?? 0) * 60 + Number(m?.[2] ?? 0)
    })
    expect(segundos.length).toBeGreaterThan(2)
    const conDato = segundos.filter((x): x is number => x !== null)
    expect(conDato, textos.join(' | ')).toEqual([...conDato].sort((a, b) => b - a))
    expect(segundos.slice(conDato.length).every((x) => x === null), textos.join(' | ')).toBe(true)
    expect(csp).toEqual([])
  })

  test('en un ancho medio, la grilla deja afuera columnas sin scroll horizontal y las muestra en la ficha de la fila', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 })
    await page.goto('/registro')
    expect(await esperarHidratacion(page)).toBe(true)
    const grilla = page.getByRole('grid', { name: 'Registro de cargas: un lote por fila' })
    await expect(grilla).toBeVisible()
    await expect(grilla.getByRole('columnheader', { name: 'Tiempo activo' })).toHaveCount(0)
    expect(await revisarGrillas(page)).toEqual([])
    await grilla.getByRole('button', { name: /ver lo que no entra en la tabla/ }).first().click()
    const ficha = page.getByRole('dialog').filter({ hasText: 'Lo que no entra en la tabla' })
    await expect(ficha).toBeVisible()
    await expect(ficha).toContainText('Tiempo activo')
    await ficha.getByRole('button', { name: 'Cerrar' }).click()
    await expect(ficha).toBeHidden()
  })

  test('la barra superior dice dónde estás; Cargar está siempre (tecla C) y el Mapa, al pie de la barra lateral (D-156)', async ({ page }) => {
    await page.goto('/')
    expect(await esperarHidratacion(page)).toBe(true)
    const barra = page.getByRole('banner')
    await expect(barra).toContainText('Hoy')
    await expect(barra).toContainText('Cuánto tenés y qué pasó')
    const cargar = barra.getByRole('link', { name: 'Cargar los datos de hoy' })
    await expect(cargar).toHaveAttribute('href', '/carga')
    // Cargar es una acción, no una sección del menú; Balance vive en Exposición.
    const lateral = page.getByRole('navigation', { name: 'Secciones' })
    for (const nombre of ['Hoy', 'Posiciones', 'Exposición', 'Evolución y PnL', 'Pasivos', 'Flujo y escenarios', 'Registro', 'Datos', 'Ajustes', 'Mapa de la app'])
      await expect(lateral.getByRole('link', { name: nombre, exact: true })).toBeVisible()
    await expect(lateral.getByRole('link', { name: /Cargar|Balance|Cartera/ })).toHaveCount(0)
    await page.keyboard.press('c')
    await expect(page).toHaveURL(/\/carga$/)
    await expect(cargar).toHaveAttribute('aria-current', 'page')
    await lateral.getByRole('link', { name: 'Mapa de la app' }).click()
    await expect(page).toHaveURL(/\/mapa$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('una pregunta')
    await expect(page.getByRole('region', { name: 'Las pantallas, por pregunta' }).getByRole('link', { name: /^Posiciones/ })).toHaveAttribute('href', '/cartera')
  })

  test('/patrimonio lleva a Exposición, con lo que traía en la dirección (D-156)', async ({ page }) => {
    await page.goto('/patrimonio?agrupar=clase')
    await expect(page).toHaveURL(/\/exposicion\?agrupar=clase$/)
    expect(await esperarHidratacion(page)).toBe(true)
    await expect(page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Exposición', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('una dirección que no existe: 404 en español, dentro del marco de la app y con salida', async ({ page }) => {
    for (const ruta of ['/no-existe', '/cartera/no-existe']) {
      const r = await page.goto(ruta)
      expect(r?.status(), ruta).toBe(404)
      expect(await esperarHidratacion(page), ruta).toBe(true)
      await expect(page).toHaveTitle('No encontré esa página · Portfolio')
      await expect(page.getByRole('heading', { level: 1, name: 'No encontré esa página' })).toBeVisible()
      await expect(page.getByText(/could not be found/i)).toHaveCount(0)
      // El marco: la barra lateral con sus secciones y la barra superior.
      await expect(page.getByRole('link', { name: 'Posiciones', exact: true }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: /Ocultar los montos/ })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Ir a Hoy' })).toHaveAttribute('href', '/')
    }
  })

  test('Día cero: dice qué hacer y lleva a Cargar y a Datos', async ({ page }) => {
    await page.goto('/?demo=vacio')
    expect(await esperarHidratacion(page)).toBe(true)
    await expect(page.getByText('Todavía no hay datos: arrancá por acá.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Hacer la primera carga' })).toHaveAttribute('href', '/carga')
    await expect(page.getByRole('link', { name: 'Empezar por Datos › Leasing' })).toHaveAttribute('href', '/datos/leasing')
  })
})
