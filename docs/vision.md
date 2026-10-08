# Visión de producto · para que apruebes

> **Para:** vos, el dueño. **Fecha:** jueves 8/10/2026.
> **De dónde sale:** parte del diseño **A · El hábito**, el elegido como base. Le injerté las ideas que los jueces seleccionaron de los diseños **B · La verdad de los números**, **C · Toda la vida financiera, por años** y **D · Decidir mejor**. Donde dos fuentes chocaban, gana `docs/spec.md` y, después, lo que pediste vos. Cada choque y cómo lo resolví está en el **Apéndice A**. Esta versión incorpora la revisión adversarial del borrador; ninguna de sus correcciones chocó con el spec.
> **Fuentes:** `docs/spec.md` (manda), `docs/decisiones.md` (D-01 a D-34), `docs/datos.md` y las tres migraciones ya aplicadas, `docs/carga-diaria.md`, `docs/calidad.md`, `docs/stack.md`, `docs/investigacion-mercado.md` (ideas CA-, CO-, HO-, EX-, PR-, DS-, MO- y propuestas D-35 a D-53), la investigación de vida financiera (hallazgos H1.x a H10.x, funcionalidades "vida 2.N #k" y decisiones "vida §5.N") y tu skill `cartera-cedears` (`SKILL.md`, `tesis.md`, `disciplina.md`, `calendario.md`).
> **Convenciones:**
> - **Todos los números de ejemplo son inventados.** Los que salen del set del **Apéndice B** cuadran entre sí, y el apéndice tiene sus cuentas. Los que dependen de datos que el apéndice no lista (el camino diario de octubre, la historia del leasing, las corridas de Proyecciones) están marcados como **ilustrativos**. Los tickers son los tuyos para que se lea fácil, pero ninguna cantidad ni precio es real ni es una propuesta de cartera.
> - Los ejemplos suponen la app andando desde el jue 01/10 (primera carga) y un "hoy" que es el **mié 14/10/2026**. Es una ilustración.
> - Las ideas de los diseños llevan su sigla original (DA-1, DB-3, DD-7…) para que se puedan rastrear. Las decisiones nuevas que tenés que aprobar llevan número D-NN y están todas juntas en la sección 6.
> - "Fase" es la del spec: 1 Núcleo, 2 Contexto, 3 Motor, 4 Disciplina. La 1 se parte en **1a** y **1b**, y propongo una **5** (Vida financiera) para después de la 4. Lo que el spec pone en una fase se queda en esa fase; adelantar algo es una decisión tuya, con su costo a la vista (D-99).

---

## 1. La app en un párrafo, y los principios

**Una libreta financiera que, con un Excel, dos capturas y dos tipos de cambio, te dice en un minuto cuánto tenés en pesos y en dólares, cuánto de lo que pasó fue el CCL y, cuando llegue la fase 4, si alguna de tus propias reglas pide algo, y que casi siempre te va a contestar "nada que hacer".** Arriba de todo están la frase del día en dos monedas, que suma exacto; tu patrimonio total y el financiero, lado a lado; tus pesos financieros menos la deuda del leasing; y lo poco que necesita tu atención. Todo número se toca y muestra su fórmula, sus insumos, el archivo del que salió y su historial, con una línea en castellano que explica qué es. Con los meses, la app suma el leasing y su licuación, el flujo del mes sin anotar gastos todos los días, el calendario con sus alertas, tus escenarios Baja · Igual · Sube con el abanico de Monte Carlo y, al final, tu disciplina contra tu propia tesis, con la línea de veredicto como primera respuesta del día. Nunca te dice qué comprar.

### Principios

1. **Primero si tenés que hacer algo, después el número.** Desde la fase 4, la primera línea de Hoy dice si alguno de tus disparadores está activo. Casi siempre va a decir "Nada que hacer según tus reglas", y eso es un buen resultado, como pide tu `disciplina.md` (HO-8, DD-9). Hasta la fase 4, la primera línea es el estado de tus datos.
2. **El ritual manda y se mide.** Los 60 segundos no se prometen: se cronometran en cada carga real como **tiempo activo** (D-62), además del test de `calidad.md` §3. Toda función nueva pasa por la misma pregunta: ¿le suma segundos a la carga diaria? Si la respuesta es sí, se va al ritual semanal, al mensual o al anual. Nunca al diario.
3. **Lo normal se confirma con un Enter y lo raro se mira de a uno.** La bandeja muestra primero lo que no cerró, pliega lo que no cambió y guarda lo verificado de todas las cuentas a la vez (CA-1). No hay modales de "¿estás seguro?": hay Deshacer (CA-9).
4. **Diez segundos de mirada.** Hoy tiene una frase, dos tarjetas, una línea de exposición y Atención, y desde la fase 4 una línea de veredicto arriba (HO-1, HO-5, D-53). Todo lo demás está a un toque.
5. **Dos monedas que suman exacto.** Todo número existe en ARS y en USD, con el desglose activo / tipo de cambio que suma exacto (D-35). Lo que no tiene precio ni saldo nuevo no se atribuye: queda "sin atribuir" hasta su próxima observación.
6. **Todo número llega al archivo, y lo que falta dice "sin dato".** Fórmula con valores, insumos, carga, archivo e historial, más "¿Qué es esto?" en castellano (CO-1, D-17, D-67). Un total al que le falta una parte también es "sin dato", con la suma parcial a la vista (D-65).
7. **Hechos y tus reglas, nunca consejos.** La app no propone magnitudes, umbrales ni operaciones (D-07, D-42). Tus bandas, tramos e invalidaciones son los tuyos, importados de tu tesis (D-51).
8. **Un día sin cargar no es una falta.** Lo viejo se ve viejo, nada se rellena, nada se pinta de rojo y ningún contador vuelve a cero (CO-5, CA-12, H4.14). Hay tres cargas válidas: express, media y completa (D-64).
9. **Capturar hoy lo irrecuperable, calcular después lo derivable.** Es el freno para que la fase 1 no crezca: solo se adelanta un hecho que se pierde si no se guarda ese día (D-60). Una vista que se puede calcular después espera a su fase. Y los datos te sobreviven: respaldo restaurado de verdad, exportación legible sin la app y años cerrados que no se reescriben (`calidad.md` §6, H3.1–H3.11).

---

## 2. Lo que vas a sentir usándola

Esta sección describe la app completa, después de la fase 4. Cada pieza dice en la sección 4 desde qué fase está.

### Un día típico (mié 14/10)

- **8:05, en el teléfono.** Abrís Hoy. La primera línea dice "Nada que hacer según tus reglas · revisé 2 · 1 sin evaluar". Debajo, "Datos al cierre del mar 13/10": la app no finge que el mercado ya habló.
- **18:10, en el trabajo.** Sacás las capturas de Galicia y de Mercado Pago en el teléfono y las compartís con la app. Quedan leídas en un borrador. Todavía no son un hecho.
- **18:40, en la compu.** Abrís Cargar con `c`. Tipeás `1548,2`, Tab, `1541`, y soltás el Excel de IEB. Las capturas ya están en la bandeja.
- **18:41.** La bandeja dice "12 leídas · 11 verificadas · 1 a revisar": Mercado Pago leyó dos números distintos. Elegís uno con un toque. El botón dice "Guardar 12".
- **Enter.** Aparece "Guardado · 41 s activos (31 min de punta a punta) · Deshacer". Los 41 segundos son los 9 que usaste en el teléfono más los 32 de la compu; la media hora del medio no cuenta (D-62). En lugar de confeti, la frase: "+$590.125 en pesos, pero −US$ 340 en dólares. En pesos, el CCL sumó $532.812 y tus activos $57.313. En dólares, tus activos sumaron US$ 37 y la suba del CCL le restó US$ 377 a tus pesos."
- **22:10, en el sillón.** Tocás "tus activos $57.313" y ves quién movió: SPY +$94.488, S13N6 +$8.050, T30J7 +$7.200… e YPFD −$60.000.
- **El jueves no tenés tiempo.** Cargás solo el CCL y el cripto: 9 segundos. La frase dice que nada tiene precio ni saldo nuevo, así que todo el cambio del día queda "sin atribuir" hasta la próxima carga completa. No es una falta: es una carga válida.

### Una semana

El domingo abrís **Revisión** (fase 4). Tiene el formato de tu skill: Estado, Posiciones, Total, Disparadores (solo los activos; si no hay ninguno, "Ninguno."), Próximo hito y "Acción anotada". La mayoría de las semanas termina en cinco líneas. Después vaciás **Pendientes** (1b): hoy es declarar el CCL de compra de YPFD, un campo. Son tres minutos. Si más adelante aprobás D-84, la misma revisión te llega por mail el día y a la hora que elijas, sin montos.

### Un cierre de mes (fase 2)

Después del Enter del último día hábil aparece "¿Cerramos octubre?". Son cuatro tarjetas: ingresos, saldos, tarjeta (opcional) y resultado. El resultado es una frase en tres lentes: "Viviste con **$3,91 M** · $3,91 M de oct-26 (provisorio hasta el IPC) · US$ 2.537. Ahorraste **$4,75 M** (tasa 54,9% sobre el ingreso neto acreditado, la definición que elegiste). No explicado: $180.000." Ocho minutos y el mes queda cerrado. Hoy pasa a "Noviembre arranca: US$ 67.900 financiero", un comienzo nuevo.

### Un 31/12

En diciembre, Hoy te recuerda que **la carga del último día hábil BYMA es tu foto al 31/12**, la que vas a necesitar para Bienes Personales (1a). Desde la 1b, Atención muestra desde el 01/12 "Foto del 31/12: 3 de 8 listos" y qué le falta a cada ítem (los ocho están en 4.14). Ese día hacés la carga de siempre, con el listado completo. Cuando llegue la pantalla **Años** (fase 5), "Cierre 2026" te muestra la foto en las dos monedas, congela el año y te da un archivo que se abre sin la app: los hechos ya están guardados desde el 30/12, así que nada se pierde por esperar (D-60). Si para fin de diciembre la 1a todavía no está en producción, hay un **Plan B**: guardás el Excel y las capturas del 30/12 y anotás el CCL y el cripto de ese día con su fuente; después los cargás con la fecha que dicen ellos (D-61, D-76).

---

## 3. Mapa de navegación

### 3.1 Desktop: barra lateral izquierda de 240 px, colapsable a íconos de 64 px

| Grupo | Sección | Ruta | Para qué sirve | Fase |
|---|---|---|---|---|
| Diario | **Hoy** | `/` | Frase, patrimonio total y financiero en ARS y USD, pesos financieros menos la deuda del leasing, Atención; veredicto desde la 4 | 1a (crece en cada fase) |
| Diario | **Cargar** | `/carga` | Los 60 segundos: dos campos, una zona para soltar o pegar, la bandeja y Enter | 1a |
| Diario | **Revisión** | `/revision` | Tu revisión semanal con el formato de tu skill | 4 (1b si aprobás D-99) |
| Patrimonio | **Cartera** | `/cartera`, ficha en `/cartera/[ticker]` | Tabla densa en doble moneda con desglose activo/TC; tarjetas en el teléfono | 1a (ficha en la 1b) |
| Patrimonio | **Exposición** | `/exposicion` | Largo, corto y neto en pesos; composición; concentración; tus bandas | 1a en números (gráficos y composición en la 1b, bandas en la 4) |
| Patrimonio | **Evolución y PnL** | `/evolucion` | Patrimonio en el tiempo, puente del período, PnL por mes; abanico y PnL proyectado desde la 3 | 1b (futuro 3, por años 5) |
| Contexto | **Pasivos** | `/pasivos` | Leasing: cuadro de marcha, cuota en ARS y USD, licuación, opción de compra | 2 |
| Contexto | **Flujo y cierres** | `/flujo` | Ingresos, gastos, excedente proyectado y real, cierre del mes | 2 |
| Contexto | **Calendario** | `/calendario` | Vencimientos, cuotas, hitos, fechas fiscales y técnicas, con alertas y "Anotar destino" | 2 |
| Motor | **Proyecciones** | `/proyecciones`, `/proyecciones/[escenario]` | Escenarios Baja · Igual · Sube con deslizantes, Monte Carlo, comparación | 3 |
| Disciplina | **Tesis y niveles** | `/tesis` | Tu tesis contra tu cartera: bandas, tramos, invalidaciones, objetivos, marco macro, marcador | 4 (los datos entran en la 1b) |
| Disciplina | **Diario** | `/diario`, mesa de decisión en `/diario/decision/[id]` | Lo que decidiste, por qué, y cómo salió; la mesa de decisión | 4 |
| Disciplina | **Rendimientos** | `/rendimientos` | TIR y TWR, SPY y LECAP en la sombra, TNA cobrada, operaciones cerradas | 4 |
| Vida | **Años** | `/anos`, `/anos/[año]` | Un capítulo por año: foto al 31/12, puente del año, cierre y archivo | 5 |
| Vida | **Impuestos, Legado, Seguros, Retiro** | `/vida/…` | Foto fiscal, "si me pasa algo", pólizas, horizonte de retiro | 5 |
| Al pie | **Pendientes** (con contador) | `/pendientes` | Salud de datos: lo que no cierra, con evidencia y un botón; conciliación de 30 días | 1b (en la 1a, los pendientes viven en Atención) |
| Al pie | **Registro** | `/registro` | Log de cargas: qué entró, de qué archivo, cuánto tardó; revertir; auditoría | 1a (auditoría filtrable en la 1b) |
| Al pie | **Datos** | `/datos/…` | Catálogo, cuentas, bienes y valuaciones, leasing, pegar serie, tesis, feriados, alias, documentos; entidades desde la 2 | 1a (crece) |
| Al pie | **Ajustes** | `/ajustes` | Tema, paleta, modo privado, respaldo, sesión | 1a (crece) |
| Al pie | **Ayuda** | `/ayuda` | Los docs del repo renderizados, con buscador | 1b |

**Barra superior (desktop):** título; a la derecha, el indicador de datos ("Datos al cierre del mié 14/10 · ✓ 5 de 5 fuentes"), el botón **+** (nota del día; aporte, retiro o transferencia; desde la fase 4, anotar una decisión), el ojo del modo privado y el tema. Teclado: `c` abre Cargar y `h` activa el modo privado, solo si ningún campo tiene el foco (CA-8).

**Lo no desplegado no aparece (D-69).** Una sección de una fase futura no figura ni como "próximamente". La barra crece con cada despliegue. Una cifra de Hoy que depende de una fase futura dice "sin dato · llega en la fase N".

### 3.2 Mobile (debajo de 768 px): barra inferior

```
┌──────────────────────────────────────────────┐
│  Hoy   Cartera   [ Cargar ]   Evolución  Más │
└──────────────────────────────────────────────┘
```

- **Cargar** va al centro, más grande y relleno: es la acción del día. Lleva un punto gris (no rojo) cuando es día hábil, ya cerró BYMA y no hay carga de hoy.
- El cuarto lugar es **Exposición** en la 1a y **Evolución** desde la 1b, cuando Evolución existe (D-69).
- **Más** abre una hoja con el resto de las secciones, en el orden de la tabla. Desde la fase 4, arriba de todo va "Revisión de la semana". Lleva el contador de Pendientes.
- **No hay pestañas horizontales en ninguna parte.** Si una pantalla tiene más de tres subpantallas (Datos, por ejemplo), el título es un selector: "Datos · Catálogo ▾" abre una hoja inferior con las opciones (idea de DD-1). Hasta tres opciones (ARS · USD · Ambos) van en un control segmentado que ocupa el ancho y nunca desborda. Con más de tres, hoja inferior, también en los selectores de período.
- Elementos tocables de 44 px o más, nada de scroll horizontal, nada cortado ni superpuesto (D-30, D-100). La barra superior mide 48 px y nunca tapa contenido.
- **Con el teclado abierto** (por ejemplo, en Cargar), la barra inferior se oculta y la barra "Guardar" queda pegada arriba del teclado, medida con `visualViewport`: nunca hay tres barras apiladas ni un campo tapado.

---

## 4. Cada pantalla

### 4.0 Lo que comparten todas las pantallas

| Elemento | Cómo se ve | De dónde sale |
|---|---|---|
| **Pares ARS/USD** (D-68) | El monto en USD va siempre dentro de una **pastilla tintada** (fondo levemente azulado, borde de 1 px) con "US$"; el de ARS va en tinta normal con "$". La forma es la señal, en claro, en oscuro y con la paleta daltónica. En tablas y pares, ARS siempre a la izquierda (o arriba) y USD a la derecha (o abajo). En la tarjeta de un activo, el número grande es el de la moneda en la que el activo **arriesga**: un CEDEAR muestra USD arriba y una LECAP, ARS | spec §UI, DA-7, DD-8, MO-1 con cambio, EX-2 |
| **Positivo y negativo** | Color + signo + ▲/▼: "+1,8% ▲", "−0,6% ▼". Verde y rojo solo para resultados. En una deuda, bajar es bueno: la deuda del leasing en USD que baja va en verde. Una variación dentro de tu banda neutra (vacía hasta que la fijes) va en tinta neutra, para que los días planos no parpadeen | MO-5, HO-5 |
| **Estado de una fuente** | ✓ cerró su control · ≠ diferencia sin resolver · ○ tipeado, sin control posible · ◷ más de 2 días hábiles sin carga. Tinta neutra o azul, nunca verde ni rojo | HO-4 |
| **Etiquetas de un número** | Una sola, en un chip gris chico y con palabras: "viejo · hace 3 d háb.", "declarado", "inferido", "provisorio". Si un número hereda varias, muestra la más grave. Cada función de cálculo devuelve sus etiquetas junto con el valor y un test verifica que se propaguen (D-67). **Lo verificado no lleva nada**: un día normal, Hoy no tiene chips | CO-5, D-16, DB-1 simplificado |
| **Sin dato** | La palabra "sin dato" en gris y tocable: dice qué falta y ofrece la acción ("Declarar CCL de compra"). Nunca un 0, nunca un guion mudo | spec, `calidad.md` §1 |
| **Totales con partes faltantes** (D-65) | Si a un total le falta una parte, el total es "sin dato". Debajo, en gris: "suma parcial (3 de 6 posiciones): +US$ 1.630,45" | B, regla 3 |
| **Redondeo** | Cuando una cifra se muestra junto con sus partes (la frase, el puente, el desglose), las partes se redondean por **resto mayor**: lo que ves suma exacto lo que ves. El valor exacto está en la traza | D-35, revisión de ingeniería |
| **Traza** | Tocar o pasar el mouse por cualquier cifra abre un panel: primero la fórmula con valores, después "Ver insumos ▸" de a un nivel, hasta la carga y el archivo; después **Historial** (cada corrección de un insumo, con el valor anterior, el nuevo, cuándo y por qué) y **Corregir**; al final **"¿Qué es esto?"** en una línea. En el teléfono es una hoja inferior que entra en 360 px | CO-1, CO-7, MO-2, D-17, D-67 |
| **Tocables** (D-100) | 44 px o más con puntero grueso (`pointer: coarse`) o debajo de 1024 px. Con mouse o trackpad, el objetivo es la fila entera y la traza se abre con hover, foco o teclado | D-30 con la enmienda D-100 |
| **Glosario en contexto** (1b) | La primera vez que aparece TEM, CCL implícito, CCL de empate, TWR, percentil o duration en una pantalla, la palabra lleva subrayado punteado y abre dos líneas más un link a Ayuda | D, tu `disciplina.md` "Sobre el rol" |
| **Números** | Geist Mono, `tabular-nums`, alineados a la derecha. Formato compacto ("US$ 67,4k") solo en tarjetas; el exacto, a un toque | `stack.md`, MO-1 |
| **Gráficos** | Solo ECharts. Barras horizontales apiladas o treemap para composición, área apilada para composición en el tiempo, abanico para Monte Carlo, eje log si el rango lo pide. Mismo color por activo en todos lados. Dos monedas en un mismo eje solo indexadas a 100. Cero tortas | spec §UI, D-31 |
| **Ancho** | Sin max-width. La grilla gana columnas en pantallas anchas: a 2560 px, Hoy pasa a tres columnas para que ningún renglón de texto quede de lado a lado | spec §UI |
| **Errores** | Nunca una pantalla en blanco: "No pude leer la captura de Galicia (la segunda lectura se cortó). Reintentar · Dejar pendiente" | `calidad.md` §5 |

**Ejemplo de traza** (desktop o teléfono), al tocar el valor en USD de SPY:

```
Valor en dólares · SPY · IEB                                   mié 14/10
= 1.240 CEDEARs × $35.150 ÷ CCL 1.548,20 = US$ 28.152,69
Ver insumos ▸
  · 1.240 = apertura 1.000 (jue 01/10, carga #12) + compra 240 (vie 09/10, carga #19)
  · $35.150 = Excel de IEB del 14/10, hoja Patrimonio, fila 18 (carga #31) · cerró contra el Subtotal Cedears ✓ · [Abrir archivo]
  · CCL 1.548,20 ○ = tipeado el 14/10 a las 18:40, referencia "promedio" (carga #30)
Historial: sin correcciones · [Corregir un insumo]
¿Qué es esto? Lo que valen tus CEDEARs de SPY si los pasás a dólares al CCL que cargaste hoy.
[Copiar valor exacto]
```

### 4.1 Hoy (`/`) · 1a, crece en cada fase

**Para qué:** contestar en 10 segundos tres preguntas: ¿cuánto tengo?, ¿qué pasó y por qué? y, desde la fase 4, ¿tengo que hacer algo?

**Desktop a 1280 px, como queda al cerrar la 1b:**

```
Hoy · mié 14/10/2026                         Datos al cierre del mié 14/10 · ✓ 5 de 5 fuentes    [+] [ojo] [tema]
┌──────────────────────────────────────────────────────────────────┐ ┌──────────────────────────────────┐
│ Desde la carga del mar 13/10: +$590.125 en pesos (+0,57%), pero  │ │ ATENCIÓN                         │
│ −US$ 340 en dólares (−0,50%). En pesos, el CCL sumó $532.812 y   │ │ YPFD: PPC en USD sin dato        │
│ tus activos $57.313. En dólares, tus activos sumaron US$ 37 y la │ │ (falta el CCL de compra)         │
│ suba del CCL le restó US$ 377 a tus pesos.                       │ │ [Declarar]                       │
└──────────────────────────────────────────────────────────────────┘ │                                  │
┌────────────────────────────────┐ ┌───────────────────────────────┐ │ 2 pendientes más ▸               │
│ PATRIMONIO FINANCIERO          │ │ PATRIMONIO TOTAL              │ │                                  │
│ $104.271.540   ┊US$ 67.350┊    │ │ $430.511.540  ┊US$ 278.072┊   │ │                                  │
│ +$590.125 ▲    ┊−US$ 340 ▼┊    │ │ +$3.890.125 ▲ ┊−US$ 456 ▼┊    │ │                                  │
│ activos +$57.313  ·  +US$ 37   │ │ incluye la casa (val. 15/09)  │ │                                  │
│ CCL   +$532.812  ·  −US$ 377   │ │ y tu parte de la camioneta,   │ │                                  │
│                                │ │ sujeta a opción de compra     │ │                                  │
└────────────────────────────────┘ └───────────────────────────────┘ └──────────────────────────────────┘
Pesos financieros − deuda del leasing: largo $32.783.100 ($54,18 M − $21,40 M) ┊US$ 21.175┊ · si el CCL sube 1%, pierde US$ 210
Excedente de octubre: sin dato · llega con Flujo (fase 2)
Cuadre ✓ 0,00 en $ y en US$ · IEB ✓ (1 diferencia explicada) · Galicia ✓ · MP ✓
```

(`┊…┊` representa la pastilla tintada de los montos en USD.)

- **La línea de veredicto** (D-53 con cambios, DD-9) llega con la fase 4, o con la 1b si aprobás D-99, y va arriba de todo, sobre la frase. Dice cuántas reglas tuyas revisó y cuántas no pudo evaluar, sin contar como revisada una regla sin evaluar: "Nada que hacer según tus reglas · revisé 2 · 1 sin evaluar ▸" ("no verificable" nunca equivale a OK). Si alguna se activó, la nombra con su número: "1 disparador activo: 4 · tramo en pesos fuera de banda (38,9% de tu canasta: $12,48 M de $32,08 M; banda 28–38%) → Abrir". Hasta entonces, la primera línea es el estado de los datos.
- **La frase** (HO-1) sale de la función de D-35, sin IA, y siempre nombra su intervalo. Es el ejemplo del spec ("si subo 10% en pesos pero el CCL subió 12%…") hecho la primera cosa que leés. Cada fragmento abre su traza. Por ejemplo, "el CCL sumó $532.812" abre: `US$ 32.291,66 que tenías en activos en dólares × (1.548,20 − 1.531,70) = $532.812,44`. ¿Qué es esto? "Lo que ganaste en pesos solo porque subió el dólar, sobre lo que tenías en dólares ayer."
- **Las dos tarjetas** (D-03, HO-5): el financiero primero, porque es lo invertible y lo que se mueve; el total al lado, porque la casa pesa el 71,9% y nunca va solo. El total lleva su aclaración: "sujeta a opción de compra", y "tomador del leasing: sin confirmar" como dato mientras no registres D-71.
- **La línea de exposición** dice exactamente lo que suma: **"pesos financieros − deuda del leasing"** (D-101). No es el financiero, que por D-03 no incluye deudas, ni el total: es la cuenta del spec §3 (EX-1) con su rótulo. La casa y la camioneta no entran mientras no elijas su moneda de riesgo (D-73): la app no se la asigna. "+1%" es una sensibilidad, no un pronóstico: −(neto ÷ CCL) × 0,01 ÷ 1,01.
- **Atención**, en una columna a la derecha **desde 1280 px** (no recién a 1600). Junta los pendientes de datos, hasta tres, y "ver todos". Desde la fase 2 suma los próximos vencimientos y sus alertas.
- **El pie** (1b; en la 1a vive en Cargar) muestra el cuadre del día en las dos monedas y la conciliación de cada cuenta (D-66, CO-9). El cuadre compara el patrimonio de hoy, **recalculado desde los hechos** (operaciones, cotizaciones y saldos), contra el de ayer más cada parte de la frase, y cada parte se calcula por posición con su propia fórmula: ninguna es un residuo, así que el ✓ puede fallar. La diferencia explicada de IEB es la de tus dólares en especie: IEB los valúa a su dólar (1.540,00) y la app al CCL que tipeaste, +$34.440 (DB-3). El estado del respaldo **no** aparece acá: entra en Atención solo si falla o tiene más de 48 horas.

**Interacciones:**
- "Tus activos $57.313" abre **quién movió** (HO-3, 1b): SPY +$94.488 · S13N6 +$8.050 · T30J7 +$7.200 · MP +$3.700 · TXMJ0 +$2.000 · FIMA +$1.875 · YPFD −$60.000. Un precio arrastrado figura como "sin precio nuevo", nunca como 0.
- Tocar una tarjeta abre el **puente** del período en ARS y USD (HO-2, 1b), con su cuadre.
- La **píldora de período** (día, semana, mes, año, desde el inicio) está a un toque y se recuerda en el dispositivo (HO-7, 1b). En el teléfono, sus cinco opciones van en una hoja inferior. Un mes es la suma exacta de sus días (D-35).
- El chip "✓ 5 de 5 fuentes" abre el estado por fuente: IEB ✓, Galicia ✓, MP ✓, CCL ○, cripto ○ (HO-4).
- El ojo oculta montos y deja porcentajes (MO-3, 1b).

**Teléfono, arriba del pliegue.** La cuenta se hace sobre el viewport real que usa Playwright con `iPhone 13`: **390 × 664 px**, que es lo que queda de los 844 de la pantalla con las barras de Safari visibles (en CSS, `100svh`). Menos los 56 px de la barra inferior, quedan **608 px**.

```
mié 14/10 · ✓ datos al día                 [ojo] [+]     48 px
┌ Desde la carga del mar 13/10: +$590.125 en ┐
│ pesos (+0,57%), pero −US$ 340 en dólares … │           132 px
└ ver completa                               ┘
┌ FINANCIERO  $104.271.540 · +0,57% ▲        ┐
└             ┊US$ 67.350┊ · −0,50% ▼        ┘           112 px
┌ TOTAL       $430.511.540 · +0,91% ▲        ┐
└             ┊US$ 278.072┊ · −0,16% ▼       ┘           112 px
Pesos fin. − leasing: largo $32,78 M ┊US$ 21.175┊         48 px
Atención · 3 pendientes de datos ▸                        44 px
[  Hoy   Cartera   [Cargar]   Evolución   Más  ]          56 px
```

Suma al cerrar la 1b: 48 + 132 + 2 × 112 + 48 + 44 = **496 px**. Desde la fase 4 se suma la línea de veredicto (44 px): 540. Si todavía no cargaste hoy, debajo va un botón de ancho completo, en el flujo y no flotante: "Todavía no cargaste hoy · Cargar" (de D), 52 px con su margen: **592 px ≤ 608**. Por eso Atención es un solo renglón en el teléfono: con su versión de tres ítems, el contenido se pasaba del pliegue. El test de layout lo verifica con ese viewport.

**Casos que cambian la frase (siempre nombra su intervalo):**
- Después de un fin de semana: "Desde la carga del vie 09/10…".
- **Volviste** después de un hueco: "Desde la carga del jue 01/10 (7 días hábiles sin carga; el lun 12/10 fue feriado): …". Sin juicio. Lo del medio es un solo intervalo, y la conciliación ofrece lo que hayas operado mientras tanto (D-15, CA-10).
- Feriado en EE.UU.: "…tus activos sumaron $57.313 (mayormente brecha de CCL implícito: el subyacente no cotizó)" (D-35).
- Carga express (solo tipos de cambio): ver 4.2.
- **Día 1:** "Primera carga guardada. Mañana vas a ver qué cambió y por qué." (DA-11).
- **En diciembre, desde la 1a:** "El último día hábil BYMA del año (probablemente el mié 30/12; se confirma con el calendario de BYMA) tu carga es la foto al 31/12. La vas a necesitar para Bienes Personales." Es lo único irrecuperable del cierre anual (H4.16, D-76).

**Cómo crece Hoy por fase:**

| Fase | Se agrega |
|---|---|
| 1a | Estado de datos arriba, frase, las dos tarjetas, línea "pesos financieros − deuda del leasing", Atención con los pendientes de datos, botón "Todavía no cargaste hoy", aviso de diciembre |
| 1b | Pie de cuadre (en la 1a está en Cargar); puente, quién movió y período a un toque; checklist del 31/12 desde el 01/12 (D-76); valuaciones vencidas (CO-11) |
| 2 | Excedente real del mes; en Atención, los próximos vencimientos y las alertas del spec: vencimiento a menos de 15 días sin destino, con "Anotar destino" (D-75), y hito a 10 días o menos; "Hoy toca" (cuota, vencimiento o hito de los próximos 10 días) |
| 3 | A un toque: "estás en el percentil 38 del escenario base" (PR-11) |
| 4 | **Línea de veredicto** con tus siete disparadores y las reglas del calendario; "Nada que hacer según tus reglas" (HO-8). El disparador 1 se evalúa con el cierre real del subyacente (4.16). Los disparadores 2 y 7 los marcás vos |
| 5 | En diciembre: "Si hoy fuera 31/12: base de Bienes Personales…", como dato |

### 4.2 Cargar (`/carga`) · 1a

**Para qué:** que la carga completa tarde menos de 60 segundos de tiempo activo, sin wizard, con Tab y Enter (spec, `carga-diaria.md`).

**Desktop:**

```
Cargar · datos del mié 14/10 (fecha tomada del Excel de IEB, celda B1)
┌──────────────────────────┐ ┌──────────────────────────────────────────────────────────────────┐
│ CCL del cierre 14/10     │ │  Soltá o pegá acá (Ctrl+V): Excel de IEB, capturas de Galicia    │
│ [ 1548,2         ]       │ │  y de Mercado Pago. El orden no importa.                         │
│ = 1.548,20 · +1,08% vs   │ │                                                                  │
│   ayer · ref: promedio ▾ │ │  IEB      ✓ 7 filas · cierra contra B2 (0,4 s)                   │
│                          │ │  Galicia  ✓ 2 filas · dos lecturas iguales (desde el teléfono)   │
│ Dólar cripto (venta)     │ │  MP       ≠ dos lecturas distintas                               │
│ [ 1541           ]       │ │  CCL ○ · cripto ○  tipeados                                      │
│ = 1.541,00 · −0,47% vs   │ └──────────────────────────────────────────────────────────────────┘
│   CCL                    │  BANDEJA · 12 leídas · 11 verificadas · 1 a revisar        (ver 4.2.1)
│ + ¿Movió plata hoy?      │
│ + Nota del día           │
└──────────────────────────┘
[ Guardar 11 · dejar 1 pendiente   ⏎ Enter ]                         carga en curso: 34 s activos
```

**El recorrido con teclado (CA-8):** el foco arranca en CCL → `1548,2` → el eco muestra "= 1.548,20 · +1,08% vs ayer" → Tab → `1541` → "= 1.541,00 · −0,47% vs CCL" → Ctrl+V la captura de Galicia → Ctrl+V la de MP → soltás el Excel → mirás la bandeja → Enter.

**Reglas de la pantalla:**
- **Una sola zona para soltar o pegar** (CA-2, 1a): Excel o captura, en cualquier orden; identificar la fuente va dentro de la misma lectura.
- **La lectura empieza al pegar**, mientras tipeás (CA-3, D-36). El Excel lo lee un parser determinístico. Las capturas las lee Claude dos veces, de dos maneras distintas, y la aritmética decide. Mercado Pago, que no tiene control aritmético, se lee con dos modelos distintos (D-36). Presupuesto: p95 ≤ 15 s de pegar a bandeja lista.
- **Enter espera a que todas las fuentes terminen.** Mientras una dice "leyendo…", el botón dice "Esperando MP (leyendo…)" y Enter no guarda. Si no querés esperar, el botón de al lado dice "Guardar sin MP": lo que no se guarda queda explícito, nunca en silencio.
- **Lo pegado vive en un borrador del servidor (D-63).** La lectura que se guarda como `lectura_cruda` es la que el servidor recibió del modelo, nunca una que manda el navegador. En la 1a, el borrador es del dispositivo donde empezaste: cerrar la pestaña no pierde nada. Desde la 1b se comparte entre dispositivos: podés pegar las capturas en el teléfono a las 18:10 y soltar el Excel en la compu a las 18:40, y la bandeja es la misma. Nada de eso es un hecho hasta el Enter (D-11).
- **El tiempo que cuenta es el activo (D-62).** El contador suma los tramos en que hacés algo (tipear, pegar, tocar) en cada dispositivo; un tramo se corta después de 60 s sin gestos. El Registro guarda las dos cifras: tiempo activo y de punta a punta.
- **La fecha de los datos la da la fuente, no el reloj (D-61).** Si cargás el jueves a las 8:00 con el Excel del miércoles, todo va al 14/10 y el campo dice "CCL del cierre 14/10". Una captura sin fecha visible (la de MP, por ejemplo) toma el momento del pegado; si ese día no coincide con el B1 del Excel, aparece una advertencia: "La captura de MP es de hoy 15/10 y el Excel es del 14/10. ¿Es el saldo del 14/10?" (CA-5).
- **Los campos de tipo de cambio arrancan vacíos.** El valor de ayer aparece como texto de ayuda ("ayer 1.531,70"), nunca como valor: no se puede guardar un CCL que no tipeaste (DB-10). La referencia del CCL ("promedio", "GGAL") sí viene con la última que usaste (EX-8).
- **El dólar cripto se guarda como `cripto_venta`**, el nombre del spec, y manda para el ingreso proyectado. El precio al que efectivamente vendiste cada mes se confirma en el cierre del mes (fase 2), porque el cripto que se publica es una referencia y no tu precio (H5.4).
- **"¿Movió plata hoy?"** abre un renglón para un aporte, un retiro o una transferencia (D-06). Casi nunca hace falta: la bandeja lo pregunta sola cuando un saldo sube más de lo que explica su rendimiento (CA-4). Un gasto nunca dispara la pregunta: en una cuenta mixta como MP, una baja queda como "salida a consumo, sin confirmar" y se confirma en el cierre del mes (D-102).
- **Nota del día:** una línea opcional ("el CCL saltó por la licitación") que va a `eventos` con su **lote** (un Enter puede crear varias cargas) y aparece como marcador en Evolución (DS-6).
- **Ticker desconocido:** se da de alta ahí mismo, en una hoja lateral, sin salir de la carga: tipo, **moneda de riesgo** ("¿a qué moneda te expone? Un CEDEAR cotiza en pesos pero es USD"), geografía, ratio si es CEDEAR y color. La moneda de riesgo de YPFD la elegís vos: la app no la decide (D-73).
- **"Hoy no operó el mercado"** (1b, ajuste a D-16): un botón para un día sin rueda que no figura en los feriados. Ese día no cuenta para "viejo" y queda como carga con su motivo.

**Las tres cargas válidas (D-64):**

| Carga | Qué hacés | Tiempo activo | Qué se actualiza |
|---|---|---|---|
| Express | CCL + cripto + Enter | ~10 s | El CCL y el cripto del día, que no se pueden reconstruir con tu propia referencia (D-60). Todo se revalúa al CCL nuevo, pero lo que no se cargó (precios y saldos) queda "sin atribuir" hasta su próxima observación |
| Media | + Excel de IEB | ~30 s | Precios, cantidades y saldos de IEB |
| Completa | + capturas de Galicia y MP | < 60 s | Todo |

**Qué dice la frase después de una carga express (jue 15/10, CCL 1.560,00):**

> Desde la carga del mié 14/10: +$49.560 en pesos (+0,05%) y −US$ 478 en dólares (−0,71%). Cargaste solo tipos de cambio: ningún precio ni saldo es nuevo, así que **todo el cambio queda sin atribuir** hasta tu próxima carga completa. Es lo que da valuar al CCL nuevo lo que tenías el miércoles: en dólares, −US$ 213 de SPY, −US$ 242 de tus posiciones en pesos y −US$ 23 de tus pesos en efectivo; en pesos, +$49.560 de tus US$ 4.200.

Esa línea "sin atribuir" corrige un error real: con el precio en pesos de ayer y el CCL de hoy, un CEDEAR parecería haber perdido en dólares exactamente lo que subió el CCL, y eso sería un movimiento inventado (D-18). La misma regla vale para los saldos que no cargaste: Mercado Pago acredita intereses todos los días, y su saldo del miércoles ya no es el de hoy.

**Cómo se atribuye después (D-35).** Cada partida (un precio o un saldo) se desglosa por **intervalos entre dos observaciones frescas**. El viernes, con la carga completa, se cierra el intervalo mié → vie de cada partida que el jueves quedó arrastrada: se desglosa entero en activo y CCL con el CCL de sus dos puntas, y la frase del viernes devuelve lo que el jueves había quedado sin atribuir ("incluye los −US$ 478 que el jueves quedaron sin atribuir"). La frase del jueves se reescribe solo en su rótulo ("sin atribuir · atribuido el vie 16/10 ▸"); sus montos no cambian. Así cada día suma exacto, un mes es la suma exacta de sus días, y en cualquier período "sin atribuir" es lo pendiente al final menos lo pendiente al principio: cero si las dos puntas tienen todo fresco. Una carga express entre dos completas no cambia el desglose del período entre ellas. Las tres propiedades son tests de fast-check (`calidad.md` §1).

**Después del Enter:** el aviso "Guardado · 41 s activos · Deshacer" dura 10 segundos (CA-9, `revertir_lote`). La pantalla se reemplaza por Hoy. La recompensa es la frase del día, no confeti.

**Teléfono:**
- Los campos usan `inputmode="decimal"` (teclado con coma) y `enterkeyhint="next"`.
- Un botón grande "Agregar capturas o Excel" abre el selector de fotos con selección múltiple. En Android, si la validación de la primera semana muestra que las capturas salen del teléfono, la app instalada aparece en "Compartir" (MO-6, 1b). En iOS, el selector es la alternativa.
- La bandeja es una lista de tarjetas (4.2.1). La barra "Guardar 11 · dejar 1 pendiente" queda fija arriba de la barra inferior, sin taparla. Con el teclado abierto, la barra inferior se oculta y "Guardar" queda arriba del teclado (3.2).

#### 4.2.1 La bandeja de revisión · 1a

**Para qué:** que los 60 segundos se gasten solo en las excepciones (CA-1).

```
12 leídas · 11 verificadas · 1 a revisar

≠  Mercado Pago · saldo · las dos lecturas no coinciden
   lectura 1: $4.912.300 · lectura 2: $4.912.800
   [Elegir $4.912.300]  [Elegir $4.912.800]  [Dejar pendiente]

✓  IEB cierra contra B2: $80.830.000,00 = $80.830.000,00 (DOLARUSA al dólar de IEB, 1.540,00)
   Tu valuación al CCL da $80.864.440,00: +$34.440, explicado (dólar de IEB contra tu CCL)
✓  Galicia: 2 filas, dos lecturas iguales; total de la captura $18.494.800,00 ✓
   S13N6: 11.500.000 × $1,0852 = $12.479.800,00 (tolerancia ±$575,01: el precio viene con 4 decimales)
▸  4 posiciones de IEB sin cambio de cantidad
```

**Estados y reglas (CA-1, D-47):**
- **verificada:** la guarda el Enter.
- **advertencia** (saldo que saltó, escala distinta a la recordada, captura que parece vieja, lecturas distintas, fechas que no coinciden): nunca se guarda con el Enter general. Se acepta con uno de sus botones, o con la tecla `A` si la fila tiene el foco. **El motivo es la opción que elegiste** ("elegí la lectura 1", "es rendimiento"), no un texto que tengas que tipear, y queda en el registro.
- **error** (la aritmética no cierra, un número ilegible): no se puede aceptar hasta editarlo.
- **El botón dice qué va a hacer el Enter, con números:** "Guardar 11 · dejar 1 pendiente". Una fila pendiente no se graba, su activo conserva cantidad y precio anteriores, la carga queda con `listado_completo = false` y el ítem pasa a Pendientes (D-47). Nada se guarda en silencio y nada te frena el día.
- **"¿Entró o salió plata?"** (CA-4), solo cuando un saldo **sube** más de lo que explica su rendimiento: "Mercado Pago subió $500.000 más de lo que explica la TNA de la captura (27,5%) → [Registrar transferencia desde Galicia] [Es un ingreso] [Es rendimiento] [Dejar pendiente]". Las bajas de una cuenta mixta no preguntan nada (D-102).
- **Conciliación** (D-15, CA-10): "IEB · T30J7 · el jue 08/10 el bróker dice 9.000.000 VN y tus operaciones dan 8.000.000 → [Crear compra de 1.000.000 VN el 08/10 a $1,0986, inferido del cambio de PPP, sin comisiones, con el CCL de ese día] [Editar] [Dejar pendiente]". Nunca se aplica sola.
- **Compra del día:** fila "en tránsito" con PPP `-`. Se graba como compra con precio pendiente y la carga de mañana lo completa (D-19, CO-10).
- **Alias** (1b): la primera vez que asignás un texto de Galicia ("LECAP NOV26") a un activo, la app ofrece "Recordar para Galicia". Desde ahí lo mapea sola (CA-6). Con el uso, la bandeja se achica.

**Teclado:** ↑/↓ entre filas, `A` acepta, `E` edita, `P` deja pendiente. Las teclas de una letra funcionan solo si ningún campo tiene el foco (CA-8).

**Teléfono:** deslizar a la derecha acepta una advertencia (con su primera opción) y a la izquierda la deja pendiente. Los errores no se deslizan. Los mismos botones están siempre visibles, porque el gesto no puede ser la única forma.

### 4.3 Registro (`/registro`) · 1a

**Para qué:** el log de cargas que pediste (D-17), la prueba de que los 60 segundos se cumplen y el lugar donde se corrige y se revierte.

```
jue 15/10 · 18:20 ·  9 s activos                express: CCL y cripto (tipeados) · el resto, sin precio ni saldo nuevo
mié 14/10 · 18:41 · 41 s activos · 31 min       IEB (Excel) · Galicia (captura, teléfono) · MP (captura, teléfono) · CCL y cripto
                                                12 filas · 12 guardadas · 1 advertencia resuelta (MP: elegiste la lectura 1) · nota: "licitación del Tesoro"
mar 13/10 · 18:55 · 37 s activos · 37 s         …
```

Al pie (1b), en tinta neutra (CA-12, D-62): "Octubre: 10 de 10 días hábiles con carga (9 completas y 1 express) · tiempo activo de las completas: mediana 38 s, la más lenta 52 s: las 9 por debajo de 60 s · capturas desde el teléfono: 7 de 9". Esa última cifra contesta sola de dónde salen tus capturas (MO-6). Con muchas cargas, el pie suma el p95; con 10, el p95 es prácticamente la más lenta, así que se dice así.

**Al tocar un día:** cada carga del lote muestra el archivo original, la lectura cruda (las dos lecturas lado a lado si fue una captura), lo que se grabó, las diferencias de conciliación y qué se hizo con ellas, el modelo que leyó y la versión del lector (H3.17).

**Revertir (D-17, CA-9).** La unidad es la carga, como dice D-17:
- **Revertir esta carga** (por ejemplo, solo la de MP) o **Revertir el lote** (todas las cargas de ese Enter). Borra sus filas, restaura lo pisado y deja cada carga marcada como revertida, con el motivo que elegís ("lectura equivocada", "archivo de otro día", "otro"), y sin desaparecer del Registro.
- **Solo si nada posterior depende de ella.** Si un hecho de otra carga se apoya en esta (un precio pendiente que completó la carga del día siguiente, D-19; una fila de `nivel_operaciones` que apunta a una de sus operaciones; una migración posterior, ver 7.1), la app lista esas dependencias y la reversión pasa a ser manual, con motivo.
- **Deshacer una reversión.** El aviso "Carga revertida · Deshacer" dura 10 segundos, y Deshacer vuelve a aplicar exactamente las filas revertidas, desde la auditoría. Pasado ese tiempo, para volver atrás se carga de nuevo el archivo, que sigue guardado.

**Corregir un hecho (D-17, nivel 2).** Desde la traza de cualquier insumo (un precio, una cantidad, una operación), **Corregir** pide el valor nuevo y un motivo (una opción: "error de lectura", "el bróker corrigió", "otro", con texto opcional). Graba una carga `manual`, vuelve a evaluar los controles de ese día y de los siguientes (D-38) y deja el antes y el después en la auditoría. Una fila conciliada lleva un **candado**: corregirla pide el motivo y vuelve a correr las aserciones (CO-3). Desde ese momento, la traza del número muestra en **Historial** el valor anterior, el nuevo, cuándo y por qué.

**Vista de auditoría (1b):** todos los cambios, filtrables por tabla, fecha, carga y tipo (alta, cambio, baja), con el antes y el después lado a lado. Desde la fase 5, **Reprocesar** una carga con el lector nuevo, con un diff previo (CO-13).

**Teléfono:** una tarjeta por día, con la duración y los íconos de las fuentes; el detalle se abre al tocar.

### 4.4 Pendientes (`/pendientes`) · 1b

**Para qué:** una sola lista con todo lo que no cierra, con evidencia y un botón (CO-8, D-41). Se limpia en el ritual semanal, no en el diario. En la 1a, estos ítems aparecen en Atención.

**Arriba:** "3 pendientes · 1 deja un número en 'sin dato' · 2 avisos". Ejemplos:
- *Deja un número sin dato:* "YPFD · PPC en USD sin dato: la apertura no tiene CCL de compra. [Declarar CCL de compra] [fecha de origen]". Los dos quedan con la etiqueta "declarado" (CA-7).
- *Aviso:* "FIMA · fila dejada pendiente el mié 07/10 (las dos lecturas de Galicia dieron cantidades de cuotapartes distintas). [Abrir esa carga]".
- *Aviso:* "Casa · valuación de hace 13 meses (tu cadencia: 12). [Cargar valuación]" (CO-11).

**Conciliación por cuenta (de B):** una tarjeta por cuenta con el control de hoy y una **franja de 30 días**, un cuadradito por día hábil: ✓ cerró, ≠ diferencia, ○ no verificable, vacío si no hubo carga. En el ejemplo, los días hábiles van del 01/10 al 14/10 (el 12/10 fue feriado).

```
IEB      B2 14/10: $80.830.000,00 = $80.830.000,00 ✓ · Subtotales: Acciones ✓ Bonos ✓ Cedears ✓ Otros ✓
         ✓✓✓✓✓≠✓✓✓   (≠ el 08/10: resuelto el 09/10, "compra en tránsito" de T30J7)
         Diferencia de criterio con nombre: tus US$ 4.200 al dólar de IEB (1.540,00) y no al CCL: +$34.440 (DB-3)
Galicia  total de la captura 14/10: $18.494.800,00 ✓
         ✓✓✓○≠✓✓✓✓   (○ el 06/10: la captura no mostraba el total · ≠ el 07/10: FIMA quedó pendiente)
MP       sin control aritmético: dos lecturas iguales (de dos modelos) y cambio plausible ✓
```

Los controles se vuelven a evaluar cuando cambia un hecho anterior (D-38): si corregís un precio del 08/10, ese cuadradito se recalcula. "No verificable" nunca equivale a "OK".

**Interacciones:** "Dar por visto" pide un motivo y un vencimiento ("hasta la próxima carga", "30 días" o "hasta que cambie el dato"), de 90 días como máximo, y queda en la auditoría (D-41 con cambio, DB-5). Ningún aviso es imposible de apagar ni queda silenciado para siempre. Como es parte del ritual semanal y no del diario, acá el motivo puede ser un texto.

**Teléfono:** una tarjeta por ítem, con la gravedad, una línea de evidencia y el botón de ancho completo. La franja de 30 cuadraditos entra en 360 px.

### 4.5 Cartera (`/cartera`) · 1a, y ficha de activo · 1b

**Para qué:** la tabla densa del spec en doble moneda, con el desglose activo/TC.

**Desktop desde 1280 px** (columnas del spec, ordenables, totales fijos abajo):

| Activo | Cant. | PPC ARS | PPC USD | Precio | Res. ARS | Res. USD | Activo / TC en $ | Activo / TC en US$ | % fin. | Días |
|---|---|---|---|---|---|---|---|---|---|---|
| SPY · IEB | 1.240 | $30.145,16 | US$ 21,26 *declarado* | $35.150 | +$6.206.000 · +16,6% | +US$ 1.787,93 · +6,8% | +$2.768.079 / +$3.437.921 | +1.787,93 / 0 | 41,8% | 225 *declarado* |
| YPFD · IEB | 300 | $48.200,00 | *sin dato* | $52.300 | +$1.230.000 · +8,5% | *sin dato* (desde la apertura del 01/10: ver ficha) | +$1.230.000 / $0 | *sin dato* | 15,0% | 13 desde apertura |
| S13N6 · Galicia | 11.500.000 | $1,0426 | US$ 0,000694 *declarado* | $1,0852 | +$489.900 · +4,1% | +US$ 78,22 · +1,0% | +$489.900 / $0 | +326,16 / −247,94 | 12,0% | … |
| T30J7 · IEB | 9.000.000 | $1,0976 *inferido* | US$ 0,000752 *declarado* | $1,1240 | +$237.600 · +2,4% | −US$ 235,70 · −3,5% | +$237.600 / $0 | +162,86 / −398,56 | 9,7% | … |
| … | | | | | | | | | | |
| **Totales** | | | | | **+$8.533.500 · +10,1%** | ***sin dato*** · suma parcial (3 de 6 posiciones): +US$ 1.630,45 | +$5.095.579 / +$3.437.921 | ***sin dato*** · parcial: +2.276,96 / −646,51 | **100%** | |

(Los repartos activo/TC de esta tabla son ilustrativos: dependen del camino diario de octubre, que el Apéndice B no lista. Los resultados en cada moneda sí cuadran, porque no dependen del camino.)

- **Dos columnas de desglose, una por moneda** (D-68): "Activo / TC en $" y "Activo / TC en US$". Cada una está en una sola moneda, así que se ordena y se totaliza. La moneda de riesgo decide dónde aparece el efecto cambiario (D-35): un CEDEAR, que arriesga dólares, tiene TC solo en pesos ("de tus $6,2 M, $3,4 M fueron el CCL"); una LECAP, que arriesga pesos, solo en dólares. La otra columna muestra el resultado entero como activo, con TC 0.
- **Una sola convención para el desglose desde la compra** (D-35), rotulada en la traza: desde tu primera carga, la suma de los intervalos diarios, igual que en Hoy y en Evolución; para el tramo anterior a la primera carga, un solo intervalo con el CCL de compra que declaraste. Así, la compra de 240 SPY del vie 09/10 da el mismo reparto en Cartera y en Evolución.
- Los desgloses de bonos muestran el **redondeo por resto mayor**: S13N6 da exacto +326,1651 − 247,9434 = +78,2217, y lo que ves (+326,16 − 247,94 = +78,22) también suma.
- T30J7 junta dos lotes: 8.000.000 VN de la apertura, con el CCL de compra que declaraste (1.452,00), y 1.000.000 VN comprados el jue 08/10 con el CCL de ese día (1.519,40). Su PPC en USD es el promedio ponderado de los dos, y su chip dice "declarado", la etiqueta más grave que hereda.
- El total de "Res. USD" es "sin dato" porque YPFD, TXMJ0 y FIMA no tienen CCL de compra (D-65). La suma parcial está rotulada como parcial. El total de una columna es el exacto redondeado: puede diferir en un centavo de la suma de lo que se ve en cada fila, y la traza lo dice.
- Una fila con precio viejo va en gris itálica con su chip. La liquidez (USD en IEB, MP, saldo de IEB) va en un bloque aparte al pie, para que las 25 filas del spec sean de posiciones.
- **25 filas sin scroll:** con mouse o trackpad, cada fila mide 28 px y es un solo objetivo: tocarla (o el foco del teclado) abre su detalle, y pasar el mouse por una cifra abre su traza (D-100). Así entran 25 filas desde 820 px de alto de ventana. Con puntero grueso o debajo de 1024 px, las filas miden 44 px. Tenés 11 renglones, así que sobra.

**Entre 768 y 1279 px (D-68):** la misma tabla, con **prioridad de columnas**. Entran las que caben, en este orden: Activo, Res. USD, Res. ARS, % fin., Precio, Activo / TC en US$, Activo / TC en $, PPC USD, PPC ARS, Cant., Días. Las que no caben pasan al detalle de la fila, que se abre al tocarla. A 768 px, con la barra lateral colapsada, quedan unos 670 px: entran las cinco primeras. Nada se corta ni se apila en celdas donde no entra, y no hace falta la columna fijada con scroll horizontal que proponía `stack.md`, que D-30 prohíbe. Playwright lo prueba en los cortes del propio diseño: 768, 1024, 1279, 1280 y 1600 px.

**Las columnas de tu tesis** (rol en la tesis desde la 1b; peso contra banda y distancia a invalidación desde la 4) aparecen como columnas propias **solo desde 1600 px**. Debajo de ese ancho van en el detalle de la fila.

**Teléfono: una tarjeta por posición (MO-1 con el cambio de D-68):**

```
SPY · CEDEAR · IEB                          41,8% del financiero
┊US$ 28.153┊
$43.586.000
Res. USD +6,8% ▲          Res. ARS +16,6% ▲
De tus +$6,21 M en pesos, $3,44 M fueron el CCL
───────────────────────────────────────────────
T30J7 · BONCAP · IEB                        9,7%
$10.116.000
┊US$ 6.534┊
Res. ARS +2,4% ▲          Res. USD −3,5% ▼
[ganás en pesos, perdés en dólares]
```

El chip aparece solo cuando los dos resultados tienen distinto signo. Los totales van en una tarjeta fija al final de la lista, no flotando.

**A un toque:** filtros por cuenta, clase y moneda de riesgo; "solo con sin dato"; "solo precios viejos"; desde la fase 5, "al día X" (CO-12).

**Ficha de activo (`/cartera/[ticker]`, 1b).** Abre con una frase propia del tipo de activo. LECAP (EX-5):

> **S13N6:** pagaste $1,0426 por VN con el CCL a 1.502,00 (declarado). Al vencimiento, el vie 13/11, cobrás $1,105 por VN: **$12.707.500** por tus 11.500.000 VN. Tu **CCL de empate desde la compra** es 1.591,90: si el 13/11 el CCL está por debajo, esta letra te habrá rendido en dólares más que haber dejado los dólares quietos. **Desde hoy** el empate es 1.576,45 (hoy, 1.548,20).

Debajo: valuación y resultado en ARS y USD con su desglose; TEM y TEA netas de costos (D-39); el precio en el tiempo con el tramo viejo punteado; las operaciones y las cargas que tocaron esta especie; su rol en tu tesis o "fuera de tesis"; desde la fase 4, el gráfico anotado (DS-3). En un CEDEAR, si cargaste el precio del subyacente, aparece el chip "CCL implícito 1.561,30 (+0,8% contra tu CCL)" (EX-8). Si no, la etiqueta dice "activo (incluye brecha de CCL implícito)" (D-18).

### 4.6 Exposición (`/exposicion`) · 1a en números (gráficos y composición en la 1b, bandas en la 4)

**Para qué:** ver la deuda en pesos como una posición corta en pesos y tu neto contra el peso (spec §3).

**Frase:**
> Estás **largo en pesos por $32.783.100** (US$ 21.175): tus pesos financieros ($54,18 M) superan lo que debés del leasing ($21,40 M). **Por cada +1% de CCL:** en dólares, ese neto pierde US$ 210; en pesos, tus activos en dólares suman $500.884.

**Arriba del pliegue (1a):**
- Selector **Financiero · Total** (D-03), con lo que netea cada vista escrito en su rótulo (D-101):
  - **Financiero:** "pesos financieros − deuda del leasing". Tus activos financieros con riesgo en pesos, menos el capital pendiente del leasing (spec §3). D-03 deja la deuda fuera del patrimonio financiero; por eso la vista no se llama "financiero" a secas.
  - **Total:** lo anterior más cada bien en la moneda de riesgo que le elegiste. Si a un bien le falta su moneda de riesgo, el neto total es **"sin dato"**, con la suma parcial a la vista (D-65, D-73): "Total: sin dato · a la casa y a la camioneta les falta la moneda de riesgo · suma parcial sin ellas: largo $32.783.100". La camioneta, valuada en $38 M, no entra en silencio por estar en pesos.
- **Largo, corto y neto** (EX-1), en números: tus pesos financieros ($54,18 M), el capital pendiente del leasing (−$21,40 M), el neto (+$32,78 M) y tus activos en dólares (US$ 32.353). Desde la 1b, lo mismo como gráfico: tus pesos como área sobre el cero, la deuda espejada debajo, el neto como línea gruesa y los dólares en una banda aparte. Colores neutros: ninguna de las dos áreas es "mala".
- Mientras D-71 no esté registrada, la vista muestra "tomador del leasing: sin confirmar" como dato, sin sacar conclusiones. Si algún día la deuda dejara de ser tuya, eso lo decide una decisión que reemplace a D-03, no un texto de la pantalla.

**Abajo del pliegue (1b):**
- **"¿Y si el CCL sube [ ]% mañana?"**, con el campo vacío hasta que pongas un número (D-08, vida 2.6 #1). Con 10: "tu neto en pesos pierde US$ 1.925; tus activos en dólares suman $5.008.844 en pesos".
- **Monitor de brechas:** "CCL 1.548,20 · cripto 1.541,00 (−0,47% contra el CCL) · MEP sin dato · oficial sin dato". MEP y oficial son opcionales (vida 2.6 #10).
- **Composición** sin tortas (EX-4), en tres barras horizontales apiladas: por clase (CEDEAR 41,8% · acción local 15,0% · bonos y letras 26,6% · FCI 5,8% · liquidez 10,8%), por moneda de riesgo (USD 48,0% · ARS 52,0%) y por geografía (US 41,8% · AR 58,2%). La liquidez lleva la geografía de su custodio: los US$ 4.200 que están en IEB cuentan como AR en geografía y como USD en moneda de riesgo. El mapeo de cada partida está escrito en Datos y en la traza.
- **Concentración:** "top 1: SPY 41,8% · top 3: 68,8%". Muestra ✓ o ✗ solo si cargaste un umbral (D-42); si no, "sin umbral".
- **Evolución de la exposición neta** en área apilada (spec §3).
- **Treemap** (EX-7): tamaño = valor en USD, color = resultado en USD en escala divergente con el 0 neutro.

**Fase 4 (o 1b, si aprobás D-99):**
- **Tus bandas** (EX-3, D-51): una barra por objetivo de tu tesis **vigente**, con la banda sombreada, una marca en el objetivo y otra en el actual. La base es la **canasta que marcaste** al importar la tesis, no todo el financiero, y su fórmula está a la vista: "tramo en pesos: $12,48 M de $32,08 M de tu canasta = 38,9%". Una tesis marcada como histórica no evalúa nada.

**Teléfono:** el largo/corto pasa a dos barras horizontales con el neto escrito entre ellas (MO-4). Las barras de composición ocupan el ancho. Las bandas van como una tarjeta por objetivo. El treemap mide al menos 280 px de alto, sin etiquetas dentro de las celdas chicas, y el detalle va en una lista debajo.

### 4.7 Evolución y PnL (`/evolucion`) · 1b (futuro 3, por años 5)

**Para qué:** el tab de PnL y evolución patrimonial que pediste (D-05). La parte histórica es fase 1 (D-05) y llega en la 1b: la historia se calcula igual desde las cargas de la 1a, así que nada se pierde por esperar (D-60).

**Controles:** Financiero · Total · lente ARS · USD (desde la 3, también "pesos de hoy", D-44) · período (1M, 3M, 6M, 1A, Todo, o fechas a mano; en el teléfono, en una hoja inferior porque son más de tres). Desde la fase 3: "Ver futuro con el escenario [base ▾]".

**Gráfico principal:**
- el patrimonio diario armado con las cargas, en ARS o en USD;
- la línea de **capital aportado acumulado** debajo: arranca en tu patrimonio de la primera carga (US$ 65.420 el jue 01/10) y suma aportes − retiros, cada uno a su `tc_aplicado` (HO-2). Lo que queda entre las dos líneas es lo que ganaste o perdiste;
- banderitas con tus notas del día (DS-6) y, desde la 4, tus decisiones;
- huecos donde no hubo carga (`connectNulls: false`) y tramos punteados donde el precio era viejo (CO-5).

**El puente del período (HO-2).** Ejemplo: octubre hasta hoy, financiero, en USD (ilustrativo: el reparto entre activo y TC depende del camino diario de octubre):

```
Inicial (jue 01/10, primera carga)          US$ 65.420,00
  Aportes y retiros                          +US$ 2.000,00
  Resultado por activos                      +US$ 1.780,48
  Resultado por TC                           −US$ 1.850,31
  Cuotas pagadas desde tus cuentas               US$ 0,00   (la cuota la paga la empresa)
  Sin atribuir (precios y saldos sin actualizar)  US$ 0,00
Final (mié 14/10)                           US$ 67.350,17
Cuadre ✓ residuo 0,00
```

- **El cuadre no es un residuo.** El final se recalcula desde los hechos (operaciones, cotizaciones y saldos) y se compara con el inicial más cada línea; activo y TC se calculan por posición con su propia fórmula. Si una línea se calculara por diferencia, el ✓ saldría siempre.
- **En la vista Total** se suman la amortización de capital, la revaluación de bienes y, solo en USD, la licuación de la deuda (D-05). Dos reglas: si la cuota la paga la empresa, la baja de la deuda entra como **aporte**, no como resultado (HO-2), porque si no el PnL total se infla todos los meses; y el efecto del CCL sobre un bien valuado en pesos va en "Resultado por TC", con su renglón propio ("de lo cual, la camioneta valuada en pesos: −US$ 264,40" el 14/10).
- Se dibuja como cascada de deltas, con el inicial y el final escritos como números. Tocar una barra muestra los 3 que más sumaron y los 2 que más restaron.

**Tabla "PnL por mes" (de D):** una fila por mes y una columna por cada línea del puente, en ARS o USD. Es la versión en tabla del puente, para comparar meses.

**Modo "Por años" (fase 5, con Años, de C):** una columna por año con el puente del año apilado. Se lee una década de un vistazo. 2026 aparece como parcial ("desde el 01/10").

**Desde la fase 3, el futuro:**
- desde hoy, el fondo pasa a gris y sigue el abanico p5–p95 del escenario elegido, con la línea de capital aportado proyectada (PR-1);
- debajo, **"PnL proyectado por año"**, con las mismas líneas del puente. Se calcula sobre **una corrida concreta, la mediana, no sobre percentiles**, porque el desglose de la mediana no es la mediana de los desgloses. La pantalla lo dice (de D, PR-9);
- **plan contra realidad:** "Hoy estás en el percentil 38 del escenario 'base' anclado el 01/11" (PR-11).

**Teléfono:** el gráfico ocupa el ancho con 240 px de alto. El puente pasa a una lista vertical con signos (MO-4). La tabla por mes y "Por años" pasan a una tarjeta por mes o por año.

### 4.8 Revisión (`/revision`) · fase 4 (o 1b, si aprobás D-99)

**Para qué:** tu revisión semanal, con el formato de tu skill y datos verificados (DD-9, D-74). La pregunta es la de tu skill: ¿algo de lo que sostiene mi tesis dejó de ser cierto?

Es tu skill hecha pantalla: **su formato y su orden** (Estado, Posiciones, Total, Disparadores, Próximo hito, Acción), sin búsquedas web. Dos reglas de la skill se respetan al pie de la letra: en Disparadores van **solo los activos** ("Si ninguno: 'Ninguno.'"), y si no se activó ninguno, la revisión **termina en cinco líneas**. Un solo cambio: **"Acción sugerida" pasa a "Acción anotada"**, porque la app no sugiere.

Una semana sin disparadores:

> **Estado — dom 18/10/2026** · Nada que hacer según tus reglas.
> **Posiciones** · 6 posiciones ▸ (la tabla de tu skill, plegada)
> **Total** · $104,27 M · US$ 67.350 · resultado ARS +10,1% · resultado USD *sin dato* (suma parcial, 3 de 6: +US$ 1.630,45) · contra LECAP: *sin dato* (pegá la serie de TEM de referencia)
> **Disparadores** · Ninguno. ▸ (los siete, con su estado)
> **Próximo hito** · vie 30/10 · balance de Exxon 3T · XOM, VIST · "termómetro del sector". Ninguna de las dos está hoy en tu cartera. **Acción anotada:** ninguna.

- **"Los siete, con su estado"**, a un toque: 1 · invalidación tocada (evaluada con el cierre real del subyacente; sin él, "sin evaluar") · 2 · invalidación por evento (la marcás vos) · 3 · objetivo alcanzado · 4 · desvío de peso (**sin evaluar: tu canasta está en armado**, 1 de 6 objetivos con tenencia) · 5 · tramo pendiente activo · 6 · hito a 10 días o menos (evaluado: el próximo es el vie 30/10, en 12 días) · 7 · cambio en los fundamentos (lo marcás vos). "Sin evaluar" nunca cuenta como "no activo".
- **El Total desplegado** dice además: "Desde la primera carga (jue 01/10), en dólares: tus activos sumaron US$ 1.780 y el CCL restó US$ 1.850. Son montos que suman exacto con tus aportes (D-35), no los puntos multiplicativos que calcula hoy tu skill: por eso pueden no coincidir".
- **Si un disparador está activo,** aparece con su número y tu regla citada: "4 · Tramo en pesos fuera de banda: 38,9% de tu canasta ($12,48 M de $32,08 M; banda 28–38%). Tu regla: 'Rebalancear solo si una posición se corre más de 5 puntos porcentuales de su objetivo.'" Con dos botones: "Abrir" y "Reconocer sin acción (motivo)". Ahí la tabla de posiciones se despliega sola.
- **La primera revisión del mes** suma "Fundamentos": tu **marco macro** (las tres condiciones de tu tesis: el capex de IA sigue confirmado, las tasas largas son el riesgo dominante, el shock energético tiene final abierto) y los pilares de cada posición. Por cada uno marcás "Sigue · Cambió · No sé" con una nota. Si una condición del marco macro deja de ser cierta, tu tesis dice que hay que repensar toda la cartera, no una posición, y la revisión lo cita. La app no busca noticias: registra **tu** chequeo, que es la forma de evaluar el disparador 7 sin que la app opine.
- "Marcar como hecha" deja una fila en `revisiones`. La constancia ("11 de 12 semanas") vive en el Registro, sin rachas (CA-12).
- **Más adelante**, si aprobás D-84, la misma revisión llega por mail.

**Teléfono:** las mismas secciones como tarjetas apiladas. Las posiciones pasan a tarjetas MO-1 con el peso contra el objetivo.

### 4.9 Datos (`/datos/…`) · 1a, crece

En el teléfono, el título es el selector de subpantalla. Cada alta es una hoja inferior. Cada formulario manual es una carga `manual` y queda en el Registro.

| Subpantalla | Qué tiene | Fase |
|---|---|---|
| Catálogo | Activos: tipo, moneda de riesgo, geografía, indexación, ratio con historia, color fijo; la clase y la geografía de cada partida de liquidez | 1a |
| Cuentas | IEB, Galicia, Mercado Pago: tipo y perímetro (inversión, consumo o las dos, como MP, D-102) | 1a |
| Entidades | Vos y tus empresas (tu tesis menciona tres); a quién pertenece cada cuenta, bien y deuda; tomador y pagador del leasing (D-71) | 2 (las columnas existen desde la 1a, vacías, D-59) |
| Bienes | Casa y camioneta, valuaciones fechadas con fuente (D-04); cadencia de revaluación y moneda de riesgo (1b) | 1a |
| Leasing | Contrato (montos netos de IVA, cuotas, opción de compra) y capital pendiente informado (`pasivo_saldos`), con su archivo | 1a |
| Pegar serie | `fecha;valor` con serie y fuente obligatoria, y vista previa: "312 líneas · 298 fechas nuevas · 14 ya existen (no se pisan)" (CA-13, D-48). CCL histórico en la 1b; después CER, TAMAR, IPC, SPY ajustado | 1b |
| Tesis | Importar `tesis.md` y `calendario.md` con el cruce contra tu cartera (4.9.2) | 1b |
| Feriados | BYMA, bancario y NYSE, cada uno con su fuente (D-45) | 1b (en la 1a, la tabla actual) |
| Alias | Lo que la app aprendió de cada bróker (CA-6) | 1b |
| Documentos | Resumen anual de IEB, aviso RG 917 de FIMA, tasaciones, contrato del leasing. Cada uno es una carga sin filas: archivo, fecha y sha256 (D-77) | 1b |
| Exportar | CSV por tabla: en la 1a los genera el respaldo nocturno (`calidad.md` §6); el botón en la interfaz y un recordatorio mensual de exportación (CO-15), en la 1b. Paquete anual legible sin la app con Años, en la fase 5 | 1a / 1b |

#### 4.9.1 Día cero (una vez, unos 40 minutos)

La primera semana define si el hábito prende, así que el arranque sigue un orden fijo (D-70, de B y DA-11). En la 1a, este orden está acá y en `carga-diaria.md`, sin pantalla propia. Desde la 1b, Datos lo muestra como una lista de pasos, que sirve sobre todo para el paso 5, el que cae en la 1b:

| Paso | Vos | La app |
|---|---|---|
| 1 | Cargás el catálogo: cada activo con su moneda de riesgo (la elegís vos), geografía y color; el ratio de SPY con su vigencia. Marcás el perímetro de cada cuenta | Valida que todo CEDEAR tenga subyacente y que todo bono tenga indexación (checks del schema), y que todo CEDEAR tenga un ratio vigente (lo controla la app: el ratio vive en su propia tabla) |
| 2 | Primera carga completa: CCL, cripto, Excel de IEB y capturas de Galicia y MP | Crea una apertura por posición con el PPP del bróker como costo, en una sola confirmación (D-14). Concilia contra B2 y los Subtotales desde el primer día |
| 3 | Cargás el contrato del leasing y el último capital pendiente informado, con su archivo | Netea el leasing en Exposición y arma tu parte de la camioneta (D-03). Tomador y pagador se registran con las entidades, en la fase 2 (D-71) |
| 4 | Cargás la valuación de la casa y de la camioneta, con su fuente | Arma el patrimonio total y muestra la fecha de cada valuación |
| 5 (1b) | Declarás, si los sabés, el CCL de compra y la fecha de origen de cada posición; importás tu tesis y tu calendario | Marca esos datos "declarado" y muestra el cruce tesis/cartera |
| — | — | Esa noche corre el primer respaldo y se restaura. Hoy dice: "Primera carga guardada. Mañana vas a ver qué cambió y por qué" |

**Si la primera carga es con fecha pasada** (el Plan B del 31/12, D-76): las aperturas se crean a la fecha del Excel (su B1), con el CCL y el cripto que anotaste para ese día y su fuente. Las cargas siguientes, también con su fecha, arman la historia en orden.

#### 4.9.2 Importar tu tesis (1b, D-51, DD-5)

Pegás o subís `tesis.md` y `calendario.md`. Los dos quedan como documentos (D-77). La app muestra lo que entendió antes de guardar, contado con cuidado, porque acá decidís si le creés:

> Encontré: 6 objetivos con banda · 15 tramos (rangos en US$ del subyacente) · 6 invalidaciones en 5 posiciones (4 por precio de cierre; 2 por evento: "acuerdo por Ormuz firmado" en XOM y "giro político que comprometa el RIGI" en VIST) · 14 objetivos de precio (LMT tiene 2) · un marco macro de 3 condiciones · capital declarado $25.000.000 · horizonte dic-2027 · 17 hitos (3 "por confirmar", 3 ya pasados). Fecha declarada: 24/08/2026.

**La tesis es vigente o histórica.** Al importarla la marcás como **vigente** o **histórica** (de C). Solo una tesis vigente alimenta bandas, disparadores y veredicto; una histórica queda como documento, con su fecha.

**El cruce con tu cartera real**, el paso más importante:

| | Activos | Qué hace la app |
|---|---|---|
| En tu tesis y en tu cartera | ninguno | — |
| En tu tesis, no en tu cartera | GOOGL, ANET, LMT, VIST, XOM, S30N6 | "Tramos pendientes, no vendidos", como dice tu skill: si falta una posición que la tesis dice que debería existir, no se asume una venta |
| En tu cartera, no en tu tesis | SPY, YPFD, T30J7, TXMJ0, S13N6, FIMA | Te pregunta por cada uno: ¿es parte de la **canasta** de la tesis con un rol (por ejemplo, "tramo en pesos")? ¿O queda **fuera de tesis**? |

La app no supone cuál lista vale: vos marcás. El objetivo puede ser de un activo (GOOGL 23%) o de un **rol** ("tramo en pesos" 33%, banda 28–38%). Así, cuando la LECAP se rollea (S30N6 → S13N6 → la que siga), cambia el ticker pero no el rol. **La base de las bandas es la canasta que marcaste** (EX-3, de D): tu tesis es de $25 M y tu financiero de unos $104 M con otras posiciones, así que un porcentaje sobre todo el financiero no se podría comparar con tus objetivos. El desvío de peso (tu disparador 4) **se evalúa solo cuando la canasta está armada**. Mientras haya objetivos sin tenencia, dice "sin evaluar: canasta en armado (1 de 6)", en lugar de dar una alarma falsa todos los días. En la 1b todo esto entra **como datos**; las bandas y los disparadores se evalúan desde la fase 4 (o desde la 1b, si aprobás D-99).

**El marco macro** entra como tres condiciones con su texto literal. Su estado ("Sigue · Cambió · No sé") lo marcás vos en la revisión mensual (4.8) y se ve en Tesis y niveles (4.16).

Desde la importación, los niveles no se editan: cambiar uno crea una versión nueva con motivo, y la anterior queda. Lo pide tu propia regla: "No corras los niveles de invalidación… con la razón anotada en el historial de la tesis" (D-51, DS-13).

### 4.10 Ajustes y Ayuda · 1a / 1b

**Ajustes (`/ajustes`):**
- Tema (sistema, claro u oscuro) y paleta daltónica (MO-5, 1b).
- Modo privado, que se recuerda por dispositivo (MO-3, 1b).
- **Respaldo:** "Último respaldo restaurado y verificado: anoche 03:12 · 37 tablas · 1.212 filas · 41 archivos" (vida 2.3 #2). Si pasan más de 48 horas sin uno, entra en Atención.
- Umbrales (1b): top 1, top 3, exposición neta como % del financiero, % en un solo bróker y tu banda neutra (HO-5); desde la fase 2, **meses de cuota cubiertos por tu liquidez** y **meses de reserva** (tus gastos fijos cubiertos por tu liquidez). Todos vacíos, con deslizante y −/+ como en D-08 (D-42). Con el número que pongas vos, son controles tuyos y no recomendaciones (EX-3, vida 2.6 #6).
- Sesión.
- Si aprobás D-84: resumen semanal (día, hora, con o sin montos) y Pausa.

**Ayuda (`/ayuda`, 1b, D-78):** los documentos del repo (`spec.md`, `decisiones.md`, `carga-diaria.md`, `datos.md`, `calidad.md`) renderizados dentro de la app, con buscador, y un **manual por ritual** (diario, semanal, mensual y anual, de C): qué hacés en cada uno y cuánto tarda. Desde la fase 5, la metodología que se escribe sola desde las funciones puras (CO-14). Es la documentación completa que pediste, con una sola fuente de verdad: lo que se documenta en el repo es lo que leés en la app. El glosario en contexto de 4.0 enlaza acá.

### 4.11 Pasivos (`/pasivos`) · fase 2

**Para qué:** el leasing como un contrato vivo, en pesos y en dólares (spec §5).

**Frase** (licuación y pagado en USD son ilustrativos: dependen de la historia del CCL en cada pago):
> Leasing de la camioneta: **cuota 14 de 48**. La cuota fija es de $1.150.000: hoy son US$ 743, y la cuota 1 eran US$ 912. Faltan $39,1 M nominales (34 cuotas), que hoy son US$ 25.255. Capital pendiente informado por la leasera: $21,4 M (es lo que netea en Exposición). Desde la cuota 1, el CCL **licuó US$ 6.830** de tu deuda. **La paga la empresa** (registrado en cada cuota pagada).

**Elementos:**
- **Cuota en pesos (plana) contra cuota en dólares (cae) en el mismo eje, como pide el spec:** las dos series indexadas a 100 en la cuota 1. La de pesos queda en 100 y la de dólares baja a 81,4. Los montos absolutos están en los extremos y en la traza. Es la forma honesta de poner dos monedas en un mismo eje.
- **Cuadro de marcha:** nro · vencimiento · canon neto · IVA · seguro · otros · total · pagado (fecha y **quién pagó**, H8.3) · CCL del día de pago · total en USD. Una cuota futura puede llevar su pagador conocido.
- **Capital pendiente, informado contra cuadro de marcha** (EX-6, de B): "informado $21.400.000 (30/09, carta de la leasera) · según cuadro de marcha $21.372.540 ≈". Entre un informe y el siguiente, el capital se muestra "según cuadro de marcha", con esa etiqueta, y se concilia cuando cargás el valor informado.
- **TEA implícita de la financiación** (EX-6), calculada desde el cuadro de marcha y el valor del bien, al lado del costo total contra valor del bien.
- **Pagado y faltante** en ARS y en USD al TC de cada fecha: "Pagado $16,1 M (US$ 11.420 al CCL de cada pago)".
- **Licuación** con número (EX-6): capital × (1/CCL₀ − 1/CCL₁) por tramo, con traza. La deuda en USD que baja va en verde: en una deuda, bajar es bueno (HO-5).
- **Tres lentes de lo que falta:** ARS nominal, pesos de hoy (con el IPC que pegás, o "sin dato") y USD (EX-6).
- **"IVA y Ganancias recuperados",** rotulado como escudo fiscal **de la empresa**, con `iva_computable` o "sin dato" (H8.13).
- **Opción de compra:** monto, fecha y quién la ejerce. Si la tomadora es la empresa, ejercerla no te da el auto: hace falta una segunda operación, con sus costos (H8.9, a confirmar con tu contador).
- **Costo total contra valor del bien.**

**Teléfono:** las pagadas plegadas ("14 pagadas ▸") y las próximas 6 cuotas como tarjetas. El gráfico indexado ocupa el ancho con 220 px de alto.

### 4.12 Flujo y cierres (`/flujo`) · fase 2

**Para qué:** que el excedente invertible salga de un cierre mensual de 5 a 10 minutos, sin anotar gastos todos los días (spec §6, H1.11–H1.13, D-79).

**Arriba, con el mes abierto (proyectado):** ingreso USD × `cripto_venta` + ingreso fijo en pesos − gastos fijos − provisiones de gastos anuales − cuota del leasing **solo si el pagador sos vos** (H8.14). "Noviembre · proyectado: US$ 4.000 × 1.541,00 = $6.164.000 + fijo $2.500.000 − gastos fijos $3.400.000 − cuota $0 (la paga la empresa) = **excedente proyectado $5.264.000**". Ese excedente alimenta Proyecciones.

**Arriba, con el mes cerrado (real), la frase en tres lentes (de C):**
> **Octubre:** ingresaron US$ 4.000 vendidos a 1.541,00 = $6.164.000, más el fijo de $2.500.000 = $8.664.000. **Viviste con $3,91 M** · $3,91 M de oct-26 (provisorio hasta el IPC que publica el INDEC a mediados de noviembre) · US$ 2.537. **Ahorraste $4,75 M** (US$ 3.085) · tasa 54,9% sobre el ingreso neto acreditado (la definición que elegiste) · proyectado $5,26 M → real $4,75 M. No explicado: $180.000 (no son recurrentes ni tarjeta).

- **Las cuentas desde las que vivís (D-102).** Cada cuenta tiene su perímetro: inversión, consumo o las dos (mixta, como MP).
  - Una cuenta **solo de consumo** queda fuera del financiero y entra recién en el cierre del mes.
  - Una cuenta **mixta** está dentro del financiero, pero sus bajas nunca se leen como resultado: el día que bajan, la frase las muestra aparte ("salieron $180.000 de MP: consumo, sin confirmar") y la carga no pregunta nada. Si el saldo sube dentro de lo que explica la TNA de la captura, la suba entera es rendimiento; si baja, el rendimiento del día es el que explica la TNA, con la etiqueta "inferido", y el resto es la salida. Solo una suba que la TNA no explica dispara "¿Entró o salió plata?" (CA-4). El cierre del mes confirma esas salidas como retiros implícitos de un solo toque y, si cargás el resumen de rendimientos de MP, asienta la diferencia con lo inferido ese día, sin reescribir días anteriores: el mes sigue siendo la suma exacta de sus días.
- **El consumo sale por diferencia de saldos** (H1.13): en tus cuentas de consumo, saldo inicial + ingresos − lo que pasaste a inversión − saldo final; en las mixtas, las salidas a consumo que el cierre confirma. Las categorías son opcionales y nunca mandan.
- **Ahorro y aportes no son el mismo número.** El ahorro es ingreso menos consumo: US$ 3.085 en todo octubre. Los aportes del puente de Evolución son lo que cruzó al financiero: US$ 2.000 hasta el 14/10. La diferencia es lo que quedó en cuentas de consumo, fuera del financiero, o lo que entró después del 14/10. La pantalla muestra los dos, cada uno con su definición (los números del ejemplo son ilustrativos).
- La lente en pesos de hoy y en USD no tiene un default: la elegís en el primer cierre y queda como preferencia tuya (D-80).
- Gastos recurrentes con frecuencia y regla de ajuste (vida 2.1 #3); provisiones para gastos anuales ("Inmobiliario: vence el 20/02/2027 · $95.000 por mes", vida 2.1 #4); resumen de tarjeta opcional (D-81).
- **El monto fijo en pesos y tus empresas** (D-82): su naturaleza (sueldo, honorarios, dividendo, retiro a cuenta) y la **cuenta corriente con cada empresa** (vida 2.8 #2), derivada de los movimientos con contraparte. Es lo que define si ese monto es ingreso o deuda: sin esto, un retiro a cuenta inflaría el excedente.
- Barras de proyectado contra real por mes, apiladas. Sin Sankey (PR-12).
- **El cierre:** "Cerrar octubre". Queda provisorio hasta que pegás el IPC y pasa a definitivo con un toque. Cambiar un mes cerrado pide un motivo y queda auditado.

**Teléfono:** el cierre son 4 tarjetas en secuencia (ingresos, saldos, tarjeta, resultado), cada una con un solo botón "Confirmar".

### 4.13 Calendario (`/calendario`) · fase 2, y mesa de decisión · fase 4

**Para qué:** que ningún vencimiento te tome desprevenido (spec §10).

**Desktop:** la lista de los próximos 60 días a la izquierda y la grilla del mes a la derecha. **Teléfono:** solo la lista, agrupada por semana; nunca una grilla de mes.

```
vie 30/10  Hito · Balance Exxon 3T · XOM, VIST · de tu calendario
mar 03/11  Hito · Elecciones de medio término EE.UU. · LMT, GOOGL · de tu calendario
vie 13/11  Vencimiento S13N6 · cobrás $12.707.500 (esperado) · destino: sin anotar   ← alerta desde el vie 30/10 [Anotar destino]
mar 17/11  Cuota 15 del leasing · $1.150.000 · paga: la empresa
mié 30/12  Último día hábil del año: tu carga es la foto al 31/12
jue 31/12  Técnico: dejan de funcionar las claves legacy de Supabase (H3.12) — hecho si se aprobó D-54
```

**Qué entra:** vencimientos con lo esperado (`flujos_bono` × tenencia) y lo cobrado, que se tildan solos cuando la carga concilia lo cobrado (PR-14); cupones "a determinar (TAMAR)" en TXMJ0; cuotas; balances y eventos macro manuales; los hitos importados de tu `calendario.md` con "por confirmar" donde corresponde (DS-11); fechas fiscales, técnicas y de seguros; cierres de mes.

**Alertas:** vencimiento **a menos de 15 días** sin `destino_decidido` (spec): para S13N6, que vence el vie 13/11, desde el vie 30/10, a 14 días; hito a 10 días o menos (tu disparador 6). Las dos aparecen también en Atención de Hoy. Exportar a tu calendario en `.ics` (vida 2.4 #13).

**"Anotar destino" (D-75):** desde la alerta, una línea de texto que se guarda en `vencimientos.destino_decidido` y apaga la alerta. Es todo lo que la fase 2 necesita para cumplir el spec.

**La mesa de decisión (`/diario/decision/[id]`, D-85) · fase 4, con el Diario.** Se abre desde una alerta de vencimiento, desde un disparador activo o con "+ Anotar una decisión". Va en la fase 4 porque sus alternativas se guardan con la decisión, y la tabla `decisiones` llega en la 4. Tres bloques (en el teléfono, apilados):

1. **La pregunta y los hechos** (se arma sola, con datos verificados): "¿Qué hacés con lo que cobrás de S13N6 el 13/11?" · "Cobrás $12.707.500 (US$ 8.208 al CCL de hoy) · CCL de empate desde hoy: 1.576,45" · **tus reglas citadas** de `tesis.md`: "Al vencimiento: decisión consciente entre rollear a otra letra o rotar a acciones según dónde estén los precios. No dejar el dinero sin colocar." · "No reemplazar por fondos con duration."
2. **Tus alternativas:** de 2 a 4, en texto, escritas por vos. La app no agrega ninguna, no las proyecta ni las compara: para comparar supuestos usás Proyecciones, como pide el spec §7 (D-98).
3. **Lo que decidís:** el destino en una línea, que se guarda en `vencimientos.destino_decidido` y apaga la alerta, y la decisión completa en el Diario (4.16). Las alternativas que descartaste quedan para la revisión de esa entrada.

**Reglas de neutralidad (DD-4), con su propio test:** las alternativas son tuyas y van en el orden en que las escribiste; todas tienen el mismo peso visual (sin color de "mejor", sin estrella, sin resaltar un máximo); no hay ninguna frase que resuma o elija; siempre se ve qué supuestos se usaron. Al pie, el recordatorio de tu `disciplina.md`: "Esta app no reemplaza asesoramiento financiero matriculado".

### 4.14 Años (`/anos`) · fase 5

**Para qué:** el libro de tu plata, un capítulo por año (de C). Es la pantalla que más vale con el tiempo. Va en la fase 5 porque se calcula entera desde hechos que ya están guardados: lo único irrecuperable, la foto del 31/12, lo protegen el aviso de diciembre (1a), el checklist (1b) y la captura del 31/12 de la fase 2 (D-60, D-76).

**El checklist del 31/12** (1b, en Atención desde el 01/12; de C), "3 de 8 listos":

| Ítem | Estado de ejemplo |
|---|---|
| IEB cargado el último día hábil (listado completo, B2 cuadra) | ✓ |
| Galicia cargado el último día hábil (dos lecturas iguales) | ✓ |
| Mercado Pago: lo invertido y lo no invertido, por separado (H2.6) | ≠ la captura muestra solo el total: ¿hay otra captura? |
| CCL y cripto del último día hábil | ✓ |
| Capital del leasing al 31/12, informado por la leasera (desde la fase 2) | ○ el último es del 30/09: pedí el saldo |
| Casa y camioneta con una valuación dentro de tu cadencia | ○ camioneta sin valuación desde marzo |
| Documentos del año: resumen anual de IEB y aviso RG 917 de FIMA (H2.5) | ○ el resumen llega en enero |
| Costos pendientes con fecha del año (D-19) | ○ una compra del 30/12 espera su PPP |

**La pantalla:**
- **Una tarjeta por año**, la más reciente primero: "**2026** · en curso · empezaste el 01/10 · faltan 77 días para la foto". Dentro de unos años: "**2027** · cerrado el 14/01/2028 (con candado) · huella 9f3a…c21 · archivo descargado 2 veces".
- **Dentro de un año:** la foto al 31/12 en ARS y USD con sus fórmulas, financiero y total; el puente del año (la suma exacta de sus días); los 12 cierres de mes; las decisiones del año y su revisión; la foto fiscal.
- **"Congelar 2026"** (D-86) muestra primero qué se congela y qué controles pasan. Después guarda la foto con su huella (sha256) como **evidencia**, nunca como insumo de un cálculo (D-103), y un trigger rechaza cambios en hechos con fecha de 2026, salvo una reapertura con motivo que queda auditada. Se congela en enero o después, nunca el 31/12, porque una compra del 30/12 completa su costo con el PPP del día siguiente (D-19) y el resumen anual del bróker llega en enero. Si Años llega en 2027 o más tarde, se congela entonces: los hechos ya están y la auditoría muestra cualquier cambio del medio.
- **"Descargar el archivo 2026":** un ZIP con CSV, `datapackage.json` generado desde los `COMMENT ON`, el diario en formato hledger, los archivos originales con su sha256, un `.xlsx`, un LEEME en castellano y una página HTML estática que se abre sin la app (vida 2.3 #5 y #12). Un test de ida y vuelta lo reimporta y compara al centavo.
- **Test de no regresión:** la CI recalcula las fotos de los años cerrados con el código actual y falla si un número cambia (vida 2.3 #4).
- **Cartera "al día X"** (CO-12): la tabla de Cartera a cualquier fecha pasada.

**Teléfono:** una tarjeta por año. El botón de congelar existe, pero dice "más cómodo en la computadora".

### 4.15 Proyecciones (`/proyecciones`) · fase 3

**Para qué:** proyectar tus supuestos, nunca los de la app (D-08, D-07). Todos los números de esta sección son ilustrativos: salen de corridas que el Apéndice B no reproduce.

**Desktop:** a la izquierda (8 columnas) el gráfico y los resultados; a la derecha (4 columnas) el panel de supuestos, con scroll propio.

**Escenario nuevo, todavía vacío (PR-10):**
> Para proyectar faltan: **devaluación, inflación, el retorno de cada clase con precio que tenés (CEDEAR, acción local, liquidez remunerada), la volatilidad de cada una y el horizonte**. La app no los completa: serían recomendaciones.

Los datos reales (CCL, ingreso, gastos, cartera, cuota, TEM implícita de cada bono) ya están cargados (D-08).

**Resultados, en cuatro cajas** (con un escenario ya completo y horizonte dic-2027):
1. **Patrimonio financiero a dic-2027:** "La mitad de las corridas termina arriba de **US$ 101.300**, y 90 de cada 100, entre US$ 86.200 y US$ 118.900". Nunca dice "esperado" (PR-1).
2. **Debajo de lo que pusiste** (PR-2, PR-3): 100 puntos con el valor final y una línea vertical en lo aportado (US$ 95.420: tu patrimonio de la primera carga más tus aportes). "**21 de 100 puntos (20,7%)** terminan debajo de lo que pusiste. En esas corridas falta una mediana de US$ 3.900, y la línea suele cruzarse en ago-2027."
3. **Cobertura de la cuota** (D-49): "Tu cartera podría pagar sola la cuota del leasing **desde nov-2027** (mediana) · p10: sep-2027 · p90: no cruza antes de dic-2027 · el 34% de las corridas no cruza. **Hoy la cuota la paga la empresa.**" El mes de cobertura es el primero en que la mediana de los **12 meses anteriores** del resultado mensual **en dólares, sin aportes**, en esa corrida, alcanza la cuota en dólares de ese mes (cuota en pesos ÷ CCL de la corrida). La ventana es fija y puede incluir meses reales: con tu primera carga en octubre de 2026, el primer mes que se puede evaluar es septiembre de 2027. "Resultado" es el resultado total, incluidas las ganancias no realizadas, y la caja lo dice: el motor proyecta retorno total por clase, y separar la renta pediría un supuesto nuevo (D-49).
4. **Patrimonio total p50**, con la casa y la camioneta según sus supuestos.

**El abanico (PR-1):** la historia real como línea sólida; desde hoy, fondo gris, banda p5–p95 clara y p25–p75 oscura, mediana encima; etiquetas en el borde derecho; la línea de capital aportado. Al pie (PR-7): "t-Student ν = 5 · 10.000 corridas · semilla 83921 · sfc32 v1 · los sorteos son independientes mes a mes: el modelo no repite rachas de crisis". ν, corridas y semilla arrancan con esos valores técnicos, declarados en D-88; no son magnitudes de mercado.

**Panel de supuestos (D-08).** Cada variable es una tarjeta con su "?" (glosario), el selector **Baja · Igual · Sube**, que en devaluación, inflación y retornos arranca **sin nada elegido**, y debajo de "Igual" el texto exacto de qué significa. Con Baja o Sube aparece el deslizante con el valor a la vista ("+2,0%/mes"), botones − y + con paso 0,1, y el número también en el botón: "Sube +2,0%/mes". **El valor que elegiste queda recordado por variable** para tus próximos escenarios (D-08); la primera vez, el deslizante arranca vacío y no se proyecta hasta moverlo. En CCL e inflación, "+ tramo": "Sube +2,0%/mes hasta mar-2027 · Igual después".

**Qué significa "Igual" en cada variable (DD-7, D-88).** Ninguna fila de "Igual" pide un dato que no tengas: es la regla de D-08.

| Variable | Igual = | Baja / Sube mueven | Rango (en cada dirección) |
|---|---|---|---|
| Devaluación (CCL), por tramos | el CCL queda en 1.548,20 | %/mes | 0 a 15 %/mes (el ejemplo de D-08) |
| Inflación, por tramos | los precios quedan donde están (0%/mes) | %/mes | Sube 0 a 15; Baja 0 a 5 %/mes |
| Ingreso USD | mismo monto (US$ 4.000) | crecimiento %/año | 0 a 50 %/año |
| Brecha cripto contra CCL | la de hoy (−0,47%) | puntos de brecha | 0 a 25 pp |
| Ingreso fijo en pesos | mismo monto nominal ($2.500.000) | ajuste %/mes | 0 a 15 %/mes |
| Gastos fijos | mismo monto nominal | %/mes, o "atado a la inflación del escenario" | 0 a 15 %/mes |
| Retorno por clase (CEDEAR, acción local, liquidez remunerada) | precio quieto (0%) | %/año en la moneda de riesgo de la clase | 0 a 60 %/año |
| Volatilidad por clase | — (arranca vacía y figura en "faltan") | %/año | 0 a 100 %/año |
| TEM por bono (tasa fija, LECAP, BONCAP) | la **TEM implícita del bono a su precio de hoy**, que sale de `flujos_bono` sin pedirte nada | TEM | 0 a 10 %/mes |
| Bono CER | el spread real de hoy | spread real | 0 a 15 pp |
| Reinversión de cada vencimiento | a la misma clase que vence, a la TEM implícita de hoy de esa clase | elegís otra clase por vencimiento (sin Baja ni Sube) | — |
| Casa (USD) | mismo valor (US$ 200.000) | %/año | 0 a 30 %/año |
| Camioneta | mismo valor ($38.000.000) | depreciación %/año | 0 a 40 %/año |
| Shock de ingresos | sin shock | "desde el mes N el ingreso pasa a US$ X" | N y X |
| Quién paga la cuota | la empresa, como hoy | "vos desde el mes N" (vida 2.8 #6) | N |
| Opción de compra | no se ejerce | se ejerce en el mes N | N |
| % del excedente que invertís | — (es una política tuya, sin Baja · Igual · Sube) | 0 a 100% | — |
| Horizonte | — (vacío; si tenés una tesis vigente, arranca en su fin, rotulado "de tu tesis" y editable) | meses | 1 a 120 |

**Cada partida tiene su clase en el motor:** FIMA y Mercado Pago, liquidez remunerada; los dólares en efectivo, liquidez en USD (Igual = sin retorno; su valor en pesos sigue al CCL del escenario); el saldo negativo de IEB se netea contra la liquidez en pesos, sin retorno; YPFD, acción local; SPY, CEDEAR; las LECAP y BONCAP, por su TEM; TXMJ0, por su regla dual. El mapeo está en Datos (4.9) y en la traza.

En "Avanzado", plegado: volatilidad por clase, ν (cuánto pesan las colas), corridas y semilla, con un botón aparte "Nueva semilla". Un escenario nuevo copia estos valores del último guardado (D-08).

**Vista Estrés** (determinística, sin Monte Carlo, vida 2.6 #2, #3, #5, #8): "el CCL sube X%"; "**el CCL queda quieto y la inflación es Z%/mes durante N meses**", que es la apreciación real que efectivamente te pegó en 2024–2026 (H6.6); "el ingreso USD pasa a US$ X desde el mes N". La salida es una franja de horizontes (0, 1, 3, 6 y 12 meses) con patrimonio en ARS y USD, gastos en USD y excedente. El traspaso a precios es un supuesto tuyo, vacío al arrancar.

**Comparar (PR-4, D-44):** 2 o 3 escenarios. La p50 de la base va punteada y la de la variante, sólida. Al costado, solo los supuestos que difieren, y tres cajas: "Patrimonio a dic-2027: US$ 101.300 → US$ 94.800 (−US$ 6.500) · Cobertura de cuota: nov-2027 → no cruza antes de dic-2027 · Debajo de lo aportado: 20,7% → 31,2%".

Mientras tanteás, los supuestos viven en la URL: refrescar no pierde nada y Atrás recorre lo que probaste. Recalcula en un Web Worker en menos de 200 ms (`calidad.md` §3). Guardar con nombre, duplicar, anclar (D-43). **Cuando anotás una decisión** (fase 4) **y al congelar un año** (fase 5), la proyección que viste queda congelada con sus supuestos, semilla, algoritmo y versión del código (DD-3), como evidencia y nunca como insumo de otro cálculo (D-103), para que dentro de años el diario muestre lo que viste y no un recálculo.

**Teléfono:** primero el gráfico (240 px, con las etiquetas de percentiles en una leyenda debajo); después las cuatro cajas apiladas; después una tarjeta por variable con los tres botones a todo el ancho (cada uno de 44 px o más, con la etiqueta en dos líneas si hace falta) y el deslizante debajo. Al bajar hasta los supuestos queda fija arriba una franja de una línea ("p50 US$ 101,3k · 21% debajo de lo aportado · cuota nov-27"), opaca, que empuja el contenido y no tapa ningún control. **Comparar** pasa a una tarjeta por escenario, apiladas, con las tres cajas en cada una y los supuestos que difieren resaltados con texto, no con color.

### 4.16 Tesis y niveles, y Diario · fase 4

**Tesis y niveles (`/tesis`)** completa el spec §8 sobre los datos que entraron en la 1b, siempre contra tu tesis **vigente**:
- **Marcador:** "Respetaste el nivel **7 de 9** veces (n = 9: muestra chica) · no respetarlo costó $412.000 (US$ 266)" (ilustrativo).
- **Una fila por tramo** (DS-4): "GOOGL · tramo 2 · rango US$ 322–330 del subyacente · declarado el 24/08 · ejecutado el 18/03 a US$ 326,40 implícito (precio pagado en pesos × ratio ÷ CCL del día), dentro del rango".
- **Marco macro:** tus tres condiciones con su texto literal y el estado que marcaste en la última revisión mensual ("Sigue · Cambió · No sé", con fecha). Si una dice "Cambió", la pantalla cita tu tesis: hay que repensar toda la cartera, no una posición. La app no lo evalúa: lo registra.
- **Gráfico anotado** por activo (DS-3): compras y ventas, tramos como bandas, invalidación y objetivos como líneas, PPC como escalera, hitos como líneas punteadas.
- **Invalidaciones con el cierre real.** Tus niveles son de cierre del subyacente en dólares, y tu `disciplina.md` pide no usar el último precio operado del CEDEAR. Por eso **el disparador 1 se activa solo con el cierre real del subyacente** (`cotizaciones.precio_usd_subyacente`, que ya existe). Con el subyacente implícito al CCL tipeado (precio en pesos × ratio ÷ CCL), la app solo avisa "cerca del nivel: cargá el cierre real del subyacente", sin activar nada. Las invalidaciones por evento las marcás vos.
- **Invalidaciones perforadas** con alerta y respuesta en un toque: "Respeté · Postergué (motivo) · Cambié el criterio (motivo)" (vida 2.4 #3), porque un recordatorio solo no cambia la conducta (H4.12).
- **Niveles que se movieron** (DS-13): "Invalidación de VIST corrida hacia abajo 1 vez (12/09: de 56 a 54 · motivo: '…')", con tu regla citada al lado.

**Diario (`/diario`, D-89):** lo que decidiste, por qué y cómo salió. Una vez anotada, una entrada no se edita: se corrige con enmiendas fechadas (H4.18). La mesa de decisión (4.13) es su puerta de entrada.
- **Modo rápido** (unos 30 segundos), el de siempre: qué hacés (una de tus alternativas, otra, o **"no hago nada"**, que también es una decisión), por qué (1 a 3 líneas), **cuándo lo revisás** (obligatorio), hasta 3 condiciones que te harían cambiar de idea (observables, con umbral y fecha) y cómo estás.
- **Modo completo**, solo cuando la decisión supera un tamaño que fijás vos (vacío hasta que lo pongas): rango esperado y pre-mortem ("es diciembre de 2027 y esto salió mal: ¿por qué?").
- **La revisión de una entrada** muestra el resultado contra tu rango, **contra tus dos varas**, SPY y quedarte en LECAP, en USD y en ARS, y **contra las alternativas que descartaste** (los contrafácticos de D): qué habría pasado con cada una, calculado con los precios reales que cargaste. Es un hecho histórico, no una recomendación. Sin puntajes ni etiquetas sobre vos.

**Teléfono:** una tarjeta por tramo y por entrada. El gráfico del activo ocupa el ancho, con zoom.

### 4.17 Rendimientos (`/rendimientos`) · fase 4

- **Dos preguntas, cada una con su medida** (DS-1, D-39): "¿Cuánto rindió tu plata?" → TIR en ARS y USD. "¿Tus decisiones le ganaron a tus varas?" → TWR. Con menos de 365 días, la renta variable muestra el % total sin anualizar; la renta fija, TEM y TEA realizadas.
- **Tus varas, siempre juntas** (DS-2, DS-12, D-40): un índice base 100 para tu cartera, **SPY en la sombra** (al CCL de cada día) y **LECAP en la sombra** (a la TEM de referencia que pegaste). "Cartera 106,1 · SPY en la sombra 108,3 · LECAP en la sombra 104,9" (ilustrativo). La sombra solo "compra" con tus aportes y retiros, para no contar la misma plata dos veces. Una fecha sin precio deja el cálculo en "sin dato", nunca interpolado.
- **Por decisión y por instrumento:** cada entrada del Diario con su sombra (✓ o –, con íconos y no con verde y rojo); TIR realizada por instrumento (spec §9); operaciones cerradas (DS-7); mapa de calor mensual y caída máxima (DS-8).
- **Movimientos reales del bróker** (D-52, CA-14): la importación periódica de movimientos de IEB, para que la TIR y los costos no trabajen con precios inferidos del PPP; costos del año por bróker (EX-10) y contribución de cada activo al período (EX-9).
- **Rutina de liquidez Mercado Pago ↔ FIMA** (DS-5, spec §9): TNA anunciada contra cobrada y TNA combinada neta del impuesto a los débitos y créditos **efectivamente cobrado** (si falta, "sin dato").

**Teléfono:** las dos preguntas son dos tarjetas; el índice va a todo el ancho; las tablas pasan a tarjetas.

### 4.18 Vida (`/vida/…`) · fase 5

Empieza por **Años** (4.14), que es la base de lo fiscal, y sigue con cuatro módulos, en este orden (D-90): **Impuestos** (parámetros con fecha y fuente, foto fiscal al 31/12 valuada con las tablas de ARCA, estimador de Bienes Personales, libro de rentas, paquete para tu contador; vida 2.2), **Legado** ("si me pasa algo", continuidad de pagos, dossier cifrado; vida 2.7), **Seguros** (pólizas, beneficiarios, brechas; vida 2.9) y **Retiro** (historia previsional y fase de retiro en los escenarios; vida 2.10). Todo lo impositivo es informativo y queda a confirmar con tu contador. Ninguna pantalla de la fase 5 se adelanta. Lo urgente del legado no espera a esta fase: se hace fuera de la app antes de escribir código (sección 5).

### 4.19 El resumen semanal por mail · después de la fase 4, si aprobás D-84

- **Asunto:** "Semana 42 · financiero +1,9% en pesos, −0,4% en dólares · nada que hacer".
- **Cuerpo, sin montos (por defecto):** el estado de la Revisión en cinco líneas, los disparadores activos (o "Ninguno."), el próximo vencimiento, los pendientes de datos y "Nada más pendiente. [Abrir la semana]".
- **Reglas:** llega aunque no hayas cargado ("Sin cargas esta semana; lo último es del vie 09/10"), porque en las semanas malas se mira menos (efecto avestruz, H4.11); sin adjetivos, como pide tu `disciplina.md`; cron de Vercel en UTC con `CRON_SECRET` (H4.17); cada envío queda en `revisiones`. En **Pausa** ("en pausa hasta el lun 02/11") llega sin números, y esos días no cuentan para la constancia.

---

## 5. Plan por fases

Respeta el orden del spec: cada fase funcionando, desplegada y validada con tus datos reales (`calidad.md` §7) antes de empezar la siguiente. La 1 se parte en 1a y 1b, y cada mitad se despliega aparte. Después de la 4 propongo una 5 (D-90). Hay dos filtros para todo lo que cambie de lugar:
- **D-60, para los hechos.** Antes de su fase solo entra lo que se pierde si no se guarda ese día: el CCL que tipeaste, quién leyó una captura y con qué modelo, la TNA que mostraba MP, la hora en que anotaste un nivel, los saldos del 31/12. Lo que se puede calcular después, espera.
- **D-99, para las vistas.** Una pantalla que el spec pone en una fase posterior no se adelanta por D-60, porque se calcula igual cuando llega. Adelantarla es una decisión tuya, con su costo en semanas a la vista.

Lo no desplegado no aparece en la app (D-69). Ninguna fase trae APIs de precios ni de brókers, ni recomienda nada.

### Calendario estimado

| Tramo | Duración | Fechas objetivo |
|---|---|---|
| Antes de escribir código | 1 semana | jue 08/10 → vie 16/10 |
| 1a · construir y desplegar | 6 semanas | lun 19/10 → vie 27/11 (en producción el lun 30/11) |
| 1a · validar con cargas reales | unas 3 semanas de calendario, porque diciembre tiene feriados | lun 30/11 → vie 18/12 |
| Margen hasta la foto del 31/12 | casi 2 semanas | hasta el mié 30/12 |
| 1b | 6 semanas + 1 de validación (+3 si aprobás D-99) | ene → feb 2027 |
| 2 · Contexto | 6 semanas + el primer cierre mensual real | mar → abr 2027 |
| 3 · Motor | 5 semanas | may → jun 2027 |
| 4 · Disciplina | 6 semanas | jul → ago 2027 |
| 5 · Vida financiera | un módulo por vez | desde sep 2027 |

La única fecha fija es el **último día hábil BYMA de 2026** (probablemente el mié 30/12). La que importa para esa foto es la de producción, no la de cierre de la 1a: desde el lun 30/11, la foto sale de la app aunque la validación siga. Todo lo que está después de la 1a es una estimación, y se recalcula al cerrar cada fase.

### Antes de escribir código (una semana, sin código)

- **Aprobar las 20 decisiones que bloquean el código** (6.1, las marcadas "Bloquea: Código"). Primero las que cambian el schema o los tests de la 1a:
  - D-35: desglose por intervalos y "sin atribuir";
  - D-62: tiempo activo;
  - D-102: cuentas de inversión, de consumo y mixtas.

  Conviene sumar ya dos de 6.2, que no frenan el código pero cambian el test de layout y la pantalla de Exposición:
  - D-100: tocables según el puntero, como enmienda a D-30;
  - D-101: qué netea cada vista de Exposición.

  Después, D-36, D-37, D-38, D-46, D-47, D-59, D-60, D-61, D-63, D-64, D-65 y D-67. Las de operación (D-54 a D-58) van en el punto siguiente.
- **Operación** (vida §5.1, 5.2, 5.3 y 5.6):
  - clave `sb_secret_…` (D-54);
  - Portfolio en una organización personal de Supabase, con email personal y TOTP de respaldo (D-55);
  - **visibilidad del repo** (D-56): el 08/10 decidiste dejarlo público (actualización de D-24). Si sigue así, el job del respaldo corre en un repo privado aparte o fuera de GitHub Actions (H3.10);
  - CODEOWNERS y protección de rama sobre `.github/`, `.claude/` y `.vscode/` (vida 2.3 #11);
  - Next 16 con `proxy` y dependencias con versiones exactas y en cuarentena (D-57).
- **Elegir el plan de esa organización (D-55).** Hay dos opciones:
  - **Pro:** hoy, unos US$ 25 por mes; confirmá el precio al contratarlo.
  - **Free:** tiene que quedar escrito que asumís tres riesgos. El proyecto se pausa después de 7 días de poca actividad, vacaciones incluidas. Supabase no hace respaldos diarios propios. Y el límite es de 2 proyectos activos (H3.7, H3.13).

  El respaldo propio de D-58 corre igual con cualquiera de los dos planes.
- **Validar con tus archivos reales, sin código:**
  - un Excel de IEB real: la fecha en B1 y el formato numérico de las celdas (D-37, D-61);
  - de qué captura sale FIMA (D-46);
  - si la captura de MP muestra la TNA y la fecha (CA-4, D-61, D-102);
  - si usás Reservas en Mercado Pago (D-72);
  - quién es el tomador del leasing y quién paga cada cuota (D-71). Solo se registra: no cambia el perímetro de D-03;
  - qué moneda de riesgo le asignás a YPFD (D-73).
- **Esta semana, fuera de la app:**
  - **Anotá en el calendario del teléfono el vie 13/11, vencimiento de S13N6,** con un aviso el vie 30/10, a 14 días, como la alerta del spec. La alerta formal y "Anotar destino" llegan con la fase 2, y el 13/11 todavía no va a estar ni la 1a.
  - **Paso 0 del legado** (de C), que es barato y urgente:
    - 2FA con códigos de respaldo en tu mail, GitHub, Vercel, Supabase, IEB, Galicia y MP;
    - un gestor de contraseñas con acceso de emergencia para quien elijas;
    - una hoja impresa que diga qué cuentas existen y a quién llamar, sin claves.

    El resto del legado espera a la fase 5 (D-92).
  - Si aprobás D-35, actualizá tu skill `cartera-cedears` para que use el mismo desglose. Si no, la Revisión va a mostrar números distintos de los de tu skill.

### Fase 1a · Núcleo mínimo: empezar a juntar historia

**Objetivo:** en producción el lun 30/11, para que la foto del 31/12 salga de la app con margen. La 1a es la fase 1 del spec (schema, carga, cartera en doble moneda, exposición con el leasing neteado) más lo irrecuperable. Nada más.

**Entra:**
- **Infraestructura:**
  - **Clave simple con el `proxy` de Next 16 (D-21, D-57).** Se verifica en cada Server Action y en cada Route Handler: Excel, cron y reporte del respaldo.
  - **Corte deja de estar en producción (D-01).** El despliegue de la 1a lo reemplaza en el proyecto `portfolio` de Vercel. Su código sale del repo después de ese despliegue, y el schema `corte` no se toca.
  - **Migraciones de la 1a (7.1).** Antes de aplicar la primera, una consulta de solo lectura confirma que la base tiene solo las tres cuentas; la guarda de la migración lo protege igual. Cada migración habilita RLS, otorga permisos, crea el trigger de auditoría y comenta todo lo que crea: ninguna tabla queda un rato sin RLS ni sin auditoría. Incluyen `confirmar_lote` y `revertir_lote` (con motivo). Después de cada una se regeneran los tipos.
  - **Archivos en Storage, en su ruta definitiva desde el primer pegado,** nombrados por su sha256. El job de borradores vencidos borra solo los objetos que ninguna carga referencia (D-63).
  - **Respaldo nocturno cifrado y fuera de GitHub (D-58),** funcionando antes de tu primer archivo real. Es `supabase db dump` en tres archivos (roles, schema y datos), con el bucket `cargas` y un CSV por tabla. Cada noche se restaura en la imagen `supabase/postgres` de la misma versión mayor, con `session_replication_role = replica` y `pg_dump` en una versión fija.
  - **CI con todo lo de `calidad.md` §5,** más la reconstrucción de la base de cero (§6).
  - **El contrato de toda función de cálculo es `{valor, formula, insumos, explicacion, etiquetas}`** (D-67), con un test que verifica que las etiquetas se propaguen.
- **Cargar (4.2):**
  - **Campos y zona de carga:**
    - CCL y cripto con eco, en campos que arrancan vacíos (CA-8, DB-10), y la referencia del CCL (EX-8, solo el campo);
    - **una sola zona para soltar o pegar** (CA-2);
    - Enter espera a que terminen todas las fuentes, y un botón aparte dice "Guardar sin X".
  - **Lectores:**
    - **Parser de IEB:** escala (D-12), saldo "Total" (D-13), DOLARUSA al dólar de IEB como diferencia de criterio con nombre (D-66), controles B2 y Subtotales (D-38, CO-3) y tolerancia según `numFmt` (D-37, CO-4).
    - **Capturas de Galicia, incluido FIMA** como cuotapartes × VCP (D-46): dos lecturas, y decide la aritmética (CA-3, D-36).
    - **Captura de MP:** dos lecturas de dos modelos distintos (D-36). Su TNA se guarda ese día, porque la usan CA-4 y D-102 (D-60).
  - **Bandeja (4.2.1):**
    - estados verificada, advertencia y error; el motivo es la opción que elegís, no un texto; "dejar pendiente" (CA-1, D-47);
    - "¿Entró o salió plata?" solo cuando un saldo **sube** más de lo que explica su rendimiento (CA-4). En una cuenta mixta, una baja queda como "salida a consumo, sin confirmar" (D-102);
    - conciliación con "Crear compra" (D-15, CA-10), compra del día en tránsito (D-19, CO-10) y aperturas (D-14);
    - alta de ticker en la misma pantalla, con la moneda de riesgo elegida por vos (D-73).
  - **Lo que no se ve:**
    - **borrador en el servidor** (D-63), del dispositivo donde empezaste;
    - **fecha de la fuente** (D-61): una captura sin fecha toma el momento del pegado, y si no coincide con el B1 del Excel aparece una advertencia;
    - **tiempo activo** (D-62), por tramos en cada dispositivo, que se cortan después de 60 s sin gestos. El lote guarda el tiempo activo y el de punta a punta.
  - **Las tres cargas válidas** (D-64), con "sin atribuir" calculado por intervalos entre observaciones frescas (D-35). Cuando llega la observación, se reescribe solo el rótulo del día viejo, no sus montos.
  - **Al costado:** nota del día, ligada al lote (DS-6); Deshacer (CA-9); el pie de cuadre, recalculado desde los hechos (D-66).
  - **En el teléfono, con el teclado abierto,** la barra "Guardar" queda arriba del teclado y la barra inferior se oculta (3.2).
- **Registro (4.3):**
  - el log por lote, con tiempo activo, tiempo de punta a punta y el dispositivo del que entró cada archivo; con esto se decide MO-6 en la 1b;
  - **revertir una carga o el lote** con motivo, solo si nada posterior depende de ellos, y Deshacer la reversión;
  - **Corregir un hecho** con motivo (D-17, nivel 2), con candado en las filas conciliadas (CO-3) e **Historial** en la traza.
- **Hoy (4.1):**
  - arriba de todo, el estado de los datos;
  - la frase (HO-1);
  - las dos tarjetas (D-03, HO-5), con "tomador del leasing: sin confirmar" como dato;
  - la línea "pesos financieros − deuda del leasing" (D-101);
  - Atención con los pendientes de datos, en un solo renglón en el teléfono;
  - el botón "Todavía no cargaste hoy";
  - el aviso de diciembre (D-76).
- **Cartera (4.5):**
  - **Formato:** tabla con prioridad de columnas entre 768 y 1279 px (D-68) y tarjetas debajo de 768 px (MO-1). Con puntero fino, filas de 28 px; con puntero grueso, de 44 px (D-100).
  - **Desglose:** las dos columnas "Activo / TC", en $ y en US$ (D-68), con una sola convención desde la compra (D-35).
  - **Cifras:** "sin dato" y suma parcial (D-65), precio viejo (CO-5) y el tipo de cambio de cada conversión (CO-7).
  - **Traza** con Historial y "¿Qué es esto?" (CO-1, D-67), y filtros.
- **Exposición en números (4.6):**
  - **Cifras:** largo, corto y neto (EX-1), con el capital informado del leasing (`pasivo_saldos`), y el test de moneda de riesgo (EX-2).
  - **Selector Financiero · Total,** cada vista con lo que netea escrito en su rótulo (D-101). En la 1a, la vista Total dice "sin dato", con la suma parcial a la vista (D-65, D-73), porque la moneda de riesgo de cada bien se elige desde la 1b.
  - **En el teléfono,** el cuarto lugar de la barra inferior es Exposición hasta que llega Evolución (D-69).
- **Datos (4.9):**
  - catálogo, con la clase y la geografía de cada partida de liquidez;
  - cuentas, con su perímetro: inversión, consumo o mixta (D-102);
  - bienes y valuaciones (D-04);
  - el contrato del leasing y su capital informado, con su archivo.

  Las columnas de entidades y pagador existen desde la 1a, vacías (D-59); sus pantallas llegan en la fase 2. El perímetro de cada cuenta, en cambio, se marca desde la 1a (Día cero, paso 1).
- **Ajustes:** tema, sesión y estado del respaldo.
- **Día cero (D-70):** el orden de 4.9.1, escrito en `carga-diaria.md`, sin pantalla propia.

**Espera a la 1b a propósito, aunque estaba en el borrador:** Evolución, los gráficos y la composición de Exposición, la ficha de activo, Pendientes como pantalla, el pie de cuadre en Hoy (en la 1a vive en Cargar), el borrador compartido entre dispositivos, el Día cero como lista de pasos, el botón Exportar y el pie de estadísticas del Registro. Todo eso se calcula desde lo que la 1a ya guarda, así que nada se pierde por esperar (D-60).

**El límite que hay que saber:** en la 1a, una carga se hace entera en un dispositivo. Si sacás las capturas en el teléfono, las pasás a la compu o cargás todo desde el teléfono. Pegar en el teléfono y terminar en la compu llega con el borrador compartido de la 1b.

**Criterio de salida:**
- **Todo `calidad.md` en verde.** En particular:
  - las invariantes "activo + TC + sin atribuir = total, exacto", "un mes es la suma exacta de sus días" y "una carga express entre dos completas no cambia el desglose del período", con fast-check;
  - el cuadre contra IEB al centavo;
  - "sin dato" nunca cero, con tests que borran cada insumo;
  - los dos tests de CO-7: falla un punto histórico convertido con el CCL de hoy, y falla una suma de ARS y USD sin convertir;
  - ningún número sin traza;
  - Lighthouse ≥ 90 en mobile;
  - axe sin violaciones serias;
  - el test cronometrado de la carga;
  - la revisión adversarial del código.
- **Layout (D-30 con D-100).** El test corre:
  - a 360, 390, 412, 768, 1024, 1279, 1280, 1600 y 2560 px, en claro y en oscuro;
  - con puntero grueso y con puntero fino;
  - en el viewport de `iPhone 13` (390 × 664), donde Hoy entra arriba del pliegue;
  - en Cargar, con el teclado abierto.
- **10 cargas reales completas, las 10 por debajo de 60 s de tiempo activo** (D-62). El Registro muestra también el tiempo de punta a punta. Con 10 cargas, el p95 es prácticamente la más lenta, así que se dice así.
- **Las últimas 3 noches con el respaldo restaurado y verificado** en la imagen de Supabase.
- **Tus números revisados contra IEB, Galicia y MP** (`calidad.md` §7). Cada diferencia de criterio tiene su nombre y su monto (D-66).

**Si no llega:** si al lun 14/12 la 1a todavía no está en producción, no se apura el código: preparás el **Plan B** (D-76). El 30/12 guardás el Excel y las capturas, y anotás el CCL y el cripto de ese día con su fuente. La primera carga se hace después, con esa fecha, y las aperturas quedan al 30/12 (4.9.1).

### Fase 1b · Núcleo completo

**Entra:**
- **Carga:**
  - borrador compartido entre dispositivos (D-63);
  - captura repetida, es decir, el mismo sha256 que una carga anterior (CA-5);
  - alias (CA-6) y escala recordada (CA-11);
  - "Hoy no operó el mercado" (ajuste a D-16);
  - pegar serie, con el CCL histórico (CA-13, D-48);
  - corpus sintético de capturas en un job nocturno (CO-13);
  - compartir desde el teléfono (MO-6), **solo si** el Registro muestra que las capturas salen de ahí. La app instalable cachea solo archivos estáticos, nunca HTML ni respuestas RSC, que contienen montos.
- **Confianza:**
  - **Pendientes (4.4, CO-8, D-41):** declarar el CCL de compra (CA-7), "Dar por visto" con motivo y un vencimiento de 90 días como máximo, y la conciliación de 30 días por cuenta.
  - **Datos que se vuelven viejos:** valuación con vencimiento (CO-11) y tres calendarios con fuente (D-45).
  - **Registro:** vista de auditoría filtrable, y al pie la constancia y los tiempos (CA-12, D-62).
- **Hoy:** el pie de cuadre; a un toque, el puente (HO-2), quién movió (HO-3) y el período (HO-7); el checklist del 31/12 desde el 01/12 (D-76); las valuaciones vencidas.
- **Evolución (4.7, D-05):**
  - **Gráfico:** la línea diaria en ARS y USD, con el capital aportado arrancando en el patrimonio de la primera carga.
  - **Puente del período,** con su cuadre recalculado desde los hechos. En la vista Total rigen dos reglas: la cuota que paga la empresa entra como aporte, y el efecto del CCL sobre un bien valuado en pesos va en TC, con su renglón propio.
  - **Tabla PnL por mes.**
  - **Notas del día** como banderitas.
- **Exposición, abajo del pliegue (4.6):**
  - el gráfico de largo y corto;
  - "¿y si el CCL sube [ ]%?", con el campo vacío;
  - el monitor de brechas;
  - la composición (EX-4), con el mapeo de la liquidez a la vista;
  - la concentración, con umbral solo si lo cargás (D-42);
  - la evolución de la exposición neta;
  - el treemap (EX-7);
  - la moneda de riesgo y la cadencia de cada bien (D-73, CO-11): con eso, la vista Total puede dejar de decir "sin dato".
- **Cartera:**
  - la ficha de activo, con el CCL de empate de LECAP y BONCAP (EX-5), el chip de CCL implícito (EX-8), y la TEM y la TEA netas;
  - la columna "rol en la tesis", desde 1600 px.
- **Tesis como datos (4.9.2, D-51, DD-5):**
  - importar `tesis.md` y `calendario.md` como documentos (D-77), con el cruce contra tu cartera;
  - la tesis marcada como vigente o histórica;
  - la canasta con roles, que es la base de las bandas;
  - el marco macro como texto;
  - niveles que no se editan desde la importación (DS-13).
- **Datos:** feriados, alias, documentos (D-77), el botón Exportar y el recordatorio mensual (CO-15), y el Día cero como lista de pasos (D-70).
- **Ajustes:** umbrales, todos vacíos (D-42), incluida tu banda neutra (HO-5); modo privado (MO-3); paleta daltónica (MO-5).
- **Mobile:** gráficos que se transforman (MO-4), y selectores de más de tres opciones en una hoja inferior (3.2).
- **Ayuda (D-78):** los docs del repo, el manual por ritual y el glosario en contexto (D-67).

**Por qué la tesis entra en la 1b, y solo como datos.** La hora en que anotaste un nivel no se reconstruye después (D-60): cuanto antes esté cargada, antes empieza tu historia de disciplina. Pero bandas, disparadores, veredicto, Revisión, marcador y Diario se calculan desde esos datos cuando llegan, así que siguen en la fase 4, como manda el spec.

**Si aprobás D-99** (adelantar parte de la fase 4 a la 1b), entran también:
- la **Revisión semanal** (4.8, D-74);
- **tus bandas** en Exposición (EX-3);
- la **línea de veredicto** en Hoy, con los disparadores que se pueden evaluar con los datos de la 1b.

Cuesta unas **3 semanas más en la 1b** (estimación), y corre lo mismo todo lo que sigue, incluido el Motor que pediste. Sin D-99, nada de eso aparece hasta la 4.

**Criterio de salida:**
- **`calidad.md` completo** para todo lo nuevo, con el mismo test de layout de la 1a.
- **La importación de tu tesis revisada por vos.** Los conteos de 4.9.2 coinciden con tu archivo, y el cruce tesis/cartera está marcado entero.
- **La bandeja, con una mediana de 1 advertencia por carga o menos en las últimas 4 semanas.** Cuentan las cargas de la 1a, así que no hay que esperar.
- **Una carga real empezada en el teléfono y terminada en la compu,** con la misma bandeja y el tiempo activo bien sumado.
- **El puente de un mes real, con Cuadre ✓ en ARS y en USD.** "Sin atribuir" es lo pendiente al final menos lo pendiente al principio (D-35).
- **Un respaldo restaurado que incluye las tablas nuevas.**
- **Si aprobaste D-99, tres revisiones semanales hechas en la app.**

### Fase 2 · Contexto

**Antes de empezarla:** definir con tu contador qué es el monto fijo en pesos (D-82), el régimen fiscal y a nombre de quién se cobran los USD (D-83). Hacer la segunda pasada de investigación sobre todo lo "a confirmar" (D-87).

**Entra (spec §5, §6 y §10, y nada más):**
- **Pasivos (4.11):**
  - el cuadro de marcha con quién pagó cada cuota (H8.3);
  - la cuota en ARS y en USD en el mismo eje, indexada a 100;
  - el capital informado contra el del cuadro de marcha, y la TEA implícita (EX-6);
  - pagado y faltante, en las dos monedas;
  - la licuación;
  - las tres lentes (EX-6);
  - el escudo fiscal de la empresa, rotulado;
  - la opción de compra, y el costo total contra el valor del bien.
- **Entidades (D-59, D-71):** las pantallas de "vos y tus empresas", con el tomador y el pagador del leasing. D-71 registra; el perímetro sigue siendo el de D-03.
- **Flujo y cierres (4.12):**
  - el cierre mensual por diferencia de saldos (D-79), con las cuentas de consumo y las mixtas: las salidas de una mixta se confirman como retiros implícitos de un toque (D-102);
  - el precio efectivo de venta del cripto (`cripto_venta_usado`, H5.4);
  - recurrentes con regla de ajuste y provisiones;
  - tres lentes, sin una por defecto (D-80);
  - la tarjeta, opcional (D-81);
  - la naturaleza del ingreso fijo y la cuenta corriente con cada empresa (D-82, vida 2.8 #2).
- **Calendario con alertas (4.13):**
  - vencimientos con lo esperado contra lo cobrado (PR-14), cupones, cuotas, hitos importados, fechas fiscales, técnicas y de seguros (D-93), y exportación `.ics`;
  - la alerta del spec: vencimiento a menos de 15 días sin destino, con **"Anotar destino"** (D-75); y hito a 10 días o menos.
- **En Hoy:** el excedente real del mes; en Atención, los próximos vencimientos y sus alertas; "Hoy toca".
- **En Ajustes:** meses de cuota cubiertos por tu liquidez y meses de reserva. Vacíos hasta que pongas tu número: son controles tuyos, no recomendaciones (EX-3, vida 2.6 #6).
- **La captura del 31/12 (D-76).** Se activa el ítem del checklist que depende de esta fase (4.14): el capital del leasing al 31/12, informado por la leasera. La cuota de diciembre con su pagador y el cierre de diciembre quedan guardados en Pasivos y en Flujo. Así, cuando llegue Años, la foto tiene todo.

**No entra, para que la fase 3 no se atrase:**
- Años, el cierre anual y el archivo (fase 5);
- la mesa de decisión (fase 4);
- el mail y la Pausa (después de la 4, D-84);
- la importación de movimientos de IEB, los costos del año y la contribución por activo (fase 4, con Rendimientos);
- la cartera "al día X", Reprocesar y la metodología (fase 5).

**Criterio de salida:**
- **El primer cierre mensual real, en 10 minutos o menos,** con el "no explicado" a la vista.
- **El capital del leasing según el cuadro de marcha concilia contra el último informado,** o la diferencia tiene nombre.
- **Las alertas del spec, probadas con las fechas reales de tu calendario.**
- **Un vencimiento que se tilda solo** al conciliar lo cobrado: con el fixture y, si cae alguno real durante la validación, con ese.
- **Pasivos y Flujo revisados** contra el contrato, la leasera y tus cuentas (`calidad.md` §7).

### Fase 3 · Motor

**Entra:**
- **D-08 completo:** Baja · Igual · Sube, deslizantes con el valor recordado por variable, y tramos.
- **La tabla de "Igual" de D-88**, donde ninguna fila pide un dato que no tengas:
  - la TEM de cada bono es la implícita a su precio de hoy;
  - la reinversión de cada vencimiento es una variable;
  - las volatilidades arrancan vacías y figuran en "faltan";
  - ν, corridas y semilla llevan los valores técnicos declarados en D-88;
  - el horizonte arranca vacío o en el fin de tu tesis vigente, rotulado.
- **Cada partida tiene su clase en el motor,** a la vista en Datos y en la traza.
- **El Monte Carlo** es t-Student reproducible (sfc32, D-31) y corre en un Web Worker. Cubre PR-1 a PR-11.
- **Escenarios:** anclados (D-43); con la lente "pesos de hoy" y la base punteada (D-44); comparación de 2 o 3 (PR-4) y vista Estrés en los dos sentidos (H6.6).
- **Cobertura de la cuota con la definición de D-49:**
  - mediana de los 12 meses anteriores;
  - en dólares y sin aportes;
  - resultado total;
  - el primer mes evaluable es el que cierra 12 meses desde tu primera carga.
- **El futuro en Evolución,** con el PnL proyectado sobre la corrida mediana (PR-9).
- **En Hoy, "estás en el percentil N"** (PR-11).

**No entra:** armar escenarios desde la mesa de decisión. Para comparar supuestos están los escenarios del spec §7 (D-98).

**Criterio de salida:**
- **El Monte Carlo coincide con la referencia en numpy** (cuantiles tipo 7).
- **Menos de 200 ms al mover un deslizante.**
- **La misma semilla da el mismo resultado** en el servidor y en el navegador.
- **Pasa el test de neutralidad:** ningún supuesto a futuro arranca con valor, ninguna fila de "Igual" pide un dato y las volatilidades vacías bloquean la proyección.
- **La cobertura de la cuota coincide con un caso calculado a mano,** incluido el primer mes evaluable.

### Fase 4 · Disciplina

**Entra:**
- **Tesis y niveles completo (4.16, spec §8):**
  - el marcador;
  - una fila por tramo (DS-4);
  - el gráfico anotado (DS-3);
  - el marco macro con el estado que marcás vos;
  - las invalidaciones evaluadas **solo con el cierre real del subyacente**; con el precio implícito, solo "cerca del nivel";
  - la respuesta en un toque a una invalidación perforada;
  - los niveles que se movieron (DS-13).

  Todo, contra tu tesis vigente.
- **Tus bandas (EX-3),** contra la canasta. En Cartera, peso contra banda y distancia a la invalidación, desde 1600 px.
- **Línea de veredicto** en Hoy (D-53, DD-9), con los siete disparadores: "revisé N · M sin evaluar", donde una regla sin evaluar nunca cuenta como revisada.
- **Revisión semanal (4.8, D-74),** con el formato de tu skill: solo los disparadores activos, y cinco líneas cuando no hay ninguno. La primera del mes suma el chequeo de los fundamentos y del marco macro.
- **Diario que no se reescribe (D-89) y mesa de decisión v1 (D-85):**
  - las alternativas, escritas por vos, se guardan con la decisión;
  - las reglas de neutralidad tienen su propio test;
  - al pie, el recordatorio de tu `disciplina.md`;
  - la proyección que viste queda congelada como evidencia (DD-3, D-103);
  - la revisión de cada entrada compara contra tus varas y contra las alternativas que descartaste.
- **Rendimientos (4.17, spec §9):**
  - TIR y TWR (D-39);
  - SPY y LECAP en la sombra (D-40);
  - TIR por instrumento, operaciones cerradas (DS-7) y mapa de calor (DS-8);
  - la importación periódica de movimientos de IEB (D-52, CA-14), los costos del año (EX-10) y la contribución por activo (EX-9);
  - la rutina MP ↔ FIMA (DS-5).
- **Modo calma** (DS-9), como opción del menú.

**Criterio de salida:**
- **La TIR es igual a la de la referencia** en numpy/scipy.
- **Las sombras no cuentan dos veces la misma plata.**
- **Ninguna entrada confirmada del Diario se puede editar.**
- **El disparador 1 no se activa sin el cierre real del subyacente.**
- **Pasa el test de neutralidad de la mesa.**
- **Una revisión semanal real hecha en la app,** comparada con la de tu skill.

**Después de la 4, si los aprobás:**
- el resumen semanal por mail, con Pausa (D-84, 4.19);
- el acceso de solo lectura para que tu skill lea la app (D-50, DS-10).

### Fase 5 · Vida financiera (propuesta, D-90)

**Primero, Años (4.14, D-86):**
- el cierre del año, que se congela en enero o después;
- la foto guarda su huella como evidencia y nunca como insumo de un cálculo (D-103);
- el archivo legible sin la app, con su test de ida y vuelta;
- el test de no regresión;
- "Por años" en Evolución;
- la cartera "al día X" (CO-12);
- Reprocesar (CO-13);
- la metodología que se escribe sola (CO-14);
- en Hoy, "Si hoy fuera 31/12".

Después, en este orden: Impuestos, Legado, Seguros y Retiro (4.18). Con Impuestos entra también tu participación en cada empresa, con su valuación fechada (vida 2.8 #4), como dato y sin sumarla al patrimonio (D-96).

**Además:**
- **La cadena del cobro en USD, con comisión, timing y spread** (vida 2.5 #1, #2 y #7; H5.8). Va acá y no en la 2 porque el cierre mensual de la 2 ya confirma el precio efectivo de venta (`cripto_venta_usado`), y con eso alcanza para el excedente real.
- **Los lotes FIFO de USD y de stablecoins** (vida 2.5 #4).

La declaración de Bienes Personales del período 2026 llega antes que esta fase. Para esa, la app aporta lo que guardó desde la 1a: el Excel y las capturas del 30/12 con su sha256, y el CSV de los hechos.

### Qué queda afuera a propósito

- **Registrar gastos todos los días y categorizarlos.** El consumo sale del cierre mensual por diferencia de saldos (H1.11, H1.13, D-79).
- **Rachas, medallas, confeti y puntajes.** La única recompensa es la frase del día. Tampoco hay rojo por días sin cargar.
- **Recordatorio diario por push** (DA-9): queda postergado hasta que lo pidas (D-97).
- **Un tercer nivel de patrimonio "con tus empresas"** (de C): D-03 queda en dos niveles. La tabla de entidades sirve para saber de quién es cada cosa, no para sumar otro patrimonio (D-96).
- **Alternativas proyectadas lado a lado en la mesa** (la v2 de D), y también un botón que arme escenarios desde la mesa: rozan "sin recomendaciones". Para comparar supuestos usás los escenarios del spec §7 (D-98).
- **Puntaje de Brier y matriz proceso × resultado** en el Diario: son pesados para empezar. La revisión de cada decisión compara contra tu rango, tus varas y tus alternativas descartadas (D-89).
- **Cualquier API de precios o de brókers,** sincronización automática e intradiario (spec, D-07).
- **Textos generados por IA sobre tu cartera.** La frase es determinística; la IA solo lee capturas.
- **Marcas del REM o de tu historia junto a los deslizantes** (PR-15, vida §5.18; D-95).
- **Para después de la 4, si los pedís:**
  - Sankey del flujo (PR-12);
  - la liquidez de los próximos 60 a 90 días (PR-13);
  - el CCL de empate de bonos CER y duales (EX-5);
  - el recorte de la captura al lado del número (CO-2);
  - la paleta Ctrl+K;
  - "¿qué le hubiera pasado a mi cartera en 2018?" (vida 2.6 #9).
- **Cachear tus números en el dispositivo para usarla sin conexión.** La app instalada cachea la interfaz, no tus datos.
- **Liquidar impuestos.** La fase 5 informa y arma paquetes para tu contador.
- **Tortas, max-width y scroll horizontal,** en ninguna pantalla.
- **Recomendaciones de cualquier tipo, incluidas las disfrazadas:**
  - valores sugeridos en los escenarios;
  - umbrales por defecto;
  - un número "recomendado" de meses de reserva (el control existe desde la fase 2, vacío hasta que pongas tu número).
- **Adelantar una vista de una fase posterior sin una decisión tuya.** Solo se adelantan los hechos irrecuperables (D-60); una vista, solo si aprobás D-99.

---

## 6. Decisiones para aprobar

Es una sola lista, numerada y ordenada según cuándo bloquea. Junta, sin duplicados:
- las propuestas D-35 a D-53 de la investigación de mercado;
- las 22 de la investigación de vida financiera (vida §5.N);
- las que salen de los diseños (DA-, DB-, DD- y la regla de C);
- las cinco que agregó la revisión adversarial del borrador (D-99 a D-103).

D-35 a D-53 conservan su número; las demás siguen desde D-54. Cada fila dice qué recomiendo y por qué, en una línea. Cuando las apruebes, pasan a `docs/decisiones.md` con estado D, en el mismo commit que los documentos que tocan (6.9). Las rechazadas quedan anotadas con su motivo, para que no vuelvan.

**Qué bloquea la fase 1:**
- **6.1 (20 decisiones):** se aprueban antes de escribir la primera línea de código.
- **6.2 (10):** antes de cerrar y desplegar la 1a. No frenan el código.
- **6.3 (8):** antes de empezar la 1b.

El resto espera a su fase.

**Columna "Bloquea":**
- **Código:** hay que aprobarla antes de escribir código de la 1a.
- **1a:** hace falta antes de cerrar la 1a.
- **1b**, **2**, **3**, **4**, **5:** la fase que la necesita.
- **Después de la 4:** todavía no tiene fase asignada.

Las marcadas **"Pregunta para vos"** no tienen una opción que yo pueda recomendar, porque piden un dato que solo vos sabés.

**Para aprobar**, alcanza con contestar algo como "6.1 y 6.2 como están, D-99 no". Si algo no te cierra, nombrá su número.

### 6.1 Antes de escribir código (bloquean la 1a)

| Nº | Decisión | Recomiendo | Por qué, en una línea | Bloquea | Origen |
|---|---|---|---|---|---|
| D-35 | Convención del desglose activo/TC. La moneda de riesgo decide en qué vista aparece el efecto cambiario. Cada partida (un precio o un saldo) se desglosa por intervalos entre dos observaciones frescas. Lo que no tiene precio ni saldo nuevo, incluidos los saldos que no cargaste ese día, queda **"sin atribuir"** hasta su próxima observación | **Adoptar con agregados:** <br>• cuando llega la observación, el intervalo se desglosa entero con el CCL de sus dos puntas; <br>• la frase del día viejo cambia solo su rótulo, nunca sus montos; <br>• el desglose desde la compra usa la misma suma de intervalos, salvo el tramo anterior a la primera carga, que es un solo intervalo con el CCL de compra que declaraste; <br>• al mostrar, se redondea por resto mayor | Cada día suma exacto, un mes es la suma de sus días, Cartera y Evolución dan el mismo reparto y una carga express no le inventa un movimiento al CEDEAR | Código | D-35, revisión de ingeniería, revisión adversarial |
| D-36 | Lectura de capturas: dos lecturas en paralelo, `null` con motivo antes que adivinar, p95 ≤ 15 s de pegar a bandeja lista, imagen intacta | **Adoptar con cambios:** <br>• Galicia: dos lecturas distintas (otro recorte), y la aritmética decide; <br>• Mercado Pago, que no tiene control aritmético: dos modelos distintos, más plausibilidad; <br>• por carga se guardan el modelo, la versión del lector y el hash del prompt; <br>• las lecturas viven en el borrador del servidor (D-63) | Son las únicas fuentes no determinísticas, y donde no hay aritmética que los atrape, dos lecturas del mismo modelo repiten sus errores | Código | D-36, CA-3, H3.17 |
| D-37 | Tolerancia según la precisión mostrada: medio último dígito de cada factor, propagado | **Adoptar**, guardando con cada control los decimales que informó la fuente | Una tolerancia fija da falsas alarmas con 2 decimales, o deja pasar errores con precios cada 100 VN | Código | D-37, CO-4 |
| D-38 | Aserciones de saldo: B2 y los Subtotales de IEB y el total de Galicia son controles, y se reevalúan cuando cambia un hecho anterior | **Adoptar** | Hace visible y permanente el "cuadra con IEB al centavo" de `calidad.md`, y "no verificable" nunca es OK | Código | D-38, CO-3 |
| D-46 | FIMA es un FCI: cuotapartes × valor de cuotaparte. La suscripción es una compra y el rescate, una venta | **Adoptar.** Sale de la captura de Galicia: validarlo con una captura real antes del código | Su rendimiento sale del VCP, no de una TNA inventada | Código | D-46 |
| D-47 | Filas diferidas: una fila pendiente no se graba ni cuenta como venta, y la carga queda con `listado_completo = false` | **Adoptar con dos reglas:** <br>• Enter espera a que todas las fuentes terminen de leer, con un botón explícito "Guardar sin MP" al lado; <br>• una advertencia se acepta eligiendo una opción, y esa opción es el motivo: no hay que tipear | El Enter guarda lo verificado sin frenarte, sin inventar una venta y sin guardar nada en silencio | Código | D-47, CA-1 |
| D-61 | La fecha de los datos la da la fuente (B1 del Excel, la fecha de la captura), no el reloj | **Adoptar, con una regla más:** una captura sin fecha visible (la de MP) toma el momento del pegado, y si no coincide con B1 es una advertencia | Cargás a la mañana con los cierres de ayer sin escribir precios ni saldos en la fecha equivocada | Código | DA-3, B, CA-5 |
| D-62 | Cada lote mide su **tiempo activo**: la suma de los tramos con gestos en cada dispositivo, y un tramo se corta tras 60 s sin gestos. El Registro guarda el tiempo activo y el de punta a punta | **Adoptar.** Criterio de salida de la 1a: 10 cargas completas reales, las 10 por debajo de 60 s activos (con 10 cargas, el p95 es casi la más lenta) | Los 60 s se miden en tu vida real, y medir de punta a punta contaría la media hora entre el teléfono y la compu | Código | DA-2, DB-4, revisión adversarial |
| D-63 | Borrador de carga en el servidor (`carga_borradores`), que vence al día hábil siguiente y no lleva auditoría | **Adoptar**, como única excepción documentada al principio 4 de `datos.md`: <br>• en la 1a, el borrador es del dispositivo donde empezaste; desde la 1b se comparte entre dispositivos; <br>• desde el primer pegado, cada archivo va a su ruta definitiva, nombrada por su sha256; <br>• el job de vencimiento borra solo los objetos que ninguna carga referencia | La lectura guardada es la del servidor y no una que manda el navegador, y ninguna carga queda apuntando a un archivo borrado (D-17) | Código | DA-1, B (`lotes`), revisión adversarial |
| D-64 | Tres cargas válidas: express (tipos de cambio), media (+ Excel de IEB) y completa | **Adoptar** | Un día apurado sigue siendo un día con carga, y el CCL de ese día no se pierde | Código | A |
| D-65 | Un total al que le falta una parte es "sin dato", con la suma parcial rotulada debajo. Vale también para el neto total de Exposición | **Adoptar** | Lleva el "sin dato, nunca cero ni estimado" a los totales, donde se mezclaban bases | Código | B |
| D-67 | Toda función de cálculo devuelve `{valor, formula, insumos, explicacion, etiquetas}`: <br>• "¿Qué es esto?" sale de la función pura; <br>• las etiquetas ("viejo", "declarado", "inferido", "provisorio") se propagan, con un test que lo verifica | **Adoptar** (amplía `calidad.md` §2). El glosario en contexto llega en la 1b | No sos analista y tu skill pide explicar cada término; además, un número que hereda un dato viejo tiene que avisarlo solo | Código | B, D, DB-1 |
| D-102 | Cuentas desde las que vivís. Cada cuenta tiene perímetro: inversión, consumo o mixto (como MP). <br>• Una cuenta de consumo queda fuera del financiero. <br>• En una mixta, una baja es "salida a consumo, sin confirmar": nunca es resultado ni dispara una pregunta. <br>• El rendimiento del día es el que explica la TNA de la captura ("inferido"). <br>• El cierre del mes confirma las salidas como retiros implícitos, con un toque | **Adoptar.** "¿Entró o salió plata?" (CA-4) queda solo para las subas que la TNA no explica | Si no, cada gasto pagado desde MP se lee como pérdida de tus activos o te pregunta algo todos los días, y se pierden los 60 s | Código | revisión adversarial, H1.13, CA-4 |
| D-59 | Cimientos de schema en la 1a: <br>• monedas como dato; <br>• tipo de cambio en formato largo, con el catálogo del spec (`ccl`, `mep`, `cripto_venta`, `oficial`); <br>• entidades, perímetro (con mixto, D-102) y pagador; <br>• impuesto que admite vacío; <br>• lector versionado | **Adoptar con cambios:** <br>• se conserva el nombre `cripto_venta`; <br>• `activos.moneda_riesgo` sigue siendo un check (es riesgo, no unidad de cuenta); <br>• las columnas de entidades entran vacías, y sus pantallas llegan en la 2; <br>• las columnas fiscales finas esperan a la 5; <br>• cada migración nace con RLS, permisos, trigger de auditoría y comentarios | Con la base vacía cuesta una migración; con diez años de datos, una migración en dos pasos | Código | vida §5.5, H3.18, H8.3, B, C |
| D-60 | Regla de alcance: capturar hoy lo irrecuperable y calcular después lo derivable | **Adoptar**, como filtro para todo lo que se adelanta. Aplicada, la 1a queda en lo irrecuperable más la fase 1 del spec: <br>• pasan a la 1b: Evolución, la ficha de activo, el pie de cuadre de Hoy, los gráficos de Exposición, el borrador compartido y la lista del Día cero; <br>• la mesa de decisión pasa a la 4; <br>• Años y su archivo pasan a la 5 | Es el freno que evita que la 1a y la 2 se inflen y atrasen el motor que pediste, y protege lo único que no vuelve: los saldos del 31/12 | Código | C |
| D-54 | Migrar a una clave `sb_secret_…` | **Adoptar**, antes de la primera carga real | Las claves legacy de Supabase dejan de funcionar a fin de 2026, y con la base vacía el cambio es gratis | Código | vida §5.1, H3.12 |
| D-55 | Mover Portfolio a una organización personal de Supabase, con email personal y TOTP de respaldo | **Adoptar, en plan Pro** (del orden de US$ 25 por mes; confirmá el precio al crear la organización). Free, solo si aceptás sus riesgos por escrito. <br>En la misma semana, el paso 0 del legado, fuera de la app: <br>• 2FA con códigos de respaldo; <br>• gestor de contraseñas con acceso de emergencia; <br>• una hoja impresa con dónde está cada cosa | Tus datos no pueden depender de la cuenta de la empresa, y en Free el proyecto se pausa tras 7 días de poca actividad (alcanza un viaje), sin respaldos diarios y con un tope de 2 proyectos | Código | vida §5.2, H3.7, H3.13, C (paso 0), H7.15 |
| D-56 | Visibilidad del repo | **Pregunta para vos.** El 08/10 decidiste dejarlo público (actualización de D-24), y esa decisión manda: esta fila no la cambia. Si lo mantenés: <br>• el job del respaldo corre en un repo privado aparte o fuera de GitHub Actions; <br>• en el repo siguen sin entrar montos de posiciones ni archivos crudos (D-24). <br>Si preferís cambiarlo, pasa a privado y D-24 se actualiza. En los dos casos: protección de rama y CODEOWNERS sobre `.github/`, `.claude/` y `.vscode/` | En un repo público los cron de GitHub se apagan solos tras 60 días sin actividad, y sus logs y artefactos los ve cualquiera: eso define dónde corre el respaldo, y hay que saberlo antes del código | Código | D-24, vida §5.3, vida 2.3 #11, H3.10 |
| D-57 | Actualizar D-21 a Next 16 | **Adoptar:** <br>• `proxy`, y además la clave se verifica dentro de cada Server Action y de cada Route Handler (Excel, compartir, cron, reporte del respaldo); <br>• lint arreglado; <br>• versiones exactas y dependencias en cuarentena; <br>• si la app se instala, el service worker cachea solo archivos estáticos, nunca HTML ni respuestas RSC, que llevan montos | Next no hace backports, un cambio del matcher deja al `proxy` sin cobertura sin avisar, y npm es el mayor riesgo para que la app dure | Código | vida §5.6, H3.15, H3.16 |
| D-58 | Respaldo nocturno cifrado fuera de GitHub, con restauración verificada cada noche. Incluye el bucket `cargas` y genera un CSV por tabla | **Adoptar, con la receta de Supabase:** <br>• `supabase db dump` en tres archivos (roles, schema y datos), con pg_dump 17 fijo; <br>• se restaura en la imagen `supabase/postgres` de la misma versión mayor, con `session_replication_role = replica`; <br>• rol de lectura propio solo si Supabase permite `BYPASSRLS`; si no, la conexión `postgres` vive solo en el runner privado | Un respaldo que nunca se restauró no está probado, y uno restaurado en un Postgres común falla o queda vacío por los roles de Supabase | Código | vida §5.4, H3.7–H3.11, C |

### 6.2 Antes de cerrar la 1a (bloquean la 1a, pero no frenan el código)

| Nº | Decisión | Recomiendo | Por qué, en una línea | Bloquea | Origen |
|---|---|---|---|---|---|
| D-53 | Jerarquía de Hoy | **Adoptar con cambios:** <br>• hasta la fase 4, la primera línea es el estado de tus datos; <br>• desde la 4 (o la 1b, con D-99), va primero la línea de veredicto, que cuenta aparte lo que no pudo evaluar ("revisé 2 · 1 sin evaluar"); <br>• Atención va en una columna a la derecha desde 1280 px, y en un renglón en el teléfono; <br>• el excedente dice "sin dato · llega con Flujo (fase 2)"; <br>• el cuadre va al pie desde la 1b; <br>• el respaldo aparece solo si falla; <br>• "Hoy toca", desde la 2; <br>• en el menú, el modo privado (1b) y el modo calma (4) | La primera respuesta del día es si tenés que hacer algo, y las alertas tienen que estar en la primera vista desde 1280 px, el primer ancho de desktop que prueba el test de layout | 1a | D-53, DD-9, A, B |
| D-66 | Cuadre visible: compara el patrimonio de hoy, recalculado desde los hechos, contra el de ayer más cada parte de la frase, cada una con su fórmula. Las diferencias de criterio llevan nombre y monto (por ejemplo, DOLARUSA al dólar de IEB contra tu CCL: +$34.440) | **Adoptar.** En la 1a vive en Cargar; desde la 1b, también al pie de Hoy | Si una parte se calculara por diferencia, el ✓ saldría siempre. Así el control puede fallar, y una diferencia de criterio no parece un bug | 1a | DB-2, DB-3, CO-9 |
| D-68 | Pares ARS/USD y tablas anchas: <br>• el monto en USD va en una pastilla tintada; ARS, a la izquierda o arriba; <br>• en las tarjetas, la moneda de riesgo va grande; <br>• en Cartera, dos columnas de desglose (en $ y en US$); <br>• entre 768 y 1279 px, prioridad de columnas: lo que no entra va al detalle de la fila; <br>• las columnas de tesis, solo desde 1600 px | **Adoptar.** `stack.md` deja de pedir la columna del ticker fijada, y Playwright suma 1024, 1279 y 1600 px | Cumple "distinguibles sin leer el símbolo" y D-30, sin texto cortado ni scroll horizontal en ningún ancho, y cada columna se puede ordenar y totalizar | 1a | DA-7, DD-8, revisión adversarial |
| D-69 | Lo no desplegado no aparece en la navegación. Una cifra que depende de una fase futura dice "sin dato · llega en la fase N" | **Adoptar** | Sin puertas que no abren: la app crece con cada despliegue | 1a | DA-8, DD-10, DB-12 |
| D-70 | Día cero guiado: unos 40 minutos, una sola vez, en un orden fijo | **Adoptar.** En la 1a, el orden está escrito en `carga-diaria.md`; desde la 1b, Datos lo muestra como una lista de pasos | La primera semana decide si el hábito prende: el día 2 no puede haber pantallas vacías ni "sin dato" por todos lados | 1a | B, DA-11 |
| D-76 | La foto del 31/12: <br>• aviso en Hoy en diciembre (1a); <br>• checklist de 8 ítems en Atención desde el 01/12 (1b; los ítems están en 4.14); <br>• Plan B, si la 1a no llega a tiempo | **Adoptar.** Plan B: <br>• guardás el Excel y las capturas del 30/12; <br>• anotás el CCL y el cripto de ese día, con su fuente; <br>• la primera carga, con fecha pasada, crea las aperturas a la fecha del B1 | Protege la única foto anual que no se puede reconstruir, la que vas a necesitar para Bienes Personales | 1a (checklist: 1b) | C, D, H4.16 |
| D-100 | Tocables (enmienda a D-30 y a `calidad.md` §4): <br>• 44 px o más con puntero grueso o debajo de 1024 px; <br>• con mouse o trackpad, el objetivo es la fila entera, y la traza se abre con hover, foco o teclado | **Adoptar**, sumando este caso al test de layout | Con filas de 44 px no entran las 25 filas sin scroll que pide el spec; con 28 px y la fila como objetivo, sí, y en el teléfono no cambia nada | 1a | revisión adversarial, MO-2 |
| D-101 | Qué netea cada vista de Exposición: <br>• **Financiero:** "pesos financieros − deuda del leasing"; <br>• **Total:** eso más cada bien, en la moneda de riesgo que le elegiste; si a algún bien le falta, el total es "sin dato", con la suma parcial a la vista | **Adoptar**, con el mismo rótulo en la línea de Hoy | D-03 deja la deuda fuera del financiero: sin rótulo, la línea parece el financiero, y la camioneta de $38 M no puede entrar ni quedar afuera en silencio | 1a | revisión adversarial, EX-1 |
| D-72 | Separar Mercado Pago en disponible y Reservas | **Pregunta para vos.** Solo si usás Reservas y la captura las muestra por separado: serían dos cuentas, cada una con su perímetro (D-102). Si no, MP sigue siendo una cuenta mixta | Si no usás Reservas, no se complica nada | 1a | vida §5.12 |
| D-73 | La moneda de riesgo de YPFD y la de cada bien las elegís vos | **Adoptar.** La de YPFD, en el Día cero; la de los bienes, en la 1b. Un bien sin moneda de riesgo deja en "sin dato" el neto total de Exposición (D-101) | La app no asigna riesgo en silencio: que la casa esté valuada en dólares no la vuelve "riesgo dólar" | 1a (bienes: 1b) | B, D, revisión de ingeniería |

### 6.3 Antes de empezar la 1b

| Nº | Decisión | Recomiendo | Por qué, en una línea | Bloquea | Origen |
|---|---|---|---|---|---|
| D-99 | Adelantar a la 1b una parte de la fase 4: tus bandas, la evaluación de los disparadores, la línea de veredicto y la Revisión semanal | **No adelantar.** Si igual lo querés, cuesta unas 3 semanas más de 1b (estimación). Eso corre lo mismo la fase 2, que trae la alerta de vencimientos del spec, y la 3, el motor que pediste | Tu tesis entra en la 1b como datos y con su hora, así que no se pierde nada por esperar (D-60), y el spec ordena las fases | 1b (decidirla antes de empezarla) | revisión adversarial |
| D-41 | Pendientes (salud de datos): una lista con evidencia y un botón | **Adoptar con cambios:** "Dar por visto" pide un motivo y un vencimiento de 90 días como máximo | Ni avisos zombis ni avisos imposibles de apagar | 1b | D-41, DB-5, CO-8 |
| D-42 | Umbrales del dueño: tus bandas vienen de tu tesis, y el resto arranca vacío | **Adoptar.** <br>• Desde la 1b: top 1, top 3, exposición neta, % en un solo bróker y tu banda neutra. <br>• Desde la 2: meses de cuota cubiertos por tu liquidez y meses de reserva | Con el número que ponés vos, son controles tuyos y no recomendaciones (D-07) | 1b | D-42, EX-3, HO-5 |
| D-45 | Tres calendarios (BYMA, bancario y NYSE), cada uno con su fuente | **Adoptar.** En la 1a sigue la tabla actual | Deciden cosas distintas: si un precio está viejo, cuándo liquida algo y si cotizó el subyacente | 1b | D-45 |
| D-48 | Pegar serie: una herramienta periódica, fuera de los 60 s, que completa fechas sin fila y nunca pisa | **Adoptar.** Con el formato largo, la regla es por fecha y tipo. Primero, el CCL histórico | Resuelve el CCL histórico sin mezclar orígenes | 1b | D-48, CA-13 |
| D-51 | Tesis, tramos y objetivos importados de tu skill | **Adoptar con cambios:** <br>• entran en la 1b como datos, con la hora de la importación; <br>• la tesis se marca vigente o histórica, y solo la vigente evalúa algo; <br>• hay un cruce entre tesis y cartera; <br>• la canasta tiene objetivos por activo o por rol, y es la base de las bandas; <br>• el desvío de peso se evalúa solo con la canasta armada; <br>• el marco macro son tres condiciones, con un estado que marcás vos; <br>• los niveles no se editan: un cambio crea una versión nueva, con motivo; <br>• el disparador 1 se activa solo con el cierre real del subyacente; con el implícito, la app solo avisa "cerca del nivel" | Tu tesis y tu cartera no coinciden (en el ejemplo, $25 M contra unos $104 M); una LECAP que se rollea cambia de ticker pero no de rol; y tu `disciplina.md` pide el cierre real | 1b (la evaluación, en la 4) | D-51, DD-5, DB-6, DB-11, C, D |
| D-77 | Documentos como cargas sin filas: resumen anual de IEB, aviso RG 917 de FIMA, tasaciones, contrato del leasing, tu tesis y tu calendario | **Adoptar** | Guarda la evidencia desde el primer día, sin tablas nuevas | 1b | C |
| D-78 | Ayuda = los docs del repo renderizados, con buscador y un manual por ritual | **Adoptar** | Es la documentación completa que pediste, con una sola fuente de verdad | 1b | DA-10, C |

### 6.4 Para la fase 2

| Nº | Decisión | Recomiendo | Por qué, en una línea | Bloquea | Origen |
|---|---|---|---|---|---|
| D-71 | Leasing: quién es el tomador, si firmaste como fiador y quién paga cada cuota | **Pregunta para vos.** Mirarlo en el contrato; se registra junto con las entidades, en la fase 2. Mientras tanto: <br>• D-03 queda tal cual; <br>• Hoy muestra "tomador del leasing: sin confirmar" como dato. <br>D-71 solo registra: cambiar el perímetro pediría una decisión que reemplace a D-03 | Define quién paga cada cuota en Pasivos y si la cuota resta en tu Flujo, sin reabrir lo que pediste en D-03 | 2 | vida §5.7, H8.2, H8.14 |
| D-82 | Qué es el monto fijo en pesos (sueldo, honorarios, dividendo o retiro a cuenta) y cómo está la cuenta corriente con cada una de tus empresas | **Pregunta para vos:** definirlo con tu contador antes de la 2 | Sin esto, un retiro a cuenta se lee como ingreso e infla el excedente | 2 | vida §5.8, vida 2.8 #2, H8.15 |
| D-83 | Régimen fiscal y previsional, y a nombre de quién se cobran los USD | **Pregunta para vos:** definirlo antes de la 2 | Cambia cómo se registra el ingreso en USD | 2 | vida §5.9 |
| D-87 | Segunda pasada de investigación, con búsqueda web, para todo lo que dice "a confirmar" | **Adoptar**, antes de la 2 | Hoy, cobros, impuestos y perímetro se apoyan en fuentes secundarias | 2 | vida §5.22 |
| D-75 | Alerta de vencimiento y "Anotar destino" | **Adoptar, en la fase 2 con el Calendario** (no en la 1b): <br>• un vencimiento a menos de 15 días sin destino va a Atención; <br>• "Anotar destino" guarda una línea en `vencimientos.destino_decidido` y apaga la alerta | Es la alerta del spec §10 y alcanza para cumplirla; como S13N6 vence el 13/11, antes de que llegue la 2, anotalo hoy en el calendario de tu teléfono | 2 | DA-6, spec §10 |
| D-79 | Cierre mensual por diferencia de saldos, como fuente de verdad del consumo | **Adoptar**, con D-102 para las cuentas mixtas. El cierre confirma además el precio al que vendiste tus USD ese mes (`cripto_venta_usado`) | Es la única forma de tener un excedente real sin romper los 60 segundos | 2 | vida §5.11, H1.11–H1.13, H5.4 |
| D-80 | Índice y dólar por defecto para leer el consumo | **Ninguno por defecto:** lo elegís en el primer cierre | Un default sería la app eligiendo por vos | 2 | vida §5.13 |
| D-81 | Resumen de tarjeta todos los meses | **Opcional, dentro del cierre** | El cierre funciona sin él: el resumen solo explica el "no explicado" | 2 | vida §5.14 |

### 6.5 Para la fase 3

| Nº | Decisión | Recomiendo | Por qué, en una línea | Bloquea | Origen |
|---|---|---|---|---|---|
| D-88 | Qué significa "Igual" en cada variable, con rangos por dirección | **Adoptar la tabla de 4.15 como enmienda a D-08:** <br>• ninguna fila de "Igual" pide un dato que no tengas: la TEM de cada bono es la implícita a su precio de hoy, que sale de `flujos_bono`; <br>• se agrega la variable de reinversión de cada vencimiento; <br>• las volatilidades arrancan vacías y figuran en "faltan"; <br>• ν = 5, 10.000 corridas y una semilla sorteada al crear el escenario, que queda guardada: son valores técnicos declarados, no magnitudes de mercado; <br>• el horizonte arranca vacío, o en el fin de tu tesis vigente, rotulado así; <br>• el valor de Sube o Baja se recuerda por variable; <br>• cada partida tiene su clase en el motor | Saca la ambigüedad de los tres botones, cumple el "Igual no requiere definir nada" de D-08 y le da al motor una especificación que se puede testear | 3 | DD-7, revisión adversarial |
| D-43 | Escenarios anclados, con "Re-anclar" | **Adoptar con cambios:** además, la proyección que viste se congela al anotar una decisión (fase 4) y al congelar un año (fase 5), como evidencia (D-103) | Si el código cambia, el diario no puede mostrar algo distinto de lo que viste | 3 | D-43, DD-3 |
| D-44 | Lente "pesos de hoy" y comparación con base punteada | **Adoptar.** Si la inflación del escenario está vacía, "pesos de hoy" es "sin dato" | Mostrar solo nominales confunde riqueza con inflación | 3 | D-44 |
| D-49 | Mes de cobertura de cuota | **Adoptar con la definición de DD-6, precisada:** <br>• es el primer mes en que la mediana de los 12 meses anteriores del resultado mensual, **en dólares y sin aportes**, en esa corrida, alcanza la cuota en dólares de ese mes; <br>• la ventana es fija y puede incluir meses reales: con tu primera carga en octubre de 2026, el primer mes evaluable es septiembre de 2027; <br>• cuenta el resultado total, incluidas las ganancias no realizadas, y la caja lo dice; <br>• se muestran p10, p50, p90 y "% que no cruza"; <br>• si paga la empresa, dice "podría pagarla sola" | Un solo mes que cruza es ruido; en pesos nominales, una devaluación "pagaría" la cuota; y separar la renta pediría un supuesto nuevo | 3 | D-49, DD-6, revisión adversarial |

### 6.6 Para la fase 4

| Nº | Decisión | Recomiendo | Por qué, en una línea | Bloquea | Origen |
|---|---|---|---|---|---|
| D-74 | Revisión semanal con el formato de tu skill | **Adoptar:** <br>• el formato y el orden de tu skill; <br>• en Disparadores, solo los activos; si no hay, "Ninguno."; <br>• sin disparadores, la revisión termina en cinco líneas; <br>• los siete estados están a un toque, y "sin evaluar" nunca cuenta como "no activo"; <br>• "Acción sugerida" pasa a "Acción anotada"; <br>• la primera revisión del mes suma Fundamentos: marco macro y pilares, cada uno con "Sigue · Cambió · No sé" | Tu skill ya es tu ritual; la app le agrega datos verificados y memoria, sin sugerir nada | 4 (1b, con D-99) | DD-9 |
| D-39 | Dos medidas de rendimiento, TIR y TWR, cada una con su pregunta | **Adoptar** | No anualizar con menos de un año evita los errores de otros trackers | 4 | D-39, DS-1 |
| D-40 | Benchmarks en la sombra: SPY al CCL de cada día, y quedarte en LECAP | **Adoptar con cambios:** las dos varas van siempre juntas | Tu `disciplina.md` pide medirte contra la LECAP, no contra cero | 4 | D-40, DS-2, DS-12 |
| D-52 | Importación periódica de movimientos de IEB | **Adoptar, en la fase 4 con Rendimientos** (no en la 2) | Sin ella, la TIR y los costos trabajan con precios inferidos del PPP, y la TIR recién llega en la 4 | 4 | D-52, CA-14 |
| D-85 | Mesa de decisión v1: la pregunta y los hechos, tus reglas citadas, tus alternativas en texto y lo que decidís | **Adoptar, en la fase 4 con el Diario** (no en la 2): <br>• reglas de neutralidad, con su propio test; <br>• al pie, el recordatorio de tu `disciplina.md`: la app no reemplaza el asesoramiento financiero matriculado | Sus alternativas se guardan con la decisión, que llega en la 4, y para la 2 alcanza con "Anotar destino" (D-75) | 4 | DD-4, D |
| D-89 | Diario de decisiones que no se reescribe: se corrige con enmiendas fechadas. Modo rápido; el completo, solo por encima de un tamaño que fijás vos; sin Brier ni matriz | **Adoptar.** La revisión de cada entrada la compara contra tu rango, tus dos varas y las alternativas que descartaste, con los precios reales que cargaste | Sin inmutabilidad, el diario no sirve contra el sesgo retrospectivo; y comparar contra lo descartado es un hecho histórico, no un consejo | 4 | vida §5.16, H4.18, D |
| D-103 | Enmienda a D-23 y a D-43: la foto de un año congelado y las proyecciones congeladas se guardan con su huella | **Adoptar:** son evidencia y nunca insumo de un cálculo | Dentro de años vas a ver lo que viste entonces y no un recálculo con código nuevo, sin que eso compita con los hechos | 4 (años: 5) | revisión adversarial, DD-3, C |

### 6.7 Después de la fase 4

| Nº | Decisión | Recomiendo | Por qué, en una línea | Bloquea | Origen |
|---|---|---|---|---|---|
| D-90 | Fase 5, "Vida financiera" | **Adoptar, después de la 4:** <br>• empieza por Años y sigue con impuestos, legado, seguros y retiro; <br>• la cadena completa del cobro en USD (comisión, demora y spread) va acá, porque en la 2 alcanza con el precio efectivo de cada mes (D-79) | Impuestos tiene fechas duras, y el resto no compite con el hábito diario | 5 | vida §5.15, C |
| D-86 | El año se cierra en enero congelando los hechos, con la pantalla Años, un archivo legible sin la app, prueba de ida y vuelta y test de no regresión | **Adoptar, en la fase 5** (no en la 2) | Se calcula entero desde hechos ya guardados; lo único irrecuperable, la foto del 31/12, ya lo protegen la carga de siempre y D-76 | 5 | C, vida 2.3 #3, #4, #5, #12 |
| D-91 | REIBP, beneficio de cumplidor y Ganancias simplificada | **Pregunta para vos:** anotalo cuando lo sepas; se usa en la 5 | Solo cambia cálculos de la fase 5 | 5 | vida §5.10 |
| D-92 | Legado: destinatarios, acceso de emergencia, umbral 2 de 3 | **Postergar** el módulo a la 5. Lo urgente va con D-55, fuera de la app | Necesita su propio diseño de seguridad, y mientras tanto el piso son el paso 0 y el respaldo | 5 | vida §5.19, C |
| D-93 | Seguros: pólizas y valor asegurable | **Postergar** a la 5. Las fechas de renovación van en el Calendario de la 2 | Las fechas son baratas; el módulo, no | 5 | vida §5.20 |
| D-94 | Jubilación e historia previsional | **Postergar** a la 5 | Horizonte largo y carga alta | 5 | vida §5.21 |
| D-84 | Resumen semanal por mail, con Pausa | **Adoptar con cambios:** <br>• después de la fase 4, no en la 1b ni en la 2; <br>• sin montos por defecto; <br>• el día y la hora los elegís vos; <br>• llega aunque no hayas cargado; <br>• suma un proveedor de mail nuevo, con su clave solo en el servidor | No lo pediste, suma un tercero, y lo que resume, la Revisión, recién existe en la 4 | Después de la 4 | vida §5.17, DA-4, DA-5, DA-12, C |
| D-50 | Acceso de solo lectura para máquinas (tu skill leyendo la app) | **Postergar** hasta después de la 4. Cuando llegue: un token separado de tu clave, con alcance y vencimiento, revocable y auditado | Es una superficie externa nueva, y primero tiene que existir lo que leería | Después de la 4 | D-50, DS-10 |

### 6.8 Rechazadas o postergadas sin fecha

| Nº | Decisión | Recomiendo | Por qué, en una línea | Origen |
|---|---|---|---|---|
| D-95 | Marca del REM o referencias históricas junto a los deslizantes | **Rechazar** | Una magnitud al lado del control funciona como sugerencia (D-07, D-08) | PR-15, vida §5.18 |
| D-96 | Tercer nivel de patrimonio, "con tus empresas" | **Rechazar** | D-03 ya define los dos niveles que pediste, y las entidades (tu tesis menciona tres empresas) sirven para saber de quién es cada cosa | C (su D-55) |
| D-97 | Recordatorio diario por push | **Postergar** hasta que lo pidas | No lo pediste, en iPhone exige instalar la app, y el punto gris de Cargar ya avisa sin molestar | DA-9, H4.17 |
| D-98 | Alternativas proyectadas lado a lado en la mesa de decisión, y el botón "Comparar en Proyecciones" desde la mesa | **Rechazar los dos** | Proyectar tus alternativas es lo más cercano a una recomendación; para comparar supuestos están los escenarios del spec §7, que abrís vos | D (mesa v2), revisión adversarial |

### 6.9 Ajustes a decisiones y documentos existentes

Acepto los ajustes de la §6.2 de la investigación de mercado a D-03, D-04, D-05, D-06, D-10, D-12, D-13, D-14, D-15, D-16, D-17, D-18, D-24, D-30 y D-31, con las precisiones de abajo. Donde los dos textos difieren, mandan las precisiones. Todo se anota en el mismo commit que las decisiones nuevas.

**Decisiones**

- **D-01:** el despliegue de la 1a reemplaza a Corte en el proyecto `portfolio` de Vercel. El schema `corte` no se toca.
- **D-02:** el proyecto de Supabase sigue siendo el mismo, ahora en tu organización personal (D-55).
- **D-03:** se confirma tal cual.
  - D-71 solo registra tomador y pagador: cambiar el perímetro pediría una decisión que reemplace a D-03.
  - Qué netea cada vista de Exposición lo define D-101.
- **D-04:** además de la cadencia de revaluación, cada bien lleva la moneda de riesgo que le elegís vos (D-73), desde la 1b.
- **D-05:**
  - El puente suma la línea "sin atribuir" (D-35).
  - El cuadre compara el final, recalculado desde los hechos, contra el inicial más cada línea, y ninguna línea se calcula por diferencia. Reemplaza el "variación del patrimonio − aportes netos" de la investigación.
  - En la vista Total, cuando la cuota la paga la empresa, la baja de la deuda entra como aporte. El efecto del CCL sobre un bien valuado en pesos va en "Resultado por TC", con un renglón propio.
  - La parte histórica llega en la 1b, que sigue siendo fase 1.
- **D-06:** "¿Entró o salió plata?" aparece solo cuando un saldo sube más de lo que explica la TNA de la captura. Las bajas de una cuenta mixta no preguntan nada (D-102).
- **D-08:** la enmienda D-88.
- **D-16:** el botón "Hoy no operó el mercado" llega en la 1b. Ese día no cuenta para "viejo" y queda como una carga con su motivo.
- **D-17:**
  - **Revertir.** La unidad de reversión es la carga, como dice D-17: se revierte una carga sola o el lote entero. Reemplaza el "Deshacer revierte el lote entero" de la investigación.
  - **Dependencias.** Una carga se revierte solo si nada posterior depende de ella. Si algo depende, la reversión es manual y con motivo.
  - **Deshacer una reversión.** Se puede durante 10 s, y vuelve a aplicar las filas desde la auditoría.
  - **Corregir un hecho.** Pide el valor nuevo y un motivo, graba una carga `manual`, reevalúa los controles y respeta el candado de las filas conciliadas.
  - **Cuándo llega cada pieza.** El Historial en la traza, desde la 1a; la vista de auditoría filtrable, en la 1b; Reprocesar con un lector nuevo, desde la fase 5.
- **D-18:**
  - El último CCL aparece como texto de ayuda, nunca como valor propuesto: no se puede guardar un CCL que no tipeaste. Reemplaza el "último como valor propuesto" de la investigación.
  - Tu skill calcula el CEDEAR desde el subyacente y la app desde el precio del bróker. La diferencia se ve en el chip de CCL implícito.
  - Los niveles en US$ activan el disparador 1 solo con el cierre real del subyacente. Con el implícito, la app solo avisa. Reemplaza la última frase del ajuste de la investigación.
- **D-20:** la clave del servidor pasa a ser `sb_secret_…` (D-54). Tiene los privilegios de `service_role` y vive solo en el servidor.
- **D-21:** la actualiza D-57.
- **D-23:** la enmienda D-103.
- **D-24:** su actualización del 08/10 (el repo queda público) sigue tal cual, salvo que en D-56 elijas hacerlo privado.
- **D-30:** la enmienda D-100. Además:
  - en mobile no hay pestañas horizontales: con más de tres subpantallas, el título es un selector; con más de tres opciones, se usa una hoja inferior;
  - con el teclado abierto, se oculta la barra inferior;
  - Playwright suma los anchos 1024, 1279 y 1600 px, y el viewport de Safari en un iPhone 13 (390 × 664).

**Documentos**

- **`calidad.md` §1:**
  - La invariante pasa a ser "activo + TC + sin atribuir = total, exacto".
  - Se suman tres propiedades de fast-check: cada día suma exacto; un mes es la suma de sus días; una carga express entre dos completas no cambia el desglose del período.
  - Se suman los dos tests de CO-7, que tienen que fallar: un punto histórico convertido con el CCL de hoy y una suma de ARS y USD sin convertir.
- **`calidad.md` §2:** el contrato pasa a ser `{valor, formula, insumos, explicacion, etiquetas}` (D-67).
- **`calidad.md` §3:** los 60 s también se miden en las cargas reales, como tiempo activo (D-62).
- **`calidad.md` §4:** los tocables siguen D-100, y se suman los anchos nuevos de D-30.
- **`datos.md`, principio 4:**
  - `carga_borradores` es la única tabla sin auditoría (D-63), y `auditoria` no se audita a sí misma.
  - Cada migración nueva habilita RLS, otorga sus permisos, crea su trigger y comenta lo que crea.
- **`stack.md`:** la columna del ticker ya no se fija, y nunca hay scroll horizontal (D-68).
- **`carga-diaria.md`:** suma las tres cargas válidas (D-64), la fecha que da la fuente (D-61) y el orden del Día cero (D-70).

**Fuera de la app**

- Actualizar tu skill `cartera-cedears` (§3, "Descomposición peso/dólar") para que use D-35.

---

## 7. Cambios de schema

Todo cambio es una migración nueva encima de las tres aplicadas: `init`, `permisos_servidor` y `cuentas_iniciales`. Cada cambio dice su fase (la de la sección 5) y la decisión de la sección 6 que lo pide. Si no aprobás esa decisión, el cambio no entra.

**Qué está verificado y qué no:**
- Los nombres de tablas, columnas, constraints y secuencias están verificados contra esas tres migraciones.
- El esqueleto de la 1a (M1 a M4 y M6, más un prototipo de `revertir_carga`) se aplicó sobre ellas en un Postgres 16 local. Ahí corrieron los checks, las FK, los permisos y una reversión desde la auditoría.
- `confirmar_lote`, `corregir_hecho` y `deshacer_reversion` son, por ahora, un contrato sin implementar.

### 7.0 Reglas para toda migración nueva

Valen para todas las fases. Salen de `docs/datos.md`, de D-20, D-32 y D-33, y de la revisión del borrador.

**Cómo se escribe una migración**
- **Una migración por cambio, en una transacción.** Nunca se edita una aplicada ni se corre SQL suelto que cambie el schema.
- **La migración que crea algo lo deja seguro en el mismo archivo.** Eso es:
  - RLS activada;
  - permisos explícitos y mínimos para `service_role` (D-33);
  - el trigger `auditar`;
  - un `COMMENT ON` por tabla y por columna (H3.20).

  Nada espera a una "migración de seguridad" del final, así que entre dos migraciones no queda ninguna tabla sin RLS ni sin auditoría. El trigger tiene dos excepciones: `auditoria`, que no se audita a sí misma, y `carga_borradores` (D-63).
- **Permisos tabla por tabla, nunca en bloque:**

  | Tipo de tabla | Permisos de `service_role` |
  |---|---|
  | Datos que se pueden revertir, y `carga_borradores` (el job los borra) | `select, insert, update, delete` |
  | Catálogos (`monedas`, `entidades`, `partidas_liquidez`) y `lotes` | Sin `delete` |
  | Registros que solo crecen (`lecturas`, `lote_tramos`) | `select, insert` |
  | `respaldos` | Sin `delete` |
  | Cada secuencia de identidad nueva | `usage, select` |

  Ninguna tabla da `truncate`, `references` ni `trigger`.
- **Funciones:**
  - se declaran `security invoker` y con `set search_path = public, pg_temp`;
  - llevan un `revoke all … from public, anon, authenticated` explícito y un `grant execute … to service_role`, también las auxiliares internas;
  - solo hay dos `security definer`: `registrar_auditoria()`, que ya existe, y `version_schema()` (M1), que devuelve la última versión aplicada y nada más.
- **Hallazgo de esta revisión: hoy toda función nueva nace ejecutable por `anon`.**
  - El `init` intenta evitarlo con `alter default privileges in schema public revoke … on functions from public`, pero esa línea no tiene efecto. Postgres da `EXECUTE` a `PUBLIC` como permiso por defecto global, y un default por schema no lo puede sacar.
  - Lo verifiqué en la base local.
  - M1 lo corrige con el default global, y un test lo vigila.

**Qué se guarda y cómo**
- **Montos en `numeric` sin precisión fija**, con checks que excluyen `NaN` e `Infinity`:
  - positivo: `x > 0 and x < 'Infinity'`;
  - con signo: `x > '-Infinity' and x < 'Infinity'`;
  - fracción: `x >= 0 and x <= 1`, que ya deja afuera `NaN`.

  Si una función recibe un monto dentro de un `jsonb`, el monto llega como texto y pasa por `leer_monto()`, que falla si recibe un número JSON. Las vistas devuelven texto (D-32).
- **Texto con check, nunca enums.** `NULL` significa "sin dato". Ningún precio, tipo de cambio ni valuación tiene un default.
- **No se guarda nada derivado:** ni la frase, ni el desglose, ni "sin atribuir", ni el tiempo activo, ni el resultado de un control, ni totales, ni excedentes. La única excepción son las fotos de evidencia (`cierres_anio` y `proyecciones_congeladas`). Guardan resultados con su huella, y ningún cálculo las lee (D-103).
- **Para cambiar la forma de una tabla, la tabla tiene que estar vacía.** Una guarda al principio de la migración lo verifica. Si la tabla tiene datos, la migración se reescribe en tres pasos: expandir, migrar y contraer (H3.19).

**Tests (`supabase/tests/`)**
- `run.sh` corre los controles de seguridad después de **cada** migración, no solo al final. Revisa RLS, trigger, permisos, comentarios y funciones.
- Esos controles imprimen `FALLA` cuando algo falta. Hoy, las consultas de "tablas sin RLS" y "tablas sin auditoría" de `schema_tests.sql` listan lo que encuentran, pero el runner pasa igual.
- El stub ya imita los privilegios por defecto reales de Supabase (D-33). Además, ahora crea `supabase_migrations.schema_migrations`, y `run.sh` registra ahí cada versión que aplica, como hace Supabase. De esa tabla lee `auditoria.schema_version`.

**Después de aplicar una migración**
- Los advisors de seguridad de Supabase (`get_advisors`) tienen que quedar limpios.
- El archivo local se renombra con la versión que registró Supabase.
- Se regenera `src/lib/database.types.ts`.
- En el mismo commit se actualizan `datos.md`, `CHANGELOG.md`, `decisiones.md` y, si la migración toca la carga, `carga-diaria.md`.

**Supuesto sin verificar: hoy la base tiene solo las tres cuentas.**
- Antes de aplicar M1, una consulta de solo lectura lo confirma.
- Igual, las guardas de M2 a M4 abortan si hay alguna carga.
- Si la 1a se aplicara con datos cargados, M2 a M4 se reescriben en tres pasos: expandir, migrar y contraer.

### 7.1 Fase 1a · seis migraciones

Es el momento más barato para cambiar la forma de las tablas (H3.18). Todo hecho apunta a una carga, así que sin cargas no hay hechos.

**M1 · `1a_funciones_y_auditoria`** (D-17, D-33, H3.20)

```sql
-- Funciones nuevas sin EXECUTE para PUBLIC. El "in schema public" del init no alcanza.
alter default privileges revoke execute on functions from public;

-- Auditoría: qué carga produjo el cambio, con qué acción y bajo qué versión del schema.
alter table auditoria
  add column accion         text check (accion in ('confirmacion','correccion','reversion','deshacer')),
  add column schema_version text;

-- service_role no puede leer supabase_migrations: esta función le da solo ese valor.
create function version_schema() returns text
language sql stable security definer set search_path = public, pg_temp as
$$ select max(version) from supabase_migrations.schema_migrations $$;
revoke all on function version_schema() from public, anon, authenticated;
grant execute on function version_schema() to service_role;

create or replace function registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_antes   jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_despues jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_fila    jsonb := coalesce(v_despues, v_antes);
begin
  if tg_op = 'UPDATE' and v_antes = v_despues then
    return new;
  end if;
  insert into auditoria (tabla, operacion, antes, despues, carga_id, accion, schema_version)
  values (tg_table_name, tg_op, v_antes, v_despues,
          -- la carga que está aplicando la función; si no hay, la de la fila
          coalesce(nullif(current_setting('app.carga_id', true), '')::bigint,
                   (case when tg_table_name = 'cargas' then v_fila ->> 'id'
                         else v_fila ->> 'carga_id' end)::bigint),
          nullif(current_setting('app.accion', true), ''),
          version_schema());
  return coalesce(new, old);
end $$;

-- Comentarios de lo que ya existe: de acá sale el datapackage.json del archivo anual.
comment on table  cargas is 'Una fila por fuente confirmada: un archivo, una captura o un tipeo. Origen de todo hecho (D-17)';
comment on column cargas.lectura_cruda is 'Lo que leyó el parser o el modelo antes de confirmar (D-11)';
-- … uno por cada una de las 27 tablas, las 3 vistas y sus 208 columnas, más las 2 nuevas.
```

**Por qué cambia el trigger de auditoría:**
- **Hoy toma la carga de la fila.** En un `DELETE`, esa fila es de la carga vieja. Ejemplo: recargás IEB y la carga nueva reemplaza a la de la mañana, borrando un saldo que ya no figura. La auditoría le atribuye ese borrado a la carga vieja, así que revertir la nueva no lo devolvería.
- **Desde M1 registra la carga que produjo el cambio**, que es lo que pide D-17. Las funciones de M5 fijan `app.carga_id` y `app.accion` para su transacción (`set_config(…, true)`), y el trigger los lee. En la tabla `cargas`, la carga es la propia fila.
- **`schema_version` sirve para detectar una migración en el medio:** con ella, una reversión sabe si hubo una migración después de la carga (M5). La lee `version_schema()`, porque `service_role` no tiene permiso sobre `supabase_migrations`, y no conviene dárselo: es un schema de Supabase. En la base local, una `revertir_carga` sin esa función falló por permisos.
- **En la base real, M2 prueba que el trigger funciona.** Su `insert into monedas` es la primera escritura auditada de la 1a. Si `version_schema()` no pudiera leer `supabase_migrations`, M2 fallaría entera, sin dejar nada a medias.

**M2 · `1a_monedas_y_tipo_de_cambio`** (D-59, D-48, EX-8, D-66)

```sql
do $$ begin
  if exists (select 1 from cargas) then
    raise exception 'Hay cargas: reescribir esta migración como expandir-migrar-contraer';
  end if;
end $$;

create table monedas (
  codigo         text primary key check (codigo ~ '^[A-Z]{3,5}$'),
  nombre         text not null,
  tipo           text not null check (tipo in ('fiat','stablecoin')),
  decimales      smallint not null check (decimales between 0 and 8),
  vigente_desde  date,                                -- NULL = sin dato
  vigente_hasta  date,
  sucesora       text references monedas(codigo),     -- redenominaciones
  factor         numeric check (factor > 0 and factor < 'Infinity'),
  check (vigente_hasta is null or vigente_desde is null or vigente_hasta >= vigente_desde),
  check ((sucesora is null) = (factor is null))
);
alter table monedas enable row level security;
grant select, insert, update on table monedas to service_role;
create trigger auditar after insert or update or delete on monedas
  for each row execute function registrar_auditoria();
comment on table monedas is 'Monedas de cuenta. USDT y USDC entran como filas en la fase 5 (D-59)';
insert into monedas (codigo, nombre, tipo, decimales) values         -- auditado: el trigger ya existe
  ('ARS', 'Peso argentino', 'fiat', 2),
  ('USD', 'Dólar estadounidense', 'fiat', 2);

-- Los checks ('ARS','USD') pasan a FK. Nombres reales de los constraints, verificados.
alter table operaciones drop constraint operaciones_moneda_check,
  add constraint operaciones_moneda_fk foreign key (moneda) references monedas(codigo);
alter table saldos_liquidez drop constraint saldos_liquidez_moneda_check,
  add constraint saldos_liquidez_moneda_fk foreign key (moneda) references monedas(codigo);
alter table movimientos_capital
  drop constraint movimientos_capital_moneda_origen_check,
  drop constraint movimientos_capital_moneda_destino_check,
  add constraint movimientos_capital_moneda_origen_fk  foreign key (moneda_origen)  references monedas(codigo),
  add constraint movimientos_capital_moneda_destino_fk foreign key (moneda_destino) references monedas(codigo);
alter table pasivos drop constraint pasivos_moneda_check,
  add constraint pasivos_moneda_fk foreign key (moneda) references monedas(codigo);
alter table bienes drop constraint bienes_moneda_valuacion_check,
  add constraint bienes_moneda_valuacion_fk foreign key (moneda_valuacion) references monedas(codigo);
alter table ingresos_fijos drop constraint ingresos_fijos_moneda_check,
  add constraint ingresos_fijos_moneda_fk foreign key (moneda) references monedas(codigo);
alter table gastos_fijos drop constraint gastos_fijos_moneda_check,
  add constraint gastos_fijos_moneda_fk foreign key (moneda) references monedas(codigo);
-- activos.moneda_riesgo NO cambia: dice a qué moneda expone un activo, no en qué se cuenta.

-- tipo_cambio pasa a formato largo. Conserva el nombre del spec; sus cuatro columnas
-- siguen existiendo en la vista.
drop table tipo_cambio;                                  -- vacía: la guarda lo asegura
create table tipo_cambio (
  fecha       date not null,
  tipo        text not null check (tipo in ('ccl','cripto_venta','mep','oficial','dolar_ieb')),
  valor       numeric not null check (valor > 0 and valor < 'Infinity'),   -- ARS por 1 USD
  referencia  text,                       -- qué CCL tipeaste: 'promedio', 'GGAL'… (EX-8)
  fuente      text not null check (fuente <> ''),
  carga_id    bigint not null references cargas(id),
  primary key (fecha, tipo)
);
create index tipo_cambio_carga on tipo_cambio (carga_id);
alter table tipo_cambio enable row level security;
grant select, insert, update, delete on table tipo_cambio to service_role;
create trigger auditar after insert or update or delete on tipo_cambio
  for each row execute function registrar_auditoria();

create view v_tipo_cambio with (security_invoker = true) as         -- montos como texto (D-32)
select fecha,
       (max(valor) filter (where tipo = 'ccl'))::text          as ccl,
       (max(valor) filter (where tipo = 'mep'))::text          as mep,
       (max(valor) filter (where tipo = 'cripto_venta'))::text as cripto_venta,
       (max(valor) filter (where tipo = 'oficial'))::text      as oficial
from tipo_cambio
group by fecha;
grant select on v_tipo_cambio to service_role;
comment on column tipo_cambio.fuente is '''tipeado'', ''Excel IEB, DOLARUSA'', ''serie pegada: <fuente>'' o la anotada en el Plan B (D-76)';
-- … y el resto de los comentarios de lo nuevo.
```

**Cómo queda `tipo_cambio`:**
- **Cada observación tiene su propia carga.** Si en la 1b pegás un CCL histórico, su origen no se mezcla con el cripto que tipeaste ese día. La clave `(fecha, tipo)` hace que pegar nunca pise un valor existente (D-48).
- **`cripto_venta` conserva el nombre del spec** y sigue mandando para el ingreso.
- **`dolar_ieb` es el dólar al que IEB valúa DOLARUSA.** Se lee del Excel y solo lo usa la diferencia de criterio contra B2 (D-66).
- **Sin D-59, M2 no corre** y `tipo_cambio` queda en formato ancho.

**M3 · `1a_lotes_cargas_y_borradores`** (D-61, D-62, D-63, D-36, H3.17, DS-6)

```sql
do $$ begin
  if exists (select 1 from cargas) or exists (select 1 from flujos_bono) then
    raise exception 'Hay datos: reescribir esta migración como expandir-migrar-contraer';
  end if;
end $$;

-- Un Enter = un lote. Se crea en el primer gesto; sin confirmar, no es un hecho (D-11).
create table lotes (
  id             uuid primary key,             -- también es la llave de idempotencia
  tipo           text not null check (tipo in ('diaria','datos','correccion')),
  abierto_en     timestamptz not null,         -- primer gesto, en cualquier dispositivo
  confirmado_en  timestamptz,
  check (confirmado_en is null or confirmado_en >= abierto_en)
);

-- Tiempo activo (D-62): un tramo se corta tras 60 s sin gestos. La suma se calcula.
create table lote_tramos (
  lote         uuid not null references lotes(id),
  dispositivo  text not null check (dispositivo in ('desktop','mobile')),
  desde        timestamptz not null,
  hasta        timestamptz not null,
  primary key (lote, dispositivo, desde),
  check (hasta >= desde)
);

alter table cargas
  drop constraint cargas_origen_check,
  add constraint cargas_origen_check check (origen in ('excel','captura','documento','manual')),
  add column lote               uuid not null references lotes(id),
  add column recibido_en        timestamptz,     -- momento del pegado o la subida
  add column fecha_en_fuente    date,            -- B1 o fecha visible; NULL = la fuente no muestra fecha
  add column archivo_sha256     text check (archivo_sha256 ~ '^[0-9a-f]{64}$'),
  add column dispositivo        text check (dispositivo in ('desktop','mobile')),
  add column tipo_documento     text check (tipo_documento in
    ('contrato','carta_acreedor','tasacion','resumen_anual','aviso_fci','tesis','calendario','otro')),
  add column corrige_a          bigint references cargas(id),
  add column motivo             text check (motivo in ('error_lectura','broker_corrigio','otro')),
  add column motivo_detalle     text,
  add column reversion_motivo   text check (reversion_motivo in ('lectura_equivocada','archivo_otro_dia','otro')),
  add column reversion_detalle  text,
  add constraint cargas_archivo_sha  check ((archivo_path is null) = (archivo_sha256 is null)),
  add constraint cargas_archivo_ruta check (archivo_path is null or archivo_path like 'archivos/' || archivo_sha256 || '%'),
  add constraint cargas_recibido     check (archivo_path is null or recibido_en is not null),
  add constraint cargas_documento    check ((origen = 'documento') = (tipo_documento is not null)),
  add constraint cargas_correccion   check ((corrige_a is null) = (motivo is null)
                                            and (corrige_a is null or origen = 'manual')),
  add constraint cargas_reversion    check ((estado = 'revertida') = (reversion_motivo is not null));
create index cargas_lote on cargas (lote);
create index cargas_archivo_sha on cargas (archivo_sha256);   -- no único: la captura repetida avisa (CA-5, 1b)

-- Quién leyó y cómo (H3.17). El contenido de cada lectura sigue en cargas.lectura_cruda.
create table lecturas (
  carga_id        bigint not null references cargas(id),
  nro             smallint not null check (nro in (1, 2)),
  lector          text not null check (lector in ('excel_ieb','vision')),
  lector_version  text not null,
  modelo          text,                        -- ID exacto; en MP, distinto en cada lectura (D-36)
  prompt_sha256   text check (prompt_sha256 ~ '^[0-9a-f]{64}$'),
  recorte         text,
  inicio          timestamptz not null,
  fin             timestamptz not null,
  primary key (carga_id, nro),
  check (fin >= inicio),
  check (lector <> 'vision' or (modelo is not null and prompt_sha256 is not null))
);

-- La bandeja entre el pegado y el Enter. No son hechos: sin trigger de auditoría (D-63).
create table carga_borradores (
  id              bigint generated always as identity primary key,
  lote            uuid not null references lotes(id),
  cuenta_id       smallint references cuentas(id),
  tipo_fuente     text not null check (tipo_fuente in ('excel_ieb','captura','tipeado')),
  dispositivo     text not null check (dispositivo in ('desktop','mobile')),
  archivo_path    text,                        -- ya en su ruta definitiva: archivos/<sha256>.<ext>
  archivo_sha256  text check (archivo_sha256 ~ '^[0-9a-f]{64}$'),
  lecturas        jsonb,                       -- las respuestas del modelo, tal como llegaron al servidor
  estado          text not null check (estado in ('leyendo','lista','fallida','descartada','confirmada')),
  error           text,
  carga_id        bigint references cargas(id),
  creado_en       timestamptz not null default now(),
  vence_en        timestamptz not null,        -- fin del día hábil siguiente
  check ((tipo_fuente = 'tipeado') = (archivo_path is null)),
  check ((archivo_path is null) = (archivo_sha256 is null)),
  check ((estado = 'confirmada') = (carga_id is not null)),
  check (vence_en > creado_en)
);
create index carga_borradores_lote on carga_borradores (lote);

-- La nota del día es del lote, no de una carga (DS-6).
alter table eventos
  drop constraint eventos_tipo_check,
  add constraint eventos_tipo_check check (tipo in ('balance','macro','otro','nota')),
  add column lote uuid references lotes(id),
  add constraint eventos_nota_lote check (tipo <> 'nota' or lote is not null);

-- El valor al vencimiento que pegás también tiene origen. Hoy la tabla está vacía.
alter table flujos_bono add column carga_id bigint not null references cargas(id);

alter table lotes            enable row level security;
alter table lote_tramos      enable row level security;
alter table lecturas         enable row level security;
alter table carga_borradores enable row level security;
grant select, insert, update         on table lotes            to service_role;
grant select, insert                 on table lote_tramos      to service_role;
grant select, insert                 on table lecturas         to service_role;
grant select, insert, update, delete on table carga_borradores to service_role;
grant usage, select on sequence carga_borradores_id_seq to service_role;
create trigger auditar after insert or update or delete on lotes
  for each row execute function registrar_auditoria();
create trigger auditar after insert or update or delete on lote_tramos
  for each row execute function registrar_auditoria();
create trigger auditar after insert or update or delete on lecturas
  for each row execute function registrar_auditoria();
comment on table lotes is 'Un Enter = un lote. Revertir el lote revierte todas sus cargas (CA-9)';
-- … y un comentario por cada tabla y columna nueva.
```

**Archivos (D-63):**
- Cada archivo va a su ruta definitiva desde el primer pegado: el bucket privado `cargas`, en `archivos/<sha256>.<ext>`. Storage no participa de la transacción de `confirmar_lote`, y así no hace falta moverlo al confirmar.
- Un job diario (cron de Vercel, con su propio secreto) hace la limpieza:
  - borra los borradores vencidos;
  - en Storage, borra los objetos de `archivos/` que tienen más de dos días y que ninguna fila de `cargas` ni ningún borrador vivo referencia.

  Así, `cargas.archivo_path` nunca apunta a un objeto borrado.

**Fecha de los datos (D-61):**
- `cargas.fecha` sigue siendo la fecha de los datos, y la decide la fuente.
- Una captura sin fecha visible deja `fecha_en_fuente` en `NULL` y toma el día de `recibido_en`. Si ese día no coincide con el B1 del Excel, aparece una advertencia.

**Correcciones y reversiones:**
- Una corrección es una carga `manual` con `corrige_a` y un motivo, que es una de tres opciones con detalle opcional (D-17, nivel 2).
- Una reversión guarda su motivo en la propia carga. Si después la deshacés, esas columnas vuelven a `NULL`, y la auditoría conserva el antes.

**Qué se calcula y qué se guarda en esta migración:**
- El estado de un lote se calcula desde sus cargas: un lote revertido es uno cuyas cargas están todas revertidas.
- `lotes.tipo` dice desde dónde entró el lote. Solo los lotes `diaria` cuentan para los 60 segundos.
- `cargas.dispositivo` se copia del borrador, y con él el Registro calcula "capturas desde el teléfono: 7 de 9" (MO-6).
- En la 1a, el borrador es del dispositivo donde empezaste. Compartirlo entre dispositivos (1b) no cambia el schema: es el mismo lote, abierto desde otro lado.

**M4 · `1a_controles_entidades_y_cuentas`** (D-37, D-38, D-59, D-60, D-71, D-102, DS-5, CA-10)

```sql
do $$ begin
  if exists (select 1 from cargas) then
    raise exception 'Hay cargas: reescribir esta migración como expandir-migrar-contraer';
  end if;
end $$;

-- Lo que dice la fuente para controlar. El resultado del control no se guarda:
-- se recalcula cuando cambia un hecho (D-23, D-38).
create table controles_cuenta (
  id                    bigint generated always as identity primary key,
  fecha                 date not null,
  cuenta_id             smallint not null references cuentas(id),
  tipo                  text not null check (tipo in ('ieb_b2','ieb_subtotal','galicia_total')),
  seccion               text check (seccion in ('Acciones','Bonos','Cedears','Otros')),
  moneda                text not null references monedas(codigo),
  valor_informado       numeric not null check (valor_informado > '-Infinity' and valor_informado < 'Infinity'),
  decimales_informados  smallint not null check (decimales_informados between 0 and 8),   -- D-37
  carga_id              bigint not null references cargas(id),
  check ((tipo = 'ieb_subtotal') = (seccion is not null)),
  unique nulls not distinct (fecha, cuenta_id, tipo, seccion, moneda)
);
create index controles_cuenta_carga on controles_cuenta (carga_id);

-- TNA y tope que muestra la captura de MP. Se guardan ese día: no se reconstruyen (D-60)
-- y los usan "¿Entró o salió plata?" y las cuentas mixtas (CA-4, D-102).
create table condiciones_cuenta (
  cuenta_id      smallint not null references cuentas(id),
  fecha          date not null,
  tna_anunciada  numeric check (tna_anunciada >= 0 and tna_anunciada < 'Infinity'),
  tope           numeric check (tope > 0 and tope < 'Infinity'),
  carga_id       bigint not null references cargas(id),
  primary key (cuenta_id, fecha),
  check (num_nonnulls(tna_anunciada, tope) >= 1)
);

create table entidades (
  id      smallint generated always as identity primary key,
  nombre  text not null unique,
  tipo    text not null check (tipo in ('persona','sociedad'))
);

-- Clase y geografía de cada partida de liquidez: composición (1b) y motor (3).
create table partidas_liquidez (
  cuenta_id  smallint not null references cuentas(id),
  moneda     text not null references monedas(codigo),
  clase      text not null check (clase in ('efectivo','remunerada')),
  geografia  text not null check (geografia in ('AR','US','BR','GLOBAL')),
  primary key (cuenta_id, moneda)
);

alter table controles_cuenta   enable row level security;
alter table condiciones_cuenta enable row level security;
alter table entidades          enable row level security;
alter table partidas_liquidez  enable row level security;
grant select, insert, update, delete on table controles_cuenta, condiciones_cuenta to service_role;
grant select, insert, update         on table entidades, partidas_liquidez        to service_role;
grant usage, select on sequence controles_cuenta_id_seq, entidades_id_seq to service_role;
create trigger auditar after insert or update or delete on controles_cuenta
  for each row execute function registrar_auditoria();
create trigger auditar after insert or update or delete on condiciones_cuenta
  for each row execute function registrar_auditoria();
create trigger auditar after insert or update or delete on entidades
  for each row execute function registrar_auditoria();
create trigger auditar after insert or update or delete on partidas_liquidez
  for each row execute function registrar_auditoria();

insert into entidades (nombre, tipo) values ('Vos', 'persona');
-- Tus empresas las das de alta en la fase 2, con su pantalla (D-59).

alter table cuentas
  add column entidad_id  smallint references entidades(id),
  add column perimetro   text check (perimetro in ('inversion','consumo','mixta'));   -- NULL = sin marcar
update cuentas set entidad_id = (select id from entidades where nombre = 'Vos');   -- cuentas_iniciales: "Cuentas del dueño"
alter table cuentas alter column entidad_id set not null;

alter table bienes add column entidad_id smallint references entidades(id);       -- NULL = sin dato

alter table pasivos
  add column tomador_entidad_id         smallint references entidades(id),        -- NULL = sin confirmar (D-71)
  add column garantia_personal          boolean,                                  -- NULL = sin dato
  add column titular_opcion_entidad_id  smallint references entidades(id),
  add column contrato_carga_id          bigint references cargas(id);             -- el contrato, como documento

alter table pasivo_cuotas
  add column pagador_entidad_id smallint references entidades(id),
  -- En un solo sentido: una cuota pagada tiene pagador; una futura PUEDE tenerlo.
  add constraint pasivo_cuotas_pagador check (fecha_pago is null or pagador_entidad_id is not null);

alter table movimientos_capital rename column impuesto to icyd_cobrado;
alter table movimientos_capital
  alter column icyd_cobrado drop not null,
  alter column icyd_cobrado drop default,          -- vacío = sin dato, no cero
  add column contraparte             text check (contraparte in ('exterior','entidad','tercero')),
  add column contraparte_entidad_id  smallint references entidades(id),
  add constraint movimientos_contraparte_entidad
    check ((contraparte is not distinct from 'entidad') = (contraparte_entidad_id is not null));

-- De dónde salió cada precio de costo: la etiqueta "inferido" o "declarado" sale de acá.
alter table operaciones
  add column precio_origen text check (precio_origen in ('broker','inferido','declarado')),
  add constraint operaciones_precio_origen check ((precio is null) = (precio_origen is null));
-- … y un comentario por cada tabla y columna nueva.
```

- **Perímetro (D-102).** Puede ser inversión, consumo o mixta, como MP. `NULL` significa sin marcar, y el Día cero lo pide en el paso 1.
- **Entidades (D-59).**
  - Las columnas entran ahora, con la base vacía. Las pantallas llegan en la fase 2.
  - La migración completa un solo dato: las tres cuentas son tuyas, como ya dice `cuentas_iniciales`.
  - El tomador del leasing queda en `NULL` = "sin confirmar".
  - D-71 solo registra quién es el tomador y quién paga. El perímetro sigue siendo el de D-03.
- **Pagador de cada cuota.** El check va en un solo sentido: una cuota pagada tiene que tener pagador, y una futura puede tenerlo o no. Que `cuenta_pago_id` sea de la entidad que pagó cruza tablas, así que lo valida `confirmar_lote` y lo cubre un test.
- **Contraparte de un movimiento.** El check usa `is not distinct from`. Con `=`, una contraparte `NULL` dejaba pasar cualquier entidad.
- **Impuesto a los débitos y créditos.** `icyd_cobrado` vacío significa sin dato, no cero: la TNA combinada de la fase 4 dice "sin dato" si falta.

**M5 · `1a_funciones_de_carga`** (`datos.md` reglas 3 y 4, D-17, D-19, CA-9, CO-3)

```sql
create function leer_monto(j jsonb) returns numeric ...              -- falla con un número JSON (D-32)
create function confirmar_lote(p_lote uuid, p jsonb) returns setof bigint ...
create function revertir_carga(p_carga bigint, p_motivo text, p_detalle text default null) returns void ...
create function revertir_lote(p_lote uuid, p_motivo text, p_detalle text default null) returns void ...
create function deshacer_reversion(p_carga bigint) returns void ...
create function corregir_hecho(p_tabla text, p_clave jsonb, p_valores jsonb,
                               p_motivo text, p_detalle text default null) returns bigint ...
-- Todas: language plpgsql security invoker set search_path = public, pg_temp.
revoke all on function leer_monto(jsonb), confirmar_lote(uuid, jsonb),
  revertir_carga(bigint, text, text), revertir_lote(uuid, text, text),
  deshacer_reversion(bigint), corregir_hecho(text, jsonb, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function leer_monto(jsonb), confirmar_lote(uuid, jsonb),
  revertir_carga(bigint, text, text), revertir_lote(uuid, text, text),
  deshacer_reversion(bigint), corregir_hecho(text, jsonb, jsonb, text, text)
  to service_role;
-- Ídem para las auxiliares internas (la que aplica una fila de la auditoría, por ejemplo).

-- Un hecho cambia solo con una carga nueva: así la auditoría siempre sabe quién lo cambió.
create function exigir_carga_nueva() returns trigger ...   -- falla si new.carga_id = old.carga_id
-- AFTER UPDATE, no BEFORE: pasivo_cuotas tiene una columna generada y un BEFORE no puede
-- compararla. En tipo_cambio, cotizaciones, indices, operaciones, saldos_liquidez,
-- movimientos_capital, pasivo_cuotas, pasivo_saldos, bienes_valuaciones, flujos_bono,
-- controles_cuenta y condiciones_cuenta.
```

`datos.md` anticipaba `confirmar_carga`. Pasa a llamarse `confirmar_lote`, porque un Enter confirma varias cargas. `revertir_carga` conserva su nombre, y se suma `revertir_lote`.

- **`confirmar_lote`** hace todo en una transacción:
  - **Es idempotente.** Si el lote ya tiene `confirmado_en`, devuelve sus cargas sin escribir nada: un doble Enter no duplica.
  - **Crea una carga por fuente.** `lectura_cruda`, las filas de `lecturas` y el dispositivo los copia desde `carga_borradores`, nunca desde lo que manda el navegador. El navegador manda solo el lote, lo que elegiste en la bandeja y los dos campos tipeados.
  - **Graba todo lo demás:** hechos, controles, tipos de cambio, TNA y la nota del día. Los montos pasan por `leer_monto()`. Los valores por defecto se ponen con `coalesce`, porque supabase-js manda `NULL` en lugar del default (`datos.md`, regla 3).
  - **Reemplaza la carga del mismo día y la misma cuenta**, que queda `reemplazada` (`carga-diaria.md`).
  - **Valida lo que cruza tablas**, como que `cuenta_pago_id` sea de la entidad que pagó.
  - **Deja la marca en la auditoría.** Antes de cada carga fija `app.carga_id` y `app.accion = 'confirmacion'`. Al final, marca los borradores como `confirmada` y el lote con `confirmado_en`.
- **`revertir_carga`.**
  - **Se niega, y la reversión pasa a ser manual con motivo** (4.3), en tres casos:
    - otra carga cambió después una fila que esta escribió: un precio pendiente que completó la carga del día siguiente (D-19), o una corrección;
    - una fila de `nivel_operaciones` apunta a una de sus operaciones;
    - alguna fila de su auditoría tiene una `schema_version` distinta de la actual, es decir, hubo una migración en el medio.
  - **Si no hay nada de eso, revierte:**
    - recorre su auditoría de la más nueva a la más vieja: borra lo que insertó, restaura el "antes" de lo que cambió y reinserta lo que borró. La propia carga y sus `lecturas` no se borran: quedan para el Registro, y `service_role` no tiene `delete` sobre `lecturas`;
    - vuelve a `vigente` la carga que había reemplazado;
    - marca la suya `revertida`, con `revertida_en`, `reversion_motivo` y `reversion_detalle`.

    Todo queda auditado con `accion = 'reversion'`.
- **`revertir_lote`** aplica `revertir_carga` a cada carga vigente del lote, de la más nueva a la más vieja, y borra la nota del lote. Si una carga no se puede revertir, no se revierte ninguna.
- **`deshacer_reversion`** vuelve a aplicar, desde la auditoría, las acciones originales de la carga. Solo lo hace si ninguna fila que tocó la reversión cambió después. Los 10 segundos del aviso son una regla de la interfaz; la de la base es "nada cambió después".
- **`corregir_hecho`** corrige un número:
  - crea un lote `correccion` con una carga `manual` que lleva `corrige_a`, `motivo` y `motivo_detalle`;
  - cambia la fila: el valor nuevo y la carga nueva.

  Los controles de ese día y de los siguientes se recalculan, sin guardar nada (D-38). El candado de una fila conciliada (CO-3) es el motivo obligatorio. La traza arma el **Historial** desde la auditoría.

**M6 · `1a_respaldos`** (D-58)

```sql
create table respaldos (
  id                   bigint generated always as identity primary key,
  iniciado_en          timestamptz not null,
  terminado_en         timestamptz,
  destino              text not null,
  bytes                bigint check (bytes > 0),
  sha256               text check (sha256 ~ '^[0-9a-f]{64}$'),
  filas_por_tabla      jsonb,
  objetos_storage      integer check (objetos_storage >= 0),
  pg_dump_version      text,              -- versión fija (D-58)
  imagen_restauracion  text,              -- supabase/postgres de la misma versión mayor
  restaurado_ok        boolean,           -- NULL = no se probó: no cuenta como respaldo
  detalle              text,
  check (terminado_en is null or terminado_en >= iniciado_en),
  check (restaurado_ok is null or (terminado_en is not null and sha256 is not null
                                   and imagen_restauracion is not null))
);
alter table respaldos enable row level security;
grant select, insert, update on table respaldos to service_role;             -- sin delete
grant usage, select on sequence respaldos_id_seq to service_role;
create trigger auditar after insert or update or delete on respaldos
  for each row execute function registrar_auditoria();
comment on table respaldos is 'Cada respaldo nocturno y su restauración verificada (D-58, calidad.md §6)';
-- … y un comentario por columna.
```

**Cómo se escribe y se controla un respaldo:**
- **Quién escribe esta tabla:** un route handler con su propio secreto, que recibe el reporte del job. La clave de la app también se verifica en los route handlers, no solo en las Server Actions (D-57).
- **El job falla si falta una tabla:** si alguna tabla de `pg_tables` no aparece en `filas_por_tabla`.
- **Cómo se restaura:** cada noche, el `supabase db dump` en tres archivos (roles, schema y datos) se restaura en la imagen `supabase/postgres` con `session_replication_role = replica`.

### 7.2 Tests nuevos de la 1a

**De forma** (SQL, en `schema_tests.sql`):
- Cada guarda aborta si hay una carga.
- `tipo_cambio`:
  - un segundo CCL en la misma fecha falla;
  - el cripto de esa fecha, con otra carga, se acepta;
  - `NaN`, `Infinity` y una fuente vacía fallan;
  - `v_tipo_cambio` devuelve texto.
- `cargas`, fallan:
  - un archivo sin sha256, o en una ruta que no es su sha256;
  - un documento sin tipo;
  - una carga revertida sin motivo;
  - un motivo sin carga corregida.
- `lecturas`: una lectura de visión sin modelo o sin hash del prompt falla.
- `pasivo_cuotas`: una cuota pagada sin pagador falla; una futura con pagador se acepta.
- `movimientos_capital`:
  - con `icyd_cobrado` vacío, se acepta;
  - con moneda `'XXX'`, falla;
  - con contraparte `NULL` y una entidad, falla, y con `'entidad'` sin entidad, también.
- `controles_cuenta`: dos B2 de la misma cuenta y el mismo día fallan aunque `seccion` sea `NULL`; un subtotal sin sección falla.
- `condiciones_cuenta`: una fila sin TNA ni tope falla.
- `operaciones`: un precio sin `precio_origen` falla.
- `leer_monto`: con `'1548.2'` (un número JSON) falla; con `'"1548.20"'` devuelve 1548.20.
- Un `update` de un hecho que no cambia `carga_id` falla.

**De funciones** (SQL y fast-check):
- **`confirmar_lote`:**
  - con una fila inválida, no deja nada grabado;
  - llamada dos veces con el mismo lote, graba una sola vez;
  - guarda la `lectura_cruda` del borrador aunque la llamada traiga otra;
  - falla si un monto llega como número JSON.
- **`revertir_carga` y `revertir_lote`** dejan las tablas de hechos con el mismo hash que antes de la carga (`calidad.md` §1). Vale también cuando la carga reemplazó a otra y borró un saldo.
- **`deshacer_reversion`** vuelve al hash de antes de la reversión.
- **`revertir_carga` se niega** en los tres casos de M5, y cada uno tiene su test: una corrección posterior o un precio completado al día siguiente (D-19), una fila de `nivel_operaciones` y una migración en el medio.
- **El cruce de tablas:** un `cuenta_pago_id` de una cuenta que no es de quien pagó, falla.

**De seguridad** (después de cada migración):
- toda tabla de `public` tiene RLS;
- toda tabla, salvo `auditoria` y `carga_borradores`, tiene el trigger `auditar`;
- toda tabla, vista y columna tiene comentario;
- `anon` y `authenticated` no tienen ningún privilegio sobre tablas, vistas, secuencias ni funciones;
- ninguna función es ejecutable por `PUBLIC`;
- `service_role`:
  - no tiene `truncate`, `references` ni `trigger` sobre nada;
  - no escribe la auditoría;
  - no borra en `monedas`, `entidades`, `partidas_liquidez`, `lotes`, `lecturas`, `lote_tramos` ni `respaldos`;
- toda función, salvo `registrar_auditoria()` y `version_schema()`, es `security invoker`, y todas tienen el `search_path` fijo.

**Casos existentes que cambian.** Los casos de `schema_tests.sql` que usan la forma vieja se reescriben en el mismo commit:
- los que usan `tipo_cambio` ancha;
- los de cargas sin lote ni sha256;
- el `update cotizaciones` que hoy cambia un precio sin una carga nueva;
- los helpers `pg_temp.espera_ok` y `pg_temp.espera_error`, que necesitan un `grant execute … to public`. Desde M1, una función nueva ya no lo recibe por defecto, y en la prueba local los casos que corren como `service_role` y `anon` fallaban por eso.

### 7.3 Fase 1b · dos migraciones

Valen las reglas de 7.0. En la 1b ya hay datos, así que todo lo que se agrega es nullable o se completa dentro de la misma migración.

**`1b_carga_y_salud`**

| Cambio | Para qué | Origen |
|---|---|---|
| Nueva `alias_especie`: `cuenta_id`, `texto_crudo`, `activo_id`, `divisor_precio` ∈ {1, 100, 1000} (el ÷1000 es el ajuste a D-12 que aceptás en 6.9), `vigente_desde`, `carga_id` | Alias aprendidos y escala recordada por bróker | CA-6, CA-11, D-12 |
| Nueva `avisos_reconocidos`: `huella`, `motivo` no vacío, `condicion` (próxima carga, fecha o cambio del dato), `reconocido_en`, `vence` con un máximo de 90 días | "Dar por visto" sin silencios eternos. Desde la fase 4, también "Reconocer sin acción" un disparador | CO-8, D-41 |
| Nueva `umbrales`: `regla` como clave con check (top 1, top 3, exposición neta, un solo bróker, banda neutra), `valor` (`NULL` = apagada), `actualizado_en` | Tus reglas, vacías hasta que las fijes | EX-3, D-42, HO-5 |
| `feriados`: `mercado` ∈ {BYMA, BANCARIO, NYSE}, con AR que pasa a BYMA y US a NYSE; `fuente`; `carga_id` | Tres calendarios con fuente. "Hoy no operó el mercado" es una fila BYMA con fuente "vos" y su carga | D-45, ajuste a D-16 |
| `cargas.origen` suma `serie`, y `cargas` suma la columna `fuente`, obligatoria cuando el origen es `serie`. `cargas_check` pasa a `(origen in ('manual','serie')) = (archivo_path is null)` | Pegar serie: el origen de cada fecha pegada | CA-13, D-48 |
| `bienes`: `moneda_riesgo` (check `ARS`/`USD`, como `activos.moneda_riesgo`: es riesgo, no unidad de cuenta, D-59) y `cadencia_revaluacion_meses` | Moneda de riesgo elegida por vos; un bien sin ella no entra en Exposición y la vista Total dice "sin dato". Valuación que se vuelve vieja | D-73, D-65, CO-11 |

`feriados` es la única tabla con datos que cambia de forma. Es chica, así que los tres pasos van en la misma migración: se saca el check, se renombran los mercados, se pone el check nuevo, y las filas sembradas en la 1a reciben como fuente "date-holidays, sembrado en la 1a".

**`1b_tesis_como_datos`** (D-51, DD-5, DS-11, DS-13, DB-6, DB-11)

| Cambio | Para qué | Origen |
|---|---|---|
| Nueva `tesis`: `carga_id` del documento, `fecha_declarada`, `horizonte_hasta`, `capital_declarado` y su moneda, `vigencia` ∈ {vigente, histórica}. Un índice único deja una sola vigente | Solo una tesis vigente alimenta bandas, disparadores y veredicto | D-51, de C |
| Nueva `tesis_condiciones`: `tesis_id`, `orden`, `texto` literal | El marco macro de tres condiciones. Su estado lo marcás en la fase 4 | de D |
| Nueva `tesis_canasta`: `tesis_id`, `activo_id`, `en_canasta`, `rol` (`NULL` si no tiene). Sin fila = sin marcar | El cruce tesis/cartera: cada posición está en la canasta con un rol, o fuera de tesis | EX-3, DD-5 |
| Nueva `tesis_objetivos`: `tesis_id`, `activo_id` o `rol` (exactamente uno de los dos), `objetivo` y `banda_pp` como fracciones | Bandas por activo o por rol, que sobreviven al rollover de una LECAP | DD-5, D-51 |
| `niveles`: `tesis_id` (`NULL` = anotado en la app), `nivel_entrada_hasta` (el tramo como rango), `confirmado_en`, `reemplaza_a`, `motivo_cambio` y el estado `reemplazado`. Sale `nivel_invalidacion`: la tabla está vacía y la guarda lo verifica | Los 15 tramos importados, y niveles que no se reescriben | DS-11, DS-13 |
| Nueva `invalidaciones`: `activo_id`, `tipo` ∈ {precio, evento}, `nivel` (solo si es por precio), `referencia`, `texto`, `fecha_definicion`, `confirmado_en`, `reemplaza_a`, `motivo_cambio`, `tesis_id`. Nueva `objetivos_precio`, con las mismas columnas más `orden` | Una invalidación es de la posición, no del tramo: VIST tiene una por precio y otra por evento. Son 14 objetivos de precio, porque LMT tiene 2 | D-51, DB-6 |
| Trigger en `niveles`, `invalidaciones` y `objetivos_precio`: una fila con `confirmado_en` solo puede cambiar de `estado`. Mover un nivel crea una fila nueva con `reemplaza_a` y motivo | Tu regla: "No corras los niveles de invalidación… con la razón anotada" | DS-13 |
| `eventos`: tipo `hito`, `fecha_estado` ∈ {confirmada, por_confirmar}, `afecta_texto` (lo que dice tu calendario, literal) y `carga_id` del documento | Los 17 hitos, sin inventar vínculos con activos que no tenés | DS-11, DB-11 |

**Lo que no pide schema:**
- **Las invalidaciones por precio** se evalúan desde la fase 4 contra `cotizaciones.precio_usd_subyacente`, una columna que ya existe.
- **Los documentos sin filas** (D-77) usan `cargas.origen = 'documento'`, que existe desde M3.
- **El origen "importado" o "app" de un nivel** se deduce de `tesis_id`, así que no se guarda aparte.

**Tests de la 1b:**
- un fixture inventado, con la forma de tu tesis, da al importarse exactamente los conteos que muestra la pantalla (4.9.2);
- una segunda tesis vigente falla;
- un objetivo con activo y rol a la vez falla;
- un nivel confirmado no cambia su precio;
- `feriados` conserva la misma cantidad de filas después de migrar.

**Si aprobás D-99,** `revisiones` y `chequeos_fundamentos` (fase 4) se adelantan a esta fase.

### 7.4 Fases 2 a 5, de un vistazo

**Fase 2 · Contexto** (`2_pasivos`, `2_flujo_y_cierres`, `2_calendario`)
- **`pasivo_cuotas`:**
  - suma `iva_computable` (`NULL` = sin dato) y `comprobante` (H8.13);
  - el capital según cuadro de marcha, la TEA implícita y la licuación se calculan, sin tabla (EX-6).
- **`flujo_mensual`** conserva el nombre del spec:
  - suma `carga_id`, `cerrado_en`, `definitivo_en` (cuando pegás el IPC) y `reapertura_motivo`;
  - pierde `gastos_fijos_reales` y `gastos_variables`, porque el consumo sale por diferencia de saldos (D-79) y guardarlos sería guardar un derivado. La tabla llega vacía a la fase 2, y la guarda lo verifica;
  - quedan como insumos `ingreso_usd`, `cripto_venta_usado` e `ingreso_pesos`.
- **`gastos_fijos`** conserva el nombre del spec. Suma `frecuencia`, `regla_ajuste`, `pagador_entidad_id` y `cuenta_pago_id`. La próxima fecha se calcula.
- **Tablas nuevas:**
  - `gastos_confirmados`: lo que el cierre confirmó, por recurrente y por mes;
  - `provisiones`: concepto, vencimiento y monto. La parte de cada mes se calcula;
  - `resumenes_tarjeta`: opcional (D-81), contra un `pasivos` de tipo `tarjeta`, que ya existe;
  - `rendimientos_informados`: el resumen de MP, para asentar la diferencia con lo inferido (D-102).
- **`movimientos_capital.naturaleza`** es un catálogo cerrado (D-82). Incluye `consumo`, para las salidas de una cuenta mixta que el cierre confirma como retiros (D-102).
- **`ingresos_fijos`** suma `naturaleza` (sueldo, honorarios, dividendo, retiro a cuenta) y `pagador_entidad_id` (D-82). Con los movimientos con contraparte, la cuenta corriente con cada empresa se calcula.
- **Catálogos que crecen:**
  - `indices` suma `ipc_indec`;
  - `eventos` suma los tipos `fiscal`, `tecnico` y `seguro` (D-93). Vencimientos, cuotas y cierres no se copian a `eventos`: el calendario los lee de sus propias tablas;
  - `umbrales` suma `meses_cuota_cubiertos` y `meses_reserva`.
- **Nueva `preferencias`** (`clave` con check, `valor`): la lente del cierre que elegís en el primero (D-80).
- **Lo que no pide schema:** las pantallas de entidades y "Anotar destino". Las columnas de entidades existen desde la 1a, y `vencimientos.destino_decidido`, desde el `init`.

**Fase 3 · Motor** (`3_escenarios`)
- **`escenarios.fecha_ancla`**, con `NULL` = sin anclar (D-43).
- **La versión 1 de `supuestos` ya trae todo D-88:** la reinversión de cada vencimiento, la TEM implícita como "Igual", las volatilidades vacías, quién paga la cuota, la opción de compra y el traspaso a precios de la vista Estrés.
  - **La valida zod** (`stack.md`). La base solo controla que sea un objeto con `v`.
  - **Sin `pg_jsonschema`:** la base local de tests no tiene la extensión, y la validación quedaría en dos lugares.
  - **Una variable nueva sube `v`** y migra los escenarios guardados con un valor explícito (D-08).
- **Nueva `valores_recordados`** (`variable`, `valor`, `actualizado_en`): el último valor que elegiste en cada deslizante (D-08).
- **La clase de cada partida en el motor** sale de `activos.tipo` y de `partidas_liquidez.clase`, que existe desde la 1a.
- **`proyecciones_congeladas` no entra acá:** en la fase 3 nada se congela.

**Fase 4 · Disciplina** (`4_diario_y_mesa`, `4_rendimientos`)
- **El Diario y la mesa** (D-89, D-85, H4.18):
  - `decisiones`, con `fecha_revision` obligatoria, modo rápido o completo, y `confirmado_en`;
  - `decision_alternativas`: de 2 a 4, en el orden en que las escribiste, con un `activo_id` opcional para calcular el contrafáctico (sin activo, el contrafáctico es "sin dato");
  - `decision_condiciones` (hasta 3), `decision_enmiendas` y `decision_revisiones`;
  - un trigger vuelve inmutable una decisión confirmada; se corrige con enmiendas.
- **`proyecciones_congeladas`** (DD-3):
  - columnas: `escenario_id`, `decision_id`, `motivo` ∈ {decision, cierre_anual}, `algoritmo`, `semilla`, `codigo_version`, los supuestos copiados, los percentiles de cada mes en ARS y en USD, y su sha256;
  - permisos: solo `select, insert`;
  - es evidencia y no insumo (D-103): un test verifica que ninguna función de cálculo la lea.
- **Tablas nuevas para la revisión:**
  - `respuestas_invalidacion`: respeté, postergué con motivo o cambié el criterio con motivo (vida 2.4 #3);
  - `chequeos_fundamentos`: sigue, cambió o no sé, por cada condición del marco macro o por cada pilar de un activo;
  - `revisiones`: `desde`, `hasta`, `hecha_en`, `contenido_sha256` y `accion_anotada` (D-74).
- **Columnas y catálogos que crecen:**
  - `niveles` suma `decision_id`;
  - `indices` suma `spy_ajustado` y `tem_lecap_ref`, tus dos varas en la sombra (D-40);
  - `operaciones` suma `comprobante` (único por cuenta), `derechos_mercado` e `iva_costos`, para la importación de movimientos de IEB (D-52, CA-14, EX-10);
  - `umbrales` suma `tamano_decision_completa`, el tamaño desde el que el Diario pide el modo completo. Queda vacío hasta que lo pongas.

**Después de la 4, si aprobás D-84**
- `revisiones` suma `canal`, `enviada_en` y `con_montos`.
- Nueva `pausas`, con `desde` y `hasta`.
- `preferencias` suma el día, la hora y "con montos".

**Fase 5 · Vida financiera** (nombres tentativos; cada módulo trae su migración)
- **Años (D-86):**
  - `cierres_anio`: `anio`, `cerrado_en`, la foto en ARS y en USD, `foto_sha256` y `codigo_version`;
  - `reaperturas_anio`, con motivo;
  - un trigger en cada tabla de hechos rechaza los cambios con fecha de un año cerrado, salvo que haya una reapertura abierta;
  - la foto es evidencia (D-103). `proyecciones_congeladas` acepta `motivo = 'cierre_anual'` desde la fase 4.
- **Impuestos:**
  - `parametros`, con vigencia, fuente y estado;
  - `situacion_fiscal`, `atributos_fiscales` y `cotizaciones_fiscales` (las tablas de ARCA);
  - `ingresos_fijos` suma `bruto` y `retenciones`, y `bienes` suma `caracter` y `afectado_vivienda`.
- **Empresas:** `participaciones` (entidad, porcentaje y valuaciones fechadas con su fuente), como dato y sin sumarse al patrimonio (vida 2.8 #4, D-96).
- **Legado, seguros y retiro:**
  - `persona`, `personas_vinculadas` y las tablas `legado_*`, con su propio bucket privado `legado`;
  - `aseguradoras` y `polizas`;
  - `previsional_periodos`.
- **Cadena del cobro en USD:**
  - `ingresos` e `ingreso_tramos`, con comisión, timing y spread (vida 2.5);
  - USDT y USDC entran como filas de `monedas`;
  - los lotes FIFO se calculan.

---

## 8. Riesgos y cómo se controlan

Los controles remiten a `docs/calidad.md`, que es la definición de terminado: **una fase no se despliega si no pasa los suyos**, y bajar la vara para llegar a una fecha no es una opción. La columna **Desde** dice en qué fase entra cada control. Desde ahí, el control es parte del criterio de salida de esa fase y de todas las que siguen. Los cambios que este documento le hace a `calidad.md` (tiempo activo, etiquetas, tocables y anchos nuevos) están en 6.9. Los riesgos van agrupados por tema y numerados de corrido.

### 8.1 El hábito y el alcance

| # | Riesgo | Cómo se vería | Control | Desde | `calidad.md` |
|---|---|---|---|---|---|
| 1 | **Los 60 segundos se miden mal o se pierden afuera** (exportar el Excel, sacar las capturas, pasar del teléfono a la compu) | Un test de laboratorio que pasa mientras tus cargas reales tardan 90 s; o una métrica que cuenta la media hora entre el teléfono y la compu y no te deja ver si el ritual es rápido | Tiempo activo por lote: la suma de los tramos con gestos en cada dispositivo, cortados después de 60 s sin gestos, con el tiempo de punta a punta al lado (D-62). Salida de la 1a: 10 cargas reales completas, las 10 por debajo de 60 s activos (con 10 cargas, el p95 es casi la más lenta). Enter espera a que terminen todas las fuentes, con "Guardar sin X" al lado, y el motivo de una advertencia es la opción que elegís, no un texto (D-47). Cargas express y media para los días apurados (D-64). Borrador compartido entre dispositivos desde la 1b (D-63). El test cronometrado sigue siendo un gate | 1a | §3 |
| 2 | **Cada gasto se lee como pérdida o como pregunta** | Pagás algo con Mercado Pago y la frase dice que tus activos perdieron $180.000, o la bandeja pregunta "¿entró o salió plata?" casi todos los días | Cada cuenta tiene perímetro: inversión, consumo o mixta (D-102). En una mixta, una baja es "salida a consumo, sin confirmar": nunca es resultado ni dispara una pregunta. "¿Entró o salió plata?" queda solo para las subas que la TNA de la captura no explica (CA-4). El cierre del mes confirma las salidas con un toque (fase 2) | 1a | §1, §3 |
| 3 | **La 1a se infla** y la foto del 31/12 queda en riesgo | La 1a no está en producción en diciembre | D-60 como filtro: la 1a es la fase 1 del spec más lo irrecuperable, y nada más. Evolución, los gráficos de Exposición, la ficha de activo, Pendientes como pantalla y el borrador compartido esperan a la 1b (sección 5). Producción objetivo: lun 30/11. Si al lun 14/12 no está, no se apura el código: se prepara el Plan B (riesgo 24) | Antes del código | Todo: la vara no baja |
| 4 | **Las vistas se adelantan y el Motor llega tarde** | La 1b y la 2 cargan pantallas de la 4 y de la 5 (bandas, veredicto, Revisión, Años, mesa, mail), y el Baja · Igual · Sube que pediste se corre meses | Una vista de una fase posterior se adelanta solo si aprobás D-99, con su costo a la vista (unas 3 semanas más de 1b). La 2 es lo del spec más la captura del 31/12. Años y su archivo van a la 5 (D-86), la mesa a la 4 (D-85) y el mail, después de la 4 (D-84). Lo no desplegado no aparece (D-69). La estimación de cada fase se rehace al cerrar la anterior | Antes de la 1b | §7 |

### 8.2 Los números

| # | Riesgo | Cómo se vería | Control | Desde | `calidad.md` |
|---|---|---|---|---|---|
| 5 | **Un número no cuadra con el bróker, o el cuadre no puede fallar** | "La app no coincide con IEB" y se pierde la confianza; o un ✓ que sale siempre porque una parte se calcula como residuo | Tolerancia según la precisión que informa la fuente (D-37). B2, los Subtotales de IEB y el total de Galicia son controles que se reevalúan cuando cambia un hecho anterior (D-38). Las diferencias de criterio llevan nombre y monto, como los +$34.440 de DOLARUSA (D-66). El cuadre compara el patrimonio **recalculado desde los hechos** contra el de ayer más cada parte de la frase, y cada parte se calcula por posición, con su propia fórmula (D-66). Una diferencia sin explicar es un bug aunque pasen los tests | 1a | §1, §7 |
| 6 | **Un precio o un saldo arrastrado inventa un movimiento** | Un CEDEAR que "pierde" en dólares justo lo que subió el CCL; dos días de intereses de MP atribuidos al jueves; la compra de 240 SPY con un reparto en Cartera y otro en Evolución | Lo que no tiene precio ni saldo nuevo, incluidos los saldos que no cargaste, queda "sin atribuir" (D-35). Cuando llega la observación, el intervalo se desglosa entero con el CCL de sus dos puntas, y la frase del día viejo cambia solo su rótulo, nunca sus montos. Una sola convención desde la compra, la misma en Cartera, Hoy y Evolución. Propiedades de fast-check: activo + TC + sin atribuir = total, exacto; un mes es la suma exacta de sus días; una carga express entre dos completas no cambia el desglose del período | 1a | §1 |
| 7 | **"Sin dato" que se vuelve cero, o un dato viejo que no avisa** | Un total que suma como 0 la parte que falta; un resultado que hereda un precio viejo y se ve como verificado | Un total al que le falta una parte es "sin dato", con la suma parcial rotulada (D-65). Tests que borran cada insumo, uno por uno. Toda función devuelve `{valor, formula, insumos, explicacion, etiquetas}`, y un test verifica que las etiquetas se propaguen (D-67). Los dos tests de CO-7 tienen que fallar: un punto histórico convertido con el CCL de hoy y una suma de ARS y USD sin convertir. Un test recorre las pantallas y falla si encuentra un número sin traza | 1a | §1, §2 |
| 8 | **La IA lee mal una captura, o le pone otra fecha** | Un saldo con un cero de más; el saldo de MP de hoy guardado con la fecha de ayer | Galicia: dos lecturas distintas, y decide la aritmética. Mercado Pago, que no tiene aritmética: dos modelos distintos, más plausibilidad contra la TNA (D-36). `null` antes que adivinar, y nada se guarda sin tu Enter (D-11). La lectura guardada es la que recibió el servidor, nunca una que manda el navegador (D-63). Una captura sin fecha toma el momento del pegado, y avisa si no coincide con el B1 del Excel (D-61). Cada carga guarda el modelo, la versión del lector y el hash del prompt. Corpus sintético nocturno desde la 1b (CO-13) | 1a | §1, §2 |
| 9 | **Un número guardado que compite con el recalculado** | La foto de un año o una proyección congelada dice una cosa, el cálculo con código nuevo dice otra, y no se sabe cuál vale | No se guardan posiciones, PPC, totales ni excedentes (D-23), y tampoco el resultado de un control: se recalcula cuando cambia un hecho (D-38). Lo que se congela (la foto de un año, la proyección que viste al decidir) es evidencia con su huella y nunca insumo de un cálculo (D-103). Test de no regresión de los años cerrados (fase 5) | 1a (lo congelado: 4 y 5) | §1, §6 |

### 8.3 Perímetro, tesis y neutralidad

| # | Riesgo | Cómo se vería | Control | Desde | `calidad.md` |
|---|---|---|---|---|---|
| 10 | **Exposición mezcla perímetros** | Una línea al lado del financiero que resta una deuda que el financiero no tiene; un neto total que cuenta la deuda de la camioneta pero no la camioneta | Cada vista escribe lo que netea (D-101): "pesos financieros − deuda del leasing", y el Total suma cada bien en la moneda de riesgo que le elegiste. Mientras a un bien le falte, el neto total es "sin dato", con la suma parcial a la vista (D-65, D-73). "Tomador del leasing: sin confirmar" se muestra como dato. D-71 solo registra: sacar la deuda de tu perímetro pediría una decisión que reemplace a D-03 | 1a | §1, §7 |
| 11 | **Tesis y cartera que no coinciden** | Alarmas de desvío de peso todos los días; bandas medidas contra todo el financiero (unos $104 M) cuando tu tesis es de $25 M; una tesis abandonada que sigue evaluando | Cruce obligatorio en la importación; canasta con objetivos por activo o por rol, que es la base de las bandas; desvío de peso solo con la canasta armada; tesis vigente o histórica, y solo la vigente evalúa (D-51). Salida de la 1b: la importación revisada por vos, con los conteos de 4.9.2 iguales a los de tu archivo | 1b (la evaluación, en la 4) | §7 |
| 12 | **"Nada que hacer" sin haber revisado nada** | La línea tranquila un día en que no estaba cargado el cierre del subyacente | "Revisé N · M sin evaluar": una regla sin evaluar nunca cuenta como revisada (D-53, D-74). El disparador 1 se activa solo con el cierre real del subyacente; con el precio implícito, la app avisa "cerca del nivel" y no activa nada (D-51). Las dos cosas son criterio de salida de la 4 | 4 (1b, si aprobás D-99) | §1 |
| 13 | **Recomendar por la puerta de atrás** | Una magnitud sugerida, un umbral por defecto, una alternativa resaltada, un horizonte precargado, unos "meses de reserva recomendados" | La frase es determinística: la IA solo lee capturas. Umbrales vacíos, incluidos los meses de reserva (D-42). Supuestos a futuro vacíos; "Igual" escrito por variable y sin pedirte datos; volatilidades vacías; ν, corridas y semilla como valores técnicos declarados; horizonte vacío o en el fin de tu tesis vigente, rotulado (D-88). Sin marcas del REM junto a los deslizantes (D-95). Mesa con reglas de neutralidad y su propio test (D-85), sin alternativas proyectadas ni un botón que arme escenarios desde ella (D-98). "Acción anotada", no sugerida (D-74). El test de neutralidad es salida de la 3 y de la 4 | 1a (crece hasta la 4) | Test propio (fases 3 y 4) |
| 14 | **Un resultado del motor que se lee como promesa** | "Esperado: US$ 101.300"; una cobertura de cuota que "paga" una devaluación medida en pesos nominales; un PnL proyectado armado con percentiles | Nunca dice "esperado": dice "la mitad de las corridas…" (PR-1). Cobertura de cuota en dólares y sin aportes, con una ventana fija de 12 meses (el primer mes evaluable es sep-2027) y rotulada como resultado total (D-49). PnL proyectado sobre la corrida mediana (PR-9). Monte Carlo contra la referencia en numpy, y la misma semilla da el mismo resultado en el servidor y en el navegador | 3 | §1 |

### 8.4 Los datos duran

| # | Riesgo | Cómo se vería | Control | Desde | `calidad.md` |
|---|---|---|---|---|---|
| 15 | **Un respaldo que no restaura** | El día que hace falta, el dump está vacío por RLS, no restaura por los roles de Supabase o le falta el bucket | D-58 con la receta de Supabase: `supabase db dump` en tres archivos (roles, schema y datos) con pg_dump en una versión fija, restaurado cada noche en la imagen `supabase/postgres` de la misma versión mayor, con `session_replication_role = replica`. Chequeo de `BYPASSRLS`; bucket `cargas` incluido; el job falla si falta una tabla. Atención lo muestra si falla o si pasan 48 horas sin uno. Salida de la 1a: las últimas 3 noches restauradas y verificadas | 1a | §6 |
| 16 | **El proyecto de Supabase se pausa o depende de otra cuenta** | Volvés de diez días de viaje y la app no abre; tus datos cuelgan de la organización de la empresa | Organización personal, con email propio y TOTP de respaldo (D-55). Plan Pro, o los riesgos de Free aceptados por escrito: pausa tras 7 días de poca actividad, sin respaldos diarios propios y con un tope de 2 proyectos. El respaldo propio corre con cualquiera de los dos planes (D-58) | Antes del código | §6 |
| 17 | **Una tabla queda sin RLS o sin auditar** | Una tabla abierta un rato entre dos migraciones; un cambio sin "antes y después" | Cada migración habilita RLS, otorga sus permisos, crea el trigger de auditoría y comenta todo lo que crea (D-59, sección 7). Un test falla si una tabla de `public` no tiene RLS, o si no tiene el trigger, salvo `carga_borradores` (D-63) y la propia `auditoria`. `service_role` sin `TRUNCATE` (D-33). El advisor de Supabase, sin avisos | 1a | §5 |
| 18 | **Revertir algo que tiene hechos encima** | Revertir la carga del jue 08/10 cuando la del viernes ya completó su precio (D-19); revertir un lote viejo después de una migración y restaurar filas con otra forma | La unidad es la carga (D-17), y se revierte solo si nada posterior depende de ella. Si algo depende, o si hubo una migración después (`schema_version`), la reversión es manual y con motivo. Deshacer una reversión, durante 10 s. Propiedad de fast-check: revertir una carga deja la base igual a como estaba | 1a | §1, §5 |
| 19 | **Una carga apunta a un archivo borrado** | "Abrir archivo" en la traza, y no hay archivo: se corta la cadena de D-17 | Desde el primer pegado, cada archivo va a su ruta definitiva, nombrada por su sha256. El job de borradores vencidos borra solo los objetos que ninguna carga referencia (D-63). El respaldo incluye el bucket (D-58) | 1a | §6 |
| 20 | **La app no dura diez años** (claves, Next, npm, el modelo de visión) | Un día deja de autenticar, de compilar o de leer capturas | Clave `sb_secret_…` antes de fin de 2026 (D-54). Next 16, versiones exactas y dependencias en cuarentena (D-57). El respaldo no depende de un cron del repo público, que GitHub apaga solo tras 60 días sin actividad (D-56). Fechas técnicas en el Calendario (fase 2). Modelo en configuración y registrado en cada carga. La base se reconstruye de cero en CI. Exportación legible sin la app: CSV nocturno desde la 1a, botón y recordatorio mensual en la 1b (CO-15), archivo anual en la 5 | 1a | §5, §6 |
| 21 | **Tus números salen de donde tienen que estar** | Montos de tus posiciones o archivos crudos en el repo, que es público; una página con montos en la caché del teléfono; un Route Handler sin clave; tus montos en el servidor de un proveedor de mail | Repo público por decisión tuya (D-24), sin montos de posiciones ni archivos crudos, o privado si lo cambiás en D-56; en los dos casos, CODEOWNERS y protección de rama. Base cerrada: solo el servidor la toca (D-20). La clave se verifica en el `proxy` y, además, en cada Server Action y cada Route Handler (D-57). El service worker cachea solo archivos estáticos, nunca HTML ni respuestas RSC (D-57). Datos reales fuera de git (D-24). El mail llega recién después de la 4, si lo aprobás: sin montos por defecto y con su clave solo en el servidor (D-84) | Antes del código | §5 |
| 22 | **Si te pasa algo, nadie encuentra la plata** | Cuentas con 2FA y sin códigos de respaldo; claves que solo vos sabés | Paso 0 del legado esta semana, fuera de la app: 2FA con códigos de respaldo, un gestor de contraseñas con acceso de emergencia y una hoja impresa sin claves (D-55). El módulo Legado, en la 5 (D-92) | Esta semana | — |

### 8.5 Fechas que no esperan

| # | Riesgo | Cómo se vería | Control | Desde | `calidad.md` |
|---|---|---|---|---|---|
| 23 | **S13N6 vence el vie 13/11, antes de que la 1a esté en producción** | El dinero queda sin colocar, contra tu propia regla: "No dejar el dinero sin colocar" | Anotarlo hoy en el calendario del teléfono, con un aviso el vie 30/10, a 14 días, como la alerta del spec. La alerta formal y "Anotar destino" llegan con la fase 2 (D-75) | Esta semana | — |
| 24 | **El 31/12/2026 llega con la 1a recién desplegada, o sin ella** | Se pierde la primera foto anual, la que vas a necesitar para Bienes Personales | 1a en producción el lun 30/11: desde ese día la foto sale de la app aunque la validación siga, y la validación termina casi dos semanas antes del 30/12. El aviso de diciembre en Hoy (D-76). Si al lun 14/12 no está, Plan B: guardás el Excel y las capturas del 30/12, anotás el CCL y el cripto de ese día con su fuente, y la primera carga se hace después, con esa fecha. El checklist de 8 ítems (1b) y la captura de la fase 2 cubren el 31/12/2027; Años (fase 5) cierra desde hechos ya guardados | 1a | §7 |

### 8.6 El uso de todos los días

| # | Riesgo | Cómo se vería | Control | Desde | `calidad.md` |
|---|---|---|---|---|---|
| 25 | **Ruido de alertas** | Un contador siempre en 5 que dejás de mirar | Reglas vacías hasta que pongas un umbral (D-42). "Dar por visto" con motivo y un vencimiento de 90 días como máximo (D-41). Tinta neutra para los estados, y tu banda neutra para los días planos (HO-5). El desvío de peso, solo con la canasta armada (D-51). Nada en rojo por días sin cargar. Desde la 4, "Nada que hacer según tus reglas" en la primera línea | 1b | §3 |
| 26 | **Tu skill y la app dan números distintos** | El desglose multiplicativo de tu skill contra el aditivo de D-35; el CEDEAR calculado desde el subyacente contra el precio del bróker | La Revisión lo dice en el Total desplegado (4.8). Si aprobás D-35, actualizás tu skill antes de escribir código (sección 5). El chip de CCL implícito muestra la diferencia del CEDEAR (D-18). Una revisión semanal real en la app, comparada con la de tu skill, es salida de la 4. Que tu skill lea la app es D-50, después de la 4 | 1a | §7 |
| 27 | **Layout roto en algún ancho** | Scroll horizontal a 1024 px; una celda cortada a 768 px; Hoy pasado del pliegue en Safari; el botón "Guardar" tapado por el teclado | D-30 con D-100 y D-68. Playwright a 360, 390, 412, 768, 1024, 1279, 1280, 1600 y 2560 px, en claro y en oscuro, con puntero grueso y fino; Hoy arriba del pliegue en el viewport de `iPhone 13` (390 × 664; la cuenta está en el Apéndice B); Cargar con el teclado abierto. Capturas revisadas contra el deploy real. Pasa antes de cada despliegue | 1a | §4 |
| 28 | **El costo y el retiro del modelo de visión** | Más gasto que el previsto, o capturas que dejan de leerse cuando el modelo se retira | El costo es una **estimación** de CA-3, derivada de un precio de ejemplo de la documentación, no de un precio publicado: del orden de 5 a 10 centavos de dólar por captura con dos lecturas. Se mide en las cargas reales de la 1a, porque cada carga registra su modelo. El modelo está en configuración; el corpus nocturno (1b) y la aritmética son la red al cambiarlo. Reprocesar con un lector nuevo llega en la 5 (CO-13) | 1a | §5 |

---

## Apéndice A · Choques resueltos

### A.1 Entre los diseños

Donde dos diseños chocaban, ganó `docs/spec.md` y, después, lo que pediste vos.

| Tema | Qué decían los diseños | Cómo queda | Por qué |
|---|---|---|---|
| Nombre del dólar cripto | A y B lo renombraban `cripto_ref` | Se conserva **`cripto_venta`** en el catálogo. El precio de cada venta real se confirma en el cierre del mes, en `flujo_mensual.cripto_venta_usado`, que ya existe | El spec dice "cripto_venta manda para ingresos". H5.4 se resuelve con la descripción del catálogo, sin renombrar |
| `activos.moneda_riesgo` | A, C y D la pasaban a FK de `monedas` | Sigue como check | Dice a qué moneda expone un activo, no en qué moneda se cuenta |
| Pagador de una cuota | A y C: "pagada si y solo si tiene pagador" | En un solo sentido: una cuota pagada tiene pagador, y una futura puede tenerlo | Si no, el Calendario no puede decir "paga: la empresa" antes del pago |
| Carga express | A: "el cambio en dólares es todo por el CCL" | Lo que no tiene precio ni saldo nuevo, incluidos los saldos que no cargaste, queda **sin atribuir**. Cuando llega la observación, el intervalo se desglosa entero y la frase vieja cambia solo su rótulo (D-35) | Con el precio en pesos de ayer, un CEDEAR mostraría una pérdida inventada (D-18) |
| Resumen semanal por mail | A: en la 1b, con un proveedor nuevo | Después de la fase 4, si aprobás D-84, sin montos por defecto. La Revisión en pantalla, en la 4 (o en la 1b, con D-99) | No lo pediste, suma un tercero y una clave, y lo que resume recién existe en la 4 |
| Atención en Hoy | D: columna propia recién desde 1600 px | Columna a la derecha desde 1280 px; un renglón en el teléfono; desde la 4, el veredicto arriba de todo | El spec pone las alertas en Hoy, y 1280 px es el primer ancho de desktop que prueba el test de layout (D-53) |
| Cartera densa | B, C y D: de 12 a 14 columnas, con el ticker fijado | Prioridad de columnas entre 768 y 1279 px: lo que no entra va al detalle de la fila. Columnas de tesis solo desde 1600 px. Con puntero fino, filas de 28 px (D-68, D-100) | D-30: sin scroll horizontal ni texto cortado en ningún ancho, y con las 25 filas del spec |
| Cuota ARS contra USD | B y C: doble eje | Un eje, indexado a 100 | El spec dice "en el mismo eje" |
| Patrimonio | C: tercer nivel "con tus empresas" | Dos niveles (D-03). Las entidades dicen de quién es cada cosa (D-96) | Lo que pediste es total contra financiero |
| Pantalla Años | C: la vista en la 1b y el cierre en la 2 | En la 5, con el cierre en enero o después (D-86). El 31/12 lo protegen el aviso (1a), el checklist (1b), la captura de la fase 2 y, en 2026, el Plan B (D-76) | D-60: lo irrecuperable son los datos, no la pantalla. En la 2, atrasaba el Motor |
| Mesa de decisión | D: v1 en la 2, v2 (alternativas proyectadas) en la 3 y v3 (contrafácticos) en la 4 | v1 en la 4, con el Diario (D-85); los contrafácticos de la v3, en la revisión de cada entrada (D-89). No se construye la v2, ni un botón que arme escenarios desde la mesa (D-98) | Proyectar tus alternativas es lo más cercano a recomendar. Para comparar supuestos están los escenarios del spec §7 |
| Diario | D: puntaje de Brier y matriz proceso × resultado | Modo rápido. La revisión compara contra tu rango, tus dos varas y las alternativas que descartaste (D-89) | Brier y la matriz son pesados para empezar. Comparar contra lo descartado es un hecho histórico, no un consejo |
| Evolución | A: en la 1a. D: bajo "Futuro", con la historia desde la 1b | Bajo Patrimonio, desde la 1b. En la barra del teléfono, también desde la 1b (en la 1a, ese lugar es de Exposición) | Es sobre todo pasado: el futuro se le suma en la 3. D-05 pone la historia en la fase 1, y la 1b es fase 1. Como se calcula desde las cargas de la 1a, esperar no pierde nada (D-60) |
| Señales de verdad | B: siete marcas con símbolos | Un chip con palabras por número ("viejo", "declarado", "inferido", "provisorio"), el más grave, y nada cuando está verificado (D-67) | Siete símbolos son vocabulario nuevo. Las reglas útiles de B, como la propagación y "la más grave", se conservan |
| Pesos objetivo | A, B y C: `pesos_objetivo` por activo | Canasta con objetivos por activo o por rol, que es la base de las bandas (D-51) | Al rollear una LECAP, una banda por ticker se rompe. Y tu tesis no es todo tu financiero |
| Borrador de carga | A: tabla suelta, sin auditoría | Colgado de `lotes` (de B), sin auditoría, como única excepción documentada. Cada archivo va a su ruta definitiva desde el primer pegado (D-63) | El tiempo activo se suma sobre el lote (D-62), el borrador no es un hecho y ninguna carga puede apuntar a un archivo borrado |
| `schema_version` | A: "la tabla cambió de forma" | Versión global: si hubo una migración después del lote, la reversión es manual y con motivo | Seguir la versión por tabla es diseño extra sin un beneficio claro |
| Control B2 de IEB | C: PK con una columna nullable | `unique nulls not distinct` | Una PK no admite null, y los B2 no tienen sección |
| Bienes en Exposición | D: casa y camioneta como riesgo dólar | Entran solo con la moneda de riesgo que les elegís (D-73). Mientras falte, el neto total es "sin dato", con la suma parcial (D-101) | La app no asigna riesgo en silencio, ni deja afuera en silencio una camioneta de $38 M |
| Respaldo | A y B: un rol de solo lectura | Rol propio solo si Supabase permite `BYPASSRLS`; si no, la conexión `postgres` vive solo en el runner. Se restaura en la imagen `supabase/postgres` (D-58) | Con RLS sin políticas, un rol común ve las tablas vacías. Un Postgres común no restaura los roles de Supabase |
| Rangos y horizonte | D: devaluación de −15 a +15 %/mes; horizonte precargado en dic-2027 | Rangos como magnitud por dirección: 0 a 15 %/mes en Sube y en Baja para la devaluación (en inflación, Baja llega a 5). Horizonte vacío, o en el fin de tu tesis vigente, rotulado y editable (D-88) | Coherente con D-08: el botón da la dirección y el deslizante, cuánto. Un horizonte fijo estaría casi vencido cuando llegue la fase 3 |

### A.2 Los que encontró la revisión adversarial del borrador

Todas estas correcciones acercan el documento al spec, a D-01 a D-34 o a tu skill. Ninguna se aparta de ellos.

| Tema | Qué decía el borrador | Con qué chocaba | Cómo queda |
|---|---|---|---|
| Corte | No decía qué despliegue lo reemplaza | D-01 | El despliegue de la 1a lo reemplaza en el proyecto `portfolio` de Vercel; el schema `corte` no se toca (6.9) |
| Orden de fases | En la 1b: bandas, veredicto y Revisión (de la 4), y la alerta de vencimientos con "Anotar destino" (de la 2) | El orden de fases del spec. D-60 adelanta hechos, no vistas | Cada vista vuelve a su fase. Adelantar la parte de la 4 es D-99, con su costo. La alerta y "Anotar destino", en la 2 (D-75) |
| Alcance de la 1a y de la 2 | La 1a, con Evolución, la ficha, los gráficos y el borrador compartido; la 2, con Años, el archivo, la mesa y el mail | El spec (cada fase desplegada antes de la siguiente) y la fase 3, que pediste explícitamente | 1a mínima. Años, a la 5; la mesa, a la 4; el mail, después de la 4 (sección 5, D-60, D-99) |
| Tocables y 25 filas | Filas de 28 px en Cartera, con cada cifra tocable | D-30 (44 px) y el spec (25 filas sin scroll) | D-100: 44 px con puntero grueso o debajo de 1024 px; con mouse, la fila es el objetivo |
| Duración de la carga | `confirmado_en − abierto_en`: en el propio ejemplo, 31 minutos | El requisito de 60 s del spec | D-62: tiempo activo, con el de punta a punta al lado |
| Exposición | "En los dos, el leasing netea contra tus pesos" | D-03 (el financiero no incluye deudas) y D-65 | D-101: "pesos financieros − deuda del leasing". El Total es "sin dato" hasta que cada bien tenga su moneda de riesgo |
| Tomador del leasing | D-71 "define si la camioneta y su deuda van en tu perímetro", con un texto en pantalla que opinaba | D-03, pedido tuyo | D-71 solo registra. Cambiar el perímetro pide una decisión que reemplace a D-03 |
| Revertir y corregir | Solo el lote entero, sin forma de corregir un hecho a mano | D-17: la carga es la unidad, y el valor anterior sigue visible | Revertir una carga o el lote, solo sin dependencias. Corregir con motivo, e Historial en la traza desde la 1a |
| "Igual" y supuestos | La TEM de "Igual" se pegaba a mano; ν y corridas precargados sin decirlo; faltaba la reinversión | D-07 y D-08 ("Igual no requiere definir nada") | D-88: TEM implícita a su precio de hoy, la reinversión como variable, volatilidades vacías y valores técnicos declarados |
| Comparar desde la mesa | "Comparar en Proyecciones" armaba un escenario por alternativa | D-07, y el rechazo de la mesa v2 en el mismo borrador | D-98 rechaza las dos cosas |
| Revisión semanal | Unas 20 líneas, con los siete disparadores | Tu skill: solo los activos ("Ninguno.") y cinco líneas | D-74: el formato de tu skill, con los siete estados a un toque |
| Invalidaciones | Evaluadas con el subyacente implícito al CCL tipeado | Tu `disciplina.md` y tu `SKILL.md`: cierre real del subyacente | El disparador 1 se activa solo con el cierre real. Con el implícito, solo "cerca del nivel" (D-51) |
| Lo congelado | Las fotos de `cierres` y `proyecciones_congeladas` guardaban resultados | D-23: no se guarda estado derivado | D-103: son evidencia, con su huella, y nunca insumo de un cálculo |
| Migraciones | RLS, permisos y auditoría recién en la última migración de la 1a | El spec ("RLS activado en todas las tablas desde la primera migración"), D-20 y D-33 | Cada migración nace con RLS, permisos, trigger de auditoría y comentarios (sección 7) |

## Apéndice B · El set de ejemplo y su cuadre

Todos los números son inventados. Este apéndice existe para que el documento pase su propio control. Cada cifra de abajo se recalculó con aritmética decimal exacta, como la que usa la app (D-32). Cuando una cifra se muestra junto con sus partes, las partes van redondeadas por resto mayor (4.0).

**Qué es ilustrativo.** Estas cifras dependen de datos que este set no lista. Son coherentes entre sí, pero no se pueden verificar acá:
- **El camino diario de octubre:** los repartos activo/TC desde la compra en Cartera (4.5); el patrimonio del 01/10 (US$ 65.420,00), los aportes y el reparto activo/TC del puente de octubre (4.7), y su eco en la Revisión (4.8).
- **La historia del leasing:** la licuación de US$ 6.830, el pagado de US$ 11.420 al CCL de cada pago y el capital de $21.372.540 según el cuadro de marcha (4.11).
- **Las fases 3 y 4:** Proyecciones (4.15), el marcador de Tesis y niveles (4.16) y los índices de Rendimientos (4.17).
- **El disparador 4 activo de 4.1 y 4.8:** supone una canasta de $32,08 M que este set no arma (12,48 ÷ 32,08 = 38,9%).
- **La Revisión del dom 18/10 (4.8):** repite las cifras del 14/10 para no sumar al set las cargas del 15/10 y del 16/10. La real mostraría las de la última carga.
- **Otros:** las estadísticas del Registro (mediana 38 s, la más lenta 52 s, 7 de 9 capturas desde el teléfono); las filas y los archivos del respaldo (1.212 y 41; las 37 tablas sí salen del schema: las 27 de hoy más las 10 nuevas de 7.1); el CCL implícito de 1.561,30 (sí cuadra su +0,8% contra 1.548,20); "Noviembre arranca: US$ 67.900"; el consumo de octubre ($3.910.000) y sus $180.000 no explicados.

**Fechas (2026).**
- Primera carga: jue 01/10.
- Días hábiles del 01/10 al 14/10: 01, 02, 05, 06, 07, 08, 09, 13 y 14 (el lun 12/10 fue feriado). Son 9, los 9 cuadraditos de la franja de Pendientes (4.4). Sin contar las puntas quedan 7: el hueco del caso "Volviste" de 4.1.
- Con el jue 15/10, octubre suma 10 días hábiles con carga: 9 completas y 1 express (4.3).
- S13N6 vence el vie 13/11. La alerta "a menos de 15 días" arranca el vie 30/10, a 14 días ✓.
- Del dom 18/10 (la Revisión de 4.8) al hito del vie 30/10 hay 12 días.
- Del mié 14/10 al mié 30/12, último día hábil probable del año, hay 77 días.
- La cuota 15 del leasing vence el mar 17/11.

**Tipos de cambio.**
- Mar 13/10: CCL 1.531,70.
- Mié 14/10: CCL 1.548,20 (+1,08% contra el 13/10) y cripto 1.541,00 (−0,47% contra el CCL).
- Jue 15/10 (express): CCL 1.560,00. El cripto de ese día no cambia ninguna valuación.
- Dólar de IEB para DOLARUSA el 14/10: 1.540,00.
- CCL de las compras de octubre: jue 08/10, 1.519,40 (T30J7); vie 09/10, 1.525,00 (SPY). CCL del día de la cuota 1 del leasing: 1.260,96.

**Cartera al 14/10** (entre paréntesis, el precio del 13/10):

| Cuenta | Activo o saldo | Cantidad | Precio | Valor ARS | Valor USD | Moneda de riesgo | % fin. |
|---|---|---|---|---|---|---|---|
| IEB | SPY (CEDEAR) | 1.240 | $35.150 ($34.700) | $43.586.000 | US$ 28.152,69 | USD | 41,80% |
| IEB | YPFD | 300 | $52.300 ($52.500) | $15.690.000 | US$ 10.134,35 | ARS (elegida por vos) | 15,05% |
| Galicia | S13N6 (LECAP) | 11.500.000 VN | $1,0852 ($1,0845) | $12.479.800 | US$ 8.060,84 | ARS | 11,97% |
| IEB | T30J7 (BONCAP) | 9.000.000 VN | $1,1240 ($1,1232) | $10.116.000 | US$ 6.534,04 | ARS | 9,70% |
| IEB | USD (saldo + DOLARUSA) | US$ 4.200 | — | $6.502.440 | US$ 4.200,00 | USD | 6,24% |
| Galicia | FIMA | 1.250.000 cp | $4,8120 ($4,8105) | $6.015.000 | US$ 3.885,16 | ARS | 5,77% |
| IEB | TXMJ0 (dual) | 5.000.000 VN | $1,0310 ($1,0306) | $5.155.000 | US$ 3.329,67 | ARS | 4,94% |
| MP | Saldo remunerado | — | — | $4.912.300 ($4.908.600) | US$ 3.172,91 | ARS | 4,71% |
| IEB | Saldo ARS ("Total") | — | — | −$185.000 | −US$ 119,49 | ARS | −0,18% |
| | **Patrimonio financiero** | | | **$104.271.540** | **US$ 67.350,17** | | **100%** |
| — | Casa | — | US$ 200.000 (valuación del 15/09/2025) | $309.640.000 | US$ 200.000,00 | sin elegir | |
| — | Camioneta − capital del leasing | — | $38.000.000 (valuación de marzo) − $21.400.000 (informado el 30/09) | $16.600.000 | US$ 10.722,13 | sin elegir | |
| | **Patrimonio total** | | | **$430.511.540** | **US$ 278.072,30** | | |

Las columnas cuadran con lo que se ve: los valores en ARS suman $104.271.540; los valores en USD, ya redondeados, US$ 67.350,17; y los porcentajes, 100,00%. La valuación de la casa tiene 13 meses, y por eso Pendientes la marca vencida con tu cadencia de 12 (4.4).

**Al 13/10:** financiero $103.681.415 = US$ 67.690,4191. Total $426.621.415 (con la casa a $306.340.000) = US$ 278.528,0505.

**Desglose del día, del 13/10 al 14/10 (D-35).** Las dos cargas son completas, así que no queda nada sin atribuir.
- Activos con riesgo USD (SPY y los US$ 4.200): US$ 32.291,6629 → US$ 32.352,6935, +US$ 61,0306.
- Activos con riesgo ARS (el resto, incluido el saldo negativo de IEB): $54.220.275 → $54.183.100, −$37.175.
- **En pesos:**
  - CCL = 32.291,6629 × (1.548,20 − 1.531,70) = **$532.812,44**.
  - Activos = 61,0306 × 1.548,20 − 37.175 = 94.487,56 − 37.175 = **$57.312,56**.
  - Total **$590.125,00** = $104.271.540 − $103.681.415 ✓ (+0,57%). Mostrado: $532.812 + $57.313 = $590.125 ✓.
- **En dólares:**
  - CCL = 54.183.100 × (1/1.548,20 − 1/1.531,70) = **−US$ 377,0049**.
  - Activos = 61,0306 − 37.175 ÷ 1.531,70 = 61,0306 − 24,2704 = **+US$ 36,7602**.
  - Total **−US$ 340,2447** = US$ 67.350,1744 − US$ 67.690,4191 ✓ (−0,50%). Mostrado: −US$ 377 + US$ 37 = −US$ 340 ✓.
- **Quién movió (activos, en pesos):** SPY +$94.487,56 · YPFD −$60.000 · S13N6 +$8.050 · T30J7 +$7.200 · MP +$3.700 · TXMJ0 +$2.000 · FIMA +$1.875 = $57.312,56 ✓. Mostrado: SPY +$94.488 y el resto exacto, que suman $57.313 ✓. Los US$ 4.200 no se movieron como activo: su cambio en pesos es todo CCL.
- **Cuadre** (en Cargar y, desde la 1b, al pie de Hoy):
  - El financiero del 14/10, recalculado desde las cotizaciones y los saldos de ese día, es $104.271.540.
  - Ayer más cada parte: 103.681.415 + 532.812,44 + 57.312,56 = $104.271.540,00. Residuo 0,00 ✓.
  - En dólares: 67.690,4191 − 377,0049 + 36,7602 = 67.350,1744 ✓.
  - Cada parte se calculó por posición, ninguna por diferencia: si una posición faltara en una parte, o se contara dos veces, el residuo no daría cero.
- **Mercado Pago, cuenta mixta (D-102):** subió $3.700. La TNA de la captura explica 4.908.600 × 27,5% ÷ 365 = $3.698,26; con la TNA mostrada a un decimal (de 27,45% a 27,55%), entre $3.691,54 y $3.704,98. La suba entra entera como rendimiento, sin pregunta (CA-4).

**Total del día (D-05, con las reglas de 4.7).**
- **En pesos:**
  - financiero +$590.125;
  - la casa, valuada en dólares: 200.000 × (1.548,20 − 1.531,70) = +$3.300.000;
  - la camioneta, valuada en pesos, y la deuda del leasing no cambian en pesos.
  - Total **+$3.890.125** = $430.511.540 − $426.621.415 ✓ (+0,91%).
- **En dólares:**
  - financiero −340,2447;
  - la camioneta, valuada en pesos: 38.000.000 × (1/1.548,20 − 1/1.531,70) = −264,4032, en "Resultado por TC", con su renglón propio;
  - licuación del leasing: 21.400.000 × (1/1.531,70 − 1/1.548,20) = +148,9008.
  - Total exacto **−US$ 455,7472** = US$ 278.072,3033 − US$ 278.528,0505 ✓ (−0,16%). Las tres partes, redondeadas a 4 decimales, suman −455,7471: la diferencia es redondeo, y al mostrarlas la reparte el resto mayor. En Hoy: −US$ 456.
- La casa es 309.640.000 ÷ 430.511.540 = 71,92% del total.

**Carga express del jue 15/10** (CCL 1.560,00, sin precios ni saldos nuevos).
- Financiero: $104.271.540 + 4.200 × (1.560,00 − 1.548,20) = $104.321.100 = US$ 66.872,50. Cambio: **+$49.560** (+0,05%) y **−US$ 477,6744** (−0,71%).
- **Todo queda sin atribuir** (D-35, D-64), porque ningún precio ni saldo es nuevo:
  - en pesos, los +$49.560 de tus US$ 4.200;
  - en dólares, SPY 43.586.000 × (1/1.560 − 1/1.548,20) = −212,9499;
  - posiciones en pesos, 49.455.800 × (1/1.560 − 1/1.548,20) = −241,6282;
  - pesos en efectivo (MP $4.912.300 y el saldo de IEB −$185.000, $4.727.300) × (1/1.560 − 1/1.548,20) = −23,0964.
- Exacto: −US$ 477,6744 (las partes, a 4 decimales, suman −477,6745). Mostrado por resto mayor: −US$ 213 − US$ 242 − US$ 23 = −US$ 478 ✓. Activo y CCL valen 0, y activo + TC + sin atribuir = total ✓.
- Con la próxima carga completa, cada partida desglosa su intervalo desde el miércoles con el CCL de sus dos puntas, y la frase del jueves cambia solo su rótulo (4.2).

**Exposición (D-101).**
- Pesos financieros (YPFD, S13N6, T30J7, FIMA, TXMJ0, MP y el saldo de IEB): $54.183.100. Menos la deuda del leasing ($21.400.000): largo **$32.783.100** = US$ 21.174,98.
- Vista Total: **sin dato**, porque la casa y la camioneta no tienen moneda de riesgo elegida. Suma parcial sin ellas: largo $32.783.100.
- Activos en dólares: SPY $43.586.000 + US$ 4.200 × 1.548,20 = $50.088.440 = US$ 32.352,69.
- Si el CCL sube 1%: el neto pierde 21.174,98 × 0,01 ÷ 1,01 = **US$ 209,65** (en Hoy, "US$ 210"), y los activos en dólares suman 50.088.440 × 0,01 = **$500.884,40**. Con 10%: −21.174,98 × 0,1 ÷ 1,1 = −US$ 1.925,00 y +$5.008.844.
- **Composición del financiero:** CEDEAR 41,80% · acción local 15,05% · bonos y letras 26,61% (S13N6 11,97 + T30J7 9,70 + TXMJ0 4,94) · FCI 5,77% · liquidez 10,77% (USD 6,24 + MP 4,71 − saldo de IEB 0,18) = 100% ✓. A un decimal, por resto mayor: 41,8 · 15,0 · 26,6 · 5,8 · 10,8 = 100,0 ✓.
- **Moneda de riesgo:** USD 48,04% · ARS 51,96%.
- **Geografía,** con la liquidez en la de su custodio: US 41,80% (SPY) · AR 58,20%.
- **Concentración:** top 1, 41,80%; top 3, 41,80 + 15,05 + 11,97 = 68,82%.

**Controles de la carga del 14/10.**
- **IEB contra B2:** posiciones $74.547.000 (SPY, YPFD, T30J7 y TXMJ0) − $185.000 + US$ 4.200 × 1.540,00 = **$80.830.000,00** ✓. La app valúa esos dólares al CCL: $80.864.440,00. La diferencia de criterio con nombre es 4.200 × (1.548,20 − 1.540,00) = +$34.440 (D-66).
- **Galicia contra el total de la captura:** $12.479.800 + $6.015.000 = **$18.494.800,00** ✓.
- **Tolerancia de S13N6 (D-37):** el precio viene con 4 decimales y la cantidad es entera. 11.500.000 × 0,00005 + 0,005 (medio centavo del valorizado) = ±$575,005, que se muestra como ±$575,01.
- **Bandeja:**
  - IEB, 7 filas: SPY, YPFD, T30J7, TXMJ0, DOLARUSA, el saldo en USD y el saldo en pesos.
  - Galicia, 2; MP, 1; CCL y cripto, 2.
  - En total, 12 leídas, 11 verificadas y MP a revisar.

**Cartera al 14/10.** Los repartos activo/TC de abajo usan un solo intervalo por lote, desde la compra, y así están calculados los de 4.5. Con D-35 cuentan, desde la primera carga, los intervalos diarios de octubre, que este set no lista: el reparto cambia, pero el resultado en cada moneda no. Por eso 4.5 los marca como ilustrativos.
- **SPY:**
  - Lotes: 1.000 de apertura a $29.100 (CCL de compra declarado 1.390,00) y 240 comprados el vie 09/10 a $34.500 (CCL de ese día 1.525,00).
  - Costo: $29.100.000 + $8.280.000 = $37.380.000 = US$ 20.935,2518 + US$ 5.429,5082 = US$ 26.364,76. PPC $30.145,16 y US$ 21,26 (declarado).
  - Resultado: $43.586.000 − $37.380.000 = **+$6.206.000 (+16,60%)**; US$ 28.152,69 − US$ 26.364,76 = **+US$ 1.787,93 (+6,78%)**.
  - Reparto en pesos: TC 20.935,2518 × (1.548,20 − 1.390,00) + 5.429,5082 × (1.548,20 − 1.525,00) = $3.437.921,42; activo 1.787,9335 × 1.548,20 = $2.768.078,58; suma $6.206.000,00 ✓. En dólares, por ser de riesgo USD, todo es activo: +1.787,93 / 0.
- **S13N6:**
  - Lote: 11.500.000 VN de apertura a $1,0426 (costo $11.989.900), con CCL de compra declarado 1.502,00. PPC US$ 0,000694 (US$ 7.982,6232 en total).
  - Resultado: **+$489.900 (+4,09%)** y US$ 8.060,8449 − US$ 7.982,6232 = **+US$ 78,2217 (+0,98%)**.
  - Reparto en dólares: activo 489.900 ÷ 1.502 = +326,1651; TC 12.479.800 × (1/1.548,20 − 1/1.502) = −247,9434. Mostrado: +326,16 − 247,94 = +78,22 ✓. En pesos, todo es activo.
  - Al vencimiento: 11.500.000 × $1,105 = **$12.707.500** (US$ 8.207,92 al CCL de hoy).
  - CCL de empate desde la compra: 1.502,00 × 1,105 ÷ 1,0426 = **1.591,90**; desde hoy: 1.548,20 × 1,105 ÷ 1,0852 = **1.576,45**.
- **T30J7:**
  - Lotes: 8.000.000 VN de apertura (PPP $1,097475, es decir $109,7475 cada 100 VN; costo $8.779.800; CCL de compra declarado 1.452,00) y 1.000.000 VN comprados el jue 08/10 a $1,0986 (costo $1.098.600; CCL de ese día 1.519,40).
  - El precio de la compra sale del cambio de PPP (D-19): (1,0976 × 9.000.000 − 1,097475 × 8.000.000) ÷ 1.000.000 = 1,0986 ✓.
  - PPC $1,0976 (inferido). En USD: (US$ 6.046,6942 + US$ 723,0486) ÷ 9.000.000 = US$ 6.769,7428 ÷ 9.000.000 = US$ 0,000752 ("declarado", la etiqueta más grave que hereda).
  - Resultado: **+$237.600 (+2,41%)** y US$ 6.534,0395 − US$ 6.769,7428 = **−US$ 235,7033 (−3,48%)**.
  - Reparto en dólares: activo +146,1433 + 16,7171 = +162,8604; TC −384,8023 − 13,7613 = −398,5636; suma −235,7033 ✓. Mostrado: +162,86 − 398,56 = −235,70 ✓.
- **Sin CCL de compra:** YPFD (PPP $48.200), **+$1.230.000 (+8,51%)**; TXMJ0 (PPP $1,0050), **+$130.000 (+2,59%)**; FIMA (PPP $4,6200), **+$240.000 (+4,16%)**. Su resultado en USD es "sin dato" (D-14).
- **Totales:**
  - Valor de las posiciones, $93.041.800; costo, $84.508.300; resultado ARS **+$8.533.500 (+10,10%)**.
  - Resultado USD **sin dato** (D-65). Suma parcial (SPY, S13N6 y T30J7): 1.787,9335 + 78,2217 − 235,7033 = **+US$ 1.630,4519**, que se muestra +US$ 1.630,45.
  - Columna "Activo / TC en $": activo 2.768.078,58 + 1.230.000 + 489.900 + 237.600 + 130.000 + 240.000 = $5.095.578,58 (se muestra $5.095.579); TC $3.437.921,42. Suman $8.533.500 ✓.
  - Columna "Activo / TC en US$", parcial: activo +2.276,96 y TC −646,51, que suman +1.630,45 ✓.

**Evolución (octubre hasta el 14/10, financiero, USD).**
- Puente: 65.420,00 + aportes 2.000,00 + activos 1.780,48 − TC 1.850,31 + cuotas 0,00 + sin atribuir 0,00 = **US$ 67.350,17** ✓, que es el financiero del 14/10. El inicial, los aportes y el reparto son ilustrativos; el final sale del set.
- "Sin atribuir" vale 0 porque las dos puntas son cargas completas.
- La línea de capital aportado arranca en 65.420,00 y llega a 67.420,00.
- La Revisión lo redondea: activos +US$ 1.780 y CCL −US$ 1.850.

**Leasing.**
- Al 14/10 hay 14 de 48 cuotas pagadas: la 14 vence el sáb 17/10 y la empresa la pagó el vie 09/10; la 15 vence el mar 17/11.
- Pagado: 14 × $1.150.000 = $16.100.000 (el "$16,1 M" de 4.11). Faltan 34 × $1.150.000 = $39.100.000 = US$ 25.255,13.
- La cuota en dólares: hoy, 1.150.000 ÷ 1.548,20 = US$ 742,80; en la cuota 1, 1.150.000 ÷ 1.260,96 = US$ 912,00.
- Índice de la cuota en dólares (cuota 1 = 100): 742,80 ÷ 912,00 × 100 = **81,4** (exacto, 81,4468).
- Tu parte de la camioneta: $38.000.000 − $21.400.000 = $16.600.000 = US$ 10.722,13.

**Flujo de octubre (fase 2).**
- Ingreso: US$ 4.000 × 1.541,00 = $6.164.000, más el fijo de $2.500.000 = $8.664.000.
- Consumo por diferencia de saldos: $3.910.000 = US$ 2.537,31 al cripto del mes.
- Ahorro: $8.664.000 − $3.910.000 = $4.754.000 = US$ 3.085,01. Tasa: 4.754.000 ÷ 8.664.000 = 54,87%.
- Proyectado: $6.164.000 + $2.500.000 − gastos fijos $3.400.000 − cuota $0 (la paga la empresa) = $5.264.000.

**Proyecciones (ilustrativas, pero coherentes).**
- 20,7% de las corridas debajo de lo aportado son 21 de los 100 puntos ✓.
- Si el 34% de las corridas no cruza antes de dic-2027, el p90 no cruza y la mediana sí (nov-2027) ✓.
- El p10 cae en sep-2027, el primer mes evaluable: de oct-2026 a sep-2027 están tus primeros 12 meses con resultado (D-49) ✓.
- Comparar: US$ 101.300 → US$ 94.800 = −US$ 6.500 ✓.
- Lo aportado a dic-2027, US$ 95.420, es tu patrimonio de la primera carga más US$ 30.000 de aportes, un supuesto ilustrativo.

**Teléfono, Hoy (4.1).** El viewport `iPhone 13` de Playwright mide 390 × 664 px. Menos la barra inferior de 56 px, quedan 608.
- Al cerrar la 1b: 48 + 132 + 2 × 112 + 48 + 44 = 496 px.
- Con la línea de veredicto (fase 4, 44 px): 540 px.
- Con el botón "Todavía no cargaste hoy" (52 px): 592 ≤ 608 ✓.
