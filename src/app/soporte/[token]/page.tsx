import { createClient } from '@/lib/supabase/server'
import { PORTAL_ERRORS, type PortalTicket } from './messages'
import Client from './client'

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('portal_tickets', { p_token: token })

  if (error || !data) {
    const code = error?.code ?? ''
    return (
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
        <div className="card" style={{ maxWidth: 420, textAlign: 'center', padding: 32 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Soporte</h1>
          <p style={{ color: 'var(--mut)', marginBottom: 4 }}>{PORTAL_ERRORS[code] ?? 'El enlace no es válido.'}</p>
          <p style={{ color: 'var(--mut)', fontSize: 14 }}>Pídele a la empresa que te genere un enlace nuevo desde la ficha del cliente.</p>
        </div>
      </main>
    )
  }

  return <Client token={token} initial={data as unknown as PortalTicket[]} />
}