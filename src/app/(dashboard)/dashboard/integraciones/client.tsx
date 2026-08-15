'use client'

import { useState, useTransition } from 'react'
import { Lock, ShieldCheck, Zap } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import { useApp } from '@/lib/context/AppContext'
import type { IntegracionesData } from '@/server/queries/integraciones'
import { saveGateway, saveWhatsapp, testGateway, testWhatsapp } from '@/server/mutations/integraciones'

const GATEWAYS = ['wompi', 'payu', 'epayco', 'stripe', 'otro'] as const

function KeyState({ saved }: { saved: boolean }) {
  return saved ? (
    <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <ShieldCheck size={12} color="var(--grnd)" />
      Guardada en el vault
    </span>
  ) : (
    <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
      <Lock size={12} />
      Sin guardar
    </span>
  )
}

export default function IntegracionesPage({ data }: { data: IntegracionesData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [gatewayForm, setGatewayForm] = useState<{
    provider: (typeof GATEWAYS)[number]
    publicKey: string
    privateKey: string
    webhookSecret: string
    enabled: boolean
  }>({
    provider: (data.pagos?.provider as (typeof GATEWAYS)[number]) ?? 'wompi',
    publicKey: data.pagos?.publicKey ?? '',
    privateKey: '',
    webhookSecret: '',
    enabled: data.pagos?.enabled ?? false,
  })
  const [waForm, setWaForm] = useState({
    token: '',
    phoneNumberId: data.whatsapp?.phoneNumberId ?? '',
    enabled: data.whatsapp?.enabled ?? false,
  })
  const [gatewayTest, setGatewayTest] = useState<string | null>(null)
  const [waTest, setWaTest] = useState<string | null>(null)

  function submitGateway() {
    startTransition(async () => {
      const result = await saveGateway(gatewayForm)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setGatewayForm((f) => ({ ...f, privateKey: '', webhookSecret: '' }))
      addToast('Pasarela guardada', 'ok')
    })
  }

  function probeGateway() {
    startTransition(async () => {
      const result = await testGateway()
      setGatewayTest(result.message)
    })
  }

  function submitWa() {
    startTransition(async () => {
      const result = await saveWhatsapp(waForm)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setWaForm((f) => ({ ...f, token: '' }))
      addToast('WhatsApp guardado', 'ok')
    })
  }

  function probeWa() {
    startTransition(async () => {
      const result = await testWhatsapp()
      setWaTest(result.message)
    })
  }

  return (
    <>
      <div className="card rise d1">
        <div className="chead">
          <div className="ctitle">Pasarela de pagos</div>
          <div className="csub">
            Cobra facturas con Wompi u otro proveedor. Las llaves privadas van al vault de
            Supabase — nunca quedan en la tabla ni llegan al navegador.
          </div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 1 150px', minWidth: 120 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Proveedor</div>
              <Select
                value={gatewayForm.provider}
                onChange={(v) => setGatewayForm((f) => ({ ...f, provider: v as (typeof GATEWAYS)[number] }))}
                options={GATEWAYS.map((g) => ({ value: g, label: g === 'wompi' ? 'Wompi' : g.charAt(0).toUpperCase() + g.slice(1) }))}
              />
            </div>
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <div className="flabel">Llave pública</div>
              <input
                className="field mono"
                value={gatewayForm.publicKey}
                placeholder="pub_…"
                onChange={(e) => setGatewayForm((f) => ({ ...f, publicKey: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 220px', minWidth: 180 }}>
              <div className="flabel">Llave privada {state.hasPagosPrivateKey && '· ya guardada'}</div>
              <input
                type="password"
                className="field mono"
                value={gatewayForm.privateKey}
                placeholder={state.hasPagosPrivateKey ? 'Dejar en blanco para conservar la actual' : 'prv_…'}
                autoComplete="new-password"
                onChange={(e) => setGatewayForm((f) => ({ ...f, privateKey: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 220px', minWidth: 180 }}>
              <div className="flabel">Secreto del webhook {state.hasPagosWebhook && '· ya guardado'}</div>
              <input
                type="password"
                className="field mono"
                value={gatewayForm.webhookSecret}
                placeholder={state.hasPagosWebhook ? 'Dejar en blanco para conservar el actual' : 'whsec_…'}
                autoComplete="new-password"
                onChange={(e) => setGatewayForm((f) => ({ ...f, webhookSecret: e.target.value }))}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={gatewayForm.enabled}
                onChange={(e) => setGatewayForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Activa
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn ghost"
                disabled={pending}
                aria-busy={pending}
                onClick={probeGateway}
              >
                <Zap size={14} />Probar
              </button>
              <button
                className="btn dark"
                disabled={pending || !gatewayForm.publicKey}
                aria-busy={pending}
                onClick={submitGateway}
              >
                Guardar
              </button>
            </div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <KeyState saved={state.hasPagosPrivateKey} />
            <KeyState saved={state.hasPagosWebhook} />
            {gatewayTest && (
              <span className="muted" style={{ fontSize: 12.5 }}>
                {gatewayTest}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card rise d2" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">WhatsApp</div>
          <div className="csub">
            WhatsApp Cloud API para despachar las campañas de Marketing. El token de acceso
            vive en el vault; aquí solo queda el phone number id.
          </div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 220px', minWidth: 180 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Phone number ID</div>
              <input
                className="field mono"
                value={waForm.phoneNumberId}
                placeholder="123456789012345"
                onChange={(e) => setWaForm((f) => ({ ...f, phoneNumberId: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 260px', minWidth: 200 }}>
              <div className="flabel">Token de acceso {state.hasWhatsappToken && '· ya guardado'}</div>
              <input
                type="password"
                className="field mono"
                value={waForm.token}
                placeholder={state.hasWhatsappToken ? 'Dejar en blanco para conservar el actual' : 'EAAG…'}
                autoComplete="new-password"
                onChange={(e) => setWaForm((f) => ({ ...f, token: e.target.value }))}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={waForm.enabled}
                onChange={(e) => setWaForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Activo
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn ghost"
                disabled={pending}
                aria-busy={pending}
                onClick={probeWa}
              >
                <Zap size={14} />Probar
              </button>
              <button
                className="btn dark"
                disabled={pending || !waForm.phoneNumberId}
                aria-busy={pending}
                onClick={submitWa}
              >
                Guardar
              </button>
            </div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <KeyState saved={state.hasWhatsappToken} />
            <Badge st={state.whatsapp?.enabled ? 'Activo' : 'Inactivo'} tone={state.whatsapp?.enabled ? 'grn' : 'neu'} />
            {waTest && (
              <span className="muted" style={{ fontSize: 12.5 }}>
                {waTest}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
