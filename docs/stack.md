# Stack

Partió de la propuesta del dueño ("Stack de UI — librerías gratuitas", 2026-10-07). Cada afirmación de esa propuesta se verificó contra la documentación, el registro de npm y mediciones propias (bundles medidos con esbuild y gzip; Recharts y ECharts renderizados en jsdom). Abajo, lo que se adopta y lo que se corrige. Decisión: D-31.

## Lo que se adopta

| Área | Librería | Notas de uso |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript `strict` | Runtime Node, no Edge (exceljs y el parser lo necesitan) |
| Estilos | Tailwind v4 + shadcn/ui (`init -b radix`) | Tokens con `@theme inline`, sin `tailwind.config.js` |
| Iconos | lucide-react | Botones solo-icono con `aria-label` |
| Fuentes | Geist + Geist Mono (next/font) | `tabular-nums` en **toda** cifra (celdas, KPIs, ejes, tooltips). No se asume que la fuente alinea sola |
| Gráficos | **Apache ECharts 6**, única librería de gráficos | Imports à la carte desde `echarts/core`. Wrapper propio de ~40 líneas (init, setOption, ResizeObserver, dispose). Se carga solo en las rutas con gráficos |
| Tablas | TanStack Table | Columna del ticker fijada, orden por cualquier columna. Virtualización solo si el profiling la pide |
| Plata | decimal.js | Solo en la capa contable: PPC, resultados, conversiones, cuotas, IVA. Redondeo explícito |
| Monte Carlo | Código propio en float64 | PRNG sfc32 sembrado vía splitmix32; normal y gamma de d3-random con esa fuente; cuantil tipo 7 propio, testeado contra numpy |
| Inputs numéricos | react-number-format | `NumericFormat` con `.` de miles y `,` decimal, `valueIsNumericString`. Se lee `values.value`, nunca `floatValue` |
| Números animados | @number-flow/react | Solo en los KPIs grandes, nunca en celdas. Respeta reduced-motion |
| Estado en URL | nuqs + zod 4 | Supuestos de escenarios versionados con `discriminatedUnion('v', …)` y migración de versiones viejas |
| Validación | zod 4 | Entradas de server actions, filas del Excel, lectura de capturas |
| Fechas | date-fns 4 + `TZDate` en America/Argentina/Cordoba | "Hoy" nunca depende de la zona horaria del servidor |
| Feriados | date-holidays (solo para sembrar) + tabla `feriados` | Se siembra cada año y se corrige a mano con el calendario de BYMA. Nunca se calcula en vivo |
| Excel | exceljs | Lee el Excel de IEB en un Route Handler (multipart) y exporta. Detrás de una interfaz propia, por si hay que cambiarlo |
| IA | @anthropic-ai/sdk | Solo en el servidor, para las capturas |
| Base | supabase-js con `service_role`, solo en el servidor | Ver "Números exactos desde la base" |
| Tests | Vitest, fast-check, Playwright, axe-core | Ver `docs/calidad.md` |

## Correcciones a la propuesta original

| Afirmación | Resultado | Qué cambia |
|---|---|---|
| "Recharts se traba arriba de ~1.000 puntos y el abanico de Monte Carlo los pasa" | **Falso** en este caso. El abanico son 5 percentiles × 43 meses = 215 valores (645 con 3 escenarios), y dibujado como bandas son ~20 paths SVG | ECharts se elige igual, pero por otros motivos: `dataZoom`, `markLine`/`markArea` para los niveles, treemap, eje log, y **una sola librería**, que garantiza mismo color por activo y un solo tema claro/oscuro |
| "ECharts à la carte pesa 80–130 KB gzip" | **Falso.** Medido con ECharts 6.1: 227 KB gzip (190 KB brotli) con los componentes de esta app; solo un gráfico de línea ya pesa 172 KB | Se acepta para una app de un usuario, pero se carga solo en las rutas con gráficos |
| "ECharts es Canvas/WebGL" | WebGL solo está en echarts-gl, que no hace falta | Canvas por defecto |
| Lightweight Charts para series de precio | Pesa ~50–60 KB, no 12. Exige atribución visible | **No se usa.** ECharts con eje de categorías por fecha hábil tampoco dibuja el fin de semana, y sumar una segunda librería rompe "mismo color por activo" |
| Tremor para tarjetas de KPI | Sus gráficos usan **Recharts 2.15**; su paquete npm es de Tailwind v3 y pide `--legacy-peer-deps` con React 19. Licencia: Apache-2.0 (componentes) y MIT (bloques), no "todo MIT" | **No se usa.** Las tarjetas se arman con shadcn |
| jStat para la t-Student | Existe, pero está sin mantenimiento, no tiene tipos, y su semilla es global: en Vercel, dos pedidos simultáneos pueden pisarse la fuente y romper la reproducibilidad | **No se usa.** t = Z / √(G/ν), con G = Gamma(ν/2, 2), escalada por √((ν−2)/ν) |
| d3-random `randomLcg` como generador | Tiene período y calidad insuficientes para 10⁶–10⁷ sorteos | Se reemplaza por sfc32. Cada escenario guarda `{algoritmo, semilla}` y un test fija los primeros N valores |
| simple-statistics para cuantiles | Cambió la definición de percentil en una versión patch | Cuantil propio tipo 7, testeado contra numpy |
| TanStack Query para cachear Supabase | El navegador nunca habla con Supabase (D-20) | **No se usa.** Server Components, Server Actions y `useOptimistic` |
| "No existe librería de feriados argentinos" | **Falso:** date-holidays cubre Argentina | Se usa para sembrar la tabla, con correcciones manuales de BYMA |
| SheetJS fuera de npm | Correcto: `npm i xlsx` instala 0.18.5, con vulnerabilidades | exceljs, como proponía el documento |

## Números exactos desde la base

Hallazgo importante, que no estaba en la propuesta:

1. **PostgREST devuelve los `numeric` como números JSON.** supabase-js los parsea a `float64` antes de que el código los vea, y decimal.js ya no puede recuperar lo que se perdió. **Regla:** toda lectura de montos se hace con cast a texto (`.select('precio_pesos::text')`), nunca `select('*')`. Las vistas devuelven texto. El parser de plata acepta solo `string | null` y **lanza un error si recibe un número**, para que un cast olvidado falle a la vista y no en silencio.
2. **Un `numeric check (x > 0)` acepta `NaN` e `Infinity`** (en Postgres, `NaN` es mayor que todo). Todo check de monto pasa a ser `x > 0 and x < 'Infinity'`.
3. **Escritura:** los montos se mandan como strings de Decimal, que es lo que hace exacto el viaje de vuelta.

## Lo que corre dónde

- **Navegador:** UI, gráficos, Monte Carlo en un Web Worker (sin datos sensibles: recibe agregados) para que mover un supuesto responda en menos de 200 ms.
- **Servidor:** lecturas y escrituras a Supabase, parser del Excel, lectura de capturas con Claude y cálculos contables con decimal.js. Los escenarios guardados corren el mismo Monte Carlo en el servidor, con la misma semilla.
