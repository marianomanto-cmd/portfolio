import { devices, expect, test } from '@playwright/test'
import { esperarHidratacion, montosALaVista, sinIndicadorDev } from './ayudas'

// Evolución y PnL (plan §4 B.8 y §12; rediseño 15/10, D-159), en modo demo con
// números inventados: cada cifra abre su traza con la fórmula, ningún "sin
// dato" dice 0, el modo privado tapa todos los montos (también los de los
// gráficos), los resultados son una Grilla ordenable, y el período es la
// pastilla del diseño con "Otro período" (la semana y las fechas).

const { defaultBrowserType: _webkit, ...IPHONE_13 } = devices['iPhone 13']

test.describe('desktop (1280 × 900)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('cada cifra del puente y del estado de resultados abre su traza con la fórmula', async ({ page }) => {
    await page.goto('/evolucion?demo=mes')
    expect(await esperarHidratacion(page)).toBe(true)
    await sinIndicadorDev(page)
    for (const id of ['puente', 'estado-resultados']) {
      const tarjeta = page.locator(`section[aria-labelledby="${id}"]`)
      const botones = tarjeta.locator('[data-cifra] button')
      const n = await botones.count()
      expect(n, id).toBeGreaterThan(5)
      for (let i = 0; i < n; i++) {
        const b = botones.nth(i)
        await b.scrollIntoViewIfNeeded()
        await b.click()
        const panel = page.getByRole('dialog').first()
        await expect(panel).toBeVisible()
        // Con valor, la fórmula lleva "="; sin dato, dice qué falta.
        await expect(panel).toContainText(/=|Sin dato\./)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
    }
  })

  test('con un solo día: ningún "sin dato" dice 0 y el puente pide una segunda carga', async ({ page }) => {
    await page.goto('/evolucion?demo=un-dia')
    expect(await esperarHidratacion(page)).toBe(true)
    const sinDato = page.locator('[data-sin-dato]')
    expect(await sinDato.count()).toBeGreaterThan(5)
    for (const t of await sinDato.allInnerTexts()) {
      expect(t).toContain('sin dato')
      expect(t).not.toMatch(/0,00|\$\s?0\b/)
    }
    await expect(page.locator('section[aria-labelledby="puente"]')).toContainText('Necesita una segunda carga')
  })

  test('resultados por cuenta, con su subtotal, y ordenados por nombre (la Grilla)', async ({ page }) => {
    await page.goto('/evolucion?demo=mes')
    expect(await esperarHidratacion(page)).toBe(true)
    const bloque = page.locator('section[aria-labelledby="resultados"]')
    await bloque.getByRole('button', { name: 'Por cuenta' }).click()
    await expect(bloque.getByRole('button', { name: 'Por cuenta' })).toHaveAttribute('aria-pressed', 'true')
    // Cada cuenta abre con su subtotal (con traza) y debajo sus partidas.
    const subtotal = bloque.getByRole('row', { name: /IEB · \d+ partidas/ }).first()
    await expect(subtotal).toBeVisible()
    await subtotal.locator('[data-cifra] button').first().click()
    await expect(page.getByRole('dialog').first()).toContainText('IEB')
    await page.keyboard.press('Escape')
    await bloque.getByRole('button', { name: 'Por partida' }).click()
    await bloque.getByLabel('Ordenar por').selectOption('nombre:asc')
    // La grilla deja las filas en el DOM en el orden en que se ven (ensureDomOrder).
    const tickers = await bloque.locator('[data-grilla] .ag-row [data-fila]').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-fila') ?? ''))
    expect(tickers.length).toBeGreaterThan(3)
    expect(tickers).toEqual([...tickers].sort((a, b) => a.localeCompare(b, 'es')))
    // Tocar el encabezado también ordena: el resultado, de mayor a menor.
    await bloque.getByRole('columnheader', { name: /Resultado/ }).first().click()
    await expect(bloque.getByRole('columnheader', { name: /Resultado/ }).first()).toHaveAttribute('aria-sort', /descending|ascending/)
  })

  test('el período: la pastilla 1M · 3M · YTD · 12M · INICIO y "Otro período" con la semana y las fechas', async ({ page }) => {
    await page.goto('/evolucion')
    expect(await esperarHidratacion(page)).toBe(true)
    await sinIndicadorDev(page)
    const pastilla = page.getByRole('navigation', { name: 'Período' })
    for (const p of ['1M', '3M', 'YTD', '12M', 'Inicio']) await expect(pastilla.getByRole('link', { name: new RegExp(`^${p}`) })).toBeVisible()
    await expect(pastilla.getByRole('link', { name: /^Inicio/ })).toHaveAttribute('aria-current', 'page')
    await pastilla.getByRole('link', { name: /^12M/ }).click()
    await expect(page).toHaveURL(/periodo=12m/)
    expect(await esperarHidratacion(page)).toBe(true)
    await expect(page.locator('[data-periodo]')).toContainText('Los últimos 12 meses')
    await page.getByRole('button', { name: /Otro período/ }).click()
    const hoja = page.getByRole('dialog', { name: 'Otro período' })
    await expect(hoja).toBeVisible()
    await expect(hoja.getByLabel('Desde')).toBeVisible()
    await hoja.getByRole('link', { name: 'La última semana' }).click()
    await expect(page).toHaveURL(/periodo=semana/)
    expect(await esperarHidratacion(page)).toBe(true)
    await expect(page.locator('[data-periodo]')).toContainText('La última semana')
  })

  test('las cuatro cifras clave y el resultado por partida abren su traza', async ({ page }) => {
    await page.goto('/evolucion?demo=mes')
    expect(await esperarHidratacion(page)).toBe(true)
    await sinIndicadorDev(page)
    const cifras = page.getByRole('region', { name: 'Cifras clave del período' }).locator('button[aria-controls]')
    expect(await cifras.count()).toBeGreaterThanOrEqual(8)
    for (const id of ['activo-tc']) {
      const botones = page.locator(`section[aria-labelledby="${id}"] button[aria-controls]`)
      expect(await botones.count(), id).toBeGreaterThan(3)
    }
    const todos = [cifras.first(), cifras.nth(1), page.locator('section[aria-labelledby="activo-tc"] button[aria-controls]').first()]
    for (const b of todos) {
      await b.click()
      await expect(page.getByRole('dialog').first()).toContainText(/=|Sin dato\./)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  })

  test('modo privado: no queda ningún monto a la vista, tampoco en los gráficos', async ({ page }) => {
    await page.goto('/evolucion?demo=mes')
    expect(await esperarHidratacion(page)).toBe(true)
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-privado', '1')
      window.dispatchEvent(new Event('portfolio:preferencias'))
    })
    await page.waitForTimeout(300)
    expect(await montosALaVista(page)).toEqual([])
    // Los ejes de los gráficos tampoco dicen montos.
    const ejes = await page.locator('figure svg text').allTextContents()
    expect(ejes.filter((t) => /\$\s?[−+-]?\d/.test(t))).toEqual([])
  })
})

test.describe('teléfono (iPhone 13, 390 × 664)', () => {
  test.use(IPHONE_13)

  test('el período: la pastilla a la vista y "Otro período" en una hoja inferior, y queda en la URL', async ({ page }) => {
    await page.goto('/evolucion?demo=mes')
    expect(await esperarHidratacion(page)).toBe(true)
    await sinIndicadorDev(page)
    await page.getByRole('navigation', { name: 'Período' }).getByRole('link', { name: /^3M/ }).tap()
    await expect(page).toHaveURL(/periodo=3m/)
    expect(await esperarHidratacion(page)).toBe(true)
    await page.getByRole('button', { name: /Otro período/ }).tap()
    const hoja = page.getByRole('dialog', { name: 'Otro período' })
    await expect(hoja).toBeVisible()
    await hoja.getByRole('link', { name: 'La última semana' }).tap()
    await expect(page).toHaveURL(/periodo=semana/)
    expect(await esperarHidratacion(page)).toBe(true)
    await expect(page.locator('[data-periodo]')).toContainText('La última semana')
  })

  test('en el teléfono los resultados son tarjetas, no una tabla', async ({ page }) => {
    await page.goto('/evolucion?demo=mes')
    expect(await esperarHidratacion(page)).toBe(true)
    await expect(page.locator('[data-tarjeta="SPY"]')).toBeVisible()
    await expect(page.locator('section[aria-labelledby="resultados"] table:visible')).toHaveCount(0)
  })
})
