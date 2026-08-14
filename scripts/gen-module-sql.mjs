#!/usr/bin/env node
// Emits the SQL that has to agree with src/lib/modules/registry.ts.
//
//   node --experimental-strip-types scripts/gen-module-sql.mjs
//   node --experimental-strip-types scripts/gen-module-sql.mjs --permissions
//   node --experimental-strip-types scripts/gen-module-sql.mjs --module tienda
//
// Two things in the database restate the module catalogue, and both are
// checked against it by src/lib/modules/registry.test.ts:
//
//   · `app.valid_module_keys()`  — which keys `organizations.enabled_modules`
//     accepts. Forgetting it makes an administrator's save fail with an opaque
//     `check_violation`, weeks after the module was added.
//   · `public.permissions`       — the permission catalogue every role grants
//     from.
//
// This prints both so adding a module is copy, paste, review — rather than
// writing thirty lines by hand and finding out from a red test which one is
// wrong. It writes nothing: the output goes into a new migration, where it can
// be read in a diff like every other schema change.
//
// `--module <key>` narrows the permission block to one module, which is the
// usual case: a new module needs its own INSERT, not the whole catalogue
// re-emitted.
//
// Imports the registry directly — it has no imports of its own, so Node's type
// stripping is enough and no build step is involved. Keep it that way: a
// generator that needs a bundler is a generator nobody runs.

import { REGISTRY, SWITCHABLE } from '../src/lib/modules/registry.ts'

const args = process.argv.slice(2)
const only = args.includes('--module') ? args[args.indexOf('--module') + 1] : null
const wants = (flag) => args.includes(flag) || (!args.some((a) => a.startsWith('--')) && true)

/* ─── app.valid_module_keys() ─────────────────────────────────────────────── */

function validModuleKeys() {
  // Four per line, matching the shape the existing migrations use.
  const keys = SWITCHABLE.map((m) => `'${m.key}'`)
  const lines = []
  for (let i = 0; i < keys.length; i += 4) {
    lines.push('      ' + keys.slice(i, i + 4).join(', ') + (i + 4 < keys.length ? ',' : ''))
  }

  return [
    '-- Los módulos que enabled_modules acepta. Espejo de SWITCHABLE en',
    '-- src/lib/modules/registry.ts; registry.test.ts lo fija en ambos sentidos.',
    'create or replace function app.valid_module_keys(keys text[])',
    'returns boolean',
    'language sql',
    'immutable',
    "set search_path = ''",
    'as $$',
    '  select keys is null or not exists (',
    '    select 1',
    '    from unnest(keys) as k',
    '    where k not in (',
    ...lines,
    '    )',
    '  );',
    '$$;',
    '',
    'revoke all on function app.valid_module_keys(text[]) from public, anon;',
    'grant execute on function app.valid_module_keys(text[]) to authenticated;',
  ].join('\n')
}

/* ─── public.permissions ──────────────────────────────────────────────────── */

// The same wording rules as PERMISSION_LABELS in src/lib/auth/permissions.ts.
// Duplicated here rather than imported because that module imports through the
// `@/` alias, which Node does not resolve — and a generator that needs the
// bundler is a generator nobody runs. registry.test.ts pins the result.
const ACTION_LABELS = {
  read: 'Ver',
  write: 'Gestionar',
  manage: 'Administrar',
  use: 'Usar',
}

function permissionRows() {
  const entries = REGISTRY.filter((m) => !only || m.key === only).flatMap((m) =>
    m.actions.map((action) => {
      const override = m.permissionLabels?.[action]
      const noun = m.permissionNoun ?? (m.shortLabel ?? m.label).toLowerCase()
      return {
        key: `${m.key}:${action}`,
        module: m.key,
        action,
        label: override ?? `${ACTION_LABELS[action]} ${noun}`,
      }
    }),
  )

  if (entries.length === 0) {
    console.error(`no module named ${only}`)
    process.exit(2)
  }

  const w = (xs) => Math.max(...xs.map((x) => x.length))
  const wKey = w(entries.map((e) => `'${e.key}',`))
  const wModule = w(entries.map((e) => `'${e.module}',`))
  const wAction = w(entries.map((e) => `'${e.action}',`))

  const rows = entries.map((e, i) =>
    '  (' +
    `'${e.key}',`.padEnd(wKey + 1) +
    `'${e.module}',`.padEnd(wModule + 1) +
    `'${e.action}',`.padEnd(wAction + 1) +
    `'${e.label}')` +
    (i === entries.length - 1 ? '' : ','),
  )

  return [
    '-- Catálogo de permisos. Derivado de REGISTRY; permissions.test.ts lo fija.',
    'insert into public.permissions (key, module, action, label) values',
    ...rows,
    'on conflict (key) do update set label = excluded.label;',
  ].join('\n')
}

/* ─── Output ──────────────────────────────────────────────────────────────── */

const blocks = []
if (!args.includes('--permissions')) blocks.push(validModuleKeys())
if (wants('--permissions') || args.includes('--module')) blocks.push(permissionRows())

console.log(blocks.join('\n\n'))
