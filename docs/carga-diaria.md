# Carga diaria

La pantalla que decide si la app vive o muere: **menos de 60 segundos** (spec, "Requisito que hace o rompe el producto"). Este documento describe qué entra, de dónde viene y cómo se lee. Las decisiones están en `docs/decisiones.md` (D-10 a D-17).

## El recorrido

Una sola pantalla, sin wizard:

1. **CCL** y **dólar cripto** del día: dos campos. Tab entre campos.
2. **IEB:** arrastrar el Excel "Portafolio" (o elegirlo desde el archivo).
3. **Galicia:** pegar la captura con Ctrl+V.
4. **Mercado Pago:** pegar la captura del saldo con Ctrl+V.
5. La pantalla muestra lo que entendió de cada fuente, con las diferencias marcadas. **Enter** guarda.

Lo que no se carga ese día queda con su último valor conocido, marcado como viejo cuando pasa los 2 días hábiles (D-16). Un movimiento de capital (aporte, retiro o transferencia) es un campo opcional en la misma pantalla (D-06).

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
- Una compra del día viene con `PPP` = `-` y la sub-fila `Liquidar`. Se graba como `compra` con el precio pendiente; el PPP del día siguiente lo completa (D-19).
- `DOLARUSA - DOLARES USA ESP 7000` (sección Otros, moneda USD) son **dólares en especie**: se leen como liquidez en USD, no como activo. Su precio es el dólar del bróker, no el CCL de la app. El saldo USD de IEB que se graba es **`Total` USD de la hoja Saldos + cantidad de DOLARUSA**, en una sola fila. Las dos partes quedan en la lectura cruda y la pantalla de confirmación muestra la suma y sus partes.

**Hoja `Saldos`**
- Bloques `ARS` y `USD`, con las filas `Hoy | 24h | 48h | 72h | Más de 72h | Garantía de Opciones | Total`.
- Se toma **`Total`** (neto de lo que falta liquidar), no `Hoy` (D-13). Puede ser negativo. Control: posiciones + saldos Total (USD al dólar del bróker) = `B2`.

### Galicia — captura (Claude visión)
Por instrumento: especie (ticker + nombre), cantidad, precio, variación %, PPC, rendimiento ($ y %) y saldo valorizado.
- **Letras cotizan por 1 VN:** `valorizado = cantidad × precio`.
- **El PPC que muestra está redondeado a 2 decimales** (ej. `$1,06`). El PPC preciso se reconstruye como `(valorizado − rendimiento $) / cantidad`. Se guarda ese, y la diferencia con el mostrado queda en la traza.

### Mercado Pago — captura (Claude visión)
Saldo en pesos de la cuenta remunerada. Se guarda como saldo de liquidez.

## Reglas de lectura

- **Escala de precios:** se detecta por fila comparando contra el valorizado (×1 o ÷100) y se guarda por 1 VN (D-12).
- **Chequeo aritmético** de cada fila: `cantidad × precio × escala ≈ valorizado`. Lo que no cierra se marca y no se guarda en silencio (D-11).
- **Conciliación:** las cantidades leídas se comparan con las derivadas de `operaciones`. Si difieren, la pantalla ofrece crear la operación que falta (D-15).
- **Ticker desconocido:** no se graba. La pantalla pide darlo de alta en el catálogo (tipo, moneda de riesgo, geografía, ratio si es CEDEAR) en la misma pantalla, sin salir de la carga.
- **Formato numérico es-AR:** `.` de miles y `,` decimal en capturas y texto. El Excel trae números nativos.
- **Idempotencia:** volver a cargar el mismo día reemplaza los precios y saldos de ese día y de esa cuenta; no los duplica. La carga anterior queda en el registro como reemplazada.
- **Log:** cada carga confirmada queda en el registro de cargas con su archivo, su lectura cruda y lo que grabó, y se puede revertir (D-17).
