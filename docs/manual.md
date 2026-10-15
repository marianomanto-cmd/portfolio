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

Escape, o tocar afuera, la cierra. En la compu, cada cifra de la frase de Hoy se toca en el lugar. En el teléfono, "Ver la frase completa y cada cifra" abre una hoja con cada número en su renglón, y ahí "Tocá una cifra para ver de dónde sale" te lo recuerda.

### "Sin dato"

Cuando falta un insumo, la cifra dice **sin dato**, en gris. Al tocarla, dice qué falta: "Falta el CCL de compra de la apertura", "No hay un precio cargado". Nunca hay un 0 ni un guion en lugar de un dato que falta.

**Un total al que le falta una parte también es "sin dato"** (D-65). Debajo, en gris, va la suma de lo que sí se conoce, rotulada como parcial: "suma parcial (3 de 6): +US$ 1.630,45". En Hoy, la tarjeta del patrimonio muestra la suma parcial en pesos y en dólares, cada una con su traza. Si no se conoce ninguna parte, no hay suma parcial: la cifra dice qué falta (nunca "suma parcial (0 de 1): $ 0,00", D-126).

### Las etiquetas

Una cifra que no es un dato verificado lleva un chip gris chico, con una palabra. Si hereda varias, muestra la más grave. **Lo verificado no lleva nada:** un día normal, Hoy no tiene chips.

| Etiqueta | Qué quiere decir | Ejemplo |
|---|---|---|
| **parcial** | Es un total y le faltan partes. El valor es "sin dato" y la suma parcial va abajo | El total de "Res. USD" de Cartera cuando una posición no tiene CCL de compra |
| **pendiente** | Falta un dato que llega después | El costo de una compra del día, que IEB muestra con PPP `-` hasta el día siguiente |
| **viejo** | El dato tiene más de 2 días hábiles. Los feriados y los días sin rueda en BYMA no cuentan; un día con rueda aunque los bancos cierren (el Día del Bancario, un no laborable con fines turísticos) sí cuenta (D-129) | Un precio que no se actualiza porque no cargaste esa cuenta; el CCL de hace tres días hábiles (D-16, D-109) |
| **inferido** | Se calculó a partir de otro dato; no se leyó tal cual | El precio de una compra deducido del cambio de PPP; una compra pendiente valuada al precio del día (D-110) |
| **declarado** | Lo cargaste vos, sin respaldo de una fuente | El CCL de compra de una posición que ya tenías antes de la primera carga |
| **estimado** | No lo informó la fuente: es un cálculo que aprobaste, con su fórmula en la traza | La deuda del leasing mientras la leasera no te pase el valor de cancelación (D-131, D-154). Se ve en la deuda y en todo total que la incluye: el patrimonio total y el neto de Exposición |

### "Sin atribuir"

El cambio de tu patrimonio se separa en **lo que pusieron tus activos** y **lo que puso el CCL**. Para separarlo hace falta, en las dos puntas del intervalo, el precio (o el saldo) y un CCL tipeado ese día. Cuando una partida no tiene dato nuevo (no cargaste esa cuenta, o fue una carga express), su cambio queda **"sin atribuir"**: es real, suma al total, pero todavía no se sabe de qué fue. **Cuando llega el dato, se atribuye.** Activos + CCL + sin atribuir dan siempre el cambio total, exacto (D-35).

La casa, la camioneta y la deuda del leasing conservan su última valuación en su propia moneda. Con un CCL nuevo, su cambio en la otra moneda es efecto del tipo de cambio (en la deuda en pesos, licuación), no "sin atribuir".

### El CCL con que se pasa a dólares

Cada pantalla pasa a dólares con el CCL del día de los datos. Si ese día no tipeaste CCL, usa el último que tipeaste y lo dice: "CCL 1.531,70 del mar 13/10 (ese día no cargaste CCL)". Pasados 2 días hábiles, ese CCL lleva la etiqueta "viejo" (D-109). Nunca usa un CCL que no hayas tipeado vos.

### Teclado

- `c` abre Cargar; `h` prende y apaga el modo privado. Las teclas de una letra andan solo si ningún campo tiene el foco.
- En Cargar alcanzan Tab y Enter: no hace falta el mouse. En la bandeja, ↑ y ↓ pasan de fila, y A, E y P aceptan, editan o dejan pendiente la fila que tiene el foco.

## 4. Las pantallas

En la compu, la barra lateral tiene cuatro grupos: **Diario** (Hoy y Cargar), **Patrimonio** (Balance, Cartera, Exposición y Evolución y PnL), **Contexto** (Pasivos y Flujo y escenarios) y **Al pie** (Registro, Datos y Ajustes). Se colapsa a íconos con su botón. En el teléfono, abajo: **Hoy · Balance · [Cargar] · Evolución · Más**; "Más" abre Cartera, Exposición, Pasivos, Flujo y escenarios, Registro, Datos y Ajustes (D-151).

Arriba, en todas las pantallas, el **chip de estado de los datos**: "Datos al cierre del mié 14/10 · 5 de 5 fuentes". Tocalo y muestra cada fuente con su estado:

| Signo | Quiere decir |
|---|---|
| ✓ | La cuenta está cargada y al día |
| ≠ | Quedó una diferencia sin resolver: un control que no cerró, o la última carga de esa cuenta dejó algo pendiente (dice "parcial: quedaron filas pendientes", D-118) |
| ○ | Tipeado, sin control posible: el CCL y el cripto |
| ◷ | Más de 2 días hábiles sin carga |

El resultado de cada control (el Excel contra B2 y sus Subtotales, la captura de Galicia contra su total) se ve en la bandeja de esa carga. En la barra, el botón de Cargar lleva un punto gris cuando es día hábil, ya cerró BYMA (17 h) y todavía no cargaste (D-127).

### 4.1 Hoy

**Para qué:** saber en diez segundos cuánto tenés y qué pasó.

**La frase del día.** Siempre dice desde cuándo mide. Ejemplo:

> Desde la carga del mar 13/10: +$590.125 en pesos (+0,57%), pero −US$ 340 en dólares (−0,50%). En pesos, el CCL sumó $532.812 y tus activos sumaron $57.313. En dólares, tus activos sumaron US$ 37 y la suba del CCL le restó US$ 377 a tus pesos.

- "**El CCL sumó $532.812**" es lo que ganaste en pesos solo porque subió el dólar, sobre lo que tenías en activos que arriesgan dólares. Su traza: `US$ 32.291,66 que tenías en activos en dólares × (1.548,20 − 1.531,70) = $532.812,44`.
- "**Tus activos sumaron $57.313**" es lo que se movieron los precios y saldos. Si bajaron, dice "restaron"; la suba o la baja del CCL sale de comparar los dos CCL.
- "**La suba del CCL le restó US$ 377 a tus pesos**": tus activos en pesos valen lo mismo en pesos, pero menos en dólares.
- Las partes se redondean de modo que **lo que ves suma exacto lo que ves**. El valor exacto está en la traza.
- Si hay partidas sin dato nuevo, la frase agrega cuánto quedó **sin atribuir**. Si hoy se atribuye lo que había quedado pendiente de cargas anteriores, también lo dice: "Incluye lo que había quedado sin atribuir en cargas anteriores y hoy se atribuye".
- Después de una **carga express**: "Cargaste solo tipos de cambio: ningún precio ni saldo es nuevo, así que todo el cambio queda sin atribuir hasta tu próxima carga completa."
- En una carga express, la segunda oración cuenta cuánto movió cada partida al CCL nuevo, y "de tus US$ …" también se toca: es la suma de tus dólares en efectivo de la carga anterior.
- Si la carga **no tiene CCL**: "Esta carga no tiene CCL: los dólares usan el del mar 13/10 y no hay con qué separar activo de tipo de cambio…" (D-109).
- Si a una partida le falta un dato (por ejemplo, una tenencia que la fuente ya no lista), la variación es "sin dato" y la frase dice cuál falta y por qué, en vez de repartir cifras que no existen: "Desde la carga del lun 05/10: sin dato en pesos y sin dato en dólares. Falta SPY: IEB ya no la lista desde el mar 06/10…" (D-117). Cada "sin dato" se toca y muestra la suma parcial.
- En el teléfono, la frase es texto corrido. **"Ver la frase completa y cada cifra"** abre una hoja con cada número en su renglón, para tocarlo; en una carga express, también cada cifra de la segunda oración (por ejemplo, "De SPY"). La frase se recorta solo con el dedo: con mouse, aunque la ventana sea angosta, se lee entera.

**Las dos tarjetas** (D-03):
- **Patrimonio financiero**: lo invertible. Tus posiciones de IEB y Galicia y la liquidez de las tres cuentas. Sobre esto se miden Cartera, la concentración y los resultados. Debajo, su variación y su desglose: activos, CCL y, si hay, sin atribuir. Las tres partes suman la variación.
- **Patrimonio total**: el financiero, más la casa, más tu parte de la camioneta (su valuación menos la deuda del leasing), "sujeta a opción de compra". Dice la fecha de cada valuación. Mientras no cargues tus bienes o el leasing (Datos), el patrimonio total y su variación son "sin dato", con la suma de lo que sí cargaste a la vista (D-65, D-126). La deuda del leasing es una sola en toda la app: el valor de cancelación que informe la leasera o, sin él, la **según el cuadro de marcha** (baja con cada cuota que pagás) o, sin el cuadro, el estimado que aprobaste (D-131). Las dos últimas son estimados: el total lleva el chip "estimado", y su traza dice cómo se calculó (D-154).
- En la compu, debajo de cada tarjeta, un enlace: **"Ver la evolución y el PnL"** (financiero) y **"Ver el balance"** (total).

**Pesos financieros − deuda del leasing** (D-101). Tus activos financieros que arriesgan pesos, menos lo que debés del leasing: "largo $32.783.100 ($54,18 M − $21,40 M) · US$ 21.175 · si el CCL sube 1%, pierde US$ 210". **Largo** quiere decir que tenés más pesos que deuda en pesos: si el dólar sube, perdés en dólares. El "+1%" es una sensibilidad, no un pronóstico. La casa y la camioneta no entran: les falta la moneda de riesgo, que se elige desde la 1b (D-73). La deuda es la que cuenta en toda la app (D-131): la informada por la leasera; sin ella, la según el cuadro de marcha; sin cuadro o sin la tasa del contrato, tu estimado. Sin ninguna de las tres, la deuda es "sin dato", nunca $0, y el neto queda "sin dato", con lo que da sin la deuda (D-126).

**Atención.** Lo que le falta a tus datos, con un botón: la **cuota del leasing** que vence en los próximos 10 días o que ya venció (con "Ver el cuadro de marcha"), lo que **vence de tus bonos y letras** ("Vence S13N6 el vie 13/11", con "Ver el flujo"), "Falta el CCL", el CCL que se está arrastrando de otro día, "SPY: dato viejo", "Pesos en Mercado Pago: dato viejo", "SPY: IEB ya no la lista" (gravedad alta: registrá la venta o el vencimiento en Cargar, D-117), "IEB: la carga del mar 06/10 quedó parcial" (algo quedó pendiente; se resuelve en tu próxima carga de esa cuenta, D-118), "Casa: sin valuación", "Leasing: sin capital pendiente", "T30J7: compra con precio pendiente", "YPFD: declarar CCL de compra". Va de lo más grave a lo más leve, todo junto: una cuota vencida o que vence esta semana nunca queda plegada detrás de pendientes leves. En la compu va en una columna a la derecha desde 1280 px; en el teléfono, en un renglón que se despliega. Si no hay nada: "Tus datos están completos. Nada que revisar."

**Lo demás:**
- **"Todavía no cargaste hoy · Cargar"**, un día hábil sin carga, después del cierre de BYMA (17 h). A la mañana, antes del cierre, no aparece: los datos de hoy todavía no existen (D-127).
- **Un día de datos sin CCL** lo avisa arriba: "El mié 14/10 no tiene CCL: los dólares usan el CCL del mar 13/10 y el cambio del día queda sin atribuir" (D-109).
- **"Quién movió tu financiero"**: cada posición con su aporte a la variación. Una sin precio nuevo dice "sin precio nuevo", nunca 0. Cada aporte se toca y muestra su cuenta: valores, CCL y flujos del día.
- **El cuadre:** el patrimonio de hoy recalculado desde los hechos, contra el de la carga anterior más cada parte de la frase (D-66). La línea dice por cuánto, en pesos y en dólares, y cada cifra se toca para ver su cálculo:
  - **✓** "cierra (diferencia $ 0,00 · US$ 0,00)";
  - **≠** "no cierra por +$ X · +US$ Y", y abajo "Si no tiene explicación, es un bug: revisalo";
  - **○** no se puede verificar porque falta un dato del financiero, y dice cuál.

  La plata de una operación en una cuenta sin saldo cargado en esa moneda (Galicia no carga saldos; o un dividendo en dólares de IEB, si nunca cargaste su saldo en dólares) cuenta como plata que entró o salió de la app: el cuadre cierra y la nombra ("Cuenta como plata que entró o salió de la app: compra de … en Galicia, $ … (Galicia no tiene saldo en pesos cargado)", D-125).
- **El excedente del mes** ("Excedente de octubre"): tus ingresos declarados (los dólares, al cripto de tu última carga) − los gastos fijos − la cuota del leasing que pagás vos (+ el reintegro del IVA y la percepción, si declaraste en Pasivos que la empresa te lo reintegra), en pesos y en dólares, con su traza y su chip. Es la misma cifra que arriba de Flujo. Si falta algo (el cripto, el cuadro de marcha), dice "sin dato" y qué falta. Debajo, **"Ver el flujo y los escenarios"**, y los botones **Cargar ingreso** y **Cargar gasto** (sección 4.11).
- **En diciembre**, un aviso: "La carga del último día hábil del año es tu foto al 31/12: la vas a necesitar para Bienes Personales" (D-76). Ese día hacé la carga completa.
- **Sin datos todavía**, Hoy muestra el **Día cero**, en el orden de la sección 5: primero Datos › Leasing y Bienes (el catálogo es opcional) y después la primera carga. El botón principal lleva a Datos › Leasing; el segundo, a Cargar (D-128). Después de la primera carga dice "Primera carga guardada. Mañana vas a ver qué cambió y por qué."

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
| **Pendiente** | Lo dejaste para otro día | No se graba: esa posición conserva su cantidad y su último precio (que se pondrá viejo si no lo cargás), y la cuenta queda en ≠ "parcial" hasta tu próxima carga de esa cuenta (D-118). Si todo lo de una fuente queda pendiente, esa fuente no crea su carga y lo que ya tenía del día sigue como estaba (D-122) |

Con el teclado, en la bandeja: ↑ y ↓ pasan de fila; **A** acepta (o completa, o da de alta), **E** edita y **P** deja pendiente. Los mismos botones están siempre a la vista.

Lo que podés encontrar en la bandeja:
- **Dos lecturas que no coinciden** (en una captura): "Lectura A: $4.912.300 · Lectura B: $4.912.800", con un botón por cada una. Si una de las dos cierra la cuenta, la app la propone.
- **Conciliación** (D-15): "el bróker tiene 9.000.000 y la app 8.000.000: falta una compra de 1.000.000 a $1,0986 (inferido del PPP, sin comisiones)". Nunca se aplica sola: la aceptás, la editás o la dejás pendiente. Si el bróker tiene menos, propone una venta con el precio de hoy como referencia (corregilo si vendiste a otro). Si tiene más cantidad con el mismo costo total, pregunta "¿Cambio de ratio?" y propone un ajuste de ratio. La primera vez que aparece cada posición, la propuesta es una **apertura** con el PPP del bróker como costo (D-14).
- **Ya la tenía.** En una cuenta ya cargada, una posición nueva se propone como compra. Si en realidad ya la tenías (por ejemplo, quedó pendiente el Día cero), tocá **"Ya la tenía (apertura)"** y entra como apertura con el PPP, sin CCL ni pago de hoy (D-121).
- **La fuente no lo trae.** Si la app tiene algo que la fuente ya no lista, la fila te pregunta si lo vendiste o venció. **"Registrar venta"** o, en un bono o una LECAP, **"Registrar vencimiento"** piden lo que cobraste (el precio o el importe en una venta, el importe en un vencimiento; el último precio aparece solo como referencia) y el CCL del día. **"Dejar pendiente"** lo deja en "sin dato" hasta que lo registres (D-117). El Excel de IEB lista todo; una captura de Galicia solo cuenta para la sección y la moneda de un total que cierra.
- **Galicia en dólares.** Lo que la captura muestra en dólares ("Bonos en dólares", U$D) todavía no se graba: la fila queda en error y la dejás pendiente (D-123).
- Una compra o una venta propuesta necesita el **CCL del día**: si no lo tipeaste, la fila queda en error hasta que lo tipees.
- **Compra del día:** IEB muestra el PPP como `-`. Se graba como compra con precio pendiente (D-19).
- **Completar precio:** al día siguiente, con el PPP nuevo, la bandeja propone el precio de esa compra: "(10.200 × 110 − $1.000.000) ÷ 10 = $12.200". Lo aceptás con un toque ("Completar"), tipeás otro precio ("Editar precio") o grabás la fila sin completarlo, y la compra sigue pendiente (D-110). Mientras tanto, la compra se valuó al precio del día, con la etiqueta "inferido"; al completarse, los días que usaron ese precio se recalculan con el real y su frase puede cambiar un poco.
- **"¿Entró o salió plata?"**: un saldo remunerado (el de Mercado Pago, que muestra su TNA) subió más de lo que explica esa TNA, o bajó (los intereses no restan). Sin registrar el movimiento, la suba se leería como ganancia y la baja como pérdida. El acceso "Registrar el aporte (o el retiro) en Datos › Movimientos" abre, en otra pestaña, el movimiento ya precargado para que lo confirmes (sección 9). El efectivo de IEB no pregunta nada: sube y baja con cada compra y venta.
- **Alta de un ticker:** tipo, **moneda de riesgo** ("¿a qué moneda te expone? Un CEDEAR es dólares"), geografía, indexación (bonos), subyacente y ratio (CEDEAR) y color. La moneda de riesgo no tiene valor por defecto: la elegís vos (D-73). La bandeja se rearma sola.
- **Controles de la cuenta:** "IEB cierra contra B2 ✓", "Subtotal Cedears ✓", "Galicia: total de la captura ✓". Un control al que le falta un término dice **no verificable**: nunca cuenta como OK.
- **El dólar de IEB:** IEB pasa tus dólares a pesos con su propio precio (el de DOLARUSA), no con tu CCL. La bandeja muestra esa diferencia con nombre, para que no parezca un error (D-66).

**El botón Guardar** dice qué va a hacer el Enter, con números: "Guardar 11 · dejar 1 pendiente". Mientras algo se lee: "Esperando Mercado Pago (leyendo…)", y al lado "Guardar sin Mercado Pago". Con un error: "Resolvé 1 error para guardar". Abajo, el tiempo activo que va llevando la carga.

**Después del Enter:** "Guardado · 41 s activos", con lo que se grabó por cuenta (precios, saldos, operaciones y, si hubo, precios completados), y tres botones: **Ver Hoy**, **Deshacer** y **Nueva carga**. Si el guardado falla, la pantalla ofrece **Ver Registro** y **Nueva carga**. Si se cortó la conexión y volvés a tocar Enter, la app reconoce el mismo envío y muestra lo que de verdad quedó grabado ("Ya estaba guardado"); si cambiaste algo en el medio, no lo graba y te pide una carga nueva (D-120).

### 4.3 Cartera

**Para qué:** cada posición en pesos y en dólares, con su desglose.

**En la compu**, una tabla de 13 columnas. En el orden en que entran según el ancho: Activo, Res. USD, Res. ARS, % fin., Precio, Activo / TC en US$, Activo / TC en $, PPC USD, PPC ARS, Cant., Días, Valor $ y Valor US$. Las que no entran van al **detalle de la fila** (el chevron ›). A 1280 px con la barra lateral abierta entran 7; a 1600 px, 10 (hasta Cant.), y 11 con la barra colapsada. Todas entran desde unos 1910 px (1730 px con la barra colapsada).

| Columna | Qué es |
|---|---|
| **Cant.** | Lo que tenés, derivado de tus operaciones (apertura, compras, ventas) |
| **PPC ARS** | Precio promedio de compra en pesos, por unidad (o por 1 VN en bonos y letras) |
| **PPC USD** | Lo mismo en dólares: cada compra pasada a dólares con el CCL de su día. En una posición que ya tenías antes de la primera carga, "sin dato", porque no se conoce el CCL de la compra original (D-14) |
| **Precio** | El último precio cargado, por unidad o por 1 VN. Si es viejo, la fila va en gris con su chip |
| **Res. ARS / Res. USD** | Resultado desde la compra, en $ y en %: lo que vale hoy menos lo que costó, en cada moneda |
| **Activo / TC en $** y **en US$** | El resultado partido en lo que hizo el activo y lo que hizo el tipo de cambio |
| **% fin.** | Su peso en tu patrimonio financiero |
| **Días** | Días en posición: desde la primera compra registrada o desde la fecha de compra declarada. En una posición que ya tenías antes de la primera carga y sin fecha declarada, se cuentan desde la apertura en la app, y lo dice. La cifra se toca y muestra la cuenta ("jue 15/10 − jue 01/10 = 14 días desde la apertura en la app"), y lleva el chip "desde apertura" o "declarado" |
| **Valor $** y **Valor US$** | Lo que vale la posición hoy, en cada moneda |

**Cómo leer el desglose.** La moneda de riesgo decide dónde aparece el efecto del CCL:
- **Un CEDEAR** arriesga dólares. En pesos, su resultado tiene una parte de activo y otra de CCL: "De tus +$ 6,2 M en pesos, +$ 3,4 M fueron el CCL" (los montos compactos llevan su signo). En dólares, todo es activo.
- **Una LECAP o un bono en pesos** arriesgan pesos. En dólares, su resultado tiene una parte de activo y otra de CCL; por ejemplo, S13N6: +US$ 326,16 de activo y −US$ 247,94 de CCL = +US$ 78,22. En pesos, todo es activo.
- El desglose desde la compra es la **suma de los mismos intervalos** que usa Hoy, así que Cartera y Hoy dan el mismo reparto (D-35). Lo anterior a tu primera carga es un solo tramo por compra, con el CCL de compra. Si la última carga no trajo precio o CCL nuevo para esa posición, el desglose muestra también lo que queda **sin atribuir**. La traza lista cada tramo.
- El desglose es el de **lo que tenés hoy**: después de una venta parcial, lo acumulado se reparte en la proporción que queda (como el costo), y los cupones y dividendos no entran (D-114). Lo que ves suma el resultado de la fila (D-35).
- Si el resultado es "sin dato" (una compra con precio pendiente, o una tenencia que la fuente ya no lista), el desglose también, con el mismo motivo (D-126). Una tenencia que la fuente ya no lista dice "IEB ya no la lista desde el …: registrá la venta o el vencimiento en Cargar" (D-117). En una apertura sin CCL de compra, ese CCL se declara desde la 1b (Pendientes).

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

**Largo, corto y neto:** tus pesos financieros, la deuda del leasing (la que cuenta: lo que informa la leasera; sin eso, la según el cuadro de marcha o tu estimado, con su chip), el neto en pesos y en dólares, y tus activos que arriesgan dólares ("CEDEARs y dólares, aunque coticen en pesos").

**Composición**, en barras horizontales: por clase, por moneda de riesgo y por geografía. La liquidez cuenta en la geografía de su custodio: los dólares que están en IEB son AR en geografía y USD en moneda de riesgo.

**Concentración:** tu posición más grande y tus tres más grandes, como porcentaje del **patrimonio financiero** (también en la vista Total, D-03). Dice "sin umbral": la app no juzga la concentración hasta que cargues el tuyo (1b, D-42). Sin el total del financiero (por ejemplo, con una tenencia que la fuente ya no lista), la concentración es "sin dato".

**Cuando falta algo:**
- Sin ninguna carga, la composición dice "sin dato · aparece con tu primera carga" y el botón lleva a Cargar.
- Sin el leasing cargado, o sin ninguna deuda (ni informada, ni según el cuadro con la tasa del contrato, ni estimada), la deuda en pesos es "sin dato", y también el neto, la sensibilidad y el % neto, con lo que da sin la deuda (D-126). El botón lleva a Datos › Leasing.

### 4.5 Registro

**Para qué:** el log de cargas que pediste (D-17): qué entró, de qué archivo, cuánto tardó, y dónde se revierte.

- **Una tarjeta por lote** (un Enter, o un guardado de Datos): la fecha de los datos, la hora en que guardaste, el tiempo activo y las fuentes. Si guardaste otro día que el de los datos, la tarjeta lo dice: "mié 14/10 · guardado el jue 15/10 a las 08:00".
- **Cada carga del lote** (una por cuenta, más la del tipo de cambio): origen (Excel, captura, planilla CSV para el cuadro de marcha, manual para Datos y para Cargar ingreso o gasto, tipeado para el CCL y el cripto), cuántos precios, saldos y operaciones grabó, el archivo, el número de carga y su estado:
  - **vigente:** sus datos son los que valen;
  - **reemplazada:** ese día y esa cuenta se volvieron a cargar después; la carga sigue a la vista;
  - **revertida:** se deshizo (el motivo queda guardado con la carga); la carga sigue a la vista, tachada.
- **Un guardado de Datos** se llama "Datos" y dice qué grabó ("valuación de Casa", "capital pendiente de Leasing", "aporte a Mercado Pago"), también en el resumen del lote y al revertir.
- **Revertir el lote:** ver la sección 8.

En el teléfono, las cargas de cada lote se abren al tocar la tarjeta.

### 4.6 Datos

El título es el selector: tocá **"Datos · Catálogo ▾"** para cambiar de subpantalla.

- **Los aportes, retiros, transferencias, valuaciones y capital pendiente** son cargas **manuales** y quedan en el Registro. Si guardás dos veces el mismo envío (por ejemplo, porque se cortó la conexión), no se duplica. Si se corta la conexión, el formulario se queda y te dice que mires el Registro antes de volver a guardar (D-124).
- **Dar de alta o corregir un activo, un bien o un pasivo** no es una carga: no aparece en el Registro, y el cambio queda en la auditoría con el antes y el después. Para corregir un bien, **"Corregir datos"**; un pasivo, **"Corregir el contrato"**. Abren el formulario del alta ya completo (D-124).

| Subpantalla | Qué tiene |
|---|---|
| **Catálogo** | Tus activos: ticker, nombre, tipo (CEDEAR, acción local, bono, LECAP, FCI), moneda de riesgo, geografía, indexación (bonos), subyacente y **ratio con su historia** (CEDEAR: un ratio nuevo se carga con su fecha "vigente desde"), color fijo para los gráficos, y si se sigue ofreciendo en las cargas |
| **Cuentas** | IEB, Galicia y Mercado Pago, y cómo llega cada una a Cargar (Excel o captura) |
| **Bienes** | La casa y la camioneta: tipo, moneda en que lo valuás, la deuda que lo financia (la camioneta, con su leasing), y sus **valuaciones fechadas con su fuente** (tasación, guía de precios). Cada valuación se muestra también en la otra moneda, al último CCL, con su traza. Sin valuación, el valor es "sin dato" (D-04) |
| **Leasing** | El contrato (montos **netos de IVA**; lo que no tengas a mano queda vacío): moneda, cantidad de cuotas, monto financiado, anticipo, valor del bien, opción de compra y su fecha, y desde la entrega 4 la fecha de desembolso, quién paga la cuota y si la empresa te reintegra el IVA. El **cuadro de marcha** (importar el CSV, completar un pago, cargos extra: sección 4.10). Y la **deuda**: el **valor de cancelación** que informe la leasera ("Cargar el valor que informó la leasera", con su fecha y, si querés, quién lo informó), la **según el cuadro de marcha** y el **estimado** que aprobaste, cada uno con su chip y de dónde sale. Se resta una sola, en este orden: la informada › la según el cuadro › la estimada (D-131, D-154) |
| **Movimientos** | Aportes, retiros y transferencias entre tus cuentas (sección 9) |

### 4.7 Ajustes

- **Tema:** el del sistema, claro u oscuro.
- **Paleta para daltonismo:** positivo en azul y negativo en naranja, en lugar de verde y rojo. El signo y la flecha siempre están.
- **Modo privado:** oculta los montos y deja los porcentajes. Atajo: `h`, o el ojo de la barra de arriba.
- **Barra lateral:** automática (expandida desde 1280 px), siempre expandida o siempre en íconos.
- **Atajos** de teclado.
- **Sesión:** dura 30 días en el dispositivo; **Salir** la cierra.

Todo esto se recuerda **por dispositivo**: el teléfono y la compu tienen cada uno el suyo.

### 4.8 Balance

**Para qué:** tu estado de situación patrimonial, el que te pediría un contador: qué tenés (activo), qué debés (pasivo) y cuánto es tuyo (patrimonio neto), en pesos y en dólares, a cualquier fecha de carga. Está en **Patrimonio › Balance** (`/patrimonio`).

**La frase de arriba** (números inventados):

> Tenés **$ 375 M** (US$ 250.000) sin contar la camioneta. La casa es el **72%** de eso; lo invertible, el **28%**.

**La cifra grande** depende de qué sabés de la deuda del leasing (D-131):
- **Con la deuda estimada** (la según el cuadro de marcha, como hoy, o tu estimado): "Patrimonio neto · deuda del leasing estimada", con el chip **estimado**, y justo debajo, **firme**, "Sin la camioneta: financiero + casa", que no usa ningún estimado.
- **Con el cuadro de marcha importado:** lo mismo, con la deuda calculada a la tasa del contrato (también **estimado**).
- **Con el valor de cancelación de la leasera:** "Patrimonio neto" a secas.
- **Sin ninguna:** "Patrimonio neto sin la camioneta" (**parcial**), y la camioneta y su leasing entran juntos cuando cargues el valor.

La camioneta nunca se suma sin su deuda: lo que entra es **tu parte**, lo que vale menos lo que debés.

**Las tarjetas:** el **activo**, con una barra de lo financiero, la casa y la camioneta; y el **pasivo**, con la deuda, **de dónde sale** ("estimada por vos el jue 08/10 · provisoria") y **"Cargar el valor de la leasera"**, que lleva a Datos › Leasing. Debajo, **"Lo que falta pagar según contrato"**: las cuotas que faltan, con intereses, IVA y seguro. No es la deuda y **nunca se resta**; aparece cuando importes el cuadro de marcha.

**El estado de situación patrimonial:** ACTIVO (lo financiero y tus bienes), PASIVO y PATRIMONIO NETO, cada renglón en pesos, en dólares y en **% del activo**. Lo financiero se ve **por cuenta** (IEB › SPY…), **por instrumento** (SPY, todas las cuentas juntas; los saldos, por moneda) o **por clase**. Cada bien dice su valuación, su fuente y su fecha. En el teléfono es una lista de tarjetas que se abren con un toque (IEB ▸, Galicia ▸, Bienes ▸).

**Comparativo:** tu balance de la fecha elegida al lado del de otra fecha de carga (por defecto, tu primera carga; **"Comparar con"** para elegir otra), renglón por renglón, en pesos y en dólares, con la diferencia. La diferencia no es lo que ganaste: incluye lo que pusiste o sacaste. Lo que ganaste o perdiste está en Evolución y PnL.

**Indicadores del balance:** **solvencia** (cuántas veces lo que tenés cubre lo que debés), **endeudamiento** (qué parte de tu patrimonio neto debés) e **inmovilización** (qué parte de tu activo está en bienes). Cada uno muestra su cuenta al tocarlo; no dicen si está bien o mal (D-133).

**Composición** del activo, con el selector **Financiero · Total**: por moneda de riesgo (tus bienes van en "sin elegir" hasta que les elijas una, D-73), por clase y por **liquidez**: **disponible hoy** (saldos), **con venta en el mercado** (títulos y FCI) e **ilíquido** (bienes). La regla está escrita debajo de la barra (D-132).

**Evolución:** el activo por clase y tu patrimonio neto, un punto por fecha de carga, en pesos o en dólares. La línea rayada es el patrimonio con la deuda estimada; la punteada, lo firme. Con una sola carga es un punto: la curva empieza con la próxima.

**Fecha, agrupamiento e impresión:** elegí cualquier fecha con carga y cómo ver lo financiero (en el teléfono, desde **"Ver por: Cuenta ▾"**). **"Imprimir"** arma el balance en hojas A4, en claro (el estado de situación, los indicadores, el comparativo y la composición), con la fecha, el CCL usado y su fuente, las dos monedas y las etiquetas como texto, para mandarle a tu contador (D-133). Con el modo privado, los montos quedan tapados también en el gráfico y dentro de los textos (la fuente de la deuda, lo que falta pagar).

**Cuando falta algo:**
- Sin cargas: te dice que hagas la primera y que cargues tus bienes.
- Sin bienes: el patrimonio neto es "sin dato" y se ve lo financiero como suma parcial.
- Un bien sin valuación: ese bien dice "sin dato" con "Cargar valuación", y la cifra grande lo nombra ("sin la casa, que no tiene valuación").
- Precios viejos: el chip "viejo · hace N d háb." en la fila, y "viejo" en cada total que la incluye.
- Un día de historia: la evolución es un punto.
- Sin CCL ese día (ni antes): los pesos se ven y los dólares dicen "sin dato · falta el CCL"; la deuda sigue con su origen.

### 4.9 Evolución y PnL

Cuánto ganaste o perdiste en un período, en qué, por precio o por dólar, realizado o no. Arriba elegís qué mirás (**Financiero** o **Total**: con la casa, la camioneta y la deuda del leasing), en qué moneda (pesos, dólares o ambas) y el período: la última semana, el último mes, tres meses, desde el día cero o dos fechas con carga. En el teléfono, el período se elige en una hoja desde "Período: …". Todo queda en la dirección de la página: la podés guardar como favorito. El último período que elegiste queda recordado en este dispositivo: si entrás desde el menú, vuelve.

**Con una sola carga** (tu día cero) ves tu punto de partida, lo que ya traías desde la compra según el PPP de tus brókers (en dólares, solo donde declaraste el CCL de compra), qué pasa si mañana el CCL sube 1% (cuánto varía tu financiero en pesos, por lo que tenés en dólares, y en dólares, por lo que tenés en pesos) y el flujo del mes en curso. En la vista Total, mientras la deuda del leasing sea la estimada, la cifra grande, la curva y todo lo que sale de la deuda llevan el chip "estimado". El puente dice "sin dato · necesita una segunda carga": con tu próxima carga se completa.

**Con dos cargas o más:**

- **La frase del período**, como la de Hoy.
- **El puente:** de tu patrimonio al inicio al del final, línea por línea: aportes y retiros, las cuotas del leasing pagadas desde tus cuentas (una salida, no una pérdida), lo que pusieron tus activos, lo que puso el dólar y lo que todavía no se puede separar. En Total suma la amortización de la deuda y, debajo, la revaluación de tus bienes, el dólar sobre tus bienes (la camioneta valuada en pesos, la casa en dólares) y el dólar sobre la deuda en pesos. Abajo, el cuadre: tiene que dar ✓ 0. En la computadora, tocá un escalón de la cascada: en "activos" y "dólar" ves quiénes más sumaron y restaron.
- **Quién sumó y quién restó:** cada partida, partida en precio (sólido) y dólar (rayado). Tocá una barra para ver su cálculo.
- **Resultados por activo y cuenta:** el resultado del período y sus partes, lo **realizado** (lo que vendiste o cobraste, menos lo que te había costado) y lo **no realizado** (lo que seguís teniendo). Arriba elegís verlo por partida, **por cuenta** (IEB, Galicia…) o **por activo** (el mismo título en dos cuentas, junto), y lo ordenás por cualquier columna (tocando el título de la columna o con "Ordenar por"). La liquidez "no aplica": no tiene costo.
- **Tu patrimonio en el tiempo** y el capital aportado: lo que queda entre las dos líneas es lo que ganaste o perdiste. Un punto hueco quiere decir que ese día algún precio o saldo era viejo. Con "Ambas" monedas podés verlas juntas, en índice 100 (las dos arrancan en 100 el día cero).
- **PnL por mes:** cada mes es la suma exacta de sus días.
- **Estado de resultados:** ingresos − gastos − costo del leasing = ahorro; + inversiones + revaluación de bienes + licuación de la deuda = variación explicada; la diferencia con la variación real es "no explicado" (consumo que no cargaste, plata que quedó afuera…). Los gastos fijos declarados llevan el chip "declarado": no son gastos reales.
- **El futuro:** con un escenario de Flujo (el que estás probando o, si llegás por el menú, el último que guardaste), la curva sigue punteada desde hoy y abajo va el PnL proyectado por mes, todo con el chip "supuesto". Con más de un escenario guardado, **"Ver con: «…»"** cambia el que se muestra. "Ajustar supuestos" te lleva a Flujo con ese escenario abierto: sus supuestos, y "Guardar cambios" lo actualiza (no crea otro).

Tocá cualquier cifra para ver su fórmula y de dónde sale. Con el modo privado se tapan los montos, también en los gráficos.

### 4.10 Pasivos

Contesta: **¿cuánto pagué del leasing, cuánto falta, cuánto es en dólares y cuánto cuesta contra lo que vale la camioneta?** Toda cifra está en pesos y en dólares y abre su traza.

**Lo que ves, de arriba abajo:**
- **La frase:** cuántas cuotas pagaste, la próxima (fecha, cuánto, cuánto es hoy en dólares) y lo que falta, con lo supuesto o a confirmar dicho en palabras. Si una cuota ya venció y tu planilla no la marca pagada, lo dice (y la tarjeta de la próxima cuota también): si ya se debitó, importá la planilla actualizada. En el teléfono, "Ver cada cifra de la frase" abre cada cifra en pesos y en dólares, y tocándola ves de dónde sale.
- **Cuatro tarjetas:** cuotas pagadas, la próxima cuota, lo que falta pagar (canon según contrato, y aparte IVA, seguro y percepción) y el costo total contra el valor del bien.
- **La deuda, con su origen:** el **valor de cancelación** que informa la leasera, la deuda **según el cuadro de marcha** (lo que vale, al cierre de tu última carga, lo que falta de canon y opción, a la tasa del contrato: baja con cada cuota que pagás y entre cuotas sube un poco, por el interés que corre) y la **estimada** que aprobaste. Cuenta una sola, la misma en toda la app (Hoy, Balance, Exposición, Evolución y Flujo): la informada; sin ella, la según el cuadro; sin cuadro o sin la tasa del contrato, la estimada (D-131). Las dos últimas llevan el chip "estimado". Todo va al cierre de tu última carga, como el Balance: si cargás el valor de cancelación con la fecha de hoy y todavía no hiciste la carga del día, se ve aparte ("cuenta desde tu próxima carga") y entra en tu patrimonio con esa carga; mientras tanto, el Balance te lo recuerda en lugar de pedirte que lo cargues. "Lo que falta pagar" va al lado y nunca se resta: trae intereses e impuestos.
- **La tasa del contrato:** la TEA (y su TEM) que iguala lo financiado con los cánones y la opción. Si dice "sin dato · Completar el contrato", le falta el monto financiado neto o la fecha de desembolso (la entrega del bien): cargalos en Datos › Leasing.
- **Cada cuota, abierta:** la **amortización** es lo único que baja la deuda y suma a tu patrimonio; el **interés**, el **IVA**, el **seguro**, la **percepción** y los **cargos** son gasto. Lo ves en barras por cuota, en el cuadro ("Abierta: amortización y gasto") y en los totales de lo que pagaste y lo que falta. La amortización y el interés salen de la tasa: llevan "estimado".
- **El cuadro de marcha:** las pagadas plegadas ("14 pagadas ▸"), las próximas 6 a la vista y el resto plegado; en el teléfono, una tarjeta por cuota. "Pagada · fecha sin dato" quiere decir que la planilla no trae la fecha del débito. En dólares, una pagada va al CCL del día de su pago (si no lo cargaste, "sin dato") y una pendiente al CCL de hoy, rotulado.
- **Totales, recupero fiscal y dólar:** lo pagado, lo que falta por fuente, el IVA y la percepción (crédito fiscal de la sociedad: gasto tuyo mientras no te los reintegre), la opción de compra con su IVA, "cuánto menos pagaste en dólares" y la cuota en pesos contra la cuota en dólares, que aparece cuando hay dos cuotas con el CCL del pago.
- **Quién paga:** "¿Quién paga la cuota? Vos · La empresa" y "¿La empresa te reintegra el IVA? Sí · No". Un toque guarda. Mientras no digas quién paga, la app toma que la pagás vos (lo que dijiste el 14/10); el reintegro del IVA, mientras no lo digas, no se supone.

**Las etiquetas del leasing:** `proyectado` (una cuota sin factura todavía), `supuesto` y `a confirmar` (como los marca tu planilla: SUPUESTO y CONFIRMAR), `estimado` (la deuda según el cuadro o la que aprobaste, y la amortización y el interés). Una cifra que suma alguna de ellas la lleva.

**Datos › Leasing, lo nuevo:**
1. **Importar el cuadro de marcha:** "Importar cuadro de marcha (CSV)", elegí el archivo (o pegá el texto). La revisión te dice cuántas cuotas leyó, cuántas facturadas y proyectadas, qué cambia contra lo que ya tenías, los cargos extra, si el total de la planilla cierra con la suma de sus partes y si la opción de compra coincide con el contrato ("Guardarla en el contrato" si no la tiene). Un error frena el guardado y dice su fila y su columna: corregilo en el archivo y volvé a elegirlo. Las advertencias se aceptan de a una; si con esa planilla no quedan todas las cuotas del contrato, una advertencia dice cuáles faltan: hasta que importes la planilla completa, la tasa del contrato y la deuda según el cuadro quedan *sin dato* (se resta tu estimado, si lo hay), y el mes de cada cuota que falta queda *sin dato* en Flujo, Hoy y Evolución. Un cargo que dice una cuota que el contrato no tiene es un error de la planilla. **Enter** guarda; "Deshacer" lo vuelve atrás en el momento (después, desde Registro).
2. **Cada vez que pagás:** importá la planilla actualizada. Se actualiza por número de cuota: lo facturado pisa lo proyectado. Una cuota facturada no vuelve a proyectada.
3. **Completar el pago de una cuota:** la fecha del débito (si no la sabés, dejala vacía), el CCL de ese día y de dónde lo sacaste (los dos o ninguno) y quién la pagó. Con el CCL de cada pago, lo pagado se ve en dólares.
4. **Cargos extra:** los que trae la planilla entran solos; uno suelto se agrega a mano (fecha, qué es, importe con IVA, la cuota y de dónde sale). Cada cargo se debita con su cuota; uno que no dice cuota, con la primera que vence en el mes de su fecha o después (D-153). Un error se anula, no se borra. Si anulás un cargo que vino en la planilla, sacalo también del archivo antes de volver a importarlo: si no, la planilla nueva lo trae otra vez.
5. **El contrato:** la fecha de desembolso (la entrega del bien), quién paga y si la empresa te reintegra el IVA. Con el cuadro importado, la fecha de desembolso y el monto financiado neto, la deuda según el cuadro reemplaza al estimado en toda la app; cuando cargues el valor de cancelación que te informe la leasera, ese les gana a los dos.

**Para revertir una planilla vieja o un pago** desde Registro (o con Deshacer), revertí primero lo que guardaste después del mismo leasing, de lo más nuevo a lo más viejo: cada carga vuelve las cuotas a como las dejó la anterior. Si querés revertir una carga que tiene otra posterior, la app no te deja y te dice cuál revertir primero (como con las cargas de una cuenta). Si lo que está mal es el pago de una cuota (la fecha, el CCL o quién la pagó), no hace falta revertir nada: completalo de nuevo y pisa lo anterior.

### 4.11 Flujo y escenarios

Contesta: **¿cuánto me sobra por mes para invertir y adónde me lleva cada escenario?** Se abre desde la barra (Contexto › Flujo y escenarios) o en `/flujo`. Todo sale de tu **última carga**: el día que cargás de nuevo, el punto de partida se mueve solo.

**Cargar ingreso y Cargar gasto.** Cuando te entra plata, tocá **Cargar ingreso** (arriba en Flujo, en Hoy y en el menú de Cargar; también en `/flujo/cargar`). Son diez segundos:
1. El **concepto**, obligatorio: *Ingreso mensual* (el que se compara con lo declarado) o *Ingreso extraordinario* (va aparte y no cambia tu proyección).
2. El **monto** y la **moneda** (US$ o $). La fecha es hoy; la podés cambiar.
3. **A qué cuenta entró:** IEB, Galicia, Mercado Pago o *Afuera*. Si entró a una de tus cuentas, queda grabado también como aporte: tu próxima carga no lo va a leer como ganancia de tus inversiones.
4. Si eran dólares que **vendiste al cripto**, el cripto que usaste y los pesos que recibiste (los dos o ninguno). Abajo te dice si cierran ("Cierra: US$ × cripto = …") o qué cripto daría con esos pesos.

Si ese mismo día ya cargaste en Datos › Movimientos un aporte igual a esa cuenta, te avisa antes de guardar, para que no cuente dos veces.

*Cargar gasto* es lo mismo, con *Gasto fijo del mes* o *Gasto extraordinario*, y "¿de qué cuenta salió?". Abajo está **Lo que cargaste**: **Deshacer** revierte la carga entera, como en Registro (solo la última de esa cuenta), y **Anular** es para lo que fue afuera. Las dos quedan en la auditoría.

**El mes en curso.** Arriba, una frase con lo que declaraste: lo que ingresa (los dólares, al cripto de tu última carga), los gastos fijos y la cuota del leasing que pagás vos (+ el reintegro del IVA y la percepción, si declaraste que la empresa te lo reintegra), y el **excedente invertible**, en pesos y en dólares. Tocá cualquier cifra para ver de dónde sale. Si falta algo (el cripto, tus ingresos), en lugar del número dice qué falta.

**El calendario de la plata.** Los próximos 12 meses con lo que ya se sabe, sin supuestos: lo declarado, las cuotas del leasing (con sus chips: *supuesto*, *a confirmar*, *proyectado*) y lo que vence de tus bonos y letras. Si a una letra le falta el pago al vencimiento, tocá **Cargar el pago al vencimiento**: la fecha, cuánto paga por VN (está en el aviso de licitación) y de dónde lo sacaste. Te muestra cuánto cobrarías con lo que tenés hoy.

**Escenarios.** A la derecha (abajo en el teléfono, con una franja fija arriba que te muestra el excedente y el financiero mientras tocás) están **tus supuestos**, variable por variable: **Baja · Igual · Sube**. Debajo de cada una dice qué es *Igual* con tus datos de hoy. Con Baja o Sube aparece el deslizante, con − y + de a 0,1, y el número va también en el botón ("Sube +2,0%/mes").
- **Nada arranca elegido**, salvo **tu regla** del 14/10 (rotulada "tu regla · 14/10"): todo lo que sobra cada mes (ingresos − gastos fijos − la cuota entera del leasing) se invierte repartido como tu última carga, y lo que vence se reinvierte igual. Si un mes no alcanza, sale de tus pesos, y si se terminan, el mes dice "no se cubre". La podés cambiar (otro %, todo a una clase) y volver a la tuya.
- **Tu ingreso va por tramos:** "desde ahora" y "desde feb-27" ya están armados, sin elegir. El de pesos, además, puede **ajustarse todos los meses** (de 0 a 15 %/mes). Cuando sepas el monto nuevo, declaralo en *Tus ingresos y gastos* con **Cambia desde…**.
- Para proyectar faltan las variables que tu cartera usa y el **horizonte** (6, 12, 24 meses o el fin del leasing). Si querés arrancar con todo quieto, tocá **Completar lo que falta con Igual**: completa solo lo que no elegiste.
- **¿Quién paga la cuota?** y **¿la empresa te reintegra el IVA?** también se eligen acá (si lo declaraste en Pasivos, manda eso). Sin reintegro elegido, no se cuenta ninguno: lo que sale de tu cuenta es la cuota entera.

**La proyección.** Un solo camino con tus supuestos (no es un pronóstico ni una recomendación): el excedente acumulado, tu patrimonio financiero y el neto sin la camioneta al horizonte; si terminás debajo de lo que pusiste; en qué mes el resultado de tus inversiones alcanzaría la cuota; el flujo mes a mes (lo proyectado va rayado, con la línea de hoy) y el patrimonio proyectado, en pesos o en dólares; y el **mes a mes** (tarjetas en el teléfono) en dos vistas: *La plata del mes* (ingresos, gastos, cuota, lo que vence y el excedente) y *Patrimonio y resultado* (lo invertido, lo que cambió por precio y por el dólar, el financiero y el neto sin la camioneta). Cada cifra abre su cuenta al tocarla. El patrimonio neto con la camioneta usa cuánto de cada cuota baja la deuda (la amortización que calcula Pasivos a la tasa del contrato); sin el cuadro de marcha o sin esa tasa, queda sin dato.

**Guardar y comparar.** Mientras probás, todo queda en la dirección: si recargás no perdés nada y *Atrás* vuelve a lo anterior. **Guardar como…** le pone nombre; **Abrir** lo trae; **Archivar** lo saca de la lista sin borrarlo. Marcá dos o tres y se **comparan**: tres cajas por escenario, el patrimonio de cada uno con un trazo distinto y solo los supuestos que cambian. El último número de cada deslizante queda recordado para la próxima vez.

**Proyectado contra real.** Cada mes nace proyectado y se vuelve real con lo que cargás: ingreso, gastos y cuota, con el desvío. Los gastos reales son "sin dato" salvo los que cargás con Cargar gasto.

**Tus ingresos y gastos declarados.** Abajo de todo: **Declarar un ingreso o un gasto** (con desde cuándo, y cada cuánto si no es mensual), **Cambia desde…** (cierra el anterior el día antes y abre el nuevo), **Termina…** y **Anular** (para un error).

**Mientras falte un dato.** Arriba, **"Faltan N datos"** los lista con su botón: el pago al vencimiento de cada letra, el cripto y, si no importaste el cuadro de marcha (o le faltan cuotas), **"Importar el cuadro de marcha"**, que lleva a Datos › Leasing. Sin el cuadro, la cuota de cada mes dice *sin dato* (y el excedente también): no se cuenta como $ 0. Si falta el pago al vencimiento de una letra, la proyección igual te muestra la plata de cada mes; lo que depende de esa letra (tu patrimonio financiero y el neto) queda *sin dato* hasta que lo cargues, y el pie de tus supuestos lo dice con palabras.

En el **modo privado** se tapan todos los montos, también en los gráficos y en sus tablas.

## 5. El Día cero, paso a paso

Una sola vez, unos 40 minutos (D-70). El orden importa: el día 2 tiene que mostrar números, no "sin dato" por todos lados.

> **Tu Día cero ya está cargado.** Lo cargó Claude el 14/10, desde la sesión de desarrollo, directo en la base, con las mismas funciones que usa la app, a partir de los archivos y datos que pasaste en el chat (D-130), con la deuda del leasing estimada que aprobaste (D-131). El 15/10 se importó tu cuadro de marcha con el lector de la app, y la deuda pasó a la según el cuadro. Falta el valor de cancelación de la leasera (ver el paso 1). Esta sección queda para entender qué se hizo, o para empezar de nuevo.

**Antes de empezar, tené a mano:**
- el contrato del leasing y el último capital pendiente que te informó la leasera, con su fecha;
- una valuación de la casa y otra de la camioneta, con su fuente (tasación, guía de precios) y su fecha;
- para cada activo que tenés: tipo, a qué moneda te expone, geografía y, si es CEDEAR, su ratio y desde cuándo rige;
- el CCL y el dólar cripto del día, y de dónde los sacás;
- el Excel "Portafolio" de IEB del día, y las capturas de Galicia (la pantalla de tenencia, con la tabla de instrumentos y su total) y de Mercado Pago (el saldo de la cuenta remunerada, con su TNA).

**Paso 1 · Datos › Leasing.** Cargá el contrato (lo que tengas; el resto queda vacío) y el último **capital pendiente** informado, con su fecha. Sin él, Exposición no puede restar la deuda. Un leasing no informa un "capital pendiente" como un préstamo: pedile a la leasera el **valor de cancelación anticipada sin la penalidad** y cargá ese, con su fecha. Hasta tenerlo, dejalo vacío: la deuda queda "sin dato" (D-126). Si tenés el **cuadro de marcha** (la planilla de cuotas), importalo en la misma pantalla y completá la fecha de desembolso y el monto financiado neto: la app calcula la deuda según el cuadro, a la tasa del contrato, y la resta mientras la leasera no informe el valor (D-131). Sin cuadro, podés cargar un estimado tuyo, sabiendo que es provisorio: así se hizo con el Día cero.

**Paso 2 · Datos › Bienes.**
- **La casa:** tipo inmueble, la moneda en que la valuás, y su valuación con fecha y fuente.
- **La camioneta:** tipo vehículo, y en "Deuda que lo financia" elegí el leasing del paso 1. Después, su valuación con fecha y fuente. Si la guía de precios no la lista, podés usar la suma asegurada de una cotización del seguro, con esa fuente (D-130). Tu parte es el valor menos el capital pendiente, "sujeta a opción de compra" (D-03).

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

1. **Juntá las fuentes:** el Excel "Portafolio" de IEB y las capturas de Galicia y de Mercado Pago. Recortá la captura a la tabla (ver "La imagen es más grande de lo que acepta el modelo" en la sección 12).
2. **Abrí Cargar:** `c` en la compu, o el botón del medio en el teléfono. El foco arranca en el CCL.
3. **Tipeá** `1548,2` → Tab → `1541`. Mirá el eco.
4. **Soltá el Excel y pegá las dos capturas.** Se leen mientras tanto.
5. **Mirá la bandeja.** Lo normal es que todo esté verificado y plegado. Resolvé solo lo que está arriba.
6. **Enter.** "Guardado · 41 s activos". Tocá **Ver Hoy** y leé la frase.

**El tiempo que cuenta es el activo** (D-62): la suma de los tramos en que hacés algo (tipear, pegar, tocar). Un tramo se corta después de 60 s sin gestos: una pausa de más de un minuto no cuenta, pero los segundos que esperás a que lea una captura sí se suman (la lectura tarda como mucho 50 s). El Registro guarda el tiempo activo de cada carga.

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

**Recargar el mismo día** una cuenta reemplaza su carga anterior: pisa los precios y saldos de ese día que trae, conserva los que no trae y **suma** las operaciones que falten. La anterior queda en el Registro como "reemplazada". Con el tipo de cambio pasa lo mismo: un campo que dejás vacío no borra el valor que el día ya tenía (D-119). Si el Excel de IEB ya grabó el precio de un activo ese día, una captura posterior no lo pisa. Si la primera carga estaba mal, no recargues: revertila (sección 8).

**Un saldo que aparece por primera vez** (una cuenta nueva, o la primera captura de Mercado Pago un día después del primer Excel) entra como apertura, nunca como ganancia.

## 8. Deshacer y revertir

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

- **Modo privado:** el ojo de la barra de arriba, o `h`. Desenfoca los montos y deja los porcentajes, para mirar la app con gente al lado. Vale en todas las pantallas, Cargar y Datos incluidas, y también para los montos dentro de un texto (por ejemplo, el motivo de un "sin dato"). Las trazas que abrís a propósito muestran la cuenta entera.
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
- **Corregir un hecho suelto** con motivo e historial en la traza: por ahora, se revierte la carga y se carga de nuevo. Un bien o un pasivo sí se corrigen en Datos (sección 4.6).
- **Galicia en dólares:** lo que la captura muestra en U$D ("Bonos en dólares") todavía no se graba; la fila se deja pendiente (D-123).
- **Cargar un feriado desde la app.** Ya están los de 2026 y 2027: los días sin rueda en BYMA y los cierres de la NYSE (D-129). Los que se decreten después se agregan con una migración. El botón "Hoy no operó el mercado" llega en la 1b.
- **El aviso de la mañana:** "Todavía no cargaste hoy" aparece recién después del cierre de BYMA; a la mañana no avisa si falta la carga del día hábil anterior (D-127).
- **En el Registro, el detalle de cada carga:** la lectura cruda (las dos lecturas de una captura lado a lado), el modelo que leyó y el archivo original para abrirlo. Hoy se guardan, pero la pantalla muestra solo el nombre del archivo, los conteos y el estado.
- **Revertir una sola carga de un lote** (por ejemplo, solo la de Mercado Pago): en la 1a se revierte el lote entero. Tampoco hay "deshacer la reversión": para volver atrás, se carga de nuevo el archivo, que sigue guardado.
- **La moneda de riesgo de los bienes** (1b): hasta entonces, la vista Total de Exposición dice "sin dato".
- **Imágenes muy grandes:** no se parten solas; hay que recortarlas.
- **Dos compras con precio pendiente en la misma posición:** un solo PPP no alcanza para separarlas; la bandeja lo explica, pero no hay una pantalla para tipear esos precios.
- **Editar o borrar un movimiento de capital:** se revierte su carga desde el Registro y se carga de nuevo.
- Abrir la traza con el mouse encima (hover): hoy es con clic, toque o teclado.

**La entrega 4 (15/10) adelantó lo que pediste el 14/10** (D-150): el **Balance**, **Evolución y PnL** (de la 1b), **Pasivos** y el **flujo de caja** con Cargar ingreso (de la 2) y las **proyecciones con escenarios** Baja · Igual · Sube y su comparación (de la 3). De esas fases queda lo que dice la tabla.

**Lo que trae cada fase** (`docs/vision.md` §5; las fechas son estimaciones):

| Fase | Qué agrega |
|---|---|
| **1b · Núcleo completo** | Pendientes como pantalla; la ficha de cada activo (con el CCL de empate de las LECAP); gráficos de Exposición; borrador compartido entre el teléfono y la compu; alias por bróker; pegar series (CCL histórico); tu tesis cargada como datos; umbrales; Ayuda con estos documentos adentro de la app |
| **2 · Contexto** | El cierre del mes por diferencia de saldos (D-79); calendario con alertas (vencimiento a menos de 15 días sin destino decidido) |
| **3 · Motor** | Monte Carlo y el abanico de resultados (D-144) |
| **4 · Disciplina** | Tesis y niveles contra tu cartera, la línea de veredicto ("Nada que hacer según tus reglas"), la revisión semanal, rendimientos realizados y la comparación contra SPY |
| **5 · Vida financiera** (propuesta) | Años con la foto al 31/12, impuestos, legado, seguros y retiro |

Muchas decisiones de `docs/vision.md` §6 siguen esperando tu aprobación. Las que la 1a ya usa están listadas, con cómo, al final de `docs/decisiones.md`.

## 12. Problemas comunes

**"La imagen es más grande de lo que acepta el modelo" (una captura).** La app nunca achica ni recomprime una captura, para no perder dígitos. El modelo la rechaza si su lado mayor pasa los 2.576 px **o** si pasa los 4.784 parches de 28 × 28 px (⌈ancho ÷ 28⌉ × ⌈alto ÷ 28⌉, unos 3,7 megapíxeles). Por eso una captura de pantalla completa de 2560 × 1600 se rechaza aunque su lado mayor entre: da 92 × 58 = 5.336. El mensaje dice "…la imagen es más grande de lo que acepta el modelo (…). No la achico sin avisar: capturá solo la tabla o el saldo (en la compu, recortando la zona) o mandala en dos partes." **Recortá solo la tabla** (en la Mac, Cmd+Shift+4 y arrastrás) o mandala en dos partes. También rechaza archivos de más de 4 MB, y formatos que no sean PNG, JPEG, WebP o GIF. Las fotos HEIC del iPhone no se leen: compartilas como PNG o JPEG (en el iPhone, Ajustes › Cámara › Formatos › Más compatible).

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
| "las dos lecturas no se ponen de acuerdo en de qué banco es (…). Decime de cuál es y la vuelvo a leer." | Tocá **"Es de Galicia"** o **"Es de Mercado Pago"**: la vuelve a leer con esa pista (D-123) |
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

**"Ese lote ya se guardó con otro contenido…"** Tocaste Enter, se cortó la respuesta, cambiaste algo y volviste a guardar. Lo primero quedó grabado; lo que cambiaste después, no. Tocá **Nueva carga** y volvé a armarla (D-120).

**"… muestra este título en dólares y la 1a guarda los precios en pesos: no se graba."** Una fila de Galicia en U$D. Dejala pendiente (D-123).

**"No sé si se guardó: se cortó la conexión."** (en Datos) Mirá el Registro. Si no está, volvé a guardar: el mismo envío no se duplica (D-124).

**"Algo falló al mostrar esta pantalla."** Si estabas guardando algo, no se sabe si se guardó: mirá el Registro antes de volver a intentar (el botón **Ver el Registro** lleva ahí). Tocá **Reintentar**; si sigue, el detalle quedó en los registros del servidor (Vercel → Logs), con la referencia que muestra la pantalla.

**"No encontré esa página."** La dirección no existe. La pantalla queda dentro de las barras de la app, con **Ir a Hoy** y **Ver la cartera**.

**Un número que no te cierra con lo que muestra el bróker.** Tocalo y seguí la traza hasta el archivo. Las diferencias de criterio tienen nombre (por ejemplo, IEB valúa tus dólares a su propio dólar y la app a tu CCL). Si no tiene explicación, es un bug: anotalo con la fecha y la cifra.

## 13. Palabras de la app

| Palabra | Qué quiere decir acá |
|---|---|
| **Apertura** | La operación con la que entra a la app una posición que ya tenías antes de la primera carga. Su costo es el PPP del bróker (D-14) |
| **Ausente** | Una tenencia que la app tiene y la fuente ya no lista: una venta total o un vencimiento sin registrar. Mientras no la registres, vale "sin dato" (D-117) |
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
