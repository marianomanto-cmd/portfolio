import path from 'node:path'
import { devices, expect, test, type Page } from '@playwright/test'
import { esperarHidratacion, montosALaVista, sinIndicadorDev } from './ayudas'

// Pasivos y Datos › Leasing (entrega 4, plan §5 C.8), en modo demo: importar el
// cuadro de marcha (archivo → revisión → Enter → guardado → Deshacer), la
// revisión de la planilla actualizada, una planilla con errores que frena el
// Enter, la traza de cada cifra, el "sin dato" que nunca dice $ 0,00 y el modo
// privado. Los números son los del ejemplo inventado (D-24).

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/cuadro-marcha.csv')
const { defaultBrowserType: _webkit, ...IPHONE_13 } = devices['iPhone 13']

async function abrir(page: Page, ruta: string) {
  await page.goto(ruta)
  expect(await esperarHidratacion(page), ruta).toBe(true)
  await sinIndicadorDev(page)
}

test.describe('Datos › Leasing: importar el cuadro de marcha', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('archivo → revisión → Enter → guardado → Deshacer', async ({ page }) => {
    await abrir(page, '/datos/leasing?demo=sin-cuadro')
    await expect(page.getByText('Todavía no importaste el cuadro de marcha')).toBeVisible()
    await page.getByRole('button', { name: 'Importar cuadro de marcha (CSV)' }).click()
    await page.getByLabel('Elegí el archivo CSV').setInputFiles(FIXTURE)

    const panel = page.getByRole('region', { name: /Revisión de cuadro-marcha\.csv/ })
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('35 cuotas leídas')
    await expect(panel).toContainText('14 facturadas (14 pagadas)')
    await expect(panel).toContainText('21 proyectadas (seguro a confirmar en 21, percepción supuesta en 21)')
    await expect(panel).toContainText('35 nuevas')
    await expect(panel).toContainText('igual a la del contrato')
    // Control de salida: la columna total de la planilla y la suma de las partes, al centavo.
    await expect(panel).toContainText('Total de la planilla $ 46.286.400,00')

    // Las advertencias (percepción $ 0 de comprobante en las cuotas 4 y 9) se aceptan de a una.
    const guardar = panel.getByRole('button', { name: 'Guardar (Enter)' })
    await expect(guardar).toBeDisabled()
    const advertencias = panel.getByRole('checkbox')
    await expect(advertencias).toHaveCount(2)
    // La casilla es invisible: se toca el renglón (el objetivo de 44 px).
    await panel.getByText('Cuota 4: la percepción es $ 0').click()
    await expect(advertencias.nth(0)).toBeChecked()
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Enter') // con una sola aceptada, el Enter no guarda
    await expect(guardar).toBeDisabled()
    await panel.getByText('Cuota 9: la percepción es $ 0').click()
    await expect(advertencias.nth(1)).toBeChecked()
    await expect(guardar).toBeEnabled()

    // Enter desde fuera de un campo guarda (como en Cargar).
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Enter')
    const hecho = page.getByRole('region', { name: 'Cuadro de marcha guardado' })
    await expect(hecho).toContainText('Modo demo: la planilla está bien (35 cuotas), pero no se guarda.')

    await hecho.getByRole('button', { name: 'Deshacer' }).click()
    await expect(hecho).toContainText('no se había guardado nada')
    await expect(hecho.getByRole('button', { name: 'Deshacer' })).toHaveCount(0)
    await expect(hecho.getByRole('link', { name: 'Ver en Pasivos' })).toHaveAttribute('href', '/pasivos?demo=sin-cuadro')
  })

  test('la planilla actualizada: qué cambia, el cargo extra y la opción contra el contrato', async ({ page }) => {
    await abrir(page, '/datos/leasing?demo=revision')
    const panel = page.getByRole('region', { name: /Revisión de cuadro de marcha actualizado/ })
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('1 actualizada · 34 iguales')
    await expect(panel).toContainText('Cuota 14: pasa a facturada, pagada')
    await expect(panel).toContainText('1 cargo extra')
    await expect(panel).toContainText('igual a la del contrato')
  })

  test('una planilla con errores frena el Enter y dice fila y columna', async ({ page }) => {
    await abrir(page, '/datos/leasing?demo=sin-cuadro')
    await page.getByRole('button', { name: 'Importar cuadro de marcha (CSV)' }).click()
    const texto = [
      'nro_cuota,fecha_vencimiento,mes_del_canon,canon_neto,seguro_neto,subtotal_neto,iva_21,percepcion_iva_rg3337,total_cuota,pagado,origen_seguro,origen_percepcion',
      '1,2025-09-01,2025-08,1000000.00,80000.00,1080000.00,226800.00,32400.00,1339300.00,SI,comprobante,comprobante',
    ].join('\n')
    await page.getByLabel('O pegá el texto de la planilla').fill(texto)
    await page.getByRole('button', { name: 'Revisar' }).click()
    const errores = page.getByRole('alert').filter({ hasText: 'frena el guardado' })
    await expect(errores).toContainText('Fila 2')
    await expect(errores).toContainText('columna')
    await expect(page.getByRole('button', { name: 'Guardar (Enter)' })).toBeDisabled()
  })
})

test.describe('Datos › Leasing: el pago de una cuota y los cargos extra', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('completar el pago de una cuota: fecha, CCL con su fuente y quién pagó (en demo no se guarda)', async ({ page }) => {
    await abrir(page, '/datos/leasing')
    await page.getByText('Completar el pago de una cuota (fecha y CCL)').click()
    const form = page.getByRole('form', { name: 'Completar el pago de una cuota' })
    await expect(form).toContainText('14 sin fecha de pago')
    await form.getByLabel('Cuota').selectOption('14')
    await form.getByLabel('Fecha del pago (opcional)').fill('2026-10-01')
    await form.getByLabel('CCL de ese día').fill('1.450,00')
    // Sin decir de dónde salió el CCL, no se guarda: van juntos.
    await form.getByRole('button', { name: 'Guardar el pago de la cuota 14' }).click()
    await expect(form).toContainText('El CCL del día del pago y de dónde lo sacaste van juntos.')
    await form.getByLabel('De dónde sacaste el CCL').fill('Cierre del día en el bróker')
    await form.getByText('Vos', { exact: true }).click()
    await form.getByRole('button', { name: 'Guardar el pago de la cuota 14' }).click()
    await expect(form.getByRole('status')).toContainText('Modo demo: el pago de la cuota 14 está bien, pero no se guarda.')
  })

  test('un cargo extra a mano: los campos que faltan se dicen al lado', async ({ page }) => {
    await abrir(page, '/datos/leasing')
    await page.getByText('Cargos extra (0)').click()
    await page.getByRole('button', { name: 'Agregar un cargo a mano' }).click()
    const form = page.getByRole('form', { name: 'Agregar un cargo extra' })
    await form.getByLabel('Importe en pesos, con IVA si lo lleva').fill('12.500')
    await form.getByRole('button', { name: 'Guardar el cargo' }).click()
    await expect(form).toContainText('Elegí qué es.')
    await expect(form).toContainText('Elegí de dónde sale.')
    await form.getByLabel('Qué es').selectOption('comision')
    await form.getByLabel('De dónde sale').selectOption('comprobante')
    await form.getByRole('button', { name: 'Guardar el cargo' }).click()
    await expect(page.getByText('Modo demo: el cargo está bien, pero no se guarda.')).toBeVisible()
  })
})

test.describe('Pasivos: cada cifra abre su traza y "sin dato" nunca es $ 0,00', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('las cifras de /pasivos abren su traza con fórmula', async ({ page }) => {
    await abrir(page, '/pasivos?demo=completo')
    // Las cifras con traza (el botón "Ver como tabla" del gráfico no es una cifra).
    const cifras = page.locator('main button[aria-controls][aria-expanded]').filter({ hasNotText: /Ver como tabla|Ocultar la tabla/ })
    const n = await cifras.count()
    expect(n).toBeGreaterThan(40)
    // Todas las de arriba (frase, tarjetas, deuda, tasa, totales) y una muestra del resto.
    const indices = [...Array(n).keys()].filter((i) => i < 40 || i % 7 === 0)
    for (const i of indices) {
      const b = cifras.nth(i)
      if (!(await b.isVisible())) continue
      await b.scrollIntoViewIfNeeded()
      await b.click()
      const id = await b.getAttribute('aria-controls')
      const panel = page.locator(`[id="${id}"]`)
      await expect(panel, `cifra ${i}`).toBeVisible()
      await expect(panel, `cifra ${i}`).toContainText(/=|sin dato/)
      await page.keyboard.press('Escape')
      await expect(panel).toBeHidden()
    }
  })

  for (const ruta of ['/pasivos?demo=sin-tasa', '/pasivos?demo=sin-cuadro', '/pasivos', '/datos/leasing?demo=sin-cuadro']) {
    test(`"sin dato" con su motivo, nunca $ 0,00: ${ruta}`, async ({ page }) => {
      await abrir(page, ruta)
      const textos = await page.locator('main').innerText()
      expect(textos).toContain('sin dato')
      expect(textos).not.toMatch(/\$\s?0,00(?!\d)/)
    })
  }
})

test.describe('Pasivos en el teléfono (iPhone 13)', () => {
  test.use(IPHONE_13)

  test('el cuadro en tarjetas, la cuota abierta y la traza como hoja', async ({ page }) => {
    await abrir(page, '/pasivos')
    await expect(page.getByRole('heading', { level: 1, name: 'Pasivos' })).toBeVisible()
    const cuadro = page.getByRole('region', { name: 'Cuadro de marcha' })
    await expect(cuadro.getByText('Cuota 15', { exact: false }).first()).toBeVisible()
    await expect(cuadro.locator('table')).toBeHidden()
    await cuadro.getByRole('button', { name: 'Amortización y gasto' }).tap()
    await expect(cuadro.getByText('Amortización').first()).toBeVisible()
    // La amortización y el interés de cada cuota salen de la tasa: se ven con su chip.
    await expect(cuadro.locator('li').first().getByText('estimado').first()).toBeVisible()
    await cuadro.getByRole('button', { name: '14 pagadas' }).tap()
    await expect(cuadro.getByText('Cuota 1 ', { exact: false }).first()).toBeVisible()
    // En el teléfono la tabla de escritorio está oculta: la cifra se toca en una tarjeta.
    const cifra = cuadro.locator('li button[aria-controls][aria-expanded]').first()
    await cifra.tap()
    const hoja = page.getByRole('dialog').first()
    await expect(hoja).toBeVisible()
    await expect(hoja).toContainText('=')
    await hoja.getByRole('button', { name: 'Cerrar' }).tap()
    await expect(hoja).toBeHidden()
  })

  test('la frase: con el dedo, "Ver cada cifra de la frase" abre cada cifra en pesos y en dólares, y cada una su traza', async ({ page }) => {
    await abrir(page, '/pasivos')
    await page.getByRole('button', { name: 'Ver cada cifra de la frase' }).tap()
    const hoja = page.getByRole('dialog', { name: /cada cifra de la frase/ })
    await expect(hoja).toBeVisible()
    await expect(hoja).toContainText('Próxima cuota (la 15)')
    await expect(hoja).toContainText('Falta pagar (21 cuotas)')
    await expect(hoja).toContainText('US$')
    await hoja.locator('button[aria-controls][aria-expanded]').first().tap()
    await expect(page.getByRole('dialog').last()).toContainText('=')
  })

  test('quién paga la cuota: un toque, sin guardar en demo', async ({ page }) => {
    await abrir(page, '/pasivos')
    const pregunta = page.getByRole('region', { name: 'El contrato y quién paga' })
    await pregunta.getByRole('button', { name: 'Vos' }).tap()
    await expect(pregunta.getByRole('status').first()).toContainText('Modo demo')
    await expect(pregunta.getByRole('button', { name: 'Vos' })).toHaveAttribute('aria-pressed', 'true')
  })
})

test('con el modo privado no se lee ningún monto en Pasivos ni en Datos › Leasing', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('portfolio:privado', '1'))
  const rutas = ['/pasivos', '/pasivos?demo=completo', '/pasivos?demo=sin-cuadro', '/datos/leasing?demo=revision', '/datos/leasing?demo=completo']
  const vistos: string[] = []
  for (const ruta of rutas) {
    await abrir(page, ruta)
    await expect(page.locator('html')).toHaveAttribute('data-privado', '1')
    vistos.push(...(await montosALaVista(page)).map((m) => `${ruta} · ${m}`))
  }
  expect(vistos, `Montos que se leen con el modo privado:\n${vistos.join('\n')}`).toEqual([])
})
