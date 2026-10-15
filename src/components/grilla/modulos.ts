// Los módulos de AG Grid Community que usa la app, y nada más (no se carga
// AllCommunityModule): el modelo de filas del cliente y el orden ya vienen en
// el núcleo de la versión 36. Se registran una sola vez, al importar la grilla.
//
// - PinnedRowModule: la fila de totales fija abajo (pinnedBottomRowData).
// - RowAutoHeightModule: filas que crecen con su contenido (columnas altoAuto).
// - CellStyleModule y RowStyleModule: las clases de las celdas numéricas y de
//   la primera fila de un grupo.
// - RenderApiModule: volver a dibujar las celdas de grupo al cambiar el orden.
//
// En desarrollo se prenden las validaciones de AG Grid (avisos con nombre y
// explicación); en producción no pesan.

import { CellStyleModule, enableDevValidations, ModuleRegistry, PinnedRowModule, RenderApiModule, RowAutoHeightModule, RowStyleModule } from 'ag-grid-community'

let registrados = false

export function registrarModulos(): void {
  if (registrados) return
  registrados = true
  ModuleRegistry.registerModules([PinnedRowModule, RowAutoHeightModule, CellStyleModule, RowStyleModule, RenderApiModule])
  if (process.env.NODE_ENV === 'development') enableDevValidations()
}
