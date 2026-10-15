// El tema de la grilla (AG Grid 36, Theming API): Quartz con los parámetros
// mapeados a las variables CSS de los tokens (globals.css). Como son var(…),
// la misma grilla anda en oscuro, en claro y con la paleta daltónica sin
// volver a armarse. Lo que los parámetros no cubren (encabezado en mayúsculas
// con tracking, números a la derecha) está en globals.css, bajo ".grilla".

import { themeQuartz } from 'ag-grid-community'

export const ALTO_ENCABEZADO = 40
export const ALTO_FILA = 44
/** Con el dedo (D-30, D-100), el encabezado (que ordena) y cada fila miden al menos esto. */
export const ALTO_TOCABLE = 44

export const temaGrilla = themeQuartz.withParams({
  browserColorScheme: 'inherit',
  // Superficie de tarjeta con hairline y radio 14: la grilla ES la tarjeta.
  backgroundColor: 'var(--surface)',
  foregroundColor: 'var(--text)',
  textColor: 'var(--text)',
  subtleTextColor: 'var(--text-muted)',
  borderColor: 'var(--border)',
  chromeBackgroundColor: 'var(--surface)',
  wrapperBorder: { width: 1, style: 'solid', color: 'var(--border)' },
  wrapperBorderRadius: 14,
  borderRadius: 6,
  // Filas: hairline entre filas, sin bordes de columna; al pasar, surface-2.
  rowBorder: { width: 1, style: 'solid', color: 'var(--border)' },
  columnBorder: false,
  rowHoverColor: 'var(--surface-2)',
  oddRowBackgroundColor: 'var(--surface)',
  selectedRowBackgroundColor: 'var(--surface-2)',
  // Encabezado en mono 10 px, --text-muted (mayúsculas y tracking en globals.css).
  headerBackgroundColor: 'var(--surface)',
  headerTextColor: 'var(--text-muted)',
  headerFontFamily: 'var(--fuente-mono)',
  headerFontSize: 10,
  headerFontWeight: 500,
  headerHeight: ALTO_ENCABEZADO,
  headerRowBorder: { width: 1, style: 'solid', color: 'var(--border)' },
  headerColumnBorder: false,
  headerCellHoverBackgroundColor: 'var(--surface-2)',
  // Cuerpo en Geist 13 px; las celdas numéricas pasan a mono con .grilla-numero.
  fontFamily: 'var(--fuente-sans)',
  fontSize: 13,
  dataFontSize: 13,
  cellTextColor: 'var(--text)',
  rowHeight: ALTO_FILA,
  cellHorizontalPadding: 12,
  // La fila de totales, fija abajo: surface-2, en 500.
  pinnedRowBackgroundColor: 'var(--surface-2)',
  pinnedRowBorder: { width: 1, style: 'solid', color: 'var(--border-strong)' },
  pinnedRowFontWeight: 500,
  // Íconos de orden y foco del teclado.
  iconColor: 'var(--text-muted)',
  accentColor: 'var(--accent)',
  rangeSelectionBorderColor: 'var(--focus)',
  focusShadow: { radius: 0, spread: 2, color: 'var(--focus)' },
})
