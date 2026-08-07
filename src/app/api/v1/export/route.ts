import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { route } from '@/lib/api/handler'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { forbidden } from '@/lib/api/errors'
import { can, ROUTE_PERMISSIONS } from '@/lib/auth/permissions'

/**
 * Server-side XLSX export.
 *
 * Rows come from the caller's own already-RLS-filtered view, so this does not
 * widen what anyone can read. What it adds is the permission check that the
 * old browser-side export never had, a rate limit, and formula escaping.
 */

const MAX_ROWS = 20_000

const bodySchema = z.object({
  module: z.string().min(1).max(40),
  filename: z
    .string()
    .min(1)
    .max(80)
    // Anything that could steer the download somewhere else is stripped:
    // path separators, traversal, and control characters.
    .regex(/^[\w\-. áéíóúñÁÉÍÓÚÑ]+$/u, 'Nombre de archivo inválido.'),
  rows: z.array(z.record(z.string(), z.unknown())).max(MAX_ROWS),
})

/**
 * Neutralises spreadsheet formula injection.
 *
 * A cell whose text begins with `=`, `+`, `-`, `@`, or a tab/CR is parsed as a
 * formula by Excel, LibreOffice and Sheets. Since these values originate from
 * user-entered records (ticket subjects, employee names), an export can
 * otherwise smuggle `=HYPERLINK(...)` or a DDE payload into a colleague's
 * machine. Prefixing with an apostrophe forces literal text.
 */
function sanitizeCell(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value

  const text = String(value)
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

export const POST = route({
  body: bodySchema,
  rateLimit: RATE_LIMITS.export,
  async handler({ body, member }) {
    // Reuse the route→permission map rather than a second list that can drift.
    const permission = ROUTE_PERMISSIONS[body.module]
    if (!permission || !can(member.permissions, permission)) {
      throw forbidden(`No tienes permiso para exportar ${body.module}.`)
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Kigyo'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Datos', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    // Union of keys across all rows, so a field missing from the first record
    // does not silently drop its column for every other record.
    const columns = [...new Set(body.rows.flatMap((row) => Object.keys(row)))]

    if (columns.length === 0) {
      sheet.addRow(['Sin datos'])
    } else {
      sheet.columns = columns.map((key) => ({
        header: key,
        key,
        width: Math.min(Math.max(key.length + 4, 12), 48),
      }))
      sheet.getRow(1).font = { bold: true }

      for (const row of body.rows) {
        sheet.addRow(
          Object.fromEntries(columns.map((key) => [key, sanitizeCell(row[key])])),
        )
      }
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
    }

    const buffer = await workbook.xlsx.writeBuffer()

    console.info('[export]', {
      module: body.module,
      rows: body.rows.length,
      orgId: member.orgId,
      userId: member.userId,
    })

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${encodeURIComponent(body.filename)}.xlsx"`,
        'cache-control': 'no-store',
      },
    })
  },
})
