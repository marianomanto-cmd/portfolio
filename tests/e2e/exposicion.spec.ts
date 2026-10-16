import { expect, test } from '@playwright/test'
import { esperarHidratacion, sinIndicadorDev } from './ayudas'

// Exposición (rediseño 15/10, D-156 y D-158; handoff, captura 05): lo que el
// test de layout no ve. Las cifras del gráfico de largo y corto, la apertura y
// la concentración abren su traza; qué netea (Financiero · Total) conserva lo
// que elegiste en el balance de abajo; y /patrimonio lleva al balance, adentro.

test.describe('desktop (1440 × 900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('largo y corto: cuatro renglones con una sola escala, y cada cifra abre su traza', async ({ page }) => {
    await page.goto('/exposicion')
    expect(await esperarHidratacion(page)).toBe(true)
    await sinIndicadorDev(page)
    const grafico = page.locator('section[aria-labelledby="largo-corto"]')
    for (const r of ['Activos en pesos', 'Pasivos en pesos', 'Neto en pesos', 'Activos en dólares']) await expect(grafico).toContainText(r)
    // El cero es el mismo en todos los renglones.
    const ceros = await grafico.locator('li [aria-hidden] > div:first-child').evaluateAll((xs) => xs.map((x) => Math.round(x.getBoundingClientRect().left)))
    expect(new Set(ceros).size).toBe(1)
    const botones = grafico.locator('button[aria-controls]')
    expect(await botones.count()).toBe(8)
    for (let i = 0; i < 8; i++) {
      await botones.nth(i).click()
      await expect(page.getByRole('dialog').first()).toContainText(/=|Sin dato\./)
      await page.keyboard.press('Escape')
    }
    // La lectura: una frase con su cifra trazable.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/estás (largo|corto) en pesos por \$/)
  })

  test('apertura y concentración: el TOP 1 y el TOP 3 abren su traza', async ({ page }) => {
    await page.goto('/exposicion')
    expect(await esperarHidratacion(page)).toBe(true)
    for (const nombre of ['Top 1', 'Top 3']) {
      const tarjeta = page.getByLabel(nombre, { exact: true })
      await tarjeta.locator('button[aria-controls]').click()
      await expect(page.getByRole('dialog').first()).toContainText('=')
      await page.keyboard.press('Escape')
    }
    await expect(page.locator('section[aria-labelledby="apertura"] [role="img"]')).toHaveCount(2)
  })

  test('qué netea conserva lo que elegiste en el balance (fecha y agrupamiento)', async ({ page }) => {
    await page.goto('/exposicion?agrupar=clase&fecha=2026-10-08')
    expect(await esperarHidratacion(page)).toBe(true)
    await page.getByRole('navigation', { name: 'Qué netea la vista' }).getByRole('link', { name: /^Total/ }).click()
    await expect(page).toHaveURL(/vista=total/)
    await expect(page).toHaveURL(/agrupar=clase/)
    await expect(page).toHaveURL(/fecha=2026-10-08/)
    expect(await esperarHidratacion(page)).toBe(true)
    await expect(page.locator('[data-fecha-balance]')).toContainText('Balance al jue 08/10/2026')
    // Y el balance conserva qué netea: cambiar el agrupamiento deja la vista Total.
    await page.getByRole('navigation', { name: 'Ver lo financiero por' }).first().getByRole('link', { name: 'Cuenta' }).click()
    await expect(page).toHaveURL(/vista=total/)
    await expect(page).not.toHaveURL(/agrupar=/)
  })

  test('/patrimonio lleva al balance, dentro de Exposición, con lo que traía', async ({ page }) => {
    await page.goto('/patrimonio?demo=completo')
    await expect(page).toHaveURL(/\/exposicion\?demo=completo$/)
    expect(await esperarHidratacion(page)).toBe(true)
    await expect(page.getByRole('heading', { name: 'El detalle: tu balance' })).toBeVisible()
    await expect(page.locator('[data-tarjeta="titular"]').getByRole('heading', { level: 3 })).toHaveText('Patrimonio neto')
  })
})
