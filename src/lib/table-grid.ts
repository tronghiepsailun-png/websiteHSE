/** Full spreadsheet-style cell borders for data tables that benefit from an Excel-style grid
 *  look — border-separate (not collapse) so sticky columns keep working. Shared across any
 *  module's tables, not specific to the incidents report sheets it originated from. */
export const REPORT_GRID_CLASS = "border-separate border-spacing-0 [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border";
