import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

/**
 * La vista pública de un enlace de portal.
 *
 * Sin autenticación: el token *es* la credencial. Toda la defensa vive en
 * `public.portal_view` (vencimiento, revocación, límite de vistas, rate
 * limit), y esta página solo pinta lo que el RPC devuelve — nunca consulta
 * tablas directamente, así que no hay forma de que un error de paginación
 * filtre más de lo que el token autoriza.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface PortalViewPayload {
  error?: string
  kind?: string
  org?: string | null
  payload?: Record<string, unknown> | null
}

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
const HOUR = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
})

const pesos = (cents: unknown) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    .format(Number(cents ?? 0) / 100)

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
const dateStr = (v: unknown) => (typeof v === 'string' ? DAY.format(new Date(`${v}T12:00:00`)) : null)
const stampStr = (v: unknown) =>
  typeof v === 'string' ? HOUR.format(new Date(v)) : null

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--line2)' }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('portal_view', { p_token: token })
  if (error) {
    console.error('[portal] view', error)
  }

  const view = (data as PortalViewPayload | null) ?? null
  const payload = view?.payload ?? null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 440, margin: 0 }}>
        <div className="chead">
          <div className="ctitle">Kigyo</div>
          <div className="csub">
            {view?.org ? `${view.org} te comparte esto` : 'Documento compartido'}
          </div>
        </div>

        <div className="cpad" style={{ paddingTop: 4 }}>
          {!view || view.error || !payload ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Este enlace no está disponible</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                Puede haber vencido, haber sido revocado o haber agotado sus vistas.
                Pide a quien te lo envió que genere uno nuevo.
              </div>
            </div>
          ) : (
            <>
              {view.kind === 'factura' && (
                <>
                  <Row label="Factura" value={str(payload.code) ?? '—'} />
                  <Row label="Cliente" value={str(payload.client) ?? '—'} />
                  <Row label="Estado" value={str(payload.status) ?? '—'} />
                  <Row label="Emitida" value={dateStr(payload.issuedOn) ?? '—'} />
                  {dateStr(payload.dueOn) && <Row label="Vence" value={dateStr(payload.dueOn) as string} />}
                  <Row label="Total" value={pesos(payload.totalCents)} />
                  <Row label="Pagado" value={pesos(payload.paidCents)} />
                </>
              )}

              {view.kind === 'cita' && (
                <>
                  <Row label="Paciente" value={str(payload.patient) ?? '—'} />
                  <Row label="Tipo" value={str(payload.kind) ?? '—'} />
                  <Row label="Cuándo" value={stampStr(payload.scheduledFor) ?? '—'} />
                  <Row label="Estado" value={str(payload.status) ?? '—'} />
                  {str(payload.professional) && (
                    <Row label="Profesional" value={str(payload.professional) as string} />
                  )}
                </>
              )}

              {view.kind === 'avance' && (
                <>
                  <Row label="Obra" value={str(payload.name) ?? '—'} />
                  {str(payload.client) && <Row label="Cliente" value={str(payload.client) as string} />}
                  <Row label="Estado" value={str(payload.estado) ?? '—'} />
                  <Row
                    label="Avance"
                    value={`${Number(payload.avancePct ?? 0).toLocaleString('es-CO')} %`}
                  />
                  <Row label="Valor ejecutado" value={pesos(payload.valorEjecutado)} />
                  <Row label="Valor total" value={pesos(payload.valorPresupuestado)} />
                </>
              )}

              <div className="muted" style={{ fontSize: 11.5, marginTop: 14, lineHeight: 1.5 }}>
                Enlace personal de solo lectura. Compartirlo da acceso a quien lo reciba;
                pide uno nuevo si esto no era para ti.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
