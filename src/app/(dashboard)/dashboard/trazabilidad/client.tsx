'use client'

import { useMemo, useState } from 'react'
import { FileSpreadsheet } from '@/lib/icons'
import { useExport } from '@/lib/hooks/use-export'
import TabBar from '@/components/ui/TabBar'
import { AUDIT_CATEGORIES, type AuditCategory, type AuditEntry } from '@/lib/audit'

/**
 * Audit trail.
 *
 * Entries come from `audit_log`, written by a database trigger on every
 * business table. The screen previously rendered a hardcoded list of three
 * days of invented activity.
 */
export default function TrazabilidadPage({ entries }: { entries: AuditEntry[] }) {
  const { runExport, exporting } = useExport()
  const [filter, setFilter] = useState<AuditCategory>('Todos')

  const visible = useMemo(
    () => (filter === 'Todos' ? entries : entries.filter((e) => e.category === filter)),
    [entries, filter],
  )

  const groups = useMemo(() => {
    const out: { group: string; items: AuditEntry[] }[] = []
    for (const entry of visible) {
      const last = out[out.length - 1]
      if (last && last.group === entry.group) last.items.push(entry)
      else out.push({ group: entry.group, items: [entry] })
    }
    return out
  }, [visible])

  const exportLog = () => {
    void runExport(
      visible.map((e) => ({
        Fecha: new Date(e.occurredAt).toLocaleDateString('es-CO'),
        Hora: e.time,
        Quién: e.actor,
        Acción: e.action,
        Registro: e.target,
        Tipo: e.category,
        'Campos modificados': e.changedFields.join(', '),
      })),
      'trazabilidad-kigyo',
      'trazabilidad',
    )
  }

  return (
    <div className="card rise d1">
      <div className="chead">
        <TabBar
          value={filter}
          onChange={(v) => setFilter(v as AuditCategory)}
          items={AUDIT_CATEGORIES.map((c) => ({ key: c, label: c }))}
        />
        <button
          type="button"
          disabled={exporting || visible.length === 0}
          aria-busy={exporting}
          className="btn"
          data-tip="Exportar a Excel"
          onClick={exportLog}
        >
          <FileSpreadsheet size={14} aria-hidden="true" />
          Exportar
        </button>
      </div>

      {visible.length === 0 ? (
        <p style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--ink3)', fontSize: 13.5 }}>
          {entries.length === 0
            ? 'Todavía no hay actividad registrada. Cada cambio en la plataforma quedará aquí automáticamente.'
            : `No hay actividad de tipo "${filter}".`}
        </p>
      ) : (
        <ol className="tl">
          {groups.map((group) => (
            <li key={group.group}>
              <h2 className="tlg">{group.group}</h2>
              <ol>
                {group.items.map((entry, i) => (
                  <li className={`tli ${i === group.items.length - 1 ? 'last' : ''}`} key={entry.id}>
                    <div className="tlrail" aria-hidden="true">
                      <div className={`tlnode ${entry.destructive ? 'red' : ''}`} />
                    </div>
                    <div className="tlbody">
                      <div className="tltop">
                        <div className="tltxt">
                          <b>{entry.actor}</b> {entry.action}
                          {entry.target && <> <span className="mono">{entry.target}</span></>}
                          {entry.changedFields.length > 0 && (
                            <span style={{ color: 'var(--ink3)' }}>
                              {' '}· {entry.changedFields.slice(0, 4).join(', ')}
                              {entry.changedFields.length > 4 && ` +${entry.changedFields.length - 4}`}
                            </span>
                          )}
                        </div>
                        <time className="tltime mono" dateTime={entry.occurredAt}>{entry.time}</time>
                      </div>
                      <span className="tltag">{entry.category}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
