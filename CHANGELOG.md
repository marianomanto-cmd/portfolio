# Cambios

Todo cambio de la app se registra acá, el más nuevo primero. Cada entrada dice qué cambió y remite a la decisión (`docs/decisiones.md`) o a la sección del spec que lo motiva.

## [Sin publicar]

### 2026-10-19 — El puente de Evolución, en horizontal
Me avisaste que el gráfico «El puente: de dónde vino el cambio» estaba roto. Con pesos y dólares lado a lado, cada columna de la cascada tenía unos 45 px, y los rótulos ("Aportes", "Cuotas", "Sin atrib.") y los montos de arriba de cada barra se pisaban. Ahora la cascada es horizontal (D-169): un escalón por renglón, de arriba abajo, con su nombre a la izquierda y su monto a la derecha de la barra. Nada se pisa en ningún ancho. Los colores, el orden, tocar un escalón y la lista de abajo no cambian.

### 2026-10-16 — La plata que falta entre composiciones es un gasto
Lo pediste el 16/10 (D-168): si entre dos composiciones una cuenta tiene menos plata de la que explican los movimientos y las operaciones, y no se sabe adónde fue, la diferencia se carga como gasto, un retiro de esa cuenta con la fecha de la composición que la muestra. Lo que una captura no muestra queda con su último valor conocido (D-16). La plata que se fue a una tenencia que la app todavía no sigue (un fondo suscripto desde otra cuenta) es un retiro de esa cuenta, y cuando la tenencia aparece entra como apertura ("Ya la tenía"): plata de afuera, no ganancia. Lo que sobra no es gasto: es rendimiento si lo explica la TNA del saldo y, si no, un aporte. No cambia el código: es cómo se cargan tus composiciones (`docs/carga-diaria.md`, el manual §9).

### 2026-10-16 — Las tablas con la barra lateral abierta
Si abrís la barra lateral a mano (su botón, o Ajustes › Barra lateral), queda abierta en todos los anchos. Entre 768 y unos 1.000 px de ventana le saca 164 px a la pantalla, y a varias tablas no les entraba lo imprescindible: tenían scroll hacia el costado adentro, con la última columna afuera (D-30). Ahora cada tabla se fija cuánto lugar tiene (D-167):

- **Si lo imprescindible no entra, tarjetas:** las mismas del teléfono, una por fila y una con los totales, en el mismo orden y con sus trazas. Lo imprescindible son las columnas que se ven siempre, más el botón "⋯" si alguna queda afuera.
- **Si entra, la tabla de siempre:** en los anchos que ya andaban no cambia nada. Si colapsás la barra o agrandás la ventana, vuelve la tabla; si la abrís, vuelven las tarjetas.
- **Dónde pasaba**, a 768 px con la barra abierta (con los datos de ejemplo):
  - Posiciones;
  - Exposición: el estado de situación, que pasa a sus tarjetas que se pliegan (IEB ▸, Galicia ▸, Bienes ▸, como en el teléfono), y el comparativo;
  - Registro;
  - Evolución y PnL: el PnL por mes;
  - Pasivos: lo pagado y lo que falta, abiertos en sus partes;
  - Flujo y escenarios: proyectado contra real del mes.

  A 1024 px con la barra abierta, todas entran.
- **Fuera de las tablas, a 768 px con la barra abierta:**
  - **Cargar:** el botón de Guardar se salía por el borde derecho. Ahora no se achica: el tiempo activo de la izquierda baja de renglón.
  - **Datos › Catálogo:** la tabla se salía de su tarjeta y los botones "Editar" quedaban cortados. Con poco lugar van las tarjetas del teléfono, con "Editar" en cada una.
- **Pruebas:**
  - el test de layout recorre también 768 y 1024 px con la barra lateral abierta: todas las pantallas, con una captura de cada una;
  - una grilla en tarjetas no cuenta como "no se dibujó": sus tarjetas se revisan como el resto de la pantalla. Una que sigue en esqueleto después de 10 s, sí;
  - la cuenta de lo imprescindible es una función pura con test (`entraLoImprescindible`, en `src/components/grilla/columnas.ts`): los casos en el límite y 2.000 juegos de columnas y anchos al azar contra lo que elige la grilla;
  - las de interacción: el Registro pasa a tarjetas con la barra abierta y vuelve a ser una tabla al colapsarla; en Exposición, el estado de situación y el comparativo van en tarjetas y sus cifras abren la traza.
- **Por dentro:** la Grilla recibe `tarjetas` cuando las de la pantalla no son una por fila (el estado de situación). Sin migraciones.

### 2026-10-15 — Rediseño (15/10)
El diseño nuevo que pediste el 15/10 («nuevo diseño de app, implementalo»), con «usa Apache ECharts y AG Grid Community para tablas». Cambia cómo se ve la app y dónde está cada cosa, no lo que hace. Las decisiones son D-156 (navegación) y D-157 (sistema visual). Cada pantalla con diseño propio suma lo suyo en su subtítulo.

#### Base: navegación, sistema visual y componentes comunes
- **El menú, por pregunta** (D-156):
  - **Diario:** Hoy.
  - **Patrimonio:** Posiciones y Exposición.
  - **Resultados:** Evolución y PnL.
  - **Compromisos y futuro:** Pasivos y Flujo y escenarios.
  - **Al pie:** Registro, Datos, Ajustes y el Mapa de la app.

  **Cartera ahora se llama Posiciones**; la dirección sigue siendo `/cartera`.
- **El Balance pasa a Exposición:** `/patrimonio` te lleva a `/exposicion` con lo que traía en la dirección, y "Ver el balance", en Hoy, también.
- **Cargar ya no es una sección:**
  - es el botón fijo arriba a la derecha (tecla C), con el punto de "todavía no cargaste";
  - en el teléfono, el botón del centro de la barra de abajo.
- **Barra superior nueva:**
  - el nombre de la pantalla y para qué es;
  - el chip de los datos: "CARGA DE HOY · 09:41" o "ÚLTIMA CARGA · 14/10", con el CCL y el cripto, y un punto verde, o en oro si algo está para revisar. Tocalo y te muestra cada fuente, como antes;
  - el ojo del modo privado y Cargar.

  El tema ya no está en la barra: está en Ajustes.
- **En el teléfono, abajo: Hoy · Patrimonio · [Cargar] · Resultados · Más** (reemplaza D-151).
  - Patrimonio abre Posiciones, con la pestaña de Exposición arriba.
  - Más tiene Pasivos, Flujo y escenarios, Registro, Datos, Ajustes y el Mapa.
- **Mapa de la app** (`/mapa`): dónde está cada cosa, cómo se lee cada pantalla y qué quiere decir cada color.
- **El oscuro es el tema de la app** (D-157). El claro sigue, con las mismas reglas de color y contraste AA. En Ajustes › Tema: Oscuro, Claro o Sistema.
- **Colores con significado fijo:**
  - tinta para los pesos;
  - la pastilla dorada para los dólares, siempre;
  - sangría para la deuda, la pérdida y Cargar, siempre con signo;
  - verde para la ganancia, solo en resultados.

  Cada activo tiene su color, el mismo en todos los gráficos: dorados los que arriesgan dólares, piedra los de pesos, lavanda la liquidez. Las barras por moneda de riesgo de Exposición y del Balance van en oro (dólares) y piedra (pesos); antes eran azul y gris.
- **Tres fuentes:** Newsreader para la lectura de cada pantalla, Geist para la interfaz y JetBrains Mono para toda cifra. Vienen con la app, sin bajarse de la red.
- **La traza es una placa de vidrio** abajo a la derecha; en el teléfono, una hoja desde abajo.
  - Los insumos están a la vista: ya no hay que tocar "Ver insumos ▸".
  - Una cifra con traza tiene un subrayado punteado.
- **Gráficos** con el tema nuevo: grilla fina, ejes en mono, tooltip de vidrio y el color de cada activo.
- **Registro es una tabla** (la primera con AG Grid): un lote por fila, con su fecha, sus cargas, el tiempo activo y Revertir.
  - Se ordena por fecha o por tiempo activo y se recorre con el teclado: Enter entra a la celda y Escape vuelve.
  - Si una columna no entra en el ancho, el botón "⋯" de la fila la muestra.
  - Con el dedo (una tablet), el encabezado y cada fila miden 44 px.
  - En el teléfono sigue en tarjetas.
- **Registro, Datos, Ajustes, Cargar, la entrada, "No encontré esa página" y la pantalla de error** toman los colores y las fuentes nuevos, sin otros cambios. En Datos › Catálogo, el punto de cada activo es su color en los gráficos: el que elegiste o, si no elegiste, el de su familia (antes quedaba vacío).
- **Arreglos de ancho** (los encontró el test de layout entero, D-30, en anchos que no se habían probado):
  - **Registro, a 768 px:** la fecha, las cargas y el lote con "Revertir el lote" quedan a la vista, y el tiempo activo va al botón "⋯" de la fila. Antes el lote quedaba afuera y la grilla tenía scroll hacia el costado. Cambian los anchos mínimos de las columnas, no lo que muestran: el tiempo activo sigue a la vista desde el mismo ancho que antes (unos 925 px de ventana).
  - **Datos › Catálogo, entre 768 y 1023 px:** el nombre de un activo baja de renglón si no entra. En un solo renglón, el nombre más largo sacaba la tabla de su tarjeta (7 px, con los datos de ejemplo).
- **Para quien construye pantallas:**
  - componentes comunes con su uso escrito arriba de cada uno: `Encabezado` (la pregunta y la lectura), `CifraClave`, `Tarjeta`, `Rotulo`, `Boton`, `Badge` y la `Grilla` (AG Grid Community 36.2.0, la única forma de dibujar una tabla);
  - las funciones puras de la lectura, la paleta y el chip, con test.
- **Pruebas:**
  - el test de layout elige el tema como lo elegís vos, desde Ajustes;
  - también falla si una grilla tiene scroll horizontal adentro;
  - antes de revisar las grillas espera, hasta 10 s, a que estén todas dibujadas: con varias en la pantalla y la máquina cargada, alguna seguía en esqueleto y se leía "no se dibujó" (pasó una vez en Evolución a 2560 px). Una que no se dibuja en ese tiempo sigue fallando;
  - recorre `/mapa`;
  - las de interacción prueban la barra de abajo, la hoja "Más", Cargar y su tecla, el Mapa, la redirección de `/patrimonio` y la grilla del Registro con la CSP de producción.
- **Dependencias** (versiones exactas): `ag-grid-community` y `ag-grid-react` 36.2.0, `@fontsource-variable/newsreader` y `@fontsource-variable/jetbrains-mono` 5.3.0.

#### Hoy
- **Se lee como toda pantalla** (D-157, D-160): la pregunta con la fecha ("Jueves 15 de octubre · ¿Cómo estoy hoy?") y, en serif, la respuesta: qué le pasó a lo invertible desde la carga anterior, en pesos y en dólares, y de dónde vino ("Ayer sumaste $ 590.125, pero perdiste US$ 340: subió el *dólar*."). Cada cifra se toca y muestra su cálculo. Si a la variación le falta una partida, lo dice con palabras ("falta …"), sin cifras.
- **El patrimonio neto**, a la derecha: el total de siempre (D-03), en pesos y en dólares, cada uno con su variación (monto y %). Debajo, de qué está hecho: **Financiero · Bienes · Pasivos**, que suman el neto (D-160). Reemplaza a las dos tarjetas de antes (financiero y total). Si le falta una parte, "sin dato" y la suma parcial, como antes (D-65).
- **Segunda fila, tres tarjetas:**
  - **Variación del día · de dónde vino:** la barra de lo que pusieron tus activos (tinta) y el CCL (oro), cada parte en pesos y en dólares, y cuánto se movió el CCL ("Del CCL (+1,08%)"). Es el desglose que antes iba debajo del financiero.
  - **Exposición neta al peso:** el neto en pesos y en dólares, lo que netea con sus dos partes ("pesos financieros − deuda del leasing ($ 54,2 M − $ 21,4 M)"), la barra con el eje al medio (corto a la izquierda, en sangría; largo a la derecha) y la sensibilidad a una suba del 1% del CCL.
  - **Excedente invertible · octubre:** la misma cifra que arriba de Flujo, con la barra de gastos fijos, cuota y lo que sobra, y si es proyectado o real.
- **Tercera fila:**
  - **Patrimonio neto · 12 meses:** dos gráficos chicos con las mismas fechas, en dólares y en pesos, un punto por carga (un día sin dato es un hueco, nunca un punto inventado), con cuánto cambió cada uno y por qué difieren: el CCL. Mientras no haya 12 meses de historia, dice desde cuándo ("desde el jue 01/10"). "Ver como tabla" muestra los números. El modo privado tapa los montos del gráfico y de la tabla.
  - **Próximos 30 días:** lo que pasa con fecha, en orden: "Todavía no cargaste hoy" (después del cierre de BYMA), las cuotas del leasing (quién la paga; una vencida que tu planilla no marca pagada, en sangría), lo que cobrás de tus bonos y letras (a menos de 15 días, en sangría) y el cierre del mes, con **Cargar ingreso** y **Cargar gasto**. Cada monto, en pesos y en dólares. Debajo, **Atención**, de lo más grave a lo más leve.
- **Cuarta fila, Qué tenés y qué debés:** activos (un tramo por activo, en su color, con el ticker adentro si entra; la liquidez junta; la casa y la camioneta), pasivos (el leasing) y el neto, a la misma escala, con los totales en pesos y en dólares.
- **Abajo, el detalle:** la frase del día completa (con su hoja cifra por cifra en el teléfono), "Quién movió tu financiero" y el cuadre, como antes.
- **Nada se perdió:** "Ver la evolución y el PnL" ahora es "Ver resultados" (en el gráfico); "Ver el balance", "Ver exposición" y "Ver posiciones"; Atención está en Próximos 30 días y, en el teléfono, en su renglón.
- **En el teléfono** (el diseño no lo dibuja): arriba del pliegue, la lectura, el patrimonio neto y el financiero en una tarjeta de cuatro renglones de 44 px, la exposición en un renglón, Atención y "Todavía no cargaste hoy". Después, las tarjetas una debajo de otra.
- **Para quien construye:** las cuentas nuevas son funciones puras con test: `src/lib/vistas/armar-hoy.ts` (activos y pasivos, el CCL del período, la serie de 12 meses y Próximos 30 días) y, en `src/components/hoy/`, la lectura, los números en palabras, las barras y la opción del gráfico.
- **Pruebas:** unitarias de cada función nueva y de la página entera renderizada en el servidor; las de interacción, con la anatomía nueva (lo que tiene que entrar arriba del pliegue, la traza desde la tarjeta del patrimonio).

#### Posiciones
- **Se lee como toda pantalla** (D-157, D-161): la pregunta ("Patrimonio · ¿Qué tengo y cómo le va a cada cosa?") y la lectura: cuántas posiciones tenés y cuál explica más de lo que ganaste, o perdiste, en pesos ("Seis posiciones. SPY explica casi *tres cuartos* de lo que ganaste en pesos."). Si al resultado le falta una fila, dice cuál.
- **Cuatro cifras clave:** el valor de la cartera, el resultado total (si al de dólares le faltan filas, "sin dato" y la suma parcial: "En dólares, suma parcial (3 de 6): +US$ 1.630"), la mejor (por su resultado en pesos) y la peor en dólares, cada una con su % en la otra moneda.
- **La tabla es una grilla** (AG Grid): Activo · Cantidad · PPC ARS · PPC USD · Precio · Valor · Result. ARS · Result. USD · Activo · TC · % cartera · Días.
  - **Activo · TC** es una barra: el resultado en pesos, partido en lo que hizo el activo (tinta, o sangría si restó) y lo que hizo el tipo de cambio (oro). Su traza tiene el desglose en pesos y en dólares. Reemplaza a las dos columnas de desglose.
  - **% cartera** (antes "% fin.") lleva una mini barra en el color del activo.
  - **Días** dice «ap.» (desde la apertura en la app) o «decl.» (desde la fecha que declaraste).
  - Un **precio viejo** se dice en la fila: "precio de hace 7 días" (D-16).
  - A 1440 px entran las once columnas. Lo que no entra en el ancho va a "⋯", al final de cada fila (antes, el chevron ›).
- **La liquidez va en la misma tabla, al pie** ("Pesos" y "Dólares", con su cuenta): no tiene costo ni resultado, así que esas celdas dicen "—" (no aplica), que no es "sin dato".
- **Totales fijos abajo**, de lo que está a la vista; con un filtro, "Total · lo filtrado". Si a una columna le falta una fila: "sin dato" y debajo la suma parcial con ¹, y la leyenda dice qué filas faltan (D-65).
- **Lo pendiente de cada fila, debajo de la tabla:** lo que antes estaba en el detalle de la fila (una apertura sin CCL de compra, una compra con precio pendiente, una tenencia que la fuente ya no lista y lo que quedó sin atribuir hoy, con su monto), agrupado: "YPFD, FIMA y TXMJ0: Falta el CCL de compra de la apertura…".
- **Ordenar:** tocás el encabezado; los números van de mayor a menor al primer toque, y "sin dato" y la liquidez, siempre al final. Los filtros son los de siempre.
- **En el teléfono**, una tarjeta por fila, como antes, con "Más datos" (precio, cantidad, PPC, días y la barra Activo · TC) y una al final con los totales.
- **Con el dedo** (una tablet), las filas miden 100 px: cada cifra es un tocable de 44 px y las celdas llevan dos, una arriba de la otra (D-100).
- **Arreglo en la grilla común:** el ancho para columnas descuenta el borde de la grilla (1 px de cada lado). Unas columnas que sumaban justo el ancho del contenedor dejaban 2 px de scroll horizontal adentro (Posiciones a 1024 px).
- **Para quien construye:** las cuentas de la tabla (`src/components/cartera/cuentas.ts`) y la lectura (`lectura.ts`) son funciones puras con test.
- **Pruebas:** unitarias de cada cuenta, de las celdas de cada columna y de la página; las de interacción, con la grilla: ordenar y filtrar, el panel de la traza junto al borde derecho y las columnas que entran a 1440 y a 1280 px.

#### Exposición
Exposición toma la anatomía del diseño y recibe el Balance (D-156, D-158):

- **La pregunta y la lectura:** "Patrimonio · ¿Cuánto estoy jugado al peso?" y una frase con un solo énfasis: "Tenés más pesos de los que debés: estás *largo* en pesos por $ …" (o *corto*). Si falta la deuda del leasing, dice que falta cargarla; en la vista Total, mientras tus bienes no tengan moneda de riesgo, que el neto todavía no se calcula. La cifra abre su traza.
- **Financiero · Total**, arriba a la derecha, en la pastilla del diseño, con lo que netea cada vista escrito debajo (D-101).
- **Largo y corto · en pesos de hoy:** barras divergentes con un solo cero (en el 40% del ancho, como en el diseño) y una sola escala para los cuatro renglones: activos en pesos (cada título por su ticker y la liquidez junta, "LIQ"), pasivos en pesos (el leasing, hacia la izquierda), el neto (LARGO o CORTO) y activos en dólares. En la vista Total, tus bienes en su renglón, "sin moneda elegida". Cada renglón en pesos y en dólares, y cada cifra abre su traza.
- **Exposición neta al peso · 12 meses** (o desde tu primera carga): tu neto en cada carga, con la línea punteada del neutral (arriba, largo; abajo, corto) y, debajo, de dónde a dónde fue. Sin montos en el eje, como en el diseño: están en el tooltip y en la tabla del gráfico, en pesos y en dólares al CCL de cada día.
- **Apertura de activos** por clase y por geografía, en barras al 100%, y la **concentración**: TOP 1 y TOP 3 sobre tu patrimonio financiero, con sus nombres.
- **El detalle: tu exposición:** lo que la pantalla tenía, con el estilo nuevo: la frase con la sensibilidad al CCL, la concentración con el neto sobre tus activos y la composición por clase, por moneda de riesgo y por geografía, con lo que vale cada parte.
- **El detalle: tu balance:** todo el Balance (`/patrimonio` te trae acá): la fecha, "Ver por", la frase, la cifra grande, el activo y el pasivo, **el estado de situación y el comparativo en la Grilla** (desde 768 px; en el teléfono, tarjetas), los indicadores, la composición y la evolución. Lo de arriba es siempre de hoy; si el balance es de otra fecha, lo dice. **Imprimir** saca solo el balance, en A4, como antes.
- **Lo que elegís no se pisa:** cambiar qué netea conserva la fecha, el agrupamiento y la comparación del balance, y al revés. Todo queda en la dirección.
- Toda cifra en pesos y en dólares, con su traza. El modo privado tapa los montos, también en los gráficos, y deja los porcentajes.
- **El rótulo adentro de cada tramo** (el ticker, "LIQ", el % de la apertura) va en la tinta que se lee sobre su color, con contraste AA: casi negra sobre los colores claros y clara sobre los oscuros (un bien "sin moneda elegida", un bono de color oscuro).
- **Arreglo en la Grilla (común):** apretar una cifra de una fila que asoma por abajo de la pantalla no abría su traza: la grilla le daba el foco a la celda, la página subía entre el apretar y el soltar y el clic se perdía. Ahora el clic en una cifra (o en un botón) de la celda lo maneja la cifra; el teclado sigue igual.
- **Arreglos de ancho** (los encontró el test de layout entero, D-30, en anchos que no se habían probado):
  - **A 768 px, el comparativo del balance entra entero:** el renglón, las dos fechas y la diferencia, sin scroll hacia el costado adentro de la grilla. Antes, la diferencia quedaba afuera. Lo que cambia es el ancho mínimo del renglón (175 px en lugar de 200), que sigue llevándose lo que sobra; las cifras conservan el suyo. Si al lado del nombre no entra el chip ("estimado"), el chip baja de renglón.
  - **Con el dedo** (una tablet, a 768 y a 1024 px), las filas del comparativo miden 100 px: cada celda lleva dos cifras, los pesos arriba y los dólares abajo, y cada una es un tocable de 44 px (D-100). Antes, la de abajo se pisaba con la de arriba de la fila siguiente.
- **Por dentro:**
  - `src/lib/vistas/armar-exposicion.ts`: las barras por activo, el neto de cada carga en dólares y las posiciones más grandes. Agrupa las partidas de la foto, cada una con su traza, sin calcular nada nuevo;
  - las funciones de la pantalla en `exposicion/_lib/` (lectura, largo y corto, apertura, neto en el tiempo, filas del estado de situación), puras y con test;
  - el modo demo arma la Exposición y su balance con los mismos hechos de cada estado (`?demo=…`): el neto de arriba y el balance de abajo usan la misma deuda;
  - el componente común `Segmentado`, la pastilla del diseño (`src/components/pantalla/segmentado.tsx`), que también usa Evolución;
  - sin migraciones.
- **Pruebas:** `tests/e2e/exposicion.spec.ts` (nueva: el cero común, las trazas del gráfico y del TOP, qué netea con el balance y `/patrimonio`), `balance.spec.ts` sobre `/exposicion` (también la impresión, que deja afuera lo de arriba) y los estados del balance en el test de layout. El test de layout ya no toma por "texto cortado" el texto solo para el lector de pantalla (`.sr-only`) adentro de un link o un botón (`tests/e2e/ayudas.ts`, común).

#### Evolución y PnL
Evolución y PnL toma la anatomía del diseño (D-159):

- **La pregunta y la lectura:** "Resultados · ¿Gané o perdí, y por qué?" y una frase con un solo énfasis: cuánto ganaste o perdiste en el período, en pesos y en dólares, y quién puso la mayor parte, el dólar o tus activos. Si ganaste en pesos y perdiste en dólares, eso es lo que dice primero. Con un solo día, que tu historia empieza ese día.
- **Arriba a la derecha:** qué mirás (Financiero · Total) y **el período en la pastilla 1M · 3M · YTD · 12M · INICIO**, con su nombre y sus fechas debajo ("Los últimos 3 meses · del … al …"). **Otro período** trae la última semana y "Elegir fechas" (en el teléfono, en una hoja desde abajo). **YTD** (desde tu última carga del año anterior) y **12M** son nuevos; como siempre, el período arranca en una fecha con carga.
- **Cuatro cifras clave:** el resultado en pesos y en dólares (con su porcentaje sobre lo que tenías al empezar), lo que pusieron tus activos y lo que puso el tipo de cambio (en oro, con lo que se movió el CCL en el período). Cada una abre su traza; si falta un dato, dice cuál.
- **Composición en dólares · área apilada:** lo que vale cada clase en cada carga del período, con tu patrimonio rayado encima. En Total suma tus bienes; las deudas las resta la línea.
- **Resultado en pesos · activo vs. TC:** por partida, lo que hizo el activo (tinta, o sangría si perdió) y lo que hizo el CCL (oro), con un solo cero y, en gris, lo que todavía no se puede separar.
- **El detalle: tu PnL:** todo lo que la pantalla tenía, con el estilo nuevo y la moneda (Pesos · Dólares · Ambas) en su encabezado: la frase del período, el puente, quién sumó y quién restó, **los resultados por activo y cuenta, el PnL por mes, el día cero y el futuro en la Grilla** (se ordenan tocando el título de la columna; en el teléfono, tarjetas), el patrimonio en el tiempo, el estado de resultados y la sensibilidad. Cada columna de montos mide lo que pide su cifra más larga (con su signo, su flecha y la pastilla): ninguna se sale de su celda.
- Lo que elegís sigue en la dirección, y el último período queda recordado en el dispositivo (HO-7), también YTD y 12M.
- **Por dentro:** `armar-evolucion.ts` suma YTD y 12M, el CCL al inicio del período y la composición en dólares (estricta: si a una clase le falta el dólar, "sin dato"); la lectura, las cifras clave y las barras de activo vs. TC son funciones puras con test (`evolucion/_lib/`). Sin migraciones.
- **Pruebas:** `tests/e2e/evolucion.spec.ts` prueba la pastilla y "Otro período" (también en el teléfono), las cuatro cifras clave, el resultado por partida y la Grilla; el test de layout recorre 12M y YTD.
- **Arreglos de ancho** (el test de layout completo, D-30, fallaba a 360 y a 768 px, y con el dedo a 768 y a 1024):
  - **360 px:** el período con sus fechas y "Otro período" no entraban en un renglón: estiraban la página (scroll hacia el costado) y la barra de abajo quedaba afuera. En el teléfono, "Otro período" va en su renglón, debajo de las fechas.
  - **El PnL por mes a 768 px** tenía scroll hacia el costado, con el botón "⋯" afuera. Ahora el mes, lo que pusieron tus activos y lo que puso el dólar se ven siempre; el lugar que queda es primero para "sin atribuir" y después para aportes y retiros, cuotas y amortización, y lo que no entra va al "⋯" de cada fila (D-159). Cada columna mide lo que pide su cifra más larga o su título (antes, 150 px fijos, que no alcanzaban para "Cuotas del leasing").
  - **Títulos enteros:** con una sola moneda, "Por el precio" (resultados por activo y cuenta) y "Lo que ya traías" (día cero) ya no se cortan con "…".
  - **Con el dedo** (una tablet) **y las dos monedas**, las filas de las cuatro tablas miden 100 px, como en Posiciones y Pasivos: cada cifra es un tocable de 44 px, y las dos de cada celda pisaban las de la fila de arriba y la de abajo (D-100).
  - **Por dentro:** las medidas son funciones puras con test (`evolucion/_lib/anchos.ts`: el ancho de un título, las columnas del PnL por mes y el alto de las filas). Lo común no cambia.

#### Pasivos
Pasivos toma la anatomía del diseño (D-162, D-163):

- **La pregunta y la lectura:** "Compromisos · ¿Cuánto me falta pagar?" y una frase con un solo énfasis: cuántas cuotas pagaste de cuántas y, después, lo que corresponda primero: una cuota vencida que tu planilla no marca pagada, cómo cambió la cuota en dólares ("Cada una te costó *menos* dólares que la anterior", solo con el CCL de cada pago) o cuántas te faltan y hasta cuándo. Sin cuadro de marcha, dice que falta importarlo.
- **La tira de cuotas:** una celda por cuota del contrato (35: sale del contrato y del cuadro de marcha, nunca es fija). Las pagadas van en tinta, la próxima en sangría con su brillo y las que faltan en hueco; arriba, el leasing y la próxima ("Próxima: cuota 15 · 1 de noviembre"). Una cuota vencida que tu planilla no marca pagada y una que el cuadro no trae se distinguen, y lo dice una nota. Con el mouse encima, cada celda dice qué cuota es y cuándo vence.
- **Cuatro cifras debajo de la tira,** cada una en pesos y en dólares, con su traza y su chip:
  - **saldo de capital:** la deuda que cuenta en toda la app (la informada por la leasera; si no, la según el cuadro; si no, la estimada), en sangría clara;
  - **pagado:** en dólares, al CCL de cada pago;
  - **falta:** nominal, sin la opción; en dólares, al CCL de hoy;
  - **opción de compra:** con IVA, al final del contrato.
- **La cuota en pesos y en dólares:** una línea por moneda, cada una con su eje: los pesos en tinta; los dólares en oro, sólida hasta hoy (al CCL de cada pago) y punteada después (al CCL de hoy: una referencia, no una proyección del dólar, D-163). Lo pasado lleva un tinte y la línea de hoy va en sangría. Una cuota pagada sin el CCL de su pago es un hueco, nunca un cero.
- **Cuadro de marcha · próximas:** las seis próximas cuotas en la Grilla (N° · Fecha · ARS · USD), adentro de la tarjeta, como en el diseño, con el CCL con que se pasan a dólares. En el teléfono, una tarjeta por cuota.
- **El detalle: tu leasing**, con el CCL de los dólares arriba a la derecha. Es todo lo que la pantalla tenía, con el estilo nuevo:
  - la deuda con su origen, la tasa del contrato y el costo contra el bien;
  - **el cuadro de marcha entero, ahora en la Grilla:** por pagar, pagadas o todas, y cada cuota como la factura o abierta en amortización y gasto. La opción de compra va aparte, y en el teléfono sigue en tarjetas;
  - cada cuota abierta, en barras (el eje, compacto como el de la cuota: "$ 900k", ya no "$ 900,0k") y en la tabla de lo pagado y lo que falta por parte (también en la Grilla);
  - los totales, el recupero fiscal y el dólar, el leasing en palabras (con su hoja cifra por cifra en el teléfono), el contrato, quién paga la cuota y si la empresa te reintegra el IVA.
- **Con el dedo** (una tablet), las filas de las tres tablas crecen para que cada cifra sea un tocable de 44 px sin pisar la de abajo (D-100): 48 px en las próximas, 72 en el cuadro de marcha y 100 en lo pagado y lo que falta, que lleva dos cifras por celda.
- **Nada se perdió:** las cuatro tarjetas de antes (cuotas pagadas, la próxima cuota, lo que falta y el costo contra el bien) quedan en la tira, las cuatro cifras, las próximas y "Costo total contra el bien"; la frase pasa a "El leasing en palabras" y el CCL de arriba, al encabezado del detalle.
- **Por dentro:** la lectura, la tira, las cuatro cifras, las notas y las opciones de los gráficos son funciones puras con test (`pasivos/_lib/pantalla.ts` y `graficos.ts`). La página tiene su prueba renderizada en el servidor. Ni la vista (`armar-pasivos.ts`) ni la base cambian, y no hay migraciones. La Grilla común tampoco cambia: la tabla de las próximas pierde su marco con variables del tema de AG Grid puestas desde la pantalla.
- **Pruebas:** `tests/e2e/pasivos.spec.ts` prueba la anatomía (la lectura, la tira de 35, las cuatro cifras, el gráfico y las próximas en la Grilla), el cuadro entero en la Grilla con sus filtros y, a 1440 px, las medidas del diseño: la tira y las cifras arriba del pliegue, la fila del medio a 1,4 : 1 y del mismo alto, y las próximas sin marco propio. Siguen las trazas, el "sin dato" que nunca es $ 0,00, el teléfono y el modo privado.

#### Flujo y escenarios
Flujo y escenarios toma la anatomía del diseño (D-164 a D-166):

- **La pregunta y la lectura:** "Futuro · ¿Cuánto me sobra y adónde me lleva?" y una frase con cuánto te sobra este mes y adónde llegás con el escenario elegido (con números inventados: "Este mes te sobran $ 2.916.600. Con todo igual, en un año llegás a *US$ 94.167* en lo financiero."). Cada cifra abre su traza. Si falta un dato, lo dice con palabras.
- **Los gráficos se ven al abrir** (lo pediste el 15/10: «en flujos y escenarios quiero ver graficos»): todo arranca en Igual, como en tu última carga, y a 12 meses (D-164, revisa D-145). Ya no hay que tocar "Completar lo que falta con Igual".
- **La cascada del mes:** Ingresos USD × cripto → Pesos fijos → Gastos fijos → Cuota leasing → Excedente. El monto va arriba de cada barra ("4,83 M") y el nombre abajo, que abre su cuenta. Sale de lo declarado y de tu última carga: no depende de tus supuestos.
- **El patrimonio en dólares**, con la pastilla de escenarios (Igual y tus guardados): la línea del escenario, "Todo igual" de referencia y lo que pusiste. Abajo, el financiero al horizonte, el rango p5 – p95 ("sin dato · llega con Monte Carlo") y "¿terminás debajo de lo que pusiste?" en lugar de la probabilidad: sin Monte Carlo no se inventan percentiles (D-165).
- **Una barra por variable** («y seleccionar los valores de las variables con barras»): de Baja a Sube con Igual en el medio, el número a la vista, − y + de a 0,1 y "Volver a Igual" de un toque. Al moverla, la lectura y el patrimonio en dólares cambian en vivo; el detalle de abajo se pone al día cuando la soltás.
- **El detalle**, con el estilo nuevo: la proyección mes a mes (la grilla, en pesos o en dólares, y sus dos gráficos), tus escenarios guardados, el mes en curso, el calendario, proyectado contra real, lo que cargaste y tus ingresos y gastos declarados.
- **Cargar ingreso y Cargar gasto** pasan al mes en curso ("Octubre, con los datos de hoy"), junto con la fecha de tu carga, el CCL y el cripto con que se armó (D-166). `/flujo/cargar` toma la anatomía: la pregunta, "Cargar *ingreso*", la pastilla Ingreso · Gasto y las opciones en pastillas.
- **El modo privado** tapa todos los montos, también la línea de con qué CCL se armó el mes (antes se leía).
- **Arreglos:**
  - "Ver como tabla" de la cascada ya no se pisa con los nombres de los pasos;
  - los extremos de cada barra ("Baja −15", "Sube +15") llegan a AA en el oscuro;
  - mover una barra no redibuja el panel entero ni rehace el gráfico, y el detalle de abajo no se dibuja mientras la barra se mueve: la lectura y el patrimonio en dólares la siguen en menos de 200 ms con la CPU × 4 (antes, entre 380 y 660 ms en el e2e);
  - comparar escenarios abre la traza de cada uno con sus supuestos tal como se proyectan (antes, los de antes del arranque en Igual).
- **Gráfico (común):** dos props opcionales. `fusionar`: una opción nueva se fusiona con la anterior (solo cambian las series). `pie`: una leyenda corta en el renglón de "Ver como tabla". Sin ellas, todo queda como antes.
- **Por dentro:** la cascada (`flujo/_lib/cascada.ts`, con test propio), la lectura y las opciones de los gráficos (`flujo/_lib/`), la barra y el arranque en Igual (`lib/domain/flujo/panel.ts` y `supuestos.ts`), todas funciones puras con test. Sin migraciones.
- **Pruebas:** `tests/e2e/flujo.spec.ts` prueba que los gráficos se ven al abrir, la barra (teclado, +, la lectura en vivo, recargar y Volver a Igual), la pastilla de escenarios, los 44 px, el rendimiento y el modo privado (también con escenarios guardados).

### 2026-10-15 — Entrega 4: Balance, Evolución y PnL, Pasivos, Flujo y escenarios
Lo que pediste el 14/10: tu estado de situación patrimonial con la casa, el resultado del período, el leasing cuota por cuota y el flujo de fondos proyectado con escenarios, conectados entre sí y con Hoy. Las decisiones de esta entrega son la revisión de D-131 y D-132 a D-155, todas provisorias (`docs/decisiones.md`).

#### Integración
- **Datos › Leasing** muestra como deuda cargada la última informada por la leasera aunque haya un estimado posterior, como el resto de la app.
- **Una sola deuda del leasing en toda la app** (D-131, revisión): la que informe la leasera › la **según el cuadro de marcha** (a la tasa del contrato: baja con cada cuota que pagás) › la estimada que aprobaste. Hoy, Exposición, Evolución, el Balance, Pasivos y Flujo restan la misma, con el chip "estimado" mientras la leasera no la informe. Antes, con el cuadro cargado, Pasivos decía la según cuadro y el resto la estimada del 08/10, que no bajaba con las cuotas.
- **Hoy:** la tarjeta del **excedente del mes** (ingresos − gastos fijos − la cuota que pagás vos, en pesos y en dólares, con su traza; la misma cifra que arriba de Flujo), con "Ver el flujo y los escenarios", **Cargar ingreso** y **Cargar gasto**; en Atención, la cuota del leasing que vence en 10 días (o que ya venció) y lo que vence de tus bonos y letras; en la compu, "Ver la evolución y el PnL" y "Ver el balance" debajo de las tarjetas. Si Flujo o Pasivos no se pueden leer, Hoy sigue y el excedente dice por qué es "sin dato".
- **Navegación:** Patrimonio suma Balance y Evolución y PnL; el grupo nuevo Contexto, Pasivos y Flujo y escenarios. En el teléfono, abajo: Hoy · Balance · Cargar · Evolución · Más (D-151).
- **Cargar** ofrece "¿Te entró plata o pagaste algo grande? Cargar ingreso · Cargar gasto".
- **Registro:** el cuadro de marcha es "Leasing" ("cuadro de marcha de … · 35 cuotas · N cargos extra") y Cargar ingreso es "Flujo" ("ingreso mensual · aporte a …"); antes los dos decían "Tipo de cambio".
- **Balance, Flujo y Evolución leen el leasing de Pasivos:** la deuda según el cuadro y lo que falta pagar (Balance), la amortización de cada cuota (Flujo: el neto con la camioneta deja de ser sin dato) y las cuotas que pagás vos con su apertura, lo cargado con Cargar ingreso, lo declarado y el escenario elegido o el último guardado (Evolución).
- **Un escenario guardado sigue en su mes:** sus meses ("desde el mes N") se cuentan desde la carga con que lo armaste y se corren solos con cada carga nueva, así el cambio de ingreso de feb-2027 sigue en feb-2027 (antes se corría un mes por cada mes nuevo) (D-148).
- **Hoy:** la nota del patrimonio total dice "su valor − la deuda del leasing" (decía "capital pendiente").
- **Evolución, con el ingreso del mes cargado en una moneda,** usa lo cargado en esa moneda y lo declarado en la otra, como Flujo y Hoy (cargar los dólares borraba el ingreso en pesos declarado).
- **Evolución, si la cuota la paga la empresa,** pone el costo del leasing en $ 0 y lo dice; si no dijiste quién la paga, la toma como tuya, como Flujo y Hoy (antes dejaba afuera esas cuotas y decía "falta el cuadro de marcha" con el cuadro importado).
- **El cuadro de marcha se revierte de lo más nuevo a lo más viejo:** Deshacer o revertir desde Registro una planilla, un pago o un cargo con otra carga posterior del mismo leasing se frena y dice cuál revertir primero, como las cargas de una cuenta. Antes dejaba el cuadro a medias (una cuota sola, o el pago de una cuota que seguía contando después de revertirlo).
- **Los cargos extra del leasing se debitan con su cuota** en Pasivos, Evolución y Flujo, con una sola regla (`src/lib/domain/pasivos/cargos.ts`): el de su número de cuota y, uno que no dice cuota, con la que vence en el mes de su fecha. Antes Flujo y Hoy no los restaban del excedente y Evolución perdía los que no decían cuota.
- **El excedente del mes (Hoy y "Este mes" de Flujo) suma el reintegro del IVA** cuando declaraste en Pasivos que la empresa te lo reintegra, como la proyección (antes el mismo mes daba otro excedente en la tabla de la proyección).
- **Flujo y Hoy con el cuadro de marcha incompleto** (por ejemplo, después de deshacer una planilla): el mes que no tiene su cuota es "sin dato" y dice cuántas cuotas hay de cuántas; antes contaba $ 0. Con el cuadro completo manda el cuadro.
- **Cargar ingreso / Cargar gasto** usa el ancho completo (tenía un ancho máximo en el contenedor): desde 1024 px, el formulario y "Lo que cargaste" van lado a lado.
- **Evolución pasa tus ingresos declarados en dólares a pesos al dólar cripto,** como Flujo (decía al CCL: el mismo mes daba otro ingreso en cada pantalla). Sin el cripto cargado, "sin dato" y lo dice.
- **Gráficos:** la tabla accesible de cada gráfico ya no ensancha la página en el teléfono.
- **Hoy › Atención** ordena por gravedad la lista entera: la cuota del leasing que vence y los vencimientos de tus letras ya no quedan plegados detrás de pendientes leves (llegaban al final). "Excedente de octubre", con el mes en minúscula.
- **Evolución › Futuro:** "Ajustar supuestos" abre en Flujo el escenario que se está mostrando, también el último guardado (abría Flujo vacío); con más de un escenario guardado, "Ver con: «…»" cambia el que se muestra (`?e=`).
- **Flujo:** "Faltan datos" nombra el cuadro de marcha cuando falta o le faltan cuotas, con su botón a Datos › Leasing. El pie de tus supuestos dice qué falta y qué queda sin dato con palabras (decía "Sin elegir tem_renovacion"); sin el pago de tus letras, también el patrimonio financiero proyectado queda sin dato, y lo dice.
- **Registro:** el cuadro de marcha importado dice "planilla CSV" y lo de Cargar ingreso o gasto, "manual" (decían "tipeado", que es para el CCL y el cripto).
- **Una sola fecha para la deuda: la de tu última carga** (D-131, revisión). Pasivos toma la deuda que cuenta (la informada, la según el cuadro o la estimada) al cierre de tu última carga, como el Balance, Hoy y Flujo. Antes la calculaba a hoy y daba otra cifra, y un valor de cancelación cargado hoy aparecía en Pasivos como la deuda que cuenta mientras el Balance seguía con la estimada y pedía cargarlo. Ahora lo cargado con fecha posterior se muestra aparte en Pasivos ("cuenta desde tu próxima carga"), y el Balance dice "Ya cargaste el valor de cancelación del …: entra con tu próxima carga" en lugar del botón.
- **Datos › Leasing:** una planilla que no completa el cuadro de marcha avisa antes del Enter qué cuotas faltan. Revertir una carga del leasing con otra posterior dice además cómo corregir un pago mal cargado: completándolo de nuevo, sin revertir la planilla.
- **Revisión de los arreglos (15/10):**
  - **El cambio de ingreso de feb-2027 no se adelanta a enero:** con la carga de enero (o un escenario armado en enero), enero sigue con el ingreso de antes y la baja arranca en febrero; un tramo "hasta" que termina en el mes de la carga todavía rige ese mes ("este mes"), y "la empresa paga desde el mes 1" deja el mes de la carga al otro (D-148).
  - **Evolución:** con la cuota de la empresa, el costo del leasing es $ 0 y lo dice (seguía diciendo "falta el cuadro de marcha": el dato no llegaba al estado de resultados); con el cuadro incompleto, el período que toca un mes sin su cuota es "sin dato", nunca $ 0 (D-138). "Ajustar supuestos" abre en Flujo el escenario guardado como abierto ("Guardar cambios" lo actualiza, no crea otro), y "Ver con: «…»" ya no se pierde cuando hay un período recordado en el dispositivo; el demo muestra el selector.
  - **Cargos extra:** uno sin cuota en un mes sin cuota (o con una cuota que no está en el cuadro) se debita con la cuota siguiente; en la planilla, uno que dice una cuota que el contrato no tiene frena el Enter con su fila (D-153). La fórmula de la cuota en el calendario de Flujo suma los cargos que su total ya incluía.
  - **Qué deuda cuenta, dicho en cada pantalla:** Pasivos dice el orden (informada › según el cuadro › estimada) y marca "la que cuenta"; Datos › Leasing dice que la según el cuadro reemplaza a tu estimado (decía que solo servía para compararlo); Hoy llama "deuda del leasing" a la que cuenta (decía "capital pendiente"), y en Atención, un valor de cancelación cargado después de la última carga dice que entra con la próxima, sin pedirlo de nuevo.
  - **Datos › Leasing:** el aviso de planilla corta dice lo que pasa de verdad (sin el cuadro completo no hay tasa ni deuda según el cuadro); el freno de reversión ya no dice "pisó las mismas cuotas" cuando la carga posterior es un cargo.
  - **Evolución, el puente:** la línea de la deuda dice que, con la deuda según el cuadro, entre cuotas también suma el interés que corre (D-131, con la decisión pendiente).
  - **Tests:** un fixture usaba una cifra real del dueño; ahora es inventada.
  - **Manual y modelo de datos:** al día con la deuda única, el pagador por defecto, el reintegro del IVA en el excedente y los tipos regenerados.
- **Privacidad del repo:** `docs/investigacion-vida.md` y D-01 ya no nombran la casilla de mail ni las empresas del dueño (estaban desde la fase 1a). La historia de git anterior todavía los tiene: por eso conviene que el repo sea privado.
- **Base:** las cinco migraciones de la entrega se aplicaron en producción el 15/10 (`20261015124724` a `20261015125140`), con cada función igual a su archivo y los tipos regenerados.
- **Tus datos en producción** (nunca en git): el contrato del leasing con la fecha de desembolso, el monto financiado neto (el valor del bien menos el canon inicial: con eso la tasa reproduce la del contrato) y "la cuota la pagás vos"; el cuadro de marcha importado con el lector de la app (35 cuotas, el total al centavo, el CSV guardado en la carga); y el pago al vencimiento de tus dos letras y bonos a tasa fija, calculado de la norma de cada emisión, con su fuente.

#### Balance
Tu estado de situación patrimonial, en `/patrimonio` (D-131 revisada, D-132 a D-134):

- **La cifra grande con la casa adentro:** hoy, con la deuda del leasing estimada, dice "Patrimonio neto · deuda del leasing estimada" con el chip `estimado`, y debajo, firme, "Sin la camioneta: financiero + casa". Con el valor de cancelación de la leasera pasa a "Patrimonio neto" a secas; sin ninguna deuda, a "Patrimonio neto sin la camioneta" (`parcial`). La deuda se toma informada › según el cuadro de marcha › estimada, y su origen se escribe al lado (D-131, D-134).
- **Arriba, en una frase:** cuánto tenés, en pesos y en dólares, y cómo se reparte ("la casa es el 72% de eso; lo invertible, el 28%"), con cada cifra tocable.
- **Tres tarjetas:** la cifra grande, el activo con su barra (financiero, casa, camioneta) y el pasivo con el origen de la deuda, el botón para cargar el valor de la leasera y "lo que falta pagar según contrato", que es una referencia y nunca se resta (aparece cuando importes el cuadro de marcha).
- **El estado de situación patrimonial:** ACTIVO (lo financiero por cuenta, por instrumento o por clase, y cada bien con su valuación, su fuente y su fecha), PASIVO (cada deuda con su origen) y PATRIMONIO NETO (completo, lo firme y tu parte de la camioneta), cada renglón en pesos, en dólares y en % del activo. Desde 768 px es una tabla; en el teléfono, tarjetas que se pliegan.
- **Comparativo:** el balance al lado del de otra fecha de carga (por defecto, la primera), con la diferencia de cada renglón en pesos y en dólares; la diferencia no es una ganancia y lo dice (D-133).
- **Indicadores del balance:** solvencia, endeudamiento e inmovilización, cada uno con su fórmula y sin juicio (D-133).
- **Composición** del activo, financiero o total: por moneda de riesgo (los bienes, "sin elegir", D-73), por clase y por liquidez (disponible hoy, con venta en el mercado, ilíquido; la regla escrita, D-132), con porcentajes que suman 100,0%.
- **Evolución:** el activo por clase y el patrimonio neto, un punto por fecha de carga, en pesos o en dólares, con la tabla a un toque.
- **Cualquier fecha de carga** y **Imprimir** en A4 para tu contador, con el CCL usado y su fuente, las dos monedas y los chips como texto (D-133). La fecha y el agrupamiento quedan en la dirección.
- **Cada estado se explica:** sin cargas, sin bienes, una casa sin valuación, precios viejos (chip en la fila y en cada total que la incluye), un solo día de historia.
- **Revisión del 15/10:**
  - **Sin CCL, la deuda no se pierde:** una deuda cargada (informada o estimada) sigue con su origen y su valor en su moneda; la otra moneda dice "sin dato" y pide el CCL. Antes, el pasivo decía "falta el valor de cancelación" y la cifra grande caía a "sin la camioneta", con un botón para cargar un valor que ya estaba.
  - **Los porcentajes del pasivo y del patrimonio neto suman lo que dicen,** por resto mayor como los del activo: pasivo + patrimonio neto = 100,0%, y lo firme + tu parte de la camioneta = patrimonio neto (con el valor de cancelación se veía 91,6% + 3,9% al lado de un 95,4%).
  - **La liquidez de cada partida y su regla** van a la traza de su porcentaje (D-132).
  - **Modo privado:** la fuente de la deuda ("Cómo: …", que en producción trae la cuenta del estimado, con montos), la nota de lo que falta pagar y el pie de la impresión mostraban sus montos; ahora se tapan como cualquier otro (test que renderiza la tarjeta y la tabla).
  - **Demo:** la deuda según el cuadro de marcha es la cuenta que dice su fórmula (VP de 34 cánones y la opción a la TEA de 50,72% = $ 20.949.248,34); decía 38,40%, que da $ 23,4 M. La fuente del estimado del demo trae un monto, como la de producción.
  - **Comparativo:** el chip de cada renglón cuenta las dos fechas; si la cifra anterior era un estimado (la deuda antes de que la leasera la informe), la diferencia también lo es y el renglón dice "estimado" (antes solo miraba la cifra de hoy).
  - **Los nombres de las deudas en las frases:** "falta la deuda del leasing de la camioneta", "el bien que financia el leasing…", "financiada por el leasing de la camioneta" (decía "de Leasing de la camioneta", "Falta El bien…" y "de el leasing").
- **Por dentro:** motor `src/lib/domain/balance.ts` y vista `src/lib/vistas/armar-balance.ts`, puros y con tests (toda cifra con su par y su traza; ningún "sin dato" en cero); datos inventados en el modo demo (`?demo=estimada|completo|segun-cuadro|sin-deuda|sin-valuacion|sin-bienes|viejo|un-dia|vacio`); la deuda según el cuadro de marcha y lo que falta pagar llegan de Pasivos en la integración. Sin migraciones.

#### Evolución y PnL
Pantalla nueva **Evolución y PnL** (`/evolucion`): cuánto ganaste o perdiste en un período, en qué, por precio o por dólar, realizado o no, y tu estado de resultados (D-135 a D-138, provisorias).

- **Controles en la URL:** Financiero · Total, Pesos · Dólares · Ambas, y el período (semana, mes, 3 meses, desde el día cero o dos fechas con carga; en el teléfono, en una hoja). Se puede guardar como favorito, y el último que elegiste queda recordado en el dispositivo (HO-7; nunca en la base).
- **Con una sola carga no queda en blanco (D-136):** tu punto de partida, lo que ya traías al día cero según el PPP de tus brókers (en dólares, solo donde está el CCL de compra; si no, "sin dato" y la suma parcial), qué pasa si mañana el CCL sube 1% (sensibilidad, no pronóstico), el puente con cada línea en "sin dato · necesita una segunda carga" y el flujo del mes en curso.
- **El puente (D-137):** patrimonio al inicio → aportes, retiros y altas → **cuotas del leasing pagadas desde tus cuentas** (una salida, no una pérdida) → por tus activos → por el dólar → sin atribuir → al final. En la vista Total suma la amortización de la deuda y los "de lo cual" (revaluación de bienes, el dólar sobre tus bienes, el dólar sobre la deuda en pesos). El cuadre se calcula (final − inicial − líneas = 0), no es un residuo. Cascada de deltas en desktop (cada línea un escalón y el cambio total al final; el inicio y el final, escritos en la lista; tocar "activos" o "dólar" muestra las tres partidas que más sumaron y las dos que más restaron, y cualquier otro escalón, su cálculo), lista con signos en el teléfono.
- **Quién sumó y quién restó:** barras divergentes por partida, partidas en precio (sólido) y dólar (rayado); en el teléfono, las cinco más grandes. Tocar una barra abre su cálculo (D-35); el mismo ticker en dos cuentas se distingue por la cuenta.
- **Resultados por activo y cuenta (D-135):** resultado, por el precio, por el dólar, sin atribuir, **realizado** y **no realizado** (PPC promedio, exactos y sin residuo), y % del resultado, con totales. Por partida, **por cuenta** o **por activo** (con subtotales trazados) y **ordenable** por cualquier columna. La liquidez "no aplica" y dice por qué. Tabla desde 768 px de pantalla y cuando la tarjeta tiene lugar (1000 px); tarjetas si no.
- **Tu patrimonio en el tiempo:** una línea por fecha de carga y la del capital aportado; lo que queda entre las dos es lo ganado o perdido. Un día con algún precio viejo es un punto hueco (CO-5). Eje de tiempo de verdad: las cargas son días y la proyección, meses (cada uno a su cierre). Con las dos monedas, "Juntas (índice 100)": pesos y dólares en el mismo eje, indexados al día cero.
- **PnL por mes:** cada mes es la suma exacta de sus días; el primero y el último dicen si son parciales.
- **Estado de resultados (D-138):** ingresos (mensual y extraordinario aparte) − gastos fijos (chip "declarado") − gastos cargados − costo del leasing devengado (interés implícito "estimado", IVA y percepción como crédito fiscal de la sociedad, seguro, cargos) = ahorro; + inversiones (realizado, no realizado, liquidez) + revaluación de bienes + licuación de la deuda = variación explicada; contra la variación real, la diferencia es "no explicado".
- **Futuro:** con un escenario de Flujo, la curva sigue punteada desde hoy (fondo gris) y el PnL proyectado por mes, todo con el chip "supuesto"; "Ajustar supuestos" lleva a Flujo con los mismos supuestos y "Ver con: «…»" cambia de escenario guardado. Sin escenarios, invita a armar el primero.
- **Motor:** `src/lib/domain/resultados.ts` (puente, realizado y no realizado, PnL por mes, serie y capital aportado, día cero, sensibilidad, estado de resultados), con tests, propiedades con fast-check y un cruce contra una referencia en Python (`tests/referencia/realizado_referencia.py`, 24 casos inventados).
- **Con tus datos:** las cuotas que pagás vos con su apertura (Pasivos), lo cargado con Cargar ingreso, lo declarado y el escenario elegido o el último guardado (Flujo). El modo demo muestra los mismos estados con números inventados (`?demo=vacio|un-dia|semana|mes`).
- **Revisión (15/10):** con la deuda del leasing estimada (D-154), la cifra grande de la vista Total, la amortización, el dólar sobre la deuda, el resultado por el tipo de cambio en dólares, la fila del leasing (con su chip también en la tabla y las tarjetas de Resultados), la licuación del estado de resultados y la curva del patrimonio llevan el chip "estimado" (antes salían como dato firme). El IVA y la percepción muestran su rótulo y además "a confirmar" (el rótulo tapaba la etiqueta). El aviso de cuotas que no entran al puente habla solo de las del período (una cuota de antes del día cero ya no aparece). El PnL por mes dice "del … al …" cuando el período corta un mes que ya pasó. La sensibilidad dice "varía −US$ …" (no "baja −US$") y lo que arriesga dólares va en dólares. Las partes del costo del leasing van sin "+", y cada mes proyectado lleva su chip "supuesto". La demo "un día" tiene la deuda estimada, como producción, y en la demo "mes" la caja en pesos de Galicia se sigue: el vencimiento de la LECAP ya no sale como un retiro de $ 12,7 M ni infla el "no explicado".

#### Pasivos
La pantalla nueva **Pasivos** (`/pasivos`) y lo nuevo de **Datos › Leasing**: el leasing entero, cuota por cuota, en pesos y en dólares, con lo que no es un hecho rotulado (D-139 a D-143, D-152, D-153).

- **Pasivos:**
  - la frase del leasing ("pagaste 14 de 35 cuotas; la próxima, la 15, vence el …; faltan 21 cuotas: … nominales, con el seguro a confirmar y la percepción supuesta según tu planilla"), cada cifra con su traza;
  - cuatro tarjetas: cuotas pagadas (con su barra), la próxima cuota (pesos y dólares de hoy), lo que falta pagar (canon según contrato; IVA, seguro y percepción) y el costo total contra el valor del bien (del contrato y de su última valuación);
  - **la deuda con su origen**: el valor de cancelación que informa la leasera (o "sin dato · pedíselo a la leasera"), la deuda **según el cuadro de marcha** (valor presente de los cánones netos que faltan y de la opción, a la tasa del contrato, chip `estimado`) y la estimada que aprobaste, con su fecha; lo que falta pagar va al lado y nunca se resta;
  - **la tasa implícita del contrato** (TEA en días/365 y su TEM), o "sin dato · Completar el contrato" con lo que falta: el monto financiado neto y la fecha de desembolso (nunca se toma la fecha de inicio en su lugar);
  - **cada cuota abierta** (pedido del 14/10): amortización (lo único que baja la deuda y cuenta para tu patrimonio), interés implícito (`estimado`), IVA, seguro, percepción RG 3337 y cargos; en barras apiladas por cuota, en la tabla, en las tarjetas del teléfono y en los totales de lo pagado y lo que falta;
  - el **cuadro de marcha**: tabla desde 1280 px (subtotal, CCL del pago y fuente desde 1600 px) y tarjetas debajo; las pagadas plegadas, las próximas 6 a la vista; "pagada · fecha sin dato" cuando la planilla no trae la fecha del débito; en dólares al CCL del pago (sin dato si falta) o al de hoy, rotulado; cada monto proyectado con su chip (`proyectado`, `supuesto`, `a confirmar`); la opción de compra con su IVA a la alícuota observada en tus facturas;
  - totales (pagado, falta por fuente, IVA y percepción pagados y por pagar, cargos, opción) y lo que falta en tres lentes: pesos nominales, dólares al CCL de hoy y pesos de hoy (sin dato hasta que la app tenga el IPC);
  - el IVA computable y Ganancias de la sociedad, "cuánto menos pagaste en dólares", la licuación de la deuda entre tus cargas (deuda × (1/CCL de un día − 1/CCL del siguiente), con la etiqueta de la deuda) y la cuota en pesos contra la cuota en dólares (índice 100), que aparece con dos cuotas con CCL del pago;
  - "¿Quién paga la cuota? Vos · La empresa" y "¿La empresa te reintegra el IVA?", un toque cada uno, sin suponer nada mientras no lo digas;
  - estados demo: `?demo=sin-pasivo`, `sin-cuadro`, `sin-tasa`, `cuadro` (por defecto) y `completo`.
- **Datos › Leasing:**
  - **Importar cuadro de marcha (CSV):** elegir el archivo o pegar el texto → la revisión, con la forma de la bandeja de Cargar (cuotas leídas, facturadas, proyectadas con su fuente, nuevas, actualizadas e iguales con qué cambia en cada una, cargos extra, el total de la planilla contra la suma de sus partes y la opción de compra contra el contrato, con "Guardarla en el contrato") → **Enter** → "Guardado · 35 cuotas" → **Deshacer**. Los errores frenan el Enter con su fila y su columna; las advertencias se aceptan de a una. La planilla se puede volver a importar cada vez que pagás: se actualiza por número de cuota y lo facturado pisa lo proyectado;
  - **Completar el pago de una cuota:** la fecha (opcional), el CCL de ese día con su fuente y quién la pagó; recargar la planilla no los pisa;
  - **Cargos extra:** los que trae la planilla (multa, comisión, reserva de fondos, interés u otro) y los que agregás a mano; un cargo se anula, no se borra;
  - la deuda según el cuadro de marcha al lado de la informada y la estimada, la fecha de desembolso, quién paga, el reintegro del IVA y la tasa del contrato;
  - demo: los mismos estados que Pasivos y `?demo=revision` (la planilla actualizada, con la revisión abierta).
- **Base** (migración `20261015124724_pasivos_cuadro_marcha`, aplicada en producción el 15/10):
  - `pasivo_cuotas` suma `estado` (facturada o proyectada), `periodo`, la fuente de cada monto (`fuente_canon`, `fuente_seguro`, `fuente_otros`, con `no_aplica`), `pagada`, `ccl_fuente`, `pagador` y `notas`, con sus checks (una proyectada nunca está pagada ni tiene fuente "comprobante"); `seguro` pasa a ser neto de IVA e `iva_canon` el IVA facturado sobre canon y seguro;
  - `pasivos` suma `pagador_habitual`, `reintegra_iva` y `fecha_desembolso`;
  - tabla nueva `pasivo_cargos` (sin borrar: se anula);
  - `guardar_cuadro_marcha(p)`: una carga manual con el CSV entero en su lectura cruda, idempotente por lote, upsert por número de cuota, rechaza bajar una facturada a proyectada; revertible con `revertir_lote`.
- **Revisión (15/10):**
  - una cuota que ya venció y tu planilla no marca pagada ya no se saltea: la frase y la tarjeta de la próxima cuota la dicen ("la 15 venció el dom 01/11 y tu planilla no la marca pagada: si ya se debitó, importá la planilla actualizada"), y la línea "hoy" del gráfico va en la primera cuota que vence desde hoy, no en la primera impaga;
  - el chip del encabezado dice qué deuda cuenta (D-131): "deuda estimada" con la según cuadro o la estimada, nada con la informada y "deuda sin dato" si no hay ninguna (antes decía "estimada" aunque no hubiera estimado);
  - lo que falta por fuente, el canon y el resto de lo que falta y la opción de compra del cuadro, también en dólares al CCL de hoy (antes solo en pesos);
  - "¿Quién paga la cuota?" y "¿Te reintegra el IVA?" ya no quedan marcados si guardar falló;
  - el IVA y la percepción, "crédito fiscal de la sociedad que toma el leasing" (decía "de quien factura");
  - el lector frena en la revisión una cuota impaga que mezcla comprobante con CONFIRMAR, SUPUESTO o contrato (antes pasaba la revisión y la base la rechazaba recién con el Enter);
  - en el cuadro, la lectura "Amortización y gasto" muestra el chip `estimado` en la amortización y el interés de cada cuota (tabla y tarjetas), y `supuesto` o `a confirmar` en el resto, como la factura;
  - en el teléfono, "Ver cada cifra de la frase" abre una hoja con cada cifra de la frase en pesos y en dólares, cada una con su traza (antes, con el dedo, las cifras de la frase no abrían nada);
  - una suma sin ninguna parte conocida (lo pagado en dólares sin los CCL de los pagos) dice por qué en su traza ("La cuota 1 está pagada, pero falta la fecha del pago y su CCL… Lo mismo en las otras 13."), no "Faltan 14 partes.";
  - para Balance, la deuda según el cuadro a una fecha de carga dice en su traza "CCL del 30/09/2026" (el de esa fecha), no "CCL de hoy";
  - arriba, "CCL del 14/10/2026: 1.500,00" con la fecha de ese CCL y el chip `viejo` si pasaron más de 2 días hábiles (antes decía "CCL de hoy" con la fecha de hoy aunque el CCL fuera de otro día).
- **Para las otras pantallas** (`src/lib/vistas/integracion-pasivos.ts`): la deuda según el cuadro y lo que falta a cualquier fecha de carga (Balance y el motor, con `conDeudaSegunCuadro`), la amortización de cada cuota (Flujo) y la cuota que vence en los próximos 10 días (Atención en Hoy).
- **Motor y lectura:** `src/lib/domain/pasivos/` (cuadro, apertura, deuda según el cuadro, recupero fiscal, licuación) y `tir.ts` (TIR en Decimal, contrastada con una implementación independiente en Python, `tests/referencia/tir_referencia.py`); el lector `cuadro-marcha-csv@1` (`src/lib/carga/cuadro-marcha.ts`) con el encabezado real de la planilla; `src/lib/server/hechos-pasivos.ts` (las cuotas y cargos de una carga revertida no llegan) y `escritura-pasivos.ts`.

#### Flujo y escenarios
Pantalla nueva **Flujo y escenarios** (`/flujo`) y **Cargar ingreso / Cargar gasto** (`/flujo/cargar`), pedidos el 14/10 (plan §6 D; D-144 a D-149, D-155):
- **El mes en curso con los datos de hoy**, sin supuestos: ingresos declarados (los dólares al cripto de tu última carga), gastos fijos y la cuota del leasing que pagás vos, y el **excedente invertible** en pesos y en dólares. Cada cifra abre su traza.
- **El calendario de la plata**: los próximos 12 meses con lo que ya se sabe (lo declarado con sus vigencias, las cuotas del cuadro con sus chips, lo que vence de tus bonos y letras). Un vencimiento sin el pago cargado ofrece "Cargar el pago al vencimiento", con su fuente y la vista previa de lo que cobrarías.
- **Escenarios**: panel de supuestos con Baja · Igual · Sube y deslizante con − y + por variable, el texto exacto de "Igual" debajo y el número también en el botón ("Sube +2,0%/mes"). Nada de mercado arranca elegido; "Completar lo que falta con Igual" lo tocás vos (D-145). El ingreso en dólares y en pesos va **por tramos "desde el mes N"**, con el de feb-2027 ya armado y sin elegir, y el de pesos se puede ajustar por mes (0 a 15 %/mes) (D-147). **Tu regla de reinversión del 14/10** arranca precargada y rotulada "tu regla · 14/10": todo el excedente (ingresos − gastos fijos − la cuota entera) repartido según el peso de cada posición en tu última carga; un mes que no alcanza sale de tus pesos y avisa "no se cubre"; lo que vence se reinvierte igual (D-155).
- **La proyección** corre en tu navegador sobre la base serializada, un solo camino por escenario (D-144): cajas al horizonte (excedente acumulado, patrimonio financiero, neto sin la camioneta), "¿terminás debajo de lo que pusiste?", cobertura de la cuota, el gráfico del flujo mes a mes (lo proyectado rayado, con la línea de hoy; en el teléfono, los próximos 6 meses y "Ver los N meses"), el patrimonio proyectado y el mes a mes en dos vistas, "la plata del mes" y "patrimonio y resultado" (invertido, por precio y por el dólar, como el real, D-35), en tabla o en tarjetas en el teléfono, con la traza de cada cifra armada recién al tocarla. Mientras tanteás, los supuestos viven en la dirección (`?s=`): recargar no pierde nada y Atrás recorre lo probado. En el teléfono, al bajar a los supuestos queda fija arriba una franja con el excedente del primer mes y el financiero al horizonte.
- **Guardar, abrir, archivar y comparar** escenarios (se guardan los supuestos, nunca resultados; se archivan, no se borran) y el **último valor de cada deslizante queda recordado** (D-148). Comparar: hasta tres, con trazos distintos y solo los supuestos que difieren.
- **Proyectado contra real**, mes a mes: cada mes nace proyectado y se vuelve real con lo que cargás, con el desvío por línea. Nada proyectado se guarda.
- **Cargar ingreso / Cargar gasto**: monto, moneda, fecha (hoy), concepto obligatorio (ingreso mensual o extraordinario; gasto fijo del mes o extraordinario) y a qué cuenta entró (IEB, Galicia, Mercado Pago o afuera); si vendiste dólares al cripto, el cripto y los pesos, con el control a la vista. Se graba en una transacción con su carga y, si entró a una cuenta, su **aporte** (o su retiro): la próxima carga no lo lee como ganancia (D-149). Si ese día ya cargaste en Datos un aporte igual a la misma cuenta, avisa antes de guardar. "Lo que cargaste" con **Deshacer** (las reglas de Registro) y **Anular**.
- **Tus ingresos y gastos declarados**: alta, "Cambia desde…" (cierra la fila el día anterior y abre otra en una transacción), "Termina…" y Anular.
- Migraciones nuevas: `…_flujo_recurrentes` (columnas de ingresos y gastos y `guardar_recurrente`), `…_flujos_bono_fuente` (`flujos_bono.fuente` y `guardar_flujos_bono`), `…_escenarios` (`escenarios.archivado_en`, tabla `valores_recordados` y `guardar_escenario`) y `…_flujos_reales` (tabla `flujos_reales` y `guardar_flujo_real`). Ninguna guarda totales ni proyecciones.
- El panel de supuestos se publica en `src/components/escenarios/` para que Evolución lo abra en una hoja.
- No entra: Monte Carlo y el abanico (fase 3), el cierre mensual por diferencia de saldos (D-79), el shock de ingreso como atajo (lo cubren los tramos) y la opción de compra como variable.
- **Revisión del 15/10 (lo que se arregló antes de integrar):**
  - sin el cuadro de marcha importado, la cuota del leasing de cada mes del plazo es **sin dato**, nunca $ 0: la frase del mes, el calendario y proyectado contra real la nombran, el excedente dice qué falta y la proyección lo pide (salvo que elijas que la paga la empresa);
  - sin el pago al vencimiento de tus letras, la proyección **corre igual con la caja** (ingresos, gastos, cuota, excedente e invertido) y deja sin dato solo lo que depende de ellas;
  - la cobertura de la cuota ya no concluye "no alcanza" con meses sin dato ni con menos de 13 meses de horizonte, ni aparece si la cuota la paga la empresa;
  - un cobro de bonos en dólares sin el CCL de su día, o lo cargado en dólares sin CCL, es sin dato (antes se pasaba a pesos × 0); lo proyectado de los gastos del mes incluye los declarados en dólares;
  - el excedente del mes, sus líneas y el neto de cada mes del calendario muestran el chip de lo supuesto o proyectado que suman (la cuota con seguro supuesto, por ejemplo).
  - si invertís menos del 100% del excedente, el panel dice que lo que no invertís no se cuenta como patrimonio financiero.
  - con el excedente del mes sin dato, la frase lo dice una vez y con su motivo (antes: "sin dato (sin dato)").

### 2026-10-14 — La deuda estimada del leasing se ve como estimada
La deuda del leasing que cargamos el 14/10 es un estimado que aprobaste (D-131), pero la app la restaba como si te la hubiera informado la leasera. Ahora cada saldo de deuda dice qué es (D-154):

- **Base:**
  - `pasivo_saldos` tiene `naturaleza` (informado o estimado) y `fuente`, que es obligatoria para un estimado;
  - el saldo del 08/10 quedó como estimado, con la fuente que tenía en su carga;
  - `guardar_manual` exige la naturaleza (migración `20261014212152_pasivo_saldos_naturaleza`, ya aplicada).
- **Motor:**
  - etiqueta nueva `estimado`: la deuda estimada la lleva, y también toda cifra que la incluye, como el patrimonio total de Hoy y la deuda y el neto de Exposición;
  - la traza dice "deuda estimada" y cómo se estimó;
  - se sumaron también las etiquetas `supuesto`, `a confirmar` y `proyectado`, para los escenarios y el cuadro de marcha.
- **Pantallas:**
  - Hoy y Exposición muestran el chip "estimado";
  - Datos › Leasing muestra la deuda estimada con su chip, su fecha y cómo se calculó;
  - el formulario pasa a ser el del valor de cancelación que informe la leasera ("Cargar el valor que informó la leasera"), y el valor informado reemplaza al estimado desde su fecha.

### 2026-10-14 — Revisión de la 1a: correcciones
La 1a desplegada pasó por una revisión adversarial de todo el código, y cada arreglo tiene un test que falla sin él. Las decisiones de esta ronda son D-117 a D-131; las que esperan tu confirmación están marcadas como provisorias.

- **Cargar** (D-117 a D-123):
  - una posición que la fuente deja de listar (venta total o vencimiento) ya no sigue valuada en silencio: la bandeja ofrece "Registrar venta" o "Registrar vencimiento" (lo cobrado lo tipeás vos; el último precio es solo una referencia) o "Dejar pendiente", y una pendiente vale "sin dato" desde la primera carga que no la trajo (D-117). En una captura, solo para la sección y la moneda de un total que cierra;
  - una carga que deja algo pendiente pone su fuente en ≠ "parcial" en el chip de datos y suma un ítem en Atención, hasta la próxima carga de esa cuenta (D-118);
  - recargar el mismo día con un solo tipo de cambio ya no borra el otro, y sin CCL tipeado las operaciones usan el que ese día ya tiene cargado (D-119);
  - una captura posterior del mismo día ya no pisa el precio que grabó el Excel de IEB (D-119);
  - reintentar un Enter cuya respuesta se perdió muestra lo que de verdad quedó grabado; si cambiaste algo, no dice "guardado": pide "Nueva carga". Un error al guardar ofrece "Ver Registro" y "Nueva carga" (D-120);
  - "Ya la tenía (apertura)": una tenencia nueva en una cuenta ya cargada (por ejemplo, una que quedó pendiente el Día cero) puede entrar como apertura con el PPP, además de como compra (D-121);
  - una fuente que no graba nada no crea su carga ni reemplaza la buena del día (D-122);
  - Galicia: una fila en dólares ("Bonos en dólares", U$D) ya no se graba como precio en pesos: queda en error, para dejarla pendiente. Los controles en dólares se ven en US$ (D-123);
  - el fondo sin código de Galicia se puede dar de alta: su ticker es el nombre con guiones ("FIMA-PREMIUM-CLASE-A"), y el alta muestra todos sus errores (D-123);
  - IEB: un PPP o un precio de 0 es "sin dato", nunca un costo ni un precio de $ 0; si B2 o un Subtotal no cierran, nada de lo que controlan queda verificado (D-123);
  - corregir a mano la cantidad de una fila de Galicia vuelve a armar el costo con el rendimiento $, y el precio implícito de una compra sale del costo total exacto (D-123);
  - una captura que las dos lecturas atribuyen a bancos distintos pregunta de cuál es ("Es de Galicia" o "Es de Mercado Pago") y la vuelve a leer (D-123);
  - Mercado Pago: si las dos lecturas del saldo no coinciden, el que se propone ya no dice "cierra"; una TNA de 1% o menos ya no se toma como fracción;
  - modo privado: Cargar ya no deja montos a la vista.
- **Datos** (D-124):
  - un guardado reintentado no se duplica: cada envío lleva su lote. Un corte de conexión deja el formulario y avisa que no se sabe si se guardó;
  - "Corregir datos" en cada bien y "Corregir el contrato" en cada pasivo; el cambio queda en la auditoría;
  - un CEDEAR nunca queda sin ratio, tampoco al editarlo: lo controla la base (D-104);
  - modo privado: el contrato del leasing y su historia, las valuaciones y el impuesto de los movimientos ya no dejan montos a la vista;
  - cada subpantalla tiene su encabezado principal (para el lector de pantalla), y cada bien y cada pasivo, el suyo;
  - Movimientos: a 360 px, "Transferencia" ya no se sale de su botón.
- **Hoy:**
  - una tenencia que la fuente ya no lista y dejaste pendiente vale "sin dato": los totales que la incluyen muestran "sin dato · parcial" con la suma parcial, en vez de contarla dos veces, y Atención la muestra con gravedad alta (D-117);
  - sin los bienes o sin el leasing cargados, el patrimonio total y su variación son "sin dato · parcial", con la suma de lo cargado (antes repetían el financiero), y la deuda en pesos es "sin dato", no $ 0 (D-126);
  - un total al que le falta una parte muestra debajo la suma parcial en pesos y en dólares, con su traza (D-65);
  - el cuadre dice por cuánto: "cierra (diferencia $ 0,00 · US$ 0,00)" o "no cierra por …", cada cifra con su traza; "no verificable" dice qué falta (D-66);
  - una compra, una venta o un cobro en una cuenta sin saldo cargado en esa moneda (Galicia) cuenta como plata que entró o salió de la app: el cuadre cierra y la nombra (D-125);
  - la frase lleva verbo en las dos oraciones ("tus activos sumaron…", "la suba del CCL le restó…"), como en el manual; si falta una partida, dice cuál y por qué en vez de repartir cifras (D-128);
  - carga express: "de tus US$ …" es una cifra más de la frase, con su traza y su renglón en la hoja del teléfono; la puntuación que sigue a una cifra ya no baja sola de renglón;
  - "Quién movió tu financiero": cada aporte trae su cuenta completa (valores, CCL y flujos);
  - Atención: un saldo viejo dice de qué cuenta es ("Pesos en Mercado Pago: dato viejo");
  - el punto de Cargar y "Todavía no cargaste hoy" aparecen recién después del cierre de BYMA, a las 17 h de Córdoba (D-127);
  - el Día cero sigue el orden del manual (Leasing, Bienes, el catálogo opcional y la primera carga), no pide las cuentas y lleva primero a Datos › Leasing (D-128);
  - en el teléfono, la línea "Pesos fin. − leasing" ya no se sale de su tarjeta; con mouse en una ventana angosta, la frase se lee entera;
  - modo privado: los montos sueltos de la frase también se ocultan.
- **Cartera:**
  - el desglose activo/TC es el de la tenencia vigente: después de una venta parcial o de un cupón, activo + TC + sin atribuir = resultado de la fila (D-35);
  - si el resultado de una fila es "sin dato" (precio pendiente, tenencia que la fuente ya no lista), las partes de su desglose también, con el mismo motivo (D-126);
  - los Días abren su traza ("jue 15/10 − jue 01/10 = 14 días desde la apertura en la app") y llevan el chip "desde apertura" o "declarado";
  - los montos compactos llevan su signo ("+$ 6,2 M"), y en Totales "TC" va en el renglón de su cifra;
  - el "sin dato" de una apertura sin CCL de compra ya no manda a declararlo (en la 1a no hay dónde): "se declara desde la 1b (Pendientes)";
  - con el dedo, los encabezados y el botón de cada fila miden 44 px (D-100).
- **Exposición:**
  - sin el leasing, la deuda en pesos, el neto, la sensibilidad y el % neto son "sin dato · parcial" (D-126); sin el total del financiero, la concentración es "sin dato";
  - una suma sin ninguna parte conocida ya no dice "suma parcial (0 de 1): $ 0,00": dice qué falta (D-126);
  - sin cargas, dice que la composición aparece con la primera carga y lleva a Cargar; sin el capital pendiente del leasing, lleva a Datos › Leasing;
  - la frase del neto ya no deja un "(" o un ";" solos en un renglón del teléfono, y sus montos se ocultan en modo privado.
- **Registro:**
  - un guardado de Datos se llama "Datos", su origen es "manual" y dice qué grabó ("valuación de Casa", "capital pendiente de Leasing", "aporte a Mercado Pago"), también en el resumen del lote y al revertir. Antes figuraba como "Tipo de cambio · CCL y cripto";
  - si guardaste otro día que el de los datos, la tarjeta lo dice ("mié 14/10 · guardado el jue 15/10 a las 08:00").
- **En toda la app:**
  - en el teléfono, el chip de estado de los datos se abre entero debajo de la barra; antes salía cortado a la izquierda (D-30);
  - los resultados en dólares van en verde o en rojo también dentro de su pastilla;
  - la traza muestra los insumos con sus decimales: un precio de $ 1,124 ya no sale $ 1,12 (D-128);
  - el anillo de foco ya no deforma los controles;
  - Ajustes: el interruptor de Modo privado apagado se ve, con contraste de 3:1 o más (D-128);
  - una dirección que no existe dice "No encontré esa página", dentro de las barras de la app y con "Ir a Hoy" (D-128);
  - la pantalla de error ya no dice "Nada se guardó ni se cambió", que no sabe: "Si estabas guardando algo, no sé si se guardó: mirá el Registro antes de volver a intentar", con un link al Registro (D-128);
  - con el dedo en una tablet o un teléfono acostado, los links de la barra lateral y los campos de Cargar y de Datos miden 44 px, también a 1024 px (D-100).
- **Seguridad:**
  - el freno a las claves vale también en paralelo (D-112): mirar la traba y anotar el intento van en un solo paso, antes de comparar la clave. Antes, una ráfaga de pedidos simultáneos probaba todas sus claves y la correcta entraba; ahora prueba como mucho 3, igual que en serie, y trabada ni la clave correcta entra;
  - las cifras reales del dueño que habían llegado a tests y fixtures se reemplazaron por números inventados. Siguen en el historial del repo público: qué hacer con eso lo decide el dueño (D-24).
- **Base** (cuatro migraciones, aplicadas en producción el 14/10 con la versión que registró Supabase; `docs/datos.md`):
  - `20261014193803_confirmar_carga_recarga`: `confirmar_carga` conserva lo no tipeado del tipo de cambio, respeta el precio del Excel entre cargas y guarda la huella del pedido (D-119, D-120);
  - `20261014193834_catalogo_cedear_ratio`: `alta_activo` y `editar_activo` rechazan un CEDEAR sin ratio (D-124);
  - `20261014193836_auditoria_search_path`: `registrar_auditoria` fija `search_path = public, pg_temp`. Una sesión SQL con una tabla temporal llamada `auditoria` se llevaba ahí las filas de la auditoría (D-17);
  - `20261014203031_feriados_2026_2027`: la tabla `feriados` estaba vacía, y los feriados contaban como días hábiles para "viejo" y para "Todavía no cargaste hoy" (por ejemplo, el lun 12/10). Entran 49 días: los días sin rueda en BYMA (17 de 2026 y 12 de 2027) y los cierres de la NYSE (10 de cada año), cada uno con su fuente oficial (D-129);
  - cada función aplicada coincide con su archivo (md5 del cuerpo); las firmas no cambian, así que los tipos de `src/lib/database.types.ts` tampoco;
  - se sacó `supabase/schema.sql`, el schema de Corte que había quedado junto a las migraciones (D-01);
  - el Día cero del dueño se cargó el 14/10 desde la base, con las mismas funciones que usa la app (D-130);
  - la deuda del leasing es, por ahora, un estimado que aprobó el dueño, hasta que la leasera informe el valor de cancelación (D-131).
- **Verificación:**
  - Vitest: 40 archivos y 944 tests, entre ellos uno por arreglo;
  - tests del schema: 191 controles (antes 143), con la recarga del tipo de cambio, el precio del Excel entre cargas, la huella, el ratio de un CEDEAR, la auditoría y los feriados;
  - Playwright: 49 tests. El de layout (D-30) recorre 9 anchos en claro y en oscuro, y además 768 y 1024 px con el dedo; marca también lo que se sale de su tarjeta o de un botón, exige un h1 por pantalla, recorre la página de "no encontrada" y abre el chip de datos a 360, 390 y 412 px. Cargar y Datos lo frenan como cualquier pantalla;
  - el de interacción prueba el modo privado en todas las pantallas (ningún monto a la vista), el foco con teclado, el 404 y el Día cero;
  - la referencia en Python codifica el desglose de la tenencia vigente (D-35), y los 310 casos se regeneraron;
  - ningún test usa cantidades ni precios de los archivos reales del dueño (D-24).
- **Documentación:**
  - decisiones D-117 a D-131, y D-01, D-16, D-24, D-35, D-47, D-65, D-66, D-70, D-100, D-104, D-106, D-107, D-108, D-112 y D-113 al día;
  - `docs/datos.md` (las cuatro migraciones, `cargas.grabado`, el `search_path` de la auditoría), `docs/arquitectura.md`, `docs/carga-diaria.md`, `docs/calidad.md` ("Estado de la 1a" al 14/10) y `docs/stack.md` (feriados sin date-holidays);
  - el manual corrige la frase de ejemplo, las 13 columnas de Cartera, el límite de imagen, el tiempo activo de una captura y "viejo" con feriados;
  - en la entrada del 08/10 de abajo, el modo demo decía "solo en desarrollo" (anda fuera de producción, también en un Preview de Vercel) y había "una sola lectura de la base por pantalla" (es una sola lectura de los hechos por pedido; Registro y Datos leen además sus tablas). Quedó corregida.

### 2026-10-08 — Deshacer y Revertir andan
- **Base:** se aplicó la migración `carga_revertir` (`revertir_lote`). La aplicó el dueño desde el editor SQL, porque el conector de Supabase no puede aplicar sentencias con `DELETE` (D-116). Quedó registrada en el historial de migraciones con su versión, y la función es idéntica al archivo salvo el fin de línea (`docs/datos.md`).
- **Cargar y Registro:** Deshacer y Revertir ya funcionan; se sacó del manual el aviso "Por ahora no anda" (`docs/manual.md` §8).
- **Tipos:** `src/lib/database.types.ts` regenerado, con `revertir_lote`.
- **Documentación:** `docs/arquitectura.md` ubicaba las cinco funciones de escritura en `carga_transaccional`; ahora nombra la migración de cada una.

### 2026-10-08 — Fase 1a: la primera versión usable
La app nueva reemplaza a Corte (D-01): carga diaria, Hoy, Cartera, Exposición, Registro, Datos y Ajustes, con todo número en pesos y en dólares y su traza. Cómo se usa: `docs/manual.md`. Cómo está hecha: `docs/arquitectura.md`.

- **Entrada y seguridad** (D-21, D-112):
  - una sola clave (`APP_PASSWORD`) y una sesión de 30 días firmada con claves derivadas (PBKDF2, o `SESSION_SECRET`), una por propósito; cambiar la clave cierra todas las sesiones;
  - `src/proxy.ts` protege toda ruta, y cada Server Action y la ruta de lectura vuelven a verificar la sesión (un test estático lo controla);
  - freno a los intentos de clave: 800 ms por error y, desde el tercero seguido, una espera que se duplica hasta 5 minutos;
  - Content-Security-Policy con nonce por pedido, rechazo de todo POST que no venga de la propia app y encabezados de seguridad en toda respuesta (sin iframes, HSTS, `nosniff`, sin cámara ni ubicación, `noindex`);
  - la vuelta después de entrar solo va a rutas propias;
  - modo demo (`PORTFOLIO_DEMO=1`), con datos inventados y sin clave: se ignora en producción, pero anda fuera de ella (desarrollo, tests, `next start` y los Previews de Vercel), así que no se carga en ningún entorno de Vercel;
  - la base sigue cerrada al navegador (D-20);
  - un solo "Salir", en Ajustes.
- **Shell:**
  - barra lateral colapsable en la compu y barra inferior en el teléfono, con Cargar al centro;
  - solo las secciones de la 1a (D-69);
  - chip de estado de los datos ("Datos al cierre del mié 14/10 · 5 de 5 fuentes"), modo privado, tema y paleta daltónica;
  - atajos `c` (Cargar) y `h` (modo privado);
  - colores tenues y paleta daltónica con contraste AA;
  - una sola lectura de los hechos por pedido (`leerHechos()` con `cache()`, compartida por la barra y la página); Registro y Datos leen además sus propias tablas.
- **Hoy:**
  - la frase del día, con cada cifra tocable;
  - patrimonio financiero y total en pesos y en dólares (D-03);
  - la línea "pesos financieros − deuda del leasing" con su sensibilidad al +1% de CCL (D-101);
  - Atención, "Todavía no cargaste hoy", quién movió tu financiero, el cuadre y el aviso de diciembre;
  - el Día cero y "Primera carga guardada".
- **Cartera:**
  - tabla en la compu, con prioridad de columnas, orden por cualquier columna, totales fijos y filtros;
  - tarjetas en el teléfono, con "ganás en pesos, perdés en dólares";
  - desglose activo/TC en pesos y en dólares desde la compra, con la misma suma de intervalos que Hoy (D-35);
  - totales "sin dato" con la suma parcial (D-65);
  - la liquidez en un bloque aparte.
- **Exposición:**
  - selector Financiero · Total con lo que netea cada vista;
  - largo, corto y neto en pesos y en dólares, y la sensibilidad al +1% de CCL;
  - composición por clase, moneda de riesgo y geografía, y concentración top 1 y top 3, sin umbral;
  - la vista Total es "sin dato" mientras los bienes no tengan moneda de riesgo (D-73), y la concentración se mide sobre el financiero (D-03).
- **Cargar** (D-104 a D-106):
  - CCL y cripto con eco en formato es-AR, y la referencia del CCL;
  - una zona para soltar o pegar el Excel y las capturas, leídos en paralelo por `POST /carga/leer`, con el archivo guardado al leer y la lectura firmada;
  - bandeja con las verificadas plegadas, advertencias que se aceptan de a una, errores que frenan el Enter, las dos lecturas de una captura para elegir con un toque, alta de tickers en la misma pantalla, conciliación editable, saldos con su valor anterior y controles ✓/≠;
  - completar el precio de una compra pendiente (D-110): la carga siguiente que trae el PPP propone el precio con su fórmula, y se acepta ("Completar"), se corrige ("Editar precio"), se graba la fila sin completarlo o se deja pendiente; nunca se aplica solo, y revertir esa carga lo deja pendiente otra vez;
  - conciliación (D-115): una carga atrasada se compara contra lo que la app tenía ese día y avisa que hay una carga posterior; más cantidad con el mismo costo total pregunta "¿Cambio de ratio?" y propone un ajuste sin precio; un precio inferido nunca es cero ni negativo;
  - las dos lecturas de una captura que no coinciden, lado a lado: la que cierra la cuenta acepta la fila y la otra corrige ese número, que se vuelve a controlar;
  - cada control con su tolerancia, y la diferencia "DOLARUSA al dólar de IEB vs tu CCL" con nombre (D-66);
  - números tipeados a mano: lo ambiguo ("1.0852", "1,548.20", "12.34.56") no se lee como miles, se pide corregir;
  - "No pude leer…" sale una sola vez, y una fila con error muestra primero el motivo que frena;
  - tiempo activo (D-62), Enter que guarda solo lo verificado, "Guardar sin …" y Deshacer.
- **Registro:** una tarjeta por lote con sus cargas, archivo, conteos, estado y tiempo activo, y "Revertir el lote" con motivo obligatorio.
- **Datos:**
  - catálogo, con el ratio y su historia;
  - cuentas;
  - bienes, con valuaciones fechadas y su valor en las dos monedas;
  - leasing, con su capital pendiente;
  - movimientos de capital: aportes, retiros y transferencias con sus monedas, montos, tipo de cambio aplicado, impuesto y fechas, y los últimos movimientos en las dos monedas al CCL de su fecha (D-111);
  - `/datos?seccion=…` lleva a cada subpantalla.
- **Lector del Excel de IEB** (`ieb-excel@1`, D-107):
  - lee el Portafolio sin IA, con su chequeo por fila `cantidad × precio × escala ≈ posición` (D-11) y la escala detectada por fila (D-12);
  - toma el saldo Total en pesos y en dólares, más DOLARUSA (D-13);
  - controla B2 y los Subtotales, con tolerancia según el formato de cada celda (D-37, D-38);
  - guarda la lectura cruda de cada celda.
- **Lector de capturas de Galicia y Mercado Pago** (`captura-claude@1`, D-108):
  - dos lecturas en paralelo con Claude (Opus 5.5 y Sonnet 5.5, configurables), con salida estructurada, sin herramientas y con la imagen intacta;
  - verificación aritmética con escala y tolerancia por decimales mostrados;
  - el PPC preciso, reconstruido y controlado;
  - el total de la captura como control;
  - las lecturas que difieren quedan en advertencia, con las dos a la vista;
  - errores en castellano.
- **Motor** (`src/lib/domain`, `src/lib/vistas`):
  - posiciones derivadas de las operaciones;
  - PPC en pesos y en dólares;
  - valuación diaria en las dos monedas;
  - desglose activo/TC anclado en observaciones frescas, con "sin atribuir" (D-35, provisoria);
  - un saldo nuevo, la primera valuación de un bien y el primer capital de una deuda entran como apertura, nunca como ganancia;
  - la amortización baja el costo y la renta no lo toca (D-114);
  - el cuadre de Hoy compara contra el patrimonio recalculado desde los hechos y ahora puede fallar (D-66);
  - CCL de un día sin observación: el último tipeado, con su fecha y "viejo" a los 2 días hábiles (D-109);
  - compra pendiente valuada "inferida" (D-110);
  - etiquetas viejo, declarado, inferido, pendiente y parcial;
  - traza en cada cifra (D-67).
- **Base:** carga transaccional en cinco migraciones (`supabase/migrations/`; aplicadas el 08/10 salvo `carga_revertir`, pendiente porque el conector de Supabase no deja aprobar su `DELETE`; ver `docs/datos.md`):
  - `cargas` con lote, lector, `archivo_sha256`, `tiempo_activo_ms` y `motivo_reversion`;
  - `tipo_cambio` con la referencia del CCL;
  - `operaciones` con la carga que completó el precio de una compra pendiente;
  - `eventos` con la nota del día;
  - las funciones `confirmar_carga`, `revertir_lote`, `guardar_manual`, `alta_activo` y `editar_activo`, cada una en una sola transacción;
  - índices para recorrer la auditoría al revertir.
- **Escritura** (`src/lib/server/escritura.ts`): valida los montos como texto (D-32), traduce los errores de la base al castellano y sube los archivos nombrados por su sha256.
- **Verificación:**
  - tests unitarios y de propiedades (Vitest y fast-check), entre ellas las del desglose anclado: un período es la suma exacta de sus días y una carga express entre dos completas no lo cambia;
  - implementación de referencia en Python que cruza el motor con 310 casos;
  - revisión adversarial del motor con un test por hallazgo;
  - tests del schema: 143 controles, todos como `service_role` (antes 40);
  - layout D-30 con Playwright (9 anchos, claro y oscuro, axe-core), más interacción y entrada;
  - estado de cada control y sus comandos: `docs/calidad.md`, "Estado de la 1a".
- **Documentación:**
  - `docs/manual.md`, el manual de uso, nuevo;
  - `docs/arquitectura.md`, el mapa para quien mantenga la app, nuevo;
  - decisiones D-104 a D-115;
  - las propuestas que la 1a implementa en forma provisoria (`docs/decisiones.md`);
  - lectores y bandeja en `docs/carga-diaria.md`;
  - objetos nuevos del schema en `docs/datos.md`;
  - README al día.
- **CI** (`.github/workflows/ci.yml`): tipos, tests, build de producción y tests del schema en cada pull request y en `main`.
- **Falta para cerrar la 1a** (`docs/calidad.md`):
  - validar con tus archivos reales;
  - el respaldo nocturno restaurado;
  - Playwright y lint en CI;
  - el test cronometrado de la carga;
  - Lighthouse.

### 2026-10-08 — Visión de producto
- **`docs/vision.md`**: cuatro diseños independientes (el hábito, la verdad de los números, toda la vida financiera, decidir mejor), puntuados por tres jueces (fidelidad al dueño, ingeniería, utilidad a largo plazo). Ganó "El hábito" (246 puntos) y se le injertaron las mejores ideas de los otros. Después pasó por una revisión adversarial y un control de coherencia (21 inconsistencias corregidas). Trae mapa de navegación, cada pantalla en desktop y en el teléfono, rituales, plan por fases (1a, 1b, 2, 3, 4 y una 5 propuesta), las decisiones para aprobar, los cambios de schema y los riesgos.

### 2026-10-08 — Investigación de vida financiera
- **`docs/investigacion-vida.md`**: diez áreas (seis pedidas y cuatro encontradas por una ronda que buscó lo que faltaba: sucesión, empresa vs. personal, seguros, jubilación), 168 hallazgos con fuente, cuadro de impuestos por tipo de activo (informativo, a confirmar con el contador), cambios de modelo de datos por fase y 22 decisiones para aprobar. El informe original se cortó al redactarse; se reconstruyó sección por sección a partir de las investigaciones guardadas, sin repetirlas.
- **D-24 actualizada:** el repo es público por decisión del dueño; la documentación se versiona, los datos crudos siguen fuera.

### 2026-10-07 — Investigación de mercado
- **`docs/investigacion-mercado.md`**: seis relevamientos en paralelo (trackers comerciales, patrimonio y proyecciones, herramientas argentinas, DIY y open source, hábito y carga, visualización), con síntesis, crítica y corrección. Unas 60 ideas con fuente, priorizadas por fase. Propone las decisiones D-35 a D-53 (estado P: esperan aprobación del dueño) y 18 cambios de schema.

### 2026-10-07 — Schema aplicado en Supabase
- **Schema revisado y aplicado** en el proyecto Portfolio (D-34). Tres migraciones:
  - `20261007205631_init`: 27 tablas, 3 vistas, auditoría por trigger y bucket privado `cargas`.
  - `20261007210319_permisos_servidor`: permisos mínimos al servidor (D-33).
  - `20261007210323_cuentas_iniciales`: IEB, Galicia, Mercado Pago.
- **Cambios respecto del borrador**, por la revisión adversarial:
  - cargas idempotentes y reversibles (estado, token, lo grabado);
  - toda fila con su carga y auditoría append-only;
  - compra del día con precio pendiente (D-19);
  - aperturas con costo "sin dato" y fecha de origen;
  - operaciones en ARS o USD con importe;
  - saldos negativos permitidos;
  - `movimientos_capital` (D-06), `pasivo_saldos` para netear el leasing en la fase 1, cuotas con IVA separado;
  - `bienes` y `bienes_valuaciones` (D-03, D-04), `feriados`, `condiciones_bono`;
  - niveles con unidad y varias órdenes por tramo;
  - checks de montos sin NaN ni Infinity (D-32);
  - vistas que devuelven montos como texto.
- **Hallazgo y corrección en producción:** Supabase le daba al servidor todos los permisos por defecto, `TRUNCATE` incluido, y escritura sobre la auditoría. Corregido con la segunda migración y verificado contra la base real (D-33).
- **Valor de CEDEAR** a partir del precio en pesos del bróker (D-18).
- **Tests del schema** en `supabase/tests/` (40 controles): reconstruyen la base de cero en un Postgres local que imita los roles y defaults de Supabase. Se probó que detectan el problema de permisos.
- **Tipos de TypeScript** generados en `src/lib/database.types.ts`.
- **Modelo de datos documentado** en `docs/datos.md`.

### 2026-10-07 — Reinicio: especificación, decisiones y stack
- **Reinicio del proyecto.** Se abandona Corte (D-01). Spec del dueño en `docs/spec.md`.
- **Proyecto Supabase dedicado** "Portfolio" (D-02).
- **Decisiones registradas** en `docs/decisiones.md`: patrimonio total vs. financiero (D-03), bienes con valuación manual (D-04), tab Evolución y PnL (D-05), movimientos de capital (D-06), carga por Excel/captura con IA verificada (D-10, D-11), log de cargas y auditoría (D-17), clave simple (D-21), mobile sin scroll horizontal con test automático (D-30).
- **Escenarios ajustables** (D-08): variables editables por escenario, tanteo en la URL, guardado con nombre, duplicado y comparación superpuesta. Botones Baja · Igual · Sube, con un deslizante para elegir cuánto.
- **Definición de terminado** en `docs/calidad.md`.
- **Stack verificado** (D-31, `docs/stack.md`): ECharts 6 como única librería de gráficos; fuera Recharts, Lightweight Charts, Tremor, jStat y TanStack Query; Monte Carlo propio y reproducible.
- **Montos exactos de punta a punta** (D-32).
- **En curso:** investigación de las mejores soluciones existentes y de la vida financiera completa (presupuesto, impuestos, durabilidad, objetivos, ingresos en USD, riesgo personal). Va a dar una visión de producto para aprobar antes de la UI.
