'use client'

import Link from 'next/link'
import { ArrowRight, Check, LayoutGrid, Lock, Users } from '@/lib/icons'
import { useMember } from '@/lib/context/MemberContext'
import { companyType, isModuleKey, sectorStart } from '@/lib/modules'
import { lowestPlanWith, planModules } from '@/lib/plans'

/**
 * What a brand-new account sees instead of a dashboard of zeros.
 *
 * The old landing was five KPIs reading 0, an empty chart and two empty lists.
 * That is not a report — it is a blank page with decorations, and it answers
 * none of the three questions somebody has ten seconds after signing up: what
 * did choosing my sector actually do, what can I do now, and where is the rest.
 *
 * So it answers all three, in that order, and then gets out of the way: the
 * panel is rendered only while `isEmpty` holds, so it disappears on its own the
 * moment the account has anything in it. Nothing to dismiss, nothing to
 * remember, and no "welcome" card still sitting there in month four.
 */
export default function PrimerosPasos() {
  const member = useMember()
  const sector = companyType(member.companyType)

  /**
   * The half of the sector's preset the plan does not carry.
   *
   * For most sectors this contains the module that gives the sector its name —
   * a clinic on Starter has no `pacientes`. That is a pricing decision, not a
   * bug, and the honest thing on this screen is to name the module and the
   * plan that unlocks it rather than let its absence from the sidebar be
   * discovered as a fault. Recomputed from the same catalogue the sidebar
   * resolves against, so it can only say what is true.
   */
  const locked = member.companyType
    ? sectorStart(member.companyType, planModules(member.plan)).locked
    : []
  /**
   * The one worth naming: the sector's own module if it is locked, else the
   * first. Listing ten module names here would be a wall, not an offer.
   *
   * Read off `sector.vertical`, not off a key comparison. The sector key and
   * its module key coincide for four of the seven — `agro`, `ecommerce`,
   * `inmobiliario`, `hoteleria` — and differ for the three that matter most
   * here: matching on the key put «Nómina» in this sentence for a clinic whose
   * missing module is «Pacientes».
   */
  const headline = locked.find((m) => m.key === sector?.vertical) ?? locked[0]
  const headlinePlan = headline ? lowestPlanWith(headline.key) : null

  const canManage = member.can('configuracion:manage')
  const canAddPeople = member.can('empleados:write')

  /**
   * Switchable modules only.
   *
   * `member.modules` is the resolved set, which folds in `dashboard` and
   * `configuracion` — the shell, not modules. Counting them made the panel
   * offer "37 módulos" against a catalogue of 35, and a number the user can go
   * and check is a number that has to be right.
   */
  const activeCount = member.modules.filter(isModuleKey).length

  return (
    <section className="fr-panel" aria-labelledby="fr-title">
      <div className="fr-head">
        <h2 className="fr-title" id="fr-title">Empecemos por lo primero</h2>
        <p className="fr-sub">
          {sector
            ? <>Tu cuenta está configurada como <b>{sector.label}</b>. Estos son los siguientes pasos.</>
            : <>Tu cuenta está lista. Elige el sector de tu empresa y Kigyo se ajusta a él.</>}
        </p>
      </div>

      <ol className="fr-steps">
        {/* Ordered by what unblocks the most: without people in the directory,
            most modules have nothing to show and every other step is theatre. */}
        {canAddPeople && (
          <li className="fr-step">
            <span className="fr-step-ico"><Users size={15} /></span>
            <div className="fr-step-body">
              <div className="fr-step-name">Agrega a tu equipo</div>
              <p className="fr-step-desc">
                El directorio es de donde salen asistencia, nómina y las asignaciones
                de casi todo lo demás.
              </p>
            </div>
            <Link className="btn fr-step-go" href="/dashboard/empleados">
              Ir a Empleados<ArrowRight size={14} />
            </Link>
          </li>
        )}

        {canManage && (
          <li className="fr-step">
            <span className="fr-step-ico"><LayoutGrid size={15} /></span>
            <div className="fr-step-body">
              <div className="fr-step-name">
                {sector ? 'Revisa qué módulos tienes activos' : 'Elige el sector de tu empresa'}
              </div>
              <p className="fr-step-desc">
                {sector
                  ? <>
                      {activeCount} activos ahora mismo, partiendo del preset de {sector.label}.
                      Enciende o apaga lo que sobre o falte.
                    </>
                  : <>Sin sector, empiezas con el catálogo completo: {activeCount} módulos en el menú.</>}
              </p>
            </div>
            <Link className="btn fr-step-go" href="/dashboard/configuracion">
              {sector ? 'Ajustar módulos' : 'Elegir sector'}<ArrowRight size={14} />
            </Link>
          </li>
        )}

        {canManage && (
          <li className="fr-step">
            <span className="fr-step-ico"><Check size={15} /></span>
            <div className="fr-step-body">
              <div className="fr-step-name">Define quién ve qué</div>
              <p className="fr-step-desc">
                Crea los roles que usa tu empresa —«Médico», «Recepción», «Residente
                de obra»— y decide qué abre cada uno.
              </p>
            </div>
            <Link className="btn fr-step-go" href="/dashboard/configuracion">
              Roles y permisos<ArrowRight size={14} />
            </Link>
          </li>
        )}
      </ol>

      {/*
        The limit, named rather than left to be discovered.

        A clinic that picked «Salud» at signup does not get `pacientes` on the
        entry plan. Saying nothing here does not spare anyone the
        disappointment — it just moves it to the moment they go looking for the
        module and cannot find it, which reads as the product being broken
        rather than as a plan they can change.
      */}
      {headline && headlinePlan && (
        <div className="fr-locked">
          <span className="fr-locked-ico"><Lock size={13} aria-hidden="true" /></span>
          <p>
            <b>{headline.label}</b>
            {locked.length > 1 && <> y {locked.length - 1} módulo{locked.length - 1 === 1 ? '' : 's'} más</>}
            {' '}se activan con el plan {headlinePlan.label}.
            {sector && headline.key === sector.vertical && (
              <> Es el módulo central de {sector.label}.</>
            )}
          </p>
          <Link className="btn fr-locked-go" href="/pricing">Ver planes</Link>
        </div>
      )}
    </section>
  )
}
