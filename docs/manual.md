# Manual de uso

> **Para vos, el dueño.** Describe la app tal como queda en la **fase 1a** (octubre de 2026). Todos los números de ejemplo son inventados: salen del set de ejemplo de `docs/vision.md` (Apéndice B), que cuadra entre sí. Ninguna cantidad ni precio es tuyo ni es una propuesta.
>
> Los porqués de cada regla están en `docs/decisiones.md` (las referencias D-NN). Cómo está hecha la app: `docs/arquitectura.md`.

**Si tenés cinco minutos:** entrá con tu clave (sección 2), hacé una sola vez el Día cero (sección 5) y desde ahí, cada día hábil, la rutina de menos de un minuto (sección 6). Cualquier número se toca para ver de dónde sale. Si algo no anda, la sección 12.

## Índice

1. [Qué es y qué no es](#1-qué-es-y-qué-no-es)
2. [Cómo entrar](#2-cómo-entrar)
3. [Lo que vale para todas las pantallas](#3-lo-que-vale-para-todas-las-pantallas)
4. [Las pantallas](#4-las-pantallas)
5. [El Día cero, paso a paso](#5-el-día-cero-paso-a-paso)
6. [La rutina diaria, en menos de 60 segundos](#6-la-rutina-diaria-en-menos-de-60-segundos)
7. [Las tres cargas: express, media y completa](#7-las-tres-cargas-express-media-y-completa)
8. [Deshacer y revertir](#8-deshacer-y-revertir)
9. [Aportes, retiros y transferencias](#9-aportes-retiros-y-transferencias)
10. [Modo privado, tema y paleta](#10-modo-privado-tema-y-paleta)
11. [Qué falta en la 1a y qué trae cada fase](#11-qué-falta-en-la-1a-y-qué-trae-cada-fase)
12. [Problemas comunes](#12-problemas-comunes)
13. [Palabras de la app](#13-palabras-de-la-app)

---

## 1. Qué es y qué no es

**Es** una libreta financiera. Con el Excel de IEB, las capturas de Galicia y de Mercado Pago y dos tipos de cambio que tipeás (CCL y dólar cripto), te dice en un minuto:
- cuánto tenés, en pesos y en dólares a la vez;
- qué pasó desde la última carga, y cuánto de eso fue el CCL y cuánto fueron tus activos;
- cuánto estás largo o corto en pesos, con la deuda del leasing restada.

Toda cifra existe en ARS y en USD. Toda cifra se toca y muestra de dónde sale: la fórmula con los valores, los insumos, la carga y el archivo.

**No es:**
- **No recomienda nada.** No te dice qué comprar ni qué vender, y no propone números para tus supuestos (D-07).
- **No trae precios de internet** ni se conecta con IEB, Galicia o Mercado Pago. Todo precio sale de lo que cargás vos.
- **No inventa datos.** Lo que no cargaste dice **"sin dato"**, nunca 0 ni una estimación. Un precio de hace días se usa, pero marcado como **viejo**.
- **No es multiusuario.** Hay una sola clave, la tuya.

## 2. Cómo entrar

1. Abrí **https://portfolio-xi-rose-23.vercel.app** (en la compu o en el teléfono).
2. Escribí la clave. Es el valor de `APP_PASSWORD` que cargaste en Vercel.
3. La sesión dura **30 días** en ese dispositivo. Para cerrarla antes: **Ajustes › Sesión › Salir**.

- Si te equivocás de clave, la app tarda casi un segundo y dice "Esa no es la clave. Probá de nuevo." Desde el tercer error seguido, la entrada además se traba un rato que se duplica con cada error (1 s, 2 s, 4 s…, hasta 5 minutos): es un freno contra quien quiera adivinarla.
- Si entraste desde un link a una pantalla (por ejemplo, Cargar), después de la clave vuelve a esa pantalla.
- Para cambiar la clave: cambiá `APP_PASSWORD` en Vercel y volvé a desplegar. Eso cierra todas las sesiones abiertas (lo mismo pasa si cambiás `SESSION_SECRET`).

## 3. Lo que vale para todas las pantallas

### Pesos y dólares, sin leer el símbolo

- El monto en **dólares** va siempre dentro de una **pastilla** levemente tintada, con "US$". El de **pesos** va en tinta normal, con "$".
- En tablas y pares, los pesos van a la izquierda (o arriba) y los dólares a la derecha (o abajo).
- En la tarjeta de un activo, el número grande es el de la moneda en la que el activo **arriesga**: un CEDEAR muestra dólares arriba; una LECAP, pesos.
- Positivo y negativo van por color **y** por signo y flecha: "+1,8% ▲", "−0,6% ▼". Verde y rojo, solo para resultados.

### "¿De dónde sale?": la traza

**Tocá cualquier cifra** (o hacé clic, o llegá con Tab y apretá Enter). Se abre un panel; en el teléfono, una hoja desde abajo. Tiene, en este orden:

1. **La fórmula con los valores reales**, por ejemplo: `1.240 × $35.150 ÷ CCL 1.548,20 = US$ 28.152,69`.
2. **Ver insumos ▸**: de qué está hecha esa cifra, de a un nivel. Cada insumo dice de qué carga salió y, si vino de un archivo, de dónde: "Excel de IEB, hoja Patrimonio, fila 18".
3. **¿Qué es esto?**: una línea en castellano. Por ejemplo, "Lo que valen tus CEDEARs de SPY si los pasás a dólares al CCL que cargaste".

En el desglose, la traza dice además "de lo cual: interacción": la parte que se debe a que se movieron a la vez el activo y el CCL. Ya está incluida; se muestra para que sepas cuánto es.

Escape, o tocar afuera, la cierra. En Hoy, debajo de la frase, "Tocá una cifra para ver de dónde sale" te lo recuerda.

### "Sin dato"

Cuando falta un insumo, la cifra dice **sin dato**, en gris. Al tocarla, dice qué falta: "Falta el CCL de compra de la apertura", "No hay un precio cargado". Nunca hay un 0 ni un guion en lugar de un dato que falta.

**Un total al que le falta una parte también es "sin dato"** (D-65). Debajo, en gris, va la suma de lo que sí se conoce, rotulada como parcial: "suma parcial (3 de 6 posiciones): +US$ 1.630,45".

### Las etiquetas

Una cifra que no es un dato verificado lleva un chip gris chico, con una palabra. Si hereda varias, muestra la más grave. **Lo verificado no lleva nada:** un día normal, Hoy no tiene chips.

| Etiqueta | Qué quiere decir | Ejemplo |
|---|---|---|
| **parcial** | Es un total y le faltan partes. El valor es "sin dato" y la suma parcial va abajo | El total de "Res. USD" de Cartera cuando una posición no tiene CCL de compra |
| **pendiente** | Falta un dato que llega después | El costo de una compra del día, que IEB muestra con PPP `-` hasta el día siguiente |
| **viejo** | El dato tiene más de 2 días hábiles (los feriados no cuentan) | Un precio que no se actualiza porque no cargaste esa cuenta; el CCL de hace tres días hábiles (D-16, D-109) |
| **inferido** | Se calculó a partir de otro dato; no se leyó tal cual | El precio de una compra deducido del cambio de PPP; una compra pendiente valuada al precio del día (D-110) |
| **declarado** | Lo cargaste vos, sin respaldo de una fuente | El CCL de compra de una posición que ya tenías antes de la primera carga |

### "Sin atribuir"

El cambio de tu patrimonio se separa en **lo que pusieron tus activos** y **lo que puso el CCL**. Para separarlo hace falta, en las dos puntas del intervalo, el precio (o el saldo) y un CCL tipeado ese día. Cuando una partida no tiene dato nuevo (no cargaste esa cuenta, o fue una carga express), su cambio queda **"sin atribuir"**: es real, suma al total, pero todavía no se sabe de qué fue. **Cuando llega el dato, se atribuye.** Activos + CCL + sin atribuir dan siempre el cambio total, exacto (D-35).

La casa, la camioneta y la deuda del leasing conservan su última valuación en su propia moneda. Con un CCL nuevo, su cambio en la otra moneda es efecto del tipo de cambio (en la deuda en pesos, licuación), no "sin atribuir".

### El CCL con que se pasa a dólares

Cada pantalla pasa a dólares con el CCL del día de los datos. Si ese día no tipeaste CCL, usa el último que tipeaste y lo dice: "CCL 1.531,70 del mar 13/10 (ese día no cargaste CCL)". Pasados 2 días hábiles, ese CCL lleva la etiqueta "viejo" (D-109). Nunca usa un CCL que no hayas tipeado vos.

### Teclado

- `c` abre Cargar; `h` prende y apaga el modo privado. Las teclas de una letra andan solo si ningún campo tiene el foco.
- En Cargar alcanzan Tab y Enter: no hace falta el mouse. En la bandeja, ↑ y ↓ pasan de fila, y A, E y P aceptan, editan o dejan pendiente la fila que tiene el foco.

## 4. Las pantallas

En la compu, la barra lateral tiene tres grupos: **Diario** (Hoy y Cargar), **Patrimonio** (Cartera y Exposición) y **Al pie** (Registro, Datos y Ajustes). Se colapsa a íconos con su botón. En el teléfono, abajo: **Hoy · Cartera · [Cargar] · Exposición · Más**; "Más" abre Registro, Datos y Ajustes.

Arriba, en todas las pantallas, el **chip de estado de los datos**: "Datos al cierre del mié 14/10 · 5 de 5 fuentes". Tocalo y muestra cada fuente con su estado:

| Signo | Quiere decir |
|---|---|
| ✓ | La cuenta está cargada y al día |
| ≠ | Quedó una diferencia sin resolver |
| ○ | Tipeado, sin control posible: el CCL y el cripto |
| ◷ | Más de 2 días hábiles sin carga |

El resultado de cada control (el Excel contra B2 y sus Subtotales, la captura de Galicia contra su total) se ve en la bandeja de esa carga. En la barra, el botón de Cargar lleva un punto gris cuando es día hábil y todavía no cargaste.

### 4.1 Hoy

**Para qué:** saber en diez segundos cuánto tenés y qué pasó.

**La frase del día.** Siempre dice desde cuándo mide. Ejemplo:

> Desde la carga del mar 13/10: +$590.125 en pesos (+0,57%), pero −US$ 340 en dólares (−0,50%). En pesos, el CCL sumó $532.812 y tus activos $57.313. En dólares, tus activos sumaron US$ 37 y la suba del CCL le restó US$ 377 a tus pesos.

- "**El CCL sumó $532.812**" es lo que ganaste en pesos solo porque subió el dólar, sobre lo que tenías en activos que arriesgan dólares. Su traza: `US$ 32.291,66 que tenías en activos en dólares × (1.548,20 − 1.531,70) = $532.812,44`.
- "**Tus activos $57.313**" es lo que se movieron los precios y saldos.
- "**La suba del CCL le restó US$ 377 a tus pesos**": tus activos en pesos valen lo mismo en pesos, pero menos en dólares.
- Las partes se redondean de modo que **lo que ves suma exacto lo que ves**. El valor exacto está en la traza.
- Si hay partidas sin dato nuevo, la frase agrega cuánto quedó **sin atribuir**. Si hoy se atribuye lo que había quedado pendiente de cargas anteriores, también lo dice: "Incluye lo que había quedado sin atribuir en cargas anteriores y hoy se atribuye".
- Después de una **carga express**: "Cargaste solo tipos de cambio: ningún precio ni saldo es nuevo, así que todo el cambio queda sin atribuir hasta tu próxima carga completa."
- Si la carga **no tiene CCL**: "Esta carga no tiene CCL: los dólares usan el del mar 13/10 y no hay con qué separar activo de tipo de cambio…" (D-109).
- En el teléfono, la frase es texto corrido. **"Ver la frase completa y cada cifra"** abre una hoja con cada número en su renglón, para tocarlo.

**Las dos tarjetas** (D-03):
- **Patrimonio financiero**: lo invertible. Tus posiciones de IEB y Galicia y la liquidez de las tres cuentas. Sobre esto se miden Cartera, la concentración y los resultados. Debajo, su variación y su desglose: activos, CCL y, si hay, sin atribuir. Las tres partes suman la variación.
- **Patrimonio total**: el financiero, más la casa, más tu parte de la camioneta (su valuación menos el capital pendiente del leasing), "sujeta a opción de compra". Dice la fecha de cada valuación.

**Pesos financieros − deuda del leasing** (D-101). Tus activos financieros que arriesgan pesos, menos lo que debés del leasing: "largo $32.783.100 ($54,18 M − $21,40 M) · US$ 21.175 · si el CCL sube 1%, pierde US$ 210". **Largo** quiere decir que tenés más pesos que deuda en pesos: si el dólar sube, perdés en dólares. El "+1%" es una sensibilidad, no un pronóstico. La casa y la camioneta no entran: les falta la moneda de riesgo, que se elige desde la 1b (D-73).

**Atención.** Lo que le falta a tus datos, con un botón: "Falta el CCL", el CCL que se está arrastrando de otro día, "SPY: dato viejo", "Casa: sin valuación", "Leasing: sin capital pendiente", "T30J7: compra con precio pendiente", "YPFD: declarar CCL de compra". En la compu va en una columna a la derecha desde 1280 px; en el teléfono, en un renglón que se despliega. Si no hay nada: "Tus datos están completos. Nada que revisar."

**Lo demás:**
- **"Todavía no cargaste hoy · Cargar"**, un día hábil sin carga.
- **Un día de datos sin CCL** lo avisa arriba: "El mié 14/10 no tiene CCL: los dólares usan el CCL del mar 13/10 y el cambio del día queda sin atribuir" (D-109).
- **"Quién movió tu financiero"**: cada posición con su aporte a la variación. Una sin precio nuevo dice "sin precio nuevo", nunca 0.
- **El cuadre:** el patrimonio de hoy recalculado desde los hechos, contra el de la carga anterior más cada parte de la frase (D-66). ✓ quiere decir que cierra en pesos y en dólares; ≠, que no cierra (el detalle dice por cuánto: si no tiene explicación, es un bug); ○, que no se puede verificar porque falta un dato del financiero. Un caso conocido de ≠: un cobro (por ejemplo, un dividendo en dólares) que entró a un saldo que nunca cargaste; cargá ese saldo.
- **"Excedente de octubre: sin dato · llega con Flujo (fase 2)"**: la cifra existe en el spec, pero su sección todavía no.
- **En diciembre**, un aviso: "La carga del último día hábil del año es tu foto al 31/12: la vas a necesitar para Bienes Personales" (D-76). Ese día hacé la carga completa.
- **Sin datos todavía**, Hoy muestra el **Día cero** con los accesos a Datos y a Cargar (ver la sección 5). Después de la primera carga dice "Primera carga guardada. Mañana vas a ver qué cambió y por qué."

### 4.2 Cargar

**Para qué:** la carga del día en menos de 60 segundos de tiempo activo, con Tab y Enter. El paso a paso está en la sección 6; acá, qué es cada cosa.

**Arriba**, la fecha de los datos y de dónde salió: "Datos del mié 14/10 (fecha tomada del Excel de IEB, celda B1)". La fecha la da la fuente, no el reloj (D-61): si cargás el jueves a la mañana el Excel del miércoles, todo va al miércoles. Se puede cambiar a mano ("elegida por vos").

**Los campos de tipo de cambio:**
- **CCL** y **dólar cripto (venta)**. Arrancan **vacíos**: el valor de ayer aparece solo como ayuda, nunca como valor. No se puede guardar un CCL que no tipeaste.
- Se tipean como en el home banking: `1548,2`. El eco confirma lo que entendió: "= 1.548,20", con la variación contra la carga anterior.
- **Referencia del CCL:** de dónde lo sacaste ("promedio", "Ámbito, cierre"). Se recuerda en el dispositivo y se guarda con el tipo de cambio.
- **+ Nota del día:** una línea opcional ("el CCL saltó por la licitación"). Queda guardada con el lote; en la 1b va a aparecer como marca en Evolución.

**La zona de archivos.** En la compu: "Soltá o pegá acá (Ctrl+V)". En el teléfono: "Elegir archivos". Acepta el Excel "Portafolio" de IEB (.xlsx) y capturas (imágenes) de Galicia y de Mercado Pago, **en cualquier orden**. Cada archivo se empieza a leer apenas entra, mientras seguís tipeando:
- el Excel lo lee un programa, sin IA, en menos de un segundo;
- cada captura la lee Claude **dos veces, de dos maneras distintas**, y la aritmética decide. Tarda unos segundos;
- la app reconoce sola de qué cuenta es cada archivo. Si cargás dos de la misma cuenta, vale la más nueva (o la que elijas).

**La bandeja.** Lo que entendió de cada fuente, con lo raro arriba: "12 leídas · 11 verificadas · 1 a revisar".

| Estado | Qué es | Qué hacés |
|---|---|---|
| **Verificada** | Cerró su control | Nada: el Enter la guarda. Van plegadas |
| **Advertencia** | Algo para mirar: dos lecturas distintas, un saldo que saltó, una fecha que no coincide, una conciliación | Elegís una de sus opciones (la opción es el motivo, que queda grabado) o "Dejar pendiente". Si no la tocás, el Enter la deja pendiente |
| **Error** | La aritmética no cierra, o un número no se pudo leer | Lo corregís ("Corregir lectura") o lo dejás pendiente. **Frena el Enter** |
| **Sin alta** | El ticker no está en tu catálogo | Lo das de alta ahí mismo (ver abajo) |
| **Pendiente** | Lo dejaste para otro día | No se graba: esa posición conserva su cantidad y su último precio (que se pondrá viejo si no lo cargás), y la cuenta queda con "listado incompleto" |

Con el teclado, en la bandeja: ↑ y ↓ pasan de fila; **A** acepta (o completa, o da de alta), **E** edita y **P** deja pendiente. Los mismos botones están siempre a la vista.

Lo que podés encontrar en la bandeja:
- **Dos lecturas que no coinciden** (en una captura): "Lectura A: $4.912.300 · Lectura B: $4.912.800", con un botón por cada una. Si una de las dos cierra la cuenta, la app la propone.
- **Conciliación** (D-15): "el bróker tiene 9.000.000 y la app 8.000.000: falta una compra de 1.000.000 a $1,0986 (inferido del PPP, sin comisiones)". Nunca se aplica sola: la aceptás, la editás o la dejás pendiente. Si el bróker tiene menos, propone una venta con el precio de hoy como referencia (corregilo si vendiste a otro). Si tiene más cantidad con el mismo costo total, pregunta "¿Cambio de ratio?" y propone un ajuste de ratio. La primera vez que aparece cada posición, la propuesta es una **apertura** con el PPP del bróker como costo (D-14).
- Una compra o una venta propuesta necesita el **CCL del día**: si no lo tipeaste, la fila queda en error hasta que lo tipees.
- **Compra del día:** IEB muestra el PPP como `-`. Se graba como compra con precio pendiente (D-19).
- **Completar precio:** al día siguiente, con el PPP nuevo, la bandeja propone el precio de esa compra: "(10.200 × 110 − $1.000.000) ÷ 10 = $12.200". Lo aceptás con un toque ("Completar"), tipeás otro precio ("Editar precio") o grabás la fila sin completarlo, y la compra sigue pendiente (D-110). Mientras tanto, la compra se valuó al precio del día, con la etiqueta "inferido"; al completarse, los días que usaron ese precio se recalculan con el real y su frase puede cambiar un poco.
- **"¿Entró o salió plata?"**: un saldo remunerado (el de Mercado Pago, que muestra su TNA) subió más de lo que explica esa TNA, o bajó (los intereses no restan). Sin registrar el movimiento, la suba se leería como ganancia y la baja como pérdida. El acceso "Registrar el aporte (o el retiro) en Datos › Movimientos" abre, en otra pestaña, el movimiento ya precargado para que lo confirmes (sección 9). El efectivo de IEB no pregunta nada: sube y baja con cada compra y venta.
- **Alta de un ticker:** tipo, **moneda de riesgo** ("¿a qué moneda te expone? Un CEDEAR es dólares"), geografía, indexación (bonos), subyacente y ratio (CEDEAR) y color. La moneda de riesgo no tiene valor por defecto: la elegís vos (D-73). La bandeja se rearma sola.
- **Controles de la cuenta:** "IEB cierra contra B2 ✓", "Subtotal Cedears ✓", "Galicia: total de la captura ✓". Un control al que le falta un término dice **no verificable**: nunca cuenta como OK.
- **El dólar de IEB:** IEB pasa tus dólares a pesos con su propio precio (el de DOLARUSA), no con tu CCL. La bandeja muestra esa diferencia con nombre, para que no parezca un error (D-66).

**El botón Guardar** dice qué va a hacer el Enter, con números: "Guardar 11 · dejar 1 pendiente". Mientras algo se lee: "Esperando Mercado Pago (leyendo…)", y al lado "Guardar sin Mercado Pago". Con un error: "Resolvé 1 error para guardar". Abajo, el tiempo activo que va llevando la carga.

**Después del Enter:** "Guardado · 41 s activos", con lo que se grabó por cuenta (precios, saldos, operaciones y, si hubo, precios completados), y tres botones: **Ver Hoy**, **Deshacer** y **Nueva carga**.

### 4.3 Cartera

**Para qué:** cada posición en pesos y en dólares, con su desglose.

**En la compu**, una tabla. Las columnas, en el orden en que entran según el ancho: Activo, Res. USD, Res. ARS, % fin., Precio, Activo / TC en US$, Activo / TC en $, PPC USD, PPC ARS, Cant., Días. Las que no entran van al **detalle de la fila** (el chevron ›). Si colapsás la barra lateral entran más; desde unos 1600 px, todas.

| Columna | Qué es |
|---|---|
| **Cant.** | Lo que tenés, derivado de tus operaciones (apertura, compras, ventas) |
| **PPC ARS** | Precio promedio de compra en pesos, por unidad (o por 1 VN en bonos y letras) |
| **PPC USD** | Lo mismo en dólares: cada compra pasada a dólares con el CCL de su día. En una posición que ya tenías antes de la primera carga, "sin dato", porque no se conoce el CCL de la compra original (D-14) |
| **Precio** | El último precio cargado, por unidad o por 1 VN. Si es viejo, la fila va en gris con su chip |
| **Res. ARS / Res. USD** | Resultado desde la compra, en $ y en %: lo que vale hoy menos lo que costó, en cada moneda |
| **Activo / TC en $** y **en US$** | El resultado partido en lo que hizo el activo y lo que hizo el tipo de cambio |
| **% fin.** | Su peso en tu patrimonio financiero |
| **Días** | Días en posición: desde la primera compra registrada o desde la fecha de compra declarada. En una posición que ya tenías antes de la primera carga y sin fecha declarada, se cuentan desde la apertura en la app, y lo dice |

**Cómo leer el desglose.** La moneda de riesgo decide dónde aparece el efecto del CCL:
- **Un CEDEAR** arriesga dólares. En pesos, su resultado tiene una parte de activo y otra de CCL: "De tus +$6,21 M en pesos, $3,44 M fueron el CCL". En dólares, todo es activo.
- **Una LECAP o un bono en pesos** arriesgan pesos. En dólares, su resultado tiene una parte de activo y otra de CCL; por ejemplo, S13N6: +US$ 326,16 de activo y −US$ 247,94 de CCL = +US$ 78,22. En pesos, todo es activo.
- El desglose desde la compra es la **suma de los mismos intervalos** que usa Hoy, así que Cartera y Hoy dan el mismo reparto (D-35). Lo anterior a tu primera carga es un solo tramo por compra, con el CCL de compra. Si la última carga no trajo precio o CCL nuevo para esa posición, el desglose muestra también lo que queda **sin atribuir**. La traza lista cada tramo.

**Cupones, dividendos y amortizaciones** (D-114). Una amortización te devuelve capital: baja el costo de la posición en lo que cobraste, así que no aparece como pérdida. Un cupón o un dividendo no toca el costo: se ve en la frase del día en que lo cobrás (pasa del título a tu saldo). El resultado de cada fila es el del título, sin los cupones cobrados.

**Totales** fijos abajo. Si a una columna le falta una fila, el total es "sin dato" con la suma parcial (D-65). Pasa todos los días con las posiciones sin CCL de compra.

**La liquidez** (los pesos y dólares de cada cuenta) va en un bloque aparte, al pie, con el patrimonio financiero.

**Filtros:** por cuenta, clase y moneda de riesgo; "solo con sin dato"; "solo precios viejos". Se ordena tocando el encabezado de cualquier columna.

**En el teléfono**, una tarjeta por posición: arriba, la moneda en la que arriesga, en grande; una grilla con los resultados; y la línea del desglose. Si ganás en pesos y perdés en dólares, lo dice un chip: **"ganás en pesos, perdés en dólares"**. Los totales van en una tarjeta al final.

### 4.4 Exposición

**Para qué:** ver la deuda en pesos como lo que es, una posición corta en pesos, y tu neto contra el peso.

**Arriba, el selector Financiero · Total**, con lo que netea cada vista escrito en su rótulo (D-101):
- **Financiero:** "pesos financieros − deuda del leasing".
- **Total:** eso más cada bien, en la moneda de riesgo que le elijas. Mientras la casa y la camioneta no tengan moneda de riesgo (se elige desde la 1b), el neto total es **"sin dato"**, con la suma parcial sin ellas, y en la composición por moneda aparecen como "Sin elegir": la camioneta no entra en silencio por estar valuada en pesos.

**La frase:**

> Estás **largo en pesos por $32.783.100** (US$ 21.175): tus pesos financieros ($54,18 M) superan lo que debés del leasing ($21,40 M). Por cada +1% de CCL: en dólares, ese neto pierde US$ 210; en pesos, tus activos en dólares suman $500.884.

**Largo, corto y neto:** tus pesos financieros, el capital pendiente del leasing (lo que informa la leasera), el neto en pesos y en dólares, y tus activos que arriesgan dólares ("CEDEARs y dólares, aunque coticen en pesos").

**Composición**, en barras horizontales: por clase, por moneda de riesgo y por geografía. La liquidez cuenta en la geografía de su custodio: los dólares que están en IEB son AR en geografía y USD en moneda de riesgo.

**Concentración:** tu posición más grande y tus tres más grandes, como porcentaje del **patrimonio financiero** (también en la vista Total, D-03). Dice "sin umbral": la app no juzga la concentración hasta que cargues el tuyo (1b, D-42).

### 4.5 Registro

**Para qué:** el log de cargas que pediste (D-17): qué entró, de qué archivo, cuánto tardó, y dónde se revierte.

- **Una tarjeta por lote** (un Enter, o un guardado de Datos): la fecha de los datos, la hora en que guardaste, el tiempo activo y las fuentes.
- **Cada carga del lote** (una por cuenta, más la del tipo de cambio): origen (Excel, captura, manual), cuántos precios, saldos y operaciones grabó, el archivo, el número de carga y su estado:
  - **vigente:** sus datos son los que valen;
  - **reemplazada:** ese día y esa cuenta se volvieron a cargar después; la carga sigue a la vista;
  - **revertida:** se deshizo (el motivo queda guardado con la carga); la carga sigue a la vista, tachada.
- **Revertir el lote:** ver la sección 8.

En el teléfono, las cargas de cada lote se abren al tocar la tarjeta.

### 4.6 Datos

El título es el selector: tocá **"Datos · Catálogo ▾"** para cambiar de subpantalla. Cada guardado de Datos es una carga **manual** y queda en el Registro.

| Subpantalla | Qué tiene |
|---|---|
| **Catálogo** | Tus activos: ticker, nombre, tipo (CEDEAR, acción local, bono, LECAP, FCI), moneda de riesgo, geografía, indexación (bonos), subyacente y **ratio con su historia** (CEDEAR: un ratio nuevo se carga con su fecha "vigente desde"), color fijo para los gráficos, y si se sigue ofreciendo en las cargas |
| **Cuentas** | IEB, Galicia y Mercado Pago, y cómo llega cada una a Cargar (Excel o captura) |
| **Bienes** | La casa y la camioneta: tipo, moneda en que lo valuás, la deuda que lo financia (la camioneta, con su leasing), y sus **valuaciones fechadas con su fuente** (tasación, guía de precios). Cada valuación se muestra también en la otra moneda, al último CCL, con su traza. Sin valuación, el valor es "sin dato" (D-04) |
| **Leasing** | El contrato (montos **netos de IVA**; lo que no tengas a mano queda vacío): moneda, cantidad de cuotas, monto financiado, anticipo, valor del bien, opción de compra y su fecha. Y el **capital pendiente informado** por la leasera, con su fecha: es lo que se resta en Exposición |
| **Movimientos** | Aportes, retiros y transferencias entre tus cuentas (sección 9) |

### 4.7 Ajustes

- **Tema:** el del sistema, claro u oscuro.
- **Paleta para daltonismo:** positivo en azul y negativo en naranja, en lugar de verde y rojo. El signo y la flecha siempre están.
- **Modo privado:** oculta los montos y deja los porcentajes. Atajo: `h`, o el ojo de la barra de arriba.
- **Barra lateral:** automática (expandida desde 1280 px), siempre expandida o siempre en íconos.
- **Atajos** de teclado.
- **Sesión:** dura 30 días en el dispositivo; **Salir** la cierra.

Todo esto se recuerda **por dispositivo**: el teléfono y la compu tienen cada uno el suyo.

## 5. El Día cero, paso a paso

Una sola vez, unos 40 minutos (D-70). El orden importa: el día 2 tiene que mostrar números, no "sin dato" por todos lados.

**Antes de empezar, tené a mano:**
- el contrato del leasing y el último capital pendiente que te informó la leasera, con su fecha;
- una valuación de la casa y otra de la camioneta, con su fuente (tasación, guía de precios) y su fecha;
- para cada activo que tenés: tipo, a qué moneda te expone, geografía y, si es CEDEAR, su ratio y desde cuándo rige;
- el CCL y el dólar cripto del día, y de dónde los sacás;
- el Excel "Portafolio" de IEB del día, y las capturas de Galicia (la pantalla de tenencia, con la tabla de instrumentos y su total) y de Mercado Pago (el saldo de la cuenta remunerada, con su TNA).

**Paso 1 · Datos › Leasing.** Cargá el contrato (lo que tengas; el resto queda vacío) y el último **capital pendiente** informado, con su fecha. Sin él, Exposición no puede restar la deuda.

**Paso 2 · Datos › Bienes.**
- **La casa:** tipo inmueble, la moneda en que la valuás, y su valuación con fecha y fuente.
- **La camioneta:** tipo vehículo, y en "Deuda que lo financia" elegí el leasing del paso 1. Después, su valuación con fecha y fuente. Tu parte es el valor menos el capital pendiente, "sujeta a opción de compra" (D-03).

**Paso 3 · Datos › Catálogo** (opcional). Si preferís, das de alta tus activos ahora. Si no, la bandeja te los pide en el paso 4. Para cada uno, la moneda de riesgo la elegís vos: la app no la supone (D-73). A cada CEDEAR, su ratio con su vigencia.

**Paso 4 · La primera carga.** En **Cargar**:
1. CCL, Tab, dólar cripto. Completá la referencia del CCL.
2. Soltá el Excel de IEB.
3. Pegá la captura de Galicia y la de Mercado Pago (Ctrl+V, o "Elegir archivos" en el teléfono).
4. Esperá a que las tres digan que terminaron de leer.

**Paso 5 · La bandeja.**
- Cada posición aparece como **apertura**, con el PPP del bróker como costo (D-14). Su PPC en dólares va a quedar "sin dato", porque no se sabe con qué CCL compraste originalmente.
- Da de alta los tickers que falten, eligiendo su moneda de riesgo.
- Mirá los controles: B2 y los Subtotales de IEB, el total de Galicia.
- Resolvé los errores (o dejalos pendientes) y elegí en las advertencias.

**Paso 6 · Enter.** Hoy dice "Primera carga guardada. Mañana vas a ver qué cambió y por qué." Desde el día siguiente, la frase del día empieza a contar.

**Si la primera carga es con fecha pasada** (por ejemplo, la foto del 30/12 que guardaste para cargar después): las aperturas se crean a la fecha del B1 del Excel, con el CCL y el cripto que anotaste para ese día. Las cargas siguientes, también con su fecha, arman la historia en orden.

## 6. La rutina diaria, en menos de 60 segundos

Después del cierre (o a la mañana siguiente, con los datos del día anterior):

1. **Juntá las fuentes:** el Excel "Portafolio" de IEB y las capturas de Galicia y de Mercado Pago. Recortá la captura a la tabla (ver "Una captura demasiado grande" en la sección 12).
2. **Abrí Cargar:** `c` en la compu, o el botón del medio en el teléfono. El foco arranca en el CCL.
3. **Tipeá** `1548,2` → Tab → `1541`. Mirá el eco.
4. **Soltá el Excel y pegá las dos capturas.** Se leen mientras tanto.
5. **Mirá la bandeja.** Lo normal es que todo esté verificado y plegado. Resolvé solo lo que está arriba.
6. **Enter.** "Guardado · 41 s activos". Tocá **Ver Hoy** y leé la frase.

**El tiempo que cuenta es el activo** (D-62): la suma de los tramos en que hacés algo (tipear, pegar, tocar). Un tramo se corta después de 60 s sin gestos, así que esperar a que lea una captura no cuenta. El Registro guarda el tiempo activo de cada carga.

**Un día sin cargar no es una falta.** Lo viejo se ve viejo, nada se rellena con estimaciones y ningún contador vuelve a cero.

## 7. Las tres cargas: express, media y completa

Las tres son válidas (D-64):

| Carga | Qué hacés | Tiempo activo | Qué se actualiza |
|---|---|---|---|
| **Express** | CCL + cripto + Enter | unos 10 s | El tipo de cambio del día. Todo se revalúa al CCL nuevo, pero como ningún precio ni saldo es nuevo, **todo el cambio del día queda "sin atribuir"** |
| **Media** | + el Excel de IEB | unos 30 s | Precios, cantidades y saldos de IEB. Galicia y Mercado Pago siguen con su último dato: lo de ellos queda sin atribuir |
| **Completa** | + las capturas de Galicia y de Mercado Pago | menos de 60 s | Todo |

**Lo que no cargaste, se atribuye después.** Si el jueves hacés una express y el viernes una completa, el viernes se desglosa entero el intervalo miércoles → viernes de cada partida que el jueves quedó sin dato, con el CCL de sus dos puntas, y se devuelve lo que el jueves había quedado sin atribuir. Así cada día suma exacto, un período es la suma exacta de sus días y **una carga express entre dos completas no cambia el desglose del período** (D-35).

**Un día sin CCL** (por ejemplo, una carga media sin tipear el CCL) usa el último CCL tipeado para pasar a dólares, con su fecha a la vista y la etiqueta "viejo" pasados 2 días hábiles. Pero en ese intervalo no atribuye nada a activo ni a CCL hasta que haya uno tipeado (D-109).

**Recargar el mismo día** una cuenta reemplaza su carga anterior: pisa precios y saldos de ese día y **suma** las operaciones que falten. La anterior queda en el Registro como "reemplazada". Si la primera carga estaba mal, no recargues: revertila (sección 8).

**Un saldo que aparece por primera vez** (una cuenta nueva, o la primera captura de Mercado Pago un día después del primer Excel) entra como apertura, nunca como ganancia.

## 8. Deshacer y revertir

> **Por ahora no anda.** Deshacer y Revertir necesitan una función de la base (`revertir_lote`) que todavía no está aplicada en Supabase (ver `docs/datos.md`). Hasta que se aplique, los dos botones muestran un error que lo dice y no cambian nada. Mientras tanto, si una carga salió mal, volvé a cargar ese día: la carga nueva reemplaza precios y saldos de esa cuenta (las operaciones se suman, así que revisá la bandeja antes del Enter).

**Deshacer**, justo después del Enter: el botón de la pantalla "Guardado" revierte ese lote con el motivo "Deshacer inmediato" y te devuelve todo a la pantalla para corregirlo. La carga siguiente es un lote nuevo.

**Revertir**, más tarde, desde el **Registro**:
1. Buscá el lote y tocá **Revertir el lote**.
2. Elegí el motivo: "lectura equivocada", "archivo de otro día" u "otro" (que pide que escribas por qué).
3. Confirmá.

Qué hace (D-104):
- borra lo que grabó ese lote y **restaura lo que había pisado**, desde la auditoría (por ejemplo, el precio del día que esa carga había reemplazado);
- deja las cargas en el Registro, marcadas **revertidas**, con su motivo: no desaparecen;
- si ese día y esa cuenta tenían una carga anterior reemplazada, vuelve a ser la vigente;
- si ese lote había completado el precio de una compra pendiente, la compra vuelve a quedar pendiente.

**Solo se puede revertir la última carga de cada cuenta.** Si después cargaste esa cuenta otra vez, el mensaje dice qué carga lo impide: revertí primero esa. Tampoco se puede si algo posterior se apoya en una de sus operaciones.

**Un lote revertido no se vuelve a usar.** Para volver a cargar esos datos, empezá una carga nueva con los mismos archivos.

## 9. Aportes, retiros y transferencias

Si no se registran, un depósito de US$2.000 se leería como ganancia (D-06). Se cargan en **Datos › Movimientos** (D-111), con "Nuevo movimiento de capital":

1. **¿Qué fue?**
   - **Aporte:** plata de afuera que entra a una cuenta (por ejemplo, dólares vendidos a cripto).
   - **Retiro:** plata que sale de una cuenta hacia afuera (gastos, pagos).
   - **Transferencia:** entre dos cuentas tuyas (por ejemplo, de Galicia a Mercado Pago), con el impuesto si lo hubo.
2. **Fecha**, y la de **acreditación** si llegó otro día.
3. **La cuenta** (o las dos, en una transferencia) y **cuánto salió o entró**. Si cambió de moneda ("vino de otra moneda", "se convirtió a otra moneda al salir"), los dos montos y el **tipo de cambio aplicado**.
4. En una transferencia, el **impuesto** que te cobraron, en la moneda de origen. Notas, si querés.
5. **Registrar movimiento.** Queda como una carga manual en el Registro.

Debajo, "Últimos movimientos": cada uno con lo que salió y lo que entró, en las dos monedas al CCL de su fecha. Un movimiento no se edita ni se borra: si te equivocaste, revertí su carga desde el Registro y cargalo de nuevo.

**Cuándo hacerlo:** el día que movés plata. Si te olvidás, la bandeja te lo recuerda cuando el saldo de Mercado Pago sube más de lo que explica su TNA o cuando baja ("¿Entró o salió plata?"), y su acceso abre el formulario con el movimiento precargado (cuenta, moneda, monto y fecha) para que lo revises y lo confirmes.

## 10. Modo privado, tema y paleta

- **Modo privado:** el ojo de la barra de arriba, o `h`. Desenfoca los montos y deja los porcentajes, para mirar la app con gente al lado.
- **Tema:** en Ajustes, el del sistema, claro u oscuro.
- **Paleta para daltonismo:** en Ajustes. Positivo en azul, negativo en naranja.

Los tres se recuerdan por dispositivo.

## 11. Qué falta en la 1a y qué trae cada fase

**Lo que la 1a todavía no tiene:**
- **Validación con tus archivos reales.** Los lectores se probaron con archivos sintéticos con la misma estructura (`docs/calidad.md`). Tu primera carga real es la prueba que falta: si algo no cierra, es un bug, aunque los tests pasen.
- **Respaldo nocturno** de la base, restaurado y verificado (D-58). Hasta que exista, dependés de los respaldos de Supabase, que según el plan pueden no existir (D-55). Los archivos originales sí quedan guardados en la app desde el primer día.
- **Borrador de la carga:** si cerrás la pestaña antes del Enter, se pierde la bandeja y hay que volver a soltar los archivos. Los archivos ya leídos quedan guardados en el servidor, pero la bandeja no se recupera.
- **Empezar la carga en el teléfono y terminarla en la compu:** en la 1a, una carga se hace entera en un dispositivo (1b).
- **Declarar el CCL de compra** de una posición de apertura, para que su PPC en dólares deje de ser "sin dato": llega con Pendientes (1b). Hasta entonces, Atención lo lista.
- **Corregir un hecho suelto** con motivo e historial en la traza: por ahora, se revierte la carga y se carga de nuevo.
- **En el Registro, el detalle de cada carga:** la lectura cruda (las dos lecturas de una captura lado a lado), el modelo que leyó y el archivo original para abrirlo. Hoy se guardan, pero la pantalla muestra solo el nombre del archivo, los conteos y el estado.
- **Revertir una sola carga de un lote** (por ejemplo, solo la de Mercado Pago): en la 1a se revierte el lote entero. Tampoco hay "deshacer la reversión": para volver atrás, se carga de nuevo el archivo, que sigue guardado.
- **La moneda de riesgo de los bienes** (1b): hasta entonces, la vista Total de Exposición dice "sin dato".
- **Imágenes muy grandes:** no se parten solas; hay que recortarlas.
- **Dos compras con precio pendiente en la misma posición:** un solo PPP no alcanza para separarlas; la bandeja lo explica, pero no hay una pantalla para tipear esos precios.
- **Editar o borrar un movimiento de capital:** se revierte su carga desde el Registro y se carga de nuevo.
- Abrir la traza con el mouse encima (hover): hoy es con clic, toque o teclado.

**Lo que trae cada fase** (`docs/vision.md` §5; las fechas son estimaciones):

| Fase | Qué agrega |
|---|---|
| **1b · Núcleo completo** | Evolución y PnL (tu patrimonio en el tiempo, el puente del período y el PnL por mes); Pendientes como pantalla; la ficha de cada activo (con el CCL de empate de las LECAP); gráficos de Exposición; borrador compartido entre el teléfono y la compu; alias por bróker; pegar series (CCL histórico); tu tesis cargada como datos; umbrales; Ayuda con estos documentos adentro de la app |
| **2 · Contexto** | Pasivos (cuadro de marcha del leasing, cuota en pesos y en dólares, licuación, opción de compra); flujo de caja y cierre del mes; calendario con alertas (vencimiento a menos de 15 días sin destino decidido) |
| **3 · Motor** | Proyecciones con escenarios Baja · Igual · Sube, Monte Carlo y comparación de escenarios (D-08) |
| **4 · Disciplina** | Tesis y niveles contra tu cartera, la línea de veredicto ("Nada que hacer según tus reglas"), la revisión semanal, rendimientos realizados y la comparación contra SPY |
| **5 · Vida financiera** (propuesta) | Años con la foto al 31/12, impuestos, legado, seguros y retiro |

Muchas decisiones de `docs/vision.md` §6 siguen esperando tu aprobación. Las que la 1a ya usa están listadas, con cómo, al final de `docs/decisiones.md`.

## 12. Problemas comunes

**"La imagen es demasiado grande" (una captura).** La app nunca achica ni recomprime una captura, para no perder dígitos. Si el lado mayor pasa los 2.576 px (una captura de pantalla completa en una Mac Retina, o una de un iPhone Pro Max), la rechaza. **Recortá solo la tabla** (en la Mac, Cmd+Shift+4 y arrastrás) o mandala en dos partes. También rechaza archivos de más de 4 MB, y formatos que no sean PNG, JPEG, WebP o GIF. Las fotos HEIC del iPhone no se leen: compartilas como PNG o JPEG (en el iPhone, Ajustes › Cámara › Formatos › Más compatible).

**"Las dos lecturas no coinciden."** Cada captura se lee dos veces, de dos maneras distintas. Si difieren en un número, la app prueba qué combinación cierra la cuenta `cantidad × precio ≈ valorizado` y la propone. Mirá la captura y elegí la lectura correcta con un toque. Si ninguna cierra, la fila queda en **error**: corregí el número a mano ("Corregir lectura") o dejala pendiente. En Mercado Pago no hay cuenta que controle el saldo, así que siempre elegís vos cuando las lecturas difieren.

**"El Excel es de otro día."** La carga toma la fecha del B1 del Excel. Si la fuente es de un día distinto al de la carga, la bandeja avisa ("IEB: la fuente es del mar 13/10 y la carga es del mié 14/10"). Si te equivocaste de archivo, quitalo y soltá el correcto. Si ya guardaste, revertí el lote con el motivo "archivo de otro día". Una captura sin fecha visible (la de Mercado Pago, por ejemplo) toma la fecha de la carga. Si la carga no es de hoy, la bandeja lo avisa: si la captura es de hoy, dejala para otra carga.

**"No pude leer el Excel: …".** El mensaje dice qué falta: por ejemplo, "El Excel no tiene la hoja Patrimonio: ¿es el Portafolio de IEB?". La app lee solo el Portafolio en `.xlsx`: si dice "Es un Excel en formato viejo (.xls)", abrilo y guardalo como `.xlsx`, o volvé a descargarlo de IEB.

**"No pude leer la captura de …".** El mensaje dice qué pasó. Los más comunes:

| Lo que dice | Qué hacer |
|---|---|
| "… tardó más de 50 segundos y se cortó" | **Reintentar**. Si no querés esperar, **Dejar pendiente** y guardá el resto |
| "… se cortó antes de terminar. Si la captura tiene muchas filas, partila en dos" | Mandá la tabla en dos capturas |
| "no parece una pantalla de inversiones de Galicia ni el saldo de Mercado Pago" | Capturá la pantalla correcta |
| "no encontré ninguna posición ni total en la pantalla" | Capturá la tabla de Bonos (o de Fondos) de Galicia |
| "las dos lecturas no se ponen de acuerdo en de qué banco es" | Pegala de nuevo, en el lugar de su banco |
| "el saldo es ilegible en las dos lecturas" | Otra captura, sin nada que tape el número |
| "Anthropic limitó los pedidos" o "está sobrecargado" | Esperá un minuto y **Reintentar** |
| "la clave ANTHROPIC_API_KEY no es válida" o "problema de facturación en la cuenta de Anthropic" | Revisá la clave o el saldo de la cuenta de Anthropic; el Excel se sigue leyendo |

**"Falta configurar …".** Falta una variable de entorno en Vercel (proyecto `portfolio` → Settings → Environment Variables; después, volver a desplegar):

| Mensaje | Variable que falta |
|---|---|
| "Falta configurar APP_PASSWORD en Vercel." (en la entrada) | `APP_PASSWORD`, tu clave |
| "Falta configurar la base: SUPABASE_SECRET_KEY en Vercel" | `SUPABASE_SECRET_KEY`, la clave secreta del proyecto Portfolio de Supabase. Mientras falte, la app no muestra ceros: espera a la base. En Cargar podés leer archivos, pero no se guarda nada |
| "Falta configurar ANTHROPIC_API_KEY en Vercel para leer capturas." | `ANTHROPIC_API_KEY`. El Excel de IEB se lee igual |

**"Falta el CCL del día: lo necesita la operación."** La bandeja propone una compra o una venta, y toda operación se graba con el CCL de su día (sin él no hay PPC en dólares). Tipeá el CCL arriba, o dejá esa fila pendiente.

**"No lo entiendo como número"** (en el CCL, un saldo o un precio). La coma es el decimal y el punto, el separador de miles: `1548,2` o `1.548,20`. Lo ambiguo no se adivina: "1.0852" o "1,548.20" piden que lo corrijas.

**"Demasiados intentos seguidos. Esperá … y probá de nuevo."** Hubo tres claves equivocadas seguidas desde tu conexión. Esperá lo que dice (como mucho, 5 minutos) y escribí la clave con calma. Quince minutos sin errores borran el contador.

**"Sesión vencida: volvé a entrar."** Pasaron los 30 días, o cambió la clave. Entrá de nuevo; si estabas cargando, volvé a soltar los archivos.

**"No se puede revertir: después de la carga de IEB del … se confirmó otra de esa cuenta…".** Después de ese lote cargaste otra vez alguna de sus cuentas. Solo se revierte la última carga de cada cuenta: revertí primero la que nombra el mensaje.

**"Esa carga se confirmó y después se revirtió."** Un lote revertido no se reusa. Tocá **Nueva carga** y empezá de nuevo con los mismos archivos.

**"Algo falló al mostrar esta pantalla."** Nada se guardó ni se cambió. Tocá **Reintentar**; si sigue, el detalle quedó en los registros del servidor (Vercel → Logs), con la referencia que muestra la pantalla.

**Un número que no te cierra con lo que muestra el bróker.** Tocalo y seguí la traza hasta el archivo. Las diferencias de criterio tienen nombre (por ejemplo, IEB valúa tus dólares a su propio dólar y la app a tu CCL). Si no tiene explicación, es un bug: anotalo con la fecha y la cifra.

## 13. Palabras de la app

| Palabra | Qué quiere decir acá |
|---|---|
| **Apertura** | La operación con la que entra a la app una posición que ya tenías antes de la primera carga. Su costo es el PPP del bróker (D-14) |
| **Bandeja** | La lista de lo que la app entendió de tus archivos, antes de guardar |
| **Carga** | Lo que se grabó de una cuenta (o del tipo de cambio) en un Enter. Tiene su archivo, su lectura cruda y su estado |
| **Conciliación** | Comparar lo que dice el bróker con lo que la app deriva de tus operaciones, y proponer la operación que falta |
| **Control** | Una cuenta que la fuente trae para verificarse: B2 y los Subtotales de IEB, el total de Galicia |
| **Desglose** | El resultado partido en lo que hizo el activo y lo que hizo el tipo de cambio |
| **Lote** | Todo lo que guarda un Enter: una carga por cuenta, más la del tipo de cambio |
| **Moneda de riesgo** | A qué moneda te expone un activo, no en cuál cotiza: un CEDEAR cotiza en pesos pero arriesga dólares |
| **Patrimonio financiero / total** | Lo invertible / lo invertible más la casa y tu parte de la camioneta (D-03) |
| **PPC / PPP** | Precio promedio de compra. PPP es como lo llama IEB; PPC, la app |
| **Sin atribuir** | La parte de un cambio que todavía no se puede separar en activo y CCL, porque faltó un precio, un saldo o un CCL nuevo |
| **Tiempo activo** | Lo que tardaste de verdad en cargar: solo los tramos con gestos (D-62) |
| **Traza** | El panel que explica una cifra: fórmula, insumos, carga y archivo |
| **VN** | Valor nominal. Los bonos y letras se guardan con su precio por 1 VN (D-12) |
