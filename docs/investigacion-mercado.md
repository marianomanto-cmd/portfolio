# Investigación: lo mejor que existe y qué tomamos

> 7/10/2026. Este informe junta seis relevamientos hechos en paralelo: trackers comerciales, patrimonio y proyecciones, herramientas argentinas, herramientas DIY y open source, hábito y carga, y visualización. Después pasó por una revisión crítica contra `docs/spec.md`, `docs/decisiones.md`, `docs/datos.md`, `docs/carga-diaria.md`, `docs/calidad.md`, la migración inicial y tu skill `cartera-cedears`.
>
> **Límites del relevamiento.**
> - **Sitios que no abrieron.** Reddit, Hacker News, muchas webs de producto y casi todos los dominios argentinos. Por eso casi todo sale de centros de ayuda, changelogs, documentación oficial e issues de GitHub.
> - **Sin verificar.** Bonistas, Rava, Docta y las apps de IEB, Galicia y Mercado Pago. Tampoco se verificó si los trackers extranjeros soportan CEDEARs o LECAPs.
> - **Durante la revisión final.** Se agotó el cupo de búsquedas y no se pudieron volver a abrir Sharesight, Markets Labs, Mi Cede App, Wealthica ni el blog de Navexa 3.0. Lo que dependa de esas fuentes está marcado.
> - **Lo que quedó afuera.** Todo lo que no tenía fuente quedó afuera o dice "no verificado".

---

## 1. Resumen en 10 líneas

1. Arriba de Hoy va una frase que dice desde cuándo mide, cuánto ganaste en pesos, cuánto en dólares y cuánto de eso fue el CCL. Las partes suman exacto.
2. La carga es una bandeja que se vacía con un Enter. Solo mirás lo que no cerró, y cada advertencia se acepta de a una.
3. Cada captura se empieza a leer apenas la pegás. Se lee dos veces de dos maneras distintas y se verifica con aritmética. Lo dudoso queda marcado y nunca se adivina.
4. Cualquier número se toca y muestra su fórmula, sus insumos y el archivo del que salió.
5. Los totales que informa el bróker son puntos de control. El estado de cada fuente se muestra con íconos y formas, nunca con el verde y rojo de ganancias y pérdidas.
6. El leasing aparece como una posición corta en pesos, con la licuación en dólares. Cada LECAP muestra su CCL de empate.
7. Tu tesis entra a la app: peso actual contra objetivo con tus bandas, tramos, invalidaciones y objetivos.
8. Cuando ninguno de tus disparadores se activó, Hoy lo dice primero: "Sin disparadores: nada que hacer".
9. El abanico cuenta probabilidades con 100 puntos y el % exacto, y dice cuánto y cuándo, no solo si.
10. Tu plata se compara con la misma plata puesta en SPY (convertida al CCL de cada día) y con la misma plata quedándose en LECAP. Un día sin cargar no te castiga: lo viejo se ve viejo y la próxima carga lo pone al día.

---

## 2. Qué hacen mejor los mejores

**Tu propia solución: la skill `cartera-cedears`**
- `references/tesis.md` define, por posición:
  - peso objetivo con banda de rebalanceo de ±5 pp;
  - tramos de compra como rangos en US$ del subyacente;
  - invalidación por precio de cierre o por evento (por ejemplo, un acuerdo firmado);
  - objetivos de toma de ganancia;
  - los pilares de cada tesis.
- `references/disciplina.md` define:
  - siete disparadores;
  - "no hay nada que hacer" como la respuesta correcta la mayoría de las semanas;
  - no correr nunca una invalidación hacia abajo;
  - medirse contra la LECAP y no contra cero.
- `references/calendario.md` lista hitos con fecha y qué posición afecta.
- Su desglose es multiplicativo: "(1 + retorno USD) × (1 + ΔCCL) − 1". La D-35 de este informe lo reemplaza (ver 6.1).
- Es el punto de partida más concreto que hay, y el borrador anterior lo ignoraba.

**Trackers de inversión con varias monedas**
- **Sharesight** (no se pudo volver a abrir en la revisión final):
  - Separa el resultado en ganancia de capital, dividendos y ganancia por moneda.
  - Avisa que los *porcentajes* de esos componentes no suman el total por la capitalización. El efecto cambiario sobre la ganancia queda dentro de la ganancia de capital ([componentes](https://help.sharesight.com/components-return/)).
  - Su reporte multi-moneda muestra cada fila en la moneda base y en otra que elijas, con el tipo de cambio aplicado, a cualquier fecha pasada ([reporte multi-moneda](https://help.sharesight.com/multi-currency-valuation-report/)).
  - Su benchmark incluye un componente cambiario ([benchmarking](https://help.sharesight.com/benchmarking/)).
- **Navexa** muestra cinco tarjetas: valor, ganancia de capital sin efecto cambiario, ingresos, ganancia por moneda y total ([cómo calcula](https://help.navexa.com/en/articles/8878847-how-does-navexa-calculate-display-your-portfolio-performance)). Que cada tarjeta abra su propio gráfico sale del blog de Navexa 3.0, que no se pudo volver a abrir.
- **Portfolio Performance** (open source):
  - Arma un estado que va del valor inicial al final.
  - El efecto cambiario de los títulos queda dentro de la ganancia de capital y se informa en la columna "thereof foreign currency gains". El del efectivo va en una línea propia, calculado como saldo × (1/tc₁ − 1/tc₀) ([Calculation](https://raw.githubusercontent.com/portfolio-performance/portfolio-help/master/docs/en/reference/view/reports/performance/calculation.md)).
  - Cada monto lleva un árbol con los insumos de su cálculo ([TrailRecord](https://raw.githubusercontent.com/portfolio-performance/portfolio/master/name.abuchen.portfolio/src/name/abuchen/portfolio/snapshot/trail/TrailRecord.java)).
- **Parqet** explica cada métrica de rendimiento por la pregunta que contesta ([FAQ](https://faq.parqet.com/article/109-renditevergleich)) y manda un resumen diario a las 08:00 y a las 17:00 ([Daily Roundup](https://parqet.com/en/blog/daily-roundup)).
- **Snowball** tiene un calendario de cupones y amortizaciones con lo esperado contra lo cobrado ([overview](https://snowball-analytics.com/overview)), y un "?" con explicación en casi cada elemento ([indicadores](https://help.snowball-analytics.com/review-of-key-portfolio-indicators/)).

**Patrimonio con bienes ilíquidos**
- **Kubera** muestra las filas desactualizadas en itálica gris y programa recordatorios para revaluarlas ([Mark as Stale](https://help.kubera.com/article/46-what-is-mark-as-stale)). Según extractos de búsqueda (las páginas no se abrieron), lee capturas y PDF y recuerda las correcciones de mapeo ([AI Import](https://help.kubera.com/article/142-ai-import-files-and-screenshots), [remapeo](https://help.kubera.com/article/156-ai-import-updating-the-wrong-asset)).
- **Finary** separa patrimonio bruto, neto y financiero ([producto](https://finary.com/en/product-updates/the-best-portfolio-tracker-is-here)). También sirve como caso de cómo se pierde la confianza del usuario (sección 4).
- **Monarch** deja los inmuebles afuera de su pronóstico por defecto ([Forecasting](https://help.monarch.com/hc/en-us/articles/48344305092244-Forecasting-in-Monarch)). Eso valida la separación entre total y financiero de D-03.

**Lectura de documentos con IA**
- **Greenline** es lo más parecido a leer capturas de Galicia o MP: subís la captura de tenencias y nada se guarda hasta que lo revisás ([screenshot import](https://usegreenline.com/features/screenshot-import)).
- **Sharesight** ([AI importer](https://help.sharesight.com/ai-importer/)) y **getquin** ([AI import](https://help.getquin.com/en/articles/12539493-ai-based-document-import)) siguen el mismo esquema: revisar y corregir antes de grabar.

**Planificadores y Monte Carlo**
- **ProjectionLab** compara escenarios dibujando la base punteada ([Compare Mode](https://projectionlab.com/blog/compare-mode-upgrades)) y trata los hitos como objetos ([Milestones](https://projectionlab.com/blog/milestones)). Permite fijar la semilla del sorteo ([rediseño MC](https://cdn.projectionlab.com/blog/monte-carlo-redesign)) y ofrece una vista en "moneda de hoy" ([Today's Currency](https://cdn.projectionlab.com/help/todays-currency)).
- **Actual Budget** (experimental) tiene un abanico de dos bandas, un selector "ver una corrida", una tabla de corridas con el cálculo desplegable y un histograma de cuándo se agota la plata. Avisa que sus sorteos independientes subestiman las rachas de crisis ([doc](https://raw.githubusercontent.com/actualbudget/actual/master/packages/docs/docs/experimental/monte-carlo-analysis.md)).
- **Empower** muestra la mediana y el percentil 10 año por año, y compara escenarios lado a lado ([review](https://www.benzinga.com/money/empower-personal-dashboard-review-retirement-planner-tool-tested)).

**Hábito y revisión de datos**
- **YNAB** crea lo importado como "sin aprobar" y le asigna un id determinístico para que no se duplique ([SDK](https://github.com/ynab/ynab-sdk-js/blob/main/open_api_spec.yaml)).
- **Copilot** tiene una bandeja "To Review" que se maneja con teclas ([Mac](https://help.copilot.money/en/articles/6778561-copilot-for-macos)).
- **Monarch** usa deslizar para marcar como revisado ([Swipe to Review](https://www.monarch.com/review-on-the-go-and-smart-split)).
- **Lunch Money** muestra el tipo de cambio que usó en cada conversión ([pedido implementado](https://feedback.lunchmoney.app/general-feature-request/p/display-currency-exchange-rate-used)).
- **Actual** concilia así: tipeás el saldo del banco y ves la diferencia bajar hasta cero ([reconciliation](https://github.com/actualbudget/docs/blob/master/docs/accounts/reconciliation.md)).
- **Loop** mide la "fuerza del hábito" de manera que un día salteado no la destruye ([uhabits](https://github.com/iSoron/uhabits)).

**Contabilidad en texto plano (DIY)**
- **Beancount** usa aserciones de saldo como puntos de control ([balance](https://github.com/beancount/docs/blob/master/docs/balance_assertions_in_beancount.md)) y deriva la tolerancia de los decimales tipeados ([precisión](https://github.com/beancount/docs/blob/master/docs/precision_tolerances.md)).
- **Fava** junta todos los errores en una sola página y convierte los gráficos a la moneda que elijas ([options](https://github.com/beancount/fava/blob/main/src/fava/help/options.md)). Marca cada cuenta con un punto de frescura ([features](https://github.com/beancount/fava/blob/main/src/fava/help/features.md)):
  - verde: el último asiento es un control que pasó;
  - rojo: falló;
  - amarillo: no es un control;
  - gris: hace mucho que no se actualiza.
- **hledger** chequea las aserciones en cada lectura. Tiene un chequeo opcional, `recentassertions`, que en las cuentas que ya tienen aserciones exige que la última sea reciente ([check](https://github.com/simonmichael/hledger/blob/master/hledger/Hledger/Cli/Commands/Check.md)). También explica cuándo usar TIR y cuándo TWR ([roi](https://github.com/simonmichael/hledger/blob/master/hledger/Hledger/Cli/Commands/Roi.md)).

**Trackers open source**
- **Ghostfolio** ([CHANGELOG](https://github.com/ghostfolio/ghostfolio/blob/main/CHANGELOG.md), [rules](https://github.com/ghostfolio/ghostfolio/tree/main/apps/api/src/models/rules), [features](https://raw.githubusercontent.com/ghostfolio/ghostfolio/main/apps/client/src/app/pages/features/features-page.html)):
  - reglas de concentración con umbrales que define el usuario;
  - un Zen Mode;
  - desde la 2.33.0 (31/12/2023), el benchmark normalizado por moneda;
  - los 3 mejores y los 3 peores calculados con efecto moneda.
- **Wealthfolio** tiene un Health Center con evidencia y acciones para arreglar ([v3.6.0](https://github.com/afadil/wealthfolio/releases/tag/v3.6.0)), y su IA solo genera borradores ([v3.7.0](https://github.com/afadil/wealthfolio/releases/tag/v3.7.0)).

**Argentinos**
- **Comparatasas** publica cada métrica con fórmula, ejemplo resuelto y sello de actualización ([metodología](https://raw.githubusercontent.com/enzonotario/comparatasas.ar/main/app/lib/methodology.ts)). Muestra las LECAP netas de comisión e IVA ([lecaps](https://raw.githubusercontent.com/enzonotario/comparatasas.ar/main/app/pages/lecaps.vue)).
- **ArgentinaDatos** sirve tipos de cambio históricos por fecha y separa los feriados nacionales de los bancarios ([OpenAPI](https://raw.githubusercontent.com/enzonotario/esjs-argentina-datos-api/main/docs/public/openapi.json)).
- **Data912** calcula un CCL implícito por ticker ([OpenAPI](https://raw.githubusercontent.com/enzonotario/data912-docs/main/public/openapi.json)).
- **Google Sheets Argento** (un repo de unas 150 estrellas) muestra una forma de llevar la cartera en planilla, con ratios de CEDEAR mantenidos con historial ([commits](https://github.com/ferminrp/google-sheets-argento/commits/main/data/cedears.json)). Que así trackeen los inversores argentinos en general es una inferencia, no un dato.
- **evaluador-cedears** existe para decir una sola frase: "en pesos ganaste 20%, en dólares 0%" ([repo](https://github.com/santiagomassieri1/evaluador-cedears)).
- **Cocos-to-Spreadsheet** guarda el total en ARS y en USD cada vez que corre ([repo](https://github.com/PabloAlaniz/Cocos-Capital-To-Google-Spreadsheet)).
- **portfolio-broker** concilia el reporte del bróker contra los movimientos y maneja escalas ÷100 y ÷1000 ([repo](https://github.com/facubelini/portfolio-broker)).
- **Mi Cede App** dice en su propia página que completa el CCL por fecha ([web](https://micede.app/)). Es lo que declaran ellos, sin verificar.
- **Markets Labs**: no verificado, porque su sitio no abrió. Según una referencia que no pude comprobar, muestra el CCL implícito en vivo y el CCL de cada compra, y actualiza las posiciones desde una captura del bróker.

**Visualización**
- **ECharts**, ya elegido en D-31, tiene recetas de waterfall, banda de confianza, líneas de nivel, treemap y accesibilidad ([waterfall](https://raw.githubusercontent.com/apache/echarts-examples/gh-pages/public/examples/ts/bar-waterfall2.ts), [banda](https://raw.githubusercontent.com/apache/echarts-examples/gh-pages/public/examples/ts/confidence-band.ts), [aria](https://raw.githubusercontent.com/apache/echarts-doc/master/en/option/component/aria.md)).
- **Evidence** y **Grafana** tienen tarjetas de KPI que saben si bajar es bueno ([BigValue](https://raw.githubusercontent.com/evidence-dev/evidence/main/docs/components/big_value.mdx), [Stat](https://raw.githubusercontent.com/grafana/grafana/main/docs/sources/visualizations/panels-visualizations/visualizations/stat/index.md)).
- **fanplot** documenta el abanico estilo Banco de Inglaterra ([viñeta](https://raw.githubusercontent.com/guyabel/fanplot/master/vignettes/02_boe.Rmd)).
- **Kay y otros** (CHI 2016) proponen los *quantile dotplots*: probabilidades contadas con puntos ([paper](https://raw.githubusercontent.com/mjskay/when-ish-is-my-bus/master/quantile-dotplots.md)).

---

## 3. Ideas a adoptar, priorizadas

**Cómo leer cada idea.**
- **Fase:** la del spec (1 Núcleo, 2 Contexto, 3 Motor, 4 Disciplina). La fase 1 se parte en **1a**, lo mínimo para empezar a juntar historia cuanto antes (D-05), y **1b**, el resto.
- **Esfuerzo:** bajo, medio o alto.
- **Prioridad:** A (entra sí o sí en su fase), B (suma mucho y va después de lo A) o C (opcional).

### 3.1 Carga diaria y hábito

**CA-1 · Bandeja "por revisar" que se vacía con Enter** · Fase 1a · medio · A
- *Qué es:* cada fila leída (Excel de IEB, captura de Galicia, captura de MP) entra con un estado: `verificada`, `advertencia` o `error`.
  - **Arriba:** un contador, por ejemplo "12 leídas · 11 verificadas · 1 a revisar".
  - **Orden:** las filas con problema van primero. Las que no cambiaron desde la última carga se colapsan en una línea ("14 posiciones sin cambios").
  - **El Enter global confirma solo las filas `verificada`**, de todas las cuentas a la vez.
  - **Una advertencia nunca se confirma con ese Enter.** Ejemplos: escala distinta a la recordada, captura que parece vieja, saldo que saltó. Se acepta con su propio botón, o con su tecla cuando la fila tiene el foco, y el motivo queda en el registro (D-11, D-15).
  - **Un error no se puede confirmar** hasta editarlo o dejarlo pendiente.
  - **"Dejar pendiente" sigue D-47:** la fila no se graba y su activo conserva la última cantidad y el último precio. La carga se guarda con `listado_completo = false` y la fila queda en `grabado` como pendiente, así la conciliación de D-15 no lee su ausencia como una venta.
  - **Al final:** cuando no queda nada, la pantalla dice "Todo al día".
- *Dónde se vio:*
  - YNAB crea lo importado como no aprobado ([NewTransaction](https://github.com/ynab/ynab-sdk-js/blob/main/src/models/NewTransaction.ts)).
  - Un cliente no oficial de la API de Monarch muestra un campo `needsReview` ([cliente](https://github.com/hammem/monarchmoney/blob/main/monarchmoney/monarchmoney.py)).
  - Copilot tiene "To Review" con atajos de teclado ([Mac](https://help.copilot.money/en/articles/6778561-copilot-for-macos)).
  - Portfolio Performance etiqueta cada ítem como ERROR, WARNING u OK antes de grabar ([ReviewExtractedItemsPage](https://github.com/portfolio-performance/portfolio/blob/master/name.abuchen.portfolio.ui/src/name/abuchen/portfolio/ui/wizards/datatransfer/ReviewExtractedItemsPage.java)).
- *Por qué acá:* los 60 segundos se van solo en las excepciones. Es la forma concreta del paso "el dueño confirma" de D-11, sin guardados silenciosos.

**CA-2 · Una sola zona para soltar o pegar todo** · Fase 1b · bajo · A
- *Qué es:* Ctrl+V en cualquier parte de `/carga`, o arrastrar varios archivos juntos.
  - Un Excel con hoja `Patrimonio` y fecha en B1 va al parser de IEB.
  - Una imagen va directo a la lectura. El banco (Galicia o MP) lo identifica la misma llamada que extrae (CA-3), sin un paso previo. Si se equivoca, lo corregís con un toque.
  - El orden no importa. El foco sigue en CCL y cripto.
- *Dónde se vio:* según extractos de búsqueda, Kubera acepta un archivo soltado en cualquier parte o pegado del portapapeles ([AI Import](https://help.kubera.com/article/142-ai-import-files-and-screenshots)). Beancount separa "identificar" de "extraer" ([importers](https://github.com/beancount/docs/blob/master/docs/importing_external_data.md)). Portfolio Performance acepta varios PDF a la vez ([pdf-import](https://github.com/portfolio-performance/portfolio-help/blob/master/docs/en/reference/file/import/pdf-import.md)).
- *Por qué acá:* los pasos 2, 3 y 4 de `carga-diaria.md` se vuelven uno solo.

**CA-3 · Cada captura se lee dos veces, rápido, y la aritmética decide** · Fase 1a · medio · A
- *Qué es:*
  - **Arranca al pegar.** La lectura empieza en el momento en que pegás la imagen, mientras tipeás CCL y cripto. Identificar el banco va dentro de la misma llamada de extracción.
  - **Dos lecturas distintas, en paralelo.** La segunda usa otro recorte (por ejemplo, solo la tabla) u otro modelo. Con la misma imagen y el mismo modelo, un error sistemático se repetiría en las dos lecturas, y que coincidan probaría poco. Las lecturas se comparan celda por celda, como texto.
  - **Cuándo una fila es `verificada`:**
    - *Galicia:* las dos lecturas coinciden **y** cierra `cantidad × precio × escala ≈ valorizado`, más el total de la captura si aparece.
    - *Mercado Pago:* es un solo saldo, sin cantidad × precio ni total. Queda verificado si las dos lecturas coinciden y el cambio contra la carga anterior es plausible según CA-4.
    - *Si las lecturas difieren:* ves las dos lado a lado y elegís con un toque.
  - **Nada adivinado.** Un número ilegible queda vacío con el motivo "ilegible", y el foco salta a ese campo.
  - **Imagen intacta.**
    - La captura viaja en PNG, tal como sale del portapapeles, con `oversized_image: "error"` para que nunca se achique en silencio.
    - Los modelos Claude 4.7 en adelante aceptan hasta 2576 px de lado largo y 4784 tokens visuales, así que una captura típica de teléfono entra entera.
    - Partir en tiras es la excepción: se hace solo si la imagen da ese error. Por ejemplo, una de 1290×2796 supera los 2576 px.
  - **Relectura solo si falla.** Se hace una sola, nombrando las celdas a releer y sin pasarle el total esperado, para que no acomode los números al total.
  - **Presupuesto de tiempo.** Encadenar clasificar, leer dos veces, pedir cajas, partir en tiras y releer puede comerse solo los 60 s. Por eso el test end-to-end de `calidad.md` mide p95 ≤ 15 s desde que pegás hasta la bandeja lista.
  - **Fallas visibles.** Un `refusal` o un `max_tokens` cuenta como lectura fallida y se muestra el error.
  - **Sin herramientas.** La llamada de visión no puede escribir nada. El texto que aparezca dentro de una captura es dato, nunca instrucción.
  - **Costo (estimación derivada, no un precio publicado):**
    - Una captura de 1170×2532 son unos 3.822 tokens visuales.
    - Al precio de ejemplo de la documentación para Opus 5 (US$5 por millón de tokens de entrada), la imagen sola cuesta unos 2 centavos por lectura.
    - Con dos lecturas, prompt y salida, la captura queda del orden de 5 a 10 centavos.
    - Con dos capturas por día hábil, son unos US$2 a 5 por mes.
- *Dónde se vio:*
  - Anthropic recomienda correr el mismo prompt varias veces, comparar las salidas y permitir "no sé" ([guía](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)).
  - La documentación de visión da los límites por modelo, la fórmula de tokens y el costo de ejemplo. Advierte que la compresión JPEG fuerte daña la lectura de texto y documenta `oversized_image: "error"` ([vision](https://platform.claude.com/docs/en/build-with-claude/vision), [coordenadas](https://platform.claude.com/docs/en/build-with-claude/vision-coordinates)).
  - La salida estructurada garantiza la forma, no la verdad ([structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)).
  - Unstract ofrece verificación con dos LLM ([repo](https://github.com/Zipstack/unstract)). Instructor documenta el ciclo de validar y volver a preguntar ([reask](https://github.com/567-labs/instructor/blob/main/docs/concepts/reask_validation.md)).
  - Azure recomienda un umbral de confianza cercano al 100% para registros financieros ([confidence](https://github.com/MicrosoftDocs/azure-ai-docs/blob/main/articles/ai-services/document-intelligence/concept/accuracy-confidence.md)).
  - En Wealthfolio, el contenido de un adjunto no puede autorizar un borrador ([v3.7.0](https://github.com/afadil/wealthfolio/releases/tag/v3.7.0)).
  - Kubera admite que su IA se equivoca y ofrece "Rescan" ([help](https://help.kubera.com/article/156-ai-import-updating-the-wrong-asset)).
  - Greenline tuvo importaciones trabadas en "Processing" sin mensaje de error ([changelog](https://usegreenline.com/changelog)).
- *Por qué acá:* Galicia y MP son las únicas fuentes no determinísticas. "La IA lee" pasa a ser "la IA lee dos veces, rápido, y la aritmética decide".

**CA-4 · "¿Entró o salió plata?" cuando un saldo salta** · Fase 1a · bajo · A
- *Qué es:* vale para el saldo de MP y para el efectivo de IEB. FIMA no entra acá, porque es un FCI (D-46): una diferencia de cuotapartes va por la conciliación de D-15.
  - **MP:** el cambio esperado es saldo × TNA ÷ 365 × días, hasta el tope. La TNA sale de la misma captura (DS-5). Si la captura no la muestra, se usa la variación diaria reciente de esa cuenta. La pregunta aparece solo cuando el cambio se sale de eso. Por eso no aparece todos los días, aunque MP acredite intereses a diario.
  - **IEB:** la pregunta aparece si el efectivo sube sin una venta, renta o vencimiento registrados, o baja sin una compra.
  - **La pregunta:** "¿Entró o salió plata hoy? +$500.000 → registrar aporte". Un toque crea el `movimiento_capital` (D-06) ya completado.
- *Dónde se vio:* Wealthfolio mostraba un depósito de 300K como una ganancia de +300K, hasta que empezó a inferir los flujos ([v3.6.3](https://github.com/afadil/wealthfolio/releases/tag/v3.6.3)). Finary no puede separar intereses de aportes en las cuentas de ahorro, así que no les muestra rendimiento ([help](https://help.finary.com/en/articles/7664120-understanding-my-performance-p-l)).
- *Por qué acá:* sin esto, el puente de D-05 y la TNA cobrada se rompen el primer día que transferís plata.

**CA-5 · Captura vieja o repetida** · Fase 1b · bajo · B
- *Qué es:* recargar la misma cuenta el mismo día ya es idempotente (`carga-diaria.md`). El riesgo real es otro: cargar con fecha de hoy una captura de otro día.
  - Si la captura muestra una fecha, se extrae y se compara con la de la carga.
  - Se guarda el SHA-256 de los bytes del archivo y un hash de la lectura normalizada.
  - Si la lectura es idéntica a la de un día anterior, aparece una advertencia: "Esta lectura es igual a la del 03/10 · ¿es una captura vieja?". Avisa, no bloquea.
- *Dónde se vio:* bankstatementparser usa un hash versionado para que reprocesar sea seguro ([repo](https://github.com/sebastienrousseau/bankstatementparser)). Firefly documenta que un hash calculado sobre datos ya mapeados se rompe cuando cambia el mapeo ([doc](https://github.com/firefly-iii/docs/blob/main/docs/docs/references/data-importer/duplicate-detection.md)). Por eso se hashean el original y los valores, nunca el mapeo.

**CA-6 · Alias que la app aprende por bróker** · Fase 1b · bajo · A
- *Qué es:* la primera vez que asignás un texto crudo de Galicia (por ejemplo "S31O5") a un activo, la app ofrece "Recordar para Galicia". Desde la carga siguiente lo mapea sola y muestra "aprendido el 07/10". No hace falta machine learning.
- *Dónde se vio:* Kubera recuerda el remapeo ([help](https://help.kubera.com/article/156-ai-import-updating-the-wrong-asset)). Lunch Money ofrece crear una regla a partir de la corrección que acabás de hacer ([rules](https://github.com/lunch-money/support/blob/master/setup/rules.md)). beancount-import aprende de lo que confirmás ([repo](https://github.com/jbms/beancount-import)).
- *Por qué acá:* el "ticker desconocido" de `carga-diaria.md` pasa a ser un problema de una sola vez.

**CA-7 · Apertura en un paso y CCL de compra declarado** · Fase 1b · bajo · A
- *Qué es:* la primera carga de IEB crea todas las aperturas en una sola confirmación (D-14). Cada posición sin PPC en USD aparece en Salud de datos (CO-8) con un único campo opcional.
  - El PPP del bróker promedia varios lotes, así que no hay un único "CCL de compra". Lo que cargás es un **CCL ponderado declarado por vos**, y se muestra con esa etiqueta.
  - La migración exige `fecha_origen` cuando una apertura tiene CCL. Esa fecha también es declarada (por ejemplo, la del primer lote) y lleva la misma etiqueta.
- *Dónde se vio:* portfolio-broker "carga con un clic las posiciones y el saldo iniciales" ([repo](https://github.com/facubelini/portfolio-broker)). En Ghostfolio:
  - un usuario argentino pidió en 2024 subir su propio historial de tipo de cambio, porque la app usa el oficial ([#3273](https://github.com/ghostfolio/ghostfolio/issues/3273));
  - otros piden registrar el tipo de cambio realmente ejecutado ([#3141](https://github.com/ghostfolio/ghostfolio/discussions/3141)).
- *Por qué acá:* sin esto, el resultado en USD desde la compra, que es el número más argentino de la app, queda "sin dato" para siempre.

**CA-8 · Teclado primero** · Fase 1a · bajo · A
- *Qué es:* el recorrido es foco en CCL → Tab a cripto → Ctrl+V → Enter.
  - Los campos aceptan formato es-AR y muestran el valor interpretado al lado antes de guardar ("= 1.187,37"). Se usa el `NumericFormat` de D-31.
  - No se aceptan cuentas dentro del campo. Si algún día se quieren, hace falta un input propio en lugar de `NumericFormat`.
  - En la bandeja, ↑/↓ mueven entre filas y E edita. Los atajos de una letra (E, h) funcionan **solo cuando ningún campo tiene el foco**, para que no se disparen mientras tipeás.
  - La paleta Ctrl+K, para saltar a un activo, una sección o una carga, es aparte y tiene prioridad C.
- *Dónde se vio:* en Actual se navega con Enter y Tab, hay acciones de una letra, paleta de comandos y montos con fórmulas ([tips](https://github.com/actualbudget/docs/blob/master/docs/getting-started/tips-tricks.md)). Copilot usa R, X y las flechas ([Mac](https://help.copilot.money/en/articles/6778561-copilot-for-macos)). En contabilidad de texto plano, la coma decimal genera errores confusos ([guía](https://github.com/plaintextaccounting/plaintextaccounting/blob/master/src/Dont-Sink-Your-First-Attempts-at-Plaintext-Accounting.md)); de ahí el eco del valor interpretado.
- *Por qué acá:* el spec pide que Tab y Enter alcancen.

**CA-9 · Deshacer en vez de "¿estás seguro?"** · Fase 1b · bajo · A
- *Qué es:* después de Enter aparece un aviso "Carga guardada · Deshacer". Deshacer es **el botón del aviso**, no Ctrl+Z, porque dentro de un campo Ctrl+Z es el deshacer nativo.
  - Un Enter confirma varias cargas a la vez (una por cuenta), así que un Deshacer revierte **todo el lote** en una sola transacción. Para eso, `cargas.lote` se guarda desde la fase 1a.
  - Usa `revertir_carga` (D-17). El flujo diario no tiene modales de confirmación.
- *Dónde se vio:* en Actual cualquier cambio se puede deshacer, pero en la versión web el historial se pierde al refrescar ([tips](https://github.com/actualbudget/docs/blob/master/docs/getting-started/tips-tricks.md)). Acá se hace del lado del servidor para que no pase eso.
- *Por qué acá:* la confirmación ya ocurrió en la bandeja. Un segundo "¿seguro?" solo entrena a apretar sin mirar.

**CA-10 · Operación faltante con precio inferido y tramo sugerido** · Fase 1b · bajo · B
- *Qué es:* una compra pendiente de D-19 ya cuenta su cantidad, así que nunca explica una diferencia de cantidad. Cuando D-15 encuentra una (por ejemplo, un día salteado), la operación que se ofrece crear viene completa:
  - la cantidad es la diferencia;
  - el precio sale del cambio de PPP con la fórmula de D-19, con la etiqueta "inferido del PPP, sin comisiones";
  - si un tramo pendiente de tu tesis (DS-11) contiene el precio implícito, sugiere "¿es el tramo 2?" para vincularlo en `nivel_operaciones`.
  Nunca se aplica sola.
- *Dónde se vio:* YNAB empareja con la misma cuenta, el mismo monto y ±10 días ([spec](https://github.com/ynab/ynab-sdk-js/blob/main/open_api_spec.yaml)). Actual empareja con transacciones programadas a ±7,5% del monto y ±2 días ([schedules](https://github.com/actualbudget/docs/blob/master/docs/schedules.md)).

**CA-11 · Escala ×1, ÷100 o ÷1000, recordada por activo** · Fase 1b · bajo · B
- *Qué es:* D-12 pasa a probar también ÷1000, para los FCI cotizados cada 1000 cuotapartes, como FIMA si la fuente lo muestra así. El divisor elegido queda guardado por cuenta y activo. Si cambia, es una advertencia.
- *Dónde se vio:* portfolio-broker documenta bonos por 100 nominales y FCI por 1000 cuotapartes, con el divisor editable ([repo](https://github.com/facubelini/portfolio-broker)).

**CA-12 · Constancia que perdona, en días hábiles** · Fase 2 · bajo · C
- *Qué es:* si se muestra algún indicador de hábito, que sea "18 de 22 días hábiles". Baja de a poco y nunca vuelve a cero por un día perdido.
  - "Sin carga" va en tinta neutra, porque el rojo está reservado para pérdidas.
  - Opcional: un recordatorio diario después del cierre que abra `/carga` con el foco en el CCL (esfuerzo medio, necesita push o mail).
- *Dónde se vio:* en Loop, los días perdidos debilitan el hábito pero no borran el progreso ([uhabits](https://github.com/iSoron/uhabits)). Sus usuarios piden un modo vacaciones ([#601](https://github.com/iSoron/uhabits/issues/601)). Un desarrollador cuenta que abandonó todas las apps de finanzas en dos semanas y que las alertas rojas le daban ansiedad ([post](https://github.com/cclee-hub/docs-site/blob/main/i18n/en/docusaurus-plugin-content-docs/current/life/product.md)).

**CA-13 · "Pegar serie": una sola herramienta periódica para las series que cargás vos** · Fase 1b (CCL histórico) y la fase de cada serie · bajo · A
- *Qué es:* una caja que acepta líneas `fecha;valor`. **Nunca forma parte de los 60 segundos diarios.** Sirve para:
  - CCL histórico;
  - SPY con cierre ajustado (DS-2);
  - la tasa de referencia en pesos (DS-12);
  - CER y TAMAR;
  - el valor al vencimiento de las LECAP (`flujos_bono`), que EX-5 y el alta de un ticker desconocido necesitan;
  - opcionalmente, cierres de los subyacentes (DS-3).

  Las reglas (D-48):
  - Cada pegado es una carga `manual` con su **fuente** ("Ámbito, cierre", "cierre ajustado de tal sitio"). El texto pegado queda en `lectura_cruda`.
  - **Fechas que ya existen:** nunca se pisan en silencio. `tipo_cambio` tiene una sola fila y un solo `carga_id` por fecha para los cuatro tipos, así que pegar un CCL sobre una fecha que ya tiene cripto mezclaría orígenes. Por eso la serie solo completa fechas sin fila. Una fecha existente se corrige editando esa fila, y la edición queda en la auditoría.
  - Un cierre ajustado se reescala hacia atrás con cada dividendo nuevo, así que esa serie se pega siempre **entera** y reemplaza a la anterior, sin mezclarse con ella.
- *Dónde se vio:* consultar el dólar por fecha fue un pedido de los usuarios de Sheets Argento ([DOLARHISTORICO](https://raw.githubusercontent.com/ferminrp/google-sheets-argento/main/doc/DOLAR_HISTORICO.md)). El pedido de Ghostfolio de subir tu propio historial de tipo de cambio ([#3273](https://github.com/ghostfolio/ghostfolio/issues/3273), 2024).

**CA-14 · Importación periódica de movimientos de IEB** · Fase 2 · medio · B
- *Qué es:* opcional, una vez por mes y fuera de los 60 s. Soltás el export de movimientos, las boletas o el resumen mensual de IEB.
  - Cada línea se empareja con las operaciones existentes por fecha, especie y cantidad. Así se completan las compras con precio pendiente o inferido (D-19) con su fecha real, el importe liquidado, la comisión, el IVA y los derechos de mercado, y se muestra la diferencia.
  - El importe liquidado es el hecho. Absorbe la ex CO-6: el efectivo nunca se recalcula como cantidad × precio si existe el importe.
  - El total del resumen mensual entra como control `resumen_mensual` (CO-3, D-38).
  - **No verificado:** todavía no vi un export de movimientos de IEB, así que el formato hay que relevarlo con un archivo real.
- *Dónde se vio:* Sharesight guarda la boleta junto a cada operación ([blog](https://www.sharesight.com/blog/portfolio-setup-tip-3-automatic-contract-note-processing/)). Portfolio Performance importa PDF del bróker ([pdf-import](https://github.com/portfolio-performance/portfolio-help/blob/master/docs/en/reference/file/import/pdf-import.md)). portfolio-broker concilia el reporte contra los movimientos ([repo](https://github.com/facubelini/portfolio-broker)). En Wealthfolio, calcular cantidad redondeada × precio desfasó el efectivo respecto del bróker ([#889](https://github.com/afadil/wealthfolio/issues/889)); lo corrigieron usando el monto final de cada transacción ([v3.8.0](https://github.com/afadil/wealthfolio/releases/tag/v3.8.0)).
- *Por qué acá:* la carga diaria solo trae PPP, y D-19 infiere el precio perdiendo las comisiones. Sin este paso, DS-1, DS-7 y la vista de costos (EX-10) trabajan con precios inferidos.

### 3.2 Confianza y trazabilidad

**CO-1 · Traza en árbol que se abre con un toque** · Fase 1a · medio · A
- *Qué es:* cada función pura (D-22) devuelve nodos con tipo: operación, posición, conversión (con el tipo de cambio usado), fracción, suma, resta, precio del bróker, TC del día.
  - El popover muestra primero la fórmula con los valores reales: "Valor USD = 120 × $11.000 ÷ CCL 1.120 = US$ 1.178,57".
  - "Ver insumos" despliega de a un nivel. Cada hoja termina en una carga y su archivo (D-17).
  - Se abre con un toque y entra en 360 px.
- *Dónde se vio:* Portfolio Performance adjunta a cada monto un árbol de insumos y lo muestra en un popup ([TrailRecord](https://raw.githubusercontent.com/portfolio-performance/portfolio/master/name.abuchen.portfolio/src/name/abuchen/portfolio/snapshot/trail/TrailRecord.java), [manual](https://raw.githubusercontent.com/portfolio-performance/portfolio-help/master/docs/en/reference/view/reports/performance/calculation.md)). Sharesight guarda el PDF de la boleta junto a cada operación ([blog](https://www.sharesight.com/blog/portfolio-setup-tip-3-automatic-contract-note-processing/)).
- *Por qué acá:* es el requisito no negociable del spec, con una estructura que ya se probó en producción.

**CO-2 · El recorte de la captura al lado del número** · Fase 2 · medio · B
- *Qué es:* se le pide al modelo la caja de cada fila en píxeles y se guarda en la lectura cruda.
  - En desktop, al pasar por una fila se resalta su recuadro sobre la miniatura. En mobile, al tocar la tarjeta se ve el recorte.
  - Las cajas son aproximadas: sirven para señalar, no como prueba. Si la imagen se partió en tiras, sus coordenadas hay que llevarlas a la imagen original.
  - Suman tokens de salida y tiempo, y la imagen guardada ya cumple D-17. Por eso va después, reprocesando los archivos guardados (CO-13).
- *Dónde se vio:* Fava muestra la línea de origen al lado de cada asiento a importar ([import](https://github.com/beancount/fava/blob/main/src/fava/help/import.md)). Unstract revisa con el documento resaltado ([repo](https://github.com/Zipstack/unstract)). Las citas de Claude no funcionan con imágenes, y sus coordenadas son aproximadas ([citations](https://platform.claude.com/docs/en/build-with-claude/citations), [coordenadas](https://platform.claude.com/docs/en/build-with-claude/vision-coordinates)).

**CO-3 · Conciliación por cuenta con aserciones que se vuelven a chequear** · Fase 1a · medio · A
- *Qué es:*
  - **Qué se guarda como control.** Cada total que informa el bróker y que **no** es el hecho mismo queda como un control con su carga:
    - B2 de IEB;
    - el Subtotal de cada sección de IEB;
    - el total de la captura de Galicia, si aparece;
    - el resumen mensual (CA-14).
  - **Qué no.** El "Total" de la hoja Saldos y el saldo de MP *son* el hecho (D-13). Compararlos contra sí mismos es circular. El de Saldos sirve solo para re-chequear después de una edición, y MP no tiene control aritmético (ver CA-3).
  - **Cuándo se chequea.** Una función pura lo recalcula desde operaciones, cotizaciones y saldos, y compara. Lo hace al cargar y cada vez que cambia un hecho viejo.
  - **Qué ves.** La vista "Conciliación" muestra, por cuenta, "App $X · IEB $Y · diferencia $Z", con el motivo: precio viejo, DOLARUSA al dólar del bróker o redondeo.
  - **Sin total.** Si la captura no trae un total, el estado es "no verificable", nunca "OK".
  - **Filas conciliadas.** Muestran un candado. Editarlas pide un motivo y vuelve a correr las aserciones.
- *Dónde se vio:*
  - En Beancount, una aserción que falla es un error ([balance](https://github.com/beancount/docs/blob/master/docs/balance_assertions_in_beancount.md)).
  - hledger chequea las aserciones en cada lectura ([check](https://github.com/simonmichael/hledger/blob/master/hledger/Hledger/Cli/Commands/Check.md)).
  - Actual muestra la diferencia hasta llegar a cero y bloquea lo conciliado ([reconciliation](https://github.com/actualbudget/docs/blob/master/docs/accounts/reconciliation.md)).
  - bankstatementparser etiqueta cada resultado como VERIFIED, DISCREPANCY, UNVERIFIABLE o FAILED ([repo](https://github.com/sebastienrousseau/bankstatementparser)).
  - Parqet y Navexa necesitaron artículos de ayuda sobre "por qué no coincide con mi bróker" ([Parqet](https://faq.parqet.com/article/75-die-performance-bei-parqet-weicht-von-meinem-broker-ab), [Navexa](https://help.navexa.com/en/articles/8878847-how-does-navexa-calculate-display-your-portfolio-performance)).
- *Por qué acá:* `calidad.md` exige que la app cuadre con IEB al centavo. Esto hace ese cuadre visible y permanente.

**CO-4 · La tolerancia sale de la precisión mostrada** · Fase 1a · bajo · A
- *Qué es:* en `cantidad × precio × escala ≈ valorizado`, el error permitido es medio último dígito del precio × cantidad × escala, más medio último dígito del valorizado. La traza lo muestra: "tolerancia ±$0,62 por 2 decimales en el precio".
  - **Galicia y MP:** los decimales salen del texto de la captura.
  - **IEB:** el Excel trae números nativos (floats), no texto, así que los decimales no se conservan solos.
    - La precisión sale del formato de la celda (`numFmt` en exceljs), y el valor pasa a Decimal desde el texto formateado, nunca desde el float.
    - Si la celda está en formato General, se usa la regla documentada (`Posición = Cantidad × Precio / 100` en bonos) y el redondeo a centavos del valorizado.
- *Dónde se vio:* Beancount usa como tolerancia la mitad del último dígito tipeado ([precision](https://github.com/beancount/docs/blob/master/docs/precision_tolerances.md)). exceljs expone el formato numérico de cada celda ([numFmt](https://github.com/exceljs/exceljs/blob/master/README.md#number-formats)).
- *Por qué acá:* el PPC de Galicia viene con 2 decimales e IEB cotiza cada 100 VN. Una tolerancia fija da falsas alarmas o deja pasar errores.

**CO-5 · Precio vigente con su procedencia y arrastre explícito** · Fase 1a · bajo · A
- *Qué es:* una función `precioVigente(activo, fecha)` devuelve `{valor, fecha_real, arrastrado, carga, archivo}`.
  - Un precio arrastrado con más de 2 días hábiles BYMA (D-16, D-45) se muestra apagado, con un chip "hace 3 d háb.".
  - Un precio arrastrado nunca genera variación del día en pesos.
  - Un CEDEAR con precio arrastrado y CCL nuevo cambia de valor en USD sin que el activo se haya movido. Esa parte del efecto "activo" se rotula "por precio viejo".
  - En los gráficos, el tramo con precio viejo va punteado y el "sin dato" queda como hueco (`connectNulls: false`).
  - Un total con partes viejas lo dice: "incluye 2 precios viejos".
- *Dónde se vio:*
  - hledger usa el último precio en o antes de la fecha ([manual](https://github.com/simonmichael/hledger/blob/master/hledger/hledger.m4.md)).
  - Ghostfolio marca los precios arrastrados con `isCarriedForward` ([CHANGELOG](https://github.com/ghostfolio/ghostfolio/blob/main/CHANGELOG.md)).
  - Wealthfolio emite filas "unpriced" en vez de romper el gráfico ([v3.6.3](https://github.com/afadil/wealthfolio/releases/tag/v3.6.3)).
  - Copilot dibuja lo estimado con línea punteada ([investments](https://help.copilot.money/en/articles/5377645-investments-tab)).
  - Kubera usa itálica gris para lo viejo ([stale](https://help.kubera.com/article/46-what-is-mark-as-stale)).
  - Un cliente no oficial de Kubera corta la línea en vez de inventar una pendiente ([kubera-mobile](https://github.com/auchenberg/kubera-mobile)).

**CO-6 · El monto del bróker es el hecho** · fusionada en CA-14
- Lo esencial ya está decidido: `datos.md` usa `importe` cuando existe y D-13 toma el efectivo como saldo. Ninguna entrada diaria trae un importe, así que la idea vive en la importación periódica.

**CO-7 · Cada conversión dice qué tipo de cambio usó** · Fase 1a · bajo · A
- *Qué es:* toda cifra en USD lleva en la traza algo como "÷ CCL 1.234,50 (06/10/2026, carga #217, tipeado)".
  - Distingue CCL, cripto_venta, el dólar del bróker (DOLARUSA) y el `tc_aplicado` de cada movimiento de capital.
  - Además, dos tests: uno falla si un punto histórico se convierte con el CCL de hoy, y otro falla si se suman ARS y USD sin convertir.
- *Dónde se vio:* Lunch Money empezó a mostrar el tipo de cambio usado por pedido de los usuarios ([feedback](https://feedback.lunchmoney.app/general-feature-request/p/display-currency-exchange-rate-used)). Sus dos bugs más visibles fueron justamente esos: convertir la historia al tipo de cambio actual ([bug](https://feedback.lunchmoney.app/bugs/p/historical-balances-in-secondary-currencies-miscalculated-using-current-rate)) y sumar monedas sin convertir ([bug](https://feedback.lunchmoney.app/mobile-app/p/mobile-app-estd-net-worth-calculation-disregards-currency)). Portfolio Performance usa los tipos de referencia del BCE, que pueden no coincidir con el de tu bróker ([doc](https://github.com/portfolio-performance/portfolio-help/blob/master/docs/en/concepts/historical-prices.md)).

**CO-8 · Salud de datos: una lista, con evidencia y un botón** · Fase 1b · medio · A
- *Qué es:* una página con todo lo pendiente:
  - aserciones que fallan;
  - filas diferidas (D-47);
  - PPC "sin dato";
  - precios viejos;
  - tickers desconocidos;
  - vencimientos a menos de 15 días sin destino;
  - saltos de saldo sin explicar.

  Cada ítem tiene:
  - un identificador estable y una gravedad;
  - la fórmula y los insumos como evidencia;
  - una acción: "crear operación faltante", "cargar CCL de compra" o "abrir carga".

  Un ítem se puede "dar por visto" con un motivo, que queda en la auditoría. La navegación muestra un contador de pendientes.
- *Dónde se vio:* Fava junta todos los errores en una tabla con link a la línea ([Errors](https://github.com/beancount/fava/blob/main/frontend/src/reports/errors/Errors.svelte)). Wealthfolio tiene un Health Center con evidencia y acciones ([v3.6.0](https://github.com/afadil/wealthfolio/releases/tag/v3.6.0)). Un usuario de Wealthfolio no podía sacarse de encima una alerta de precio viejo ([#740](https://github.com/afadil/wealthfolio/issues/740)).

**CO-9 · Cuadre visible, definido por vista** · Fase 1b · bajo · B
- *Qué es:* al pie de Evolución, y a un toque desde Hoy, aparece "Cuadre ✓" cuando, en cada moneda, se cumple:

  > variación del patrimonio − aportes netos = suma de las demás líneas de su puente (HO-2), con residuo 0,00

  - El puente del financiero y el del total son distintos. Si se usara uno solo, quedaría un residuo permanente.
  - Si el residuo no es cero, se muestra "≠ residuo $X" con el ícono de estado (no en rojo) y lleva a la parte que falla.
  - Es la misma identidad que `calidad.md` prueba con fast-check, ahora a la vista.
- *Dónde se vio:* un usuario de Ghostfolio chequea esa identidad en cada render y así encontró un bug de tipo de cambio ([#7858](https://github.com/ghostfolio/ghostfolio/discussions/7858)). El post-mortem de Maybe lo resume: "si un dato está mal, todas las vistas están mal" ([v0.6.0](https://github.com/maybe-finance/maybe/releases/tag/v0.6.0)).

**CO-10 · Estado "en tránsito"** · Fase 1b · bajo · B
- *Qué es:* las sub-filas `Liquidar` de IEB y las compras del día con PPP `-` se muestran como "en tránsito", con el monto. Así se entiende por qué "Hoy" y "Total" de IEB difieren (D-13).
- *Dónde se vio:* Beancount documenta que la diferencia entre fecha de operación y de liquidación rompe las aserciones ingenuas ([settlement](https://github.com/beancount/docs/blob/master/docs/settlement_dates_in_beancount.md)).

**CO-11 · La valuación de la casa tiene vencimiento** · Fase 1b · bajo · B
- *Qué es:* cada bien tiene una cadencia de revaluación que elegís vos.
  - Cuando se cumple, el valor se mantiene (D-04: nunca se estima), pero se ve en gris como "valuación de hace 14 meses" y entra en Atención.
  - Una tasación nueva muestra "Δ vs. última valuación" y va a la línea "Revaluación de bienes" del puente total, no al resultado de las inversiones.
- *Dónde se vio:* Kubera programa recordatorios de revaluación ([stale](https://help.kubera.com/article/46-what-is-mark-as-stale)). Parqet recomienda revaluar al menos una vez por año ([real estate](https://parqet.com/en/blog/track-real-estate)). Wealthfolio separa las ganancias de cartera de otros cambios de activos ([releases](https://github.com/afadil/wealthfolio/releases)).

**CO-12 · Cartera "al día X"** · Fase 2 · bajo · B
- *Qué es:* un selector de fecha en Cartera que re-deriva las posiciones desde las operaciones, con columnas "CCL aplicado" y "fecha del precio". Es barato porque las posiciones no se guardan.
- *Dónde se vio:* el reporte multi-moneda de Sharesight valúa en cualquier fecha pasada y muestra el tipo de cambio aplicado ([help](https://help.sharesight.com/multi-currency-valuation-report/)).

**CO-13 · Reprocesar con el parser actual, con diff previo** · Fase 1b (pruebas) / Fase 2 (pantalla) · medio · B
- *Qué es:*
  - **`parser_version` en cada carga, desde la fase 1a.** Es lo único que no se puede reconstruir después.
  - **"Reprocesar" en Registro.** Muestra un diff antes de reemplazar la carga como unidad. Con esto se recuperan más tarde datos que no hacen falta el primer día: TNA y tope, totales del bróker, cajas de CO-2.
  - **Pruebas de visión.** Usan **capturas sintéticas**: el layout de Galicia y de MP re-renderizado con números inventados, nunca capturas reales anonimizadas (D-24).
  - **Dónde corren.** Llamar al modelo necesita una API key y no es determinístico, así que corren en un job nocturno o manual, **fuera del gate de merge** (`calidad.md` §5). Si fallan, cambió el prompt o el layout del banco. El CI de cada PR prueba solo el parser determinístico de IEB.
- *Dónde se vio:* hledger-flow guarda los originales para regenerar todo ([repo](https://github.com/apauley/hledger-flow)). hledger tiene `--dry-run` al importar ([import](https://github.com/simonmichael/hledger/blob/master/hledger/Hledger/Cli/Commands/Import.md)). Portfolio Performance mantiene un extractor por bróker con fixtures ([CONTRIBUTING](https://github.com/portfolio-performance/portfolio/blob/master/CONTRIBUTING.md)).

**CO-14 · Metodología que se escribe sola** · Fase 2 · medio · B
- *Qué es:* una página generada desde los metadatos de las funciones puras:
  - la fórmula y las unidades;
  - la convención de días (365 o 360, corridos o hábiles);
  - un ejemplo resuelto con los números de tu última carga.
- *Dónde se vio:* Comparatasas tiene una sección por métrica con fuente, fórmula y ejemplo ([methodology](https://raw.githubusercontent.com/enzonotario/comparatasas.ar/main/app/lib/methodology.ts)). Aun así recibe issues de "por qué difiere de la app" ([#321](https://github.com/enzonotario/comparatasas.ar/issues/321)).

**CO-15 · Exportar todo en texto abierto** · Fase 2 · bajo · B
- *Qué es:* concreta lo que pide `calidad.md` §6:
  - un CSV por cada tabla de hechos;
  - un diario en formato hledger o Beancount, con las cotizaciones como precios y los controles como aserciones;
  - un recordatorio mensual.
- *Dónde se vio:* el manifiesto de Paisa dice que el usuario es dueño de sus datos y que la app no debería desaparecer ([manifesto](https://github.com/ananthakumaran/paisa/blob/master/docs/manifesto.md)). Maybe quedó archivada ([v0.6.0](https://github.com/maybe-finance/maybe/releases/tag/v0.6.0)).

### 3.3 Entender el día (Hoy)

**Jerarquía de Hoy (D-53).**
- **A primera vista:**
  - la frase del día (HO-1);
  - las dos tarjetas de patrimonio, total y financiero, cada una en ARS y USD (HO-5);
  - una línea compacta con los dos ítems del spec que faltan, exposición neta al peso y excedente del mes;
  - "Atención" (HO-6), que cuando no hay nada dice "Sin disparadores: nada que hacer" (HO-8).
- **Un indicador único de datos** ("datos al día" o "1 fuente a revisar") abre los cinco estados de HO-4.
- **A un toque:** puente, período, cuadre, minigráficos, deuda y "quién movió".
- **En el menú:** modo calma y modo privado.

**HO-1 · La frase del día en dos monedas** · Fase 1a · bajo · A
- *Qué es:* arriba de todo, una frase armada a partir del desglose de D-35, sin IA. Siempre nombra su intervalo.

  Ejemplo con números inventados: CEDEARs por US$ 10.000, pesos por $6.000.000, CCL de 1.500 a 1.530, subyacentes −1% y pesos +0,1%.
  > "Desde la carga del mar 06/10: **+$153.000** en pesos (+0,7%), pero **−US$ 175** en dólares (−1,2%). En pesos, el CCL sumó $300.000 y tus activos restaron $147.000. En dólares, tus activos restaron US$ 96 y la suba del CCL le sacó US$ 79 a tus pesos."

  - Cada fragmento abre su traza.
  - La misma frase sirve para cualquier período en Evolución. Ese período es la suma de sus intervalos (D-35), así que la frase de un mes cuadra con la suma de sus días.
  - En las tarjetas de posición no va un chip con la frase: ahí alcanza con el badge de MO-1.
- *Dónde se vio:* evaluador-cedears existe para decir esa frase ([repo](https://github.com/santiagomassieri1/evaluador-cedears)). Cocos-to-Spreadsheet guarda el total en ARS y USD cada vez que corre ([repo](https://github.com/PabloAlaniz/Cocos-Capital-To-Google-Spreadsheet)). El Cronista explica que la suba de un CEDEAR que viene solo del CCL no es ganancia ([nota](https://www.cronista.com/finanzas-mercados/el-costo-invisible-de-confundir-la-suba-del-dolar-con-ganancia-real-al-invertir-en-cedears/)). Parqet resume el día contra el anterior ([Roundup](https://parqet.com/en/blog/daily-roundup)).
- *Por qué acá:* es la frase del spec ("si subo 10% en pesos pero el CCL subió 12%…") convertida en lo primero que ves.

**HO-2 · El puente, uno por vista** · Fase 1b · medio · A
- *Qué es:* D-05 presentado como un estado con signos, en pestañas ARS y USD, con un puente distinto para cada vista.
  - **Financiero:** inicial → aportes y retiros → resultado por activos → resultado por TC (con "de lo cual: efectivo USD") → cuotas pagadas desde tus cuentas → final.
  - **Total:** inicial → aportes y retiros → activos → TC → cuotas pagadas → **amortización de capital** → revaluación de bienes → **licuación de la deuda (solo en la pestaña USD)** → final.
    - La amortización es lo que la cuota bajó la deuda; con ella sube tu parte del auto.
    - Neto de las dos líneas de la cuota queda su costo: interés, IVA no recuperado, seguro y otros.
    - Si la cuota la paga la empresa (`cuenta_pago_id` null), la baja de la deuda entra como aporte, no como resultado.
    - La amortización sale del capital pendiente informado (`pasivo_saldos`), con esa etiqueta.
  - **Evolución:** debajo del patrimonio, una línea de **capital aportado acumulado** (aportes − retiros), en ARS y en USD al `tc_aplicado` de cada movimiento. La misma línea sigue en el abanico (PR-1).
  - **Gráfico:** un waterfall **solo de deltas**, con el inicial y el final escritos como números. Un puente diario (Δ ≈ 0,7%) sobre un eje que arranca en cero se vería plano. Con deltas que cruzan el cero hace falta `stackStrategy: 'all'` o barras flotantes calculadas, y el tooltip ignora la serie de base.
  - **Detalle:** tocar una barra muestra los 3 que más sumaron y los 2 que más restaron.
- *Dónde se vio:* el estado de Portfolio Performance va del valor inicial al final, y su widget reducido muestra las 3 primeras filas, "otros" y las 2 últimas ([Calculation](https://raw.githubusercontent.com/portfolio-performance/portfolio-help/master/docs/en/reference/view/reports/performance/calculation.md), [widget](https://raw.githubusercontent.com/portfolio-performance/portfolio/master/name.abuchen.portfolio.ui/src/name/abuchen/portfolio/ui/views/dashboard/PerformanceCalculationWidget.java)). Evidence tiene un waterfall que une dos totales ([doc](https://raw.githubusercontent.com/evidence-dev/evidence/main/docs/components/waterfall_chart.mdx)). ECharts documenta el apilado por signo ([stack](https://raw.githubusercontent.com/apache/echarts-doc/master/en/option/partial/stack.md)). En Fava piden desde 2020 ver el patrimonio partido en aportes, ingresos y apreciación ([#1082](https://github.com/beancount/fava/issues/1082)). La línea de capital aportado se parece al P/L Timeline de Wealthica, que no se pudo verificar.

**HO-3 · La variación se toca y muestra quién la movió** · Fase 1b · bajo · A
- *Qué es:* tocar la variación abre un ranking de activos con su aporte en USD y en ARS, partido en activo y TC.
  - Un precio arrastrado aparece como "sin cambio (precio de hace 3 d háb.)", no como un cero.
  - En un feriado de EE.UU., los CEDEAR llevan la etiqueta "mayormente brecha de CCL implícito: el subyacente no cotizó".
- *Dónde se vio:* en Kubera, el número de cambio diario muestra qué activo se movió más ([how it works](https://www.kubera.com/how-kubera-works)). Portfolio Performance tiene un widget de "Top Contributors" ([dashboard](https://raw.githubusercontent.com/portfolio-performance/portfolio-help/master/docs/en/reference/view/reports/performance/dashboard.md)). Ghostfolio muestra los 3 mejores y los 3 peores con efecto moneda ([CHANGELOG](https://github.com/ghostfolio/ghostfolio/blob/main/CHANGELOG.md)).

**HO-4 · Estado por fuente, con su propio vocabulario** · Fase 1a · bajo · A
- *Qué es:* un estado por fuente (IEB, Galicia, MP, CCL, cripto), resumido en Hoy en un indicador único y completo en Carga.
  - **✓ cerró su control.** Para MP: dos lecturas iguales y un cambio plausible.
  - **≠ diferencia sin resolver.**
  - **○ tipeado a mano, sin control posible** (CCL y cripto).
  - **⏱ más de 2 días hábiles sin carga.**

  Se usan íconos y formas con tonos que no sean de resultado (tinta neutra, azul o gris), nunca verde y rojo, que quedan reservados para ganancias y pérdidas. Tocar un estado abre la carga y su archivo.
- *Dónde se vio:* Fava usa esos cuatro estados por cuenta, con colores ([features](https://github.com/beancount/fava/blob/main/src/fava/help/features.md), [options](https://github.com/beancount/fava/blob/main/src/fava/help/options.md)). Un usuario que venía de YNAB se quejó en Actual de no saber qué cuentas necesitaban atención ([#8399](https://github.com/actualbudget/actual/issues/8399)).

**HO-5 · Tarjetas de patrimonio que saben qué dirección es buena** · Fase 1a (las dos de patrimonio) / 1b (el resto) · bajo · A
- *Qué es:*
  - **Primer nivel (D-03):**
    - **Patrimonio total**, en ARS y en USD. Abajo: "incluye casa (valuación del dd/mm) y tu parte del auto, sujeta a opción de compra".
    - **Patrimonio financiero**, en ARS y en USD.
    - Cada tarjeta lleva su variación partida en activo y TC.
  - **A un toque:**
    - la deuda del leasing en USD (bajar es bueno);
    - la exposición neta al peso (sin dirección: tinta neutra, solo el signo);
    - el excedente del mes;
    - los minigráficos de la misma ventana.
  - **Banda neutra:** la fijás vos y evita que los días planos parpadeen entre verde y rojo.
- *Dónde se vio:* Grafana tiene un modo "Inverted" ([stat](https://raw.githubusercontent.com/grafana/grafana/main/docs/sources/visualizations/panels-visualizations/visualizations/stat/index.md)). Evidence tiene `down_is_good` y `neutral_range` ([BigValue](https://raw.githubusercontent.com/evidence-dev/evidence/main/docs/components/big_value.mdx)). Maybe usa `favorable_direction` ([trend.rb](https://raw.githubusercontent.com/maybe-finance/maybe/main/app/models/trend.rb)). Ghostfolio tuvo que corregir el color de las variaciones que redondean a cero ([CHANGELOG](https://github.com/ghostfolio/ghostfolio/blob/main/CHANGELOG.md)).

**HO-6 · "Atención"** · Fase 1b (salud de datos, valuaciones, desvío de peso) / Fase 2 (vencimientos y calendario) / Fase 4 (niveles) · bajo · A
- *Qué es:* los 3 primeros ítems de Salud de datos, más los disparadores que ya se puedan evaluar en cada fase, con un link a la lista completa. Los niveles perforados entran recién con la fase 4, salvo que decidas adelantarlos (ver 3.8).
- *Dónde se vio:* Empower manda un resumen semanal con las cuentas que necesitan atención ([review](https://www.financialsamurai.com/empower-personal-dashboard-review/)).

**HO-7 · El período en una píldora** · Fase 1b · bajo · B
- *Qué es:* día, semana, mes, año o desde el inicio, calculado a partir de las cargas. Está a un toque, no en la primera vista. En mobile es una píldora que abre una hoja con opciones y se recuerda en el dispositivo.
- *Dónde se vio:* Kubera Recap ([blog](https://www.kubera.com/blog/personal-capital-india)). Navexa mobile ([help](https://help.navexa.com/en/articles/15812329-change-date-range-and-filters-in-the-mobile-app)).

**HO-8 · "Sin disparadores: nada que hacer"** · Fase 1b (crece con cada fase) · bajo · A
- *Qué es:* un estado de primera clase en Atención: "Revisé 3 disparadores · ninguno activo · nada que hacer (según tus reglas)".
  - Lista cuáles se evaluaron: desvío de peso fuera de banda (1b); vencimiento a < 15 días sin destino e hito del calendario a ≤ 10 días (2); invalidación tocada al cierre, objetivo alcanzado y tramo pendiente activo (4).
  - Un disparador activo dice cuál regla tuya lo activó, sin recomendar nada (D-07).
- *Dónde se vio:* en tu propia `disciplina.md`: "la respuesta correcta la mayoría de las semanas es 'no hay nada que hacer', y decirlo en una línea es un resultado exitoso".
- *Por qué acá:* convierte la revisión semanal de tu skill en lo primero que ves todos los días, y frena la presión a operar.

### 3.4 Exposición y riesgo

**EX-1 · Largo, corto y neto en pesos** · Fase 1a · medio · A
- *Qué es:* un gráfico con cuatro piezas:
  - los activos en pesos como un área sobre el 0;
  - el capital pendiente del leasing como un área espejada debajo;
  - la exposición neta al peso como una línea gruesa;
  - los activos en USD en una banda aparte.

  Tiene el selector financiero/total de D-03. Los colores son neutros, porque ninguna de las dos áreas es "mala". En mobile son dos barras horizontales con el neto entre ellas.
- *Dónde se vio:* pyfolio dibuja la exposición larga, corta y neta alrededor de cero ([plotting.py](https://raw.githubusercontent.com/quantopian/pyfolio/master/pyfolio/plotting.py)). Maybe pone activos y pasivos como bloques gemelos ([balance_sheet.rb](https://raw.githubusercontent.com/maybe-finance/maybe/main/app/models/balance_sheet.rb)).
- *Por qué acá:* la idea del spec de que la deuda en pesos es una posición corta en pesos se ve, en lugar de tener que leerla.

**EX-2 · Moneda económica, no moneda de cotización** · Fase 1a (solo un test) · bajo · A
- *Qué es:* `activos.moneda_riesgo` ya está en el schema. Lo único que falta es un test que fije que un CEDEAR cuenta como USD.
- *Dónde se vio:* la regla de concentración por moneda de Ghostfolio agrupa por moneda de cotización ([regla](https://raw.githubusercontent.com/ghostfolio/ghostfolio/main/apps/api/src/models/rules/currency-cluster-risk/current-investment.ts)), así que un CEDEAR terminaría contado como pesos.

**EX-3 · Tus reglas, arrancando de tu tesis** · Fase 1b · bajo · A
- *Qué es:*
  - **Peso actual contra objetivo, con tus bandas.**
    - Los pesos objetivo y las bandas de ±5 pp se importan de `tesis.md` (DS-11, D-51). Son tus valores, no una propuesta de la app.
    - La base es la **cartera de la tesis** (las posiciones que lista más su tramo en LECAP), no todo el patrimonio financiero. Es la base sobre la que calculaste los objetivos.
    - Se dibuja como una barra con la banda sombreada y una marca en el objetivo. Salir de la banda activa el disparador 4 de tu skill (HO-8).
  - **El resto de las reglas arranca vacío y no se evalúa hasta que les pongas un umbral:** top 1, top 3, exposición neta al peso como % del financiero, % en un solo bróker, meses de cuota cubiertos por liquidez remunerada.
  - Todas muestran ✓ o ✗ junto a su fórmula y usan el deslizante con −/+ de D-08.
- *Dónde se vio:* tu `tesis.md`, tabla "Bandas de rebalanceo". Ghostfolio X-ray, con umbrales de 0 a 100% que define el usuario ([rules](https://github.com/ghostfolio/ghostfolio/tree/main/apps/api/src/models/rules)). ProjectionLab deja que el usuario fije los umbrales de éxito ([MC](https://cdn.projectionlab.com/blog/monte-carlo-redesign)); Boldin, en cambio, los trae fijos ([comparación](https://www.boldin.com/retirement/boldin-vs-projectionlab/)).
- *Por qué acá:* la app controla todo el tiempo los límites que ya escribiste, sin recomendar nada (D-07).

**EX-4 · Composición sin tortas** · Fase 1b · bajo · A
- *Qué es:* para clase, moneda y geografía, una barra horizontal finita y apilada con leyenda. Cada grupo se despliega en una mini barra de peso de 10 rayitas. Cada activo tiene el mismo color en todos los gráficos.
- *Dónde se vio:* Maybe ([balance sheet](https://raw.githubusercontent.com/maybe-finance/maybe/main/app/views/pages/dashboard/_balance_sheet.html.erb), [peso](https://raw.githubusercontent.com/maybe-finance/maybe/main/app/views/pages/dashboard/_group_weight.html.erb)). IBM Carbon pide usar el mismo color por serie en todo el tablero ([dashboards](https://raw.githubusercontent.com/carbon-design-system/carbon-website/main/src/pages/data-visualization/dashboards/index.mdx)).

**EX-5 · Bonos en pesos explicados en dólares** · Fase 1b (LECAP/BONCAP) / Fase 2 (CER y duales) · bajo · A
- *Qué es:*
  - **LECAP y BONCAP.** Muestran:
    - lo pagado, con costos;
    - lo que cobrás al vencimiento;
    - TEM y TEA netas de costos;
    - el valor en USD al CCL de hoy;
    - el **CCL de empate**: desde la compra, CCL de compra × (valor final ÷ precio pagado); desde hoy, CCL de hoy × (valor final ÷ precio de hoy).

    Ejemplo: pagaste $0,95 por VN, al vencimiento cobrás $1,00 y el CCL de compra era 1.500. El empate es 1.578,95: con ese CCL al vencimiento, la LECAP rindió en dólares lo mismo que haber dejado los dólares quietos.
  - **Bonos CER** (no verificado contra una herramienta que lo publique). La **inflación de empate** contra una LECAP de plazo parecido es (1 + TEM LECAP) ÷ (1 + TEM real del CER) − 1. Necesita la serie CER, `condiciones_bono` y una TEM de referencia pegada (CA-13). Si falta algo, "sin dato".
  - **Duales CER/TAMAR** (no verificado). La **TAMAR de empate** frente a la tasa fija, con la regla dual de `condiciones_bono`. Si falta algo, "sin dato".
- *Dónde se vio:* Comparatasas calcula la LECAP por 1 VN con comisión e IVA, TNA neta, TEM y cuánto se cobra al vencimiento ([lecaps](https://raw.githubusercontent.com/enzonotario/comparatasas.ar/main/app/pages/lecaps.vue)). Sheets Argento calcula la caución neta de comisión, derechos e IVA ([CAUCION](https://raw.githubusercontent.com/ferminrp/google-sheets-argento/main/doc/CAUCION.md)).
- *Por qué acá:* responde la pregunta argentina sobre un bono en pesos con una fórmula pura, sin opinar. Además, la LECAP de tu tesis vence en menos de dos meses.

**EX-6 · Pasivos en tres lentes y licuación con número** · Fase 2 (Fase 3 para los lentes de escenario) · medio · A
- *Qué es:* lo que falta pagar del leasing en ARS nominal, en pesos de hoy y en USD, junto con la TEA implícita de la financiación comparada con el valor del bien.
  - La licuación es capital ARS × (1/CCL₀ − 1/CCL₁). Por ejemplo, $20.000.000 con el CCL pasando de 1.000 a 1.120 da +US$ 2.142,86, en verde porque la deuda bajó.
  - Entre un informe del acreedor y el siguiente, el capital se muestra "según cuadro de marcha", con esa etiqueta. Se concilia cuando cargás el valor informado (`pasivo_saldos`).
- *Dónde se vio:* Comparatasas compara contado contra cuotas con TEA equivalente y cuotas descontadas por inflación ([metodología](https://raw.githubusercontent.com/enzonotario/comparatasas.ar/main/app/lib/methodology.ts)). Kubera Cruise Control hace avanzar una deuda manual según una tasa, y un valor tipeado reinicia la base ([help](https://help.kubera.com/article/157-cruise-control)). Portfolio Performance calcula la ganancia por moneda del efectivo como saldo × (1/tc₁ − 1/tc₀) ([manual](https://raw.githubusercontent.com/portfolio-performance/portfolio-help/master/docs/en/reference/view/reports/performance/calculation.md)).

**EX-7 · Treemap de cartera** · Fase 1b · bajo · B
- *Qué es:* el tamaño es el valor en USD y el color el resultado en USD %, en escala divergente con el 0 neutro. Se puede entrar de clase a activo, con breadcrumb.
- *Dónde se vio:* Portfolio Performance colorea su treemap por desempeño ([taxonomías](https://raw.githubusercontent.com/portfolio-performance/portfolio-help/master/docs/en/reference/view/taxonomies/using-taxonomies.md)). ECharts trae `leafDepth` y `colorMappingBy` ([treemap](https://raw.githubusercontent.com/apache/echarts-doc/master/en/option/series/treemap.md)).

**EX-8 · Qué CCL tipeaste, y el CCL implícito por CEDEAR** · Fase 1a (el campo) / 1b (el chip) · bajo · B
- *Qué es:*
  - Se guarda cuál CCL tipeaste ("promedio", "GGAL"…). El campo viene **completado con el último valor** y nunca es obligatorio, así que no suma tiempo a la carga.
  - Si además cargaste el precio del subyacente (opcional, D-18), el CEDEAR muestra un chip "CCL implícito 1.512 (+1,8% vs tu CCL)" y el efecto activo se parte en subyacente y prima.
  - Sin subyacente no se muestra nada, y la etiqueta dice "activo (incluye brecha de CCL implícito)".
- *Dónde se vio:* Data912 publica un CCL implícito por ticker ([OpenAPI](https://raw.githubusercontent.com/enzonotario/data912-docs/main/public/openapi.json)). Hay un proyecto que lo calcula para cada CEDEAR ([repo](https://github.com/unTalFranco/Calculo-CCL-tiempo-real)).

**EX-9 · Contribución por activo** · Fase 2 · medio · B
- *Qué es:* barras horizontales con el aporte de cada activo al período, partido en activo y TC. Se pueden agrupar por moneda o geografía, con opción de incluir posiciones cerradas.
- *Dónde se vio:* el Contribution Analysis de Sharesight ([help](https://help.sharesight.com/us/contribution-analysis-report/)).

**EX-10 · Lo que te costó operar este año, en USD** · Fase 2 · bajo · B
- *Qué es:* comisiones, IVA y derechos de mercado por mes y por bróker. Cada uno se convierte al `ccl_del_dia` de su operación. Las operaciones sin desglose (anteriores a CA-14) se cuentan como "sin dato", no como cero.
- *Dónde se vio:* Comparatasas muestra las LECAP netas de comisión e IVA ([lecaps](https://raw.githubusercontent.com/enzonotario/comparatasas.ar/main/app/pages/lecaps.vue)). Sheets Argento descuenta comisión, derechos e IVA de la caución ([CAUCION](https://raw.githubusercontent.com/ferminrp/google-sheets-argento/main/doc/CAUCION.md)).
- *Por qué acá:* tu skill dice que por debajo de la banda "el costo de operar supera el beneficio". Esto le pone número a ese costo.

### 3.5 Proyecciones y escenarios

**PR-1 · Abanico al estilo Banco de Inglaterra, con la línea de lo aportado** · Fase 3 · medio · A
- *Qué es:* la historia real va como línea sólida y, desde hoy, el fondo pasa a gris.
  - Bandas p5–p95 (clara) y p25–p75 (oscura), con la mediana encima.
  - Las etiquetas van en el borde derecho ("p95 US$ 310k").
  - La línea de capital aportado acumulado sigue la de Evolución (HO-2).
  - La mediana se rotula "la mitad de las corridas termina arriba, la mitad abajo", nunca "esperado".
- *Dónde se vio:* fanplot reproduce el fondo gris del Banco de Inglaterra y las etiquetas al borde ([BoE](https://raw.githubusercontent.com/guyabel/fanplot/master/vignettes/02_boe.Rmd), [fan](https://raw.githubusercontent.com/guyabel/fanplot/master/man/fan.Rd)). ECharts tiene una receta de banda de confianza ([ejemplo](https://raw.githubusercontent.com/apache/echarts-examples/gh-pages/public/examples/ts/confidence-band.ts)). Actual usa dos bandas y una mediana ([MC](https://raw.githubusercontent.com/actualbudget/actual/master/packages/docs/docs/experimental/monte-carlo-analysis.md)). Empower muestra la mediana y el percentil 10 ([review](https://www.benzinga.com/money/empower-personal-dashboard-review-retirement-planner-tool-tested)).

**PR-2 · Puntos y el % exacto** · Fase 3 · bajo · A
- *Qué es:* 100 puntos con el patrimonio financiero en USD al final del horizonte, y una línea vertical en el capital aportado. Los que quedan abajo van rellenos.
  - El % exacto siempre se imprime: "el 2,4% de las corridas termina debajo de lo que pusiste (2 de 100 puntos)".
  - Con 20 puntos, cada punto valdría 5%, y un 2–3% se vería como 0 o 1 punto.
- *Dónde se vio:* los quantile dotplots se diseñaron porque las frecuencias se interpretan más fácil que los porcentajes ([Kay et al.](https://raw.githubusercontent.com/mjskay/when-ish-is-my-bus/master/quantile-dotplots.md)).

**PR-3 · Cuánto y cuándo, no solo si** · Fase 3 · medio · A
- *Qué es:* junto a la probabilidad de terminar debajo de lo aportado van tres datos:
  - cuánto falta: la mediana entre esas corridas, en USD y ARS;
  - en qué mes suele cruzarse la línea;
  - un mini histograma de esos meses.
- *Dónde se vio:* Actual muestra cuándo ocurre la falla típica y un histograma de agotamiento ([MC](https://raw.githubusercontent.com/actualbudget/actual/master/packages/docs/docs/experimental/monte-carlo-analysis.md)). Kitces explica que un éxito binario oculta la magnitud ([artículo](https://www.kitces.com/blog/monte-carlo-guardrails-probability-of-adjustment-success-client-communication-dynamic-retirement-spending/)). Un usuario valora que Portfolio Visualizer muestre cuándo fallan las corridas ([foro](https://mutualfundobserver.com/discuss/showthread.php?tid=48112)).

**PR-4 · Comparar con la base punteada y tres cajas de diferencia** · Fase 3 · bajo · A
- *Qué es:* en la comparación de D-08, la p50 de la base va punteada y la variante sólida. Al costado (debajo en mobile) se listan solo los supuestos que difieren y tres cajas:
  - patrimonio al final del horizonte;
  - mes de cobertura de la cuota (según D-49);
  - probabilidad de terminar debajo de lo aportado.

  Ejemplo: "Cobertura de cuota: mar-2028 → nov-2027 (−4 meses)".
- *Dónde se vio:* el Compare Mode de ProjectionLab ([blog](https://projectionlab.com/blog/compare-mode-upgrades)). En NewRetirement (hoy Boldin), los valores finales solo aparecían al pasar el mouse y comparar era manual ([foro](https://www.bogleheads.org/forum/viewtopic.php?t=434158)).

**PR-5 · La cobertura de la cuota como hito con fecha probable** · Fase 3 · medio · A
- *Qué es:* con la lectura propuesta en D-49, el hito es el primer mes en que el rendimiento pasivo de la cartera financiera cubre la cuota del leasing.
  - Va un gráfico de cruce, en ARS y en USD, con una línea vertical en el mes del cruce.
  - Debajo se lee "p10 / p50 / p90 del mes de cruce" y "% de corridas que no cruzan".
  - Si el escenario ejerce la opción de compra, la cuota termina ese mes.
  - Nunca se infiere rendimiento de un cambio de saldo sin restar los movimientos (D-06).
- *Dónde se vio:* los hitos condicionales de ProjectionLab, con una tabla de cuándo se alcanzan en cada corrida ([Milestones](https://projectionlab.com/blog/milestones), [changelog](https://projectionlab.com/changelog)). El Crossover Point de Actual, con su advertencia de que inferir el retorno desde los saldos incluye los aportes ([doc](https://actualbudget.org/docs/experimental/crossover-point-report)).

**PR-6 · Lente "pesos de hoy"** · Fase 3 · bajo · A
- *Qué es:* tres vistas: ARS nominal, ARS de hoy (deflactado con la inflación del escenario) y USD.
  - Las probabilidades y los meses de los hitos no cambian con el lente.
  - Si el escenario no tiene inflación cargada, la vista dice "ARS de hoy: sin dato".
- *Dónde se vio:* ProjectionLab ([help](https://cdn.projectionlab.com/help/todays-currency)). Boldin ([artículo](https://www.boldin.com/retirement/your-money-over-time-the-critical-differences-between-todays-and-future-dollars-rtx)). Actual la trae activada por defecto ([MC](https://raw.githubusercontent.com/actualbudget/actual/master/packages/docs/docs/experimental/monte-carlo-analysis.md)). Mostrar solo valores nominales hizo que usuarios dejaran NewRetirement ([foro](https://www.bogleheads.org/forum/viewtopic.php?t=434158)).

**PR-7 · Reproducibilidad y límites a la vista** · Fase 3 · bajo · A
- *Qué es:* al pie del abanico (valores de ejemplo):

  > "t-Student ν=… · 10.000 corridas · semilla 83921 · sfc32 v1 · **sorteos independientes mes a mes: el modelo no repite rachas de crisis**"

  - Se recalcula en un Web Worker con debounce mientras movés un deslizante.
  - "Nueva semilla" es un botón aparte, así que un número que cambia siempre tiene una causa a la vista.
- *Dónde se vio:* ProjectionLab agregó la semilla y el recálculo automático ([MC](https://cdn.projectionlab.com/blog/monte-carlo-redesign)). Actual advierte que los sorteos independientes subestiman las rachas ([MC](https://raw.githubusercontent.com/actualbudget/actual/master/packages/docs/docs/experimental/monte-carlo-analysis.md)). Con entradas parecidas, tres herramientas dieron cerca de 60%, 80% y 90% de éxito ([foro](https://www.bogleheads.org/forum/viewtopic.php?t=444911)).

**PR-8 · Escenarios anclados y aislados** · Fase 3 · bajo · A
- *Qué es:* cada escenario guarda sus supuestos y una fecha de ancla, y muestra "anclado a datos del 07/10".
  - "Re-anclar a hoy" conserva los supuestos y la semilla.
  - Un duplicado no comparte con el original nada que se pueda modificar.
- *Dónde se vio:* en NewRetirement, editar un escenario de prueba cambiaba la base ([foro](https://www.bogleheads.org/forum/viewtopic.php?t=434158)). En ProjectionLab, los clones no reciben las ediciones que se hacen después ([foro](https://www.bogleheads.org/forum/viewtopic.php?t=375804)).

**PR-9 · Ver una corrida y la tabla de corridas** · Fase 3 · medio · B
- *Qué es:* un selector dibuja una corrida concreta: peor, p25, mediana, p75 o mejor.
  - Debajo, una tabla de corridas ordenadas de peor a mejor.
  - Al expandir una se ve, mes a mes, el CCL, el retorno sorteado por clase, el aporte, la cuota y el patrimonio, con la misma traza que el resto de la app.
- *Dónde se vio:* Actual tiene "Jump to" y "Show the working" ([MC](https://raw.githubusercontent.com/actualbudget/actual/master/packages/docs/docs/experimental/monte-carlo-analysis.md)). En ProjectionLab se abre cualquier corrida que falló ([MC](https://projectionlab.com/monte-carlo)). Hay quejas de que el Monte Carlo es una caja negra ([foro](https://www.bogleheads.org/forum/viewtopic.php?t=470452)).

**PR-10 · Qué falta y qué no cierra** · Fase 3 · bajo · B
- *Qué es:* en lugar de un gráfico vacío, "faltan 3: devaluación, inflación, retorno CEDEAR". Al lado de los botones aparecen notas solo aritméticas, como "bono tasa fija 2,0%/mes < inflación 2,5%/mes ⇒ retorno real negativo".
- *Dónde se vio:* en NewRetirement, pasar al perfil "pesimista" llevó el éxito de 99% a 15% porque el retorno nominal quedaba por debajo de la inflación ([foro](https://www.bogleheads.org/forum/viewtopic.php?t=434158)).

**PR-11 · Plan contra realidad** · Fase 3 · medio · B
- *Qué es:* en Evolución, el patrimonio real superpuesto al abanico de un escenario anclado: "hoy estás en el percentil 38 del escenario base". En Flujo de caja, lo proyectado, lo real y la diferencia por mes.
- *Dónde se vio:* ProjectionLab Actual Progress ([help](https://projectionlab.com/help/overlay-actual-progress)). Monarch, con columnas planeado / real / restante ([help](https://help.monarch.com/hc/en-us/articles/360048883631-Creating-Your-Budget-in-Monarch)).

**PR-12 · Flujo de caja como Sankey** · Fase 2 · medio · C
- *Qué es:*
  - **El flujo:** el ingreso en USD × cripto_venta y el ingreso fijo en ARS se convierten en pesos, que se reparten en gastos fijos, cuota y excedente.
  - **El costo de conversión** (cripto vs. CCL) aparece como un flujo propio.
  - **Exige dos implementaciones,** porque con excedente negativo o menos de 768 px pasa obligatoriamente a barra apilada. Son dos implementaciones para tres flujos, así que va como opcional. La barra apilada sola alcanza.
- *Dónde se vio:* Monarch ([blog](https://www.monarch.com/blog/visualize-your-cash-flow-like-never-before)). ProjectionLab ([Sankey](https://projectionlab.com/blog/sankey-visualization)). Actual documenta que su Sankey no muestra negativos y que en mobile tiene diseños limitados ([doc](https://raw.githubusercontent.com/actualbudget/actual/master/packages/docs/docs/experimental/sankey-report.md)).

**PR-13 · Liquidez de los próximos 60–90 días** · Fase 2 · medio · B
- *Qué es:* el disponible proyectado día a día a partir de cuotas, ingreso fijo, gastos y vencimientos, usando solo las tasas leídas o cargadas:
  - saldo de MP;
  - rescates de FIMA, con su plazo (D-46);
  - efectivo de IEB.

  Separa lo disponible hoy, mañana y en N días hábiles bancarios (24h/48h de IEB, plazo de rescate del FCI). Avisa si a la fecha de la cuota no alcanza.
- *Dónde se vio:* Actual Balance Forecast ([doc](https://raw.githubusercontent.com/actualbudget/actual/master/packages/docs/docs/experimental/balance-forecast-report.md)). PocketSmith ([web](https://www.pocketsmith.com/ynab-alternative/)). Usuarios de Copilot que lo piden ([pedido](https://feedback.copilot.money/feature-requests/p/income-vs-expenses-cash-flow-graph)). ArgentinaDatos expone el plazo de liquidación de cada fondo ([OpenAPI](https://raw.githubusercontent.com/enzonotario/esjs-argentina-datos-api/main/docs/public/openapi.json)).

**PR-14 · Calendario con lo esperado y lo cobrado** · Fase 2 · medio · B
- *Qué es:* vencimientos, cupones CER y duales, amortizaciones, cuotas y los hitos que importás de `calendario.md` (DS-11). Cada uno va con el monto esperado y el cobrado, y se tilda solo al conciliar.
- *Dónde se vio:* Snowball ([App Store](https://apps.apple.com/app/id6463484375), [overview](https://snowball-analytics.com/overview)).

**PR-15 · Consenso REM como marca de referencia (a decidir por vos)** · Fase 3 · bajo · C
- *Qué es:* una rayita sobre los deslizantes de devaluación e inflación que dice "REM BCRA, mediana (informe AAAA-MM)", con el dato que pegás vos cada mes. No es un valor por defecto ni se aplica solo.
- *Dónde se vio:* ArgentinaDatos sirve el REM con mediana y percentiles ([OpenAPI](https://raw.githubusercontent.com/enzonotario/esjs-argentina-datos-api/main/docs/public/openapi.json)).
- *Reparo:* roza D-07 y D-08 ("la app no propone valores"). Entra solo si lo aprobás como decisión nueva.

### 3.6 Disciplina

**DS-1 · Dos rendimientos, cada uno con su pregunta** · Fase 4 · medio · A
- *Qué es:* "¿Cuánto rindió tu plata?" es la TIR sobre operaciones y movimientos (D-06). "¿Tus decisiones le ganaron a SPY?" es el TWR. Los dos van en ARS y en USD.
  - **Renta variable:** con menos de 365 días se muestra el % total sin anualizar, y se aclara.
  - **Renta fija:** LECAP, BONCAP, CER y duales casi siempre vencen antes del año, y la medida estándar es TEM/TEA. Por eso se muestran TEM y TEA realizadas al lado del % simple (D-39).
  - **Sin solución:** si la TIR no tiene solución, se muestra "sin dato" con el motivo, nunca cero.
- *Dónde se vio:*
  - Sharesight muestra, para las mismas operaciones, −12,77% anual ponderado por dinero y +11,80% ponderado por tiempo ([blog](https://www.sharesight.com/blog/time-weighted-vs-money-weighted-rates-of-return)).
  - Parqet explica qué pregunta contesta cada métrica ([FAQ](https://faq.parqet.com/article/109-renditevergleich)).
  - Kubera muestra ROI simple antes del año ([help](https://help.kubera.com/article/155-why-is-kubera-showing-roi-instead-of-irr-for-some-of-my-investments-is-it-a-bug)).
  - hledger explica cuándo falla cada una ([roi](https://github.com/simonmichael/hledger/blob/master/hledger/Hledger/Cli/Commands/Roi.md)).
  - Usuarios de Ghostfolio se quejaron durante años de que la app mostrara solo TWR ([#2960](https://github.com/ghostfolio/ghostfolio/discussions/2960)).

**DS-2 · SPY en la sombra: dos sombras, sin contar dos veces** · Fase 4 · medio · A
- *Qué es (D-40):*
  - **Sombra de cartera.**
    - "Compran" SPY solo los flujos externos de `movimientos_capital` (aportes y retiros), pasados a USD con el `tc_aplicado` de cada fila (los aportes no tienen `ccl_del_dia`).
    - Las operaciones internas no compran nada. Si las contara, la misma plata compraría SPY dos veces: al entrar y al pasar a un CEDEAR.
    - Un gráfico índice parte de 100 para la cartera y para la sombra, en USD y en ARS. En ARS, la sombra se convierte al CCL de cada día.
  - **Sombra por decisión.**
    - Cada compra (con su `ccl_del_dia`) compra SPY ese día.
    - Su venta posterior, o el día de hoy si no hubo venta, la cierra.
    - La marca de la decisión es ✓ si le ganó a SPY o – si no. Son íconos, no verde y rojo, porque un empate cerca de cero no es una pérdida.
  - **Serie de precios.** Es el **cierre ajustado (total return)** de SPY, pegado por vos con CA-13, sin ninguna API (D-07). Así no hace falta una tabla de dividendos, y SPY no queda en desventaja contra una cartera que sí registra sus dividendos en USD. Una fecha sin precio queda "sin dato", nunca interpolada.
- *Dónde se vio:* Sharesight rebasa los dos a 10.000, incluye un componente cambiario y marca con tilde las posiciones que le ganaron al benchmark ([benchmarking](https://help.sharesight.com/benchmarking/)). Ghostfolio normaliza el benchmark por moneda desde la 2.33.0 ([CHANGELOG](https://github.com/ghostfolio/ghostfolio/blob/main/CHANGELOG.md)). Beancount propone replicar los mismos flujos en una cartera simple ([returns](https://github.com/beancount/docs/blob/master/docs/calculating_portolio_returns.md)). Copilot y Monarch excluyen los depósitos del rendimiento ([Copilot](https://help.copilot.money/en/articles/5377645-investments-tab), [Monarch](https://help.monarch.com/hc/en-us/articles/41855507661076-Investments-in-Monarch)). El benchmark de Portfolio Performance usa solo precios ([doc](https://github.com/portfolio-performance/portfolio-help/blob/master/docs/en/how-to/benchmarking.md)).

**DS-3 · Gráfico anotado por activo** · Fase 4 · medio · A
- *Qué es:* sobre el precio de cada activo se marcan:
  - compras y ventas con triángulos;
  - los tramos como bandas horizontales (son rangos, D-51), con los pendientes como marcadores huecos;
  - la invalidación y los **objetivos** como líneas;
  - la ejecución conectada a su tramo, con la diferencia en %;
  - el PPC como escalera, en ARS o USD;
  - los hitos del calendario como líneas verticales punteadas;
  - los días sin precio.

  Tus niveles están en US$ del subyacente, y ninguna fuente diaria lo trae (D-18). Por eso se comparan con el **"subyacente implícito al CCL tipeado"** = precio en pesos × ratio ÷ CCL:
  - se calcula para mostrar y no se guarda, con lo que D-18 se respeta;
  - incluye la brecha de CCL implícito, y la etiqueta lo dice;
  - cerca de un nivel aparece "a 1,2% del nivel, medido con el subyacente implícito; confirmá con el cierre real";
  - si pegás cierres reales del subyacente (CA-13), se usan esos.

  Hay un filtro "nivel perforado".
- *Dónde se vio:* el gráfico de títulos de Portfolio Performance, con barra de precio límite y filtro "límite superado" ([doc](https://github.com/portfolio-performance/portfolio-help/blob/master/docs/en/reference/view/securities/all-securities.md)). markLine y markArea de ECharts ([doc](https://raw.githubusercontent.com/apache/echarts-doc/master/en/option/partial/mark-line.md)). reference_area de Evidence ([doc](https://raw.githubusercontent.com/evidence-dev/evidence/main/docs/components/reference_area.mdx)). Tu `tesis.md` define los niveles por cierre, no por mínimo intradiario.

**DS-4 · Tesis → ejecución → resultado en una sola fila** · Fase 4 · bajo · A
- *Qué es:* para cada tramo, una fila con:
  - la tesis y sus pilares;
  - cuándo se anotó el tramo;
  - el rango decidido;
  - las operaciones que lo ejecutaron (`nivel_operaciones`) y la diferencia;
  - lo que costó en pesos no respetarlo;
  - la distancia al primer objetivo;
  - si después vendiste, el resultado.

  `niveles.creado_en` prueba que el nivel fue anterior a la compra **solo para los niveles creados en la app**. Los que importes de tu tesis tendrán como `creado_en` la hora de la importación, así que muestran `fecha_definicion` con la etiqueta "declarada".
- *Dónde se vio:* Ghostfolio marca como borrador lo que tiene fecha futura ([CHANGELOG](https://github.com/ghostfolio/ghostfolio/blob/main/CHANGELOG.md)). Beancount encadena transacciones relacionadas con links ([sintaxis](https://github.com/beancount/docs/blob/master/docs/beancount_language_syntax.md)).

**DS-5 · TNA cobrada contra TNA anunciada, neta de impuestos** · guardar en Fase 1b / vista en Fase 4 · bajo · A
- *Qué es:*
  - **Qué se guarda.** Cada carga guarda la TNA y el tope que muestra la captura de MP. Si se pierde algún día, se recupera reprocesando (CO-13).
  - **TNA cobrada.** Sale de dos saldos consecutivos, restando los movimientos: (saldo_t − saldo_t−1 − flujos) ÷ saldo_t−1 × 365/días.
  - **FIMA.** Su rendimiento sale de la variación del valor de la cuotaparte (D-46).
  - **TNA combinada.** La que pide el spec es **neta del impuesto a las transferencias**, tomado de `movimientos_capital.impuesto`.
  - **Qué se muestra.** Las dos TNA juntas, más "pesos por encima del tope que no rinden", y un aviso cuando cambian la tasa o el tope. Es la base de la rutina MP ↔ FIMA del spec.
- *Dónde se vio:* en Comparatasas, un usuario vio a MP con 22,5% en la app y 27,19% en el sitio ([#321](https://github.com/enzonotario/comparatasas.ar/issues/321)). El sitio simula el interés solo hasta el tope ([gráficos](https://raw.githubusercontent.com/enzonotario/comparatasas.ar/main/app/pages/cuentas-billeteras/graficos.vue)), y tuvo correcciones por topes faltantes y por cambios de fondo subyacente ([issues](https://github.com/enzonotario/comparatasas.ar/issues?q=is%3Aissue)).

**DS-6 · Nota del día y marcadores** · Fase 1a (el campo) / 1b (los marcadores) · bajo · B
- *Qué es:* un campo opcional de una línea en Carga ("CCL saltó por elecciones").
  - Una carga diaria crea varias filas en `cargas`, una por cuenta, así que la nota no va ahí. Va a la tabla `eventos`, que ya existe, como tipo `nota` y con su `carga_id`.
  - Se dibuja como marcador en Evolución y en el gráfico del activo.
  - El campo está desde la 1a porque es un dato que solo vos podés escribir ese día.
- *Dónde se vio:* `note` y `event` de Beancount ([sintaxis](https://github.com/beancount/docs/blob/master/docs/beancount_language_syntax.md)). Reporte de eventos de Fava ([Events](https://github.com/beancount/fava/blob/main/frontend/src/reports/events/Events.svelte)). `commentary` de Evidence ([doc](https://raw.githubusercontent.com/evidence-dev/evidence/main/docs/components/commentary.mdx)).

**DS-7 · Operaciones cerradas** · Fase 4 · bajo · B
- *Qué es:* cada venta cierra una operación con:
  - días de tenencia;
  - retorno simple;
  - TIR anualizada, solo con 365 días o más, o en renta fija (D-39);
  - una línea que explica por qué difieren.

  Con la importación de CA-14, los precios y comisiones son los reales y no los inferidos.
- *Dónde se vio:* la vista Trades de Portfolio Performance ([doc](https://github.com/portfolio-performance/portfolio-help/blob/master/docs/en/reference/view/reports/performance/trades.md)).

**DS-8 · Mapa de calor mensual y caída máxima** · Fase 4 · bajo · B
- *Qué es:* rendimiento mensual en USD, con opción ARS, en paleta divergente con 0 neutro, más el drawdown del patrimonio financiero. Los meses con pocas cargas se marcan en lugar de interpolarse.
- *Dónde se vio:* los widgets de Portfolio Performance ([dashboard](https://raw.githubusercontent.com/portfolio-performance/portfolio-help/master/docs/en/reference/view/reports/performance/dashboard.md)).

**DS-9 · Modo calma** · Fase 4 · bajo · C
- *Qué es:* desde el menú, oculta la variación diaria y muestra solo el mes y el puente.
- *Dónde se vio:* Zen Mode de Ghostfolio ([features](https://raw.githubusercontent.com/ghostfolio/ghostfolio/main/apps/client/src/app/pages/features/features-page.html)).

**DS-10 · Tu skill de cartera leyendo datos reales** · después de la Fase 4 · medio · C
- *Qué es:* un endpoint (o servidor MCP) de solo lectura que expone posiciones, desglose, niveles y vencimientos. La skill `cartera-cedears` deja de depender de extractos pegados y usa el desglose de D-35.
  - Es una superficie externa nueva, y la cookie con HMAC de D-21 no sirve para un cliente máquina. Por eso necesita su propia decisión (D-50):
    - un token de solo lectura, con alcance, vencimiento y revocable;
    - límite de pedidos;
    - cada lectura auditada.
  - No choca con D-07: no es una API de bróker ni de precios, y los datos salen de la app en vez de entrar.
- *Dónde se vio:* el MCP de Parqet para Claude, en el que elegís qué compartir y podés revocar ([docs](https://developer.parqet.com/docs/connect-parqet-mcp-to-claude)). Usuarios de Sharesight lo piden ([foro](https://community.sharesight.com/t/portfolio-sharing-with-ai-tools-perplexity-chatgpt-etc/2116)).

**DS-11 · Importar tu tesis y tu calendario** · Fase 1b · bajo · A
- *Qué es:* una importación única, con revisión, de `tesis.md` y `calendario.md` (D-51). Se guarda solo como datos; las vistas llegan en su fase.
  - **De `tesis.md`:**
    - pesos objetivo y bandas, con su vigencia;
    - tramos como rangos en US$ del subyacente;
    - invalidaciones, por precio de cierre o por evento ("acuerdo firmado", sin precio);
    - objetivos;
    - la tesis y sus pilares (`tesis_texto`);
    - la fecha de definición, marcada "declarada".
  - **De `calendario.md`:** los hitos van a `eventos`, con su etiqueta "por confirmar" cuando la tiene.
  - Los cambios posteriores se hacen en la app y quedan en la auditoría. El historial de cambios de tu tesis se conserva como notas.
- *Dónde se vio:* tu propia skill, que ya lleva este registro a mano.
- *Por qué acá:* EX-3 y HO-8 necesitan los pesos objetivo desde la 1b. Además, cuanto antes estén cargados los niveles, antes empieza la historia de disciplina.

**DS-12 · LECAP en la sombra** · Fase 4 · medio · A
- *Qué es:* la misma mecánica que DS-2, pero contra quedarse en pesos.
  - **Cartera:** los flujos externos capitalizan a una TEM de referencia en pesos que pegás vos con CA-13, con su fuente.
  - **Decisión:** cada compra de CEDEAR contra lo que esos pesos habrían rendido en LECAP desde esa fecha hasta la venta o hasta hoy.
  - **Lectura:** "Contra LECAP: +3,1 pp" o "−2,4 pp", en ARS y en USD. Sin serie, "sin dato".
- *Dónde se vio:* tu skill, §4 "Referencia contra LECAP", y `disciplina.md`: "El costo de oportunidad no es cero, es la tasa en pesos".

**DS-13 · Niveles que se movieron** · Fase 4 · bajo · B
- *Qué es:* a partir de `auditoria`, cuántas veces se cambió cada invalidación y en qué dirección: "corrida hacia abajo 1 vez (12/09)".
  - Cambiar una invalidación pide un motivo, que queda como `eventos` de tipo `nota` vinculado al activo.
  - Es un marcador de disciplina al lado de "veces que se respetó el nivel" (spec §8).
- *Dónde se vio:* tu `disciplina.md`: "No corras los niveles de invalidación… Se ejecuta o se cambia conscientemente, con la razón anotada".

### 3.7 Mobile

**MO-1 · Tarjeta de posición con el USD arriba** · Fase 1a · bajo · A
- *Qué es:* debajo de 768 px (D-30), arriba van el nombre y el valor en USD.
  - Debajo, una grilla 2×2: resultado USD %, resultado ARS %, "de lo cual TC" y % de cartera.
  - Si el resultado en pesos y el de dólares tienen signo distinto, un único badge dice "ganás en pesos, perdés en dólares". No hay otro chip en la tarjeta.
  - Al tocar, se despliegan PPC, cantidad y días.
  - El formato compacto ("US$ 12,3k") se usa solo en la tarjeta; el número exacto está en el detalle.
- *Dónde se vio:* Carbon recomienda filas expandibles ([data table](https://raw.githubusercontent.com/carbon-design-system/carbon-website/main/src/pages/components/data-table/usage.mdx)). Ghostfolio tiene un modo simplificado y precisión dinámica en mobile ([CHANGELOG](https://github.com/ghostfolio/ghostfolio/blob/main/CHANGELOG.md)).

**MO-2 · Todo lo que tiene hover tiene tap** · Fase 1a · bajo · A
- *Qué es:*
  - Cada número con traza es un objetivo de 44 px o más.
  - El popover entra en 360 px.
  - Ningún valor depende solo del hover.
  - Los encabezados explican el concepto; las celdas, los insumos exactos.
- *Dónde se vio:* Portfolio Performance explica el concepto en el encabezado y los precios exactos en la celda, pero solo con mouse ([doc](https://raw.githubusercontent.com/portfolio-performance/portfolio-help/master/docs/en/reference/view/reports/performance/securities.md)). En Boldin, los valores solo-hover volvían manual la comparación ([foro](https://www.bogleheads.org/forum/viewtopic.php?t=434158)).

**MO-3 · Modo privado** · Fase 1b · bajo · A
- *Qué es:* un ícono de ojo en el menú, o la tecla "h" cuando ningún campo tiene el foco, oculta los montos y deja los %, los pesos relativos y el desglose. La elección se recuerda en el dispositivo (localStorage con try/catch).
- *Dónde se vio:* Delta ([help](https://support.delta.app/en/articles/1467773-how-to-hide-your-balances)). Pedido abierto en getquin ([feedback](https://feedback.getquin.com/b/feature-requests/privacy-mode/)). Monarch permite compartir gráficos sin montos ([Reports](https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports)).

**MO-4 · Gráficos que se transforman, no que se achican** · Fase 1b–2 · bajo · A
- *Qué es:* debajo de 768 px, el waterfall pasa a una lista vertical con signos y el largo/corto a dos barras. Son los mismos datos con la misma traza.
- *Dónde se vio:* Actual documenta los límites del Sankey en mobile ([doc](https://raw.githubusercontent.com/actualbudget/actual/master/packages/docs/docs/experimental/sankey-report.md)).

**MO-5 · Color, signo y forma, con paleta para daltónicos** · Fase 1b · bajo · B
- *Qué es:*
  - Siempre "+1,8%" o "−0,6%", con ▲ o ▼ además del color.
  - Un interruptor "Paleta daltónica" cambia positivo a azul y negativo a naranja.
  - ECharts con `aria.enabled` y patrones (decal).
  - ARS y USD se distinguen por tipografía o por la forma del badge, no solo por el tono.
  - Los estados de datos usan su propio vocabulario de íconos (HO-4).
- *Dónde se vio:* WCAG 1.4.1 ([understanding](https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/use-of-color.html)). Los temas de GitHub Primer para protanopia y deuteranopia ([tokens](https://raw.githubusercontent.com/primer/primitives/main/src/tokens/functional/color/fgColor.json5)). ECharts aria ([doc](https://raw.githubusercontent.com/apache/echarts-doc/master/en/option/component/aria.md)).

**MO-6 · Cargar desde el teléfono** · validar en la 1a; Fase 1b si las capturas salen del teléfono, si no Fase 2 · medio · A/B
- *Qué es:* si las capturas de MP y Galicia se sacan en el teléfono, pasarlas a la computadora puede ser el costo más grande de los 60 s. Hay que medirlo la primera semana.
  - En el teléfono, pegás o compartís la captura primero.
  - Safari en iOS no soporta Web Share Target. Hace falta un selector de archivos (`<input type="file" accept="image/*">`) como alternativa. Chrome en Android sí lo soporta.
  - En la bandeja, deslizar a la derecha acepta una fila y a la izquierda la deja pendiente, con la semántica de D-47.
- *Dónde se vio:* datos de compatibilidad de MDN para `share_target` ([browser-compat-data](https://github.com/mdn/browser-compat-data/blob/main/manifests/webapp/share_target.json)). Monarch ([Swipe to Review](https://www.monarch.com/review-on-the-go-and-smart-split)). En Hacker News, editar planillas en el teléfono aparece como motivo para abandonarlas ([HN](https://news.ycombinator.com/item?id=37337482)). El pedido de usar Fava desde el teléfono sigue sin implementarse ([#965](https://github.com/beancount/fava/issues/965)). beancount-import tiene "Fixme later" ([repo](https://github.com/jbms/beancount-import)).

### 3.8 Qué entra en cada fase

**Antes de escribir código:** confirmar D-35 junto con D-36, D-37 y D-38. D-35 bloquea la matemática de la fase 1 y la invariante "activo + TC = total, exacto" de `calidad.md`. Después, D-46 (FIMA) y D-47 (filas diferidas), que también tocan la 1a.

- **Fase 1a.** Es lo mínimo para que sorprenda, para cumplir lo que el spec y las decisiones exigen, y para empezar a juntar historia.
  - CA-1, CA-3, CA-4, CA-8 (sin la paleta).
  - CO-1, CO-3, CO-4, CO-5, CO-7.
  - HO-1, HO-4, HO-5 (las dos tarjetas de patrimonio, que exige D-03).
  - EX-1 con el test de EX-2.
  - MO-1, MO-2.
  - **Los datos que solo vos podés tipear ese día:** CCL, cripto, `ccl_referencia` (EX-8, completado con el último valor) y la nota del día (DS-6). También `parser_version` y `lote` en cada carga, que no se pueden reconstruir después.
  - **Validar en la primera semana, sin código:** de dónde salen las capturas (MO-6) y de qué captura sale FIMA (D-46).
- **Fase 1b.**
  - CA-2, CA-5, CA-6, CA-7, CA-9, CA-10, CA-11, CA-13 (CCL histórico).
  - CO-8, CO-9, CO-10, CO-11, CO-13 (pruebas sintéticas en job nocturno).
  - HO-2, HO-3, HO-5 (el resto), HO-6, HO-7, HO-8.
  - EX-3, EX-4, EX-5 (LECAP/BONCAP), EX-7, EX-8 (chip).
  - DS-5 (guardar TNA y tope), DS-6 (marcadores), DS-11.
  - MO-3, MO-4, MO-5, y MO-6 si la validación lo pide.
  - Lo que se puede recuperar reprocesando los archivos guardados (TNA y tope, totales del bróker, cajas) puede esperar sin perder nada (D-11, CO-13).
- **Fase 2.**
  - CA-12, CA-14.
  - CO-2, CO-12, CO-14, CO-15.
  - EX-5 (CER y duales), EX-6 (nominal y USD), EX-9, EX-10.
  - PR-12 (C), PR-13, PR-14.
  - MO-6, si no subió antes.
- **Fase 3.** PR-1 a PR-11, EX-6 (lentes de escenario) y PR-15 si lo aprobás.
- **Fase 4.** DS-1 a DS-4, DS-5 (vista), DS-7, DS-8, DS-9, DS-12, DS-13 y los niveles en HO-6 y HO-8.
  - **Si querés los niveles antes:** su chequeo ya funciona con la tesis importada en la 1b y el subyacente implícito (DS-3). Adelantarlo es una decisión tuya, porque cambia el orden de fases del spec.
- **Después.** DS-10, con D-50.

---

## 4. Lo que hacen todas y NO hay que copiar

- **Estimar lo que no se puede medir.** Las tasaciones automáticas de Finary bajaron entre 7% y 15% de un día para otro, y una pasó de 630k a 381k ([foro](https://community.finary.com/t/estimation-immo-finary/36932), [foro](https://community.finary.com/t/estimation-des-biens-immobiliers/319)). Se mantiene D-04: valuación manual, con fecha y antigüedad visible.
- **Publicar matemática sin testear.** Finary mostró Microsoft con +3.136% en un mes y tuvo que rehacer el cálculo ([update](https://finary.com/en/product-updates/mars-2024), [foro](https://community.finary.com/t/live-mise-a-jour-des-calculs-de-la-performance/12950)).
- **Anualizar acciones con menos de un año.** Por eso Kubera y Sharesight muestran ROI simple antes del año ([Kubera](https://help.kubera.com/article/155-why-is-kubera-showing-roi-instead-of-irr-for-some-of-my-investments-is-it-a-bug), [Sharesight](https://www.sharesight.com/blog/how-sharesight-calculates-your-investment-performance/)). La renta fija es la excepción: ahí TEM y TEA son la medida estándar (D-39).
- **Mezclar aportes con rendimiento.** Pasó en Wealthfolio ([v3.6.3](https://github.com/afadil/wealthfolio/releases/tag/v3.6.3)), en Finary ([foro](https://community.finary.com/t/la-fonction-pour-tracker-la-performance-de-son-portfolio-nest-pas-calculee-correctement/25578)) y en el retorno inferido de Actual ([doc](https://actualbudget.org/docs/experimental/crossover-point-report)).
- **Un desglose por moneda que se presenta mal.**
  - En Sharesight, los porcentajes de los componentes no suman por la capitalización, y el efecto cambiario sobre la ganancia queda dentro de la ganancia de capital. Hay usuarios que no entienden cómo se calcula ([componentes](https://help.sharesight.com/components-return/), [foro](https://community.sharesight.com/t/please-help-me-understand-how-currency-gain-is-calculated/1620)).
  - En Portfolio Performance la cuenta es exacta, pero el efecto cambiario de los títulos no es una línea de primer nivel: queda en una columna dentro de la ganancia de capital, y hay usuarios que no lo encuentran ([foro](https://forum.portfolio-performance.info/t/foreign-currency-investments-and-performance-tracking/31758)).
  - La lección es de presentación: montos que suman, y el efecto cambiario como línea propia.
- **Una sola moneda "principal", o el dólar oficial.**
  - Lunch Money tiene una sola moneda principal ([doc](https://support.lunchmoney.app/settings/multicurrency)).
  - Monarch trabaja en USD y no convierte ([análisis](https://sacra.com/chat/h/c1c03e02-e948-4b2d-8be0-4438aa173d71/)).
  - Ghostfolio usaba el tipo oficial para ARS según un issue de 2024 ([#3273](https://github.com/ghostfolio/ghostfolio/issues/3273)), y agrupa por moneda de cotización ([regla](https://raw.githubusercontent.com/ghostfolio/ghostfolio/main/apps/api/src/models/rules/currency-cluster-risk/current-investment.ts)).
- **Convertir la historia al tipo de cambio de hoy, o sumar monedas sin convertir.** Son los dos bugs reales de Lunch Money ([bug](https://feedback.lunchmoney.app/bugs/p/historical-balances-in-secondary-currencies-miscalculated-using-current-rate), [bug](https://feedback.lunchmoney.app/mobile-app/p/mobile-app-estd-net-worth-calculation-disregards-currency)).
- **Perseguir la sincronización automática.**
  - Las integraciones son frágiles:
    - cuentas de Empower que dejaron de actualizarse durante semanas ([unitQ](https://unitq.com/unitq-scorecards/personalcapital));
    - tenencias duplicadas en Delta ([help](https://support.delta.app/en/articles/16735987-incorrect-holdings-or-inflated-portfolio-value-after-connecting-etoro));
    - pyhomebroker archivado ([repo](https://github.com/crapher/pyhomebroker));
    - Yahoo cobrando su CSV ([PP](https://github.com/portfolio-performance/portfolio-help/blob/master/docs/en/concepts/historical-prices.md)).
  - Para Maybe, los proveedores bancarios fueron "el desafío más grande" ([v0.6.0](https://github.com/maybe-finance/maybe/releases/tag/v0.6.0)).
  - Data912 aclara que es educativa y que puede desaparecer ([OpenAPI](https://raw.githubusercontent.com/enzonotario/data912-docs/main/public/openapi.json)).
  - La carga manual verificada es una ventaja, no una carencia. Ninguna API tiene que meterse en el camino de los 60 segundos.
- **Guardar lo que leyó la IA sin revisar, o fallar en silencio.** Kubera pide "Rescan" porque su IA se equivoca ([help](https://help.kubera.com/article/156-ai-import-updating-the-wrong-asset)). Greenline tuvo importaciones trabadas en "Processing" ([changelog](https://usegreenline.com/changelog)).
- **Validar distinto en la vista previa y al guardar.** En Wealthfolio había fechas que pasaban la revisión y fallaban al importar ([v3.6.0](https://github.com/afadil/wealthfolio/releases/tag/v3.6.0)). La solución es usar la misma función en los dos lados.
- **Rellenar huecos con un precio inventado.** Paisa usa el último precio de compra cuando no tiene cotización ([doc](https://github.com/ananthakumaran/paisa/blob/master/docs/reference/commodities.md)).
- **Porcentajes de éxito sin el método al lado.**
  - Con entradas parecidas, tres herramientas dieron 60%, 80% y 90% ([foro](https://www.bogleheads.org/forum/viewtopic.php?t=444911)).
  - Con el mismo retiro de 5,6%, otro caso dio 38%, 55,5% y 84,75% según la herramienta ([foro](https://www.early-retirement.org/goto/post?id=2082313)).
  - El borde de una banda no es un camino posible ([explicación](https://freedomisntfree.co.uk/tools/retirement-monte-carlo)).
  - Los sorteos independientes subestiman las rachas de crisis ([Actual](https://raw.githubusercontent.com/actualbudget/actual/master/packages/docs/docs/experimental/monte-carlo-analysis.md)). PR-7 lo declara al pie.
- **Supuestos nominales escondidos, escenarios que se pisan, valores solo por hover.** Las tres cosas pasaron en NewRetirement/Boldin ([foro](https://www.bogleheads.org/forum/viewtopic.php?t=434158)).
- **Alertas que no se apagan y rachas que castigan.** Una alerta de Wealthfolio imposible de sacar ([#740](https://github.com/afadil/wealthfolio/issues/740)). Pedidos de modo vacaciones en Loop ([#601](https://github.com/iSoron/uhabits/issues/601)).
- **Encierro de datos y funciones que pasan a pago.** Parqet no deja exportar en el plan básico ([review](https://www.broker-test.at/portfolio-software/parqet/)). En getquin, funciones gratuitas pasaron a pago ([Trustpilot](https://ca.trustpilot.com/review/getquin.com)). Un rediseño de Navexa sacó campos que los usuarios usaban ([Trustpilot](https://uk.trustpilot.com/review/navexa.com)).
- **Ruido y complejidad.** getquin tuvo que agregar un interruptor para apagar su feed social ([help](https://help.getquin.com/en/articles/14035486-deactivate-social-feed)). Snowball se percibe como complejo e inestable ([Trustpilot](https://nz.trustpilot.com/review/snowball-analytics.com?page=5)).
- **Documentación pobre y acciones escondidas.** ProjectionLab depende de Discord ([foro](https://www.bogleheads.org/forum/viewtopic.php?t=375804)). Un usuario de Ghostfolio se quejó de que no había "ninguna documentación" ([#3666](https://github.com/ghostfolio/ghostfolio/discussions/3666)). En Portfolio Performance hay "demasiadas acciones detrás del +" ([#1921](https://github.com/portfolio-performance/portfolio/issues/1921)).
- **Un beta único para una cartera mixta AR/US.** El autor de portfolio-analysis lo dejó afuera a propósito porque engaña ([repo](https://github.com/sebastianwaldman/portfolio-analysis)).

---

## 5. Lo distintivo: combinaciones que no vi juntas

Cada pieza por separado existe en algún lado. Lo distintivo es tenerlas juntas y atadas a tu caso. Todo es "en lo relevado", no una afirmación sobre el mercado entero.

1. **Doble moneda con desglose exacto, al CCL que tipeaste, con traza hasta el archivo.**
   - Ver ARS y USD a la vez ya existe: el reporte multi-moneda de Sharesight ([help](https://help.sharesight.com/multi-currency-valuation-report/)), la conversión de Fava ([options](https://github.com/beancount/fava/blob/main/src/fava/help/options.md)), Cocos-to-Spreadsheet ([repo](https://github.com/PabloAlaniz/Cocos-Capital-To-Google-Spreadsheet)) y evaluador-cedears ([repo](https://github.com/santiagomassieri1/evaluador-cedears)).
   - Un desglose exacto también existe, en Portfolio Performance ([Calculation](https://raw.githubusercontent.com/portfolio-performance/portfolio-help/master/docs/en/reference/view/reports/performance/calculation.md)).
   - Lo que no vi junto es el CCL elegido por vos, el efecto cambiario como línea propia que suma exacto, y cada número rastreable hasta la captura.
2. **Deuda fija en pesos como posición corta, con la licuación en dólares dentro del puente del patrimonio total.** Lo más parecido es el gráfico largo/corto de pyfolio ([plotting.py](https://raw.githubusercontent.com/quantopian/pyfolio/master/pyfolio/plotting.py)), que no tiene nada que ver con un leasing.
3. **Bonos en pesos leídos en dólares sobre tus tenencias:** CCL de empate, TEM neta y valor técnico CER. Comparatasas compara tasas de mercado ([lecaps](https://raw.githubusercontent.com/enzonotario/comparatasas.ar/main/app/pages/lecaps.vue)), pero no sigue tus tenencias.
4. **Capturas leídas con IA y verificadas con aritmética, doble lectura y aserciones.** Greenline, Kubera y getquin tienen un paso de revisión, pero no documentan un chequeo aritmético ([Greenline](https://usegreenline.com/support/importing-via-screenshot), [getquin](https://help.getquin.com/en/articles/12539493-ai-based-document-import)).
5. **Disciplina medida contra tu propia tesis.** Peso contra banda, tramos ejecutados contra decididos, invalidaciones que se movieron, y "nada que hacer" como resultado válido. Lo más cercano es la barra de precio límite de Portfolio Performance ([doc](https://github.com/portfolio-performance/portfolio-help/blob/master/docs/en/reference/view/securities/all-securities.md)).
6. **Dos benchmarks en la sombra con tus mismos flujos: SPY convertido al CCL de cada día y quedarse en LECAP.**
   - Benchmarks con componente cambiario ya existen: Sharesight ([benchmarking](https://help.sharesight.com/benchmarking/)) y Ghostfolio desde la 2.33.0 ([CHANGELOG](https://github.com/ghostfolio/ghostfolio/blob/main/CHANGELOG.md)).
   - Lo propio es el CCL de cada día y la vara en pesos.
7. **Cobertura de la cuota del leasing como hito, con una distribución de fechas.** Los hitos de ProjectionLab y el crossover de Actual existen ([Milestones](https://projectionlab.com/blog/milestones), [Crossover](https://actualbudget.org/docs/experimental/crossover-point-report)). Lo propio es aplicarlo a una cuota en pesos con opción de compra.

---

## 6. Cambios concretos propuestos

### 6.1 Decisiones nuevas (estado P, esperan tu confirmación)

**Orden de confirmación.**
1. D-35, D-36, D-37 y D-38, que bloquean la fase 1a.
2. D-46 y D-47.
3. El resto, en el orden de las fases.

**D-35 · Convención del desglose activo / tipo de cambio.** Completa D-05, D-18 y la invariante "activo + TC = total, exacto" de `calidad.md`. La moneda de riesgo (`activos.moneda_riesgo`) decide en qué vista aparece el efecto cambiario.
- **Activo con riesgo USD (CEDEAR, dólares) visto en pesos:**
  - TC = valor USD inicial × (CCL₁ − CCL₀)
  - activo = (valor USD final − valor USD inicial) × CCL₁

  Visto en dólares, todo es activo, incluida la brecha de CCL implícito.
- **Activo con riesgo ARS (LECAP, saldos, deuda) visto en dólares:**
  - TC = valor ARS final × (1/CCL₁ − 1/CCL₀)
  - activo = (valor ARS final − valor ARS inicial) ÷ CCL₀

  Visto en pesos, todo es activo. Aplicado al leasing con el signo opuesto, este término es la licuación.
- **Término cruzado:** queda dentro de "activo" en el primer caso y dentro de "TC" en el segundo. La función lo devuelve aparte, y la traza lo muestra como "de lo cual: interacción".
- **Flujos:** las operaciones y los movimientos del período se restan antes (D-06). Cada flujo se convierte al CCL de su propia fecha.
- **Varios días:** el reparto depende del camino. El efecto de un período es **la suma de los efectos de cada intervalo entre cargas consecutivas**, así que el mes de HO-1 es exactamente la suma de sus días.
- **Feriado en EE.UU.:** el subyacente no cotizó, así que el efecto activo de un CEDEAR es mayormente brecha de CCL implícito, y se rotula así.
- **Ejemplos (números inventados):**
  - CEDEAR de $1.000.000 con CCL 1.000. Sube 10% en pesos y el CCL pasa a 1.120: TC +$120.000, activo −$20.000, total +$100.000. En dólares: −US$ 17,86, todo activo.
  - LECAP de $1.000.000 que pasa a $1.025.000, con el mismo movimiento de CCL (1.000→1.120): activo +US$ 25,00, TC −US$ 109,82, total −US$ 84,82.
- **Por qué esta convención:** las partes suman exacto y es coherente con Portfolio Performance ([código](https://raw.githubusercontent.com/portfolio-performance/portfolio/master/name.abuchen.portfolio/src/name/abuchen/portfolio/snapshot/security/CapitalGainsCalculation.java), [manual](https://raw.githubusercontent.com/portfolio-performance/portfolio-help/master/docs/en/reference/view/reports/performance/calculation.md)).
  - Ahí el efecto cambiario de un título queda dentro de la ganancia de capital, en la columna "thereof foreign currency gains". El del efectivo se calcula como saldo × (1/tc₁ − 1/tc₀).
  - La diferencia está en la presentación: acá el efecto cambiario es una línea propia.
  - Se informan montos que suman; los porcentajes van aparte, porque los porcentajes por componente no suman ([Sharesight](https://help.sharesight.com/components-return/)).
- **Reemplaza** el desglose multiplicativo de tu skill `cartera-cedears`: "(1 + retorno USD) × (1 + ΔCCL) − 1" y "X puntos de la acción y X del CCL". Hasta que la skill use D-35 o lea de la app (DS-10), los dos van a dar números distintos para la misma posición.

**D-36 · Lectura de capturas.** Amplía D-11.
- **Antes de leer:** la identificación del banco va dentro de la llamada de extracción, y la lectura arranca al pegar, en paralelo con el tipeo.
- **Las lecturas:**
  - dos lecturas en paralelo, y la segunda distinta (otro recorte u otro modelo);
  - `null` con motivo antes que un número adivinado;
  - a lo sumo una relectura, solo si algo falla y sin pasar el total esperado;
  - sin herramientas de escritura.
- **Cuándo es `verificada`:**
  - Galicia: las lecturas coinciden y la aritmética cierra;
  - MP: las lecturas coinciden y el cambio es plausible (CA-4).
- **La imagen:** PNG sin recomprimir y `oversized_image: "error"`; tiras solo si da ese error.
- **Además:**
  - se extrae la fecha que muestre la captura;
  - presupuesto de p95 ≤ 15 s de pegar a bandeja lista, medido en el test end-to-end;
  - esquema zod nuevo para la lectura cruda (jsonb, no requiere migración);
  - las cajas por fila son opcionales y van después (CO-2).

**D-37 · Tolerancia según la precisión mostrada.** Reemplaza "tolerancia de redondeo" en D-11. Es medio último dígito de cada factor, propagado, y se guarda en la traza.
- En capturas, los decimales salen del texto.
- En el Excel de IEB, salen del `numFmt` de la celda. Si la celda está en formato General, se usa la regla documentada de /100 y el redondeo a centavos. El valor pasa a Decimal desde el texto formateado.

**D-38 · Aserciones de saldo.** Completa D-13 y D-15.
- Son controles: B2 y Subtotales de IEB, el total de Galicia cuando aparece y el resumen mensual.
- No lo son: el "Total" de Saldos y el saldo de MP, que son el hecho mismo. El de Saldos solo se re-chequea después de una edición.
- Los controles se vuelven a evaluar cuando cambia cualquier hecho anterior. Uno que falla va a Salud de datos, y "no verificable" nunca equivale a "OK".

**D-39 · Dos medidas de rendimiento.** Completa spec §9.
- TIR y TWR, cada una con su pregunta.
- En renta variable no se anualiza con menos de 365 días. En renta fija se muestran TEM y TEA realizadas junto al % simple.
- Si la TIR no tiene solución, "sin dato" con el motivo.

**D-40 · Benchmarks en la sombra.** Aplica D-07.
- **Sombra de cartera:** solo flujos externos de `movimientos_capital`, al `tc_aplicado` de cada uno.
- **Sombra por decisión:** cada compra emparejada con su venta.
- **SPY:** cierre ajustado (total return) pegado por vos, siempre la serie entera.
- **LECAP en la sombra:** una TEM de referencia pegada, con su fuente.
- Una fecha sin precio deja ese cálculo en "sin dato".

**D-41 · Salud de datos.** Una lista única con identificador estable, evidencia y acción. Los ítems se reconocen con un motivo que queda auditado, y pueden tener vencimiento.

**D-42 · Umbrales del dueño.**
- Los pesos objetivo y las bandas vienen de tu tesis (D-51): son tus valores, no una propuesta de la app.
- Las demás reglas arrancan vacías y no se evalúan hasta que les ponés un umbral (aplica D-07).

**D-43 · Escenarios anclados.** `fecha_ancla` por escenario y "Re-anclar". El plan contra la realidad se **recalcula** con semilla, supuestos y ancla, y no se guarda ningún resultado (D-23).

**D-44 · Lente "pesos de hoy" y comparación con base punteada.** Amplía D-08. Si la inflación del escenario está vacía, "ARS de hoy" es "sin dato".

**D-45 · Tres calendarios.** Completa D-16.
- **BYMA** (días de rueda) decide el "precio viejo".
- **Bancario** (BCRA) decide las liquidaciones y los rescates de FCI.
- **NYSE** decide cuándo cotizó el subyacente de un CEDEAR.

Las listas nacional y bancaria difieren. Por ejemplo, el 9/11/2026, "Visita del papa León XIV", figura en la nacional y no en la bancaria ([nacional](https://raw.githubusercontent.com/enzonotario/esjs-argentina-datos-api/main/datos/v1/feriados/2026/index.json), [bancaria](https://raw.githubusercontent.com/enzonotario/esjs-argentina-datos-api/main/datos/v1/feriados-bancarios/2026/index.json)). Qué lista sigue BYMA ese día no está verificado: hay que confirmarlo con el calendario de BYMA. Cada feriado se carga con su fuente.

**D-46 · FIMA es un FCI.**
- Es un activo `tipo = 'fci'`: la cantidad son cuotapartes y el precio es el VCP por cuotaparte (÷1000 si la fuente lo muestra así, CA-11).
- La suscripción es una compra y el rescate es una venta.
- Su rendimiento sale del VCP, no de una TNA.
- CA-4 no aplica: una diferencia de cuotapartes va por la conciliación de D-15.
- D-10 hoy no dice de dónde sale FIMA. Hay que definirlo; lo probable es la captura de Galicia.

**D-47 · Filas diferidas.** Una fila "dejada pendiente" no se graba, y su activo conserva la última cantidad y el último precio. La carga se guarda con `listado_completo = false` y la fila queda en `grabado` como pendiente. D-15 no interpreta su ausencia como venta, y Salud de datos la muestra hasta la próxima carga completa.

**D-48 · Pegar serie.**
- Las series que cargás vos entran por una sola herramienta periódica, fuera de los 60 s.
- Cada pegado es una carga `manual` con su fuente, y el texto queda en `lectura_cruda`.
- Una serie pegada solo completa fechas sin fila. Una fecha existente se corrige editándola, y la edición queda auditada.
- El cierre ajustado de SPY se reemplaza entero.

**D-49 · "Mes de cobertura de cuota".**
- **Lectura propuesta:** el primer mes en que el rendimiento pasivo de la cartera financiera cubre la cuota del leasing (PR-5).
- **La otra lectura** (cuántos meses de cuota cubre la liquidez) queda como regla de EX-3.

**D-50 · Acceso de solo lectura para máquinas (DS-10).**
- Un token separado de la cookie de D-21: con alcance, vencimiento y revocable.
- Límite de pedidos.
- Cada lectura queda auditada.

**D-51 · Tesis, tramos y objetivos.**
- Se importan de tu skill: pesos objetivo con banda y vigencia, tramos como rango en US$ del subyacente, invalidación por cierre o por evento, y objetivos.
- La fecha de los niveles importados se muestra como "declarada".
- Los niveles en US$ se comparan con el subyacente implícito al CCL tipeado, que se calcula y no se guarda, salvo que pegues cierres reales.
- Cambiar una invalidación pide un motivo.

**D-52 · Importación periódica de movimientos.** Las operaciones importadas de IEB completan precio, importe y costos de las que ya existen, mostrando el diff. El importe liquidado es el hecho. El resumen mensual es un control.

**D-53 · Jerarquía de Hoy.**
- **A primera vista:** la frase, las dos tarjetas de patrimonio, exposición neta y excedente en una línea, y Atención.
- **A un toque:** todo lo demás.
- **En el menú:** los modos calma y privado.

**Pendiente de tu decisión:** la marca del REM en los deslizantes (PR-15), que roza D-07 y D-08. Si no la aprobás, se descarta.

### 6.2 Ajustes a decisiones existentes

- **D-03:** se confirma tal cual. Hoy muestra el total y el financiero, cada uno en ARS y USD. El total incluye la casa y la parte del auto, marcada "sujeta a opción de compra". Monarch también deja los inmuebles afuera de su pronóstico por defecto ([help](https://help.monarch.com/hc/en-us/articles/48344305092244-Forecasting-in-Monarch)).
- **D-04:** se agrega una cadencia de revaluación por bien. Cuando vence, la valuación se pone gris y entra en Atención. Una valuación nueva va a la línea "Revaluación de bienes".
- **D-05:** un puente por vista (HO-2):
  - en el total, "amortización de capital" y "revaluación de bienes";
  - la licuación solo en la vista total en USD;
  - Cuadre definido como "variación del patrimonio − aportes netos";
  - períodos como suma de intervalos (D-35);
  - línea de capital aportado acumulado en Evolución.
- **D-06:** la pregunta "¿entró o salió plata?" sale de la TNA leída en la misma captura, o de la variación reciente de la cuenta. Nunca de una tasa que no existe en ninguna tabla.
- **D-10:** se agregan la importación periódica de movimientos (D-52) y la definición de la fuente de FIMA (D-46). Hay que medir si las capturas salen del teléfono (MO-6).
- **D-11:** ver D-36 y D-37.
- **D-12:** se prueba también ÷1000, y el divisor queda recordado por cuenta y activo. Si cambia, es una advertencia.
- **D-13:** estado "en tránsito" visible. La TNA y el tope que muestra la captura de MP se guardan como hecho. MP se verifica por doble lectura y plausibilidad.
- **D-14:** CCL de compra ponderado y declarado, con su fecha también declarada, y "pegar serie" para el CCL histórico.
- **D-15:** las filas diferidas no cuentan como venta (D-47). La operación faltante viene con el precio inferido del PPP y un tramo sugerido (CA-10).
- **D-16:** tres calendarios con fuente (D-45) y un botón "hoy no operó el mercado". En un feriado de EE.UU., la etiqueta es "mayormente brecha de CCL implícito".
- **D-17:** se guardan `sha256_archivo`, `parser_version` y `lote`. Deshacer revierte el lote entero. Se puede reprocesar con un diff previo.
- **D-18:** se registra qué CCL tipeaste, con el último como valor propuesto. Sin el subyacente, la etiqueta dice "activo (incluye brecha de CCL implícito)". Los niveles en US$ usan el subyacente implícito, calculado y no guardado.
- **D-24:** las pruebas de visión usan capturas sintéticas re-renderizadas, nunca capturas reales anonimizadas.
- **D-30:** todo hover tiene tap. Deslizar en la bandeja. El waterfall y el largo/corto se transforman debajo de 768 px. Hay una alternativa a Web Share Target para iOS.
- **D-31:**
  - `stackStrategy: 'all'` (o barras flotantes calculadas) para el waterfall de deltas y las bandas;
  - `NumericFormat` con eco del valor interpretado, sin cuentas dentro del campo;
  - `aria.enabled` y decal con el modo daltónico;
  - un vocabulario de íconos para los estados, separado de los colores de resultado.
- **Fuera de la app:** actualizar la skill `cartera-cedears` (§3, "Descomposición peso/dólar") para que use D-35, o para que lea el desglose de la app cuando exista DS-10.

### 6.3 Migraciones propuestas

Cada tabla nueva lleva RLS sin políticas, grants explícitos para `service_role` (D-33), trigger de auditoría, casos en `supabase/tests/` y tipos regenerados. Los montos nuevos excluyen `NaN` e `Infinity` (D-32).

| Cambio | Para qué | Fase |
|---|---|---|
| `cargas`: `parser_version text`, `lote uuid` | Reprocesar (CO-13) y deshacer el lote entero (CA-9). No se pueden reconstruir después | 1a |
| `cargas`: `sha256_archivo text` (índice no único), `fecha_en_captura date null`, `fuente text null` | Captura vieja o repetida (CA-5), origen de las series pegadas (CA-13) | 1b |
| `eventos`: `carga_id bigint null`; `tipo` suma `'nota'` | Nota del día (DS-6) y motivo al mover un nivel (DS-13) | 1a |
| `tipo_cambio`: `ccl_referencia text null` | Qué CCL tipeaste (EX-8). La pantalla propone el último | 1a |
| Nueva `controles_cuenta` (`fecha`, `cuenta_id`, `moneda`, `fuente_control` ∈ {ieb_b2, ieb_subtotal, ieb_saldos_total, galicia_total, resumen_mensual}, `seccion`, `valor_informado`, `carga_id`) | Aserciones y conciliación (CO-3, D-38). `ieb_saldos_total` sirve solo para re-chequear después de una edición. MP no tiene control | 1a |
| Nueva `alias_especie` (`cuenta_id`, `texto_crudo`, `activo_id`, `divisor_precio` ∈ {1, 100, 1000}, `vigente_desde`, `carga_id`) | Alias aprendidos (CA-6) y escala recordada (CA-11) | 1b |
| Nueva `condiciones_cuenta` (`cuenta_id`, `fecha`, `tna_anunciada`, `tope`, `carga_id`) | TNA anunciada contra cobrada (DS-5). Se recupera reprocesando si empieza más tarde | 1b |
| Nueva `avisos_reconocidos` (`huella` pk, `motivo` not null, `reconocido_en`, `vence`) | Salud de datos (CO-8, D-41) | 1b |
| Nueva `umbrales` (`regla` pk, `valor` numeric null, `unidad`, `actualizado_en`) | Reglas del dueño (EX-3, D-42) | 1b |
| Nueva `pesos_objetivo` (`activo_id`, `objetivo`, `banda_pp`, `vigente_desde`, `carga_id`; pk `activo_id` + `vigente_desde`) | Peso contra objetivo con tus bandas (EX-3, D-51) | 1b |
| `niveles`: `nivel_entrada_hasta numeric null` (tramo como rango), `invalidacion_evento text null`. Nueva `niveles_objetivo` (`activo_id`, `orden`, `nivel`, `referencia`, `fecha_definicion`, `creado_en`) | Importar la tesis (DS-11, D-51), objetivos en DS-3 y DS-4 | 1b |
| `bienes`: `cadencia_revaluacion_meses smallint null` | Valuación con vencimiento (CO-11) | 1b |
| `feriados`: el check de `mercado` pasa a {BYMA, BANCARIO, NYSE} (migrando AR→BYMA y US→NYSE), más `fuente text` y `carga_id bigint null` | Tres calendarios con fuente (D-45) | 1b |
| `flujos_bono`: `carga_id bigint null` | Origen del valor al vencimiento pegado (CA-13, EX-5) | 1b |
| `activos`: `plazo_rescate_dias smallint null` (FCI) | Disponible hoy, mañana o en N días (PR-13, D-46) | 2 |
| `operaciones`: `comprobante text null` (único por cuenta cuando existe), `iva_costos` y `derechos_mercado` (numeric ≥ 0) | Importación de movimientos (CA-14, D-52) y costos del año (EX-10) | 2 |
| `escenarios`: `fecha_ancla date not null` | Escenarios anclados (PR-8, D-43) | 3 |
| `indices.indice`: sumar `'spy_ajustado'` y `'tem_pesos_ref'` al check | SPY y LECAP en la sombra, pegados por vos (DS-2, DS-12, D-40) | 4 (se pueden pegar antes) |

Lo que no hace falta crear:
- una columna para el subyacente del CEDEAR, porque `activos.ticker_subyacente` ya existe;
- una columna para la hora en que anotaste un nivel, porque `niveles.creado_en` ya la registra (y `fecha_definicion` cubre los niveles declarados);
- una tabla para la nota del día, que va a `eventos`;
- un tipo de activo para FIMA, porque `activos.tipo = 'fci'` ya existe.