# Modelo de datos

Base: Supabase, proyecto **Portfolio** (`zcgynhzddfjzwswekcvl`). Schema `public`. Migraciones en `supabase/migrations/`, tipos generados en `src/lib/database.types.ts` y tests del schema en `supabase/tests/`.

| Migración | Qué hace |
|---|---|
| `…_init` | 27 tablas, 3 vistas, auditoría por trigger y bucket privado `cargas` |
| `…_permisos_servidor` | Permisos mínimos para el servidor (D-33) |
| `…_cuentas_iniciales` | IEB, Galicia y Mercado Pago |
| `20261008133914_carga_transaccional` (fase 1a) | Columnas de `cargas`, la nota del día en `eventos`, el precio completado de una compra, la referencia del CCL, índices de la auditoría y los lectores de la entrada `leer_monto`, `leer_fecha`, `leer_id` |
| `20261008142244_carga_confirmar` | `confirmar_carga` (ver "Funciones de escritura") |
| `20261008151535_carga_manual` | `guardar_manual` |
| `20261008151942_catalogo_activos` | `alta_activo` y `editar_activo` |
| `20261008160000_carga_revertir` | `revertir_lote`. Aplicada a mano desde el editor SQL (ver abajo) |

La carga transaccional se aplicó en cinco partes y no en una porque el conector de Supabase cortaba a los 60 s con el archivo entero. Cada parte revoca y otorga los permisos de sus propias funciones. El schema final es el mismo: los tests del schema dan los mismos 143 controles y cada función, check e índice aplicados coinciden byte a byte con los archivos (md5 contra una base local armada desde el repo).

**Migraciones que el conector no puede aplicar (D-116).** El conector de Supabase pide confirmar toda sentencia que contenga `DELETE`, aunque esté dentro del cuerpo de una función (como en `revertir_lote`, que borra las filas del lote que deshace), y ese pedido vence antes de que alguien lo pueda aprobar. Una migración así la aplica el dueño: pega el archivo entero, sin cambios, en el editor SQL del proyecto y toca Run. Después se registra en `supabase_migrations.schema_migrations` con la versión del nombre del archivo (así no hace falta renombrarlo), se verifica contra el repo y se regeneran los tipos. El editor guarda los fines de línea como CRLF: la verificación compara el md5 del cuerpo de cada función normalizando el fin de línea, y en `revertir_lote` no cambia nada porque ninguna cadena del cuerpo ocupa más de una línea. Así se aplicó `carga_revertir` el 08/10.

Los archivos originales (Excel y capturas) viven en el bucket privado `cargas` de Supabase Storage, en `AAAA/MM/<sha256>.<ext>` (D-105).

## Principios

1. **Hechos, no estado.** Se guarda lo que pasó: operaciones, precios, tipos de cambio, saldos, cuotas y valuaciones. Posiciones, PPC, resultados, excedente y montos de vencimiento se **calculan** en TypeScript (D-22, D-23).
2. **"Sin dato" es NULL**, nunca cero ni un estimado. Precios y tipos de cambio no tienen valores por defecto.
3. **Todo hecho tiene origen.** Cada fila de mercado, cartera, saldos, movimientos, cuotas o valuaciones apunta a la **carga** de la que salió (`carga_id NOT NULL`). La carga guarda el archivo, la lectura cruda y lo confirmado (D-11, D-17).
4. **Todo cambio queda auditado.** Un trigger registra en `auditoria` cada alta, cambio y baja, con la fila antes y después. La auditoría es de solo lectura para el servidor.
5. **Montos exactos.** `numeric` sin precisión fija. Los checks excluyen `NaN` e `Infinity`. Se leen como texto (D-32).
6. **Base cerrada.** RLS en todas las tablas, sin políticas. `anon` y `authenticated` sin privilegios. El servidor (`service_role`) tiene permisos explícitos y mínimos: no puede truncar ni escribir la auditoría (D-20, D-33).

## Tablas

### Catálogos
| Tabla | Qué guarda | Notas |
|---|---|---|
| `cuentas` | IEB, Galicia, Mercado Pago | `formato_carga` dice cómo llega la info (Excel, captura o manual) |
| `activos` | Especies | `moneda_riesgo` (a qué moneda expone, no en cuál cotiza), `geografia`, `indexacion` para bonos, `color` fijo para todos los gráficos |
| `condiciones_bono` | Datos de emisión de bonos indexados o duales | Base CER, rezago, spread TAMAR, regla dual. Sin ellos, el valor técnico es "sin dato" |
| `ratios_cedear` | Ratio de cada CEDEAR con vigencia | El historial permite cambios de ratio |
| `flujos_bono` | Cronograma de pagos por 1 VN original | `interes` NULL = a determinar (TAMAR, duales) |
| `feriados` | Días no hábiles AR y US | Para "precio viejo" y liquidaciones (D-16) |

### Origen y auditoría
| Tabla | Qué guarda |
|---|---|
| `cargas` | Cada carga confirmada: fecha, cuenta (null para el tipo de cambio y las cargas manuales), origen (`excel`, `captura`, `manual`), archivo, lectura cruda, lo grabado con sus diferencias de conciliación y estado (`vigente`, `reemplazada`, `revertida`). Desde la 1a: **`lote`** (un Enter = un lote de varias cargas; llave de idempotencia, no única), **`lector`** (`ieb-excel@1`, `captura-claude@1 (…)`, `tipeado`, `manual`), **`archivo_sha256`** (obligatorio si hay archivo; la ruta lo contiene), **`tiempo_activo_ms`** (del lote, repetido en cada carga, D-62) y **`motivo_reversion`** (obligatorio si y solo si está revertida). `confirm_token` queda sin uso |
| `auditoria` | Antes y después de cada cambio, con la carga que lo produjo. Append-only |

### Mercado
| Tabla | Clave | Notas |
|---|---|---|
| `tipo_cambio` | fecha | CCL, MEP, cripto (al que vende el dueño) y oficial. Cualquiera puede faltar. `referencia`: de dónde sacó el dueño el CCL ("Ámbito, cierre"), hasta 200 caracteres |
| `cotizaciones` | fecha + activo | **Precio por 1 VN o por 1 unidad**, en pesos (D-12). El subyacente en USD es opcional |
| `indices` | índice + fecha | Series CER y TAMAR cargadas a mano |

### Cartera
| Tabla | Qué guarda | Reglas |
|---|---|---|
| `operaciones` | Apertura, compra, venta, vencimiento, renta, amortización, ajuste de ratio | Ver "Formas válidas de una operación". `precio_carga_id`: la carga que completó el precio de una compra pendiente (D-19, D-110); null si el precio vino con la compra. Un check exige que solo lo tenga una compra con precio y sin importe |
| `saldos_liquidez` | Saldo de cada cuenta por moneda y fecha | Excepción a "derivá todo" (D-13). **Puede ser negativo** (saldo deudor de IEB a liquidar) |
| `movimientos_capital` | Aportes, retiros y transferencias entre cuentas propias | Con monto en origen y en destino, tipo de cambio aplicado e impuesto (D-06) |

### Pasivos y bienes
| Tabla | Qué guarda |
|---|---|
| `pasivos` | Contrato: montos **netos de IVA**, opción de compra, valor del bien, alícuota de Ganancias de quien deduce el canon |
| `pasivo_cuotas` | Cuadro de marcha: canon neto, IVA, seguro, otros, total (calculado), pago real, cuenta y CCL del día de pago |
| `pasivo_saldos` | Capital pendiente informado por el acreedor. Es lo que netea Exposición desde la fase 1 |
| `bienes` | Casa, auto. El auto se vincula a su pasivo (D-03) |
| `bienes_valuaciones` | Valuaciones fechadas con su fuente (D-04) |

### Eventos
| Tabla | Qué guarda |
|---|---|
| `eventos` | Desde la 1a, la **nota del día** (tipo `nota`): una línea opcional del dueño, ligada a la primera carga del lote (`carga_id`). Una nota exige carga y texto. Los demás tipos (`balance`, `macro`, `otro`) son del calendario (fase 2) |

### Fases siguientes (el schema ya está)
`niveles` y `nivel_operaciones` (disciplina), `ingresos_fijos`, `gastos_fijos` y `flujo_mensual` (flujo de caja), `escenarios` (proyecciones) y `vencimientos` (destino decidido).

### Vistas
Solo agregación trivial. **Devuelven montos como texto.**
- `v_tenencias`: cantidad por cuenta y activo.
- `v_ultima_cotizacion`: último precio conocido de cada activo, con su fecha (para marcar los precios viejos).
- `v_ultimo_saldo`: último saldo de cada cuenta y moneda.

### Índices de la auditoría
`auditoria_despues_hechos` y `auditoria_antes_borrados` (GIN, `jsonb_path_ops`, sin las filas de `cargas`) permiten encontrar la historia de una fila por su clave. Sin ellos, revertir un lote con cinco años de cotizaciones leía toda la auditoría por cada fila (unos 0,7 s contra milisegundos).

## Funciones de escritura

Toda escritura de más de una fila pasa por una función de Postgres, en una sola transacción (regla 3). Todas son `security invoker` (corren con los permisos de `service_role`, así que la auditoría registra cada fila), con `search_path` fijo, y solo `service_role` puede ejecutarlas. Los montos llegan como texto JSON y se convierten con `leer_monto`, nunca a través de un float (D-32).

| Función | Qué hace |
|---|---|
| `confirmar_carga(p jsonb) → jsonb` | Graba un lote de la carga diaria (`ConfirmacionCarga`, `src/lib/carga/contratos.ts`): el tipo de cambio tipeado con su referencia (su propia carga), y por cuenta su carga, cotizaciones, saldos, operaciones y **precios que completan compras pendientes**; la nota del día. Devuelve `{lote, cargas, repetido}`. Detalle abajo |
| `revertir_lote(lote uuid, motivo text) → jsonb` | Revierte un lote entero, con motivo obligatorio (regla 4). Devuelve `{lote, cargas, borradas, restauradas}` |
| `guardar_manual(p jsonb) → bigint` | Una carga `manual` con valuaciones de bienes (reemplaza la del mismo bien y día), capital pendiente de pasivos (ídem por pasivo y día) y movimientos de capital (impuesto 0 si no se informa). Cada hecho usa su fecha o la de la carga. Idempotente por lote; devuelve el id de la carga |
| `alta_activo(p jsonb) → integer` | Un activo y, si es CEDEAR, su ratio, juntos: nunca queda un CEDEAR sin ratio. El ratio rige desde hoy (Córdoba) si no se indica otra vigencia. Un ratio solo se acepta en un CEDEAR |
| `editar_activo(id, p jsonb)` | Cambia solo las claves presentes (una clave con null borra el valor) y agrega o corrige un ratio con su vigencia |
| `leer_monto`, `leer_fecha`, `leer_id` | Leen la entrada JSON. `leer_monto` acepta solo texto decimal (`"-1234.56"`): falla con un número JSON, `NaN`, `Infinity`, exponentes o formato es-AR. Vacío o null = sin dato |

**`confirmar_carga`, en detalle:**
- Un lock global serializa toda escritura de cargas: un doble Enter espera al primero y lo encuentra.
- **Lote repetido:** devuelve lo ya grabado con `repetido: true`, sin escribir. Se niega si el lote fue revertido ("empezá una carga nueva"), si es de un alta manual, o si llega con otra fecha, otras cuentas u otro tipo de cambio.
- **Tipo de cambio:** si los cuatro valores vienen vacíos, no es un dato y no pisa nada. Si no, el día queda con lo tipeado ahora y su carga anterior pasa a `reemplazada`.
- **Por cuenta:** volver a cargar el mismo día reemplaza la carga anterior de esa cuenta (pasa a `reemplazada`): pisa los precios y saldos que trae, conserva los que no trae y **suma** las operaciones.
- **Completar precios:** la compra tiene que seguir pendiente (sin precio ni importe), ser de esa cuenta y no ser posterior a la carga. Se graba el precio y `precio_carga_id`; la auditoría guarda el antes y el después.
- **Rechaza:** una cuenta repetida, dos cotizaciones del mismo activo en una cuenta, dos saldos en la misma moneda, una carga vacía ("No hay nada para grabar"). Cada error de una fila sale con contexto legible ("IEB · venta de AL30") y aborta todo.
- `tiempo_activo_ms` se graba en cada carga del lote.

## Formas válidas de una operación

| Tipo | Cantidad | Precio | Importe | CCL del día |
|---|---|---|---|---|
| `apertura` | > 0 | PPP del bróker, o NULL = costo "sin dato" | — | opcional; si se carga, exige `fecha_origen` |
| `compra` | > 0 | opcional (NULL = pendiente: compra del día con PPP `-`) | opcional: total liquidado con comisiones | obligatorio |
| `venta` | > 0 | precio o importe, al menos uno | | obligatorio |
| `vencimiento` | > 0 (lo que sale) | — | obligatorio (lo cobrado) | obligatorio |
| `renta`, `amortizacion` | 0 | — | obligatorio | obligatorio |
| `ajuste_ratio` | ≠ 0, con signo | — | — | obligatorio |

- `moneda` indica la moneda de precio, importe y comisiones (los dividendos de CEDEAR se cobran en USD).
- PPC en pesos = `importe` si existe, si no `cantidad × precio + comisiones`, todo dividido por la cantidad.
- Hay **una sola apertura por cuenta y activo** (índice único).

## Reglas para el código que habla con la base

1. **Lecturas de montos con `::text`**, sin `select('*')`. El parser de plata acepta solo `string | null` y lanza un error si recibe un número (D-32).
2. **Paginación obligatoria** para historias (cotizaciones, saldos, tipo de cambio): PostgREST corta en 1.000 filas **sin avisar**. Un helper pagina con `.range()` sobre un orden total, pide `count: 'exact'` y falla si llegan menos filas que las contadas.
3. **Las escrituras de una carga van en una sola transacción.** Con supabase-js cada `insert` es un pedido HTTP separado, sin atomicidad. Por eso la confirmación, la reversión, las altas manuales y el alta o edición de un activo pasan por funciones de Postgres (`confirmar_carga`, `revertir_lote`, `guardar_manual`, `alta_activo`, `editar_activo`; ver "Funciones de escritura"). Usan `coalesce` para los valores por defecto (supabase-js manda `NULL` en lugar del default cuando falta una clave). En el código, toda escritura pasa por `src/lib/server/escritura.ts`, que valida antes de mandar y traduce los errores al castellano.
4. **Revertir es por lote** (`revertir_lote`), con motivo obligatorio, y **solo si cada carga del lote es la última de su cuenta** (el error nombra la carga posterior). También se niega si una fila de `nivel_operaciones` apunta a una de sus operaciones, o si el lote tiene filas en una tabla que la reversión no sabe deshacer. Para cada fila de las cargas del lote (en toda tabla con `carga_id`), recorre su historia en la auditoría de la más nueva a la más vieja: si encuentra un borrado, borra la fila; si no, restaura la última versión que no venga de una carga del lote ni de una carga revertida, y si no hay ninguna, borra la fila. Así funciona aunque en el medio haya habido otras reversiones. Los precios que el lote había completado vuelven a quedar pendientes. Las cargas quedan en el registro como `revertida`, con fecha y motivo, y la última carga no revertida de cada día y cuenta (o del tipo de cambio de ese día) vuelve a `vigente`.

## Cómo se cambia el schema

1. Nueva migración en `supabase/migrations/` (nunca se edita una ya aplicada).
2. Grants explícitos a `service_role` para cada objeto nuevo. Por defecto no recibe nada (D-33). Una función nueva es ejecutable por `PUBLIC` por defecto: hay que revocarla a `public`, `anon` y `authenticated` y otorgarla a `service_role`. Si la migración agrega checks que los datos existentes podrían no cumplir, empieza con una guarda que aborta con un mensaje claro (como la de `carga_transaccional`).
3. `supabase/tests/run.sh` contra un Postgres local: reconstruye la base de cero y corre los tests. Cada cambio suma sus propios casos.
4. Aplicar con el MCP de Supabase (`apply_migration`). Después, **renombrar el archivo local a la versión que registró Supabase** (`list_migrations`), para que el historial local y el remoto coincidan.
5. Regenerar `src/lib/database.types.ts` y revisar los avisos de seguridad de Supabase.
6. Actualizar este documento, `CHANGELOG.md` y las decisiones.
