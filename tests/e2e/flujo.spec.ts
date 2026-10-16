import { devices, expect, test, type Page } from '@playwright/test'
import { esperarHidratacion, montosALaVista, sinIndicadorDev } from './ayudas'

// Flujo y escenarios (plan §6 D.8 y D.9; rediseño del 15/10, D-164), en modo
// demo (números inventados):
// - Cargar ingreso de punta a punta: llenar, guardar, verlo en la lista y en
//   su mes como real, y Deshacer.
// - Al abrir, todo en Igual y a 12 meses: la lectura, la cascada del mes y el
//   patrimonio en dólares se ven sin tocar nada (el dueño: «en flujos y
//   escenarios quiero ver graficos»).
// - Una barra por variable («y seleccionar los valores de las variables con
//   barras»): arranca en Igual, el teclado y + la mueven, el número se ve, la
//   lectura cambia en vivo, recargar no la pierde (los supuestos viven en la
//   URL) y "Volver a Igual" la devuelve de un toque; 44 px en 360 px.
// - La pastilla de escenarios: Igual y tus guardados.
// - La traza de una cifra proyectada se arma al tocarla.
// - Una barra mueve la proyección en menos de 200 ms con la CPU × 4.
// - Con el modo privado no se lee ningún monto.
// - Cargar ingreso y Cargar gasto, en el mes en curso (D-166).
// Lo que se guarda en demo vive en una cookie del contexto: cada test arranca limpio.

const { defaultBrowserType: _webkit, ...IPHONE_13 } = devices['iPhone 13']

async function abrir(page: Page, ruta: string) {
  await page.goto(ruta)
  expect(await esperarHidratacion(page)).toBe(true)
  await sinIndicadorDev(page)
}

/** La devaluación guardada en ?s= (los supuestos viven en la URL). */
function devaluacionEnUrl(page: Page): { dir: string; valor: string | null } | null {
  const s = new URL(page.url()).searchParams.get('s')
  return s ? JSON.parse(Buffer.from(s, 'base64url').toString('utf8')).devaluacion[0] : null
}

const LECTURA_IGUAL = /^Este mes te sobran \$ [\d.]+\. Con todo igual, en un año llegás a US\$ [\d.]+ en lo financiero\.$/

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

    // En su mes, lo real ya no es "sin dato" (proyectado contra real: en el teléfono, una tarjeta por línea).
    await abrir(page, '/flujo')
    const ingresosOct = page.locator('[data-real="2026-10-01"] [data-linea="ingresos"]')
    await expect(ingresosOct).toBeVisible()
    await expect(ingresosOct.locator('dd').nth(1)).toContainText('$ 5.855.800')
    await expect(page.getByText('ingreso cargado')).toBeVisible()

    // Deshacer (con confirmación) lo saca de la lista y del mes.
    const cargados = page.locator('[data-lista="cargados"]')
    await cargados.getByRole('button', { name: 'Deshacer' }).click()
    await cargados.getByRole('button', { name: 'Sí, deshacer' }).click()
    await expect(page.getByText(/Deshecho: ya no cuenta/)).toBeVisible()
    await expect(page.getByText('Todavía no cargaste ningún ingreso ni gasto.')).toBeVisible()
    await expect(page.locator('[data-real="2026-10-01"] [data-linea="ingresos"] dd').nth(1)).toContainText('sin dato')
  })

  test('al abrir, todo en Igual y a 12 meses: la lectura y los gráficos se ven sin tocar nada, y cada cifra abre su traza', async ({ page }) => {
    await abrir(page, '/flujo')
    await expect(page.locator('main h1')).toHaveText(LECTURA_IGUAL)
    await expect(page.getByText('Futuro · ¿Cuánto me sobra y adónde me lleva?')).toBeVisible()
    // La cascada del mes y el patrimonio en dólares, dibujados.
    await expect(page.locator('[data-cascada] canvas, [data-cascada] svg').first()).toBeVisible()
    await expect(page.locator('[data-patrimonio-usd] canvas, [data-patrimonio-usd] svg').first()).toBeVisible()
    await expect(page.getByText('Patrimonio financiero en dólares · 12 meses')).toBeVisible()
    await expect(page.locator('[data-escenario="igual"]')).toHaveAttribute('aria-pressed', 'true')
    // Nada sin elegir: no falta ningún supuesto y "Todo en Igual" no tiene nada que hacer.
    await expect(page.getByText(/Para proyectar (falta|faltan)/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Todo en Igual' })).toBeDisabled()
    await expect(page.getByRole('button', { name: '12 meses', exact: true })).toHaveAttribute('aria-pressed', 'true')
    // Sin Monte Carlo no hay abanico ni probabilidad (D-144): lo dice, y va la salida que existe.
    await expect(page.getByText('llega con Monte Carlo: hoy es un solo camino.')).toBeVisible()
    await expect(page.locator('[data-debajo]')).toContainText(/^(Sí|No)/)

    // Cada nombre de la cascada abre la cuenta de su cifra.
    const paso = page.locator('[data-pasos-cascada] button[aria-controls]').last()
    await paso.scrollIntoViewIfNeeded()
    await paso.click()
    await expect(page.getByRole('dialog')).toContainText('=')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Una cifra proyectada arma su traza al tocarla.
    const nov = page.locator('[data-mes="2026-11-01"]')
    await nov.scrollIntoViewIfNeeded()
    await nov.locator('[data-cifra]').first().click()
    const hoja = page.getByRole('dialog')
    await expect(hoja).toBeVisible()
    await expect(hoja).toContainText('Ingresos de nov-26')
    await expect(hoja).toContainText('=')
  })

  test('una barra por variable: arranca en Igual, la muevo, la lectura cambia en vivo, recargar no la pierde y vuelve a Igual de un toque', async ({ page }) => {
    await abrir(page, '/flujo')
    const enfasis = page.locator('main h1 em')
    const antes = await enfasis.innerText()
    const dev = page.locator('[data-variable="devaluacion.0"]')
    await dev.scrollIntoViewIfNeeded()
    await expect(dev.locator('[data-valor]')).toHaveText('Igual')
    await expect(dev.getByRole('slider', { name: 'Devaluación (CCL)' })).toHaveAttribute('aria-valuetext', 'Igual')
    await expect(dev.locator('[data-igual]')).toHaveCount(0)

    // El teclado (20 pasos de 0,1) y el +.
    const barra = dev.getByRole('slider')
    await barra.focus()
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')
    await expect(dev.locator('[data-valor]')).toHaveText('Sube +2,0 %/mes')
    await dev.getByRole('button', { name: 'Devaluación (CCL): 0,1 más' }).click()
    await expect(dev.locator('[data-valor]')).toHaveText('Sube +2,1 %/mes')
    // La lectura sigue a la barra: ya no es "con todo igual" y la cifra cambió.
    await expect(page.locator('main h1')).toContainText('Con tus supuestos, en un año llegás a')
    await expect(enfasis).not.toHaveText(antes)
    await expect(page.locator('[data-con-cambios]')).toBeVisible()
    // La barra escribe la dirección al soltar: se espera a que tenga el 2,1.
    await expect.poll(() => devaluacionEnUrl(page)).toEqual({ dir: 'sube', valor: '2.1', hasta_mes: null })

    await page.reload()
    expect(await esperarHidratacion(page)).toBe(true)
    const otra = page.locator('[data-variable="devaluacion.0"]')
    await expect(otra.locator('[data-valor]')).toHaveText('Sube +2,1 %/mes')
    await expect(otra.getByRole('slider')).toHaveValue('2.1')

    // Volver a Igual, de un toque.
    await otra.locator('[data-igual]').click()
    await expect(otra.locator('[data-valor]')).toHaveText('Igual')
    await expect(page.locator('main h1')).toHaveText(LECTURA_IGUAL)
    await expect(page.locator('main h1 em')).toHaveText(antes)
    await expect.poll(() => devaluacionEnUrl(page)?.dir).toBe('igual')
  })
})

test.describe('360 px, puntero táctil', () => {
  test.use({ ...IPHONE_13, viewport: { width: 360, height: 740 } })

  test('la barra, sus − y +, Volver a Igual y la pastilla de escenarios miden 44 px', async ({ page }) => {
    await abrir(page, '/flujo?demo=comparar')
    const dev = page.locator('[data-variable="devaluacion.0"]')
    await dev.getByRole('button', { name: 'Devaluación (CCL): 0,1 más' }).click()
    for (const loc of [
      dev.getByRole('slider'),
      dev.getByRole('button', { name: 'Devaluación (CCL): 0,1 más' }),
      dev.getByRole('button', { name: 'Devaluación (CCL): 0,1 menos' }),
      dev.locator('[data-igual]'),
      page.locator('[data-escenario="igual"]'),
      page.locator('[data-escenario="2"]'),
    ]) {
      await loc.scrollIntoViewIfNeeded()
      const b = await loc.boundingBox()
      expect(b, 'se ve').not.toBeNull()
      expect(Math.round(b!.height)).toBeGreaterThanOrEqual(44)
      expect(Math.round(b!.width)).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('la pastilla de escenarios: Igual y tus guardados; uno tocado lo dice', async ({ page }) => {
    await abrir(page, '/flujo?demo=comparar')
    const h1 = page.locator('main h1')
    await expect(h1).toContainText('Con todo igual, en un año llegás a')
    const pastilla = page.getByRole('group', { name: 'Escenario' })
    await expect(pastilla.getByRole('button')).toHaveText(['Igual', 'Todo igual', 'Dólar arriba', 'Ingreso baja en feb-27'])

    await page.locator('[data-escenario="2"]').click()
    await expect(page.locator('[data-escenario="2"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-escenario="igual"]')).toHaveAttribute('aria-pressed', 'false')
    // Su horizonte es el que guardaste (24 meses en el demo).
    await expect(h1).toContainText('En «Dólar arriba», en dos años llegás a')
    await expect(page.locator('[data-variable="devaluacion.0"] [data-valor]')).toHaveText('Sube +2,0 %/mes')
    await expect(page.locator('[data-variable="retorno.cedear"] [data-valor]')).toContainText('Sube +8,0')
    await expect(page.locator('[data-con-cambios]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Guardar cambios en «Dólar arriba»' })).toBeVisible()

    // Le muevo una barra: sigue abierto (para guardar los cambios), y la lectura y la pastilla lo dicen.
    await page.getByRole('button', { name: 'Devaluación (CCL): 0,1 más' }).click()
    await expect(h1).toContainText('En «Dólar arriba» con tus cambios, en dos años llegás a')
    await expect(page.locator('[data-con-cambios]')).toBeVisible()

    // Igual: todas las barras a Igual, de un toque (el horizonte queda).
    await page.locator('[data-escenario="igual"]').click()
    await expect(h1).toContainText('Con todo igual, en dos años llegás a')
    await expect(page.locator('[data-escenario="igual"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-variable="devaluacion.0"] [data-valor]')).toHaveText('Igual')
    await expect(page.locator('[data-variable="retorno.cedear"] [data-valor]')).toHaveText('Igual')
  })

  test('una barra mueve la proyección en menos de 200 ms con la CPU × 4', async ({ page }) => {
    await abrir(page, '/flujo')
    await page.getByRole('button', { name: '24 meses', exact: true }).click()
    await expect(page.getByText('Patrimonio financiero en dólares · 24 meses')).toBeVisible()
    await page.getByRole('button', { name: 'Devaluación (CCL): 0,1 más' }).click()
    await expect(page.locator('[data-variable="devaluacion.0"] [data-valor]')).toHaveText('Sube +0,1 %/mes')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    const tiempos: number[] = []
    for (let i = 0; i < 5; i++) {
      const ms = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            // La cifra del escenario al horizonte, la de arriba (patrimonio en dólares).
            const caja = document.querySelector('[data-financiero-horizonte]')
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
    // A la vista en el informe de la corrida (pasa o no pasa).
    console.log(`Flujo · una barra, con la CPU × 4: ${tiempos.map((t) => Math.round(t)).join(', ')} ms (mediana ${Math.round(mediana)})`)
    expect(mediana, `tiempos: ${tiempos.map((t) => Math.round(t)).join(', ')} ms`).toBeLessThan(200)
  })

  test('Cargar ingreso y Cargar gasto siguen a mano: en el mes en curso, y la página toma la anatomía', async ({ page }) => {
    await abrir(page, '/flujo')
    const mes = page.locator('section[aria-labelledby="titulo-mes"]')
    await expect(mes.getByRole('link', { name: 'Cargar ingreso' })).toHaveAttribute('href', '/flujo/cargar?sentido=ingreso')
    await expect(mes.getByRole('link', { name: 'Cargar gasto' })).toHaveAttribute('href', '/flujo/cargar?sentido=gasto')
    // Sin cargas (no hay mes en curso), van en "Lo que cargaste".
    await abrir(page, '/flujo?demo=vacio')
    await expect(page.locator('section[aria-labelledby="titulo-cargados"]').getByRole('link', { name: 'Cargar ingreso' })).toBeVisible()
    await abrir(page, '/flujo/cargar?sentido=gasto')
    await expect(page.getByRole('heading', { level: 1, name: 'Cargar gasto' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Ingreso o gasto' }).getByRole('link', { name: 'Gasto' })).toHaveAttribute('aria-current', 'page')
  })

  test('con el modo privado no se lee ningún monto en Flujo ni en Cargar ingreso', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('portfolio:privado', '1'))
    const vistos: string[] = []
    for (const ruta of ['/flujo', '/flujo?demo=comparar', '/flujo/cargar?sentido=ingreso']) {
      await abrir(page, ruta)
      await expect(page.locator('html')).toHaveAttribute('data-privado', '1')
      if (!ruta.startsWith('/flujo/cargar')) await expect(page.locator('[data-patrimonio-usd]')).toBeVisible()
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
