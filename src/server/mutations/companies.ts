'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireMember } from '@/lib/auth/session'
import { isCompanyType } from '@/lib/modules'
import { companiesAvailable, planFor } from '@/lib/plans'
import {
  ACTIVE_COMPANY_COOKIE,
  activeCompanyCookieOptions,
} from '@/lib/auth/active-company'

/**
 * Switching which company the app is operating in.
 *
 * The cookie is written *here* and nowhere else. A Server Component cannot set
 * cookies at all — HTTP does not allow it once the response has started
 * streaming — so this has to be a Server Function, and making it the single
 * writer means there is exactly one place where the active company can be
 * chosen and exactly one place that has to check the choice.
 */

export type SwitchResult = { ok: true } | { ok: false; error: string }

const orgIdSchema = z.uuid()

/**
 * Moves the caller into another of their companies.
 *
 * The membership is confirmed by the database, not by this process. `set_active_company`
 * stamps `last_active_at` on a membership belonging to `auth.uid()` and returns
 * whether such a membership existed — so the check and the write are one
 * statement and cannot disagree. Asking here first and writing after would
 * leave a window, however small, where a membership revoked in between is
 * treated as valid.
 *
 * The cookie is only set once that has come back true. A refused switch leaves
 * the caller exactly where they were.
 */
export async function switchCompany(orgId: string): Promise<SwitchResult> {
  try {
    const member = await requireMember()

    if (!orgIdSchema.safeParse(orgId).success) {
      return { ok: false, error: 'Empresa desconocida.' }
    }

    // Already there. Writing the cookie and revalidating the whole layout to
    // arrive where we are is work with a visible cost — the sidebar and every
    // page under it re-render.
    if (orgId === member.orgId) return { ok: true }

    const supabase = await createClient()
    // `as never` and the narrowing below: scripts/gen-db-types.mjs emits
    // `Functions: Record<never, never>`, so no RPC in this codebase is typed —
    // see the same shape in lib/api/rate-limit.ts and mutations/productos.ts.
    const { data, error } = await supabase.rpc('set_active_company', {
      p_org_id: orgId,
    })

    if (error) {
      console.error('[companies] switchCompany', error)
      return { ok: false, error: 'No se pudo cambiar de empresa.' }
    }

    // The function returns a plain boolean: true when a membership was found
    // and stamped. Anything else is a shape change in the database, and
    // treating it as "not a member" fails closed.
    const belongs = (data as unknown) === true

    // Deliberately the same wording as an id that does not exist at all.
    // "No perteneces a esa empresa" confirms the company is real to somebody
    // probing ids, and there is nothing the caller can do differently either
    // way.
    if (!belongs) {
      return { ok: false, error: 'No tienes acceso a esa empresa.' }
    }

    const jar = await cookies()
    jar.set(
      ACTIVE_COMPANY_COOKIE,
      orgId,
      activeCompanyCookieOptions(process.env.NODE_ENV === 'production'),
    )

    // 'layout' scope: the sidebar, the topbar and the notification count are
    // all rendered by the dashboard layout from `member`, and every one of them
    // changes with the company. A page-scoped revalidate would swap the content
    // and leave the nav describing the company that was just left.
    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Inicia sesión para continuar.' }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Creating a company
 *
 * The account *is* passed now, and that is a deliberate reversal. It used to be
 * derived from `auth.uid()` — the caller's oldest governed account — so there
 * was no parameter to get wrong. That was right while a person had exactly one
 * group. With several, "the oldest" silently spends the wrong subscription:
 * somebody standing in «Mi Startup» would create a company inside «Grupo XYZ».
 *
 * Naming it is safe because the database does not take the caller's word for
 * it: `public.create_company` refuses any account `app.can_manage_account`
 * does not confirm (migration 37).
 * ═══════════════════════════════════════════════════════════════════════════ */

const createCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'La empresa necesita un nombre.')
    .max(120, 'El nombre es muy largo.'),
  /**
   * The sector is optional and is only a suggestion: it proposes a module
   * preset and restricts nothing. An unrecognised value is dropped by the
   * database rather than refused, so a stale client cannot fail a creation.
   */
  sector: z.string().trim().refine(isCompanyType, 'Sector desconocido.').nullish(),
  /** Which group pays for it. Null means the account of the active company. */
  accountId: z.uuid().nullish(),
})

export type CreateCompanyResult =
  | { ok: true; orgId: string }
  | { ok: false; error: string }

/**
 * Creates another company in the caller's account, and moves them into it.
 *
 * The plan limit is checked twice on purpose. The trigger in migration 28 is
 * what makes it true — it fires for every role and cannot be talked around —
 * but a constraint violation is not a sentence, and "El plan Starter permite 1
 * empresa" with the name of the tier that would allow more is the difference
 * between a customer upgrading and a customer filing a bug.
 */
export async function createCompany(
  input: z.input<typeof createCompanySchema>,
): Promise<CreateCompanyResult> {
  try {
    const member = await requireMember()

    const parsed = createCompanySchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const accountId = parsed.data.accountId ?? member.account.accountId

    // Governing *that* account is what creating a company in it requires. The
    // database enforces the same rule and is what makes it true; checking here
    // means the refusal is a sentence instead of an error code.
    const standing = member.accounts.find((a) => a.accountId === accountId)?.role ?? null
    if (standing !== 'owner' && standing !== 'admin') {
      return { ok: false, error: 'Solo quien administra la cuenta puede crear empresas.' }
    }

    /**
     * The plan limit, pre-checked only for the account we know the plan of.
     *
     * `member.plan` is the *active* company's account. For any other group the
     * tier is not in hand, and fetching it to phrase a message would be a round
     * trip to say something the trigger already says well: its refusal names
     * the plan, the allowance and the current count, in Spanish, for a person.
     * So the pre-check narrows and the database covers the rest.
     *
     * Counted against the companies of that account, not `member.companies`,
     * which spans every group the caller belongs to.
     */
    if (accountId === member.account.accountId) {
      const used = member.companies.filter((c) => c.accountId === accountId).length
      const plan = planFor(member.plan)
      if (!companiesAvailable(member.plan, used)) {
        return {
          ok: false,
          error:
            `Tu plan ${plan.label} permite ${plan.maxCompanies} ` +
            `${plan.maxCompanies === 1 ? 'empresa' : 'empresas'}. ` +
            'Cambia de plan para agregar otra.',
        }
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('create_company', {
      p_name: parsed.data.name,
      p_sector: parsed.data.sector ?? null,
      p_account_id: accountId,
    })

    if (error) {
      console.error('[companies] createCompany', error)
      // The trigger's message names the plan and the count, and it is written
      // for a person. Anything else is ours to summarise.
      return {
        ok: false,
        error: error.message.includes('permite')
          ? error.message
          : 'No se pudo crear la empresa.',
      }
    }

    const orgId = typeof data === 'string' ? data : null
    if (!orgId) return { ok: false, error: 'No se pudo crear la empresa.' }

    /**
     * Land in the company that was just created.
     *
     * Creating a business and then having to find it in a dropdown is the kind
     * of small wrongness that makes a product feel unfinished. `switchCompany`
     * is reused rather than the cookie being written here, so the membership is
     * still confirmed by the database before the context moves.
     */
    await switchCompany(orgId)

    revalidatePath('/dashboard', 'layout')
    return { ok: true, orgId }
  } catch {
    return { ok: false, error: 'Inicia sesión para continuar.' }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Joining a company you govern but did not join
 *
 * Decision M4: owning the account grants no access to any company's data. This
 * is the door, and it is deliberately a door rather than an open plan — chosen
 * at a named role, and written to the audit log of the company being entered so
 * the people who work there can see who let themselves in.
 * ═══════════════════════════════════════════════════════════════════════════ */

const joinCompanySchema = z.object({
  orgId: z.uuid(),
  role: z.string().trim().min(2).max(40),
})

export async function joinCompany(
  input: z.input<typeof joinCompanySchema>,
): Promise<SwitchResult> {
  try {
    await requireMember()

    const parsed = joinCompanySchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: 'Datos inválidos.' }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('join_company', {
      p_org_id: parsed.data.orgId,
      p_role: parsed.data.role,
    })

    if (error) {
      console.error('[companies] joinCompany', error)
      return {
        ok: false,
        error: error.message.includes('No administras')
          ? 'No administras la cuenta dueña de esa empresa.'
          : 'No se pudo unir a la empresa.',
      }
    }

    // `false` means "already a member", which is not a failure — it is the
    // answer to clicking twice. Either way the caller now belongs, so moving
    // into the company is the right next step.
    void data

    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Inicia sesión para continuar.' }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * There is no `createAccount` here any more
 *
 * It existed, it worked, and `public.create_account` is still in the database
 * (migration 37) — nothing has been dropped, because a customer who already has
 * a second account must keep being able to use it.
 *
 * What went is the *path* to making one. An account is a subscription; the
 * companies under it are what a customer operates. Offered side by side in
 * Empresas, "Nueva cuenta" and "Nueva empresa" looked like the same button with
 * a different noun, and choosing wrong quietly started a second Starter
 * subscription instead of adding a company to the plan already being paid for.
 *
 * One person, one account. Somebody who really does need two subscriptions
 * registers a second login — rare enough to be worth the friction, and honest
 * about what it costs.
 * ═══════════════════════════════════════════════════════════════════════════ */
