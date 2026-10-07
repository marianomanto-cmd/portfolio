# Cambios

Todo cambio de la app se registra acá, el más nuevo primero. Cada entrada dice qué cambió y remite a la decisión (`docs/decisiones.md`) o a la sección del spec que lo motiva.

## [Sin publicar]

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
