# Calidad: definición de terminado

El dueño pidió una calidad sin concesiones. Este documento la traduce en controles concretos. **Una fase no está terminada, ni se despliega, hasta que pasa todos los que le corresponden.** Si un control no se puede cumplir, se dice explícitamente y no se despliega como si estuviera bien.

## 1. Los números tienen que ser correctos

| Control | Qué verifica | Cómo |
|---|---|---|
| Tests unitarios de cada cálculo | PPC en dos monedas, desglose activo/TC, TIR, TEM, valor técnico CER, capital pendiente del leasing, licuación, excedente, Monte Carlo | Vitest con casos calculados a mano, incluidos los bordes (venta total, ratio que cambia, apertura sin CCL, dato faltante) |
| Invariantes (tests de propiedades) | Activo + TC = variación total, **exacto** · la suma de las posiciones da el total · revertir una carga deja la base igual a como estaba · la misma semilla da el mismo Monte Carlo | fast-check: miles de casos generados al azar |
| Cuadre contra el bróker | Lo que calcula la app para valorizado y resultado en pesos coincide con lo que dice IEB, al centavo | Test con la estructura del Excel de IEB (fixture con números inventados) y chequeo en vivo en cada carga: si no cuadra, la pantalla lo muestra |
| Implementación de referencia | TIR, TEM y Monte Carlo coinciden con una implementación independiente | Script de referencia en Python (numpy/scipy), comparado contra la de TypeScript |
| Plata en decimal exacto | Ningún monto pasa por `float` en la contabilidad | decimal.js de punta a punta. Los `numeric` de Postgres viajan como texto y nunca como número JSON |
| "Sin dato", nunca cero | Un dato faltante no se convierte en 0 en ningún cálculo ni pantalla | Tests que borran cada insumo, uno por uno, y verifican que el resultado sea "sin dato" |

## 2. Cada número se puede explicar

- Toda función de cálculo devuelve `{ valor, formula, insumos }`. Un test recorre las pantallas y falla si encuentra un número sin traza.
- La traza llega hasta el origen: número → fórmula → insumos → carga → archivo (D-17).

## 3. Se usa fácil y rápido

| Control | Umbral |
|---|---|
| Carga diaria completa (CCL, cripto, Excel y dos capturas) | **< 60 s**, medido con un test end-to-end cronometrado |
| Carga solo con teclado | Tab y Enter alcanzan, sin tocar el mouse |
| Respuesta al cambiar un supuesto | El gráfico se actualiza en < 200 ms |
| Primera carga de página | Lighthouse Performance ≥ 90 en mobile |

## 4. Se ve bien en cualquier pantalla (D-30)

- Playwright a 360, 390, 412, 768, 1280 y 2560 px, en claro y en oscuro. Falla si hay scroll horizontal, un elemento fuera del viewport, texto cortado o superpuesto, o un elemento tocable de menos de 44 px.
- Inspección visual: capturas de cada pantalla en Chromium (teléfono y desktop) contra el deploy real, revisadas antes de cerrar la fase.
- Accesibilidad: axe-core sin violaciones serias. Contraste AA. Positivo y negativo por color **y** por signo.

## 5. No se rompe

- TypeScript `strict`, lint y formato sin errores.
- CI en GitHub Actions: tipos, lint, tests unitarios, de propiedades, end-to-end y de layout. **Nada se mergea a `main` con CI en rojo.**
- Revisión adversarial del código de cada fase (varios revisores independientes que buscan errores y un verificador que intenta refutarlos) antes del merge.
- Errores del servidor registrados con contexto. La app nunca muestra una pantalla en blanco: si algo falla, dice qué.

## 6. Dura años

- Respaldo automático de la base fuera de Supabase, programado. **Un respaldo solo cuenta si se probó restaurarlo**, y la restauración se prueba.
- Exportación completa de los datos en formato abierto (CSV y texto plano), sin depender de la app.
- Migraciones versionadas: la base se reconstruye de cero, y eso se prueba en CI.
- Dependencias fijadas a versiones exactas y actualizadas a propósito, nunca por accidente.

## 7. Se valida con datos reales

Al cerrar cada fase, el dueño carga sus datos reales y se comparan los números con lo que muestran IEB, Galicia y Mercado Pago. Una diferencia sin explicar es un bug, aunque todos los tests pasen.
