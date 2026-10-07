# Instrucciones para trabajar en este repo

App personal de gestión de inversiones, de un solo usuario. Antes de tocar nada, leé:
- `docs/spec.md`: qué pidió el dueño (manda).
- `docs/decisiones.md`: cómo se ajustó el spec y por qué.
- `docs/carga-diaria.md`: formatos de entrada.

## Reglas que no se negocian

- **Documentación en el mismo commit.** Todo cambio de comportamiento, schema o UI actualiza en ese commit:
  - `CHANGELOG.md`;
  - `docs/decisiones.md`, si se decidió algo;
  - el documento de la sección afectada.

  Un cambio sin su documentación no está terminado.
- **Schema solo por migración** nueva en `supabase/migrations/`. Nunca se edita una migración ya aplicada; nunca se corre SQL suelto que cambie el schema. Después de cada migración se regeneran los tipos de TypeScript.
- **No se guarda estado derivado.** Posiciones, PPC, totales y excedentes se calculan.
- **Cálculos en funciones puras con test**, que devuelven el valor junto con la fórmula y sus insumos (trazabilidad). Nunca inline en el JSX.
- **"Sin dato", nunca cero.** No se inventan ni estiman precios, tipos de cambio ni valuaciones.
- **Toda cifra existe en ARS y en USD.**
- **La base está cerrada:** solo el servidor accede, con `service_role`. El navegador nunca habla con Supabase.
- **Los datos reales del dueño no van a git.** Los tests usan fixtures con números inventados.
- **Mobile:** sin scroll horizontal en ningún ancho; debajo de 768 px las tablas pasan a tarjetas. El test de layout (D-30) tiene que pasar antes de cualquier deploy.
- **Sin recomendaciones de inversión** ni APIs de precios o brókers.
- Interfaz en español rioplatense (vos).
