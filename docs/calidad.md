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

## Estado de la 1a

Foto al 08/10/2026, con la 1a construida y antes de su primer despliegue. **La 1a no está terminada** en el sentido de este documento hasta que los controles pendientes que le corresponden estén en verde. Lo que falta se dice acá y no se disimula.

| § | Control | Estado | Cómo se verifica hoy |
|---|---|---|---|
| 1 | Tests de cada cálculo de la 1a: PPC en dos monedas, desglose activo/TC, totales, compras pendientes, aperturas | **Hecho** | `npm test`: motor, revisión adversarial del motor (un test por hallazgo), Apéndice B al centavo (`src/lib/vistas/ejemplo.test.ts`) |
| 1 | Cálculos de fases futuras (TIR, TEM, valor técnico CER, licuación, excedente, Monte Carlo) | No corresponde todavía | Llegan con su fase |
| 1 | Invariantes con fast-check | **Hecho para la 1a** | `npm test` (`tests/unit/revision-motor.test.ts`, "atribución anclada"): activo + CCL + sin atribuir = resultado por partida y en las dos monedas; un período es la suma exacta de sus días; una carga express entre dos completas no cambia el período; sin atribuir de un período = pendiente al final − pendiente al principio. Historias al azar con cargas completas, medias, express y sin CCL. Los lectores, con miles de archivos al azar. Que revertir deja la base como estaba se prueba en SQL (huella de los hechos igual antes y después), no con fast-check. Monte Carlo, en la fase 3 |
| 1 | Cuadre contra el bróker | **En parte** | B2 y Subtotales cierran con un Excel sintético con la estructura de IEB (`tests/fixtures/ieb.ts`). **Falta el Excel real** |
| 1 | Implementación de referencia | **En parte** | `tests/referencia/`: motor en Python escrito desde los documentos, con las decisiones de la 1a (D-35 anclado, D-109, D-110 y el desglose desde la compra), y 310 casos cruzados con el de TypeScript (`python3 tests/referencia/motor_referencia.py` y `npm test`). Cubre tenencia, PPC, foto y desglose; no cubre movimientos de capital, bienes ni pasivos |
| 1 | Plata en decimal exacto | **Hecho** | decimal.js en el código; montos leídos con `::text`; el parser y `leer_monto` (SQL) rechazan números JSON, `NaN`, `Infinity` y formatos raros; tests en `escritura.test.ts` y en el schema |
| 1 | "Sin dato", nunca cero | **En parte** | Tests que borran precios, CCL y saldos por posición. Falta recorrer cada insumo de cada cálculo, uno por uno |
| 2 | Toda función devuelve `{valor, formula, insumos}` | **Hecho** | Contrato `Calc` (D-67), con etiquetas que se propagan |
| 2 | Un test que recorre las pantallas y falla si encuentra un número sin traza | **Pendiente** | — |
| 2 | La traza llega hasta el archivo | **En parte** | Cada insumo dice su carga y su lugar en la fuente; el archivo está guardado. Falta abrirlo desde la traza |
| 3 | Carga diaria < 60 s, con un test cronometrado | **Pendiente** | La app mide el tiempo activo de cada carga real (D-62) y el Registro lo muestra. Falta el test end-to-end cronometrado |
| 3 | Carga solo con teclado | **En parte** | Probado a mano con Playwright (CCL, Tab, cripto, Enter). Falta dejarlo como test |
| 3 | Respuesta < 200 ms al cambiar un supuesto | No corresponde todavía | Fase 3 |
| 3 | Lighthouse ≥ 90 en mobile | **Pendiente** | — |
| 4 | Layout D-30 en 9 anchos, claro y oscuro | **En parte** | `npm run test:e2e` (`tests/e2e/layout.spec.ts`): 360 a 2560 px, scroll horizontal, desbordes, texto cortado, superposiciones, tocables de 44 px con puntero grueso, errores de JavaScript. Corre contra el modo demo. En Cargar y Datos los problemas todavía se anotan sin frenar el test, y las subpantallas de Datos no se recorren todas |
| 4 | Accesibilidad | **Hecho** | axe-core dentro del test de layout, sin violaciones serias ni críticas; contraste AA también con la paleta daltónica |
| 4 | La clave, como en producción | **Hecho** | `tests/e2e/auth.spec.ts` (proyecto `auth`, sin modo demo): sin sesión no se ve nada, un POST de otro sitio recibe 403, la clave funciona, el freno a los intentos, la CSP y los encabezados |
| 4 | Inspección visual contra el deploy real | **Pendiente** | Capturas de Chromium del modo demo revisadas; falta hacerlo contra producción |
| 5 | TypeScript `strict` | **Hecho** | `npm run typecheck` |
| 5 | Lint y formato | **Pendiente** | No hay linter configurado |
| 5 | CI en GitHub Actions | **En parte** | `.github/workflows/ci.yml`, en cada pull request y en `main`: tipos, tests unitarios (con la referencia), build de producción y tests del schema en un Postgres 17. Faltan los tests de Playwright (layout y entrada) y el lint en CI, y la protección de `main` para que nada entre con CI en rojo |
| 5 | Revisión adversarial | **En parte** | Del schema (D-34) y del motor (`tests/unit/revision-motor.test.ts`). Falta la del código completo de la fase |
| 5 | Nunca una pantalla en blanco; errores registrados | **En parte** | Pantallas de error con el mensaje o, en producción, con una referencia al log de Vercel; "Falta configurar …" cuando falta una variable. Falta un registro propio con contexto (qué carga, qué cuenta) |
| 5 | Toda acción del servidor pide sesión | **Hecho** | Test estático en `src/lib/server/sesion.test.ts`: falla si una Server Action o un Route Handler no llama a `exigirSesion` |
| 6 | Respaldo nocturno fuera de Supabase, restaurado | **Pendiente** | Hasta que exista, la base depende de los respaldos de Supabase, que según el plan pueden no existir (D-55, D-58) |
| 6 | Exportación completa en CSV | **Pendiente** | — |
| 6 | La base se reconstruye de cero | **Hecho** | `npm run test:schema`: aplica todas las migraciones en un Postgres vacío y corre 143 controles. Corre también en CI |
| 6 | Dependencias en versiones exactas | **Hecho** | `package.json` sin rangos |
| 7 | Validación con tus datos reales | **Pendiente** | Tu primera carga real. Los lectores se probaron solo con archivos sintéticos; la lectura de capturas, solo con un cliente simulado: la primera lectura real con la API ocurre en producción |

**Criterio de salida de la 1a que propone `docs/vision.md` §5** (además de esta tabla): 10 cargas reales completas, las 10 por debajo de 60 s de tiempo activo; las últimas 3 noches con el respaldo restaurado y verificado; tus números revisados contra IEB, Galicia y Mercado Pago, con cada diferencia de criterio con nombre y monto. Ninguno se cumple todavía: la 1a no tuvo cargas reales.
