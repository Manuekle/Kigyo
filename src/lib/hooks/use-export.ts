'use client'

import { useCallback, useState } from 'react'
import { useApp } from '@/lib/context/AppContext'
import { errorMessage } from '@/lib/api/client'
import { exportExcel } from '@/lib/utils'

/**
 * Wraps the server-side XLSX export with the toast and busy state every call
 * site needs. Building the workbook is now a network round trip, so the old
 * fire-and-forget `exportExcel(...); addToast('ok')` would report success
 * before the request had even been answered — and swallow failures entirely.
 */
export function useExport() {
  const { addToast } = useApp()
  const [exporting, setExporting] = useState(false)

  const runExport = useCallback(
    async (rows: Record<string, unknown>[], filename: string, module: string) => {
      if (exporting) return

      if (rows.length === 0) {
        addToast('No hay filas para exportar', 'info')
        return
      }

      setExporting(true)
      try {
        await exportExcel(rows, filename, module)
        addToast(`${rows.length} filas exportadas`, 'ok')
      } catch (error) {
        addToast(errorMessage(error, 'No se pudo exportar el archivo'), 'err')
      } finally {
        setExporting(false)
      }
    },
    [addToast, exporting],
  )

  return { runExport, exporting }
}
