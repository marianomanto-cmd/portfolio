# Carga diaria

La pantalla que decide si la app vive o muere: **menos de 60 segundos** de tiempo activo (spec, "Requisito que hace o rompe el producto"). Este documento describe qué entra, de dónde viene, cómo se lee y cómo se confirma. Las decisiones están en `docs/decisiones.md` (D-10 a D-19, D-104 a D-111, D-115 y, de la revisión de la 1a, D-117 a D-124 y D-130). El uso, paso a paso, en `docs/manual.md`.

## El recorrido

Una sola pantalla, sin wizard:

1. **CCL** y **dólar cripto** del día: dos campos, vacíos al abrir (el valor de ayer aparece solo como ayuda). Tab entre campos. El eco confirma lo entendido: "= 1.548,20". Al lado, la **referencia del CCL** (de dónde lo sacaste), que se recuerda en el dispositivo y se guarda con el tipo de cambio.
2. **Archivos**, en cualquier orden, en una sola zona: soltar o pegar (Ctrl+V) en la compu, "Elegir archivos" en el teléfono.
   - **IEB:** el Excel "Portafolio".
   - **Galicia:** la captura de la tenencia.
   - **Mercado Pago:** la captura del saldo.
3. Cada archivo se lee apenas entra, mientras tipeás. La app reconoce de qué cuenta es.
4. La **bandeja** muestra lo que entendió de cada fuente, con lo raro arriba y lo verificado plegado.
5. **Enter** guarda lo verificado de todas las cuentas a la vez, en un solo lote (D-104).

Lo que no se carga ese día queda con su último valor conocido, marcado como **viejo** cuando pasa los 2 días hábiles (D-16). Los aportes, retiros y transferencias se cargan en **Datos › Movimientos** (D-111); la bandeja avisa cuando un saldo remunerado sube más de lo que explica su TNA, o baja. Si baja y no se sabe adónde fue la plata, es un gasto (D-168, abajo).

### Las tres cargas válidas (D-64)

| Carga | Qué se carga | Qué se actualiza |
|---|---|---|
| Express | CCL + cripto | El tipo de cambio del día. Todo se revalúa al CCL nuevo, pero el cambio de lo que no tiene precio ni saldo nuevo queda "sin atribuir" hasta su próxima observación (D-35) |
| Media | + el Excel de IEB | Precios, cantidades y saldos de IEB |
| Completa | + las capturas de Galicia y Mercado Pago | Todo |

Un día sin CCL tipeado (por ejemplo, una carga media sin CCL) valúa con el último CCL tipeado, con su fecha a la vista, y no atribuye nada a activo ni a CCL en ese intervalo (D-109).

### La fecha de los datos (D-61)

La da la fuente, no el reloj: la del Excel (su B1) si hay uno; si no, la que muestre una captura; si ninguna la trae, hoy en Córdoba. La pantalla dice de dónde salió ("tomada del Excel de IEB, celda B1") y se puede cambiar a mano. Si una fuente es de otro día que la carga, la bandeja avisa. Una captura sin fecha visible (la de Mercado Pago) toma la fecha de la carga, y si la carga no es de hoy, la bandeja avisa que, si la captura es de hoy, conviene dejarla para otra carga.

## El Día cero (D-70)

Una sola vez, unos 40 minutos, en este orden:

1. **Datos › Leasing:** el contrato (montos netos de IVA; lo que no tengas, vacío) y el último capital pendiente informado por la leasera, con su fecha. Un leasing no informa un capital pendiente como un préstamo: se usa el valor de cancelación anticipada sin la penalidad, que se le pide a la leasera. Hasta tenerlo, queda vacío y la deuda es "sin dato" (D-130).
2. **Datos › Bienes:** la casa y la camioneta, cada una con su valuación, fecha y fuente. La camioneta, vinculada a su leasing ("Deuda que lo financia"). Un vehículo que la guía de precios no lista se puede valuar a la suma asegurada de una cotización del seguro, con esa fuente (D-130).
3. **Datos › Catálogo** (opcional): los activos, cada uno con la moneda de riesgo que elijas vos (D-73), geografía y, si es CEDEAR, su ratio con su vigencia. Lo que no cargues acá, la bandeja lo pide en el paso 4.
4. **La primera carga completa:** CCL, cripto, el Excel de IEB y las capturas de Galicia y Mercado Pago. La bandeja propone una **apertura** por posición, con el PPP del bróker como costo (D-14). Se dan de alta los tickers que falten y se resuelven errores y advertencias.
5. **Enter.** Hoy dice "Primera carga guardada. Mañana vas a ver qué cambió y por qué."

Si la primera carga es con fecha pasada (la foto del 30/12 guardada para después, D-76), las aperturas se crean a la fecha del B1 del Excel, con el CCL y el cripto anotados para ese día.

**El Día cero del dueño (14/10) no pasó por Cargar** (D-130): lo cargó Claude, desde la sesión de desarrollo, directo en la base, con las mismas funciones que usa la app (`alta_activo`, `confirmar_carga`, `guardar_manual` y los inserts de `crearBien` y `crearPasivo`). El Excel se leyó con `ieb-excel@1`; como desde SQL no se puede subir al bucket, su carga va con origen `manual`, sin archivo, y su sha256 queda en la lectura cruda. Las capturas son transcripciones: origen `manual`, lector "transcripción de captura (sin imagen)", una sola lectura, con sus filas aceptadas como advertencias. Las imágenes no se guardaron (llegaron por el chat): de cada una queda la transcripción, con su sha256, en la lectura cruda. El CCL lo buscó Claude en una fuente pública, a pedido del dueño, y la fuente está en la referencia.

## Cómo viaja un archivo (D-105)

- Cada archivo va solo a `POST /carga/leer`, en paralelo con los demás. Va uno por pedido porque Vercel corta los pedidos de más de 4,5 MB; la ruta rechaza archivos de más de 4 MB.
- Mientras se lee, el archivo se guarda en el bucket privado `cargas`, en `AAAA/MM/<sha256>.<ext>`. Si ya estaba, se reusa.
- La lectura vuelve **firmada**. Al guardar, el servidor verifica la firma (lo que se graba como lectura cruda es lo que leyó el servidor, no lo que manda el navegador) y **vuelve a armar la propuesta contra la base** antes de confirmar.
- Un archivo leído y nunca confirmado queda en el bucket sin carga que lo use (falta el trabajo que los borra).

## Formato de cada fuente

### IEB — Excel "Portafolio" (parser determinístico)

**Hoja `Patrimonio`**
- `B1`: fecha del reporte. `B2`: patrimonio total de la cuenta (se usa como control: la suma de lo leído tiene que darlo).
- Secciones `Acciones`, `Bonos`, `Cedears`, `Otros`. Cada una con este encabezado:
  `Especie | Moneda de emisión | Cantidad | Precio | % del total | PPP | Var% | Resultado | Actualizado | Posición total`
- `Especie` = `"TICKER - NOMBRE"`.
- Debajo de cada posición va una sub-fila `Disponible` o `Liquidar` (estado de liquidación) que repite cantidad, precio y posición. **No es otra posición:** se usa solo para saber si está pendiente de liquidar.
- Al final de cada sección hay una fila `Subtotal`, que se usa como control.
- **Bonos y letras cotizan cada 100 VN:** `Posición = Cantidad × Precio / 100`.
- Una compra del día viene con `PPP` = `-` y la sub-fila `Liquidar`. Se graba como `compra` con el precio pendiente; la carga siguiente propone completarlo (D-19, D-110).
- `DOLARUSA - DOLARES USA ESP 7000` (sección Otros, moneda USD) son **dólares en especie**: se leen como liquidez en USD, no como activo. Su precio es el dólar del bróker, no el CCL de la app. El saldo USD de IEB que se graba es **`Total` USD de la hoja Saldos + cantidad de DOLARUSA**, en una sola fila. Las dos partes quedan en la lectura cruda, y la bandeja muestra la suma y sus partes.

**Hoja `Saldos`**
- Bloques `ARS` y `USD`, con las filas `Hoy | 24h | 48h | 72h | Más de 72h | Garantía de Opciones | Total`.
- Se toma **`Total`** (neto de lo que falta liquidar), no `Hoy` (D-13). Puede ser negativo. Control: posiciones + saldos Total (USD al dólar del bróker) = `B2`.

**Cómo lo lee la app (`ieb-excel@1`, D-107).**
- **Números.** Cada número del Excel se lee con las 15 cifras de Excel y de ahí en más es decimal exacto. El ruido binario del archivo no entra (10.118.700,000000002 → 10.118.700). La lectura cruda guarda el número tal como estaba.
- **Fecha (B1).** IEB guarda el día como las 03:00 UTC. Vale el día en Córdoba. Si la celda no tiene hora, vale ese día tal cual. Si el día en Córdoba no es el que muestra Excel, la bandeja lo avisa.
- **Escala (D-12).** Por fila: ÷100 si con ×1 no cierra y con ÷100 sí. Precio y PPP se guardan por 1 VN.
- **Tolerancia (D-37).** Fila: cantidad × escala × medio último dígito del precio (según el formato de la celda) + medio centavo de la posición. Subtotal: medio centavo por término. B2: además, el producto US$ × dólar de IEB propaga sus dos factores. Cada control lleva su tolerancia.
- **Controles (D-38).** Cada Subtotal y B2. Si falta un término (por ejemplo, dólares en Saldos sin DOLARUSA), el control queda **no verificable**, nunca OK.
- **El dólar de IEB.** La lectura informa el precio de DOLARUSA, para mostrar con nombre la diferencia entre valuar tus dólares al dólar de IEB y a tu CCL (D-66).
- **Lo inesperado:**
  - una sección que no es Acciones, Bonos, Cedears ni Otros se lee igual, con advertencia;
  - un ticker repetido deja sus filas en error;
  - si no cierra ninguna escala, la fila es error y muestra la más cercana; si cierran varias, advertencia;
  - un PPP de 0 o negativo es "sin dato";
  - un precio de 0 no se propone como precio del día: queda "sin dato" hoy, con aviso (D-123);
  - si B2 no cierra, todas las filas y los saldos de la cuenta pasan a advertencia, con el aviso arriba; si no cierra un Subtotal, las filas de su sección. Nada de lo que un control no cerrado controla queda verificado (D-123);
  - un número guardado como texto se lee en es-AR, con advertencia;
  - un saldo en "USD Ext." se avisa y no se suma;
  - un archivo que no es el Portafolio (o un `.xls` viejo) se rechaza con un mensaje que dice qué falta.

### Galicia — captura (Claude visión)

Por instrumento: especie (ticker + nombre), cantidad, precio, variación %, PPC, rendimiento ($ y %) y saldo valorizado. Arriba, los totales "Bonos en pesos" y "Bonos en dólares", y el rendimiento acumulado.
- **Letras cotizan por 1 VN:** `valorizado = cantidad × precio`.
- **Fondos (FIMA):** la cantidad son cuotapartes y el precio es el valor de la cuotaparte (D-46); si la cuenta cierra con el precio cada 1.000 cuotapartes, se toma así. Un fondo sin código usa como ticker su nombre en mayúsculas, sin tildes y con guiones: "FIMA-PREMIUM-CLASE-A", igual todos los días. Si pasa de 30 caracteres, la fila queda en error: no se recorta (D-123).
- **El PPC que muestra está redondeado a 2 decimales** (ej. `$1,06`). El PPC preciso se reconstruye como `(valorizado − rendimiento $) / cantidad`. Se guarda ese, se controla que redondee al mostrado, y la diferencia queda en la traza. También se controla que rendimiento % ≈ rendimiento $ ÷ costo. Si corregís a mano la cantidad, el PPC se vuelve a armar con el rendimiento $; si no redondea al mostrado, o falta el rendimiento, la fila queda en advertencia (D-123).
- **Lo que se ve en dólares** (la sección "Bonos en dólares", U$D) se controla en dólares, pero sus filas no se graban en la 1a, que guarda los precios en pesos: quedan en error, para dejarlas pendientes (D-123).
- **Controles:** el total de cada moneda es el control `galicia_total` (Σ valorizado), en la moneda de la sección (US$ en "Bonos en dólares"). El rendimiento acumulado se controla contra Σ rendimiento $; si no cierra, las filas bajan a advertencia. Una captura de resumen, con totales y sin filas, queda no verificable.

### Mercado Pago — captura (Claude visión)

Saldo en pesos de la cuenta remunerada. Se guarda como saldo de liquidez.
- Los centavos que Mercado Pago muestra en superíndice se leen aparte y se juntan con la parte entera.
- La **TNA** se guarda solo si las dos lecturas ven la misma, siempre en porcentaje ("29.5" = 29,5%; "0.8" = 0,8%, no una fracción). La usa la bandeja para "¿entró o salió plata?".
- No tiene control aritmético: el saldo es verificado solo si las dos lecturas coinciden. Si no coinciden, la bandeja rotula el que propone como "propuesta", nunca "cierra".

### Cómo se leen las capturas (`captura-claude@1`, D-108)

- **Dos lecturas en paralelo, distintas en modelo y en pedido:** A (`claude-opus-5-5`) recorre la pantalla fila por fila; B (`claude-sonnet-5-5`), la tabla columna por columna. Configurables con `ANTHROPIC_MODEL_A` y `ANTHROPIC_MODEL_B`.
- Esfuerzo bajo, salida estructurada, sin herramientas. La imagen va **intacta**: nunca se recomprime ni se achica. Si pasa cualquiera de los dos límites del modelo (2.576 px de lado mayor, o 4.784 parches de 28 × 28 px, unos 3,7 megapíxeles: una pantalla completa de 2560 × 1600 ya lo pasa), se rechaza con el consejo de recortar la tabla o mandarla en dos partes. Formatos: PNG, JPEG, WebP y GIF.
- **50 s por lectura**, reintentos incluidos. Si una falla, la otra se cancela y el error aparece con "Reintentar" y "Dejar pendiente".
- La misma lectura identifica la fuente (Galicia, Mercado Pago u otra). Si una sola lectura la reconoce, sigue con una advertencia; si ninguna la reconoce, es un error que lo dice. Si las dos la atribuyen a bancos distintos, la fila pregunta de cuál es ("Es de Galicia" o "Es de Mercado Pago") y la vuelve a leer con esa pista (D-123).
- **Estado de cada fila:**
  - **verificada:** las dos lecturas coinciden y la aritmética cierra;
  - **advertencia:** las lecturas difieren y la aritmética decidió (se prueba cada combinación de las celdas que difieren y se propone la que cierra, con las dos lecturas a la vista para elegir con un toque); un número ilegible; un control de PPC o de % que no cierra; una fila que vio una sola lectura; un total de la captura que no coincide;
  - **error:** ninguna combinación cierra, o la cantidad o el ticker son ilegibles.
- Un número ilegible queda vacío, con su motivo. Nunca se adivina.
- La fecha de la captura se toma solo si las dos lecturas la ven completa, con año.
- La lectura cruda guarda las dos lecturas (texto y JSON validado), los modelos pedidos y los que contestaron, tiempos, el hash del pedido y el sha256 de la imagen.
- La imagen es dato, no instrucciones: lo que diga el texto de la captura no cambia lo que hace el lector.

## Reglas de lectura

- **Escala de precios:** se detecta por fila comparando contra el valorizado (×1, ÷100 o, en fondos, ÷1000) y se guarda por 1 VN (D-12).
- **Chequeo aritmético** de cada fila: `cantidad × precio × escala ≈ valorizado`, con la tolerancia de la precisión mostrada (D-37). Lo que no cierra se marca y no se guarda en silencio (D-11).
- **Conciliación (D-15):** las cantidades leídas se comparan con las derivadas de `operaciones`. Si difieren, la bandeja ofrece crear la operación que falta (compra o venta), con el precio inferido del cambio de PPP y el CCL de ese día. Nunca se aplica sola.
- **Completar precio (D-110):** si la cantidad coincide y la posición tiene una compra con precio pendiente, el PPP de hoy propone su precio: `(PPP₁ × q₁ − costo de la tenencia con esa compra a precio 0) ÷ su cantidad`, con las mismas reglas de costo que Cartera (en el caso simple, `(PPP₁ × q₁ − PPP₀ × q₀) ÷ Δq`). Antes de proponerlo se verifica que con ese precio el costo dé PPP₁ × q₁. Opciones: **Completar** (A), **Editar precio** (E), **Grabar sin completar** (graba el precio del día y la compra sigue pendiente) y **Dejar pendiente** (P). No propone nada, y dice por qué, si hay dos compras pendientes en la misma posición, si la compra es en dólares, si otra parte de la tenencia no tiene costo o si el resultado no es un precio positivo.
- **Carga atrasada (D-115):** si ya hay una carga posterior de esa cuenta, la bandeja lo avisa y concilia contra lo que la app tenía ese día; toda operación propuesta lleva "Ojo: … si ya quedó registrada ahí, dejala pendiente". Una apertura que ya existe con fecha posterior no se vuelve a proponer: la fila graba solo el precio. Una carga vieja no inventa ventas.
- **¿Cambio de ratio? (D-115):** más cantidad (al menos 10% más) con el mismo costo total (PPP × cantidad dentro de lo que redondea el PPP mostrado, o del 1% del costo de la app) propone un ajuste de ratio sin precio, a revisar. Si el PPP no explica una compra y tampoco es un cambio de ratio limpio, propone la compra con precio pendiente y lo dice.
- **Números tipeados a mano** (CCL, saldos, precios, Datos): la coma es el decimal. El punto es separador de miles solo en grupos válidos ("1.234.567"). Un punto después de la coma, un solo punto con 4 o más dígitos detrás, o grupos imposibles ("12.34.56", "1234.567") no se leen: se pide corregir. Un solo punto con 1 o 2 dígitos es decimal ("1548.2"), y "0.125" también.
- **Posiciones ausentes (D-117):** si la app tiene una posición que la fuente no trae, la bandeja la muestra. El Excel de IEB lista todo; una captura de Galicia solo cuenta para la sección y la moneda de un total que cierra, y una ausente que quedó pendiente en una carga anterior sigue ausente aunque la captura de hoy no cubra su sección. Las opciones son "Registrar venta" o, en un bono o una LECAP, "Registrar vencimiento" (sugerido si ya venció o no se sabe cuándo vence), por toda la cantidad, con lo que se cobró tipeado (el precio o el importe en una venta, el importe en un vencimiento; el último precio aparece solo como referencia) y el CCL del día; o "Dejar pendiente". Nunca se inventa una venta. Una pendiente se guarda en `grabado.ausentes`, con su activo y su cuenta, y desde la primera carga de su racha vale "sin dato" hasta que se registre.
- **Una tenencia nueva en una cuenta ya cargada (D-121)** se propone como compra y, como otra opción, "Ya la tenía (apertura)": apertura con el PPP, sin CCL ni pago de hoy. La app no puede distinguir una compra de algo que quedó pendiente el Día cero.
- **Ticker desconocido:** no se graba. La bandeja pide darlo de alta ahí mismo (tipo, moneda de riesgo sin valor por defecto, geografía, indexación, subyacente y ratio si es CEDEAR, color), sin salir de la carga.
- **Formato numérico es-AR:** `.` de miles y `,` decimal en capturas y en lo tipeado. El Excel trae números nativos.
- **Un precio por activo y por día:** si dos cuentas traen el mismo activo, se graba el del Excel y el otro queda anotado en lo grabado. Vale también entre cargas: si un Excel ya grabó el precio ese día, una captura posterior no lo pisa ("vale el de IEB, grabado antes hoy"); un Excel posterior sí (D-119).
- **Un precio de 0** (o un PPP de 0) es "sin dato": no se graba ni como precio ni como costo (D-123).

## La bandeja (D-106)

| Estado | Qué hace el Enter |
|---|---|
| **verificada** | La graba |
| **advertencia** | No la acepta nunca. Se acepta con uno de sus botones, y la opción elegida es el motivo, que queda grabado. Si no la tocás, queda pendiente |
| **error** | Frena el Enter hasta que la corrijas o la dejes pendiente |
| **sin alta** | No se graba hasta dar de alta el ticker |
| **pendiente** | No se graba. La cuenta queda con `listado_completo = false`, y la app la muestra en ≠ "parcial" y en Atención hasta la próxima carga de esa cuenta (D-118). Si todo lo de una fuente queda pendiente, no se crea su carga (D-122) |

- **El botón dice qué va a hacer el Enter:** "Guardar 11 · dejar 1 pendiente", "Resolvé 1 error para guardar", "Esperando Mercado Pago (leyendo…)". Mientras una fuente se lee, al lado aparece "Guardar sin Mercado Pago".
- **"¿Entró o salió plata?"** cuando un saldo remunerado **sube** más de lo que explica la TNA de la captura (tomada con medio último dígito de más, porque la mostrada está redondeada) o cuando **baja** (los intereses no restan). Sin TNA no pregunta nada, solo muestra la diferencia: el efectivo de un bróker sube y baja con cada compra y venta. Enlaza a Datos › Movimientos, en otra pestaña, con el aporte o el retiro precargado (cuenta, moneda, monto y fecha), que el dueño confirma.
- **Teclado:** ↑ y ↓ pasan de fila; A acepta (o completa, o da de alta), E edita y P deja pendiente la fila con el foco. Los botones están siempre a la vista.
- **Controles** de cada cuenta: ✓ cerró, ≠ no cerró, ○ no verificable (falta un término), cada uno con su tolerancia.
- **El dólar de IEB:** con Excel de IEB y CCL tipeado, "DOLARUSA al dólar de IEB $ X vs tu CCL $ Y: diferencia Z (n%)": IEB valúa tus dólares con el suyo; la app, con tu CCL (D-66).
- **Dos lecturas:** cada campo en que las dos lecturas de una captura no coinciden se muestra con sus dos valores lado a lado. La que cierra la cuenta acepta la fila; la otra corrige cantidad, precio (por 1 VN, con la escala de la fila) o valorizado, y la fila se vuelve a controlar. PPC, rendimiento y especie se muestran, pero se corrigen con "Corregir lectura".
- **Motivo principal:** en cada fila va primero lo que frena (el error), después la propuesta y después lo que dijo el lector.
- Enter en el CCL con el cripto vacío pasa al cripto.
- Una elección vale para la propuesta sobre la que se hizo: si la bandeja se rearma, las que ya no aplican se caen.
- **El tiempo activo (D-62)** se mide mientras cargás: suma los tramos con gestos y corta un tramo después de 60 s sin gestos. La espera de la lectura de una captura (como mucho 50 s) cae dentro de un tramo, así que se cuenta. Se guarda con el lote.
- **Modo privado:** todos los montos de la bandeja (motivos, controles, fórmulas, las dos lecturas, saldos) se ocultan como en el resto de la app.

## Plata que falta entre composiciones (D-168)

La composición que manda el dueño es completa: lo que no manda no lo tiene. Al cargarla, se arma la cuenta de cada saldo con la composición anterior:

- **Falta plata** (el saldo nuevo es menor que el anterior menos los movimientos y las operaciones ya cargados): la diferencia es un **gasto**. Va como retiro de esa cuenta en Datos › Movimientos, con la fecha de la composición nueva y la cuenta en la nota: saldo anterior − movimientos conocidos − saldo nuevo.
- **Sobra plata:** si lo explica la TNA del saldo, es rendimiento y no se carga nada. Si vino de una cuenta propia que la app no sigue, es un aporte. Si no se sabe, se pregunta.
- **Un fondo o un saldo que desaparece** de una composición a la siguiente no se arrastra: su plata entra en la cuenta de la que salió.

Ejemplo, con números inventados: Mercado Pago tenía $ 1.000.000, pasaste $ 300.000 a IEB (transferencia cargada) y la composición siguiente dice $ 500.000. El gasto es 1.000.000 − 300.000 − 500.000 = $ 200.000, retiro de Mercado Pago con la fecha de la composición nueva.

## Después del Enter

- **Un Enter = un lote** (D-104): una carga por cuenta y otra para el tipo de cambio, en una sola transacción. Un doble Enter no duplica nada ("Ya estaba guardado", con lo que de verdad quedó en la base). Cada carga guarda la huella (sha256) de lo que se mandó: el mismo lote con otro contenido se rechaza y pide "Nueva carga" (D-120). Un error al guardar ofrece "Ver Registro" y "Nueva carga".
- **Recargar el mismo día** una cuenta reemplaza su carga: pisa los precios y saldos de ese día y esa cuenta que trae, conserva los que no trae y **suma** las operaciones que falten. La anterior queda en el Registro como reemplazada. En el tipo de cambio, un campo vacío conserva el valor del día y la referencia va con su CCL; sin CCL tipeado, las operaciones usan el que el día ya tiene (D-119). Si la primera carga estaba mal, se revierte, no se recarga.
- **Deshacer**, en la pantalla de "Guardado", revierte el lote ("Deshacer inmediato") y devuelve todo a la pantalla para corregirlo, con un lote nuevo.
- **Revertir** desde el Registro: por lote, con motivo ("lectura equivocada", "archivo de otro día" u "otro", con texto), y solo si cada carga del lote es la última de su cuenta. Borra sus filas, restaura desde la auditoría lo que había pisado y deja las cargas en el Registro como revertidas (D-17, D-104).
- **Log:** cada carga confirmada queda en el Registro con su archivo, su lectura cruda, lo que grabó y su tiempo activo.
