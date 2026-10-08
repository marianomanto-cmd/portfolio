# Cambios

Todo cambio de la app se registra acá, el más nuevo primero. Cada entrada dice qué cambió y remite a la decisión (`docs/decisiones.md`) o a la sección del spec que lo motiva.

## [Sin publicar]

### 2026-10-08 — Fase 1a: la primera versión usable
La app nueva reemplaza a Corte (D-01): carga diaria, Hoy, Cartera, Exposición, Registro, Datos y Ajustes, con todo número en pesos y en dólares y su traza. Cómo se usa: `docs/manual.md`. Cómo está hecha: `docs/arquitectura.md`.

- **Entrada y seguridad** (D-21, D-112):
  - una sola clave (`APP_PASSWORD`) y una sesión de 30 días firmada con claves derivadas (PBKDF2, o `SESSION_SECRET`), una por propósito; cambiar la clave cierra todas las sesiones;
  - `src/proxy.ts` protege toda ruta, y cada Server Action y la ruta de lectura vuelven a verificar la sesión (un test estático lo controla);
  - freno a los intentos de clave: 800 ms por error y, desde el tercero seguido, una espera que se duplica hasta 5 minutos;
  - Content-Security-Policy con nonce por pedido, rechazo de todo POST que no venga de la propia app y encabezados de seguridad en toda respuesta (sin iframes, HSTS, `nosniff`, sin cámara ni ubicación, `noindex`);
  - la vuelta después de entrar solo va a rutas propias;
  - modo demo (`PORTFOLIO_DEMO=1`) solo en desarrollo, imposible en producción;
  - la base sigue cerrada al navegador (D-20);
  - un solo "Salir", en Ajustes.
- **Shell:**
  - barra lateral colapsable en la compu y barra inferior en el teléfono, con Cargar al centro;
  - solo las secciones de la 1a (D-69);
  - chip de estado de los datos ("Datos al cierre del mié 14/10 · 5 de 5 fuentes"), modo privado, tema y paleta daltónica;
  - atajos `c` (Cargar) y `h` (modo privado);
  - colores tenues y paleta daltónica con contraste AA;
  - una sola lectura de la base por pantalla.
- **Hoy:**
  - la frase del día, con cada cifra tocable;
  - patrimonio financiero y total en pesos y en dólares (D-03);
  - la línea "pesos financieros − deuda del leasing" con su sensibilidad al +1% de CCL (D-101);
  - Atención, "Todavía no cargaste hoy", quién movió tu financiero, el cuadre y el aviso de diciembre;
  - el Día cero y "Primera carga guardada".
- **Cartera:**
  - tabla en la compu, con prioridad de columnas, orden por cualquier columna, totales fijos y filtros;
  - tarjetas en el teléfono, con "ganás en pesos, perdés en dólares";
  - desglose activo/TC en pesos y en dólares desde la compra, con la misma suma de intervalos que Hoy (D-35);
  - totales "sin dato" con la suma parcial (D-65);
  - la liquidez en un bloque aparte.
- **Exposición:**
  - selector Financiero · Total con lo que netea cada vista;
  - largo, corto y neto en pesos y en dólares, y la sensibilidad al +1% de CCL;
  - composición por clase, moneda de riesgo y geografía, y concentración top 1 y top 3, sin umbral;
  - la vista Total es "sin dato" mientras los bienes no tengan moneda de riesgo (D-73), y la concentración se mide sobre el financiero (D-03).
- **Cargar** (D-104 a D-106):
  - CCL y cripto con eco en formato es-AR, y la referencia del CCL;
  - una zona para soltar o pegar el Excel y las capturas, leídos en paralelo por `POST /carga/leer`, con el archivo guardado al leer y la lectura firmada;
  - bandeja con las verificadas plegadas, advertencias que se aceptan de a una, errores que frenan el Enter, las dos lecturas de una captura para elegir con un toque, alta de tickers en la misma pantalla, conciliación editable, saldos con su valor anterior y controles ✓/≠;
  - completar el precio de una compra pendiente (D-110): la carga siguiente que trae el PPP propone el precio con su fórmula, y se acepta ("Completar"), se corrige ("Editar precio"), se graba la fila sin completarlo o se deja pendiente; nunca se aplica solo, y revertir esa carga lo deja pendiente otra vez;
  - conciliación (D-115): una carga atrasada se compara contra lo que la app tenía ese día y avisa que hay una carga posterior; más cantidad con el mismo costo total pregunta "¿Cambio de ratio?" y propone un ajuste sin precio; un precio inferido nunca es cero ni negativo;
  - las dos lecturas de una captura que no coinciden, lado a lado: la que cierra la cuenta acepta la fila y la otra corrige ese número, que se vuelve a controlar;
  - cada control con su tolerancia, y la diferencia "DOLARUSA al dólar de IEB vs tu CCL" con nombre (D-66);
  - números tipeados a mano: lo ambiguo ("1.0852", "1,548.20", "12.34.56") no se lee como miles, se pide corregir;
  - "No pude leer…" sale una sola vez, y una fila con error muestra primero el motivo que frena;
  - tiempo activo (D-62), Enter que guarda solo lo verificado, "Guardar sin …" y Deshacer.
- **Registro:** una tarjeta por lote con sus cargas, archivo, conteos, estado y tiempo activo, y "Revertir el lote" con motivo obligatorio.
- **Datos:**
  - catálogo, con el ratio y su historia;
  - cuentas;
  - bienes, con valuaciones fechadas y su valor en las dos monedas;
  - leasing, con su capital pendiente;
  - movimientos de capital: aportes, retiros y transferencias con sus monedas, montos, tipo de cambio aplicado, impuesto y fechas, y los últimos movimientos en las dos monedas al CCL de su fecha (D-111);
  - `/datos?seccion=…` lleva a cada subpantalla.
- **Lector del Excel de IEB** (`ieb-excel@1`, D-107):
  - lee el Portafolio sin IA, con su chequeo por fila `cantidad × precio × escala ≈ posición` (D-11) y la escala detectada por fila (D-12);
  - toma el saldo Total en pesos y en dólares, más DOLARUSA (D-13);
  - controla B2 y los Subtotales, con tolerancia según el formato de cada celda (D-37, D-38);
  - guarda la lectura cruda de cada celda.
- **Lector de capturas de Galicia y Mercado Pago** (`captura-claude@1`, D-108):
  - dos lecturas en paralelo con Claude (Opus 5.5 y Sonnet 5.5, configurables), con salida estructurada, sin herramientas y con la imagen intacta;
  - verificación aritmética con escala y tolerancia por decimales mostrados;
  - el PPC preciso, reconstruido y controlado;
  - el total de la captura como control;
  - las lecturas que difieren quedan en advertencia, con las dos a la vista;
  - errores en castellano.
- **Motor** (`src/lib/domain`, `src/lib/vistas`):
  - posiciones derivadas de las operaciones;
  - PPC en pesos y en dólares;
  - valuación diaria en las dos monedas;
  - desglose activo/TC anclado en observaciones frescas, con "sin atribuir" (D-35, provisoria);
  - un saldo nuevo, la primera valuación de un bien y el primer capital de una deuda entran como apertura, nunca como ganancia;
  - la amortización baja el costo y la renta no lo toca (D-114);
  - el cuadre de Hoy compara contra el patrimonio recalculado desde los hechos y ahora puede fallar (D-66);
  - CCL de un día sin observación: el último tipeado, con su fecha y "viejo" a los 2 días hábiles (D-109);
  - compra pendiente valuada "inferida" (D-110);
  - etiquetas viejo, declarado, inferido, pendiente y parcial;
  - traza en cada cifra (D-67).
- **Base:** carga transaccional en cinco migraciones (`supabase/migrations/`; aplicadas el 08/10 salvo `carga_revertir`, pendiente porque el conector de Supabase no deja aprobar su `DELETE`; ver `docs/datos.md`):
  - `cargas` con lote, lector, `archivo_sha256`, `tiempo_activo_ms` y `motivo_reversion`;
  - `tipo_cambio` con la referencia del CCL;
  - `operaciones` con la carga que completó el precio de una compra pendiente;
  - `eventos` con la nota del día;
  - las funciones `confirmar_carga`, `revertir_lote`, `guardar_manual`, `alta_activo` y `editar_activo`, cada una en una sola transacción;
  - índices para recorrer la auditoría al revertir.
- **Escritura** (`src/lib/server/escritura.ts`): valida los montos como texto (D-32), traduce los errores de la base al castellano y sube los archivos nombrados por su sha256.
- **Verificación:**
  - tests unitarios y de propiedades (Vitest y fast-check), entre ellas las del desglose anclado: un período es la suma exacta de sus días y una carga express entre dos completas no lo cambia;
  - implementación de referencia en Python que cruza el motor con 310 casos;
  - revisión adversarial del motor con un test por hallazgo;
  - tests del schema: 143 controles, todos como `service_role` (antes 40);
  - layout D-30 con Playwright (9 anchos, claro y oscuro, axe-core), más interacción y entrada;
  - estado de cada control y sus comandos: `docs/calidad.md`, "Estado de la 1a".
- **Documentación:**
  - `docs/manual.md`, el manual de uso, nuevo;
  - `docs/arquitectura.md`, el mapa para quien mantenga la app, nuevo;
  - decisiones D-104 a D-115;
  - las propuestas que la 1a implementa en forma provisoria (`docs/decisiones.md`);
  - lectores y bandeja en `docs/carga-diaria.md`;
  - objetos nuevos del schema en `docs/datos.md`;
  - README al día.
- **CI** (`.github/workflows/ci.yml`): tipos, tests, build de producción y tests del schema en cada pull request y en `main`.
- **Falta para cerrar la 1a** (`docs/calidad.md`):
  - validar con tus archivos reales;
  - el respaldo nocturno restaurado;
  - Playwright y lint en CI;
  - el test cronometrado de la carga;
  - Lighthouse.

### 2026-10-08 — Visión de producto
- **`docs/vision.md`**: cuatro diseños independientes (el hábito, la verdad de los números, toda la vida financiera, decidir mejor), puntuados por tres jueces (fidelidad al dueño, ingeniería, utilidad a largo plazo). Ganó "El hábito" (246 puntos) y se le injertaron las mejores ideas de los otros. Después pasó por una revisión adversarial y un control de coherencia (21 inconsistencias corregidas). Trae mapa de navegación, cada pantalla en desktop y en el teléfono, rituales, plan por fases (1a, 1b, 2, 3, 4 y una 5 propuesta), las decisiones para aprobar, los cambios de schema y los riesgos.

### 2026-10-08 — Investigación de vida financiera
- **`docs/investigacion-vida.md`**: diez áreas (seis pedidas y cuatro encontradas por una ronda que buscó lo que faltaba: sucesión, empresa vs. personal, seguros, jubilación), 168 hallazgos con fuente, cuadro de impuestos por tipo de activo (informativo, a confirmar con el contador), cambios de modelo de datos por fase y 22 decisiones para aprobar. El informe original se cortó al redactarse; se reconstruyó sección por sección a partir de las investigaciones guardadas, sin repetirlas.
- **D-24 actualizada:** el repo es público por decisión del dueño; la documentación se versiona, los datos crudos siguen fuera.

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
