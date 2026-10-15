import { devices, expect, test, type Page } from '@playwright/test'
import { esperarHidratacion, montosALaVista, sinIndicadorDev } from './ayudas'

// Flujo y escenarios (plan §6 D.8 y D.9), en modo demo (números inventados):
// - Cargar ingreso de punta a punta: llenar, guardar, verlo en la lista y en
//   su mes como real, y Deshacer.
// - El deslizante: tocar Sube, moverlo, ver el número en el botón y recargar
//   sin perderlo (los supuestos viven en la URL); 44 px en 360 px.
// - La traza de una cifra proyectada se arma al tocarla.
// - El deslizante mueve la proyección en menos de 200 ms con la CPU × 4.
// - Con el modo privado no se lee ningún monto.
// Lo que se guarda en demo vive en una cookie del contexto: cada test arranca limpio.

const { defaultBrowserType: _webkit, ...IPHONE_13 } = devices['iPhone 13']

async function abrir(page: Page, ruta: string) {
  await page.goto(ruta)
  expect(await esperarHidratacion(page)).toBe(true)
  await sinIndicadorDev(page)
}

test.describe('teléfono (iPhone 13)', () => {
  test.use(IPHONE_13)

  test('Cargar ingreso: lo guardo, lo veo en la lista y en su mes como real, y lo deshago', async ({ page }) => {
    await abrir(page, '/flujo/cargar?sentido=ingreso')
    await expect(page.getByRole('heading', { level: 1, name: 'Cargar ingreso' })).toBeVisible()

    // Sin concepto no se guarda: es obligatorio.
    await page.getByRole('button', { name: 'Guardar el ingreso' }).click()
    await expect(page.getByText('Elegí el concepto.')).toBeVisible()

    await page.getByText('Ingreso mensual', { exact: true }).click()
    await page.getByLabel('Monto', { exact: true }).fill('3.800')
    await page.getByText('US$', { exact: true }).click()
    await page.getByText('IEB', { exact: true }).click()
    // Vendidos al cripto: los pesos tienen que cerrar con US$ × cripto.
    await page.getByLabel('Dólar cripto que usaste').fill('1.541')
    await page.getByLabel('Pesos que recibiste').fill('5.100.000')
    await expect(page.getByText(/No cierra/)).toBeVisible()
    await page.getByLabel('Pesos que recibiste').fill('5.855.800')
    await expect(page.getByText(/Cierra: US\$ × cripto/)).toBeVisible()
    await page.getByRole('button', { name: 'Guardar el ingreso' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Listo: cargaste' })).toContainText('ingreso mensual')
    const lista = page.locator('[data-lista="cargados"]')
    await expect(lista).toContainText('Ingreso mensual')
    await expect(lista).toContainText('Entró a IEB · aporte')

    // En su mes, lo real ya no es "sin dato".
    await abrir(page, '/flujo')
    const ingresosOct = page.locator('[data-real="2026-10-01"] li[data-linea="ingresos"]')
    await expect(ingresosOct).toBeVisible()
    await expect(ingresosOct.locator('dd').nth(1)).toContainText('$ 5.855.800')
    await expect(page.getByText('ingreso cargado')).toBeVisible()

    // Deshacer (con confirmación) lo saca de la lista y del mes.
    const cargados = page.locator('[data-lista="cargados"]')
    await cargados.getByRole('button', { name: 'Deshacer' }).click()
    await cargados.getByRole('button', { name: 'Sí, deshacer' }).click()
    await expect(page.getByText(/Deshecho: ya no cuenta/)).toBeVisible()
    await expect(page.getByText('Todavía no cargaste ningún ingreso ni gasto.')).toBeVisible()
    await expect(page.locator('[data-real="2026-10-01"] li[data-linea="ingresos"] dd').nth(1)).toContainText('sin dato')
  })

  test('el deslizante: Sube, lo muevo, el número va en el botón y recargar no lo pierde', async ({ page }) => {
    await abrir(page, '/flujo')
    const dev = page.locator('[data-variable="devaluacion.0"]')
    await dev.scrollIntoViewIfNeeded()
    // Nada arranca elegido.
    for (const d of ['baja', 'igual', 'sube']) await expect(dev.locator(`button[data-dir="${d}"]`)).toHaveAttribute('aria-pressed', 'false')
    await dev.locator('button[data-dir="sube"]').click()
    await expect(dev.getByText('Mové el deslizante para decir cuánto.')).toBeVisible()
    const rango = dev.getByRole('slider')
    await rango.focus()
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')
    await dev.getByRole('button', { name: /0,1 más/ }).click()
    await expect(dev.locator('button[data-dir="sube"]')).toHaveText('Sube +2,1%/mes')
    await expect(dev.locator('output')).toHaveText('+2,1%/mes')
    // El deslizante escribe la dirección al soltar: se espera a que tenga el 2,1.
    await expect
      .poll(() => {
        const s = new URL(page.url()).searchParams.get('s')
        return s ? JSON.parse(Buffer.from(s, 'base64url').toString('utf8')).devaluacion[0].valor : null
      })
      .toBe('2.1')

    await page.reload()
    expect(await esperarHidratacion(page)).toBe(true)
    const otra = page.locator('[data-variable="devaluacion.0"]')
    await expect(otra.locator('button[data-dir="sube"]')).toHaveText('Sube +2,1%/mes')
    await expect(otra.locator('button[data-dir="sube"]')).toHaveAttribute('aria-pressed', 'true')
  })

  test('Completar con Igual y un horizonte: la proyección aparece y cada cifra abre su traza', async ({ page }) => {
    await abrir(page, '/flujo')
    await expect(page.getByText('Todavía no hay proyección')).toBeVisible()
    await page.getByRole('button', { name: 'Completar lo que falta con Igual' }).click()
    await page.getByRole('button', { name: '12 meses', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^Proyección/ })).toBeVisible()
    const nov = page.locator('li[data-mes="2026-11-01"]')
    await nov.scrollIntoViewIfNeeded()
    await nov.locator('[data-cifra]').first().click()
    const hoja = page.getByRole('dialog')
    await expect(hoja).toBeVisible()
    await expect(hoja).toContainText('Ingresos de nov-26')
    await expect(hoja).toContainText('=')
  })
})

test.describe('360 px, puntero táctil', () => {
  test.use({ ...IPHONE_13, viewport: { width: 360, height: 740 } })

  test('los botones del panel y el deslizante miden 44 px', async ({ page }) => {
    await abrir(page, '/flujo')
    const dev = page.locator('[data-variable="devaluacion.0"]')
    await dev.locator('button[data-dir="sube"]').click()
    for (const loc of [dev.locator('button[data-dir="sube"]'), dev.getByRole('slider'), dev.getByRole('button', { name: /0,1 más/ }), dev.getByRole('button', { name: /0,1 menos/ })]) {
      const b = await loc.boundingBox()
      expect(b, 'se ve').not.toBeNull()
      expect(Math.round(b!.height)).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('el deslizante mueve la proyección en menos de 200 ms con la CPU × 4', async ({ page }) => {
    await abrir(page, '/flujo')
    await page.getByRole('button', { name: 'Completar lo que falta con Igual' }).click()
    await page.getByRole('button', { name: '24 meses', exact: true }).click()
    const dev = page.locator('[data-variable="devaluacion.0"]')
    await dev.locator('button[data-dir="sube"]').click()
    await dev.getByRole('button', { name: /0,1 más/ }).click()
    await expect(page.getByRole('heading', { name: /^Proyección/ })).toBeVisible()
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    const tiempos: number[] = []
    for (let i = 0; i < 5; i++) {
      const ms = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const caja = Array.from(document.querySelectorAll('p')).find((p) => p.textContent?.startsWith('Patrimonio financiero a '))?.parentElement
            const antes = caja?.textContent ?? ''
            const mas = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Devaluación (CCL): 0,1 más')
            const t0 = performance.now()
            const obs = new MutationObserver(() => {
              if ((caja?.textContent ?? '') !== antes) {
                obs.disconnect()
                resolve(performance.now() - t0)
              }
            })
            obs.observe(document.body, { subtree: true, childList: true, characterData: true })
            mas?.click()
            setTimeout(() => resolve(9999), 3000)
          }),
      )
      tiempos.push(ms)
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    tiempos.sort((a, b) => a - b)
    const mediana = tiempos[2]
    expect(mediana, `tiempos: ${tiempos.map((t) => Math.round(t)).join(', ')} ms`).toBeLessThan(200)
  })

  test('con el modo privado no se lee ningún monto en Flujo ni en Cargar ingreso', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('portfolio:privado', '1'))
    const vistos: string[] = []
    for (const ruta of ['/flujo', '/flujo/cargar?sentido=ingreso']) {
      await abrir(page, ruta)
      await expect(page.locator('html')).toHaveAttribute('data-privado', '1')
      if (ruta === '/flujo') {
        await page.getByRole('button', { name: 'Completar lo que falta con Igual' }).click()
        await page.getByRole('button', { name: '12 meses', exact: true }).click()
        await expect(page.getByRole('heading', { name: /^Proyección/ })).toBeVisible()
      }
      vistos.push(...(await montosALaVista(page)).map((m) => `${ruta} · ${m}`))
    }
    expect(vistos, `Montos que se leen con el modo privado:\n${vistos.join('\n')}`).toEqual([])
  })

  test('el excedente del mes muestra el chip de lo supuesto que suma (la cuota con seguro supuesto)', async ({ page }) => {
    await abrir(page, '/flujo')
    await expect(page.locator('[data-excedente-mes]')).toContainText('supuesto')
  })

  test('ningún texto de Flujo compara escenarios ni recomienda', async ({ page }) => {
    await abrir(page, '/flujo?demo=comparar')
    const texto = (await page.locator('main').innerText()).toLowerCase()
    for (const palabra of ['mejor', 'conviene', 'deberías', 'deberias', 'te recomiendo']) expect(texto, palabra).not.toContain(palabra)
  })
})
