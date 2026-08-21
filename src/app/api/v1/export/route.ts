import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { route } from '@/lib/api/handler'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { forbidden } from '@/lib/api/errors'
import { can, ROUTE_PERMISSIONS } from '@/lib/auth/permissions'
import { moduleOf } from '@/lib/auth/session'
import { columnsOf, sanitizeCell } from '@/lib/export'

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

export const POST = route({
  body: bodySchema,
  rateLimit: RATE_LIMITS.export,
  async handler({ body, member }) {
    /*
     * Las dos puertas, y aquí hay que ponerlas a mano.
     *
     * `route()` aplica módulo y permiso cuando se le pasa `permission` en las
     * opciones, pero esta ruta no puede: el módulo lo trae el cuerpo de la
     * petición, así que el envoltorio no sabe cuál comprobar y su gate no
     * corre. Solo se miraba el permiso, de modo que un módulo apagado en
     * Configuración seguía exportándose por HTTP — su pantalla desaparecía del
     * menú y sus datos salían igual en un Excel.
     *
     * El mapa ruta→permiso se reutiliza en vez de una segunda lista que pueda
     * divergir.
     */
    const permission = ROUTE_PERMISSIONS[body.module]
    if (!permission) {
      throw forbidden(`No tienes permiso para exportar ${body.module}.`)
    }
    if (!member.modules.has(moduleOf(permission))) {
      throw forbidden(`El módulo "${body.module}" no está activo en esta organización.`)
    }
    if (!can(member.permissions, permission)) {
      throw forbidden(`No tienes permiso para exportar ${body.module}.`)
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Kigyo'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Datos', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })

    const columns = columnsOf(body.rows)

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
