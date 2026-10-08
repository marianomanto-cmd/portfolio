# Decisiones

Registro de cada decisión de diseño que ajusta o completa `docs/spec.md`: qué se decidió, por qué y qué se descartó. Las decisiones no se borran. Si una cambia, se agrega una nueva que la reemplaza y la vieja queda marcada como **reemplazada por D-NN**.

Estado: **D** = decidida · **P** = propuesta, esperando confirmación del dueño.

---

## Producto

### D-01 · Empezar de cero, no iterar sobre Corte — D
La app anterior (Corte: libro líquido mobile-first con memo de IA) no resolvía el problema. Se reescribe desde cero contra `docs/spec.md`. El código de Corte sigue en el repo hasta que la fase 1 lo reemplace en producción; su base (schema `corte` en el proyecto Supabase `plasmart-reports`) no se toca.

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

### D-17 · Log de carga de datos — D
Pedido del dueño (2026-10-07). Dos niveles:
1. **Registro de cargas** (tabla `cargas`, pantalla "Registro"): cada carga confirmada queda con fecha y hora, cuenta, origen (Excel, captura o manual), el archivo original, la lectura cruda del parser o de la IA, lo que se grabó (cuántas cotizaciones, saldos y operaciones), las diferencias de conciliación que había y qué se hizo con ellas. Una carga se puede **revertir** como unidad: se borran sus filas, la carga queda marcada como revertida y no desaparece del registro.
2. **Auditoría de cambios** (tabla `auditoria`, con un trigger en las tablas de datos): todo insert, update o delete guarda la fila antes y después, la carga que lo produjo y la hora. Si un precio se corrige a mano, el valor anterior sigue visible.

Con esto, la trazabilidad llega hasta el origen: número → fórmula → insumos → carga → archivo.

### D-18 · Valor de un CEDEAR = precio en pesos del bróker — D
La fórmula del spec (`precio_subyacente_usd × TC ÷ ratio`) necesita el precio del subyacente en USD, y ninguna de las fuentes diarias lo trae (ni el Excel de IEB, ni las capturas, ni los dos campos de tipo de cambio). Aplicada al pie de la letra, todo CEDEAR sería "sin dato". Reconstruirla como `precio_pesos × ratio ÷ CCL` sería guardar un dato derivado como si fuera un hecho.
- Valor en pesos = `cantidad × precio en pesos` (del bróker).
- Valor en USD = valor en pesos ÷ CCL del día.
- Si se carga el precio del subyacente en USD (opcional), se usa para partir el efecto "activo" en dos: lo que se movió el subyacente y lo que se movió el **CCL implícito** del CEDEAR (`precio_pesos × ratio ÷ precio_subyacente`).

### D-19 · Compras del día y costos pendientes — D
El día de una compra, IEB muestra PPP `-`. La compra se graba como `compra` (no como `apertura`), con el CCL del día y el precio vacío, que significa **pendiente**. La carga del día siguiente lo completa a partir del PPP nuevo, `(PPP₁ × q₁ − PPP₀ × q₀) ÷ Δq`, y la auditoría guarda el cambio. Mientras falte, el PPC de esa posición es "sin dato" pero la cantidad cuenta.

### D-16 · Precio viejo = más de 2 días hábiles — D
Con una tabla `feriados` cargada a mano una vez por año. Si se contaran días corridos, todo el portafolio aparecería "viejo" cada lunes.

## Seguridad y datos

### D-20 · Base cerrada; solo el servidor la toca — D
RLS activado en todas las tablas, sin políticas, y sin permisos para `anon` ni `authenticated`. El servidor usa `service_role` (variable de entorno de Vercel, nunca en el cliente). El navegador no habla con Supabase: todo pasa por server components y server actions.

### D-21 · Clave simple en lugar de Vercel Password Protection — D
Vercel Password Protection es un add-on pago. En su lugar: middleware de Next.js con una clave en una variable de entorno y una cookie firmada (HMAC). Costo cero y suficiente para un solo usuario.

### D-22 · Cálculos en TypeScript, no en SQL — D
SQL guarda hechos y tiene vistas triviales (suma de cantidades, último precio, último saldo). PPC, resultados, desglose activo/TC, TIR, TEM y valor técnico van en funciones puras con tests, que devuelven el valor junto con la fórmula y sus insumos. Esa salida es lo que muestra la trazabilidad al hacer hover o click. Tener la misma lógica en dos lugares termina en dos resultados distintos.

### D-23 · Hechos, no estado — D
Además de las posiciones (spec), tampoco se guardan `cuotas_pagadas`, totales de flujo ni excedente. Se derivan. `pasivo_cuotas.pagado_bool` pasa a ser `fecha_pago` (null = impaga). `niveles` apunta a la operación que lo ejecutó, en lugar de copiar su precio y fecha.

### D-24 · Datos reales fuera de git — D
Excel, capturas y montos del dueño viven en Supabase (base + Storage privado), no en el repo. Los tests usan fixtures con la misma estructura y números inventados.

*Actualización 2026-10-08:* el repo `marianomanto-cmd/portfolio` es **público**, y el dueño decidió dejarlo así ("No importa que esté público"). Por eso la documentación (spec, decisiones, investigaciones, visión) se versiona aunque describa su situación patrimonial a grandes rasgos. Lo de arriba sigue igual: los archivos crudos (Excel, capturas) y los montos de sus posiciones no van al repo, y los tests usan números inventados. Nunca se suben claves ni credenciales.

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
