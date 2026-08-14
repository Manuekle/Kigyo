'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, Plus, ArrowRight } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import FormDrawer from '@/components/ui/FormDrawer'
import { useApp } from '@/lib/context/AppContext'
import { useMember } from '@/lib/context/MemberContext'
import { companyType } from '@/lib/modules'
import { createCompany, joinCompany, switchCompany } from '@/server/mutations/companies'
import type { AccountCompany } from '@/server/queries/companies'

/**
 * The businesses under the subscription.
 *
 * Two things happen here that happen nowhere else in the product, and both are
 * account-level rather than company-level:
 *
 *   · creating a company, which spends a slot on the plan;
 *   · joining one — the deliberate, logged act by which somebody who governs
 *     the account gains access to a company's data. Governing the account does
 *     not grant that on its own, and it is not supposed to.
 *
 * A company the caller has not joined shows its name and its sector and nothing
 * else. That is all `account_companies()` returns, on purpose: knowing a
 * business exists is not knowing what is inside it.
 *
 * ─── There is no "nueva cuenta" button any more ────────────────────────────
 *
 * There used to be one, right beside "Nueva empresa", and the two did almost
 * the same thing: both ended with a new company you were standing in. The
 * difference — that one of them also started a second subscription, on Starter,
 * billed separately from the plan you already pay for — was explained in a
 * paragraph inside the drawer, which is where product decisions go to be
 * misread.
 *
 * One person, one account. The account is the subscription; companies are what
 * you operate. Somebody who genuinely needs a second subscription can register
 * a second login, which is rare enough to be worth the friction and honest
 * about what it costs.
 */

const EMPTY = { name: '' }

export default function Client({ companies }: { companies: AccountCompany[] }) {
  const member = useMember()
  const router = useRouter()
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()
  /** The account a new company is being created in, or null when closed. */
  const [creating, setCreating] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [joining, setJoining] = useState<AccountCompany | null>(null)
  const [joinRole, setJoinRole] = useState('Empleado')

  const plan = member.planDef

  /**
   * The companies, grouped by the group that pays for them.
   *
   * `account_companies()` spans every account the caller governs, so this
   * screen has always had the rows — it just showed them as one flat list,
   * which was correct while nobody could have two groups and misleading the
   * moment they can: two companies with the same name under different
   * subscriptions would have been indistinguishable.
   *
   * Ordered with the active company's group first: it is the one being worked
   * in, and pushing it below an alphabetically luckier group is a small daily
   * annoyance.
   */
  const groups: Array<{ accountId: string; name: string; companies: AccountCompany[] }> = []
  for (const company of companies) {
    const existing = groups.find((g) => g.accountId === company.accountId)
    if (existing) existing.companies.push(company)
    else groups.push({ accountId: company.accountId, name: company.accountName, companies: [company] })
  }
  groups.sort((a, b) =>
    a.accountId === member.account.accountId ? -1 : b.accountId === member.account.accountId ? 1 : 0,
  )

  /** Only the active group's plan is in hand; the rest let the server answer. */
  function canCreateIn(accountId: string, used: number) {
    if (accountId !== member.account.accountId) return true
    return plan.maxCompanies === null || used < plan.maxCompanies
  }

  /**
   * Creates the company and hands it straight to the wizard.
   *
   * Only the name is asked for here. The sector used to be a dropdown in this
   * drawer, which was the worst place in the product to answer the question:
   * no subsector, no module preview, no word about which of them the plan
   * covers — and since migration 41 the sector is a decision that sticks once
   * the company has data, so answering it blind in a side panel is not a thing
   * to offer.
   *
   * `/onboarding` asks all of it properly, and now runs per company rather than
   * per account, so the new company gets the same setup the first one did
   * instead of inheriting its answers.
   */
  function submitCreate() {
    const accountId = creating
    if (!accountId) return
    startTransition(async () => {
      const result = await createCompany({ name: form.name, sector: null, accountId })
      if (!result.ok) {
        addToast(result.error, 'err')
        return
      }
      setCreating(null)
      setForm(EMPTY)
      // `createCompany` already moved the context into the new company, so the
      // wizard opens on it.
      router.push('/onboarding')
      router.refresh()
    })
  }

  function submitJoin() {
    if (!joining) return
    const target = joining
    startTransition(async () => {
      const result = await joinCompany({ orgId: target.orgId, role: joinRole })
      if (!result.ok) {
        addToast(result.error, 'err')
        return
      }
      setJoining(null)
      addToast(`Te uniste a ${target.name}. Queda en su trazabilidad.`, 'ok')
      await switchCompany(target.orgId)
      router.push('/dashboard')
      router.refresh()
    })
  }

  function open(orgId: string) {
    startTransition(async () => {
      const result = await switchCompany(orgId)
      if (!result.ok) {
        addToast(result.error, 'err')
        return
      }
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap', marginBottom: 18,
        }}
      >
        <p className="psub" style={{ margin: 0 }}>
          {groups.length > 1
            ? `${groups.length} cuentas · ${companies.length} ${companies.length === 1 ? 'empresa' : 'empresas'}`
            : plan.maxCompanies === null
              ? `Cuenta ${member.account.name} · plan ${plan.label} · empresas ilimitadas`
              : `Cuenta ${member.account.name} · plan ${plan.label} · ${companies.length} de ${plan.maxCompanies} ${plan.maxCompanies === 1 ? 'empresa' : 'empresas'}`}
        </p>
      </div>

      {groups.map((group) => {
        const isActiveAccount = group.accountId === member.account.accountId
        const canCreate = canCreateIn(group.accountId, group.companies.length)
        return (
          <section key={group.accountId} style={{ marginBottom: 26 }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, flexWrap: 'wrap', marginBottom: 10,
              }}
            >
              <div>
                <strong style={{ fontSize: 13.5 }}>{group.name}</strong>
                <span style={{ fontSize: 12, color: 'var(--ink3)', marginLeft: 8 }}>
                  {/* The plan is only named for the group being worked in: it is
                      the only one whose tier the session carries, and guessing
                      at the others would be worse than staying quiet. */}
                  {isActiveAccount ? `plan ${plan.label} · ` : ''}
                  {group.companies.length} {group.companies.length === 1 ? 'empresa' : 'empresas'}
                </span>
              </div>
              <button
                className="btn"
                onClick={() => { setCreating(group.accountId); setForm(EMPTY) }}
                disabled={!canCreate || pending}
                title={canCreate ? undefined : `Tu plan ${plan.label} no permite más empresas.`}
              >
                <Plus size={15} />Nueva empresa
              </button>
            </div>

            <div className="g3">
              {group.companies.map((company) => {
                const sector = companyType(company.companyType)
                const isActive = company.orgId === member.orgId
                return (
                  <div key={company.orgId} className="card" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <Building2 size={18} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 14.5 }}>{company.name}</strong>
                          {isActive && <Badge st="Activa" tone="grn" />}
                          {!company.joined && <Badge st="No perteneces" tone="neu" />}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 3 }}>
                          {sector?.label ?? 'Sin sector'}
                          {company.role ? ` · ${company.role}` : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      {company.joined ? (
                        <button
                          className="btn"
                          onClick={() => open(company.orgId)}
                          disabled={isActive || pending}
                        >
                          {isActive ? <><Check size={14} />Estás aquí</> : <><ArrowRight size={14} />Abrir</>}
                        </button>
                      ) : (
                        <button
                          className="btn"
                          onClick={() => { setJoining(company); setJoinRole('Empleado') }}
                          disabled={pending}
                        >
                          Unirme
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <FormDrawer
        open={creating !== null}
        onClose={() => setCreating(null)}
        title="Nueva empresa"
        footer={
          <button
            className="btn dark"
            disabled={pending || !form.name.trim()}
            onClick={submitCreate}
          >
            <ArrowRight size={15} />Crear y configurar
          </button>
        }
      >
        <label className="flabel" htmlFor="co-name">Nombre</label>
        <input
          id="co-name"
          className="field"
          value={form.name}
          maxLength={120}
          placeholder="Restaurante del Norte"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        {/* The sector was a dropdown here and is not one any more — see
            `submitCreate`. Saying where it went matters: the button reads
            "Crear y configurar" and the customer should know the next screen is
            part of the same act, not a detour. */}
        <p className="psub" style={{ fontSize: 12.5 }}>
          Al crearla te llevamos al asistente para elegir el sector, los módulos, las
          sucursales y el equipo de esta empresa. Puedes saltarlo y hacerlo después.
        </p>
      </FormDrawer>

      <FormDrawer
        open={joining !== null}
        onClose={() => setJoining(null)}
        title={`Unirme a ${joining?.name ?? ''}`}
        footer={
          <button className="btn dark" disabled={pending} onClick={submitJoin}>
            <Check size={15} />Unirme
          </button>
        }
      >
        {/* Said before the control, not after: an owner letting themselves into
            a company they do not work in should know the people who do work
            there will see it, while they can still decide not to. */}
        <p className="psub" style={{ fontSize: 12.5 }}>
          Administrar la cuenta no da acceso a los datos de una empresa. Unirte sí, y
          queda registrado en la trazabilidad de <strong>{joining?.name}</strong>, donde
          lo verá quien trabaja ahí.
        </p>

        <label className="flabel" htmlFor="co-role">Rol con el que entras</label>
        <Select
          value={joinRole}
          onChange={setJoinRole}
          options={[
            { value: 'Empleado', label: 'Empleado' },
            { value: 'Líder de equipo', label: 'Líder de equipo' },
            { value: 'Administrador', label: 'Administrador' },
          ]}
        />
        <p className="psub" style={{ fontSize: 12.5 }}>
          Empieza por el rol más bajo que te sirva. Entrar como Administrador de una
          empresa que no operas es más acceso del que suele hacer falta.
        </p>
      </FormDrawer>
    </div>
  )
}
