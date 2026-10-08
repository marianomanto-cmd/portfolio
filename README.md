# Portfolio

Gestión de la cartera de inversiones personal. Todo número existe a la vez en pesos y en dólares, y la variación se separa en lo que vino del activo y lo que vino del tipo de cambio. Los pasivos netean contra los activos. Las proyecciones corren sobre supuestos guardados y comparables.

Un solo usuario. La app no opera ni recomienda: muestra datos y proyecta supuestos.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 · Núcleo | Schema, carga diaria (Excel/captura), cartera en dos monedas, exposición con pasivos neteados, evolución patrimonial histórica, registro de cargas | **Schema aplicado y testeado.** Falta la visión de producto (investigación en curso) y la UI |
| 2 · Contexto | Pasivos y licuación, flujo de caja, calendario con alertas, bienes | Pendiente |
| 3 · Motor | Proyecciones, escenarios, Monte Carlo, cobertura de cuota, proyección de PnL | Pendiente |
| 4 · Disciplina | Niveles decididos vs. ejecutados, rendimientos realizados, benchmark SPY | Pendiente |

> El código en `src/` todavía es el de la app anterior (Corte) y se reemplaza al completar la fase 1. No describe esta app.

## Documentación

| Documento | Qué hay |
|---|---|
| [`docs/spec.md`](docs/spec.md) | Lo que pidió el dueño. Manda. |
| [`docs/decisiones.md`](docs/decisiones.md) | Cada decisión que ajusta el spec, con su porqué. |
| [`docs/datos.md`](docs/datos.md) | Modelo de datos: tablas, reglas, cómo leer y escribir, cómo cambiar el schema. |
| [`docs/carga-diaria.md`](docs/carga-diaria.md) | Formatos de entrada (IEB, Galicia, Mercado Pago) y reglas de lectura. |
| [`docs/calidad.md`](docs/calidad.md) | Definición de terminado: los controles que cada fase tiene que pasar. |
| [`docs/stack.md`](docs/stack.md) | Librerías elegidas, verificadas contra fuentes, y por qué. |
| [`docs/investigacion-mercado.md`](docs/investigacion-mercado.md) | Lo mejor que existe (comercial, open source, argentino, DIY) y qué tomar. Propone D-35 a D-53, pendientes de aprobación. |
| [`docs/investigacion-vida.md`](docs/investigacion-vida.md) | Tu vida financiera completa: presupuesto con inflación, impuestos por activo, durabilidad, objetivos, ingresos en USD, riesgo, sucesión, empresa vs. personal, seguros, jubilación. |
| [`CHANGELOG.md`](CHANGELOG.md) | Registro de cambios. |
| [`CLAUDE.md`](CLAUDE.md) | Reglas para trabajar en el repo. |

## Infraestructura

- **Base:** Supabase, proyecto `Portfolio` (`zcgynhzddfjzwswekcvl`, sa-east-1). Schema en `supabase/migrations/`; la base se reconstruye de cero aplicándolas en orden. Tests: `supabase/tests/run.sh`.
- **Deploy:** Vercel, proyecto `portfolio`. Un solo entorno: producción (`main`).
- **Acceso:** clave simple por middleware (D-21). La base está cerrada a todo lo que no sea el servidor (D-20).

## Variables de entorno (Vercel)

| Variable | Para qué |
|---|---|
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso del servidor a la base. Nunca llega al navegador. |
| `ANTHROPIC_API_KEY` | Lectura de capturas (Galicia, Mercado Pago) |
| `APP_PASSWORD` | Clave de acceso a la app |
| `SESSION_SECRET` | Firma de la cookie de sesión |
