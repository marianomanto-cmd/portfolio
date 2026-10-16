import { devices, expect, test, type Page } from '@playwright/test'
import { esperarHidratacion, montosALaVista, revisarLayout, sinIndicadorDev } from './ayudas'

// El balance (plan §3 A.8), que desde el rediseño (15/10, D-156) vive dentro de
// Exposición: /patrimonio redirige a /exposicion. Lo que el test de layout no
// ve. Cada cifra abre su traza; un "sin dato" nunca es $ 0; la cifra grande
// dice el origen de la deuda del leasing; el modo privado tapa todo monto; la
// hoja de "Ver por" del teléfono; y la impresión en A4 (solo el balance), sin
// cortes ni scroll.

const { defaultBrowserType: _webkit, ...IPHONE_13 } = devices['iPhone 13']

async function abrir(page: Page, ruta: string) {
  await page.goto(ruta)
  expect(await esperarHidratacion(page), ruta).toBe(true)
  await sinIndicadorDev(page)
}

test.describe('desktop (1280 × 900)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('cada cifra a la vista abre su traza con fórmula o con el motivo del "sin dato"', async ({ page }) => {
    for (const ruta of ['/exposicion', '/exposicion?demo=sin-deuda']) {
      await abrir(page, ruta)
      const cifras = page.locator('main [data-cifra] button[aria-controls]:visible')
      const n = await cifras.count()
      expect(n, ruta).toBeGreaterThan(40)
      for (let i = 0; i < n; i++) {
        const b = cifras.nth(i)
        await b.scrollIntoViewIfNeeded()
        await b.click()
        const panel = page.locator(`[id="${await b.getAttribute('aria-controls')}"]`)
        await expect(panel, `${ruta} · cifra ${i}`).toBeVisible()
        const texto = (await panel.textContent()) ?? ''
        expect(texto.includes('=') || texto.includes('Sin dato.'), `${ruta} · cifra ${i}: ${texto.slice(0, 80)}`).toBe(true)
        await page.keyboard.press('Escape')
      }
    }
  })

  test('un "sin dato" nunca dice $ 0', async ({ page }) => {
    for (const ruta of ['/exposicion?demo=sin-deuda', '/exposicion?demo=sin-valuacion', '/exposicion?demo=sin-bienes', '/exposicion?demo=vacio']) {
      await abrir(page, ruta)
      const textos = await page.locator('[data-sin-dato]').allTextContents()
      for (const t of textos) {
        expect(t.trim(), ruta).toBe('sin dato')
      }
      // El texto de la pantalla, sin el gráfico (su eje arranca en $ 0: es la escala, no una cifra) ni lo que solo lee el lector de pantalla.
      const texto = await page.locator('main').evaluate((el) => {
        const copia = el.cloneNode(true) as HTMLElement
        for (const n of Array.from(copia.querySelectorAll('svg, .sr-only'))) n.remove()
        return copia.textContent ?? ''
      })
      expect(texto, ruta).not.toMatch(/(US)?\$ 0(,00)?(?![\d.,])/)
    }
  })

  test('deuda estimada: la cifra grande lo dice, con lo firme debajo, y el pasivo dice de dónde sale', async ({ page }) => {
    await abrir(page, '/exposicion')
    const titular = page.locator('[data-tarjeta="titular"]')
    await expect(titular.getByRole('heading', { level: 3 })).toHaveText('Patrimonio neto · deuda del leasing estimada')
    await expect(titular.getByText('estimado', { exact: true })).toBeVisible()
    await expect(titular.locator('[data-firme]')).toContainText('Sin la camioneta: financiero + casa')
    const pasivo = page.locator('[data-tarjeta="pasivo"]')
    await expect(pasivo).toContainText('estimada por vos el jue 08/10 · provisoria')
    await expect(pasivo.getByRole('link', { name: /Cargar el valor de la leasera/ })).toHaveAttribute('href', '/datos/leasing')
    await expect(pasivo.locator('[data-referencia]')).toContainText('Aparece cuando importes el cuadro de marcha')
  })

  test('sin ninguna deuda: "sin la camioneta", parcial, y el total con la camioneta en "sin dato"', async ({ page }) => {
    await abrir(page, '/exposicion?demo=sin-deuda')
    const titular = page.locator('[data-tarjeta="titular"]')
    await expect(titular.getByRole('heading', { level: 3 })).toHaveText('Patrimonio neto sin la camioneta')
    await expect(titular.getByText('parcial', { exact: true })).toBeVisible()
    await expect(titular.locator('[data-sin-dato]')).toHaveCount(0)
    // El renglón del patrimonio completo (no el encabezado de la sección, que se llama igual).
    const neto = page.getByRole('row', { name: /^Patrimonio neto .*activo − pasivo/ })
    await expect(neto.locator('[data-sin-dato]').first()).toBeVisible()
  })

  test('con el valor de cancelación: "Patrimonio neto" a secas y la referencia del contrato al lado, sin restarla', async ({ page }) => {
    await abrir(page, '/exposicion?demo=completo')
    await expect(page.locator('[data-tarjeta="titular"]').getByRole('heading', { level: 3 })).toHaveText('Patrimonio neto')
    await expect(page.locator('[data-tarjeta="pasivo"] [data-referencia]')).toContainText('34 cuotas')
  })

  test('cambiar la fecha y el agrupamiento queda en la dirección', async ({ page }) => {
    await abrir(page, '/exposicion')
    await page.getByLabel('Fecha del balance').first().selectOption('2026-10-08')
    await expect(page).toHaveURL(/fecha=2026-10-08/)
    // La fecha del balance va en su encabezado (el h1 de la pantalla es la lectura de Exposición, que es de hoy).
    await expect(page.locator('[data-fecha-balance]')).toContainText('Balance al jue 08/10/2026')
    await page.getByRole('link', { name: 'Instrumento' }).first().click()
    await expect(page).toHaveURL(/agrupar=instrumento/)
    await expect(page).toHaveURL(/fecha=2026-10-08/)
    await expect(page.getByRole('row', { name: /Pesos en tus cuentas/ })).toBeVisible()
  })

  test('con el modo privado no se lee ningún monto, tampoco en el gráfico', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('portfolio:privado', '1'))
    const vistos: string[] = []
    for (const ruta of ['/exposicion', '/exposicion?demo=sin-deuda', '/exposicion?demo=completo', '/exposicion?demo=sin-bienes']) {
      await abrir(page, ruta)
      await page.locator('[aria-labelledby="evolucion-balance"] svg').first().waitFor({ state: 'attached', timeout: 15_000 }).catch(() => undefined)
      vistos.push(...(await montosALaVista(page)).map((m) => `${ruta} · ${m}`))
    }
    expect(vistos, `Montos que se leen con el modo privado:\n${vistos.join('\n')}`).toEqual([])
  })

  test('impresión en A4: sin la navegación, sin scroll horizontal y en pocas hojas', async ({ page }) => {
    await abrir(page, '/exposicion')
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' })
    await page.setViewportSize({ width: 718, height: 1000 }) // A4 menos los márgenes, a 96 ppp
    await expect(page.getByRole('navigation', { name: 'Secciones' }).first()).toBeHidden()
    // Dos tablas: el estado de situación y el comparativo (los gráficos y lo de arriba de Exposición no se imprimen).
    await expect(page.getByRole('table')).toHaveCount(2)
    await expect(page.locator('[data-imprimible="balance"]')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeHidden()
    await expect(page.locator('caption', { hasText: 'Estado de situación patrimonial' })).toBeAttached()
    await expect(page.locator('caption', { hasText: 'Comparativo del balance' })).toBeAttached()
    const problemas = (await revisarLayout(page, false)).filter((p) => !/texto cortado/.test(p))
    expect(problemas, problemas.join('\n')).toEqual([])
    // Tema claro al imprimir, aunque la pantalla esté en oscuro.
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)')
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } })
    const hojas = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    expect(hojas).toBeGreaterThan(0)
    expect(hojas).toBeLessThanOrEqual(4)
  })
})

test.describe('teléfono (iPhone 13, 390 × 664)', () => {
  test.use(IPHONE_13)

  test('"Ver por" abre una hoja con la fecha y el agrupamiento; un grupo se abre sin tapar sus cifras', async ({ page }) => {
    await abrir(page, '/exposicion')
    await page.getByRole('button', { name: /^Ver por: Cuenta/ }).tap()
    const hoja = page.getByRole('dialog', { name: 'Fecha y cómo ver el balance' })
    await expect(hoja).toBeVisible()
    expect(await revisarLayout(page, true)).toEqual([])
    await hoja.getByRole('link', { name: 'Clase' }).tap()
    await expect(page).toHaveURL(/agrupar=clase/)
    await expect(page.getByText('Activo por clase', { exact: true })).toBeVisible()
    const grupo = page.getByRole('button', { name: /^CEDEARs/ })
    await grupo.tap()
    await expect(grupo).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('SPY · SPDR S&P 500 (CEDEAR)').filter({ visible: true })).toBeVisible()
    expect(await revisarLayout(page, true)).toEqual([])
  })

  test('las tablas pasan a tarjetas: no hay tabla a la vista', async ({ page }) => {
    await abrir(page, '/exposicion')
    await expect(page.locator('table:has(caption:text("Estado de situación patrimonial"))')).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Activo por cuenta' })).toBeVisible()
  })
})
