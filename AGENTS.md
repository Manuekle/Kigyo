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
