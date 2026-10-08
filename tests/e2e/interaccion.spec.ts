import { devices, expect, test } from '@playwright/test'
import { esperarHidratacion, sinIndicadorDev } from './ayudas'

// Interacciones que el layout no ve: Hoy arriba del pliegue en el teléfono,
// la traza al tocar un número (hoja inferior en el teléfono, panel en
// desktop), la hoja "Más", el modo privado, el tema y revertir un lote.

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
    await hoja.getByRole('button', { name: 'Ver insumos ▸' }).tap()
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

  test('"Más" abre la hoja con Registro, Datos y Ajustes', async ({ page }) => {
    await page.goto('/')
    expect(await esperarHidratacion(page)).toBe(true)
    await page.getByRole('button', { name: 'Más' }).tap()
    const hoja = page.getByRole('dialog', { name: 'Más secciones' })
    await expect(hoja).toBeVisible()
    await expect(hoja.getByRole('link', { name: /Registro/ })).toBeVisible()
    await expect(hoja.getByRole('link', { name: /Datos/ })).toBeVisible()
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

  test('el ojo oculta montos y deja porcentajes; el tema se recuerda', async ({ page }) => {
    await page.goto('/')
    expect(await esperarHidratacion(page)).toBe(true)
    await page.getByRole('button', { name: /Ocultar los montos/ }).click()
    await expect(page.locator('html')).toHaveAttribute('data-privado', '1')
    const filtro = await page.locator('.monto').first().evaluate((el) => getComputedStyle(el).filter)
    expect(filtro).toContain('blur')
    const pct = page.getByRole('region', { name: 'Patrimonio financiero' }).getByRole('button', { name: '+0,57%' }).last()
    expect(await pct.evaluate((el) => getComputedStyle(el.querySelector('span')!).filter)).toBe('none')
    await page.getByRole('button', { name: /^Tema:/ }).click() // sistema → claro
    await page.getByRole('button', { name: /^Tema:/ }).click() // claro → oscuro
    await page.reload()
    expect(await esperarHidratacion(page)).toBe(true)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('html')).toHaveAttribute('data-privado', '1')
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

  test('Día cero: dice qué hacer y lleva a Cargar y a Datos', async ({ page }) => {
    await page.goto('/?demo=vacio')
    expect(await esperarHidratacion(page)).toBe(true)
    await expect(page.getByText('Todavía no hay datos: arrancá por acá.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Hacer la primera carga' })).toHaveAttribute('href', '/carga')
    await expect(page.getByRole('link', { name: 'Ir a Datos' })).toHaveAttribute('href', '/datos')
  })
})
