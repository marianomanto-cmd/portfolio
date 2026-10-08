# Portfolio

Gestión de la cartera de inversiones personal. Todo número existe a la vez en pesos y en dólares, y la variación se separa en lo que vino del activo y lo que vino del tipo de cambio. Los pasivos netean contra los activos. Cada cifra muestra de dónde sale; lo que falta dice "sin dato", nunca cero.

Un solo usuario. La app no opera ni recomienda, y no trae precios de afuera: muestra lo que cargás y, más adelante, proyecta tus supuestos.

**Dirección:** https://portfolio-xi-rose-23.vercel.app (pide la clave). Cómo usarla: [`docs/manual.md`](docs/manual.md).

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| **1a · Núcleo mínimo** | Carga diaria (Excel de IEB, capturas de Galicia y Mercado Pago, CCL y cripto) con bandeja de revisión; Hoy, Cartera y Exposición en dos monedas con desglose activo/TC; Registro con reversión; Datos (catálogo, cuentas, bienes, leasing, movimientos de capital); Ajustes | **Construida.** Falta validarla con tus archivos reales, el respaldo nocturno y CI (`docs/calidad.md`, "Estado de la 1a") |
| 1b · Núcleo completo | Evolución y PnL, Pendientes, ficha de activo, gráficos de Exposición, borrador compartido entre dispositivos, tesis como datos | Pendiente |
| 2 · Contexto | Pasivos y licuación, flujo de caja y cierre del mes, calendario con alertas | Pendiente |
| 3 · Motor | Proyecciones, escenarios, Monte Carlo, cobertura de cuota | Pendiente |
| 4 · Disciplina | Tesis y niveles, línea de veredicto, rendimientos realizados, benchmark SPY | Pendiente |

Plan completo en `docs/vision.md` §5. Las decisiones de la visión siguen esperando aprobación; las que la 1a ya usa están al final de `docs/decisiones.md`.

## Documentación

| Documento | Qué hay |
|---|---|
| [`docs/manual.md`](docs/manual.md) | **Manual de uso:** cómo entrar, cada pantalla, el Día cero, la rutina diaria, deshacer y revertir, problemas comunes. |
| [`docs/arquitectura.md`](docs/arquitectura.md) | **Mapa para quien mantenga la app:** carpetas, flujo de datos, motor e invariantes, contratos, seguridad, cómo correrla y probarla. |
| [`docs/spec.md`](docs/spec.md) | Lo que pidió el dueño. Manda. |
| [`docs/vision.md`](docs/vision.md) | Visión de producto: pantallas, rituales, plan por fases, decisiones para aprobar, schema y riesgos. |
| [`docs/decisiones.md`](docs/decisiones.md) | Cada decisión que ajusta el spec, con su porqué, y las propuestas que la 1a implementa en forma provisoria. |
| [`docs/carga-diaria.md`](docs/carga-diaria.md) | La carga diaria: formatos de entrada, cómo se lee cada fuente, la bandeja y el Día cero. |
| [`docs/datos.md`](docs/datos.md) | Modelo de datos: tablas, funciones, reglas para leer y escribir, cómo cambiar el schema. |
| [`docs/calidad.md`](docs/calidad.md) | Definición de terminado y el estado de cada control en la 1a. |
| [`docs/stack.md`](docs/stack.md) | Librerías elegidas, verificadas contra fuentes, y por qué. |
| [`docs/investigacion-mercado.md`](docs/investigacion-mercado.md) | Lo mejor que existe y qué tomar. Propone D-35 a D-53. |
| [`docs/investigacion-vida.md`](docs/investigacion-vida.md) | La vida financiera completa: presupuesto, impuestos, durabilidad, objetivos, riesgo, sucesión, seguros, jubilación. |
| [`CHANGELOG.md`](CHANGELOG.md) | Registro de cambios. |
| [`CLAUDE.md`](CLAUDE.md) | Reglas para trabajar en el repo. |

## Infraestructura

- **Base:** Supabase, proyecto Portfolio (`zcgynhzddfjzwswekcvl`, sa-east-1). Schema en `supabase/migrations/`: la base se reconstruye de cero aplicándolas en orden. Cerrada al navegador: solo el servidor la toca (D-20).
- **Deploy:** Vercel, proyecto `portfolio`, región `gru1`. Un solo entorno: producción, desde `main`.
- **CI:** GitHub Actions (`.github/workflows/ci.yml`): tipos, tests, build y tests del schema en cada pull request.
- **Acceso:** una clave, verificada por `src/proxy.ts` y otra vez en cada acción del servidor (D-21, D-112).
- **Lectura de capturas:** Claude, con la API de Anthropic, solo desde el servidor (D-108).

## Variables de entorno (Vercel)

Se cargan en Vercel → proyecto `portfolio` → Settings → Environment Variables, para Production. Ninguna llega al navegador.

| Variable | ¿Obligatoria? | Para qué |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Sí (o la siguiente) | Clave secreta del proyecto Portfolio de Supabase (`sb_secret_…`). El servidor la usa para leer y escribir la base |
| `SUPABASE_SERVICE_ROLE_KEY` | Alternativa | La clave `service_role` heredada, si no está la anterior |
| `APP_PASSWORD` | Sí | La clave para entrar. Sin ella, nadie entra |
| `SESSION_SECRET` | No, **recomendada** | 32 bytes al azar (`openssl rand -base64 32`). Firma la sesión y las lecturas de Cargar con un secreto que no se puede adivinar. Sin ella, la sesión se firma con una clave derivada de `APP_PASSWORD` (PBKDF2, lenta a propósito). Cambiarla cierra todas las sesiones |
| `ANTHROPIC_API_KEY` | Sí, para capturas | Lectura de las capturas de Galicia y Mercado Pago. Sin ella, el Excel de IEB se lee igual |
| `ANTHROPIC_MODEL_A`, `ANTHROPIC_MODEL_B` | No | Los dos modelos que leen cada captura. Por defecto, `claude-opus-5-5` y `claude-sonnet-5-5` |
| `ANTHROPIC_FALLBACK` | No | `no` apaga el cambio automático de modelo ante una negativa (función beta) |
| `SUPABASE_URL` | No | La URL del proyecto está fija en el código; esta variable solo la pisa |
| `PORTFOLIO_DEMO` | Nunca en Vercel | `1` = modo demo, con datos inventados y sin clave, solo para desarrollo local y tests. En producción se ignora, pero en un Preview de Vercel no: no la cargues en ningún entorno |

Las claves secretas (`SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`) van solo en Production.

## Comandos

```
npm ci                                   # instalar (Node 22 a 24)
PORTFOLIO_DEMO=1 npx next dev -p 3100    # la app con datos inventados, sin base ni clave
npm run typecheck                        # tipos
npm test                                 # tests unitarios, de propiedades y de referencia
npm run test:schema                      # tests del schema (Postgres local)
npm run test:e2e                         # layout D-30, interacción y entrada (Playwright)
npm run test:e2e:prod                    # lo mismo contra el build de producción (antes de desplegar)
npm run test:e2e:auth                    # solo la entrada, como en producción
npm run build                            # build de producción
```

Detalle de cada uno, y cómo levantar dos servidores a la vez (`NEXT_DIST_DIR`), en `docs/arquitectura.md`.
