# Decisiones

Registro de cada decisión de diseño que ajusta o completa `docs/spec.md`: qué se decidió, por qué y qué se descartó. Las decisiones no se borran. Si una cambia, se agrega una nueva que la reemplaza y la vieja queda marcada como **reemplazada por D-NN**.

Estado: **D** = decidida · **P** = propuesta, esperando confirmación del dueño · **P (provisoria, a confirmar)** = propuesta que la fase 1a ya implementa mientras esperás para confirmarla. Si la rechazás, el código se cambia.

Numeración: D-01 a D-34 están acá. D-35 a D-53 son propuestas de `docs/investigacion-mercado.md` y D-54 a D-103 de `docs/vision.md` §6 (todas esperan tu aprobación). Las decisiones nuevas siguen desde **D-104** (ver "Fase 1a" y, desde **D-117**, "Revisión de la 1a"). Al final, "Propuestas que la 1a implementa en forma provisoria" lista cuáles de esas propuestas ya están en el código y cómo.

---

## Producto

### D-01 · Empezar de cero, no iterar sobre Corte — D
La app anterior (Corte: libro líquido mobile-first con memo de IA) no resolvía el problema. Se reescribe desde cero contra `docs/spec.md`. El código de Corte sigue en el repo hasta que la fase 1 lo reemplace en producción; su base (schema `corte` en el proyecto Supabase `plasmart-reports`) no se toca.

*Actualización 2026-10-08 (fase 1a):* el código de Corte ya salió del repo, y el despliegue de la 1a lo reemplaza en el proyecto `portfolio` de Vercel. El schema `corte` sigue sin tocarse.

*Actualización 2026-10-14 (revisión de la 1a):* también salió `supabase/schema.sql`, el schema de Corte que había quedado junto a las migraciones (con un MEP fijo y columnas de precios externos). Nada lo usaba. El schema `corte` de la base de Corte sigue sin tocarse.

### D-02 · Proyecto Supabase dedicado — D
Proyecto **Portfolio** (`zcgynhzddfjzwswekcvl`, sa-east-1), schema `public`. Queda separado de las bases de Plasmart: datos personales y de negocio no comparten proyecto ni credenciales. Vercel: proyecto `portfolio` existente (equipo `marianomanto-cmds-projects`).

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
- **Cartera, prioridad de columnas (D-68):** además del orden de la visión, una red de seguridad oculta columnas del final si con los datos reales igual no entran. La tabla tiene 13 columnas. A 1280 px con la barra lateral expandida entran 7, y a 1600 px, 10; las otras van al detalle de la fila. Colapsando la barra entran más. Todas entran desde unos 1910 px (1730 px con la barra colapsada). (Corregido el 14/10: antes decía 11 columnas, todas desde 1600 px.)
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
- **Falta:** que la app lo calcule sola desde el cuadro de marcha, con su fórmula (entrega 4). Que diga "estimado" en el número y en su traza ya está: D-154.

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
| D-53 | Jerarquía de Hoy | Arriba, el estado de los datos; Atención a la derecha desde 1280 px y en un renglón en el teléfono; "Excedente: sin dato · llega con Flujo (fase 2)" | La línea de veredicto (fase 4) |
| D-54 | Clave `sb_secret_…` de Supabase | La app lee `SUPABASE_SECRET_KEY`, y `SUPABASE_SERVICE_ROLE_KEY` como alternativa | — |
| D-57 | `proxy` de Next 16 y sesión verificada en cada acción | Ver D-112. Dependencias en versiones exactas | Lint y CI |
| D-61 | La fecha de los datos la da la fuente | La carga toma la fecha del B1 del Excel; sin Excel, la que muestra una captura; sin ninguna, hoy en Córdoba. Si una fuente es de otro día, la bandeja avisa. La fecha se puede cambiar a mano | — |
| D-62 | Tiempo activo por tramos | Se mide en Cargar (un tramo se corta después de 60 s sin gestos), se guarda con el lote y el Registro lo muestra | El tiempo de punta a punta y el dispositivo de cada archivo |
| D-63 | Borrador de carga en el servidor | Sin tabla de borradores: la lectura grabada es la del servidor gracias a la firma (D-105), y cada archivo va a su ruta definitiva, nombrado por su sha256, desde que se lee | El borrador (si cerrás la pestaña antes del Enter, hay que volver a soltar los archivos) y el trabajo que borra archivos huérfanos |
| D-64 | Tres cargas válidas: express, media y completa | Las tres se guardan con el mismo Enter; en una express, todo el cambio del día queda "sin atribuir" | — |
| D-65 | Un total al que le falta una parte es "sin dato", con la suma parcial a la vista | En Hoy (las dos tarjetas, con la suma parcial en pesos y en dólares y su traza), Cartera y Exposición. Si no se conoce ninguna parte, no hay suma parcial: es "sin dato" con el motivo de lo que falta, nunca "suma parcial (0 de 1): $ 0,00" (D-126) | — |
| D-66 | Cuadre visible y diferencias de criterio con nombre | Hoy muestra el cuadre del día (✓, ≠ o no verificable), recalculado desde los hechos, con la diferencia en pesos y en dólares y su traza: "cierra (diferencia $ 0,00 · US$ 0,00)" o "no cierra por …". "No verificable" dice qué partida falta. La plata de una cuenta sin saldo cargado cuenta como flujo externo (D-125). La bandeja nombra la diferencia de criterio de IEB: "DOLARUSA al dólar de IEB contra tu CCL", con su monto | Revisarlo contra tus archivos reales |
| D-67 | Toda cifra trae `{valor, formula, insumos, explicacion, etiquetas}` | Así está el contrato del motor; los tests verifican que las etiquetas se propaguen | El Historial de correcciones en la traza |
| D-68 | Pares ARS/USD y tablas anchas | El USD va en una pastilla tintada y el ARS a la izquierda o arriba; en las tarjetas, la moneda de riesgo va grande; Cartera tiene dos columnas de desglose y prioridad de columnas (D-113) | Las columnas de tu tesis (1b) |
| D-69 | Lo no desplegado no aparece | La navegación tiene solo las siete secciones de la 1a. Una cifra de una fase futura dice "sin dato · llega en la fase N" | — |
| D-70 | Día cero guiado, en un orden fijo | El orden está en `docs/manual.md` y en `docs/carga-diaria.md`. Hoy sin datos muestra el Día cero en ese orden, con la acción principal en Datos › Leasing y la segunda en Cargar (D-128) | La lista de pasos en Datos (1b) |
| D-73 | La moneda de riesgo la elegís vos | El alta de un activo no trae moneda de riesgo por defecto. Los bienes todavía no tienen ese dato: en la vista Total de Exposición el neto es "sin dato", con la suma parcial, y los bienes van a "Sin elegir" (no suman ni a pesos ni a dólares) | Elegir la moneda de riesgo de cada bien (1b) |
| D-76 | La foto del 31/12 | El aviso de diciembre en Hoy | El checklist en Atención (1b) |
| D-100 | Tocables de 44 px con puntero grueso | El test de layout lo verifica en cada pantalla, también Cargar y las cinco de Datos (todas frenan el test): con puntero grueso debajo de 768 px, y además a 768 y 1024 px con el dedo (una tablet o el teléfono acostado). Con mouse, el objetivo es la fila entera: no se adopta el mínimo de 24 px de WCAG 2.2 (D-128) | Filas de 28 px con mouse en Cartera (hoy miden unos 50 px) |
| D-101 | Qué netea cada vista de Exposición | Rótulo "pesos financieros − deuda del leasing", también en Hoy. La vista Total es "sin dato" mientras un bien no tenga moneda de riesgo. La concentración se mide siempre sobre el patrimonio financiero (D-03) | — |
| D-102 | Perímetro de cada cuenta (inversión, consumo o mixta) | **No implementada.** La 1a no tiene perímetro por cuenta, y "¿Entró o salió plata?" pregunta cuando un saldo remunerado sube más de lo que explica la TNA de la captura **y también cuando baja**, que es lo que D-102 propone evitar en una cuenta mixta como Mercado Pago | El perímetro por cuenta y la "salida a consumo, sin confirmar"; mientras tanto, cada gasto pagado desde MP aparece como una baja para revisar |
