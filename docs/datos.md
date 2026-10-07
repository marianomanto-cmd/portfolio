# Modelo de datos

Base: Supabase, proyecto **Portfolio** (`zcgynhzddfjzwswekcvl`). Schema `public`. Migraciones en `supabase/migrations/`, tipos generados en `src/lib/database.types.ts` y tests del schema en `supabase/tests/`.

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
| `cargas` | Cada carga confirmada: fecha, cuenta, origen, archivo, lectura cruda, lo grabado con sus diferencias de conciliación, estado (`vigente`, `reemplazada`, `revertida`) y token de idempotencia |
| `auditoria` | Antes y después de cada cambio, con la carga que lo produjo. Append-only |

### Mercado
| Tabla | Clave | Notas |
|---|---|---|
| `tipo_cambio` | fecha | CCL, MEP, cripto (al que vende el dueño) y oficial. Cualquiera puede faltar |
| `cotizaciones` | fecha + activo | **Precio por 1 VN o por 1 unidad**, en pesos (D-12). El subyacente en USD es opcional |
| `indices` | índice + fecha | Series CER y TAMAR cargadas a mano |

### Cartera
| Tabla | Qué guarda | Reglas |
|---|---|---|
| `operaciones` | Apertura, compra, venta, vencimiento, renta, amortización, ajuste de ratio | Ver "Formas válidas de una operación" |
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

### Fases siguientes (el schema ya está)
`niveles` y `nivel_operaciones` (disciplina), `ingresos_fijos`, `gastos_fijos` y `flujo_mensual` (flujo de caja), `escenarios` (proyecciones), `vencimientos` (destino decidido) y `eventos` (calendario).

### Vistas
Solo agregación trivial. **Devuelven montos como texto.**
- `v_tenencias`: cantidad por cuenta y activo.
- `v_ultima_cotizacion`: último precio conocido de cada activo, con su fecha (para marcar los precios viejos).
- `v_ultimo_saldo`: último saldo de cada cuenta y moneda.

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
3. **Las escrituras de una carga van en una sola transacción.** Con supabase-js cada `insert` es un pedido HTTP separado, sin atomicidad. La confirmación y la reversión de una carga se hacen con funciones de Postgres (`confirmar_carga`, `revertir_carga`), que entran en la migración de la fase 1 junto con su código. Esas funciones usan `coalesce` para los valores por defecto (supabase-js manda `NULL` en lugar del default cuando falta una clave en un insert de varias filas).
4. **Revertir** = borrar las filas de la carga, restaurar desde `auditoria` lo que esa carga había pisado, y marcar la carga como `revertida`. La carga queda en el registro.

## Cómo se cambia el schema

1. Nueva migración en `supabase/migrations/` (nunca se edita una ya aplicada).
2. Grants explícitos a `service_role` para cada objeto nuevo. Por defecto no recibe nada (D-33).
3. `supabase/tests/run.sh` contra un Postgres local: reconstruye la base de cero y corre los tests. Cada cambio suma sus propios casos.
4. Aplicar con el MCP de Supabase (`apply_migration`). Después, **renombrar el archivo local a la versión que registró Supabase** (`list_migrations`), para que el historial local y el remoto coincidan.
5. Regenerar `src/lib/database.types.ts`.
6. Actualizar este documento, `CHANGELOG.md` y las decisiones.
