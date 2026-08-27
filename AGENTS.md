<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Naming: `org_id` means *company*

Kigyo is multi-company. The hierarchy is:

```
Account          public.accounts          — commercial account: plan, billing, limits
  └── Company    public.organizations     — the operating business: sector, modules, data
        └── Site public.sites             — branch (phase 6)
```

**`public.organizations` is the COMPANY, not the account.** Every business table
carries `org_id`, and that column means *company id*. The commercial account
lives in `public.accounts`, which owns the plan and the billing references.

This is deliberate. `organizations` already was the operating business — it
holds the sector, the enabled modules, the data, the storage prefix and the
audit trail — so the account was added *above* it rather than a company being
inserted *below*. That kept 66 tables, ~264 RLS policies and ~787 query call
sites completely untouched, which is why there is no window in this migration
where data can leak between a customer's own companies.

Rules that follow from it, and that are not negotiable:

1. **New tables use `org_id`**, never `company_id`. One imperfect convention
   beats two correct ones.
2. **Never create a `public.companies` table, view or alias**, and never add a
   `CompanyId` type alias for `OrgId`. A second name for the same thing is
   exactly the drift this rule exists to prevent.
3. **In TypeScript the product vocabulary is "empresa"/company**: `member.companies`,
   `createCompany()`, `activeCompanyId`. `member.orgId` keeps its name because
   ~602 call sites read it; it means "the active company".
4. **The account scope never grants access to company data.** `account_memberships`
   decides who pays and who may create companies. Reading or writing a company's
   rows always requires a row in `public.memberships`. No RLS policy on a
   business table may reference an account.
5. **`app.orgs_with`, `app.apply_standard_rls` and `app.apply_child_rls` are
   frozen.** They are the tested isolation primitive. Needing to change them
   means the design slid back toward the discarded approach.

Full reasoning: `docs/AUDITORIA_ARQUITECTURA_KIGYO.md`.
Binding contracts: `docs/FASE_0_CONTRATOS.md`.
Both are **frozen historical documents**. They are cited from migrations, tests
and `plans.ts`, so they must not be deleted — and they describe the codebase as
it was on 2026-08-10, so they must not be updated either. Current state lives in
`docs/ARQUITECTURA_ACTUAL.md` and `docs/CONTEXTO_SESION.md`.

# Who sees what: four gates, always in this order

`requirePermission()` in `src/lib/auth/session.ts` is the canonical order. Do not
add a fifth gate, do not reorder, and do not collapse two into one — the order is
what makes a refusal name the thing that actually stopped you.

| # | Question | Data | Gate |
|---|---|---|---|
| 0 | is the company paid up? | `accounts.access_state` · `organizations.status` | `CompanySuspendedError` (writes only; reads stay open) |
| 1 | does the plan include it? | `accounts.plan` | `planAllows` (`src/lib/plans.ts`) |
| 2 | did the company switch it on? | `organizations.enabled_modules` | `member.modules.has` |
| 3 | may this person open it? | `role_permissions` | `can()` |

The same answer is given in five places and they must not disagree:
`requirePermission()` on the server, `<RequirePermission>` on every page,
`src/lib/api/handler.ts` for route handlers, the RLS policies, and the sidebar
filter. Only the first four are controls; the sidebar is a courtesy.

**Roles are tenant rows**, not an enum (migration 24). `SYSTEM_ROLES` names what
signup seeds, nothing more — "administrator" means *holds `configuracion:manage`*,
which is what `app.is_org_admin` asks. Never branch on a role's name.

# The module registry is the only source

`src/lib/modules/registry.ts` declares all 59 modules. The sidebar, the command
palette, page titles, `ROUTE_MAP`, the 115 `module:action` permissions, the icon
map and `app.valid_module_keys()` are **derived** from it, and tests pin both
directions. `npm run db:module-sql` prints the SQL to paste into a migration.

- A new module is: a registry entry, a route folder, a `queries/` file and a
  `mutations/` file. Adding it anywhere else means two lists to keep in sync.
- **The dashboard is not the only authenticated tree.** `src/app/(mostrador)` is
  the POS at full screen: its own layout, the same four gates in the same order,
  and its own entry in `OTHER_AUTHENTICATED_GROUPS` in `route-parity.test.ts`. A
  new group outside `(dashboard)` must be added there or nothing checks it.
- The page heading is rendered once by `PageHeader` in `(dashboard)/layout.tsx`,
  from `META` / `META_SUB`. A page does **not** render its own `<h1>`; the
  skeletons do not draw a `.phead`. Both were how every navigation used to end
  in a vertical jump.
- **A new route needs its `ROUTE_MAP` entry** — derived from the registry, so in
  practice that means the registry entry.
- Sectors are the other way round: they live in the database (`public.sectors`,
  `sector_modules`, `sector_roles`) so a product person can add one without a
  deploy. `src/lib/modules.ts` and `src/lib/suggested-roles.ts` mirror them and
  the tests pin the mirror.

# Database

- **Supabase MCP points at a different project.** Everything goes through `psql`
  with `SUPABASE_DB_URL` from `.env.local`. Never echo that variable.
- **A migration already applied to the remote is never re-applied.** Change it by
  running the SQL against the remote *and* editing the local file (the pattern
  used by 57/58, 90–95, 109, 110).
- Validate new SQL inside `begin; … rollback;` first.
- `db-verify` locally is not valid: migration 86 (`vector`) is not installed in
  Homebrew Postgres. Validate against the remote.
- **Frozen:** `app.orgs_with`, `app.apply_standard_rls`, `app.apply_child_rls`.
  `app.company_is_active` is **not** frozen — it is the paywall's lever.
- Module RPCs live in `public`, not `app` (PostgREST only exposes public schemas).
- Types in `src/lib/supabase/types.ts` are generated for tables and check
  constraints only; the `Functions` block is maintained by hand.
- `products.price_cents` includes VAT. The POS extracts it, the invoice converts.
  Quotes and orders carry it inside too.
- `products.stock` is **derived**. Every movement goes through
  `inventory_movements`.

# Code

- Files under `src/server/mutations/` are `'use server'`, never `'server-only'`,
  and export **only** async functions. `use-server-exports.test.ts` pins that.
- Every query is scoped: `scoped()` or an explicit `.eq('org_id', …)`.
- `src/lib/domain.ts` is the vocabulary the database's `check` constraints
  accept — invoice states, property kinds, and the pure helpers over them. It has
  nothing to do with web domains; that is `src/lib/site.ts`.
- Day boundaries use `todayIn(member.orgTimezone)`, never
  `new Date().toISOString().slice(0, 10)`. Bogotá rolls over at 19:00 UTC.
- **Absolute URLs come from `SITE_URL` (`src/lib/site.ts`)**, never from
  `process.env.NEXT_PUBLIC_APP_URL` directly. Reading the env raw is how one
  builder ended up handing a customer a relative `/portal/<token>` and another
  handed Wompi the literal string `undefined/dashboard/pos`.
- **One canonical host.** `canonicalRedirect` in `src/proxy.ts` 308s the `www.`
  alias to it, derived from `SITE_URL`. `/api/*` is exempt on purpose — Polar
  does not follow redirects on POST — and it fires for that one alias only, so
  preview deployments are never bounced to production. Pinned by
  `src/proxy.test.ts`. Never widen it to «anything that is not canonical».
- Never invent a regulatory figure. Payroll and DIAN parameters ship at zero on
  purpose, pending an accountant.

# Verification

Green means all four: `npm run typecheck`, `npm test`, `npm run build`,
`npm run test:e2e`.

- **`workers: 1` is mandatory** for e2e and never negotiable: every spec shares
  the demo user, the active company and the demo database.
- **Never run two `npx playwright test` at once**, not even with `workers: 1`.
- An e2e fixture is restored to *exactly* what was found, not to what it should
  have been.
- `src/lib/e2e-secrets.test.ts` guards against a spec printing
  `SUPABASE_DB_URL` in its output. It has caught this five times.
- Lint has a known baseline of 17 errors and 42 warnings, all in
  `src/components/extend/*` (untracked third-party viewers) and the two files
  that use them. Anything outside those files is yours.

# Documentation

`docs/CONTEXTO_SESION.md` is the single session log — what was done, what is
broken, what is pending. **Do not create new `.md` files**: update that one.
`docs/ARQUITECTURA_ACTUAL.md` is the technical map and is updated when the shape
of the system changes, not every session.
