import { publicRoute } from '@/lib/api/handler'
import { RATE_LIMITS } from '@/lib/api/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { demoAccount } from '@/lib/env'
import { demoRequestSchema } from '@/lib/validation/demo'

/**
 * Demo request from the public contact form.
 *
 * What this replaces: nothing. The form's `onSubmit` called `setSent(true)` and
 * dropped the submission on the floor — it rendered "Mensaje enviado" without
 * anything having been sent, and no lead ever reached the team.
 *
 * Two things happen here, in this order. The request is recorded first, so a
 * missing demo account still leaves the lead on the books; then the shared demo
 * credentials are handed back so the requester can look around immediately
 * instead of waiting on a reply.
 *
 * The write uses the service-role key because `public.demo_requests` is closed
 * to `anon` and `authenticated` — the submitter has no session, and the table
 * must not be readable by the people writing to it.
 */
export const POST = publicRoute({
  body: demoRequestSchema,
  rateLimit: RATE_LIMITS.demoRequest,
  rateLimitSubject: (body) => body.email,
  async handler({ body }) {
    const supabase = createAdminClient()

    const { error } = await supabase.from('demo_requests').insert({
      name: body.name,
      email: body.email,
      company: body.company?.trim() || null,
      message: body.message,
      source: 'contacto',
    })

    // Logged, not surfaced. Someone who filled in the form correctly should not
    // be shown a database failure they can do nothing about, and the demo
    // credentials below are useful to them whether or not the row landed.
    if (error) {
      console.error('[demo-request] insert failed', { message: error.message })
    }

    const demo = demoAccount()

    // No account configured is an expected deployment state (a fork that has
    // not run `npm run db:seed`), so it degrades to "we will be in touch"
    // rather than advertising credentials that would not sign in.
    if (!demo) return { ok: true, demo: null }

    return {
      ok: true,
      demo: {
        email: demo.DEMO_ACCOUNT_EMAIL,
        password: demo.DEMO_ACCOUNT_PASSWORD,
      },
    }
  },
})
