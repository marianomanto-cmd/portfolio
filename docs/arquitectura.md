# Arquitectura

Mapa para quien mantenga la app: dónde está cada cosa, por dónde viajan los datos, qué invariantes no se pueden romper y cómo se prueba. Describe la **fase 1a** (octubre de 2026). El qué y el porqué están en `docs/spec.md` (manda), `docs/decisiones.md` y `docs/vision.md`. El uso, en `docs/manual.md`.

## 1. En una página

- **Next.js 16** (App Router) en **Vercel**, región `gru1` (São Paulo), con TypeScript `strict`. Un solo entorno: producción, desde `main`.
- **Supabase** (Postgres), proyecto Portfolio (`zcgynhzddfjzwswekcvl`, sa-east-1). **Cerrada al navegador:** solo el servidor la toca, con la clave secreta (D-20).
- **Un solo usuario**, una clave (D-21, D-112).
- **Hechos, no estado:** la base guarda lo que pasó (operaciones, precios, tipos de cambio, saldos, valuaciones) y el **motor**, en funciones puras de TypeScript, calcula todo lo demás en cada pedido (D-22, D-23).
- **Montos exactos de punta a punta:** `numeric` en Postgres, texto en el viaje, `Decimal` en el código (D-32).
- **Cada cifra trae su traza:** valor, fórmula, insumos, explicación y etiquetas (D-67).
- **Lectores:** el Excel de IEB lo lee un parser determinístico (exceljs); las capturas, Claude (SDK de Anthropic) con dos lecturas y verificación aritmética.

## 2. Carpetas

| Ruta | Qué hay | Área |
|---|---|---|
| `src/proxy.ts` | Primera barrera de la sesión, CSP con nonce y control de origen (D-112) | Infraestructura y seguridad |
| `src/app/login/` | Entrada: formulario, acciones (`entrar`, `salir`), rutas públicas, freno a los intentos, encabezados | Infraestructura y seguridad |
| `src/app/layout.tsx`, `src/app/globals.css`, `src/app/fuentes.ts` | Layout raíz (idioma, fuentes, tema antes de pintar: oscuro por defecto) y tokens de diseño (D-157). Las fuentes (Newsreader, Geist, JetBrains Mono) vienen de paquetes y se sirven con `next/font/local` | Infraestructura y seguridad |
| `src/app/(app)/layout.tsx` | El shell: barra lateral, barra superior, barra inferior (usa el marco de `src/components/shell/marco.tsx` y le suma el chip de datos) | Infraestructura y seguridad |
| `src/app/not-found.tsx` | La página de "no encontrada" (404), en español y dentro del marco de la app, sin leer la base | Motor y vistas |
| `src/app/(app)/page.tsx`, `cartera/`, `exposicion/`, `registro/` | Pantallas de lectura: Hoy, Posiciones (`/cartera`), Exposición, Registro (con su acción de revertir; la tabla es una Grilla, con los lotes armados en `registro/_lib/lotes.ts`) | Motor y vistas |
| `src/app/(app)/mapa/` | El Mapa de la app (D-156): sale de `components/shell/secciones.ts` | Infraestructura y seguridad |
| `src/app/(app)/carga/` | Cargar: `page.tsx`, `acciones.ts` (proponer, guardar, deshacer, alta de activo), `leer/route.ts` (lectura de archivos), `_lib/` (lógica pura con tests), `_componentes/` | Carga |
| `src/app/(app)/datos/` | Datos: catálogo, cuentas, bienes, leasing y movimientos, con sus acciones | Carga |
| `src/app/(app)/patrimonio/` | Balance (entrega 4; desde el rediseño, `/patrimonio` redirige a `/exposicion` en `next.config.mjs` y su contenido pasa a Exposición, D-156): `page.tsx` (server component), `impresion.css` (la hoja A4: solo vale con el balance en pantalla, `:has([data-imprimible='balance'])`), `_componentes/` (tarjetas, estado de situación —tabla desde 768 px, tarjetas plegables debajo—, indicadores, comparativo, composición, evolución, controles con la hoja inferior, imprimir) y `_lib/` (opciones del gráfico, frase y rutas; puras y con test) | Balance |
| `src/app/(app)/evolucion/` | Evolución y PnL (entrega 4): `_lib/` (parámetros de la URL y lo recordado, opciones de ECharts, orden) y `_componentes/` (server components salvo los gráficos, la tabla de resultados, el selector del período y lo recordado). Las tablas densas eligen tabla o tarjetas por el ancho de su tarjeta (container queries) | Evolución y PnL |
| `src/app/(app)/pasivos/` | Pasivos (entrega 4): el leasing cuota por cuota (frase, tarjetas, deuda con su origen, tasa, apertura, cuadro, totales, recupero fiscal), con `acciones.ts` (quién paga, reintegro del IVA) y `_lib/graficos.ts` (opciones de ECharts, puras) | Pasivos |
| `src/app/(app)/datos/leasing/acciones.ts`, `datos/_componentes/cuadro-marcha.tsx`, `datos/_lib/{esquemas,servidor}-leasing.ts` | Importar el cuadro de marcha (revisión, Enter, Deshacer), completar el pago de una cuota, cargos extra, fecha de desembolso | Pasivos |
| `src/app/(app)/flujo/` | Flujo y escenarios (`/flujo`) y Cargar ingreso / Cargar gasto (`/flujo/cargar`), con sus acciones | Flujo |
| `src/app/(app)/ajustes/` | Ajustes | Infraestructura y seguridad |
| `src/components/` | Componentes compartidos: `monto.tsx` (toda cifra), `traza.tsx` (la placa de vidrio "¿de dónde sale?"), `ui.tsx` (Tarjeta, Rotulo, Boton, Badge, Chip, ParMonto, Aviso), `calculos.ts` (cálculos de presentación con traza), Cartera, Hoy, Registro | Motor y vistas |
| `src/components/pantalla/` | La anatomía de pantalla (D-157): `Encabezado` (la pregunta y la lectura en serif), `CifraClave` y su grilla, y `lectura.ts` (las partes de la lectura y su validación, puro y con test) | Motor y vistas |
| `src/components/grilla/` | La única forma de dibujar una tabla de datos (D-157): `Grilla` sobre AG Grid Community 36.2.0, con su tema (`tema.ts`, de los tokens), sus módulos (`modulos.ts`, solo los que se usan) y lo puro con test (`orden.ts`: orden exacto de montos en texto; `columnas.ts`: qué columnas entran y el alto) | Motor y vistas |
| `src/components/graficos/` | El único envoltorio de ECharts (`grafico.tsx`: por partes, SVG, alto fijo, tabla accesible y "Ver como tabla") y su tema puro con test (`tema.ts`: sin tortas, colores de los tokens resueltos al dibujar con `colorTema`, grilla hairline, ejes en mono, tooltip de vidrio y adentro, sin zoom ni scroll horizontal, leyenda abajo en el teléfono) | Motor y vistas |
| `src/components/escenarios/` | El panel de supuestos (Baja · Igual · Sube, deslizantes, tramos "desde el mes N", traza a pedido), que usan Flujo y Evolución | Flujo |
| `src/components/shell/`, `src/components/ajustes/` | El marco (barra lateral, barra superior con el ojo y Cargar, barra inferior; sin leer la base), la navegación por pregunta (`secciones.ts`, con test: D-156), el chip de estado de datos (`estado.ts`, puro y con test), preferencias | Infraestructura y seguridad |
| `src/lib/domain/` | **El motor:** tipos, fechas, posiciones, foto, variación, traza, el color de cada activo (`colores.ts`, D-157). `dinero.ts` (Decimal y números es-AR) es de Carga. Desde la entrega 4: `balance.ts` (el perímetro del patrimonio y el balance a una fecha), `resultados.ts` (puente, realizado y no realizado, PnL por mes, serie y capital aportado, día cero, sensibilidad, estado de resultados), `pasivos/` (cuadro de marcha, apertura de cada cuota, deuda según el cuadro, recupero fiscal, licuación, y la tasa del contrato en `tir.ts`) y `flujo/` (proyección y escenarios: puro e isomórfico, corre en el servidor y en el navegador) | Motor y vistas |
| `src/lib/vistas/` | Arma lo que recibe cada pantalla: `contratos.ts`, `armar.ts` (puro), `index.ts` (lee la base o el demo), `ejemplo.ts` (datos de ejemplo). Desde la entrega 4, lo mismo por pantalla (`{contratos,armar,ejemplo}-{balance,evolucion,pasivos,flujo}.ts` y `balance.ts`, `evolucion.ts`, `pasivos.ts`, `flujo.ts`), más `integracion-pasivos.ts` (lo que Pasivos le da a las otras pantallas: la deuda según el cuadro, lo que falta pagar, la amortización de cada cuota, la cuota que vence), `hechos-vista.ts` (los hechos de las pantallas, con la deuda según el cuadro) y `contexto-hoy.ts` (el excedente del mes y Atención de Flujo y Pasivos para Hoy) | Motor y vistas |
| `src/lib/carga/` | Lectores (`ieb.ts`, `captura.ts`, `captura-verificacion.ts`), conciliación (`conciliar.ts`), las tenencias ausentes vigentes (`ausentes.ts`, D-117) y contratos de la carga (`contratos.ts`). Desde la entrega 4, el lector del CSV del cuadro de marcha (`cuadro-marcha.ts`, `cuadro-marcha-csv@1`) y su revisión | Carga |
| `src/lib/server/` | Lo que solo corre en el servidor: `supabase.ts` (único cliente de la base), `hechos.ts` (lee los hechos), `escritura.ts` (toda escritura), `sesion.ts` (clave y cookie). Desde la entrega 4: `hechos-pasivos.ts` y `escritura-pasivos.ts` (el cuadro de marcha, sus cargos y el contrato), `hechos-flujo.ts` y `escritura-flujo.ts` (ingresos y gastos declarados y reales, escenarios, valores recordados, flujos de bonos) | Carga (`escritura*.ts`); Infraestructura (`sesion.ts`, `supabase.ts`) |
| `src/lib/database.types.ts` | Tipos generados del schema. No se editan a mano | — |
| `supabase/migrations/` | El schema, en migraciones versionadas. La base se reconstruye de cero aplicándolas en orden | Carga |
| `supabase/tests/` | Tests del schema contra un Postgres local (`run.sh`) | Carga |
| `tests/unit/` | Tests del motor ajenos a un archivo: la revisión adversarial del motor (`revision-motor.test.ts`), la de la 1a desplegada (`fase3-motor.test.ts`) y los cruces entre carga, motor y pantallas (`fase3-integracion.test.ts`) | Motor y vistas |
| `tests/referencia/` | Implementación de referencia en Python y su cruce con el motor | Motor y vistas |
| `tests/fixtures/` | Archivos sintéticos con números inventados (el Excel de IEB) | Carga |
| `tests/e2e/` | Playwright: layout (D-30), interacción y entrada; desde la entrega 4, una spec por pantalla nueva (`balance`, `evolucion`, `pasivos`, `flujo`) y sus rutas para el layout (`pantallas/`) | Infraestructura y seguridad |
| `.github/workflows/ci.yml` | CI: tipos, tests, build y schema en cada pull request | Infraestructura y seguridad |
| `docs/` | Documentación (`spec.md` manda) | Documentación |

Regla del repo (`CLAUDE.md`): todo cambio de comportamiento, schema o UI actualiza en el mismo commit `CHANGELOG.md`, `docs/decisiones.md` si se decidió algo, y el documento de la sección afectada.

## 3. Por dónde viajan los datos

```
 FUENTES               LECTORES                  PROPUESTA            BANDEJA                 BASE
 Excel de IEB ──┐
 Captura Galicia ├─▶ POST /carga/leer ──────▶ proponerCarga() ──▶ estados y elecciones ──▶ guardar() ──▶ confirmar_carga()
 Captura MP ─────┘   leerExcelIEB()           (conciliar.ts)       (bandeja.ts)             (acciones)     en una transacción
 CCL y cripto ─────────────────────────────────────────────────────────────────────────────┘                    │
 Formularios de Datos ──▶ acciones de Datos ──▶ guardar_manual(), alta_activo(), editar_activo() ───────────────┤
                                                                                                                 ▼
 PANTALLAS ◀── VISTAS ◀─────────────── MOTOR ◀──────────────────────── HECHOS ◀──────────────────────────── tablas
 Hoy, Cartera,  armarHoy(), armarCartera(),  tenencias(), foto(),        leerHechos()                   operaciones, cotizaciones,
 Exposición,    armarExposicion()            variacion(), parteCalc()    (::text → Decimal)             saldos, tipo_cambio, …
 Registro       (lib/vistas)                 (lib/domain)                (lib/server/hechos.ts)
```

1. **Fuentes.** El Excel "Portafolio" de IEB, capturas de Galicia y de Mercado Pago, el CCL y el cripto tipeados, y los formularios de Datos.
2. **Lectores.** Cada archivo viaja solo a `POST /carga/leer` (D-105). La ruta verifica la sesión, lee (`leerExcelIEB` o `leerCaptura`) y, **en paralelo**, sube el archivo al bucket privado `cargas` (`subirArchivo`, nombrado por su sha256). Devuelve una `LecturaCuenta` **firmada** con HMAC.
3. **Propuesta.** `proponerCarga(lecturas, hechos, fecha, { ccl })` compara lo leído con lo que la app deriva de sus operaciones (D-15). Para cada fila decide una acción: `ninguna`, `apertura` (D-14), `compra` (D-15, D-19), `venta`, `completar_precio` (D-110) o `revisar`. Cada saldo trae su valor anterior; cada cuenta, sus controles; y la propuesta lista las posiciones que la fuente no trae (`ausentes`, con la venta o el vencimiento para registrar, D-117) y el CCL del día (`cclDelDia`: el tipeado o el que ese día ya tiene cargado, nunca el de otro día, D-119).
4. **Bandeja.** `carga/_lib/bandeja.ts`, puro y con tests: el estado de cada ítem (verificada, aceptada, advertencia, sin alta, error, pendiente), el contador, el texto del botón y las elecciones del dueño. Cada elección lleva la huella de la propuesta sobre la que se hizo (D-106).
5. **Confirmación.** La acción `guardar` verifica la firma de cada lectura, **vuelve a armar la propuesta contra la base** y arma la `ConfirmacionCarga` (`_lib/confirmacion.ts`). `confirmarCarga()` (`escritura.ts`) la valida y llama a la función `confirmar_carga` de Postgres, que graba el lote entero o nada (D-104).
6. **Hechos.** `leerHechos()` (envuelta en `cache()` de React: una sola lectura por pedido, aunque la pidan el shell y la página) lee todas las tablas de hechos paginando (PostgREST corta en 1.000 filas sin avisar), con los montos como texto (`::text`), y los convierte a `Decimal` para el motor. Ningún monto pasa por un `number` de JavaScript. De cada carga lee también `listado_completo` y solo `grabado->ausentes` (un camino JSON, no el grabado entero). `ausentesVigentes` (`src/lib/carga/ausentes.ts`, pura) arma `Hechos.ausentes`: por cuenta, las ausentes de la última carga vigente cuya resolución no es `'registrada'`, con la fecha y la carga del comienzo de su racha (D-117).
7. **Motor.** Funciones puras sobre `Hechos` (sección 4).
8. **Vistas.** `armarHoy`, `armarCartera` y `armarExposicion` (`src/lib/vistas/armar.ts`, puras) arman los modelos de `src/lib/vistas/contratos.ts`: serializables, con cada cifra como `CalcVista`. `src/lib/vistas/index.ts` las llama con los hechos de la base o, en modo demo, con los de `ejemplo.ts`.
9. **Las pantallas de la entrega 4.** `leerHechosVista()` (`src/lib/vistas/hechos-vista.ts`) son los hechos de la base con la deuda según el cuadro de marcha de Pasivos (`conDeudaSegunCuadro`): así el motor, el Balance, Pasivos y Flujo restan una sola deuda, en el mismo orden (informada › según el cuadro › estimada, D-131). Cargar y Datos siguen con `leerHechos()`.
   - **Balance:** `vistaBalance()` = `armarBalance(hechos, hoy, pedido, extras de Pasivos)` (la deuda según el cuadro y lo que falta pagar, por pasivo y fecha). En demo, `ejemploBalance(?demo=…)`.
   - **Evolución y PnL:** `vistaEvolucion()` = `armarEvolucion(hechos, hoy, período, leerEntradas())`; `leerEntradas` junta las cuotas que pagás vos con su apertura (Pasivos), lo cargado con Cargar ingreso, lo declarado y el escenario elegido o el último guardado (Flujo).
   - **Pasivos:** `CSV del cuadro de marcha ──▶ revisarPlanilla() (leerCuadroMarcha + revisarCuadro) ──▶ Enter ──▶ guardarPlanilla() (vuelve a leer el texto) ──▶ guardar_cuadro_marcha()`; `leerPasivos()` (`hechos-pasivos.ts`, con `cache()`) al lado de `leerHechos()`.
   - **Flujo:** `leerHechosVista() + leerFlujo() ──▶ armarFlujo() ──▶ VistaFlujo (con la base serializada) ──▶ navegador: proyectar(base, supuestos) a cada movimiento ──▶ trazaMes() al tocar una cifra`. Los supuestos viven en la dirección (`?s=`, base64url del JSON validado con zod); guardar un escenario guarda solo los supuestos. Cargar ingreso: `guardar_flujo_real()` graba la fila, su carga y el aporte o el retiro en una transacción.
   - **Hoy:** `contextoHoy()` (`src/lib/vistas/contexto-hoy.ts`) suma el excedente del mes (`resumenParaHoy(vistaFlujo())`) y Atención de Flujo (vencimientos) y de Pasivos (la cuota que vence en 10 días o ya venció). Si Flujo o Pasivos no se pueden leer, Hoy sigue y el excedente dice por qué es "sin dato".
10. **Pantallas.** Server components que solo muestran. Toda cifra pasa por `<Monto>`, que abre `<Traza>`. **Nunca se calcula en el JSX**: un cálculo de presentación (redondeo por resto mayor, suma de una columna filtrada) va en `src/components/calculos.ts`, con traza y test.

## 4. El motor

### Funciones principales

| Función | Archivo | Qué hace |
|---|---|---|
| `tenencias(ops, hasta)` | `posiciones.ts` | Cantidad y costo (ARS y USD) de cada cuenta y activo, derivados de las operaciones hasta una fecha. Apertura, compra, venta, vencimiento, renta, amortización y ajuste de ratio |
| `ppcCalc`, `costoCalc`, `cantidadCalc` | `posiciones.ts` | PPC, costo y cantidad con traza, en cada moneda |
| `foto(h, fecha)` | `foto.ts` | Valuación de todo a una fecha: posiciones, saldos, bienes y pasivos, en ARS y USD, con el precio y el CCL que correspondan y sus etiquetas. Una tenencia de `Hechos.ausentes` vale "sin dato" desde la fecha de su ausencia, con el motivo y la carga que la declaró en la traza (D-117) |
| `cclA(ix, fecha)` | `foto.ts` | El CCL para valuar a una fecha: el último tipeado hasta ese día, con su fecha (D-109) |
| `sumaCalc`, `financieros` | `foto.ts` | Totales con la regla "sin dato" + suma parcial (D-65); sin ninguna parte conocida, "sin dato" sin suma parcial ni etiqueta `parcial` (D-126). Las partidas del patrimonio financiero (D-03) |
| `variacion(h, d0, d1)` | `variacion.ts` | El cambio entre dos fechas, partida por partida, con sus flujos (compras, ventas, cobros, aportes, aperturas) y su desglose en activo, CCL y sin atribuir (D-35) |
| `parteCalc`, `porcentajeCalc` | `variacion.ts` | Una parte del desglose (o un porcentaje) sumada sobre una vista (financiero o total), con traza |
| `cuadre(v, h)` | `variacion.ts` | El control de D-66: patrimonio financiero de hoy recalculado desde los hechos, menos el de la carga anterior, menos los flujos externos, contra la suma de activo + CCL + sin atribuir. Devuelve la `diferencia` en ARS y USD como `Calc`, con los cuatro insumos; "no verificable" nombra la partida que falta. Nombra la plata que entró o salió de la app por una cuenta sin saldo cargado (D-125). Puede fallar, y tiene un test que lo hace fallar a propósito |
| `desgloseDesdeCompra(h, clave, hasta)` | `variacion.ts` | El desglose de la tenencia vigente desde su compra: los tramos anteriores a la primera carga (al CCL de compra) más la suma de los intervalos entre observaciones frescas, escalada en cada venta o vencimiento por cantidad después ÷ cantidad antes (D-35). Lo usa Cartera |
| `esHabil`, `esViejo`, `hoyCordoba` | `fechas.ts` | Días hábiles con la tabla `feriados` (mercado `AR`: los días sin rueda en BYMA, D-129), "viejo" a los 2 días hábiles (D-16) y fechas en hora de Córdoba |
| `dec`, `leerNumeroAR`, `monto` | `dinero.ts` | `Decimal` desde texto (rechaza números de JavaScript), números escritos en es-AR, formato de montos |
| `proponerCarga` | `src/lib/carga/conciliar.ts` | La propuesta de la bandeja (sección 3) |
| `armarHoy`, `armarCartera`, `armarExposicion` | `src/lib/vistas/armar.ts` | Lo que muestra cada pantalla |
| `deudaVigente`, `participacion`, `patrimonioNeto`, `liquidezDe`, `composicion`, `indicadores`, `serieBalance` | `balance.ts` | El perímetro del patrimonio y el balance a una fecha (D-131 a D-134). `ExtrasBalance` es la costura con Pasivos: la deuda según el cuadro de marcha y lo que falta pagar, por `pasivo_id` y fecha |
| `armarBalance`, `titularBalance` | `src/lib/vistas/armar-balance.ts` | La vista del Balance y la cifra grande |
| puente, realizado y no realizado, PnL por mes, estado de resultados | `resultados.ts` | Evolución y PnL (D-135 a D-138), con un cruce contra una referencia en Python (`tests/referencia/realizado_referencia.py`) |
| `capitalSegunCuadro`, `aperturasCuotas`, `resumenLeasing`, `recuperoFiscal`, `licuacionDeuda` | `pasivos/cuadro.ts` | La deuda según el cuadro de marcha (valor presente de los cánones netos que faltan y la opción, a la tasa del contrato), cada cuota abierta (solo la amortización baja la deuda), lo que falta pagar, el IVA computable y la licuación |
| `tirContrato` | `pasivos/tir.ts` | La TEA implícita del contrato (D-143), en Decimal, contrastada con `tests/referencia/tir_referencia.py` |
| `conDeudaSegunCuadro` | `src/lib/vistas/integracion-pasivos.ts` | Los hechos con `deuda_segun_cuadro`: el motor la usa en lugar de una deuda estimada (D-131) |
| `proyectar`, `trazaMes` | `flujo/proyeccion.ts` | La proyección de un escenario sin trazas (lo que no depende del escenario se prepara una vez por base, en un `WeakMap`), y la traza de una cifra recién al tocarla |

### Invariantes

Cada una tiene tests; romper una es un bug aunque la pantalla "se vea bien".

1. **Nada derivado se guarda.** Posiciones, PPC, resultados, totales, desglose, "sin atribuir", excedentes: todo se calcula (D-22, D-23).
2. **"Sin dato" es `valor: null` con su motivo**, nunca 0 ni una estimación, y se propaga: lo que depende de un dato faltante también es "sin dato". Un total con partes faltantes es "sin dato", con la etiqueta `parcial` y la suma parcial en sus insumos (D-65); sin ninguna parte conocida, es "sin dato" a secas, con el motivo de lo que falta (D-126). Sin bienes o sin leasing cargados, el patrimonio total y la deuda son "sin dato", no el financiero ni $ 0. Una tenencia que la fuente ya no lista y quedó pendiente vale "sin dato" desde la primera carga de su racha (D-117).
3. **Activo + CCL + sin atribuir = resultado, exacto,** por partida y en total, en ARS y en USD. `variacion` lo verifica en cada cálculo y lanza un error si no cierra.
4. **El desglose se ancla en observaciones frescas** (D-35, provisoria). Cada partida se desglosa por los intervalos entre sus observaciones frescas: su propio precio o saldo, y un CCL tipeado ese mismo día. Lo que no tiene observación fresca queda "sin atribuir" y se devuelve cuando llega. Por eso:
   - un período es la suma exacta de sus días;
   - una carga express entre dos completas no cambia el desglose del período;
   - en un intervalo sin CCL tipeado no se atribuye nada (D-109);
   - Cartera, desde la compra, usa la misma suma de intervalos que Hoy, más un tramo por lote antes de la primera observación, al CCL de compra (`desgloseDesdeCompra`), solo de la tenencia vigente: cada venta o vencimiento escala lo acumulado por cantidad después ÷ cantidad antes, como el costo, al precio y al CCL de la observación de ese día; las rentas no entran (D-114). Así activo + TC + sin atribuir = resultado de la fila (una propiedad lo verifica sobre los 310 casos de la referencia). Si hubo una venta antes de la primera observación fresca, una venta sin observación propia o una que cae el mismo día que una compra, una apertura o un cambio de ratio, vuelve a un solo intervalo con el CCL promedio de compra, rotulado;
   - una posición cerrada (cantidad 0) vale 0 exacto y no necesita precio para estar fresca;
   - los bienes y las deudas conservan su último dato en su propia moneda: con un CCL nuevo, su cambio es tipo de cambio (o licuación de la deuda), no "sin atribuir"; solo queda sin atribuir si en el intervalo no hubo ningún CCL tipeado.
5. **La moneda de riesgo decide dónde aparece el efecto del CCL.** Con V0 y V1 el valor de la partida en cada punta y F los flujos, cada uno al CCL de su fecha:
   - **arriesga dólares** (CEDEAR, dólares, bien en USD): en pesos, activo = resultado USD × CCL1 y TC = V0_usd × (CCL1 − CCL0) + Σ F_usd × (CCL1 − ccl_F); en dólares, todo es activo;
   - **arriesga pesos** (LECAP, bono, pesos, deuda en pesos): en dólares, activo = resultado ARS ÷ CCL0 y TC = V1_ars × (1/CCL1 − 1/CCL0) + Σ F_ars × (1/CCL0 − 1/ccl_F); en pesos, todo es activo.
   - El término de interacción (dólares: resultado USD × (CCL1 − CCL0), dentro de activo en pesos; pesos: resultado ARS × (1/CCL1 − 1/CCL0), dentro de TC en dólares) no es una parte aparte: va en `Contribucion.interaccion` y la traza lo muestra como "de lo cual: interacción".
6. **Un saldo que aparece por primera vez entra como apertura** (un flujo externo por su valor), nunca como ganancia. Lo mismo la primera valuación de un bien y el primer capital informado de una deuda.
   - La amortización de un bono baja su costo en lo cobrado (sin pasar de cero); la renta no toca el costo y se ve el día que se cobra (D-114).
7. **Una compra con precio pendiente** (PPP `-`, D-19) cuenta su cantidad y su flujo se valúa al precio del día, con la etiqueta `inferido` (D-110). Su PPC queda `pendiente` hasta que una carga posterior complete el precio.
8. **Valuar en dólares usa el último CCL tipeado,** con su fecha en la traza y `viejo` a los 2 días hábiles (D-109). Nunca un CCL estimado ni traído de afuera.
9. **Exposición:** la vista Financiero netea "pesos financieros − deuda del leasing". La Total suma cada bien en su moneda de riesgo, y es "sin dato" si alguno no la tiene (D-73, D-101). La concentración se mide siempre sobre el patrimonio financiero (D-03).
10. **Fechas en hora de Córdoba** (`America/Argentina/Cordoba`). "Hoy" lo decide el servidor con `hoyCordoba()`, nunca la zona del servidor.
11. **Las dos patas de una operación** (el título y la caja) usan el mismo CCL: el de la operación, si no el tipeado ese día, si no el último anterior. Cada flujo dice si es **externo** (aporte, retiro, transferencia, apertura, saldo inicial, cambio de capital de una deuda) o interno (compra, venta, cobro: se cancelan entre el título y la caja). Excepción: una operación en una cuenta sin ningún saldo cargado en esa moneda hasta el fin del intervalo (Galicia) tiene su pata de caja fuera de la app, así que su flujo es externo y el cuadre lo nombra (D-125).

## 5. El contrato de la traza

Toda función de cálculo devuelve un `Calc` (`src/lib/domain/calc.ts`):

```ts
interface Calc<T = Decimal> {
  valor: T | null          // null = "sin dato"
  motivo?: string          // si es null: qué falta, en una línea
  formula: string          // con los valores reales: "1.240 × $35.150 ÷ 1.548,20 = US$ 28.152,69"
  explicacion?: string     // "¿Qué es esto?", en castellano
  insumos: Insumo[]        // cada uno con nombre, valor, unidad, su carga de origen ({ carga_id, lugar }) y, si es un cálculo, su Calc
  etiquetas: Etiqueta[]    // 'viejo' | 'declarado' | 'inferido' | 'pendiente' | 'parcial' | 'estimado' | 'supuesto' | 'a_confirmar' | 'proyectado'
}
```

- `calc()` construye uno y **hereda las etiquetas de sus insumos**. `sinDato(motivo)` construye uno vacío.
- Si una cifra hereda varias etiquetas, la pantalla muestra la más grave (`GRAVEDAD`: parcial > pendiente > supuesto > estimado > a confirmar > proyectado > viejo > inferido > declarado). El texto de cada chip está en `NOMBRE_ETIQUETA`, en `calc.ts`. `estimado` lo usa hoy la deuda estimada de un pasivo (D-154); `supuesto`, `a_confirmar` y `proyectado` quedan para los escenarios y el cuadro de marcha del leasing.
- `vista(c)` lo convierte en `CalcVista`: lo mismo con los montos como texto decimal, para que viaje al navegador. Las pantallas reciben solo `CalcVista`.
- Toda cifra en pantalla pasa por `<Monto>` (`src/components/monto.tsx`), que dibuja el par ARS/USD, la etiqueta principal y "sin dato", y abre `<Traza>` al tocarla.

## 6. Los contratos de la carga

Están en `src/lib/carga/contratos.ts`. Todo número viaja como **texto decimal normalizado** (`"1234.56"`), nunca como `number` (D-32).

- **`LecturaCuenta`**, lo que devuelve cada lector:
  - `cuenta`, `origen` (excel o captura), `fecha_reporte` (B1, o la fecha de la captura) y `lector` (`ieb-excel@1`, `captura-claude@1 (A + B)`);
  - `filas`: cada `FilaLeida` con ticker, cantidad, precio mostrado y por 1 VN (`escala`: 1, 0,01 o 0,001; D-12), valorizado, PPC, `estado` (verificada, advertencia o error), `motivos`, `chequeo` (regla, esperado, calculado, tolerancia), `lugar` en la fuente y, en una captura, las `alternativas` donde las dos lecturas difieren;
  - `saldos`: cada `SaldoLeido` con su monto (puede ser negativo), sus `partes` (IEB USD = Total de Saldos + DOLARUSA) y la TNA, si la captura la muestra;
  - `controles`: B2, Subtotales y total de Galicia, con lo informado, lo calculado, la tolerancia y `ok` (`null` = no verificable);
  - `tipo_cambio_fuente`: el dólar con el que valúa la fuente (el de IEB), para nombrar la diferencia con tu CCL (D-66);
  - `cruda`: la lectura cruda, que se graba en `cargas.lectura_cruda`.
- **`PropuestaCarga`**: `DecisionFila` (acción, operación propuesta, cotización, precio a completar y, en una tenencia nueva de una cuenta ya cargada, la `apertura_alternativa` de "Ya la tenía", D-121), `DecisionSaldo` (con el anterior), controles (con su moneda y lo que cubren), advertencias, el CCL del día y las ausentes (`AusentePropuesto`: la venta o el vencimiento para registrar, D-117).
- **`ConfirmacionCarga`**, lo que recibe `confirmar_carga`:
  - `lote` (uuid), `fecha`;
  - `tipo_cambio` (`ccl`, `cripto_venta`, `mep`, `oficial`, `referencia`), o null;
  - `cuentas`: por cuenta, `origen`, `archivo_path` y `archivo_sha256` (obligatorios con archivo, null en manual), `lector`, `lectura_cruda`, `grabado`, `listado_completo`, `cotizaciones`, `saldos`, `operaciones` y `completar_precios`;
  - `tiempo_activo_ms`, `nota` y `huella` (sha256 de lo que mandó el dueño: fecha, firmas de las fuentes, elecciones, ediciones, tipos de cambio, referencia y nota; D-120).
- **`ResultadoConfirmacion`**: `{ lote, cargas: [{ carga_id, cuenta_id }], repetido }`. Ante un lote repetido, `guardar` muestra lo que de verdad quedó en la base (`leerLote` y `resumenDeLote`), no una propuesta rearmada.

**Reglas para quien escriba:**
- El lote se genera una vez por intento de confirmación (`crypto.randomUUID()`) y se reusa en un doble Enter o un reintento. Después de Deshacer, la carga siguiente necesita un lote **nuevo**.
- Toda escritura pasa por `src/lib/server/escritura.ts`, que valida antes de mandar (montos como texto con la misma sintaxis que el SQL, fechas, ids, archivo con sha256) y traduce los errores de la base al castellano (`ErrorEscritura`, con `message` y `codigo`). `confirmar_carga` y `guardar_manual` se reintentan una vez ante un corte de red, porque son idempotentes por lote; `revertir_lote`, nunca.
- Una Server Action atrapa el `ErrorEscritura` y **devuelve** `e.message`: en producción, Next oculta el texto de los errores lanzados.

**Las funciones de la base:** `confirmar_carga` (migración `carga_confirmar`, reemplazada en `confirmar_carga_recarga`), `revertir_lote` (`carga_revertir`), `guardar_manual` (`carga_manual`), y `alta_activo` y `editar_activo` (`catalogo_activos`, reemplazadas en `catalogo_cedear_ratio`). Los lectores de la entrada que usan (`leer_monto`, `leer_fecha`, `leer_id`) están en `carga_transaccional`. El trigger de la auditoría (`registrar_auditoria`) está en `init`, con el `search_path` fijado en `auditoria_search_path`. Detalle en `docs/datos.md`.

**Datos** (`src/app/(app)/datos/`): cada envío de un formulario lleva su lote (`_lib/envio.ts`): el mismo envío reintentado trae el mismo lote y `guardar_manual` no lo duplica; un corte de red deja el formulario con el aviso. Corregir un bien o un pasivo (`actualizarBien`, `actualizarPasivo` en `escritura.ts`) es un `update` fila por fila, auditado, que no es una carga (D-124).

## 7. Seguridad

| Capa | Qué hace |
|---|---|
| **Clave y sesión** (`sesion.ts`) | Una clave (`APP_PASSWORD`). Cookie `sesion` httpOnly, SameSite=Lax, Secure en producción, 30 días, con forma estricta (`vence.firma`) y verificada en tiempo constante. La firma usa una subclave de una clave maestra: `HMAC(SESSION_SECRET, APP_PASSWORD)` si hay `SESSION_SECRET`, o PBKDF2-SHA256 de `APP_PASSWORD` (210.000 vueltas, una vez por instancia). `claveDerivada(propósito)` da una subclave por uso. Las lecturas de Cargar se firman con otra clave (`carga/_lib/servidor.ts`) |
| **Entrada** (`src/app/login`) | 800 ms por clave equivocada y una traba creciente (1 s, 2 s, 4 s…, hasta 5 min) desde el tercer error seguido del mismo origen, en la memoria de cada instancia. Mirar la traba y anotar el intento van en un solo paso, antes de comparar la clave (`reservarIntento`): una ráfaga en paralelo prueba como mucho 3 claves (`acciones.test.ts`); si la clave era la correcta, `anotarExito` deja limpio el origen. El origen sale de `x-real-ip` (o, si falta, de `x-forwarded-for`). La vuelta (`?desde=`) solo acepta rutas propias |
| **Proxy** (`src/proxy.ts`) | Toda ruta pide sesión salvo `/login` y los estáticos de Next: una página va a la entrada (307) y un POST recibe 401. Agrega la Content-Security-Policy con un nonce por pedido y rechaza los pedidos que cambian algo si no vienen del propio sitio |
| **Segunda barrera** | Cada Server Action y cada Route Handler llama a `exigirSesion()` (D-57). Un test estático (`sesion.test.ts`, con el compilador de TypeScript) falla si una acción exportada o una ruta no lo hace (excepciones: `entrar` y `salir`). El proxy no es la única defensa |
| **Encabezados** (`next.config.mjs`, `ENCABEZADOS_SEGURIDAD`) | X-Frame-Options DENY, nosniff, Referrer-Policy same-origin, Permissions-Policy (sin cámara, micrófono, ubicación, pagos ni USB), HSTS de dos años, Cross-Origin-Opener-Policy y Cross-Origin-Resource-Policy same-origin, X-Robots-Tag noindex; sin X-Powered-By. Un test importa `next.config.mjs` y los verifica |
| **Modo demo** | `PORTFOLIO_DEMO=1` deja entrar sin clave con datos inventados. Se ignora si Vercel dice que el entorno es producción, pero anda fuera de ella (un Preview de Vercel, `next start`): no se carga en ningún entorno de Vercel. En modo demo ninguna vista, Server Action ni la ruta de lectura lee o escribe la base |
| **Base** (D-20, D-33) | RLS en todas las tablas, sin políticas; `anon` y `authenticated` sin privilegios. El servidor usa la clave secreta (`service_role`) con permisos mínimos y explícitos: sin `TRUNCATE` y sin escribir la auditoría. Las funciones de la carga son `security invoker`, con `search_path` fijo, y solo `service_role` puede ejecutarlas |
| **Auditoría** (`registrar_auditoria`) | Trigger `SECURITY DEFINER` con `search_path = public, pg_temp`: escribe siempre en `public.auditoria`. Un control del schema crea una tabla temporal `auditoria` y verifica que no se lleva nada; otro, que toda función de `public` fija el `search_path` con `pg_temp` al final |
| **Archivos** | Bucket privado `cargas`. Solo el servidor sube y lee |
| **Secretos** | Solo en variables de entorno de Vercel. Ninguna lleva `NEXT_PUBLIC_`. El navegador no habla con Supabase ni con Anthropic: la CSP solo permite conectarse al propio sitio |

`src/lib/server/supabase.ts` es el único punto de acceso a la base y lleva `import 'server-only'`: importarlo desde un componente de cliente rompe el build.

## 8. Correr la app en tu máquina

Requisitos: Node 22 a 24 y `npm ci`.

**Modo demo** (sin base, sin clave, números inventados):

```
PORTFOLIO_DEMO=1 npx next dev -p 3100
```

- Abrí http://localhost:3100. Hoy, Cartera y Exposición muestran el set del Apéndice B de la visión, pasado por el motor real.
- Variantes en Hoy y Cartera: `?demo=vacio` (Día cero), `?demo=express` (carga express), `?demo=viejo` (datos viejos). Exposición Total: `/exposicion?vista=total`.
- En Cargar, "Probar con un ejemplo" arma una bandeja con lecturas inventadas. Nada se guarda. Con `PORTFOLIO_DEMO_ESCENARIO=compra_pendiente`, el ejemplo arranca con una compra de SPY con precio pendiente, para ver "completar precio" (D-110). Con `PORTFOLIO_DEMO_ESCENARIO=ausente`, con una LECAP vencida que la fuente ya no lista, para ver "Registrar vencimiento" (D-117) y "Ya la tenía" (D-121).

**Contra la base real:** hay un solo entorno, así que es la base de producción. Variables en `.env.local` (ignorado por git): `SUPABASE_SECRET_KEY`, `APP_PASSWORD`, `ANTHROPIC_API_KEY` y, si querés, `SESSION_SECRET`.

**Sin base** (sin clave de Supabase y sin demo): Hoy dice "Falta configurar la base". Cargar lee archivos, pero no guarda nada.

**Dos servidores a la vez.** `next.config.mjs` acepta `NEXT_DIST_DIR` para usar otra carpeta de salida y no pisar el `.next` de un servidor que ya corre:

```
NEXT_DIST_DIR=.next-b npx next dev -p 3200
```

Las carpetas `.next-*/` están en `.gitignore`. Si Next agrega `.next-b/types/**` al `include` de `tsconfig.json`, no lo commitees. `agentRules: false` evita que `next dev` escriba en `CLAUDE.md`.

## 9. Tests

| Qué | Dónde | Cómo se corre | Qué verifica |
|---|---|---|---|
| Unitarios y de propiedades (Vitest + fast-check) | `src/**/*.test.ts`, `tests/unit/` | `npm test` | Motor, lectores, conciliación, bandeja, escritura, firma de lecturas, entrada y sesión, cálculos de presentación. Las propiedades generan miles de casos al azar |
| Apéndice B | `src/lib/vistas/ejemplo.test.ts` | `npm test` | Que el motor reproduce, al centavo, el set de ejemplo de la visión |
| Revisión adversarial del motor | `tests/unit/revision-motor.test.ts` | `npm test` | Un test por hallazgo (B01 a B28) más 30 de cobertura |
| Revisión de la 1a desplegada | `tests/unit/fase3-motor.test.ts`, `tests/unit/fase3-integracion.test.ts` y los `*.test.ts` junto a cada archivo arreglado | `npm test` | Un test por hallazgo, que falla sin su arreglo: ausentes, cuadre, frase, desglose de la tenencia vigente, leasing y bienes, carga parcial, Registro, sumas sin partes |
| Lector de IEB, más casos | `src/lib/carga/ieb.test.ts` | `IEB_CORRIDAS=500 npx vitest run src/lib/carga/ieb.test.ts -t propiedades` | 1.000 Excel sintéticos al azar que siempre concilian, y cualquier total adulterado siempre falla |
| Implementación de referencia | `tests/referencia/` | `python3 tests/referencia/motor_referencia.py` (se verifica sola contra los ejemplos de D-35 y el Apéndice B); el cruce, con `npm test` | Un motor escrito en Python (solo biblioteca estándar, `Decimal` de 50 dígitos) a partir de los documentos, sin mirar el de TypeScript, y 310 casos con semilla fija (`generar_casos.py`) comparados uno por uno. `REFERENCIA_SALIDA=<archivo>` vuelca las diferencias |
| Schema | `supabase/tests/` | `npm run test:schema` (necesita un Postgres local: `PGHOST`, `PGPORT`, `PGUSER`) | Reconstruye la base de cero con todas las migraciones, sobre un stub que imita los roles y defaults de Supabase, y corre 331 controles como `service_role`: permisos, checks, funciones, idempotencia, reversión, la recarga del mismo día, la huella, el ratio de un CEDEAR, la auditoría con una tabla temporal y los feriados |
| Layout (D-30) | `tests/e2e/layout.spec.ts` | `npm run test:e2e` | Cada pantalla (Cargar, las cinco de Datos y la de "no encontrada" incluidas) a 360, 390, 412, 768, 1024, 1279, 1280, 1600 y 2560 px, en claro y en oscuro: sin scroll horizontal, nada afuera de la pantalla ni de su tarjeta, ningún texto que se salga de un botón, nada cortado ni superpuesto, un h1 por pantalla, tocables de 44 px con puntero grueso, sin errores de JavaScript y axe-core sin violaciones serias. Además, 768 y 1024 px con puntero táctil y el chip de datos abierto a 360, 390 y 412 px. Todas las pantallas frenan el test. **Tiene que pasar antes de cualquier deploy** |
| Interacción | `tests/e2e/interaccion.spec.ts` | `npm run test:e2e` | Hoy arriba del pliegue en un iPhone 13, la traza en el teléfono y en la compu, la frase con mouse en una ventana angosta, ordenar y filtrar Cartera, los resultados en dólares en verde o rojo, el modo privado en todas las pantallas (ningún monto a la vista, con el ejemplo cargado en Cargar), el foco con teclado, revertir con motivo, el 404, Día cero |
| Pantallas de la entrega 4 | `tests/e2e/{balance,evolucion,pasivos,flujo}.spec.ts` | `npm run test:e2e` | Cada estado del demo de cada pantalla, sus controles, la traza, el modo privado y, en Flujo, menos de 200 ms entre mover un deslizante y ver la proyección con la CPU × 4 (con `E2E_PROD=1`) |
| Reglas de las migraciones | `tests/unit/migraciones.test.ts` | `npm test` | Toda migración posterior a los feriados: sin "delete" (ni en un comentario), y cada tabla y función nueva con RLS, permisos, comentarios y su auditoría |
| Entrada | `tests/e2e/auth.spec.ts` | `npm run test:e2e` (o `npm run test:e2e:auth`) | Que sin sesión no se ve ninguna pantalla, que la clave funciona y vuelve adonde ibas, el freno a los intentos, los encabezados de seguridad y que la Content-Security-Policy no rompa nada |

Playwright tiene dos proyectos, cada uno con su servidor (los levanta o reusa):
- **demo** (layout e interacción): `next dev` en el puerto 3100 con `PORTFOLIO_DEMO=1`.
- **auth** (entrada): la app como en producción, sin modo demo, sin base y con una `APP_PASSWORD` de prueba (`tests/e2e/clave.ts`), en el puerto 3110 y con su propia carpeta de salida (`.next-auth`).

`E2E_SOLO=demo` o `E2E_SOLO=auth` corre uno solo (`npm run test:e2e:auth`). Con `E2E_PROD=1` (`npm run test:e2e:prod`) arma el build de producción una vez y lo sirven los dos con `next start`; los puertos 3100 y 3110 tienen que estar libres, o se cambian con `E2E_PORT` y `E2E_AUTH_PORT` (y `NEXT_DIST_DIR` para no pisar otro build). Las capturas para revisar a ojo van a `CAPTURAS_DIR`.

**Datos de prueba:** siempre inventados (D-24). `tests/fixtures/ieb.ts` arma un Excel con la estructura real de IEB y perillas para adulterarlo. Los ejemplos de capturas son lecturas inventadas.

**Tipos:** `npm run typecheck` (`tsc --noEmit`).

**CI** (`.github/workflows/ci.yml`): en cada pull request y en cada push a `main`, sin secretos y sin tocar Supabase. Un job corre tipos, `npm test` y el build de producción; otro, los tests del schema contra un Postgres 17. Los tests de Playwright todavía no corren en CI.

## 10. Cambiar el schema

Nunca se edita una migración ya aplicada ni se corre SQL suelto que cambie el schema (`CLAUDE.md`).

1. Nueva migración en `supabase/migrations/`, con permisos explícitos para `service_role` en cada objeto nuevo (D-33), RLS y comentarios. Si es una función, `security invoker`, `search_path` fijo y `execute` revocado a `public`, `anon` y `authenticated`.
2. Casos nuevos en `supabase/tests/schema_tests.sql`, y `npm run test:schema` en verde.
3. Aplicar con el MCP de Supabase (`apply_migration`). Después, **renombrar el archivo local a la versión que registró Supabase** (`list_migrations`), para que el historial local y el remoto coincidan.
4. Regenerar `src/lib/database.types.ts` (`generate_typescript_types` del MCP de Supabase) y correr `npm run typecheck`.
5. Revisar los avisos de seguridad de Supabase (`get_advisors`).
6. Actualizar `docs/datos.md`, `CHANGELOG.md` y, si se decidió algo, `docs/decisiones.md`, en el mismo commit.

## 11. Recetas

**Una cifra nueva en una pantalla.**
1. El cálculo va en una función pura del motor (`src/lib/domain`) o del armador (`src/lib/vistas/armar.ts`) que devuelve un `Calc`, con fórmula, insumos, explicación y etiquetas. Si le falta un insumo, `sinDato(motivo)`.
2. Agregala al contrato de la vista (`src/lib/vistas/contratos.ts`) como `CalcVista` o `Par` (toda cifra en las dos monedas).
3. Mostrala con `<Monto>` o `<Traza>`: nunca se calcula en el JSX.
4. Tests: el valor, el "sin dato" cuando falta cada insumo y que las etiquetas se propaguen. Si la cifra aparece en el demo, `src/lib/vistas/ejemplo.test.ts`.

**Un lector nuevo** (otra cuenta u otro formato).
1. Una función que devuelve una `LecturaCuenta` (`src/lib/carga/contratos.ts`): cada fila con su chequeo aritmético y su estado, los controles de la fuente y la lectura cruda. Lo ilegible es null con motivo.
2. Conectala en `src/app/(app)/carga/leer/route.ts` según la clase de archivo.
3. Un fixture con la estructura real y números inventados en `tests/fixtures/`, tests de cada regla y, si se puede, propiedades.
4. Documentala en `docs/carga-diaria.md`, con su versión de lector (`nombre@1`).

**Un hecho nuevo para guardar.** Migración (sección 10) con su `carga_id`, permisos y auditoría; escritura por una función de Postgres si toca más de una fila, con su envoltorio en `escritura.ts`; lectura en `leerHechos()` con `::text`; tipo en `src/lib/domain/tipos.ts`. Si `revertir_lote` tiene que deshacerlo, agregá la tabla a su recorrido: la función se niega a revertir lotes con filas en tablas que no conoce.

## 12. Trampas conocidas

Cosas que ya mordieron una vez. Cada una tiene su arreglo en el código; no lo deshagas sin leer esto.

| Trampa | Qué pasa | Qué se hace |
|---|---|---|
| PostgREST y los `numeric` | Los serializa como número JSON y supabase-js los pasa a `float64` antes de que el código los vea | Leer siempre con `::text`, nunca `select('*')`; el parser de plata rechaza números (D-32) |
| PostgREST corta en 1.000 filas | Sin avisar | `leerTodo()` pagina y falla si llegan menos filas que las contadas |
| Defaults de supabase-js | En un insert de varias filas, una clave que falta viaja como `NULL`, no como el default | Las funciones de la base usan `coalesce` |
| Permisos por defecto de Supabase | Toda tabla nueva le da todo a `service_role` (`TRUNCATE` incluido) y toda función nueva es ejecutable por `PUBLIC` | Revocar y otorgar explícitamente en cada migración (D-33) |
| Errores en Server Actions | En producción, Next oculta el texto de un error lanzado | Atrapar el error y **devolver** el mensaje. Si igual llega a `error.tsx`, la pantalla dice que el detalle está en los logs de Vercel, con la referencia |
| Rutas que no existen | El 404 es `src/app/not-found.tsx`: en español, dentro del marco de la app (`components/shell/marco.tsx`) y sin el estado de los datos | El marco no lee la base. Un catch-all dentro de `(app)` la leería sin sesión en las rutas que el proxy deja pasar (`/login/…`, `/icons/…`) |
| Reglas de CSS fuera de las capas de Tailwind | Le ganan a toda utilidad (`text-positive`, `rounded-*`, `outline-none`) | Lo que tiene que poder pisarse va en `@layer base` (el anillo de foco). `.usd` fija su tinta solo sin tono, y `.tocable` queda afuera a propósito, para ganarle a `h-10` y `lg:min-h-10` |
| Pedidos en paralelo a una Server Action | Un `await` entre mirar un estado y anotarlo deja que todos los pedidos vean el estado viejo (el freno a las claves se salteaba) | Mirar y anotar en un solo paso sincrónico, antes del primer `await` (`reservarIntento`) |
| Commits de trabajo en un repo público | Lo que estaba en el árbol en cada push queda público en el historial, aunque después se borre | Los datos reales nunca entran al árbol de trabajo; no se suben commits de trabajo al repo público (D-24) |
| Server Actions en fila | Next las despacha de a una | La lectura de archivos va por un Route Handler (D-105) |
| Límite de Vercel | Corta los pedidos de más de 4,5 MB | Un archivo por pedido; la ruta rechaza más de 4 MB |
| `setState` en un listener nativo en fase de captura | Re-renderiza en medio del evento y pisa el valor de un input controlado: se pierden teclas | Anotar el gesto en un `ref` y redibujar en `requestAnimationFrame` (el contador de tiempo activo de Cargar) |
| `Decimal(0).isPositive()` | Es `true` en decimal.js | Usar `gt(0)` para "mayor que cero" |
| Números del Excel | Traen ruido binario (10.118.700,000000002) | Leer con 15 cifras significativas y pasar a `Decimal` (D-107) |
| `zodOutputFormat` del SDK de Anthropic | En la versión 0.132 mueve los `enum` a la descripción: la API no los exige | El schema se genera desde zod y los nulos van como `anyOf` (`captura-verificacion.ts`) |
| `next dev` y `CLAUDE.md` | Next 16 agrega un bloque de reglas para agentes a `CLAUDE.md` | `agentRules: false` en `next.config.mjs` |
| `NEXT_DIST_DIR` y `tsconfig.json` | Next agrega `.next-b/types/**` al `include` | No commitear esas líneas |
| Contraste | El token `text-faint` no llega a AA para texto: axe lo marca como serio | Usar `text-muted` para texto |
| Breakpoints de Tailwind 4 | Los arbitrarios en px se ordenan antes que `xl` | Usar rem |
| Capturas de pantalla completa en Chromium | Apagan la emulación táctil: sale el layout de mouse | Para el teléfono, agrandar el viewport en lugar de `fullPage` |
| `server-only` en los tests | Lanza fuera de un Server Component | Vitest lo reemplaza por un módulo vacío (`tests/unit/server-only-vacio.ts`) |
| Dos corridas de Playwright a la vez | Si comparten la carpeta de salida, la que arranca le borra los archivos a la otra (rojos falsos con `ENOENT`) | Cada corrida escribe en su propia carpeta (`node_modules/.cache/playwright-e2e/corrida-<ms>`, o `PW_OUTPUT_DIR`) |
| Una `<table>` con `sr-only` | No respeta el ancho de 1 px: con muchas columnas ensanchaba la página en el teléfono (hasta 1.850 px) | `sr-only` va en un `<div>` que envuelve la tabla (`components/graficos/grafico.tsx`) |
| Una cookie de más de 4 KB | El navegador la descarta sin avisar | El demo de Flujo guarda lo suyo en dos cookies |
| `<form action>` en React 19 | Vacía los campos después de la acción, también si falló | Los formularios de Flujo se envían con `onSubmit` |
| Prettier | El repo no tiene configuración: lo reescribe todo con punto y coma y comillas dobles | No correrlo; el estilo es el del código que rodea |
| Una migración con la palabra "delete" | El conector de Supabase pide una confirmación que no llega (D-116), aunque esté en un comentario | `tests/unit/migraciones.test.ts` frena toda migración nueva que la tenga |
| Editar el motor con el servidor de desarrollo andando | Recompila en medio de un test: "Router action dispatched before initialization" | No editar mientras corre Playwright |

## 13. Rendimiento

Todo se calcula en cada pedido, desde los hechos. Con un año sintético (250 cargas, 15 posiciones, 2 saldos), Hoy tarda unos 56 ms, Exposición unos 240 ms (su serie de 120 días) y **Cartera unos 0,6 s**, porque el desglose desde la compra suma todos los intervalos y cada foto histórica arma su traza completa. Alcanza para la 1a, pero crece con la historia: el paso siguiente es un modo de foto sin traza para la atribución, o un caché por conjunto de hechos.

## 14. Despliegue

- Vercel, proyecto `portfolio`. Producción sale de `main`. Región `gru1`, cerca de la base (sa-east-1).
- Variables de entorno: ver `README.md`.
- Cargar y su ruta de lectura tienen `maxDuration = 60` s. Cada lectura de captura se corta a los 50 s, para que el error llegue antes.
- Antes de desplegar: tipos, tests y el test de layout en verde (`docs/calidad.md`). Después: mirar los logs del deploy y entrar a la app.
