/**
 * Neutralises spreadsheet formula injection.
 *
 * A cell whose text begins with `=`, `+`, `-`, `@`, or a tab/CR is parsed as a
 * formula by Excel, LibreOffice and Google Sheets. Exported values come from
 * user-entered records — ticket subjects, employee names, supplier names — so
 * without this an export can carry `=HYPERLINK(...)` or a DDE payload onto a
 * colleague's machine, and the colleague has every reason to trust the file.
 *
 * Prefixing with an apostrophe forces the cell to be read as literal text; the
 * apostrophe itself is not displayed.
 */
export function sanitizeCell(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value

  const text = String(value)
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

/**
 * Union of keys across every row.
 *
 * Taking the keys of the first row alone silently dropped a column whenever
 * the first record happened to be missing an optional field.
 */
export function columnsOf(rows: Record<string, unknown>[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))]
}
