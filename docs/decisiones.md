# Decisiones

Registro de cada decisión de diseño que ajusta o completa `docs/spec.md`: qué se decidió, por qué y qué se descartó. Las decisiones no se borran. Si una cambia, se agrega una nueva que la reemplaza y la vieja queda marcada como **reemplazada por D-NN**.

Estado: **D** = decidida · **P** = propuesta, esperando confirmación del dueño · **P (provisoria, a confirmar)** = propuesta que la fase 1a ya implementa mientras esperás para confirmarla. Si la rechazás, el código se cambia.

Numeración: D-01 a D-34 están acá. D-35 a D-53 son propuestas de `docs/investigacion-mercado.md` y D-54 a D-103 de `docs/vision.md` §6 (todas esperan tu aprobación). Las decisiones nuevas siguen desde **D-104** (ver "Fase 1a", desde **D-117** "Revisión de la 1a" y, desde **D-156**, "Rediseño"). Al final, "Propuestas que la 1a implementa en forma provisoria" lista cuáles de esas propuestas ya están en el código y cómo.

---

## Producto

### D-01 · Empezar de cero, no iterar sobre Corte — D
La app anterior (Corte: libro líquido mobile-first con memo de IA) no resolvía el problema. Se reescribe desde cero contra `docs/spec.md`. El código de Corte sigue en el repo hasta que la fase 1 lo reemplace en producción; su base (schema `corte`, en otro proyecto de Supabase de la empresa) no se toca.

*Actualización 2026-10-08 (fase 1a):* el código de Corte ya salió del repo, y el despliegue de la 1a lo reemplaza en el proyecto `portfolio` de Vercel. El schema `corte` sigue sin tocarse.

*Actualización 2026-10-14 (revisión de la 1a):* también salió `supabase/schema.sql`, el schema de Corte que había quedado junto a las migraciones (con un MEP fijo y columnas de precios externos). Nada lo usaba. El schema `corte` de la base de Corte sigue sin tocarse.

### D-02 · Proyecto Supabase dedicado — D
Proyecto **Portfolio** (`zcgynhzddfjzwswekcvl`, sa-east-1), schema `public`. Queda separado de las bases de la empresa: datos personales y de negocio no comparten proyecto ni credenciales. Vercel: proyecto `portfolio` existente (equipo `marianomanto-cmds-projects`).

### D-03 · Patrimonio total y patrimonio financiero — D
El dueño tiene una casa de ~US$200K, totalmente paga, y un auto en leasing. Si todo se suma en un solo número, la casa domina (≈80% del total) y aplasta lo que importa para invertir.
- **Patrimonio total** = financiero + bienes + participación en el auto (valor del auto − capital pendiente del leasing).
- **Patrimonio financiero** = lo invertible. Sobre esto se calculan Cartera, concentración, PnL de inversiones y Monte Carlo.
- "Hoy" muestra los dos, cada uno en ARS y en USD. "Exposición" tiene un selector financiero/total.
- El auto en leasing es de la leasera hasta que se ejerce la opción de compra. Se cuenta en el patrimonio, como pidió el dueño, marcado "sujeto a opción de compra".

### D-04 · Bienes con valuación manual con historia — D
Casa y auto van en una tabla `bienes`, con valuaciones fechadas que carga el dueño (tasación, guía de precios). La app no estima depreciaciones: sin valuación cargada, el dato es "sin dato", y se muestra la fecha de la última valuación. En las proyecciones, la variación anual de cada bien es un supuesto del escenario.

### D-05 · Tab "Evolución y PnL" — D
Una línea de tiempo en ARS y en USD: el pasado real (patrimonio diario, calculado a partir de las cargas) y, desde hoy, el abanico de Monte Carlo del escenario elegido. El cambio de patrimonio de cada período se descompone en: **aportes**, **resultado por activos**, **resultado por tipo de cambio**, **cuota del leasing** y **licuación de la deuda**.
- La parte histórica entra en la **fase 1** (sale de la carga diaria, y cuanto antes empiece, más historia hay).
- La proyección entra en la **fase 3**, con el motor.

### D-06 · Registrar aportes y movimientos de capital — D
Sin registrar los aportes, un depósito de US$2.000 se leería como ganancia. Tabla `movimientos_capital`: aporte, retiro y transferencia entre cuentas propias, con el impuesto cobrado. Alimenta el PnL (D-05), la "probabilidad de quedar debajo del capital aportado" (proyecciones) y la rutina de liquidez Mercado Pago ↔ FIMA (rendimientos). En la carga diaria es un campo opcional: solo se usa el día que se mueve plata.

*Ajustada por D-111 (fase 1a):* los movimientos se cargan en Datos › Movimientos, no en la pantalla de carga.

### D-08 · Escenarios con variables ajustables — D
Pedido del dueño (2026-10-07), amplía la sección 7 del spec. Toda variable de la proyección es un supuesto editable. Ninguna está fija en el código.

**Variables** (todas por escenario; las marcadas "por tramos" admiten valores distintos por período, ej. 2% mensual hasta marzo y 4% después):

| Grupo | Variables |
|---|---|
| Macro | Devaluación mensual (por tramos) · inflación mensual (por tramos) |
| Ingresos | Ingreso USD mensual y su crecimiento · brecha cripto vs. CCL · ingreso fijo en pesos y su ajuste · shock de ingresos (desde el mes N el ingreso pasa a US$X) |
| Gastos | Ajuste de los gastos fijos (% o atado a inflación) · % del excedente que se invierte |
| Cartera | Retorno anual esperado y volatilidad por clase (CEDEAR, acción local, bono tasa fija, bono CER como spread real, liquidez remunerada) · TEM por bono · a qué clase se reinvierte cada vencimiento |
| Riesgo | Grados de libertad de la t-Student (cuánto pesan las colas) · cantidad de corridas · semilla |
| Bienes | Variación anual en USD de la casa · depreciación anual del auto |
| Deuda | Si se ejerce la opción de compra del leasing y cuándo |
| General | Horizonte en meses |

**Cómo se ajusta: tres botones por variable** (pedido del dueño, 2026-10-07)
- Cada variable es un selector `Baja · Igual · Sube`.
- **Igual** = el nivel no cambia (el CCL queda donde está, el ingreso sigue en el mismo monto, la casa vale lo mismo). No requiere definir nada.
- **Sube / Baja** muestran un **control deslizante** para elegir cuánto (pedido del dueño: "perillas"), con el valor a la vista (`+3,0%/mes`) y botones −/+ para el ajuste fino. El botón también muestra el número elegido. El valor queda recordado por variable para los próximos escenarios. Si la variable todavía no tiene valor, el deslizante arranca vacío y no se proyecta hasta moverlo. La app no propone magnitudes (D-07).
- Los rangos de los deslizantes son amplios (ej. devaluación 0–15%/mes). Solo evitan valores absurdos, no sugieren nada.
- Se usa un deslizante horizontal y no una perilla giratoria: la giratoria es imprecisa con el dedo y no se maneja bien con teclado. Perillas redondas en desktop quedan como opción si el dueño las prefiere.
- CCL e inflación admiten tramos ("Sube hasta marzo, Igual después"), cada uno con sus tres botones.
- Volatilidad, grados de libertad, corridas y semilla van en "Avanzado", plegado. Un escenario nuevo copia esos valores del último escenario guardado.
- En mobile, los tres botones ocupan el ancho de la tarjeta de la variable (D-30).

**Cómo se usa:**
- Panel de supuestos al lado del gráfico (debajo en mobile). Cada cambio recalcula en vivo.
- Mientras se tantea, los supuestos viven en la URL: refrescar no pierde nada, y el botón Atrás recorre lo que se fue probando.
- **Guardar con nombre** ("base", "optimista", "se va todo al carajo"), **duplicar** para hacer una variante y **comparar** 2 o 3 superpuestos en el mismo gráfico, con una tabla que muestra solo los supuestos en los que difieren.
- La semilla queda guardada con el escenario: el mismo escenario da siempre el mismo resultado.
- Un escenario nuevo arranca con los datos reales actuales (CCL, ingreso, gastos, cartera, cuota). Los supuestos a futuro (devaluación, retornos, inflación) arrancan **vacíos**, y no se proyecta hasta que los completes. La app no te propone valores: serían recomendaciones.
- Supuestos validados con un schema versionado (`escenarios.supuestos`). Si se agrega una variable nueva, los escenarios viejos se migran con un valor explícito y no con un default silencioso.

### D-07 · Sin recomendaciones, sin APIs de precios — D (del spec)
La app muestra datos y proyecta supuestos del dueño. No recomienda ni trae precios de afuera.

## Carga diaria

### D-10 · Entrada por archivo y captura, leída por la app — D
Cómo llega la información, por cuenta:

| Cuenta | Qué carga el dueño | Cómo se lee |
|---|---|---|
| IEB | Excel "Portafolio" exportado del bróker | Parser determinístico (sin IA) |
| Galicia | Captura de pantalla pegada con Ctrl+V | Claude (visión) en el servidor |
| Mercado Pago | Captura del saldo | Claude (visión) en el servidor |
| — | CCL y dólar cripto del día | Dos campos tipeados |

El spec pedía "parseo de texto pegado". Se amplía a Excel y capturas porque es lo que entregan los brókers del dueño, y pegar una captura es más rápido que seleccionar texto en el home banking.

### D-11 · La IA lee, el dueño confirma y la aritmética verifica — D
Lo que lee Claude nunca se guarda sin pasar por dos filtros:
1. **Chequeo determinístico:** `cantidad × precio × escala ≈ valorizado` (tolerancia de redondeo). Si no cierra, la fila queda marcada y no se guarda en silencio.
2. **Confirmación:** el dueño ve la lectura y la confirma.

La lectura cruda y el archivo original quedan guardados (tabla `cargas` + bucket privado `cargas` en Supabase Storage). Así cualquier precio se rastrea hasta la imagen o el Excel del que salió. Esto respeta "no inventes precios": la IA transcribe y no estima. Si no puede leer un número, lo deja vacío.

### D-12 · Precios normalizados por 1 VN — D
IEB cotiza bonos y letras **cada 100 VN**; Galicia, **por 1 VN**. Todo precio se guarda por 1 VN (o por 1 unidad). El parser detecta la escala comparando contra el valorizado: si con ×1 no cierra y con ÷100 sí, el precio venía cada 100. Ningún cálculo necesita saber de qué bróker vino un precio.

### D-13 · Efectivo y saldos remunerados se cargan como saldo — D
Excepción explícita a "derivá todo": una cuenta remunerada cambia por intereses, y el efectivo del bróker por liquidaciones, sin que haya una operación. La verdad es el saldo que muestra la cuenta (`saldos_liquidez`). En IEB se toma el saldo **"Total"** (neto de lo que falta liquidar), no "Hoy". Con "Hoy", una compra pendiente de liquidar se contaría dos veces: como posición y como efectivo.

### D-14 · Arranque sin historial: operaciones de apertura — D
No hay historial de operaciones. La primera carga crea una operación `apertura` por posición, con el PPP del bróker como costo en pesos. El CCL de la compra original no se conoce, así que el PPC en USD de esas posiciones es **"sin dato"** salvo que el dueño cargue el CCL de la fecha de compra. El resultado en USD se muestra igual, **desde la fecha de apertura**, con la etiqueta correspondiente.

### D-15 · Las cantidades del bróker concilian contra las operaciones — D
Las posiciones se derivan de `operaciones` (spec). El Excel y las capturas traen cantidades, que se usan para **conciliar**: si el bróker dice 120 y las operaciones dan 100, la carga lo muestra y ofrece crear la operación que falta (con el precio a confirmar). Ninguna fuente pisa a la otra en silencio.

*Completada por D-115 (fase 1a):* cargas atrasadas y cambios de ratio.

### D-17 · Log de carga de datos — D
Pedido del dueño (2026-10-07). Dos niveles:
1. **Registro de cargas** (tabla `cargas`, pantalla "Registro"): cada carga confirmada queda con fecha y hora, cuenta, origen (Excel, captura o manual), el archivo original, la lectura cruda del parser o de la IA, lo que se grabó (cuántas cotizaciones, saldos y operaciones), las diferencias de conciliación que había y qué se hizo con ellas. Una carga se puede **revertir** como unidad: se borran sus filas, la carga queda marcada como revertida y no desaparece del registro.
2. **Auditoría de cambios** (tabla `auditoria`, con un trigger en las tablas de datos): todo insert, update o delete guarda la fila antes y después, la carga que lo produjo y la hora. Si un precio se corrige a mano, el valor anterior sigue visible.

Con esto, la trazabilidad llega hasta el origen: número → fórmula → insumos → carga → archivo.

*Ajustada por D-104 (fase 1a):* se revierte el lote entero (todas las cargas de un Enter), con motivo, y solo si cada carga es la última de su cuenta. Revertir una carga suelta queda para después.

### D-18 · Valor de un CEDEAR = precio en pesos del bróker — D
La fórmula del spec (`precio_subyacente_usd × TC ÷ ratio`) necesita el precio del subyacente en USD, y ninguna de las fuentes diarias lo trae (ni el Excel de IEB, ni las capturas, ni los dos campos de tipo de cambio). Aplicada al pie de la letra, todo CEDEAR sería "sin dato". Reconstruirla como `precio_pesos × ratio ÷ CCL` sería guardar un dato derivado como si fuera un hecho.
- Valor en pesos = `cantidad × precio en pesos` (del bróker).
- Valor en USD = valor en pesos ÷ CCL del día.
- Si se carga el precio del subyacente en USD (opcional), se usa para partir el efecto "activo" en dos: lo que se movió el subyacente y lo que se movió el **CCL implícito** del CEDEAR (`precio_pesos × ratio ÷ precio_subyacente`).

*Ajustada por D-109 (fase 1a):* el "CCL del día" es el último tipeado hasta ese día, con su fecha a la vista y "viejo" a los 2 días hábiles.

### D-19 · Compras del día y costos pendientes — D
El día de una compra, IEB muestra PPP `-`. La compra se graba como `compra` (no como `apertura`), con el CCL del día y el precio vacío, que significa **pendiente**. La carga del día siguiente lo completa a partir del PPP nuevo, `(PPP₁ × q₁ − PPP₀ × q₀) ÷ Δq`, y la auditoría guarda el cambio. Mientras falte, el PPC de esa posición es "sin dato" pero la cantidad cuenta.

*Completada por D-110 (fase 1a):* ese día la compra se valúa "inferida" al precio del día, y la carga siguiente propone el precio, que se acepta en la bandeja.

### D-16 · Precio viejo = más de 2 días hábiles — D
Con una tabla `feriados` cargada a mano una vez por año. Si se contaran días corridos, todo el portafolio aparecería "viejo" cada lunes.

*Ajustada por D-129 (revisión de la 1a):* la tabla se siembra por migración, con la fuente oficial de cada día en su encabezado, no a mano ni con date-holidays. Qué cuenta como feriado está en D-129. Ya tiene 2026 y 2027.

## Seguridad y datos

### D-20 · Base cerrada; solo el servidor la toca — D
RLS activado en todas las tablas, sin políticas, y sin permisos para `anon` ni `authenticated`. El servidor usa `service_role` (variable de entorno de Vercel, nunca en el cliente). El navegador no habla con Supabase: todo pasa por server components y server actions.

### D-21 · Clave simple en lugar de Vercel Password Protection — D
Vercel Password Protection es un add-on pago. En su lugar: middleware de Next.js con una clave en una variable de entorno y una cookie firmada (HMAC). Costo cero y suficiente para un solo usuario.

*Detallada por D-112 (fase 1a):* en Next 16 el middleware se llama `proxy` (`src/proxy.ts`), y la sesión se verifica también en cada Server Action y Route Handler.

### D-22 · Cálculos en TypeScript, no en SQL — D
SQL guarda hechos y tiene vistas triviales (suma de cantidades, último precio, último saldo). PPC, resultados, desglose activo/TC, TIR, TEM y valor técnico van en funciones puras con tests, que devuelven el valor junto con la fórmula y sus insumos. Esa salida es lo que muestra la trazabilidad al hacer hover o click. Tener la misma lógica en dos lugares termina en dos resultados distintos.

### D-23 · Hechos, no estado — D
Además de las posiciones (spec), tampoco se guardan `cuotas_pagadas`, totales de flujo ni excedente. Se derivan. `pasivo_cuotas.pagado_bool` pasa a ser `fecha_pago` (null = impaga). `niveles` apunta a la operación que lo ejecutó, en lugar de copiar su precio y fecha.

### D-24 · Datos reales fuera de git — D
Excel, capturas y montos del dueño viven en Supabase (base + Storage privado), no en el repo. Los tests usan fixtures con la misma estructura y números inventados.

*Actualización 2026-10-08:* el repo `marianomanto-cmd/portfolio` es **público**, y el dueño decidió dejarlo así ("No importa que esté público"). Por eso la documentación (spec, decisiones, investigaciones, visión) se versiona aunque describa su situación patrimonial a grandes rasgos. Lo de arriba sigue igual: los archivos crudos (Excel, capturas) y los montos de sus posiciones no van al repo, y los tests usan números inventados. Nunca se suben claves ni credenciales.

*Actualización 2026-10-14 (revisión de la 1a):* antes de esta revisión llegaron al repo público cifras reales del dueño: un saldo, en commits de trabajo de un pull request, y valores de un export de IEB, en tests y fixtures que entraron a `main`. Se reemplazaron por números inventados y el árbol quedó limpio: un barrido de las cifras de los archivos reales contra `src`, `tests`, `docs` y `supabase` no encuentra ninguna. Pero siguen en el historial. No son credenciales, así que no hay nada que rotar. Qué hacer con el historial lo decide el dueño:
- hacer privado el repo (inmediato y reversible: corta el acceso a todo lo anterior, aunque lo que alguien ya copió no se recupera);
- dejarlo público, pedirle a GitHub que purgue las referencias del pull request y reescribir `main` (o empezar un repo nuevo con un solo commit limpio): reescribe la historia;
- darlas por expuestas.

**Propuesta para que no se repita (P, la decidís vos; no está implementada):** no subir commits de trabajo al repo público, y antes de cada push y en CI buscar las cifras del dueño, listadas en un archivo privado fuera de git.

### D-33 · Permisos mínimos para el servidor — D
En este proyecto, Supabase le otorga por defecto a `service_role` **todos** los privilegios sobre cada tabla nueva, incluido `TRUNCATE`, que vacía una tabla sin pasar por la auditoría. Se encontró al verificar los permisos reales después de aplicar la primera migración (el test local no lo detectaba porque no imitaba ese default). La migración `permisos_servidor` saca los defaults y otorga solo lectura y escritura fila por fila sobre los datos, y solo lectura sobre la auditoría y las vistas. Toda migración futura otorga sus permisos explícitamente. La base local de tests imita el comportamiento real de Supabase.

### D-34 · Revisión adversarial del schema antes de aplicarlo — D
Antes de aplicarse, el schema pasó por cuatro revisiones independientes (cobertura del spec, modelado financiero, Postgres/Supabase, flujo de días reales), y cada hallazgo por un verificador que intentó refutarlo. Quedaron 35 hallazgos confirmados (1 bloqueante, 10 importantes) y 19 descartados. Los confirmados se incorporaron: idempotencia y reversión de cargas, compra del día sin precio, saldos negativos, operaciones en USD, capital pendiente del leasing para la fase 1, cuotas con IVA separado, fecha de origen en las aperturas, niveles con unidad y varias órdenes, permisos explícitos, montos sin NaN. Después se ejecutó contra un Postgres local con 40 controles, que quedaron en `supabase/tests/`.

## UI

### D-30 · Mobile sin scroll horizontal — D
Requisito del dueño (2026-10-07), vale para toda la app:
- Ningún scroll horizontal en ninguna pantalla ni ancho.
- Debajo de 768 px, las tablas pasan a **tarjetas** (dato clave arriba, grilla de dos columnas, detalle al tocar). En desktop se mantiene la tabla densa del spec.
- Nada de texto superpuesto ni cortado en botones o etiquetas. Elementos tocables de al menos 44 px de alto.
- La navegación lateral pasa a barra inferior en mobile.

**Cómo se prueba:** un test de Playwright recorre todas las rutas a 360, 390 y 412 px, en claro y en oscuro, y falla si hay scroll horizontal, un elemento fuera del viewport, texto cortado o superpuesto, o un elemento tocable de menos de 44 px. Además, inspección visual con capturas de Chromium en viewport de teléfono, contra el deploy real. Una fase no se da por terminada con este test en rojo.

### D-31 · Stack — D
Se partió de la propuesta del dueño y se verificó cada afirmación (documentación, npm y mediciones propias). Detalle completo en `docs/stack.md`. Lo central:
- **ECharts 6 como única librería de gráficos**: un solo tema y el mismo color por activo en toda la app. Se elige por sus funciones (zoom, marcas de niveles, treemap, eje log), no por el argumento de rendimiento de la propuesta, que no se sostenía.
- **Fuera:** Recharts, Lightweight Charts, Tremor (trae Recharts 2 y es de Tailwind v3), jStat (semilla global, sin mantenimiento), TanStack Query (el navegador no habla con Supabase).
- **Monte Carlo propio, reproducible:** PRNG sfc32 sembrado, t-Student armada como normal/gamma y cuantiles tipo 7 testeados contra numpy. Cada escenario guarda algoritmo y semilla.
- **decimal.js solo en la contabilidad.** El Monte Carlo corre en float64.

### D-32 · Montos exactos de punta a punta — D
PostgREST serializa `numeric` como número JSON, y supabase-js lo convierte a `float64` antes de que el código lo vea. Por eso:
- Toda lectura de montos se hace con `::text`, sin `select('*')`.
- Las vistas devuelven texto.
- El parser de plata solo acepta strings y falla si recibe un número.
- La escritura manda strings de Decimal.

Además, los checks de montos excluyen `NaN` e `Infinity` (`x > 0 and x < 'Infinity'`), que un `check (x > 0)` deja pasar.

## Fase 1a (08/10/2026)

Decisiones que se tomaron al construir la primera versión usable. No implementan propuestas pendientes, así que quedan como decididas (D). Si alguna no te cierra, se reemplaza con una nueva, como cualquier otra. Las propuestas de la investigación y de la visión que la 1a ya usa están en la sección siguiente, como provisorias.

### D-104 · Carga transaccional por lote — D
Con supabase-js cada insert es un pedido HTTP separado, sin atomicidad (`docs/datos.md`, regla 3). Por eso toda escritura de más de una fila pasa por una función de Postgres que corre en una sola transacción.
- **Un Enter = un lote.** El lote tiene una carga por cuenta y otra para el tipo de cambio tipeado. Lo graba `confirmar_carga` entero o no graba nada.
- **El lote es la llave de idempotencia.** Un doble Enter o un reintento devuelven lo ya grabado ("Ya estaba guardado") sin duplicar nada. Un lote revertido no se vuelve a usar: después de Deshacer, la carga siguiente lleva un lote nuevo.
- **Recargar el mismo día una cuenta reemplaza su carga:** pisa los precios y saldos de ese día y esa cuenta y **suma** las operaciones, porque la conciliación de la segunda carga ya cuenta las de la primera y solo propone lo que falta. La carga anterior queda en el Registro como `reemplazada`. Si la primera carga estaba mal, lo correcto es revertirla, no recargar.
- **Un tipo de cambio con todos los valores vacíos no es un dato:** no se graba ni pisa nada.
- **Revertir es por lote** (`revertir_lote`), con motivo obligatorio, y solo si cada carga del lote es la última de su cuenta. Si no, el mensaje nombra la carga posterior que lo impide. Para cada fila del lote, recorre su historia en la auditoría y restaura la última versión que no venga del lote ni de una carga revertida; si no hay, borra la fila. Las compras cuyo precio había completado el lote vuelven a quedar pendientes (D-110). Las cargas quedan en el Registro como `revertida`, con el motivo, y la última carga no revertida de ese día y cuenta vuelve a `vigente`.
- Un lock serializa todas las escrituras de cargas: dos Enter a la vez esperan su turno.
- El tiempo activo (D-62) se guarda en cada carga del lote, porque es un dato del lote.
- Las altas de Datos usan funciones con la misma regla: `guardar_manual` (valuaciones, capital pendiente y movimientos de capital: una carga `manual` por guardado, idempotente por lote), `alta_activo` y `editar_activo` (el activo y su ratio juntos: nunca queda un CEDEAR sin ratio). El ratio de un CEDEAR que se da de alta rige desde hoy, en hora de Córdoba.
- **Descartado:** grabar con inserts sueltos desde el servidor (una falla en el medio deja medio día grabado) y reemplazar las operaciones al recargar (borraría una operación real del día).

*Ajustada por D-119, D-120 y D-124 (revisión de la 1a):* recargar el mismo día conserva el tipo de cambio que no se tipeó y el precio que ya grabó un Excel; el mismo lote con otro contenido se rechaza en vez de decir "Ya estaba guardado"; y la base también rechaza un CEDEAR sin ratio.

### D-105 · Cada archivo se lee en el servidor, se guarda al leerlo y la lectura va firmada — D
- Cada archivo viaja solo a `POST /carga/leer` (un Route Handler), en paralelo con los demás: el Excel y las dos capturas se leen a la vez (unos 10 s en lugar de 20). Va uno por pedido porque Vercel corta los pedidos de más de 4,5 MB, y la ruta rechaza archivos de más de 4 MB.
- Mientras se lee, el archivo se guarda en el bucket privado `cargas`, en `AAAA/MM/<sha256>.<ext>`. Si ya estaba (mismo sha256), se reusa. Así el Enter manda solo texto.
- La lectura vuelve **firmada** (HMAC, con una clave propia de las lecturas, distinta de la de la sesión: D-112). Al guardar, el servidor verifica la firma: la `lectura_cruda` que se graba es la que devolvió el lector en el servidor, nunca una armada por el navegador (la garantía que pide D-63).
- Al guardar, el servidor **vuelve a armar la propuesta contra la base** de ese momento y recién ahí arma la confirmación. Si entre la lectura y el Enter cambió algo, manda la base.
- **Costo conocido:** un archivo leído y nunca confirmado queda en el bucket sin ninguna carga que lo use. Falta el trabajo que borra esos huérfanos (D-63).
- **Descartado:** leer con Server Actions (Next las despacha de a una: la lectura tardaría el doble) y subir los archivos al confirmar (habría que reenviarlos y volvería el límite de 4,5 MB).

### D-106 · La bandeja: los errores frenan el Enter y las advertencias se aceptan de a una — D
Implementa D-47 (provisoria) con estas reglas:
- **Verificada:** la graba el Enter.
- **Advertencia:** el Enter general nunca la acepta. Se acepta con uno de sus botones, y la opción elegida es el motivo, que queda grabado. Si llegás al Enter sin tocarla, queda **pendiente** y el botón lo dice: "Guardar 9 · dejar 2 pendientes".
- **Error:** frena el Enter ("Resolvé 1 error para guardar") hasta que lo corrijas o lo dejes pendiente.
- **Ticker sin alta:** no se graba hasta que lo des de alta, ahí mismo, sin salir de la carga.
- Una fila pendiente no se graba y su cuenta queda con `listado_completo = false`.
- Mientras una fuente se lee, el botón dice "Esperando Mercado Pago (leyendo…)" y al lado aparece "Guardar sin Mercado Pago": lo que no se guarda queda dicho.
- Enter en el campo del CCL con el cripto vacío pasa al cripto: el "siguiente" del teclado del teléfono no guarda a medias.
- Si dos cuentas traen el mismo activo el mismo día, se graba un solo precio, el del Excel, y el otro queda anotado en lo grabado: la clave de `cotizaciones` es fecha + activo.
- Si la app tiene una posición que el Excel no trae, la bandeja la muestra y solo permite dejarla pendiente. No se inventa una venta.
- Una elección vale para la propuesta sobre la que se hizo: si la bandeja se rearma (por un alta o una lectura nueva), las elecciones que ya no aplican se caen.

*Ajustada por D-117, D-118, D-119 y D-122 (revisión de la 1a):* una posición que la fuente no trae ya no solo se deja pendiente: se registra su venta o su vencimiento, o se deja pendiente y vale "sin dato". Una carga que deja algo pendiente pone su cuenta en ≠ "parcial". El precio del Excel vale también contra una captura de otra carga del mismo día. Una fuente que no graba nada no crea su carga.

### D-107 · Lector del Excel de IEB (`ieb-excel@1`) — D
Implementa D-37 y D-38 (provisorias). Sin IA.
- **Números:** cada número del Excel se lee una vez con 15 cifras significativas, la precisión de Excel, y de ahí en más es decimal exacto. El ruido binario del archivo no entra (10.118.700,000000002 pasa a 10.118.700). La lectura cruda guarda el número tal como venía.
- **Fecha (B1):** IEB guarda el día como las 03:00 UTC. Si la celda no tiene hora, vale ese día tal cual. Si tiene, vale el día en Córdoba, y si no coincide con el que muestra Excel, la bandeja lo avisa.
- **Tolerancia de una fila (D-37):** cantidad × escala × medio último dígito del precio (según el formato de la celda) + medio último dígito de la posición. La cantidad se toma como exacta. Si ninguna escala cierra, la fila es error y muestra la escala más cercana. Si cierran varias (una posición de menos de un centavo, o cantidad 0), es advertencia y vale la escala habitual de la sección.
- **Controles (D-38):** cada Subtotal contra la suma de su sección, con medio centavo por término. B2 contra todas las posiciones + saldo Total en pesos + saldo Total en dólares × precio de DOLARUSA; su tolerancia propaga ese producto. Si falta un término, el control queda **no verificable**, con el motivo, y nunca cuenta como OK.
- **Lo inesperado:**
  - una sección que no es Acciones, Bonos, Cedears ni Otros se lee igual, con advertencia (Letras, Obligaciones Negociables y Fondos tienen su tipo);
  - un ticker repetido deja sus dos filas en error;
  - un PPP de 0 o negativo es "sin dato";
  - un número guardado como texto se lee en formato es-AR, con advertencia;
  - un saldo en "USD Ext." se avisa y no se suma;
  - un archivo que no es el Portafolio se rechaza con un mensaje que dice qué le falta.

*Ajustada por D-123 (revisión de la 1a):* un precio de 0 tampoco se graba, y si B2 o un Subtotal no cierran, nada de lo que controlan queda verificado.

### D-108 · Lector de capturas (`captura-claude@1`) — D
Implementa D-36 (provisoria) para Galicia y Mercado Pago.
- **Dos lecturas en paralelo, distintas en modelo y en pedido:** A, `claude-opus-5-5`, recorre la pantalla fila por fila; B, `claude-sonnet-5-5`, recorre la tabla columna por columna. Se cambian con `ANTHROPIC_MODEL_A` y `ANTHROPIC_MODEL_B`.
- **El pedido:** esfuerzo bajo (la tarea es transcribir, no razonar: controla la aritmética), salida estructurada con un schema y sin herramientas.
- **La imagen va intacta:** nunca se recomprime ni se achica. Si pasa cualquiera de los dos límites de la API (2.576 px de lado mayor, o 4.784 parches de 28 × 28 px, unos 3,7 megapíxeles), se rechaza y el mensaje aconseja recortar la tabla o mandarla en dos partes. Una captura de pantalla completa de 2560 × 1600 ya pasa el segundo (corregido el 14/10: antes decía solo el lado mayor).
- **50 s por lectura**, reintentos incluidos, para que el error llegue a la pantalla antes de que Vercel corte (60 s). Si una lectura falla, la otra se cancela.
- **Ante una negativa del modelo,** el servidor de la API puede pasar a otro modelo (función beta). Se apaga con `ANTHROPIC_FALLBACK=no`. El modelo que realmente contestó queda en el lector y en la lectura cruda.
- **Cuando las lecturas no coinciden, decide la aritmética:** se prueba cada combinación de las celdas que difieren y se propone la que cierra; la fila queda en advertencia, con las dos lecturas a la vista para elegir con un toque. Si ninguna combinación cierra, la fila es **error**, no advertencia (D-11).
- Un número ilegible queda vacío, con su motivo. Nunca se adivina.
- **Mercado Pago:** el saldo es verificado solo si las dos lecturas coinciden. La TNA se guarda solo si las dos ven la misma, en porcentaje ("29.5" es 29,5%). La fecha de cualquier captura se toma solo si las dos la ven completa, con año.
- **Galicia:** el PPC preciso es (valorizado − rendimiento $) ÷ cantidad; se controla contra el PPC mostrado y contra el rendimiento %. El total de la captura es un control.
- Un fondo sin código usa su nombre como ticker hasta que existan los alias por bróker (CA-6, 1b).
- **La imagen es dato, no instrucciones:** el pedido lo dice, los campos de más se descartan y la aritmética decide igual.

*Ajustada por D-123 (revisión de la 1a):* lo que Galicia muestra en dólares no se graba en la 1a; el ticker de un fondo sin código es su nombre con guiones; si las lecturas no se ponen de acuerdo en el banco, la pantalla pregunta de cuál es; y corregir a mano una cantidad vuelve a armar el PPC.

### D-109 · Un día sin CCL tipeado usa el último, con su fecha — D
- **Para valuar,** un día sin CCL tipeado usa el último CCL tipeado. La traza muestra de qué fecha es, y pasados 2 días hábiles lleva la etiqueta "viejo", igual que un precio (D-16).
- **Para atribuir, no:** en un intervalo sin un CCL tipeado no se atribuye nada a activo ni a CCL. El cambio queda "sin atribuir" hasta que llegue uno (D-35).
- **Ajusta D-18** ("valor en USD = valor en pesos ÷ CCL del día"): el CCL del día pasa a ser el último tipeado hasta ese día, con su fecha a la vista.
- **Por qué:** si cualquier día sin CCL fuera "sin dato", una carga con solo el Excel dejaría todo el patrimonio en dólares en "sin dato". Y si el CCL viejo se usara a escondidas, el movimiento del dólar se leería como movimiento del activo. Así el número existe, dice de cuándo es su CCL y el desglose no inventa nada.
- **Descartado:** estimar el CCL o traerlo de una API (D-07).

### D-110 · Compra con precio pendiente: se valúa "inferida" y la carga siguiente propone completar el precio — D
Completa D-19.
- **El día de la compra** (PPP `-` en IEB), la cantidad cuenta y la compra se valúa al precio de ese día, con la etiqueta "inferido" y su motivo, para que el total del día sume exacto. El PPC de la posición queda "pendiente".
- **La carga siguiente que trae el PPP propone completar el precio:** (PPP₁ × q₁ − PPP₀ × q₀) ÷ Δq, con la fórmula a la vista (si hubo ventas en el medio, se descuenta el costo que sacaron). Se acepta en la bandeja, como cualquier advertencia, y nunca se aplica sola. La base lo graba como un cambio auditado de esa compra, y solo si sigue pendiente y es de esa cuenta.
- **Además de aceptarlo** ("Completar"), se puede tipear otro precio ("Editar precio") o grabar la fila sin completar: se graba el precio del día y la compra sigue pendiente. El precio inferido no se redondea, y antes de proponerlo se verifica que con él el costo de la posición dé PPP₁ × q₁, con las mismas reglas de costo que usa Cartera.
- **No propone nada, y lo dice,** si hay más de una compra pendiente en la misma posición (un solo PPP no alcanza para separarlas), si la compra es en dólares, si otra parte de la tenencia no tiene costo, o si el resultado no es un precio positivo (¿un cambio de ratio, una operación sin registrar?). La compra sigue pendiente.
- **Revertir** la carga que completó el precio deja la compra pendiente otra vez.
- **Al completarse el precio,** los días que usaron el precio inferido se recalculan con el real: su frase y su desglose pueden cambiar un poco. Es el costo de que el total de cada día sume exacto mientras tanto.
- **Por qué:** sin esto, toda compra hecha con PPP `-` quedaba con su costo "sin dato" para siempre.

### D-111 · Movimientos de capital: se cargan en Datos › Movimientos — D
Ajusta D-06.
- Aportes, retiros y transferencias entre cuentas propias se cargan en **Datos › Movimientos**, cada uno como una carga manual (`guardar_manual`), con fecha, cuentas, montos, tipo de cambio aplicado e impuesto.
- En Cargar no hay un campo para esto en la 1a. Cuando un saldo remunerado (con TNA en la captura) sube más de lo que explica su rendimiento, o baja, la bandeja pregunta "¿Entró o salió plata?" y enlaza a Datos › Movimientos con el aporte o el retiro precargado. El efectivo del bróker no pregunta.
- **Por qué:** D-06 lo ponía como un campo opcional de la carga diaria. En la 1a se carga donde viven los demás hechos manuales, y la pantalla del día queda con lo de todos los días: casi nunca se mueve plata.

### D-112 · Seguridad de la 1a: una clave, sesión de 30 días y modo demo nunca en producción — D
Detalla D-20 y D-21.
- **Una sola clave,** `APP_PASSWORD`. La sesión es una cookie `httpOnly`, `SameSite=Lax` y `Secure` en producción, firmada con HMAC-SHA256, que dura 30 días.
- **La cookie se firma con una clave derivada,** nunca con la clave en crudo. Con `SESSION_SECRET` (recomendado: 32 bytes al azar), la clave maestra es un HMAC de `SESSION_SECRET` y `APP_PASSWORD`; sin él, sale de `APP_PASSWORD` con PBKDF2-SHA256 de 210.000 vueltas, lento a propósito para que probar claves contra una cookie robada salga caro. De la maestra sale una subclave por propósito. Las lecturas de Cargar se firman con otra clave (D-105). Cambiar `APP_PASSWORD` o `SESSION_SECRET` cierra todas las sesiones.
- **`src/proxy.ts` protege toda ruta** salvo `/login` y los archivos estáticos de Next. Una página sin sesión manda a `/login?desde=…`. Un POST sin sesión recibe 401. Cada Server Action y la ruta de lectura vuelven a verificar la sesión: el proxy es la primera barrera, no la única (D-57).
- Después de entrar, la app vuelve solo a rutas propias: nunca a otro sitio.
- **Freno a los intentos:** una clave equivocada tarda 800 ms en contestar. Desde el tercer error seguido del mismo origen, la entrada además queda trabada un rato que se duplica con cada error (1 s, 2 s, 4 s…, hasta 5 minutos). La comparación de la clave no filtra nada por tiempos. Mirar la traba y anotar el intento van en un solo paso, antes de comparar la clave: una ráfaga de pedidos en paralelo prueba como mucho 3 claves, igual que en serie, y trabada ni la clave correcta entra; si la clave era la correcta, el origen queda limpio (corregido el 14/10: antes, en paralelo, se probaban todas). Es un freno por instancia y por IP: otra instancia de Vercel arranca de cero.
- Sin `APP_PASSWORD` configurada, nadie entra, y la entrada dice "Falta configurar APP_PASSWORD en Vercel."
- **Modo demo** (`PORTFOLIO_DEMO=1`): datos inventados y sin clave, para desarrollar y para los tests de layout. En producción se ignora (si Vercel dice que el entorno es producción). Fuera de ella anda, también en un Preview de Vercel y con `next start`: por eso `PORTFOLIO_DEMO` no se carga en ningún entorno de Vercel. En modo demo ninguna pantalla, acción ni ruta lee o escribe la base (corregido el 14/10: antes decía "solo local").
- La base sigue cerrada al navegador (D-20): solo el servidor la toca, con la clave secreta de Supabase.
- **Content-Security-Policy con un nonce por pedido** (la arma `src/proxy.ts`): solo corren los scripts de la propia app, nada se conecta ni carga desde otro sitio y nadie puede meter la app en un iframe. Por eso toda página se arma por pedido.
- **Control de origen:** todo pedido que cambia algo (POST, también a un Route Handler) que no viene de la propia app recibe 403, antes de mirar la sesión.
- **Encabezados de seguridad** en toda respuesta (`next.config.mjs`): sin iframes, solo HTTPS (HSTS), `nosniff`, sin permisos de cámara, micrófono, ubicación ni pagos, `noindex` para buscadores, y sin el encabezado que dice que es Next.

### D-113 · Interfaz de la 1a — D
- **La frase en el teléfono** se lee de corrido, y "Ver la frase completa y cada cifra" abre una hoja con cada número en su renglón tocable. Los números dentro del texto no llegan a 44 px sin romper el renglón (D-30).
- **Cartera, prioridad de columnas (D-68):** además del orden de la visión, una red de seguridad oculta columnas del final si con los datos reales igual no entran. La tabla tiene 13 columnas. A 1280 px con la barra lateral expandida entran 7, y a 1600 px, 10; las otras van al detalle de la fila. Colapsando la barra entran más. Todas entran desde unos 1910 px (1730 px con la barra colapsada). (Corregido el 14/10: antes decía 11 columnas, todas desde 1600 px.) **Reemplazado por D-161** (rediseño del 15/10): Posiciones es una grilla de 11 columnas, y a 1440 px entran todas.
- **Exposición:** la composición va en barras horizontales hechas con CSS. ECharts (D-31) entra con los primeros gráficos de verdad, en la 1b.
- **El chip de datos** ("5 de 5 fuentes") cuenta como al día las fuentes ✓ y las ○ (tipeadas, sin control posible, como el CCL).
- **La traza** se abre con clic, toque o teclado. Con hover, todavía no.

### D-114 · Renta y amortización en Cartera — D
- **La amortización devuelve capital:** baja el costo de la posición en lo cobrado, en pesos y en dólares (al CCL de ese día), sin pasar de cero. Una amortización deja de verse como pérdida.
- **La renta (cupón o dividendo) no toca el costo:** se ve en la frase del día en que se cobra, porque pasa del título a la caja. El resultado de una fila de Cartera es el del título, sin los cupones cobrados.
- **Por qué:** con la regla anterior, un bono que amortizaba el 50% aparecía en Cartera con −50%. Sumar los cupones al resultado de la fila queda para Rendimientos (fase 4), que mide lo realizado.

### D-115 · Conciliación de cargas atrasadas y de cambios de ratio — D
Completa D-15.
- **Una carga se concilia contra las tenencias al cierre de su fecha,** nunca contra operaciones posteriores. Si ya hay una carga posterior de esa cuenta, la bandeja lo dice en la propuesta y en cada operación que propone ("si ya quedó registrada ahí, dejala pendiente").
- **Una apertura que ya existe** (con fecha posterior) no se vuelve a proponer, porque la base admite una sola por tenencia: la fila graba solo el precio.
- **Más cantidad con el mismo costo total** se propone como "¿Cambio de ratio?", con un `ajuste_ratio` sin precio (cambia la cantidad y no el costo), a revisar. El umbral: al menos 10% más cantidad, y PPP × cantidad igual al costo de la app dentro de lo que redondea el PPP mostrado, o del 1%.
- **Un precio inferido del PPP** nunca se propone si no es mayor que cero.
- **Por qué:** una carga atrasada proponía ventas que no existieron, y un split proponía una compra a precio 0 que la base rechaza.

### D-116 · Una migración que el conector no puede aplicar la aplica el dueño desde el editor SQL — D
El conector de Supabase pide confirmar toda sentencia que contenga `DELETE`, aunque esté dentro del cuerpo de una función, y en las sesiones de trabajo ese pedido vence sin llegar a nadie.
- **Quién la aplica:** el dueño. Pega el archivo entero, sin cambios, en el editor SQL del proyecto y toca Run. Sigue siendo la migración del repo, no SQL suelto.
- **Después:** se registra en `supabase_migrations.schema_migrations` con la versión del nombre del archivo, se verifica contra el repo (md5 del cuerpo de cada función, normalizando el fin de línea, porque el editor guarda CRLF) y se regeneran los tipos (`docs/datos.md`).
- **Descartado:** reescribir el SQL para que el conector no detecte el `DELETE`. Esa confirmación es un control y le corresponde al dueño.
- **Primera vez:** `carga_revertir`, el 08/10.

## Revisión de la 1a (14/10/2026)

Después del primer despliegue, la 1a pasó por una revisión adversarial (revisores independientes que buscan errores y un verificador que intenta refutar cada uno) y por una ronda de arreglos, cada uno con un test que falla sin el arreglo. Estas decisiones se tomaron en esa ronda, y el código ya las implementa. Las que tienen una alternativa razonable esperan la confirmación del dueño y van como **P (provisoria, a confirmar)**: si rechazás una, se cambia el código. Las que solo aplican una regla ya decidida (como "sin dato, nunca cero") van como **D**.

### D-117 · Una tenencia que la fuente deja de listar se registra, o vale "sin dato" — P (provisoria, a confirmar)
Ajusta D-106 ("solo permite dejarla pendiente"). Completa D-47 y D-65.
- **Cuándo:** la app tiene una tenencia en una cuenta y la fuente no la trae: una venta total o un vencimiento que no registraste. El Excel de IEB lista todo. Una captura solo cuenta para lo que cubre: la sección y la moneda de un total que cierra. Una tenencia que quedó pendiente en una carga anterior sigue ausente aunque la captura de hoy no cubra su sección.
- **Qué propone la bandeja:** "Registrar venta" o, en un bono o una LECAP, "Registrar vencimiento" (sugerido si ya venció o no se sabe cuándo vence), por toda la cantidad que tiene la app. Lo cobrado lo tipea el dueño: el importe en un vencimiento, el precio o el importe en una venta. El último precio se muestra solo como referencia. Lleva el CCL del día. La otra opción es "Dejar pendiente". Nunca se aplica sola (D-15).
- **Si queda pendiente** (o si guardás sin tocarla), se guarda en lo grabado de la carga, con su activo y su cuenta, y la tenencia vale **"sin dato"**: "IEB ya no la lista desde el mar 06/10: registrá la venta o el vencimiento en Cargar". Vale desde la primera carga de la racha: si la dejaste pendiente varios días seguidos, desde el primero. La racha se corta cuando una carga la vuelve a listar o registra la venta. Antes de esa fecha se valúa como siempre.
- **Qué se ve:** todo total que la incluye queda "sin dato · parcial", con la suma parcial (D-65); el cuadre, "no verificable"; Atención la muestra con gravedad alta y un botón a Cargar; Cartera, con ese motivo; la frase del día dice qué falta en vez de repartir cifras.
- **Por qué:** valuarla al último precio la contaba dos veces (la plata de la venta ya está en el saldo) y leía la venta como ganancia del día, con el cuadre en ✓.

### D-118 · Una carga que dejó algo sin grabar deja su cuenta en ≠ "parcial" — P (provisoria, a confirmar)
Completa D-47 y D-106.
- **Cuándo:** la carga vigente más reciente de una cuenta tiene `listado_completo = false`: quedó pendiente una fila, un saldo, un ticker sin alta o una tenencia que la fuente ya no lista.
- **Qué pasa:** en el chip de datos esa fuente es ≠ ("Última carga: mar 06/10 · parcial: quedaron filas pendientes"); si además pasaron más de 2 días hábiles, ◷. Atención suma "IEB: la carga del mar 06/10 quedó parcial", con gravedad media y el botón a Cargar. Dura hasta la próxima carga de esa cuenta.
- **Los totales no cambian:** una fila pendiente de un activo conocido conserva su dato anterior (D-47), y una tenencia ausente pendiente ya vale "sin dato" (D-117). Solo una fila **sin alta** queda fuera de los totales sin que el total lo marque: lo dice Atención.
- **Alternativa:** que el total pase a "sin dato · parcial" cuando quedó una fila sin alta. Hace falta que la carga guarde cuántas filas sin alta quedaron, que hoy no guarda.

### D-119 · Recargar el mismo día conserva lo que no se tipeó, y el precio del Excel vale entre cargas — P (provisoria, a confirmar)
Ajusta D-104 y D-106. Migración `20261014193803_confirmar_carga_recarga`.
- **Tipo de cambio:** al recargar un día, un campo vacío no borra el valor que el día ya tenía. La referencia va con su CCL: un CCL nuevo trae la suya, o ninguna. La fila pasa a la carga nueva; revertirla restaura la anterior desde la auditoría.
- **Las operaciones** de una carga sin CCL tipeado usan el CCL que ese mismo día ya tiene cargado, nunca el de otro día. Como tipo de cambio se graba solo lo tipeado.
- **Un precio por activo y por día, también entre cargas:** si un Excel ya grabó el precio de un activo ese día, una captura posterior no lo pisa; queda anotada en lo grabado ("vale el de IEB, grabado antes hoy"). Un Excel posterior sí lo reemplaza.
- **Por qué:** recargar con un solo tipo de cambio borraba el otro, y una captura de la tarde pisaba el precio del Excel.

### D-120 · Un Enter reintentado se reconoce por su huella — P (provisoria, a confirmar)
Detalla D-104 ("el lote es la llave de idempotencia").
- Cada carga del lote guarda en lo grabado la **huella** (sha256) de lo que mandó el dueño: la fecha, las lecturas firmadas de las fuentes, sus elecciones y ediciones, los tipos de cambio, la referencia y la nota.
- **El mismo Enter otra vez** (por ejemplo, después de un corte de red) dice "Ya estaba guardado" con lo que de verdad quedó en la base, no con una propuesta rearmada contra una base que ya lo tiene.
- **El mismo lote con otro contenido** se rechaza: "Ese lote ya se guardó con otro contenido: lo que cambiaste después no se grabó. Tocá «Nueva carga» y volvé a armarla." La base repite el control, por si llegan dos Enter a la vez. Un error al guardar ofrece "Ver Registro" y "Nueva carga".
- **Por qué:** antes, el reintento decía "guardado" aunque hubieras cambiado algo, y lo cambiado se perdía sin aviso.

### D-121 · "Ya la tenía": una tenencia nueva en una cuenta ya cargada puede entrar como apertura — P (provisoria, a confirmar)
Completa D-14 y D-15.
- Una tenencia que la app nunca tuvo en una cuenta ya cargada se propone como compra (D-15) y, como otra opción, **"Ya la tenía (apertura)"**: entra como apertura con el PPP del bróker, sin CCL ni pago de hoy (D-14).
- Se ofrece en toda tenencia nueva de una cuenta ya cargada, porque la app no puede distinguir una compra de algo que quedó pendiente el Día cero. Elige el dueño.
- Como una apertura no necesita CCL, esa opción también destraba el error "Falta el CCL".

### D-122 · Una fuente que no graba nada no crea su carga — D
Si todo lo de una fuente queda pendiente, no se crea su carga: no reemplaza a la buena del día ni hace figurar la cuenta como cargada. Si declara tenencias ausentes pendientes, sí, porque eso es un dato (D-117). El resumen lo dice ("no se grabó nada… Lo que ya tenía del día sigue como estaba"), y si no queda nada para grabar, no guarda y lo dice: "Nada para guardar: todo lo de IEB quedó pendiente."

### D-123 · Lectores: lo que ajustó la revisión — P (provisoria, a confirmar)
Ajusta D-107 y D-108.
- **IEB, un precio o un PPP de 0** es "sin dato": no se graba como precio ni como costo, y la bandeja lo avisa.
- **IEB, si B2 no cierra,** todas las filas y los saldos de la cuenta pasan a advertencia, con el aviso arriba, y se aceptan de a uno. Si no cierra un Subtotal, las filas de su sección.
- **Galicia, lo que se ve en dólares** ("Bonos en dólares", U$D) no se graba en la 1a, porque la 1a guarda los precios en pesos: la fila queda en error, para dejarla pendiente. Los controles en dólares se muestran en US$. Alternativa: grabarlo en dólares, con una columna nueva de precio (una migración).
- **Un fondo sin código** usa como ticker su nombre en mayúsculas, sin tildes y con guiones ("FIMA-PREMIUM-CLASE-A"), igual todos los días. Si pasa de 30 caracteres, la fila queda en error: no se recorta, porque la clase A y la clase B chocarían. El catálogo acepta tickers de hasta 30.
- **Si las dos lecturas atribuyen la captura a bancos distintos,** la fila pregunta de cuál es ("Es de Galicia" o "Es de Mercado Pago") y la vuelve a leer con esa pista.
- **Corregir a mano la cantidad** de una fila de Galicia vuelve a armar el PPC con el rendimiento $: (valorizado − rendimiento $) ÷ cantidad. Si no redondea al PPC mostrado, o falta el rendimiento, la fila queda en advertencia: nunca verificada en silencio.
- **El precio implícito de una compra** en Galicia sale del costo total exacto, si la captura lo trae.
- **Mercado Pago:** la TNA es siempre un porcentaje, también si es de 1% o menos. Si las dos lecturas del saldo no coinciden, el que se propone dice "propuesta", no "cierra": no hay control que lo cierre.

### D-124 · Datos: un guardado reintentado no se duplica, y un bien o un pasivo se corrigen — P (provisoria, a confirmar)
- **Cada envío de un formulario de Datos lleva su lote:** el mismo envío reintentado trae el mismo lote y `guardar_manual` no lo duplica. Si se corta la conexión, el formulario se queda y dice "No sé si se guardó: se cortó la conexión. Mirá el Registro; si no está, volvé a guardar (el mismo envío no se duplica)."
- **Un bien o un pasivo con un dato equivocado** se corrige ahí mismo: "Corregir datos" en cada bien y "Corregir el contrato" en cada pasivo, con el formulario del alta ya completo. Es un cambio directo de la fila, que la auditoría guarda con el antes y el después. No es una carga: no aparece en el Registro ni se revierte desde ahí. Alternativa: una carga manual revertible, que necesita una función nueva en la base.
- **D-104 lo controla la base:** `alta_activo` y `editar_activo` rechazan un CEDEAR sin ratio, también al editarlo y cambiarle el tipo (migración `20261014193834_catalogo_cedear_ratio`).

### D-125 · La plata de una cuenta sin saldo cargado entra o sale de la app — P (provisoria, a confirmar)
Detalla D-66.
- **Regla:** si una cuenta no tiene ningún saldo cargado en una moneda hasta el fin del intervalo (Galicia no carga saldos), la plata de una compra, venta, vencimiento, renta o amortización en esa moneda es un flujo externo, como un aporte o un retiro. El cuadre cierra y la nombra con su monto: "Cuenta como plata que entró o salió de la app: compra de … en Galicia, $ … (Galicia no tiene saldo en pesos cargado)". Cuando aparece el primer saldo, entra como saldo inicial (B01) y el cuadre sigue cerrando.
- Pasa también con un dividendo en dólares de IEB si nunca cargaste su saldo en dólares.
- **El resultado del día no cambia:** los flujos nunca fueron resultado.
- **Por qué:** esa pata de caja no cae en ningún saldo de la app. El cuadre daba ≠ por un monto que no es un bug y que no hay forma de corregir, y el ≠ tiene que querer decir bug (D-66).
- **Descartado:** dejar ≠ con la explicación. Se revisa junto con el perímetro por cuenta (D-102).

### D-126 · Lo que falta no se reemplaza por lo que hay: total, deuda y sumas sin partes — D
Aplica D-65 y "sin dato, nunca cero".
- **Sin bienes o sin leasing cargados,** el patrimonio total y su variación son "sin dato · parcial", con la suma de lo cargado. Antes repetían el financiero. Un bien dado de baja no cuenta como faltante.
- **Sin ningún pasivo cargado,** la deuda en pesos es "sin dato" (antes, $ 0), y el neto de Exposición, su sensibilidad y su porcentaje, "sin dato · parcial". Con pasivos cargados y ninguno en pesos, la deuda en pesos es $ 0, porque se sabe.
- **Un leasing sin capital pendiente cargado pero con su cuadro de marcha** resta la deuda según el cuadro, con la etiqueta `estimado` (revisión de D-131 en la entrega 4). Si al contrato le falta lo que necesita su tasa (el monto financiado neto o la fecha de desembolso), la según cuadro es "sin dato" con ese motivo, y cuenta la deuda cargada, si hay; si no, sigue siendo "sin dato".
- **Una suma sin ninguna parte conocida** es "sin dato", sin la etiqueta `parcial` ni "suma parcial (0 de 1): $ 0,00": dice qué falta (el motivo de la parte, si todas faltan por lo mismo, o "Faltan N partes"). Vale para toda suma del motor; por ejemplo, la deuda de un leasing sin capital pendiente.
- **Si el resultado de una fila de Cartera es "sin dato"** (una compra con precio pendiente, una tenencia ausente), las tres partes de su desglose también, con el mismo motivo. Excepción: con una apertura sin CCL de compra, el desglose en dólares no se arma y la pantalla dice por qué.

### D-127 · El aviso de la carga del día espera al cierre de BYMA — P (provisoria, a confirmar)
- El punto de Cargar y "Todavía no cargaste hoy" aparecen un día hábil sin carga **desde las 17:00 de Córdoba** (`CIERRE_BYMA`, en `src/components/calculos.ts`). Antes de esa hora, los datos del día todavía no existen. Una vista de otro día cuenta como cerrada. El modo demo no mira la hora.
- **Alternativa:** avisar a la mañana cuando falta la carga del día hábil anterior. Hace falta que la vista traiga el último día hábil cerrado, con los feriados. Queda para si el dueño lo pide.

### D-128 · Interfaz: lo que decidió la revisión — P (provisoria, a confirmar)
Detalla D-113.
- **La frase del día lleva verbo** en las dos oraciones, según el signo: "En pesos, el CCL sumó $ X y tus activos sumaron $ Y. En dólares, tus activos sumaron US$ Z y la suba del CCL le restó US$ W a tus pesos", como la citan la visión y el manual. La suba o la baja sale de comparar los dos CCL. Si falta una partida, la frase dice cuál y por qué en vez de repartir cifras que no existen.
- **Una dirección que no existe** muestra "No encontré esa página" dentro del marco de la app (barras, título, ojo y tema) y sin el chip de datos, porque el marco no lee la base. Una ruta que el proxy deja pasar sin sesión (`/login/…`, `/icons/…`) ve ese marco vacío, y sus links mandan a entrar.
- **Los decimales de un insumo en la traza** son los del valor, con un mínimo de 2 y un tope de 2, 4 o 6 según su magnitud, como un precio. Un monto calculado se ve al centavo.
- **Los montos compactos llevan signo** cuando se pide ("+$ 6,2 M"), salvo que redondeen a cero.
- **En el Día cero, la acción principal es Datos › Leasing,** el paso 1 del manual, y "Hacer la primera carga" va segunda, aunque ya hayas cargado Datos.
- **El interruptor apagado** (Modo privado) lleva la perilla gris media y el borde del mismo tono, con contraste de 3:1 o más (WCAG 1.4.11).
- **Datos tiene un h1 "Datos"** solo para el lector de pantalla; la subpantalla la dice el selector que sigue. Cada bien y cada pasivo lleva su h2.
- **La pantalla de error no promete nada:** "Si estabas guardando algo, no sé si se guardó: mirá el Registro antes de volver a intentar", con "Ver el Registro". La misma pantalla sale por errores de lectura, donde no hubo guardado.
- **Registro:** un guardado de Datos se llama "Datos", su origen es "manual" y dice qué grabó, también en el resumen del lote y al revertir. El CCL y el cripto siguen como "tipeado". Si guardaste otro día que el de los datos, la tarjeta lo dice.
- **Carga express:** "de tus US$ …", la suma de tus dólares en efectivo de la carga anterior, es una cifra de la frase, con su traza. En la hoja del teléfono va sin signo: es un saldo, no una variación.
- **Cartera con mouse:** no se adopta el tamaño mínimo de 24 px de WCAG 2.2. El proyecto se mide con WCAG 2.1 AA y, con mouse, el objetivo es la fila entera (D-100).

### D-129 · Feriados: los días sin rueda, cada uno con su fuente oficial — P (provisoria, a confirmar)
Detalla D-16. Migración `20261014203031_feriados_2026_2027` (49 días). Encaja con D-45 (tres calendarios, 1b): `AR` va a ser BYMA y `US`, NYSE.
- **`AR` son los días de semana en que BYMA no negocia:** los feriados nacionales (Ley 27.399, con los trasladables en su lunes, y los que se decreten en el año) y los días que el calendario de BYMA marca sin negociación ni liquidación, como el 31/12. Un día en que BYMA negocia aunque no liquide (un no laborable con fines turísticos, el Día del Bancario, Nochebuena) no es feriado: ese día hay precios nuevos y cuenta para "viejo". Los feriados bancarios no van acá.
- **`US` son los cierres de la NYSE,** con el día observado (por ejemplo, el vie 3/7/2026 por el 4 de julio). Un cierre temprano no es feriado.
- **Sábados y domingos no se cargan:** ya no son hábiles.
- **Solo entra lo confirmado con una fuente oficial** (la ley, el decreto o la resolución del año, el calendario de BYMA y el de la NYSE), con las fuentes en el encabezado de la migración. Ante la duda, el día queda afuera. Por eso entra el lun 9/11/2026 (feriado nacional por decreto) y quedan afuera el 10/11 y el 11/11/2026 hasta que BYMA diga cómo opera; de 2027, solo lo que fija la ley.
- **Mantenimiento:** cada diciembre, una migración nueva con el calendario de BYMA y los no laborables del año siguiente; un día suelto, cuando se confirma. Cargar un feriado desde la app ("Hoy no operó el mercado") llega en la 1b.
- **Por qué:** "viejo" mide días con mercado. Contar como feriado un día con rueda esconde un precio atrasado; contar como hábil un feriado solo adelanta el aviso.
- **Descartado:** date-holidays (no sabe qué hace BYMA cada día ni trae los días que se decretan en el año) y calcular los feriados en vivo.

### D-130 · El Día cero del dueño se cargó desde la base, con las funciones de la app — D
- **Qué pasó:** el 14/10 el dueño pasó sus archivos y sus datos en el chat, en vez de usar Cargar. Claude, desde la sesión de desarrollo, cargó el Día cero directo en la base, con las mismas funciones que usa la app: `alta_activo` para el catálogo, `confirmar_carga` para la primera carga, `guardar_manual` para las valuaciones, y los mismos inserts de `crearBien` y `crearPasivo` para los bienes y el contrato del leasing. Cada fila pasó por la auditoría, igual que si la hubiera grabado la app.
- **El Excel de IEB** se leyó con el lector de la app (`ieb-excel@1`), con sus controles. Desde SQL no se puede subir un archivo al bucket `cargas`, así que su carga también va con origen `manual` y sin archivo (`archivo_path` null; la base no acepta un origen `excel` sin archivo), y el sha256 del Excel queda en la lectura cruda. El dueño conserva el archivo.
- **Las capturas** se transcribieron: van con origen `manual` y lector "transcripción de captura (sin imagen)". Es una sola lectura, no las dos de D-108, así que sus filas entraron como advertencias aceptadas, no como verificadas.
- **Las imágenes no se guardaron:** llegaron por el chat. De cada captura queda en la lectura cruda la transcripción, con su sha256.
- **El CCL de ese día** lo buscó Claude en una fuente pública, porque el dueño lo pidió ("lo que te falte buscalo vos en internet"), y la fuente quedó en la referencia del CCL. Fue una búsqueda a mano, una sola vez: la app sigue sin traer precios ni tipos de cambio de afuera (D-07).
- **Un leasing no tiene "capital pendiente"** como un préstamo. El dueño le va a pedir a la leasera el valor de cancelación anticipada sin la penalidad. Mientras tanto, por decisión del dueño, la deuda es un estimado provisorio (D-131).
- **Un vehículo sin valor en la guía de precios** se puede valuar a la suma asegurada de una cotización del seguro, con esa fuente en la valuación (D-04).
- **Por qué así:** con las mismas funciones, esos datos cumplen las mismas reglas y tienen la misma trazabilidad que una carga hecha con la app, y lo que no salió de un archivo leído por la app lo dicen su origen y su lector. Lo normal sigue siendo Cargar (D-104 a D-108).

### D-131 · La deuda del leasing, mientras la leasera no informe el valor de cancelación: un estimado que aprobó el dueño — P (provisoria, a confirmar)
- **Qué es:** el valor presente de las cuotas que faltan (el canon, neto de IVA) más la opción de compra, descontado a la tasa implícita del contrato. Lo calculó el dueño fuera de la app y el 14/10 aprobó usarlo como deuda provisoria.
- **Cómo se cargó:** como capital pendiente del leasing, con la fecha del cálculo, en una carga manual. Su fuente ("estimado, provisorio", la fórmula y la tasa) queda en lo grabado de esa carga.
- **Es una excepción que decidió el dueño, no una regla:** la app no calcula ni propone estimados, y sin este dato la deuda volvería a ser "sin dato" (D-126). Se reemplaza por el valor de cancelación anticipada que informe la leasera, sin la penalidad.
- **Hecho en la entrega 4:** la app calcula la deuda sola desde el cuadro de marcha, con su fórmula (la según el cuadro, abajo), y esa reemplaza al estimado apenas el contrato tiene su tasa. Que diga "estimado" en el número y en su traza: D-154.
- **Revisión del 15/10/2026 (entrega 4, Balance) — P (provisoria, a confirmar): el perímetro del patrimonio con un bien financiado.**
  - **La deuda de un bien financiado se toma en este orden:** la **informada** por el acreedor (en un leasing, el valor de cancelación sin la penalidad, D-130) › la **según el cuadro de marcha** (el valor presente de los cánones netos que faltan y de la opción de compra, a la tasa del contrato; la calcula Pasivos) › la **estimada** que aprobaste. Las dos últimas llevan `estimado` en la cifra, en todo lo que la incluye y en su traza, que dice de dónde sale (D-134).
  - **La cifra grande del Balance:** con la deuda informada, "Patrimonio neto" a secas. Con la según cuadro o la estimada, "Patrimonio neto · deuda del leasing estimada", con el chip `estimado`, y justo debajo, firme, "Sin la camioneta: financiero + casa", que no usa ningún estimado. Sin ninguna de las tres, la cifra grande es "Patrimonio neto sin la camioneta", con el chip `parcial`; el patrimonio completo queda "sin dato", con la suma parcial en su traza y la camioneta y su valor escritos al lado.
  - **Un bien financiado y su deuda entran o salen juntos:** se suma tu parte, valor − deuda (D-03); nunca el bien sin su deuda. Un leasing sin su bien cargado tampoco se resta solo: queda en el pasivo como "no se resta" y pide cargar el bien.
  - **Lo firme** es lo financiero más los bienes sin deuda que tienen valuación, menos las deudas que no financian un bien (una tarjeta, un préstamo). Un bien sin valuación sale de lo firme y se nombra ("sin la casa, que no tiene valuación").
  - **Por qué:** el estimado lo aprobaste vos y la casa tiene que verse como número; con la versión firme al lado, nadie confunde un estimado con un dato. El plan anterior suponía la deuda en "sin dato" y producción ya tenía un estimado.
  - **Una sola deuda en toda la app (integración, 15/10):** el mismo orden vale para el motor (Hoy, Exposición, Evolución), Pasivos y Flujo, no solo para el Balance. Las pantallas leen los hechos con la deuda según el cuadro de cada pasivo (`conDeudaSegunCuadro`, en `src/lib/vistas/integracion-pasivos.ts`), y el motor la usa en lugar de una estimada; a una fecha pasada, con las cuotas que estaban pagadas a esa fecha. Cargar y Datos siguen leyendo la deuda cargada.
    - **Por qué:** con el cuadro de marcha importado, Pasivos decía la según cuadro y el resto de la app la estimada del 08/10, que no baja con las cuotas. Eran dos deudas distintas, y la amortización no movía el patrimonio, contra lo que pidió el dueño el 14/10 ("solo la amortización afecta el patrimonio"). La según cuadro es la misma cuenta que el estimado, con la tasa del contrato y al día.
    - **Descartado:** informada › estimada › según cuadro (la primera versión de la integración): la estimada es de un día y queda congelada, y Evolución leía la cuota pagada entera como "no explicado".
    - **La informada gana aunque haya un estimado posterior** (la última informada hasta esa fecha), en el motor, Pasivos y Flujo: es el dato del acreedor.
    - **Entre cuotas, la según el cuadro sube un poco cada día** (es un valor presente a la fecha: corre el interés hasta la próxima cuota) y baja con cada cuota. En Evolución ese aumento va en la línea de la deuda del puente ("cambio de la deuda") y, como el estado de resultados cuenta el interés con la cuota, queda en "no explicado" hasta que vence (revisión de los arreglos, 15/10). **Para decidir:** tomar el saldo del cuadro después de la última cuota pagada (la deuda cambia solo con la amortización de cada cuota, como pidió el dueño, y el puente cierra sin "no explicado"); cambia la cifra entre cuotas (sin el interés que corre desde la última).
    - **Una sola fecha de corte: la de tu última carga** (revisión de pantallas, 15/10). El Balance, Hoy y Flujo están al cierre de tu última carga, y Pasivos toma la deuda que cuenta a esa misma fecha (la según cuadro, con las cuotas pagadas hasta ese día). Un valor que cargues con una fecha posterior (el formulario propone la de hoy) entra con tu próxima carga. Mientras tanto, Pasivos lo muestra aparte ("cuenta desde tu próxima carga"), y el Balance, en vez de pedirte que cargues el valor de la leasera, dice "Ya cargaste el valor de cancelación del …: entra con tu próxima carga". En un balance de una fecha pasada dice desde qué balance cuenta.
      - **Por qué:** el valor cargado hoy aparecía en Pasivos como la deuda que cuenta, y el Balance seguía con la estimada y te pedía cargar lo que acababas de cargar: dos deudas a la vez. Pasivos, además, calculaba la según cuadro a hoy y el resto a la última carga, y por eso daban cifras distintas de un día al otro.
      - **Descartado:** que la foto de la última carga tome los saldos y las valuaciones hasta hoy. Mezcla fechas en una misma foto: precios de ayer con la deuda de hoy, y el cambio "desde la última carga" de Hoy con un dato de otro día. Un saldo tampoco se guarda con la fecha de la última carga: la fecha es la del acreedor.

### D-154 · Un saldo de deuda dice si lo informó el acreedor o es un estimado — P (provisoria, a confirmar)
- **Qué pasaba:** `pasivo_saldos` no distinguía un valor informado de un estimado. El estimado que el dueño aprobó el 14/10 (D-131) se restaba en el patrimonio total y en Exposición sin ninguna marca, y su traza decía "capital pendiente informado" y "según el acreedor". Era un estimado presentado como dato.
- **Qué cambia:**
  - cada saldo tiene `naturaleza`, `informado` o `estimado`, y `fuente`, que es obligatoria para un estimado;
  - el saldo que ya había quedó marcado como estimado, con la fuente que estaba en lo grabado de su carga;
  - `guardar_manual` exige la naturaleza de cada saldo.
- **Cómo se ve:**
  - la deuda estimada lleva la etiqueta `estimado`, que se propaga a toda cifra que la incluye: el patrimonio total de Hoy y su variación, la deuda y el neto de Exposición;
  - su traza dice "deuda estimada" y "Cómo se estimó";
  - Datos › Leasing la muestra con su chip, su fecha y su fuente.
- **Cargar el valor real:** el formulario de Datos › Leasing es el del valor que informa el acreedor (en un leasing, el de cancelación sin penalidad, D-130), y el valor informado reemplaza al estimado desde su fecha. Un estimado no se carga desde la app: el único lo aprobó el dueño.
- **Por qué así:** "sin dato, nunca cero" y "no se inventan valuaciones" valen también para la forma. Un número que no salió de la fuente tiene que decirlo donde se lo vea.
- **El chip:** `estimado` es una de las cuatro etiquetas nuevas del motor, junto con `supuesto`, `a_confirmar` y `proyectado`, que llegan con los escenarios y el cuadro de marcha. Su gravedad va entre `supuesto` y `a confirmar`.
- **Rotular de más:** se trata como estimado todo lo que no diga "informado". Es el error conservador.

## Entrega 4 · Balance, resultados, pasivos y flujo (15/10/2026)

Las cuatro pantallas que pidió el dueño el 14/10: el estado de situación patrimonial, el resultado del período (profit and loss), el cuadro de marcha del leasing y el flujo de fondos proyectado con escenarios. Todas las decisiones de esta sección son **P (provisorias, a confirmar)**. Los números reservados: Balance D-132 a D-134 (y la revisión de D-131), Evolución y PnL D-135 a D-138, Pasivos D-139 a D-143, D-152 y D-153, Flujo D-144 a D-149 y D-155, lead D-150 y D-151 (D-154 ya está arriba).

### Balance
La revisión del perímetro está en D-131 (revisión del 15/10).

### D-132 · Liquidez por regla, escrita en la traza — P (provisoria, a confirmar)
- **Tres grupos, por el tipo de partida, no por opinión:** **disponible hoy** (los saldos de tus cuentas, en pesos o en dólares), **con venta en el mercado** (CEDEARs, acciones, bonos, letras y FCI con cotización: para usar esa plata hay que venderlos) e **ilíquido** (los bienes: se hacen plata solo vendiéndolos, sin un precio de todos los días).
- **La regla va escrita** debajo de la barra "Por liquidez" del Balance, en la traza de cada tramo y en la del porcentaje de cada partida (`liquidezDe`), así se puede discutir la regla y no el número.
- **Qué no hace:** no mira plazos de liquidación (T+1, rescate en 48 h), ni el volumen de un título, ni si un bono tiene poca rueda. Eso sería una opinión sobre el mercado; si hace falta, se suma como un grupo más con su regla.
- **Por qué:** la liquidez es lo que separa "lo invertible" de "lo que tenés"; con una regla fija el número se reproduce y se audita.

### D-133 · Balance a cualquier fecha de carga, imprimible en A4 — P (provisoria, a confirmar)
- **Cualquier fecha con carga:** el balance de una fecha se arma con la foto de esa fecha (`foto(h, fecha)`), con los datos que tenías ese día: "al 14/10" y "al 31/12" salen del mismo cálculo. Por defecto, la última. La fecha y el agrupamiento (cuenta, instrumento o clase) viven en la dirección, así que un balance se puede guardar como favorito o mandar.
- **"Viejo" se mide contra el día del balance:** el de una fecha pasada, contra esa fecha; el último, contra hoy. Un dato de otro año dice el año ("tasación del lun 15/09/2025").
- **Porcentajes que suman:** cada renglón dice qué parte del activo es, con el número exacto en su traza; lo que se ve se redondea a un decimal por resto mayor, en dos niveles (financiero y cada bien suman 100,0%; las partidas de lo financiero suman lo que se ve del financiero). Del otro lado, igual: pasivo + patrimonio neto = 100,0%, lo firme + tu parte de cada bien financiado = el patrimonio neto, y las deudas suman el pasivo. En la frase de arriba, a enteros que suman 100%.
- **La evolución:** un punto por fecha de carga, nunca uno inventado entre cargas; un dato que falta deja un hueco. Pesos o dólares, con un control (dos monedas no comparten un eje). El activo por clase, apilado; la línea del patrimonio neto (rayada si la deuda es un estimado) y la de lo firme (punteada).
- **Comparativo, como lo presenta un contador:** el balance de la fecha elegida al lado del de otra fecha de carga anterior (por defecto, la primera; se elige otra y queda en la dirección, `?comparar=`), con los renglones principales (financiero, bienes, activo, pasivo, patrimonio neto y lo firme) en pesos y en dólares, y la diferencia de cada uno con su fórmula. La diferencia **no es una ganancia**: incluye lo que pusiste o sacaste de tus cuentas, y lo dice; el resultado separado es de Evolución y PnL (D-135 a D-138). Una diferencia que da exactamente cero dice "sin cambios", para no confundirla con un "sin dato". El chip de cada renglón es el más grave de las dos fechas: si la anterior usaba la deuda estimada, la diferencia es un estimado y lo dice. Con una sola fecha de carga no hay comparativo.
- **Indicadores del balance:** solvencia (activo ÷ pasivo, en veces), endeudamiento (pasivo ÷ patrimonio neto) e inmovilización (bienes ÷ activo), cada uno con su fórmula. Son cocientes: dan lo mismo en pesos que en dólares. Describen, no juzgan (no hay umbral, D-42); con la deuda estimada llevan `estimado`, y sin la deuda son "sin dato". Sin deudas no hay solvencia ni endeudamiento; sin bienes, no hay inmovilización.
- **Impresión en A4 para tu contador:** el botón "Imprimir" (o imprimir desde el navegador) deja la frase, el estado de situación, los indicadores, el comparativo y la composición, en tema claro, con la fecha, el CCL usado y su fuente, las dos monedas, los porcentajes y los chips como texto, y al pie de dónde sale la deuda y qué quiere decir cada etiqueta. Sin la navegación, los botones, las tarjetas de arriba (lo mismo está en la tabla) ni el gráfico; la tabla se parte entre filas, con su encabezado en cada hoja.
- **Por qué:** el estado de situación patrimonial es un documento a una fecha; el contador lo pide así, y con la traza a mano cada número se puede explicar.

### D-134 · El Balance dice de dónde sale la deuda, en la cifra, la traza y la impresión — P (provisoria, a confirmar)
- **El origen no depende del CCL:** una deuda cargada es la deuda aunque falte el CCL; lo que queda "sin dato" es la otra moneda, con su motivo (falta el CCL), nunca "falta el valor de cancelación". La cifra grande sigue siendo el patrimonio neto con esa deuda.
- **El origen se escribe al lado de la deuda:** "valor de cancelación informado el mar 13/10", "según el cuadro de marcha, a la tasa del contrato · estimada" o "estimada por vos el jue 08/10 · provisoria", con quién la informó o cómo se estimó, y el chip que corresponde (`estimado`, `provisoria`). Sin ninguna: "sin dato · falta el valor de cancelación que te pase la leasera", con el botón a Datos › Leasing.
- **La traza de la deuda** dice su origen y qué es ("es lo que se resta" o "es un cálculo, no un dato del acreedor"), y la de tu parte de la camioneta escribe la resta: valor − deuda, con el nombre del origen.
- **"Lo que falta pagar según contrato" es una referencia, nunca la deuda:** son las cuotas nominales que faltan, con intereses, IVA, seguro y percepción. Se muestra al lado de la deuda, con su rótulo fijo ("no es la deuda: incluye intereses, IVA y seguro"), y nunca se resta. Hasta que importes el cuadro de marcha, dice que aparece cuando lo importes.
- **Por qué:** es la misma deuda que usa Exposición y que va a usar Hoy; si cambia de origen (cuando la leasera informe el valor), tiene que notarse en todos lados y en el papel que le llega al contador.


### Evolución y PnL
### D-135 · Realizado y no realizado del período, exactos y sin residuo — P (provisoria, a confirmar)
- **Qué es:** por posición, en el período (d0, d1], con el mismo PPC promedio de Cartera. **Realizado** = lo que cobraste por ventas, vencimientos y rentas − lo que te había costado lo vendido (cada venta lleva costo × cantidad vendida ÷ tenencia). **No realizado** = valor al final − valor al inicio − aperturas a su valor del día − compras + costo de lo vendido + amortizaciones.
- **Por qué cierra:** realizado + no realizado = valor al final − valor al inicio − flujos = el resultado del período, exacto (lo verifican propiedades con fast-check y un cruce contra una referencia en Python escrita aparte). Un vencimiento que cierra la posición cuenta como venta. Una amortización baja el costo y no es realizado (D-114). Lo que traías al abrir una tenencia no es resultado del período: la apertura entra a su valor del día.
- **En dólares:** cada flujo a su CCL y el costo en dólares (al CCL de cada compra). Solo hace falta el costo cuando hay una venta: si falta (por ejemplo, el CCL de compra de una apertura), realizado y no realizado son "sin dato" en esa moneda, con lo que falta, y el resultado sigue conocido.
- **La liquidez "no aplica":** no tiene costo; su resultado es rendimiento o tipo de cambio. Los bienes y las deudas tampoco: su resultado es revaluación o licuación.

### D-136 · Con un solo día de historia, Evolución muestra el punto de partida — P (provisoria, a confirmar)
- **Qué se ve:** tu patrimonio del día cero; lo que ya traías desde la compra según el PPP de tus brókers (valor − costo, lo mismo que Cartera), en dólares solo donde declaraste el CCL de compra (si no, "sin dato" con la suma parcial); qué pasa si mañana el CCL sube 1% (en pesos, lo que arriesga dólares × 1%; en dólares, − lo que arriesga pesos ÷ CCL × (1 − 1 ÷ 1,01)); el puente con cada línea en "sin dato · necesita una segunda carga"; y el estado de resultados del mes en curso, con lo de flujo a la vista y lo patrimonial en "sin dato".
- **Por qué:** con una sola carga no hay período, pero sí hay cosas verdaderas para mostrar. Nunca una pantalla en blanco y nunca un $ 0 en lugar de un dato que falta.

### D-137 · El puente suma las cuotas pagadas desde tus cuentas y, en Total, la deuda — P (provisoria, a confirmar)
- **Las cuotas:** una cuota del leasing pagada desde una cuenta que la app sigue (con saldo en pesos cargado) baja ese saldo. Sin más, el motor la leería como una pérdida de tus pesos. En el puente es una **salida de plata, no una pérdida** (visión 4.7): un renglón propio, cada cuota a su CCL del día. Una cuota pagada sin fecha de pago, sin cuenta, o desde una cuenta que la app no sigue no entra, y el puente dice por qué, pero solo de las de su período: la fecha de pago o, sin ella, el vencimiento cae entre las dos cargas (una cuota de antes del día cero no tiene nada que ver con ningún período).
- **En la vista Total:** la amortización de la deuda (lo que bajó la deuda entre las dos cargas) es su renglón; "de lo cual: revaluación de bienes" es la parte de tus activos que viene de una valuación nueva; "de lo cual: el dólar sobre tus bienes" es la parte del tipo de cambio que viene de tus bienes (en dólares, la camioneta valuada en pesos vale menos si el CCL sube; en pesos, la casa valuada en dólares vale más: visión 4.7), y "de lo cual: el dólar sobre la deuda en pesos" es la licuación en dólares.
- **La deuda estimada (D-154):** el motor rotula "estimado" el valor de la deuda; todo lo que sale de ella lo hereda: la amortización (siempre: sin saldo nuevo, su 0 es el del estimado), el dólar sobre la deuda, el resultado por el tipo de cambio y la fila del leasing donde la deuda pone algo, la licuación del estado de resultados y la curva del patrimonio total.
- **El cuadre se calcula:** patrimonio al final − al inicio − cada línea = 0, en las dos monedas. No es un residuo: si no da 0, es un bug.
- **Capital aportado:** arranca en el patrimonio del día cero y suma lo que entró y salió (aportes, retiros, altas y cuotas), **cada flujo a su CCL del día**, como el puente, y no al tipo de cambio de la operación: así, patrimonio − capital aportado es exactamente lo ganado o perdido desde el día cero.

### D-138 · Estado de resultados del período — P (provisoria, a confirmar)
- **Qué es:** el "profit and loss" que pediste, sobre tu patrimonio total. Ingresos (el mensual y el extraordinario, aparte) − gastos fijos − gastos que cargaste − costo del leasing devengado = **ahorro del período**; + resultado de inversiones (realizado, no realizado y liquidez) + revaluación de bienes + licuación de la deuda = **variación explicada**; contra la variación real de tu patrimonio, la diferencia se llama **"no explicado"** (consumo que no cargaste, plata que entró o quedó afuera de tus cuentas, una deuda que todavía no se actualizó). Es una diferencia, nunca un cuadre.
- **Ingresos y gastos fijos:** un mes con lo cargado ("Cargar ingreso", "Cargar gasto") usa lo cargado; un mes sin nada cargado usa lo que declaraste en Flujo, prorrateado por los días del período, con el chip "declarado". Lo extraordinario es solo lo cargado. Un ingreso cargado en dólares usa los pesos que recibiste (si los cargaste).
  - **Revisión de la integración (15/10), como Flujo y Hoy:** lo cargado reemplaza a lo declarado **por moneda** en los ingresos (cargar los dólares no borra el ingreso en pesos declarado) y todo junto en los gastos. Un ingreso **declarado** en dólares pasa a pesos **al dólar cripto** de esa fecha, al que el dueño dijo que los vende (es un tipo de cambio observado en su carga, no un supuesto); sin el cripto, "sin dato". Antes iba al CCL y el mismo mes daba otro ingreso que en Flujo. Si no dijiste quién paga la cuota del leasing, la pagás vos (D-155); si la paga la empresa, su costo en tu resultado es $ 0 y lo dice.
- **El leasing:** de cada cuota que vence en el período, solo lo que no es amortización: el interés implícito (chip "estimado"), el IVA y la percepción (crédito fiscal de la sociedad que toma el leasing: gasto tuyo mientras no te lo reintegre; sin declararlo, chip "a confirmar"; si declarás que te lo reintegra, no se suma), el seguro y los cargos extra. Sin el cuadro de marcha, el costo del leasing es "sin dato" y el ahorro, la suma parcial.
- **Cuadro incompleto (revisión de los arreglos, 15/10):** si el período toca un mes del plazo cuya cuota no está en el cuadro (una planilla corta, un Deshacer), el costo del leasing es "sin dato" con su motivo, como en Flujo y Hoy; nunca $ 0. Con la cuota de la empresa y el cuadro importado, $ 0 con la nota "la cuota la paga la empresa".
- **En dólares, el ingreso declarado va tal cual (pendiente de unificar):** Evolución suma los dólares como dólares y Flujo pasa todo el ingreso a pesos y lo divide por el CCL de la última carga. En pesos dan lo mismo; en dólares, el mismo mes puede diferir en dólares × (1 − cripto/CCL). Queda para la próxima entrega elegir una sola convención.
- **Con un solo día:** el período es el mes en curso; lo patrimonial es "sin dato · necesita una segunda carga".

### Pasivos
### D-139 · Cada cuota es facturada o proyectada, con la fuente de cada monto; una proyectada nunca es un hecho — P (provisoria, a confirmar)
- **Qué es:** `pasivo_cuotas.estado` dice si la cuota tiene comprobante de la leasera (`facturada`) o sale del cuadro de marcha sin factura todavía (`proyectada`). Cada monto lleva su fuente: `fuente_canon`, `fuente_seguro` y `fuente_otros` (la percepción), con `comprobante`, `contrato`, `a_confirmar`, `supuesto` o `no_aplica`.
- **Reglas de la base:** una facturada tiene todo de comprobante (o n/a); una proyectada no tiene nada de comprobante; una pagada es facturada. `no_aplica` va solo con monto cero.
- **Cómo se ve:** en el motor, una proyectada lleva `proyectado` y cada monto, `supuesto` o `a confirmar` según su fuente; las etiquetas se propagan a toda suma (lo que falta pagar, el costo total, la próxima cuota) y se ven como chip.
- **Por qué:** el cuadro de marcha mezcla lo facturado con lo que todavía es una proyección del dueño (el seguro a confirmar, la percepción supuesta). Sin la marca, una proyección se leería como un hecho.

### D-140 · `pagada` explícita: una cuota puede estar pagada sin fecha de pago (ajusta D-23) — P (provisoria, a confirmar)
- **Qué pasa:** la planilla dice "pagado SI" pero no la fecha (débito automático). `fecha_pago` null ya no quiere decir impaga: lo dice `pagada`.
- **Cómo se ve:** "pagada · fecha sin dato". Nunca se toma el vencimiento como fecha de pago.
- **En dólares:** una cuota pagada va al CCL del día de su pago. Sin ese CCL, sin dato, y lo pagado en dólares es suma parcial. El CCL va siempre con su fuente, y con la fecha del pago (lo exige el check que ya tenía la tabla).
- **Cómo se completa:** desde Datos › Leasing, "Completar el pago de una cuota": la fecha (opcional), el CCL de ese día con su fuente y quién la pagó. Recargar la planilla no lo pisa: `guardar_cuadro_marcha` deja como estaba lo que la entrada no dice del pago.

### D-141 · Lector `cuadro-marcha-csv@1`; el CSV va entero en la lectura cruda de su carga manual — P (provisoria, a confirmar)
- **El formato real:** `nro_cuota, fecha_vencimiento, mes_del_canon, canon_neto, seguro_neto, subtotal_neto, iva_21, percepcion_iva_rg3337, total_cuota, pagado, origen_seguro, origen_percepcion`, con coma, punto decimal y fechas ISO; la fila `OC` es la opción de compra. También lee punto y coma, números es-AR, BOM y CRLF, y encabezados con sinónimos.
- **La fuente es por campo:** `origen_seguro` → `fuente_seguro`, `origen_percepcion` → `fuente_otros` (CONFIRMAR → a confirmar, SUPUESTO → supuesto, n/a → no aplica); el canon es comprobante si está pagada y contrato si no.
- **Controles por fila** (frenan el Enter con fila y columna): subtotal = canon + seguro, total = subtotal + IVA + percepción, números 1..N sin huecos, vencimientos crecientes, una pagada tiene comprobante. Una percepción de $ 0 con comprobante es un cero real (esa factura no la tuvo): se acepta como advertencia, de a una.
- **Cargos extra:** una fila que no es cuota ni OC es un cargo si dice qué es (multa, comisión, reserva de fondos, interés u otro, con su cuota: "multa 13"); si no se reconoce, error con fila y columna.
- **Dónde queda el archivo:** en la lectura cruda de su carga (`origen manual`, nombre, sha256 y texto), sin bucket, como D-130. El servidor vuelve a leer el texto al guardar: nunca graba lo que armó el navegador.

### D-142 · Se guarda lo facturado: seguro neto, IVA sobre canon y seguro; el IVA de la opción va a la alícuota observada — P (provisoria, a confirmar)
- **Qué se guarda:** `seguro` = seguro neto (el comentario de la columna decía "bruto"; la tabla estaba vacía), `iva_canon` = el IVA facturado sobre canon y seguro, `otros_conceptos` = la percepción RG 3337. El total es canon + seguro + IVA + percepción, y cierra al centavo con la columna total de la planilla (la revisión lo controla).
- **Descartado:** el mapeo derivado (IVA = canon × 21 %, seguro × 1,21): deriva montos y no cierra al centavo con la factura, y con el seguro bruto el IVA del seguro se contaba dos veces.
- **La opción de compra:** su IVA es su neto por la alícuota observada en las cuotas facturadas (IVA ÷ subtotal), nunca una constante. Si las facturas no coinciden entre sí, sin dato.

### D-143 · La tasa implícita del contrato se calcula del contrato y se muestra rotulada; no es la deuda — P (provisoria, a confirmar)
- **Flujos:** − el monto financiado neto en la fecha de desembolso (la entrega del bien, `pasivos.fecha_desembolso`), + el canon neto de cada cuota en su vencimiento, + la opción de compra neta en su fecha. El IVA, el seguro y la percepción no entran: no son financiación.
- **Cálculo:** TIR en Decimal (bisección para acercarse y Newton hasta que el VPN da menos de $ 0,01), en días/365; la TEA y su TEM, (1 + TEA)^(1/12) − 1. Contrastada con una implementación independiente en Python sobre casos inventados (`tests/referencia/tir_referencia.py`).
- **Sin el monto financiado o sin la fecha de desembolso:** sin dato, "Completar el contrato" con lo que falta. Nunca se toma `fecha_inicio` en su lugar.
- **El contrato real:** la tasa que dice el contrato del dueño se reproduce con financiado = valor del bien − canon inicial y desembolso = fecha de entrega. Esos datos los carga el lead en producción; el repo solo tiene casos inventados.
- **No es la deuda:** lo que netea el patrimonio sigue siendo el valor de cancelación informado (D-130). De la tasa salen la deuda según el cuadro y la apertura de cada cuota, las dos `estimado` (D-152).

### D-152 · De cada cuota, solo la amortización baja la deuda; la deuda "según cuadro de marcha" es el valor presente a la tasa del contrato — P (provisoria, a confirmar)
- **Pedido del dueño (14/10):** "una parte del leasing todos los meses es IVA u otros cargos. Esas cosas no deberían ir al patrimonio y deben estar diferenciadas".
- **La apertura:** cada cuota se abre en amortización, interés implícito, IVA, seguro, percepción RG 3337 y cargos. Interés de la cuota k = saldo × ((1 + TEA)^(días/365) − 1), al centavo; amortización = canon neto − interés; la opción paga el saldo que queda. Así, Σ amortizaciones + opción = monto financiado neto, al centavo (test).
- **Qué es qué:** solo la amortización baja la deuda y cuenta para el patrimonio. El interés, el IVA, el seguro, la percepción y los cargos son gasto: van a Resultados y a Flujo. El IVA y la percepción son crédito fiscal de la sociedad que toma el leasing; para el dueño son gasto mientras no se los reintegre (`pasivos.reintegra_iva`, null = sin declarar, nunca se supone un reintegro).
- **Rótulos:** la amortización y el interés salen de la tasa: llevan `estimado`.
- **La deuda según el cuadro:** valor presente, a la TEA del contrato y a hoy, de los cánones netos impagos más la opción neta (sin IVA, seguro ni percepción: no son deuda). Lleva `estimado` y se muestra al lado de la informada y de la estimada aprobada, nunca en su lugar. Lo que falta pagar (nominal) va al lado y nunca se resta.

### D-153 · Cuadro de marcha recargable y cargos extra en su propia tabla — P (provisoria, a confirmar)
- **Recargable:** el dueño manda la planilla actualizada cada vez que paga. `guardar_cuadro_marcha` hace upsert por (pasivo, número de cuota): lo facturado pisa lo proyectado, y rechaza bajar una facturada a proyectada o una pagada a impaga ("corregila desde su fila"). Cada importación es una carga con su lote: idempotente, auditada y revertible con `revertir_lote`, que restaura desde la auditoría lo que pisó.
- **La revisión:** antes del Enter dice cuántas cuotas son nuevas, cuántas se actualizan (y qué cambia en cada una) y cuántas quedan iguales.
- **Cargos extra:** multas, comisiones, reservas de fondos e intereses van a `pasivo_cargos`, con fecha, concepto, importe en pesos (con IVA si lo lleva), su cuota y su fuente. Son gasto, nunca amortizan.
- **Qué cuenta:** los cargos de la última planilla vigente de cada pasivo y los cargados a mano, sin anular. Uno puntual se anula (`anulado_en`), no se borra.
- **Sin FK a cargas, a propósito:** `revertir_lote` se niega a revertir un lote con filas en una tabla que no sabe deshacer, y sumarle una tabla pide un DELETE (D-116). Un trigger controla que la carga exista, y el lector ignora los cargos de una carga revertida.
- **Se revierte de lo más nuevo a lo más viejo (integración, 15/10):** una planilla o un pago posterior pisa las mismas cuotas y conserva lo del pago, así que revertir una carga anterior del mismo leasing dejaba el cuadro a medias. La app (`revertirLote`, antes de llamar a `revertir_lote`) se niega y dice cuál revertir primero, como `revertir_lote` con las cargas de una cuenta. Va en la app y no en la función porque cambiar `revertir_lote` pide aplicarla a mano (D-116).
- **A qué cuota va un cargo (integración, 15/10; revisada el 15/10):** al de su número y, uno sin cuota (o con una que no está en el cuadro), a la primera que vence en el mes de su fecha o después: se debita con la cuota siguiente. Solo uno posterior a la última cuota no va a ninguna (cuenta en el costo total). La misma regla en Pasivos, Evolución y Flujo (`src/lib/domain/pasivos/cargos.ts`). Un cargo de la planilla que dice una cuota que el contrato no tiene es un error con su fila.

### Flujo y escenarios
### D-144 · Proyección determinística: un camino por escenario, sin Monte Carlo — P (provisoria, a confirmar)
Detalla D-31 y la visión 4.15. Pantalla `/flujo`.
- **Un escenario es un solo camino**, con todos sus supuestos a la vista. Monte Carlo y el abanico siguen en la fase 3; la pantalla lo dice.
- **Corre en el navegador** (`proyectar()`, pura e isomórfica) sobre una base serializada que arma el servidor: la última carga real, lo declarado, las cuotas del leasing, los pagos de bonos y letras y lo cargado con "Cargar ingreso". **Siempre arranca de la última carga**, nunca de un supuesto viejo, y no se guarda nada proyectado.
- **Las trazas se arman a pedido** (`trazaMes()` al tocar una cifra): el cálculo masivo no las arma. Meta: menos de 200 ms entre mover el deslizante y ver la proyección, con la CPU × 4 (e2e).
- **Con un faltante no se inventa ningún mes:** la proyección dice qué variable falta. La casa y la camioneta sin elegir dejan sin dato solo el patrimonio neto. Sin el pago al vencimiento de una letra (sin TEM de hoy para la renovación) la proyección corre con la caja y deja sin dato el financiero, con el nombre de la letra: lo que falta frena solo lo que depende de eso (revisión del 15/10).
- **Sin cuadro de marcha, la cuota no es $ 0:** mientras un leasing vigente no tenga ninguna cuota cargada, su cuota de cada mes del plazo (del mes de inicio al de inicio + cuotas totales, de más y nunca de menos) es sin dato en el mes en curso, el calendario y proyectado contra real, y la proyección lo pide como dato que falta, salvo que la cuota la pague la empresa (revisión del 15/10).
- **Dos salidas más, determinísticas:** el mes en que la mediana de 12 meses del resultado sin aportes (en USD) alcanza la cuota, y "¿terminás debajo de lo que pusiste?" (financiero al horizonte contra lo aportado). "No cruza antes del horizonte" es un resultado válido. Con un mes sin dato en esos 12, la cobertura es sin dato con su motivo; con menos de 13 meses de horizonte no se mide (y se dice), y sin cuota que pagues vos no se muestra.
- **El patrimonio neto completo proyectado** usa la deuda según el cuadro de marcha; mientras falte la apertura de la cuota (amortización), es sin dato con su motivo. La caja del mes no depende de eso: usa la cuota entera.

### D-145 · "Completar lo que falta con Igual": un toque del dueño, nunca un default — revisada por D-164
**Revisada por D-164** (rediseño del 15/10): pediste «en flujos y escenarios quiero ver graficos», así que Flujo arranca con todo en Igual y a 12 meses, y cada variable tiene una sola barra. El botón ya no existe. Lo de abajo es como era.

Detalla D-08 y D-88.
- **Ninguna variable de mercado arranca elegida** (devaluación, inflación, brecha, retornos, TEM de renovación, casa, camioneta) y el horizonte tampoco. Baja o Sube sin número es "falta".
- **El botón pone Igual solo en lo que no elegiste** y no toca nada más. El horizonte se elige con atajos (6, 12, 24 meses, fin del leasing) o con − y +.
- **Cada variable dice qué es Igual** con los datos de tu última carga ("el CCL queda en el de tu última carga ($ 1.500,00)"), y el número elegido va también en el botón ("Sube +2,0%/mes").
- **Ningún texto valora escenarios:** sin "mejor", "conviene" ni "deberías" (test).

### D-146 · Letras y BONCAP: a vencimiento a su TEM implícita; lo que se reinvierte rinde la TEM de renovación — P (provisoria, a confirmar)
Detalla el spec §7 ("TEM por bono") y ajusta D-88.
- **Lo que ya tenés va a vencimiento** a la TEM implícita entre el valor de hoy y el pago de `flujos_bono`: al vencimiento vale exactamente el pago contractual (test al centavo). Con un solo camino y tenencia a vencimiento, mover esa TEM no cambia lo que cobrás: vuelve como variable con Monte Carlo.
- **Lo que se reinvierte en letras después de un vencimiento** rinde la **TEM de renovación**, que sí es variable; su Igual es la TEM implícita de hoy de tus letras, ponderada por valor.
- **Sin el pago al vencimiento, sin dato:** el calendario lo dice y ofrece "Cargar el pago al vencimiento" con su fuente (`guardar_flujos_bono`). Un pago único se guarda como devolución del VN más lo que capitalizó.
- **Un bono con pago "a determinar"** (dual, CER, TAMAR) es su propia variable del escenario, sobre el precio de hoy.

### D-147 · (Revisada) Ingresos y gastos se editan en Flujo; el cambio de feb-2027 es una variable por tramos — P (provisoria, a confirmar)
Lo pidió el dueño el 14/10: "a eso lo dejes como una variable".
- **El ingreso en dólares y en pesos va por tramos "desde el mes N".** Igual = lo declarado vigente en ese tramo; Baja y Sube lo mueven en %. El tramo de feb-2027 ya viene armado, sin elegir. Se pueden sumar y sacar tramos. El de pesos puede ajustarse por mes (0 a 15 %/mes, `ajuste_mensual`); sin tocarlo, es nominal.
- **Cuando sepas el monto nuevo, se declara** con "Cambia desde…": cierra la fila vigente el día anterior y abre otra, en una transacción (`guardar_recurrente`). Desde ahí, el Igual de ese tramo es lo declarado.
- **Un error se anula, no se borra** (`anulado_en`, D-116); lo que dejó de valer se termina ("Termina…").
- **Una fila cuenta en un mes si está vigente el último día de ese mes;** un gasto no mensual cuenta en su primer mes y cada tantos meses.
- Los ingresos y gastos se editan en Flujo, donde se usan; Datos no cambia.

### D-148 · Los escenarios se archivan, no se borran; el último valor de cada deslizante queda recordado — P (provisoria, a confirmar)
Detalla D-08.
- **Un escenario guarda supuestos, nunca resultados:** cada vez se proyecta desde la última carga. Guardar, guardar como, duplicar, abrir, archivar y volver a la lista. No hay borrar.
- **Mientras tanteás, los supuestos viven en la dirección** (`?s=`, base64url del JSON validado con zod): recargar no pierde nada y Atrás recorre lo probado. Una dirección de otra versión o fuera de rango no se lee a medias: se arranca de cero y se avisa.
- **`valores_recordados`:** al guardar, el número de cada deslizante movido, por variable y dirección (`devaluacion.sube`). Al tocar Baja o Sube otra vez, arranca en ese número. No es un supuesto activo.
- **Comparar:** hasta tres guardados, con trazo sólido, rayado y punteado (no solo color), tres cajas por escenario y solo los supuestos que difieren.
- **Los meses de un escenario siguen en su mes del calendario (integración, 15/10):** "desde el mes N" y "hasta el mes N" se cuentan desde la carga con que se armó, y el escenario guarda ese mes (`base_mes`). Abierto con una carga de otro mes (guardado, en la dirección o en Evolución), `rebasar` los corre: el cambio de ingreso de feb-2027 sigue en feb-2027. Un tramo que ya empezó rige desde el mes 1; uno que ya terminó sale. Antes, cada carga de un mes nuevo corría un mes todos los cambios de un escenario guardado.
- **El mes 0 lo rige el tramo vigente (revisión de los arreglos, 15/10):** el primer tramo de ingreso rige desde ahora; otro, desde su mes, también uno "desde el mes 1" (el mes que viene). Un escenario armado en octubre y abierto en enero sigue con el ingreso de antes en enero y cambia en febrero (antes, el mes de la carga ya tomaba el tramo siguiente). Lo mismo al revés: un tramo "hasta el mes N" que termina en el mes de la carga todavía rige ese mes ("este mes"), y "la empresa paga desde el mes 1" deja el mes de la carga al otro.

### D-149 · Cargar ingreso / Cargar gasto: un hecho por evento, con su aporte, y proyectado contra real sin guardar proyecciones — P (provisoria, a confirmar)
Lo pidió el dueño el 14/10 ("agregar un botón que sea 'cargar ingreso'", con concepto "ingreso mensual o ingreso extraordinario").
- **`flujos_reales`, una fila por evento:** fecha, ingreso o gasto, concepto obligatorio (mensual o extraordinario), moneda, monto, cuenta (o afuera) y, si vendiste dólares al cripto, el cripto y los pesos recibidos (los dos o ninguno; los pesos tienen que cerrar con US$ × cripto dentro de la precisión tipeada, D-37).
- **`guardar_flujo_real`, una transacción:** la carga manual (lote idempotente, mismo candado que las cargas), la fila y, si la plata entró a una cuenta seguida, el **aporte** en `movimientos_capital` (con la moneda y el monto de origen y el cripto como tipo de cambio); si salió de una, el **retiro**. Así la carga siguiente no lee ese ingreso como ganancia ni ese gasto como pérdida.
- **Aviso de doble carga:** si el mismo día ya hay en Datos › Movimientos un aporte (o un retiro) igual en la misma cuenta, el formulario lo avisa antes de guardar; no frena, porque puede ser otro movimiento.
- **Deshacer = revertir el lote,** con las reglas de Registro: se va el aporte, la carga queda revertida y la fila deja de leerse. `flujos_reales.carga_id` no lleva clave foránea a `cargas` (con ella, `revertir_lote` rechazaba el lote, y sumarla a su lista pide un borrado, D-116); la integridad la cuida un trigger. **Anular** es para lo que fue afuera.
- **Proyectado contra real:** cada mes nace proyectado con lo declarado vigente ese mes, las cuotas y los vencimientos, y se vuelve real con lo cargado (ingresos, cuotas pagadas, cargas), con el desvío por línea. Los gastos reales son sin dato salvo los cargados. **Lo extraordinario va aparte** y no cambia la proyección recurrente. No se guarda ninguna proyección.

### D-155 · La regla de reinversión que declaró el dueño arranca precargada y rotulada — P (provisoria, a confirmar)
Lo pidió el dueño el 14/10: "cada vez que entra guita se reparte en partes proporcionales a la última carga de la cartera todo el ingreso disponible (luego de restar gastos fijos y cuota de leasing)".
- **Cada mes proyectado:** excedente invertible = ingresos (US$ × cripto del escenario + pesos) − gastos fijos − la **cuota entera** del leasing de ese mes (lo que se debita). El 100% se invierte repartido según el peso de cada posición en la **última carga** (su participación en el patrimonio financiero; con la liquidez, por la lectura literal de "la última carga", y se puede sacar).
- **Un excedente negativo sale de tus pesos** y el mes lo dice; si no alcanzan, "no se cubre" con lo que falta.
- **Lo que vence** (letras, bonos) se reinvierte con la misma regla, salvo que el escenario diga otra clase.
- **Es su política, no una recomendación:** va rotulada "tu regla · 14/10", es lo único precargado (junto con "la cuota la pagás vos", que también dijo el 14/10) y se puede cambiar (otro %, todo a una clase). Cambiada, dice "elegida por vos" y ofrece volver a la del 14/10.
- **El reintegro del IVA y la percepción** entra como ingreso solo si está declarado en Pasivos o elegido en el escenario. Sin eso, la salida de caja es la cuota entera y no se cuenta ningún reintegro; la pantalla lo dice. Declarado en Pasivos, suma también al excedente del mes en curso (Hoy, "Este mes" y el calendario), como en la proyección (integración, 15/10).

### Lead

### D-150 · Se adelantan piezas de las fases 1b, 2 y 3 porque las pidió el dueño — P (provisoria, a confirmar)
- **Qué:** el balance, el resultado del período, el cuadro de marcha del leasing y el flujo proyectado con escenarios estaban repartidos entre la 1b y la fase 3 (spec §9). El dueño los pidió el 14/10, y llegan juntos en esta entrega.
- **Qué queda afuera, y lo dice cada pantalla:**
  - Monte Carlo y el abanico (D-31): la proyección es determinística, un camino por escenario (D-144);
  - el cierre mensual por diferencia de saldos (D-79);
  - el calendario con alertas (visión 4.13);
  - las recomendaciones, que no van en ninguna fase (D-07).
- **El costo, a la vista (como pide D-99):** cuatro pantallas nuevas sobre una sola fecha de carga. Hasta la segunda carga, Evolución no tiene período, y el Flujo proyecta desde un único punto de partida.

### D-151 · La barra inferior del teléfono: Hoy · Balance · Cargar · Evolución · Más — reemplazada por D-156
**Reemplazada por D-156** (rediseño del 15/10): abajo van Hoy · Patrimonio · Cargar · Resultados · Más, y el Balance pasa a Exposición.

- **Qué:** Balance toma el segundo lugar, que era de Cartera (visión §3.2), y Evolución toma el cuarto, que era de Exposición. Cartera, Exposición, Pasivos y Flujo quedan en Más. En la barra lateral, Balance y Evolución y PnL van en el grupo Patrimonio, y el grupo nuevo **Contexto** tiene Pasivos y Flujo y escenarios.
- **Por qué:** el dueño preguntó "¿dónde está mi balance?". Mientras haya poca historia, Evolución muestra el día cero y la sensibilidad al CCL, no una pantalla vacía (D-136).
- **Falta:** que el dueño confirme el orden, o elija Flujo en lugar de Evolución para el cuarto lugar.

## Rediseño (15/10/2026)

El 15/10 pediste un diseño nuevo para toda la app: «nuevo diseño de app, implementalo», con el pedido de no romper nada. También pediste «usa Apache ECharts y AG Grid Community para tablas». El diseño (el handoff "Portfolio UI": medidas, tokens, tipografía, reglas de color y la anatomía de cada pantalla) cambia cómo se ve la app y dónde está cada cosa, no lo que hace. Estas dos decisiones son la base; lo de cada pantalla está en `CHANGELOG.md`, «Rediseño (15/10)».

### D-156 · La navegación se ordena por pregunta; Cargar es una acción fija y el Balance vive en Exposición (reemplaza D-151) — D
- **Qué:** el menú se ordena por la pregunta que contesta cada pantalla, no por el tipo de dato:
  - **Diario:** Hoy ("¿Cómo estoy hoy?").
  - **Patrimonio:** Posiciones ("¿Cómo le va a cada cosa?") y Exposición ("¿Cuánto estoy jugado al peso?", con el balance adentro).
  - **Resultados:** Evolución y PnL ("¿Gané o perdí, y por qué?").
  - **Compromisos y futuro:** Pasivos ("¿Cuánto me falta pagar?") y Flujo y escenarios ("¿Adónde me lleva?").
  - **Al pie:** Registro, Datos, Ajustes y el Mapa de la app.

  La lista vive en un solo lugar (`src/components/shell/secciones.ts`, con test): la barra lateral, la de abajo, la hoja "Más", el título de la barra superior y el Mapa salen de ahí.
- **Cartera se llama Posiciones** en la pantalla. La ruta sigue siendo `/cartera`: los links y marcadores no se rompen.
- **El Balance se fusiona en Exposición:** las dos contestan qué tenés y qué debés. `/patrimonio`, y cualquier `/patrimonio/…`, redirige (307, `next.config.mjs`) a `/exposicion` con lo que traía en la dirección (`?agrupar=…`, `?fecha=…`). Lo que mostraba el Balance pasa a Exposición: nada se pierde. "Ver el balance", en Hoy, lleva a Exposición.
- **Cargar sale del menú:** es la acción de todos los días.
  - Desde 768 px, el botón primario fijo arriba a la derecha (tecla C), con el punto de "todavía no cargaste" (D-127).
  - En el teléfono, el botón del centro de la barra de abajo, con el mismo punto.
- **Barra lateral, desde 768 px:**
  - 232 px de ancho, colapsable a 68 con su botón al pie o en Ajustes › Barra lateral; en automático, expandida desde 1280 px.
  - Ítems de 38 px (44 con el dedo), radio 10 e ícono de 18. El activo va en surface-2 con una barrita sangría a la izquierda.
- **Barra superior, sticky (60 px; 52 en el teléfono):**
  - el nombre de la pantalla y una línea que dice para qué es;
  - el chip de los datos, que absorbe el de antes: "CARGA DE HOY · 09:41" o "ÚLTIMA CARGA · 14/10", el CCL y el cripto con que está la app y un punto verde (todo al día) u oro (algo para revisar). Al tocarlo muestra el estado de cada fuente, ✓ ≠ ○ ◷, como antes;
  - el ojo del modo privado (tecla H) y Cargar.

  El tema sale de la barra y queda en Ajustes.
- **En el teléfono (reemplaza D-151):** abajo, **Hoy · Patrimonio · [Cargar] · Resultados · Más**.
  - Patrimonio abre Posiciones, con dos pestañas arriba: Posiciones | Exposición.
  - Resultados abre Evolución y PnL.
  - Más abre una hoja con Pasivos, Flujo y escenarios, Registro, Datos, Ajustes y el Mapa de la app.
- **El Mapa de la app** (`/mapa`, al pie): las pantallas por pregunta, cómo se lee cada una (la pregunta, la lectura, las cifras clave, el gráfico principal y el detalle) y qué quiere decir cada color.
- **Lo que no cambia:**
  - toda función sigue al alcance;
  - lo no desplegado no aparece (D-69);
  - las teclas C y H;
  - el estado de cada fuente.
- **Por qué:** con el menú por tipo de dato había que saber dónde estaba cada cosa. Con el menú por pregunta vas directo a la respuesta, y Cargar, que es lo que hacés todos los días, está siempre a un toque.
- **Descartado:**
  - el Balance como sección aparte: el diseño lo fusiona con Exposición;
  - Cargar también en el menú: serían dos caminos para lo mismo;
  - Flujo en la barra de abajo: queda en Más, a dos toques.

### D-157 · Sistema visual: oscuro por defecto, tres fuentes, reglas de color fijas y AG Grid para toda tabla — D
- **Tema:** el oscuro es el de la app. Sin una preferencia guardada es oscuro, diga lo que diga el sistema. En Ajustes › Tema elegís Oscuro, Claro o Sistema. El claro es una variante con las mismas reglas de color sobre superficies claras, con contraste AA.
- **Tokens** (`src/app/globals.css`):
  - Los nombres de siempre siguen: `bg`, `surface`, `text`, `muted`, `border`, `accent`, `positive`, `negative`, `warn` y `usd-*` (la pastilla, ahora dorada). Se suman `surface-2`, `surface-3`, `faint`, `border-strong`, `border-accent`, `accent-soft`, `accent-glow`, `accent-deep`, `on-accent`, `viz`, `viz-soft` y `viz-strong`.
  - Radios: 14 px para las tarjetas y 10 para los ítems.
  - La profundidad sale del escalón de superficie y el hairline, sin sombras. El brillo es solo para el botón primario.
- **Reglas de color:**
  - **Tinta = pesos.** Los montos en pesos van sin pastilla.
  - **Oro = dólares.** El monto en dólares va siempre en la pastilla dorada. Lo dolarizado va en la familia dorada, y el tramo del tipo de cambio de los desgloses en `viz`.
  - **Sangría = deuda, pérdida y Cargar**, siempre con signo.
  - **Verde = ganancia**, solo en resultados y con "+".
  - Los estados de los datos van en tinta neutra: un dato viejo no se pinta de rojo.
- **Un color por activo, el mismo en todos los gráficos** (`src/lib/domain/colores.ts`, con test):
  - dorada para lo que arriesga dólares, piedra para lo que arriesga pesos, lavanda para la liquidez y sangría para los pasivos;
  - es estable: dentro de su familia va por orden de alta, y un activo nuevo no le cambia el color a los demás;
  - el color que elegís a mano en Datos › Catálogo manda;
  - las barras por moneda de riesgo van en oro (dólares) y piedra (pesos), y las de liquidez en los colores de la liquidez, la piedra clara y los bienes (`COLOR_MONEDA` y `COLOR_POR_LIQUIDEZ`).
- **Tipografía:**
  - **Newsreader** para la lectura de cada pantalla: una frase en serif con un solo énfasis;
  - **Geist** para la interfaz;
  - **JetBrains Mono** para toda cifra (con `tabular-nums`), los rótulos y la pregunta de cada pantalla.

  Vienen de paquetes (`@fontsource-variable`, versión exacta) y se sirven con `next/font/local`: el build no depende de la red.
- **Ajustes al diseño por contraste (AA, 4,5:1 como texto):** en el oscuro, el texto tenue pasa de #5A5563 a #837D8D, y el negativo y la sangría como texto chico (links, avisos: `--accent-texto`) de #F23A5E a #FF5C7C. El acento de los rellenos (el botón Cargar, la barrita del activo, el énfasis grande de la lectura) sigue en #F23A5E. Así llegan sobre el fondo, las superficies y la pastilla dorada. El claro y la paleta daltónica tienen sus propios valores, también AA.
- **Anatomía de pantalla** (componentes comunes de `src/components/pantalla/` y `src/components/ui.tsx`):
  1. la pregunta (eyebrow en mono);
  2. la lectura: el h1 en serif, armado por funciones puras con test;
  3. hasta cuatro cifras clave, en pesos y en dólares;
  4. el gráfico principal;
  5. el detalle.
- **La traza** (`src/components/traza.tsx`):
  - es una placa de vidrio fija abajo a la derecha; en el teléfono, una hoja desde abajo;
  - trae la fórmula con los valores, los insumos a la vista (ya no hace falta "Ver insumos ▸"), cada uno con su carga y su propio cálculo a un toque, y "¿Qué es esto?";
  - una cifra con traza lleva un subrayado punteado.
- **Gráficos (ECharts, D-31):**
  - los colores del tema se resuelven al dibujar, así el mismo gráfico anda en claro y en oscuro;
  - grilla hairline, ejes en mono de 10 px y tooltip de vidrio;
  - sin tortas, y el modo privado sigue tapando los montos.
- **Tablas: AG Grid Community 36.2.0, versión exacta.** Toda tabla de datos pasa por el componente común Grilla (`src/components/grilla/`). Reemplaza a TanStack Table, que figuraba en `docs/stack.md` pero nunca se instaló. La Grilla resuelve una vez:
  - las celdas son los componentes de la app, así el modo privado y la traza siguen andando;
  - orden numérico exacto sobre los montos en texto, con "sin dato" al final;
  - la fila de totales, fija abajo;
  - alto automático hasta 25 filas;
  - nunca scroll horizontal: las columnas son flexibles con un ancho mínimo; las que no entran se ocultan por prioridad, y cada fila suma un botón "⋯" que muestra lo que falta;
  - tarjetas debajo de 768 px (D-30) y, desde 768, donde lo imprescindible no entra (D-167);
  - el teclado y el ARIA de AG Grid, con el foco a la vista.

  Solo se registran los módulos que se usan. Las listas cortas de clave–valor, como los insumos de una traza, no son tablas. Registro es el primer uso.
- **Lo que no cambia:**
  - "sin dato" nunca es cero;
  - toda cifra va en pesos y en dólares, y toda cifra calculada abre su traza;
  - sin tortas y sin ancho máximo en el contenedor principal;
  - sin scroll horizontal de 360 a 2560 px;
  - 44 px para tocar con el dedo;
  - el modo privado tapa los montos y deja los porcentajes;
  - "reducir movimiento" se respeta.
- **Cómo se prueba:** el test de layout (D-30) recorre cada pantalla en los dos temas y ahora también falla si una grilla tiene scroll horizontal adentro.
- **Descartado:**
  - dejar el claro como tema por defecto: el diseño es oscuro;
  - `next/font/google`: el build dependería de la red;
  - AG Grid Enterprise: la licencia es paga y Community alcanza.

### D-158 · Exposición con el balance adentro: arriba la respuesta de hoy, abajo el detalle; el balance se imprime en tablas comunes — P (provisoria, a confirmar)
- **Qué:** Exposición sigue la anatomía del diseño (handoff, capturas 05 y 06): la pregunta y la lectura, el gráfico de largo y corto en pesos de hoy, la exposición neta al peso de los últimos 12 meses, la apertura por clase y por geografía y el TOP 1 y el TOP 3. Abajo, en este orden:
  1. **El detalle: tu exposición:** lo que la pantalla mostraba y el diseño no tiene arriba: la frase con la sensibilidad al CCL, la concentración con el neto sobre tus activos y la composición con lo que vale cada parte.
  2. **El detalle: tu balance:** el Balance entero de la entrega 4 (D-131 a D-134), con sus controles.
- **Lo de arriba es de hoy; el balance, de la fecha que elijas.** Si elegís otra fecha, el balance lo dice y ofrece "Ver el último".
- **Una sola dirección para las dos partes:** `?vista=` (qué netea) y `?fecha=`, `?agrupar=` y `?comparar=` (el balance) viven juntas, y cambiar una conserva las otras. `/patrimonio` sigue redirigiendo a `/exposicion` con su búsqueda (D-156); la página vieja se borró.
- **Las barras de largo y corto, partidas por activo,** como en el diseño:
  - cada título por su ticker, y la liquidez de cada moneda junta ("LIQ": la suma de los saldos, con su traza);
  - una sola escala para los cuatro renglones, con el cero en el 40% del ancho como en el diseño: lo más largo de la derecha llega al borde, y si la deuda es más grande, la izquierda se llena primero;
  - no es un cálculo nuevo: las barras suman exactamente lo que dice el resumen de siempre (test);
  - en la vista Total, los bienes van en su propio renglón mientras no tengan moneda de riesgo (D-73): no se suman ni a los pesos ni a los dólares.
- **El neto en el tiempo, "12 meses":** la ventana del diseño. Con menos historia arranca en la primera carga, y el rótulo lo dice ("· desde el jue 01/10"). El eje no lleva montos, como en el diseño: están en el tooltip y en la tabla del gráfico, en pesos y en dólares al CCL de cada día. Un "sin dato" corta la línea; nunca es cero.
- **El estado de situación y el comparativo pasan a la Grilla** (D-157) en la pantalla. **Al imprimir siguen siendo tablas comunes,** solo para la hoja: AG Grid dibuja las filas que entran en su contenedor y no sabe cortarse en hojas A4. Es la única excepción a "toda tabla pasa por la Grilla", y no se ve en pantalla.
- **Imprimir saca solo el balance,** como antes: lo de arriba de Exposición no se imprime.
- **El modo demo arma las dos partes con los mismos hechos** en cada estado (`?demo=…`), como en producción: el neto de arriba y el balance de abajo usan la misma deuda.
- **Por qué:** el diseño pone arriba la pregunta del peso, y el balance es lo mismo, lo que tenés y lo que debés, con más detalle. Abajo no se pierde nada (D-156) y arriba queda la respuesta.
- **Descartado:**
  - pestañas Exposición | Balance dentro de la pantalla: esconden la mitad, y el diseño no las tiene;
  - imprimir la Grilla: corta filas y columnas en A4;
  - otra ventana para el neto en el tiempo (toda la historia, por ejemplo): el diseño dice 12 meses, y con menos historia es lo mismo.

### D-159 · Evolución: el período en la pastilla 1M · 3M · YTD · 12M · INICIO; la semana y las fechas, en "Otro período" — P (provisoria, a confirmar)
- **Qué:** la pastilla del diseño elige el período (`?periodo=`):
  - **1M** (`mes`): el último mes;
  - **3M** (`3m`): los últimos 3 meses;
  - **YTD** (`ytd`): en lo que va del año, desde tu última carga hasta el 31/12 del año anterior; si tu historia empieza este año, desde el día cero;
  - **12M** (`12m`): los últimos 12 meses;
  - **INICIO** (`todo`): desde el día cero, el de siempre por defecto.

  Como todos los períodos, cada uno arranca en la última fecha con carga en o antes del corte: el resultado se calcula con hechos de ese día.
- **Lo que ya estaba no se va:** la última semana y "Elegir fechas" (dos fechas con carga) están en **Otro período**, al lado de la pastilla; en el teléfono, en una hoja desde abajo. Debajo de la pastilla se nombra lo elegido, con sus fechas.
- **Los controles:** qué mirás (Financiero · Total) va al lado del período; la moneda (Pesos · Dólares · Ambas) pasa al encabezado del detalle, porque las cuatro cifras clave y los dos gráficos de arriba ya van en las dos monedas.
- **Las cuatro cifras clave** son las del diseño: el resultado en pesos, el resultado en dólares, lo que pusieron tus activos y lo que puso el tipo de cambio. Sus notas (el resultado sobre lo que tenías al empezar, la parte de tus activos, cuánto se movió el CCL) salen de funciones puras, con su fórmula en la traza.
- **Composición en dólares:** cada clase en cada carga del período, al CCL de ese día; en Total suma los bienes. Las deudas no se apilan: la línea del patrimonio ya las resta. Si a una clase le falta el dólar, ese punto es "sin dato", no cero; una clase que ese día no tenías vale 0.
- **Activo vs. TC:** las ocho partidas con más resultado, con un solo cero; las demás están en "Resultados por activo y cuenta".
- **La lectura** dice primero si ganaste en pesos y perdiste en dólares (o al revés). Si no, quién puso "la mayor parte" (la más grande de las tres partes, aunque no llegue a la mitad): el dólar, tus activos o lo que todavía no se puede atribuir.
- **Lo imprescindible del PnL por mes** (16/10, con los arreglos de ancho): el mes, lo que pusieron tus activos y lo que puso el dólar se ven siempre, también a 768 px. El lugar que queda es primero para "sin atribuir" y después para los flujos (aportes y retiros, cuotas, amortización); lo que no entra va al "⋯" de cada fila. Antes, las tres partes del resultado se veían siempre: con el mes y el "⋯" no cabían en los 600 px que la tarjeta le deja a la tabla a 768 px, y había scroll hacia el costado. Con cada columna a la medida de su cifra más larga entran con los números del ejemplo, pero no con resultados de cinco cifras en dólares. Por eso "sin atribuir" deja de ser imprescindible: es lo pendiente al final menos lo pendiente al principio (D-35), cero cuando las dos puntas son cargas completas; la de cada mes sigue en el "⋯" y la del período, en el puente.
- **Por qué:** el diseño pone el período arriba, en una sola fila, y 1M, 3M, YTD y 12M son los cortes con que se compara un resultado. Ninguna función se pierde.
- **Descartado:**
  - sacar la semana: sirve para la rutina de todos los días;
  - un YTD desde el 1/1 exacto: no hay hechos ese día si no cargaste; se arranca en la carga anterior, como en los otros períodos.

### D-160 · Hoy: el patrimonio neto partido en financiero, bienes y pasivos, y las cuatro filas del diseño — P (provisoria, a confirmar)
- **Qué:** Hoy sigue la anatomía de D-157 con las cuatro filas del handoff:
  1. la pregunta con la fecha ("Jueves 15 de octubre · ¿Cómo estoy hoy?"), la lectura y, a la derecha, el patrimonio neto;
  2. Variación del día · de dónde vino, Exposición neta al peso y Excedente invertible del mes;
  3. Patrimonio neto · 12 meses y Próximos 30 días, con Atención debajo;
  4. Qué tenés y qué debés.

  Debajo, el detalle: la frase del día completa, quién movió lo invertible y el cuadre.
- **La lectura habla de lo invertible:** qué le pasó al patrimonio financiero desde la carga anterior, en pesos y en dólares, y de dónde vino (sus activos o el CCL), como la frase del día. Es lo que se mide (D-03). La arma una función pura con test (`src/components/hoy/lectura-hoy.ts`) con las cifras que muestra la pantalla, y cada cifra abre su traza. Si a la variación le falta una partida, la lectura dice cuál, sin cifras.
- **El patrimonio neto, partido en tres:** el handoff dice "Activos · Pasivos". La tarjeta dice **Financiero · Bienes · Pasivos**, y las tres partes suman el neto, cada una con su traza. Con "Activos" a secas, la casa (alrededor del 70% de los activos en el ejemplo) tapa lo invertible, que es justo lo que D-03 separa. "Qué tenés y qué debés" (la cuarta fila) sí muestra los activos juntos, cada uno en su tramo.
- **El patrimonio neto en el tiempo:** un punto por fecha de carga de los últimos 12 meses (la misma cuenta que la tarjeta: financiero + bienes − deudas), en dos gráficos chicos con las mismas fechas, en dólares y en pesos. Entre dos cargas no se inventa nada, y un día sin dato es un hueco. Mientras no haya 12 meses de historia, el rótulo dice desde cuándo hay. Sin bienes o sin leasing cargados no hay patrimonio neto, y la tarjeta dice qué falta. El cambio del período incluye lo que pusiste o sacaste: no es un resultado, y la tarjeta lleva a Evolución y PnL.
- **Próximos 30 días:** sale de la misma base que proyecta Flujo, sin guardar nada. Trae la carga de hoy que falta (después del cierre de BYMA, D-127), las cuotas del leasing sin pagar (y la más vieja que ya venció y tu planilla no marca pagada), lo que cobrás de tus bonos y letras y el cierre del mes. Cada monto va en pesos y en dólares, al CCL de tu última carga. Lo que ya está acá no se repite en Atención.
- **Nada se pierde:** el desglose del financiero pasa a Variación del día; Atención, a Próximos 30 días (en el teléfono, a su renglón); Cargar ingreso y Cargar gasto, al cierre del mes; "Ver la evolución y el PnL" y "Ver el balance", a "Ver resultados", "Ver exposición" y "Ver posiciones".
- **En el teléfono** (el handoff no lo dibuja): arriba del pliegue, la lectura, el patrimonio neto y el financiero (una tarjeta de cuatro renglones de 44 px), la exposición en un renglón, Atención y "Todavía no cargaste hoy", como pide la visión (§4.1). Lo demás, una tarjeta debajo de otra.
- **Lo que el diseño pide y la app todavía no tiene:** "sin destino decidido" en un vencimiento cercano. La app no guarda qué vas a hacer con lo que cobrás, así que un vencimiento a menos de 15 días va en sangría, sin esa frase.
- **Por qué:** con las cuatro filas, Hoy contesta "¿cómo estoy?" arriba y deja el detalle abajo, sin perder nada de lo que mostraba.
- **Descartado:**
  - "Activos · Pasivos" al pie de la tarjeta, tal cual el handoff: esconde lo invertible detrás de la casa;
  - un solo gráfico con dos ejes, uno por moneda: el diseño lo prohíbe y se lee mal;
  - unir con una línea los días sin carga: sería un dato inventado.

### D-161 · Posiciones: la tabla densa en la Grilla, con la liquidez en sus filas y la barra Activo · TC — P (provisoria, a confirmar)
- **Qué:** Posiciones sigue la anatomía de D-157: la pregunta, la lectura (cuántas posiciones tenés y cuál explica más de lo que ganaste o perdiste en pesos), cuatro cifras clave (el valor de la cartera, el resultado total, la mejor por su resultado en pesos y la peor en dólares) y la tabla.
- **La tabla es la Grilla común** (AG Grid, D-157), con las columnas del handoff en su orden: Activo · Cantidad · PPC ARS · PPC USD · Precio · Valor · Result. ARS · Result. USD · Activo · TC · % cartera · Días. Las que no entran se ocultan por prioridad y van a "⋯": a 1440 px entran todas; a 1280 px, con la barra lateral abierta, Cantidad, PPC ARS y Días van a "⋯". Reemplaza la prioridad de columnas de D-113.
- **Activo · TC es una barra:** el resultado en pesos partido en lo que hizo el activo y lo que hizo el tipo de cambio, cada tramo proporcional a su tamaño. Su traza tiene el desglose en las dos monedas (D-68), así que reemplaza a las dos columnas de desglose de antes.
- **La liquidez va en la misma grilla, al pie,** con su cuenta. No tiene costo ni resultado: esas celdas dicen "—" (no aplica), que no es "sin dato". Así el % cartera suma 100% en la misma tabla.
- **Totales de lo que está a la vista,** fijos abajo. A una columna que le falta una fila le corresponde "sin dato", y debajo va la suma parcial con ¹ (D-65): la leyenda dice qué filas faltan.
- **Un precio viejo** se dice en la fila: debajo del ticker, "precio de hace 7 días" (D-16), y el precio va en gris.
- **Lo pendiente de cada fila** (una apertura sin CCL de compra, una compra con precio pendiente, una tenencia que la fuente ya no lista) y lo que quedó sin atribuir hoy, que antes estaban en el detalle de la fila, van debajo de la tabla, agrupados ("YPFD, FIMA y TXMJ0: Falta el CCL de compra de la apertura…"). En el teléfono, lo pendiente está en "Más datos" de cada tarjeta, como antes.
- **Por qué:** la Grilla resuelve el orden exacto, los totales fijos y el "sin scroll horizontal". Con la barra en lugar de las dos columnas de desglose, a 1280 px entran 8 columnas, y a 1440 px las 11.
- **Descartado:**
  - las dos columnas de desglose (activo / TC en pesos y en dólares): no entran con el resto sin scroll horizontal, y la barra con su traza dice lo mismo;
  - la liquidez en un bloque aparte: era una segunda tabla para tres filas.
- **Falta:** la densidad compacta del handoff (25 filas sin scroll), como preferencia en Ajustes. Hoy son 9 filas y entran enteras.

### D-162 · Pasivos: la tira de cuotas y cuatro cifras arriba, la cuota en pesos y en dólares con las próximas en la Grilla, y el resto en el detalle — P (provisoria, a confirmar)
- **Qué:** Pasivos sigue la anatomía de D-157 con lo del handoff (capturas 08 y 09), en este orden:
  1. la pregunta ("Compromisos · ¿Cuánto me falta pagar?") y la lectura;
  2. la tira de cuotas y, debajo, cuatro cifras: el saldo de capital, lo pagado, lo que falta y la opción de compra;
  3. la cuota en pesos y en dólares (1,4fr) y el cuadro de marcha de las próximas (1fr), las dos tarjetas del mismo alto;
  4. "El detalle: tu leasing", con lo que la pantalla ya tenía.
- **La lectura:** cuántas cuotas pagaste de cuántas y, después, lo primero que corresponda:
  - una cuota que venció y tu planilla no marca pagada;
  - cómo cambió la cuota en dólares, solo entre las pagadas con el CCL de su pago ("Cada una te costó *menos* dólares que la anterior", o la última contra la primera);
  - cuántas faltan y hasta cuándo.

  El handoff dice "te cuesta"; la app dice "te costó", porque habla de cuotas pagadas, cada una con el dólar de su pago. Sin cuadro, dice que falta importarlo; con todo pagado, cuándo es la opción de compra.
- **La tira:** una celda por cuota, tantas como dice el contrato (o el cuadro, si trae más): 35 en el contrato real, nunca un número fijo (el prototipo dibuja 48). Las pagadas van en tinta, la próxima en sangría con su brillo y las que faltan en hueco. Hay dos estados que el diseño no tiene:
  - una cuota que venció y la planilla no marca pagada: fondo sangría tenue, con un aviso;
  - una que el cuadro no trae: punteada, con una nota que lo dice.

  Nunca se dibuja como pagada una cuota que no lo está.
- **Las cuatro cifras,** cada una en pesos y en dólares, con su traza, su chip y una nota corta, como en el handoff:
  - **saldo de capital:** la deuda que cuenta en toda la app (D-131): la informada por la leasera; sin ella, la según el cuadro; sin cuadro o sin tasa, la estimada que aprobaste. La nota dice cuál es, y va en sangría clara, como en el diseño;
  - **pagado:** las cuotas pagadas; en dólares, al CCL de cada pago (sin ese CCL, sin dato);
  - **falta:** lo nominal de las cuotas que faltan, sin la opción; en dólares, al CCL de hoy (D-163);
  - **opción de compra:** con su IVA, al final del contrato.
- **Las próximas** son las seis primeras por pagar, en la Grilla (N° · Fecha · ARS · USD), adentro de la tarjeta como en la captura: sin borde ni radio propios, en mono de 12 px, con filas de 36 px (48 con el dedo, para que cada cifra sea un tocable de 44 px: D-100) y al ras del rótulo. Lo resuelven variables del tema de AG Grid puestas desde la pantalla: la Grilla común no cambia. Los dólares van en su pastilla, como toda cifra en dólares (D-68), aunque la captura los dibuja sin ella.
- **El detalle,** con el estilo nuevo: la deuda con su origen, la tasa del contrato, el costo contra el bien, el cuadro de marcha entero, cada cuota abierta, los totales, el recupero fiscal y el dólar, el leasing en palabras, el contrato y quién paga. Arriba a la derecha, el CCL con que se pasa a dólares, con su traza y su chip.
  - El cuadro de marcha entero pasa a la Grilla (D-157). Se filtra por pagar, pagadas o todas, y se lee como la factura o abierta en amortización y gasto. La opción de compra va aparte.
  - Lo pagado y lo que falta, abiertos en sus partes, también van en la Grilla.
  - Con el dedo (una tablet), las filas crecen para que ninguna cifra pise a la de abajo (D-100): 72 px en el cuadro, donde cada cifra lleva su chip, y 100 en lo pagado y lo que falta, que lleva dos cifras por celda.
- **Nada se pierde:**
  - las cuatro tarjetas de antes (cuotas pagadas, la próxima, lo que falta y el costo contra el bien) quedan en la tira, las cifras, las próximas y "Costo total contra el bien";
  - la frase pasa a "El leasing en palabras", con su hoja cifra por cifra en el teléfono;
  - el CCL que estaba arriba de la pantalla pasa al encabezado del detalle.
- **Por qué:** el diseño contesta "¿cuánto me falta pagar?" de un vistazo, arriba. El detalle conserva todo lo que la pantalla ya hacía.
- **Descartado:**
  - una tira de 48 celdas fija, como el prototipo: el contrato real tiene 35;
  - los dólares de las próximas sin pastilla, como en la captura: rompe D-68;
  - sacar "Ver como tabla" del gráfico: es la tabla para el lector de pantalla y la tienen todos los gráficos.

### D-163 · En dólares, lo que falta del leasing va al CCL de hoy, no a una senda del dólar — P (provisoria, a confirmar)
- **Qué pide el handoff:** la línea de la cuota en dólares, punteada después de hoy, "con la senda de CCL del escenario base", y la cifra "Falta" en dólares "proyectada con la senda base".
- **Qué hace la app:** lo que falta va al CCL de hoy (el de tu última carga), rotulado: "una referencia, no una proyección del dólar". La línea punteada queda plana mientras la cuota en pesos no cambie. Las pagadas van al CCL del día de su pago (D-140) y, sin ese CCL, son un hueco en la línea, nunca un cero.
- **Por qué:** la app no inventa ni estima tipos de cambio. En Pasivos tampoco hay un escenario elegido: las sendas del dólar son supuestos de Flujo y escenarios, y las elegís ahí. Usar una acá mostraría como dato un supuesto que no elegiste, en una pantalla que no habla de escenarios.
- **Descartado:**
  - la senda del escenario abierto en Flujo: depende de lo que estés probando allá, y Pasivos no lo muestra;
  - proyectar el CCL con la inflación o con una tendencia: sería un tipo de cambio inventado.
- **Si la querés:** cuánto cuesta en dólares lo que falta con cada escenario cabe en Flujo y escenarios, donde ya están las sendas.

### D-164 · Flujo arranca con todo en Igual y a 12 meses, con una barra por variable (revisa D-145) — P (provisoria, a confirmar)
Lo pediste el 15/10: «en flujos y escenarios quiero ver graficos» y «seleccionar los valores de las variables con barras».
- **Qué:** al abrir Flujo, cada variable está en **Igual** (como en tu última carga) y el horizonte en **12 meses**, así que la lectura, la cascada del mes y el patrimonio en dólares se ven sin tocar nada:
  - las variables de mercado: devaluación, inflación, brecha, retornos y TEM de renovación;
  - tus bienes: la casa y la camioneta;
  - los tramos de tu ingreso y los gastos.

  Igual sigue siendo un supuesto, y la lectura lo dice: "Con todo igual, en un año llegás a…".
- **Una barra por variable:**
  - va de Baja a Sube, con Igual en el medio (marcado), de a 0,1;
  - tiene − y + a los costados y el número a la vista ("Sube +2,0 %/mes");
  - "Volver a Igual" la devuelve de un toque, y "Todo en Igual" las devuelve todas;
  - se maneja con el teclado (flechas, Inicio y Fin) y el lector de pantalla la lee en palabras;
  - tus números recordados (D-148) aparecen al lado como botones: un toque la lleva ahí.
- **Los gráficos cambian en vivo:** la proyección corre en el navegador con cada movimiento.
  - La lectura y el patrimonio en dólares la siguen en menos de 200 ms con la CPU × 4 (e2e, con el build de producción).
  - El detalle de abajo (la grilla mes a mes y sus dos gráficos) se pone al día cuando la barra queda quieta 0,9 s. Es lo más pesado de redibujar y, si se dibuja mientras la barra se mueve, demora lo de arriba.
  - La dirección (`?s=`) se escribe cuando la barra queda quieta 0,6 s: una sola entrada de historial por movimiento.
- **"Todo igual" de referencia:** cuando movés algo, el patrimonio en dólares suma la línea del mismo escenario con todas las barras en Igual.
- **Lo que no tiene Igual posible no tiene barra:** la brecha sin el cripto, o la TEM de renovación sin la TEM de hoy. En su lugar, dice qué falta.
- **Un escenario guardado de antes** (o una dirección vieja) lee en Igual lo que había dejado sin elegir, y sin horizonte, en 12 meses.
- **Lo precargado no cambia:** tu regla de reinversión del 14/10 y "la cuota la pagás vos" (D-155).
- **Por qué:** con D-145, Flujo abría sin gráficos: había que tocar "Completar lo que falta con Igual" y después elegir un horizonte.
- **Descartado:**
  - Baja · Igual · Sube en botones más un deslizante aparte: son dos controles para lo que la barra hace en uno;
  - arrancar en los 36 meses del diseño: es su número de ejemplo. Con 12, la lectura dice "en un año" y la grilla mes a mes entra entera. El horizonte se cambia de un toque (6, 12 o 24 meses, o el fin del leasing).

### D-165 · Sin Monte Carlo, el patrimonio en dólares es un solo camino: el rango es "sin dato" y la probabilidad pasa a "¿terminás debajo de lo que pusiste?" (detalla D-144) — P (provisoria, a confirmar)
- **Qué:** el bloque del diseño queda en su lugar y con su estilo, sin abanico:
  - la línea del escenario en oro, de 2,5 px: la de la mediana del diseño;
  - "lo que pusiste" en gris, rayada 4 4: el capital aportado del diseño;
  - "Todo igual" de referencia (D-164).
- **Las tres cifras de abajo:**
  1. el financiero al horizonte, en lugar de la mediana, con su traza;
  2. "Rango p5 – p95": *sin dato* · llega con Monte Carlo: hoy es un solo camino;
  3. "¿Terminás debajo de lo que pusiste?": Sí o No, con cuánto. Es la salida determinística de D-144 y va en lugar de la probabilidad.
- **El rótulo lo dice:** "Patrimonio financiero en dólares · 12 meses · un camino". En el diseño dice "· Monte Carlo".
- **Es el financiero:** la proyección es de lo invertible (D-03). La casa y la camioneta van en el detalle, en "Neto sin la camioneta".
- **Sin eje de montos, como en el diseño:** los montos están en el tooltip, en la tabla del gráfico y en las cifras de abajo.
- **Por qué:** D-144 deja Monte Carlo para la fase 3. "Sin dato, nunca cero" vale también para un percentil: un abanico sin Monte Carlo sería un rango inventado.
- **Descartado:**
  - una banda con un ± fijo: no sale de ningún cálculo;
  - sacar el bloque: el diseño lo pone en el centro de la pantalla, y su lugar avisa lo que falta.

### D-166 · Flujo: arriba lo del diseño, debajo las barras y abajo el detalle de siempre; Cargar ingreso y Cargar gasto van al mes en curso — P (provisoria, a confirmar)
- **Qué:** Flujo sigue la anatomía de D-157 (handoff, captura 10):
  1. **La pregunta y la lectura:** "Futuro · ¿Cuánto me sobra y adónde me lleva?" y una frase con cuánto te sobra este mes y adónde llegás al horizonte con el escenario elegido ("Este mes te sobran $ … Con todo igual, en un año llegás a *US$ …* en lo financiero."). Cada cifra abre su traza.
  2. **La cascada del mes:** Ingresos USD × cripto → Pesos fijos → Gastos fijos → Cuota leasing → Excedente, y el reintegro del IVA si lo declaraste. Sale de lo declarado y de tu última carga, así que no depende de los supuestos. El nombre de cada paso abre la traza de su cifra.
  3. **El patrimonio en dólares** (D-165), con la pastilla de escenarios: Igual y tus guardados. Un guardado al que le moviste una barra dice "con tus cambios".

  Debajo van **tus supuestos, una barra por variable** (D-164). Después, **el detalle**:
  - la proyección mes a mes: las cajas al horizonte, el flujo y el patrimonio proyectados y la grilla;
  - tus escenarios guardados;
  - el mes en curso;
  - el calendario y proyectado contra real;
  - lo que cargaste, tus ingresos y gastos declarados y los pagos al vencimiento que faltan.
- **Cargar ingreso y Cargar gasto** pasan del encabezado al mes en curso ("Octubre, con los datos de hoy"), que es lo que cambian. Sin cargas, van en "Lo que cargaste". Siguen también en Hoy (Próximos 30 días) y en `/flujo/cargar`, que toma la anatomía: la pregunta, "Cargar *ingreso*" y la pastilla Ingreso · Gasto.
- **Con qué datos se armó el mes** (la fecha de tu carga, el CCL y el cripto, cada uno con su traza) va en el mes en curso. Antes estaba en el encabezado; la barra superior también los muestra.
- **Por qué:** el diseño pone arriba la pregunta del mes y la del futuro. Lo que la pantalla tenía y el diseño no muestra va abajo, sin perder nada (D-156).
- **Descartado:**
  - Cargar ingreso y Cargar gasto a la derecha del encabezado: el diseño no tiene nada ahí;
  - las barras en una columna al costado de los gráficos: el diseño reparte ese ancho entre la cascada y el patrimonio.

### D-167 · Si lo imprescindible de una tabla no entra en su lugar, tarjetas, también desde 768 px (detalla la Grilla de D-157) — P (provisoria, a confirmar)
- **El caso:** la barra lateral abierta a mano (su botón, o Ajustes) queda abierta en todos los anchos (D-156). Entre 768 y 1279 px ocupa 232 px en lugar de 68, y a 768 px al contenido le quedan unos 480. La Grilla oculta columnas por prioridad, pero las de prioridad 0 se veían siempre, aunque no sumaran: era "responsabilidad de la pantalla" que entraran a 768 px, y cada pantalla las ajustó con la barra colapsada. Con la barra abierta, a 768 px, siete grillas tenían scroll horizontal adentro (D-30): Posiciones, el estado de situación y el comparativo del balance, Registro, el PnL por mes, lo pagado y lo que falta del leasing, y proyectado contra real. El test de layout no lo veía: recorría siempre con la barra en automático.
- **Qué:** la Grilla ya medía su lugar para elegir columnas. Ahora, si lo imprescindible no entra, no dibuja la tabla: en su lugar van las tarjetas, las mismas que debajo de 768 px.
  - **Lo imprescindible:** las columnas de prioridad 0 y, si alguna columna queda afuera, el botón "⋯" de la ficha (48 px). Si entran todas, no hace falta la ficha. Es la condición exacta para que lo que elige la grilla, con su ficha, no pase el ancho. La calcula una función pura con test (`entraLoImprescindible`, en `src/components/grilla/columnas.ts`).
  - **Sigue midiendo:** si la ventana crece o colapsás la barra, vuelve la tabla; si la abrís, vuelven las tarjetas. Mientras no hay medida, el esqueleto de siempre.
  - **Una sola lista a la vez,** con el nombre de la tabla: las tarjetas van adentro del contenedor de la grilla (marcado `data-modo="tarjetas"`) o, debajo de 768 px, donde iban. Nunca en los dos lugares.
  - **Tarjetas que no son una por fila:** la pantalla se las pasa armadas a la Grilla (`tarjetas`). Es el caso del estado de situación: van sus tarjetas que se pliegan (IEB ▸, Galicia ▸, Bienes ▸), las del teléfono.
  - **Donde entra, nada cambia:** los anchos que ya pasaban siguen con la misma tabla y las mismas columnas.
- **Se revisa la nota de la Grilla** (`columnas.ts`): «Las de prioridad 0 entran siempre (aunque no sumen): es responsabilidad de la pantalla que lo imprescindible quepa en 768 px» pasa a «Las de prioridad 0 se eligen siempre, aunque no sumen. Si no entran (con la ficha, si alguna queda afuera), la grilla no se dibuja: pasa a tarjetas». Cada pantalla sigue eligiendo qué es imprescindible y sus anchos, para que a 768 px con la barra colapsada se vea la tabla. Un lugar que no previó ya no rompe nada.
- **Fuera de la Grilla, a 768 px con la barra abierta:**
  - Datos › Catálogo, una tabla común, pasa a las tarjetas del teléfono con menos de 600 px de lugar (una consulta de contenedor). La tabla pide unos 550 con los datos de ejemplo, y a 768 px con la barra colapsada tiene 644;
  - en Cargar, el botón Guardar no se achica: el tiempo activo de su izquierda baja de renglón.
- **Cómo se prueba:** el test de layout (D-30) recorre también 768 y 1024 px con la barra abierta: todas las pantallas, con capturas. Una grilla en tarjetas no es "no se dibujó": sus tarjetas las revisa el control de layout, como cualquier contenido. Un test de propiedades compara la cuenta con lo que elige la grilla, con columnas y anchos al azar.
- **Por qué:** las tarjetas ya son la forma de la app para el poco ancho (D-30) y muestran todo, también lo que en la tabla iría a "⋯". El ancho de la barra lo elegís vos, no la pantalla: que cada pantalla prevea cada combinación de ventana y barra no escala.
- **Descartado:**
  - colapsar la barra sola cuando una tabla no entra: la abriste vos, y la preferencia es tuya;
  - achicar los mínimos de las columnas hasta que entren en 480 px: las cifras más largas se cortarían;
  - dejar la tabla con scroll horizontal adentro: D-30 lo prohíbe en cualquier ancho.

### D-168 · La plata que falta entre dos composiciones y no se sabe adónde fue es un gasto — D
- **Lo que dijiste (16/10):** «yo te paso la composición de mi portafolio constantemente con capturas acá. Si hay plata que no sabés dónde se fue porque encontrás una diferencia en el neto, considerala un gasto».
- **Qué:** al cargar una composición, si una cuenta tiene menos plata de la que explican la composición anterior, las operaciones y los movimientos ya cargados, la diferencia es un **gasto**. Se carga como un retiro de esa cuenta (Datos › Movimientos), con la fecha de la composición que la muestra y una nota con la cuenta que la arma (saldo anterior − movimientos conocidos − saldo nuevo).
- **Lo que una captura no muestra no desaparece:** queda con su último valor conocido (D-16), como cualquier dato que no se carga. Una captura puede mostrar una parte de la cuenta: la del 16/10 mostró un fondo que la del 15/10 no tenía.
- **Plata que se fue a algo que la app no sigue:** si la plata salió hacia una tenencia que la app todavía no tiene (por ejemplo, un fondo suscripto con plata de otra cuenta), es un retiro de la cuenta de la que salió. Cuando esa tenencia aparece en una composición, entra como apertura ("Ya la tenía"): plata que entra de afuera a su valor de ese día, no una ganancia, con el costo sin dato si la captura no lo muestra.
- **Lo que sobra no es gasto:** si una cuenta tiene más plata de la que se explica, no se inventa nada. Si lo explica la TNA del saldo, es rendimiento. Si no, es un **aporte** (plata tuya que vino de afuera), nunca rendimiento: así la ganancia de tus inversiones no se infla.
- **Por qué:** sin la regla, la plata que gastaste se leía como pérdida de tus inversiones (el resultado de la cuenta), y Hoy, Exposición y Evolución decían que perdiste lo que en realidad gastaste.
- **Cómo se carga:** como un retiro en los movimientos de capital, no como un gasto cargado en Flujo. En Flujo, un gasto del mes cargado reemplaza a los gastos declarados de ese mes en el excedente, y una diferencia no dice de qué fue ni si es del mes entero.
- **Descartado:**
  - preguntar por cada diferencia: pediste no hacerlo;
  - repartir la diferencia entre los días que separan dos composiciones: no hay dato de cada día. Va con la fecha de la composición que la muestra, que da el mismo resultado entre esas dos composiciones.

### D-169 · La cascada del puente de Evolución es horizontal — D
- **Lo que dijiste (19/10):** «bug, este gráfico está roto», con una captura del puente donde los rótulos y los montos se pisaban.
- **Qué:** la cascada del puente va acostada: un escalón por renglón (Aportes, Cuotas, Activos, Dólar, Sin atrib., Cambio), con el nombre a la izquierda y el monto a la derecha de la barra. A la derecha queda lugar para el monto más largo.
- **Por qué:** en vertical, con las dos monedas lado a lado, cada columna tenía unos 45 px. "Sin atrib." mide unos 60 px y "+$ 5,2 M" unos 50: se pisaban con los de al lado. En horizontal, cada rótulo y cada monto tiene su renglón, a cualquier ancho.
- **Descartado:**
  - rotar los rótulos: los montos de arriba de las barras se seguían pisando;
  - esconder los que se pisan: se pierde el monto justo cuando la pantalla es chica;
  - un gráfico debajo del otro: no arregla la tarjeta con la barra lateral abierta y deja el puente el doble de alto.

## Propuestas que la 1a implementa en forma provisoria

Estas propuestas de `docs/investigacion-mercado.md` (D-35 a D-53) y de `docs/vision.md` §6 (D-54 a D-103) siguen esperando tu aprobación. La 1a ya las usa porque el código las necesitaba. Estado de todas: **P (provisoria, a confirmar)**. Si rechazás una, se cambia el código y se anota acá.

| Nº | Propuesta | Cómo la implementa la 1a | Qué falta |
|---|---|---|---|
| D-35 | Desglose activo/TC por intervalos entre observaciones frescas, con "sin atribuir" | Cada partida (un precio o un saldo) se desglosa por los intervalos entre sus observaciones frescas: su propio dato y un CCL tipeado el mismo día. Lo que no tiene observación fresca queda "sin atribuir" y se devuelve cuando llega. Activo + CCL + sin atribuir = resultado, exacto. Un período es la suma exacta de sus días, y una carga express entre dos completas no cambia el desglose del período. Un saldo que aparece por primera vez (y la primera valuación de un bien o el primer capital de una deuda) entra como apertura, nunca como ganancia. Cartera usa la misma suma de intervalos desde la compra (más un tramo por lote antes de la primera carga, al CCL de compra), solo de la tenencia vigente: cada venta o vencimiento deja lo acumulado × cantidad después ÷ cantidad antes, como el costo, tomada al precio y al CCL de la observación de ese día, y las rentas no entran (D-114). Así activo + TC + sin atribuir = resultado de la fila (corregido el 14/10: después de una venta parcial no sumaba). Una venta sin observación propia, o el mismo día que una compra, una apertura o un cambio de ratio, usa un solo intervalo con el CCL promedio de compra. Si el resultado de la fila es "sin dato", sus partes también (D-126). Las partes se muestran redondeadas por resto mayor | El rótulo "atribuido el vie 16/10" en la frase del día viejo; la aclaración de feriado en EE.UU. ("mayormente brecha de CCL implícito") |
| D-36 | Capturas: dos lecturas en paralelo, null antes que adivinar, imagen intacta | Ver D-108 | Una relectura dirigida cuando la aritmética no decide; partir en franjas las imágenes que pasan el límite |
| D-37 | Tolerancia según la precisión mostrada | IEB, según el formato de cada celda (D-107); capturas, según los decimales que se ven (D-108). Cada control lleva su tolerancia | — |
| D-38 | B2, los Subtotales de IEB y el total de Galicia son controles | Se calculan en cada lectura y la bandeja los muestra: ✓, ≠ o no verificable | Guardarlos y volver a evaluarlos cuando cambia un hecho anterior |
| D-46 | FIMA es un FCI: cuotapartes × valor de cuotaparte | La captura lee cuotapartes y valor de cuotaparte (precio cada 1.000 si así cierra) y sugiere el tipo `fci` | Validarlo con una captura real |
| D-47 | Filas diferidas: lo pendiente no se graba ni cuenta como venta | Ver D-106. Una tenencia que la fuente ya no lista y queda pendiente vale "sin dato" (D-117), y una carga con algo pendiente deja su cuenta en ≠ "parcial" (D-118) | Pendientes como pantalla (1b); en la 1a viven en Atención |
| D-53 | Jerarquía de Hoy | Las cuatro filas del rediseño (D-160): la lectura y el patrimonio neto; la variación del día, la exposición y el excedente del mes; el patrimonio neto en el tiempo y Próximos 30 días (la cuota del leasing, lo que vence de tus bonos y letras, el cierre del mes con Cargar ingreso y Cargar gasto), con Atención debajo; y qué tenés y qué debés. En el teléfono, Atención en un renglón | La línea de veredicto (fase 4) |
| D-54 | Clave `sb_secret_…` de Supabase | La app lee `SUPABASE_SECRET_KEY`, y `SUPABASE_SERVICE_ROLE_KEY` como alternativa | — |
| D-57 | `proxy` de Next 16 y sesión verificada en cada acción | Ver D-112. Dependencias en versiones exactas | Lint y CI |
| D-61 | La fecha de los datos la da la fuente | La carga toma la fecha del B1 del Excel; sin Excel, la que muestra una captura; sin ninguna, hoy en Córdoba. Si una fuente es de otro día, la bandeja avisa. La fecha se puede cambiar a mano | — |
| D-62 | Tiempo activo por tramos | Se mide en Cargar (un tramo se corta después de 60 s sin gestos), se guarda con el lote y el Registro lo muestra | El tiempo de punta a punta y el dispositivo de cada archivo |
| D-63 | Borrador de carga en el servidor | Sin tabla de borradores: la lectura grabada es la del servidor gracias a la firma (D-105), y cada archivo va a su ruta definitiva, nombrado por su sha256, desde que se lee | El borrador (si cerrás la pestaña antes del Enter, hay que volver a soltar los archivos) y el trabajo que borra archivos huérfanos |
| D-64 | Tres cargas válidas: express, media y completa | Las tres se guardan con el mismo Enter; en una express, todo el cambio del día queda "sin atribuir" | — |
| D-65 | Un total al que le falta una parte es "sin dato", con la suma parcial a la vista | En Hoy (la tarjeta del patrimonio neto, con la suma parcial en pesos y en dólares y su traza), Posiciones (las cifras clave y los totales de la tabla, con la marca ¹) y Exposición. Si no se conoce ninguna parte, no hay suma parcial: es "sin dato" con el motivo de lo que falta, nunca "suma parcial (0 de 1): $ 0,00" (D-126) | — |
| D-66 | Cuadre visible y diferencias de criterio con nombre | Hoy muestra el cuadre del día (✓, ≠ o no verificable), recalculado desde los hechos, con la diferencia en pesos y en dólares y su traza: "cierra (diferencia $ 0,00 · US$ 0,00)" o "no cierra por …". "No verificable" dice qué partida falta. La plata de una cuenta sin saldo cargado cuenta como flujo externo (D-125). La bandeja nombra la diferencia de criterio de IEB: "DOLARUSA al dólar de IEB contra tu CCL", con su monto | Revisarlo contra tus archivos reales |
| D-67 | Toda cifra trae `{valor, formula, insumos, explicacion, etiquetas}` | Así está el contrato del motor; los tests verifican que las etiquetas se propaguen | El Historial de correcciones en la traza |
| D-68 | Pares ARS/USD y tablas anchas | El USD va en una pastilla tintada y el ARS a la izquierda o arriba; en las tarjetas, la moneda de riesgo va grande; en Posiciones, la barra Activo · TC lleva el desglose en las dos monedas en su traza, y las columnas que no entran van a "⋯" (D-161) | Las columnas de tu tesis (1b) |
| D-69 | Lo no desplegado no aparece | La navegación tiene solo las siete secciones de la 1a. Una cifra de una fase futura dice "sin dato · llega en la fase N" | — |
| D-70 | Día cero guiado, en un orden fijo | El orden está en `docs/manual.md` y en `docs/carga-diaria.md`. Hoy sin datos muestra el Día cero en ese orden, con la acción principal en Datos › Leasing y la segunda en Cargar (D-128) | La lista de pasos en Datos (1b) |
| D-73 | La moneda de riesgo la elegís vos | El alta de un activo no trae moneda de riesgo por defecto. Los bienes todavía no tienen ese dato: en la vista Total de Exposición el neto es "sin dato", con la suma parcial, y los bienes van a "Sin elegir" (no suman ni a pesos ni a dólares) | Elegir la moneda de riesgo de cada bien (1b) |
| D-76 | La foto del 31/12 | El aviso de diciembre en Hoy | El checklist en Atención (1b) |
| D-100 | Tocables de 44 px con puntero grueso | El test de layout lo verifica en cada pantalla, también Cargar y las cinco de Datos (todas frenan el test): con puntero grueso debajo de 768 px, y además a 768 y 1024 px con el dedo (una tablet o el teléfono acostado). Con mouse, el objetivo es la fila entera: no se adopta el mínimo de 24 px de WCAG 2.2 (D-128) | Filas de 28 px con mouse en Cartera (hoy miden unos 50 px) |
| D-101 | Qué netea cada vista de Exposición | Rótulo "pesos financieros − deuda del leasing", también en Hoy. La vista Total es "sin dato" mientras un bien no tenga moneda de riesgo. La concentración se mide siempre sobre el patrimonio financiero (D-03) | — |
| D-102 | Perímetro de cada cuenta (inversión, consumo o mixta) | **No implementada.** La 1a no tiene perímetro por cuenta, y "¿Entró o salió plata?" pregunta cuando un saldo remunerado sube más de lo que explica la TNA de la captura **y también cuando baja**, que es lo que D-102 propone evitar en una cuenta mixta como Mercado Pago | El perímetro por cuenta y la "salida a consumo, sin confirmar"; mientras tanto, cada gasto pagado desde MP aparece como una baja para revisar |
