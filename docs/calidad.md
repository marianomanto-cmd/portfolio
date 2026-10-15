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

- Playwright a 360, 390, 412, 768, 1280 y 2560 px, en claro y en oscuro (el tema se elige como en Ajustes: el oscuro es el de la app y no depende del sistema, D-157). Falla si hay scroll horizontal (también adentro de una grilla), un elemento fuera del viewport, texto cortado o superpuesto, o un elemento tocable de menos de 44 px.
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

Foto al 14/10/2026, con la 1a desplegada y después de la revisión adversarial de todo su código (D-117 a D-130). **La 1a no está terminada** en el sentido de este documento hasta que los controles pendientes que le corresponden estén en verde. Lo que falta se dice acá y no se disimula.

Números de esta foto: Vitest, 40 archivos y 944 tests; schema, 191 controles; Playwright, 49 tests: 23 de layout (D-30: 9 anchos × 2 temas, las pasadas táctiles a 768 y 1024 px y el chip de datos abierto a 360, 390 y 412 px), 17 de interacción y 9 de la clave. Todos en verde.

| § | Control | Estado | Cómo se verifica hoy |
|---|---|---|---|
| 1 | Tests de cada cálculo de la 1a: PPC en dos monedas, desglose activo/TC, totales, compras pendientes, aperturas | **Hecho** | `npm test`: motor, revisión adversarial del motor (un test por hallazgo), revisión de la 1a desplegada (`tests/unit/fase3-motor.test.ts`, `tests/unit/fase3-integracion.test.ts` y un test junto a cada archivo arreglado, cada uno falla sin su arreglo), Apéndice B al centavo (`src/lib/vistas/ejemplo.test.ts`) |
| 1 | Cálculos de fases futuras (TIR, TEM, valor técnico CER, licuación, excedente, Monte Carlo) | No corresponde todavía | Llegan con su fase |
| 1 | Invariantes con fast-check | **Hecho para la 1a** | `npm test` (`tests/unit/revision-motor.test.ts`, "atribución anclada"): activo + CCL + sin atribuir = resultado por partida y en las dos monedas; un período es la suma exacta de sus días; una carga express entre dos completas no cambia el período; sin atribuir de un período = pendiente al final − pendiente al principio. Historias al azar con cargas completas, medias, express y sin CCL. Los lectores, con miles de archivos al azar. Que revertir deja la base como estaba se prueba en SQL (huella de los hechos igual antes y después), no con fast-check. Monte Carlo, en la fase 3 |
| 1 | Cuadre contra el bróker | **En parte** | B2 y Subtotales cierran con un Excel sintético con la estructura de IEB (`tests/fixtures/ieb.ts`). El Excel real del Día cero se leyó con el lector de la app (D-130). Falta revisar los números de la app contra los que muestra IEB |
| 1 | Implementación de referencia | **En parte** | `tests/referencia/`: motor en Python escrito desde los documentos, con las decisiones de la 1a (D-35 anclado, D-109, D-110 y el desglose desde la compra de la tenencia vigente), y 310 casos cruzados con el de TypeScript (`python3 tests/referencia/motor_referencia.py` y `npm test`). Cubre tenencia, PPC, foto y desglose; no cubre movimientos de capital, bienes ni pasivos |
| 1 | Plata en decimal exacto | **Hecho** | decimal.js en el código; montos leídos con `::text`; el parser y `leer_monto` (SQL) rechazan números JSON, `NaN`, `Infinity` y formatos raros; tests en `escritura.test.ts` y en el schema |
| 1 | "Sin dato", nunca cero | **En parte** | Tests que borran precios, CCL y saldos por posición; una tenencia que la fuente ya no lista (D-117); el total y la deuda sin bienes o sin leasing, y una suma sin ninguna parte conocida (D-126, `tests/unit/fase3-integracion.test.ts`); un precio o un PPP de 0 en IEB (D-123). Falta recorrer cada insumo de cada cálculo, uno por uno |
| 2 | Toda función devuelve `{valor, formula, insumos}` | **Hecho** | Contrato `Calc` (D-67), con etiquetas que se propagan |
| 2 | Un test que recorre las pantallas y falla si encuentra un número sin traza | **Pendiente** | — |
| 2 | La traza llega hasta el archivo | **En parte** | Cada insumo dice su carga y su lugar en la fuente; el archivo está guardado. Falta abrirlo desde la traza |
| 3 | Carga diaria < 60 s, con un test cronometrado | **Pendiente** | La app mide el tiempo activo de cada carga real (D-62) y el Registro lo muestra. Falta el test end-to-end cronometrado |
| 3 | Carga solo con teclado | **En parte** | Probado a mano con Playwright (CCL, Tab, cripto, Enter). Falta dejarlo como test |
| 3 | Respuesta < 200 ms al cambiar un supuesto | No corresponde todavía | Fase 3 |
| 3 | Lighthouse ≥ 90 en mobile | **Pendiente** | — |
| 4 | Layout D-30 en 9 anchos, claro y oscuro | **Hecho** | `npm run test:e2e` (`tests/e2e/layout.spec.ts`): 360 a 2560 px, en claro y en oscuro, todas las pantallas (Cargar y las cinco de Datos incluidas, y todas frenan el test) y la de "no encontrada". Revisa el scroll horizontal; lo que se sale de la pantalla, de su tarjeta o de un botón; texto cortado y controles superpuestos; que ninguna grilla (AG Grid, D-157) tenga scroll horizontal adentro ni columnas fuera de su ancho; un h1 por pantalla; tocables de 44 px con puntero grueso, debajo de 768 px y también a 768 y 1024 px con el dedo; errores de JavaScript. Abre el chip de datos a 360, 390 y 412 px. Corre contra el modo demo. 14/10: los 49 tests de Playwright en verde contra el build de producción |
| 4 | Accesibilidad | **Hecho** | axe-core dentro del test de layout, sin violaciones serias ni críticas; contraste AA también con la paleta daltónica. El contraste no textual (WCAG 1.4.11) del interruptor de Modo privado lo controla un test unitario (`src/components/ajustes/formulario.test.ts`), porque axe no tiene esa regla. El nivel es WCAG 2.1 AA: el tamaño mínimo de 24 px de WCAG 2.2 no se aplica a la tabla de Cartera (D-100, D-128) |
| 4 | Modo privado | **Hecho** | `tests/e2e/interaccion.spec.ts`: ningún monto a la vista sin desenfocar en ninguna pantalla, con el ejemplo cargado en Cargar y todo desplegado |
| 4 | La clave, como en producción | **Hecho** | `tests/e2e/auth.spec.ts` (proyecto `auth`, sin modo demo): sin sesión no se ve nada, un POST de otro sitio recibe 403, la clave funciona, el freno a los intentos, la CSP y los encabezados. El freno en paralelo lo prueba `src/app/login/acciones.test.ts`: una ráfaga de 50 pedidos prueba 3 claves |
| 4 | Inspección visual contra el deploy real | **Pendiente** | Capturas de Chromium del modo demo revisadas; falta hacerlo contra producción |
| 5 | TypeScript `strict` | **Hecho** | `npm run typecheck` |
| 5 | Lint y formato | **Pendiente** | No hay linter configurado |
| 5 | CI en GitHub Actions | **En parte** | `.github/workflows/ci.yml`, en cada pull request y en `main`: tipos, tests unitarios (con la referencia), build de producción y tests del schema en un Postgres 17. Faltan los tests de Playwright (layout y entrada) y el lint en CI, y la protección de `main` para que nada entre con CI en rojo |
| 5 | Revisión adversarial | **Hecho para la 1a** | Del schema (D-34), del motor (`tests/unit/revision-motor.test.ts`) y, después del primer despliegue, de todo el código: carga, motor, pantallas, seguridad y documentación, con un verificador por hallazgo. Los arreglos (14/10) llevan un test cada uno, que falla sin el arreglo, y las decisiones van de D-117 a D-130 |
| 5 | Nunca una pantalla en blanco; errores registrados | **En parte** | Pantallas de error con el mensaje o, en producción, con una referencia al log de Vercel, sin prometer que nada se guardó ("Si estabas guardando algo, no sé si se guardó"); una dirección que no existe muestra "No encontré esa página" dentro del marco; "Falta configurar …" cuando falta una variable. Falta un registro propio con contexto (qué carga, qué cuenta) |
| 5 | Datos reales fuera de git (D-24) | **En parte** | Barrido de las cifras de los archivos reales del dueño contra `src`, `tests`, `docs` y `supabase` (14/10): limpio; solo quedan cotizaciones públicas en `investigacion-vida.md` y pedazos de números al azar en `tests/referencia/casos.json`. Antes de esta revisión hubo cifras reales en commits del repo público, que siguen en el historial: lo decide el dueño (D-24). Falta el control automático antes de cada push y en CI |
| 5 | Toda acción del servidor pide sesión | **Hecho** | Test estático en `src/lib/server/sesion.test.ts`: falla si una Server Action o un Route Handler no llama a `exigirSesion` |
| 6 | Respaldo nocturno fuera de Supabase, restaurado | **Pendiente** | Hasta que exista, la base depende de los respaldos de Supabase, que según el plan pueden no existir (D-55, D-58) |
| 6 | Exportación completa en CSV | **Pendiente** | — |
| 6 | La base se reconstruye de cero | **Hecho** | `npm run test:schema`: aplica las 12 migraciones en un Postgres vacío y corre 191 controles (14/10). Corre también en CI |
| 6 | Dependencias en versiones exactas | **Hecho** | `package.json` sin rangos |
| 7 | Validación con tus datos reales | **En parte** | Tu Día cero se cargó el 14/10 desde la base, con las funciones de la app (D-130): el Excel real de IEB pasó por el lector de la app; las capturas se transcribieron, así que la lectura de capturas con la API sigue sin probarse con una imagen real. Falta tu primera carga desde Cargar y revisar los números de la app contra IEB, Galicia y Mercado Pago |

**Criterio de salida de la 1a que propone `docs/vision.md` §5** (además de esta tabla): 10 cargas reales completas, las 10 por debajo de 60 s de tiempo activo; las últimas 3 noches con el respaldo restaurado y verificado; tus números revisados contra IEB, Galicia y Mercado Pago, con cada diferencia de criterio con nombre y monto. Ninguno se cumple todavía: la única carga real es el Día cero, hecha desde la base y no desde Cargar (D-130).
