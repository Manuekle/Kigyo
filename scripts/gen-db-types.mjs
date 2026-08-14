#!/usr/bin/env node
// Emits src/lib/supabase/types.ts from a live Postgres schema.
//
// `supabase gen types` needs Docker, which is not always available. This does
// the same introspection over a plain connection, so types can be regenerated
// from the throwaway verification database created by scripts/db-verify.sh:
//
//   ./scripts/db-verify.sh --keep          # note the database name it prints
//   node scripts/gen-db-types.mjs postgresql://user@localhost:5432/<db>
//
// Against a real project, prefer `supabase gen types typescript --linked`.

import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const dbUrl = process.argv[2]
if (!dbUrl) {
  console.error('usage: node scripts/gen-db-types.mjs <postgres-url>')
  process.exit(2)
}

const OUT = resolve(process.cwd(), 'src/lib/supabase/types.ts')

/** Runs a query and returns rows as objects, via psql's JSON output. */
function query(sql) {
  const out = execFileSync(
    'psql',
    [dbUrl, '--quiet', '--no-psqlrc', '--tuples-only', '--no-align', '--command', sql],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  const trimmed = out.trim()
  return trimmed ? JSON.parse(trimmed) : []
}

const TYPE_MAP = {
  bool: 'boolean',
  int2: 'number', int4: 'number', int8: 'number',
  float4: 'number', float8: 'number', numeric: 'number',
  text: 'string', varchar: 'string', bpchar: 'string', name: 'string',
  uuid: 'string', date: 'string', time: 'string', timetz: 'string',
  timestamp: 'string', timestamptz: 'string', interval: 'string',
  json: 'Json', jsonb: 'Json',
  bytea: 'string',
}

function tsType(udtName, isArray) {
  const base = TYPE_MAP[udtName.replace(/^_/, '')] ?? 'unknown'
  return isArray ? `${base}[]` : base
}

const columns = query(`
  select coalesce(json_agg(row_to_json(t) order by t.table_name, t.ordinal_position), '[]'::json)
  from (
    select
      c.table_name,
      c.column_name,
      c.ordinal_position,
      c.is_nullable = 'YES'                                   as is_nullable,
      c.data_type = 'ARRAY'                                   as is_array,
      c.udt_name,
      c.column_default is not null
        or c.is_identity = 'YES'
        or c.is_generated = 'ALWAYS'                          as has_default,
      c.is_generated = 'ALWAYS'
        or c.is_identity = 'YES'                              as is_generated,
      pg_get_constraintdef(con.oid)                           as check_def
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema
     and tb.table_name   = c.table_name
     and tb.table_type   = 'BASE TABLE'
    left join lateral (
      select con.oid
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where con.contype = 'c'
        and ns.nspname = c.table_schema
        and rel.relname = c.table_name
        and array_length(con.conkey, 1) = 1
        and con.conkey[1] = c.ordinal_position::smallint
        and pg_get_constraintdef(con.oid) ilike '%= any (array%'
      limit 1
    ) con on true
    where c.table_schema = 'public'
  ) t;
`)

const relationships = query(`
  select coalesce(json_agg(row_to_json(t) order by t.table_name, t.constraint_name), '[]'::json)
  from (
    select
      con.conname                                as constraint_name,
      src.relname                                as table_name,
      (select array_agg(a.attname order by k.ord)
         from unnest(con.conkey) with ordinality k(attnum, ord)
         join pg_attribute a on a.attrelid = src.oid and a.attnum = k.attnum) as columns,
      tgt.relname                                as foreign_table_name,
      (select array_agg(a.attname order by k.ord)
         from unnest(con.confkey) with ordinality k(attnum, ord)
         join pg_attribute a on a.attrelid = tgt.oid and a.attnum = k.attnum) as foreign_columns
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace ns on ns.oid = src.relnamespace
    where con.contype = 'f' and ns.nspname = 'public'
  ) t;
`)

/** Pulls the literal union out of a `check (col = any (array['a','b']::text[]))`. */
function enumFromCheck(def) {
  if (!def) return null
  const arr = def.match(/= ANY \(\(?ARRAY\[(.*?)\]/is)
  if (!arr) return null
  const literals = [...arr[1].matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"))
  return literals.length ? literals.map((l) => JSON.stringify(l)).join(' | ') : null
}

const byTable = new Map()
for (const c of columns) {
  if (!byTable.has(c.table_name)) byTable.set(c.table_name, [])
  byTable.get(c.table_name).push(c)
}

const relsByTable = new Map()
for (const r of relationships) {
  if (!relsByTable.has(r.table_name)) relsByTable.set(r.table_name, [])
  relsByTable.get(r.table_name).push(r)
}

const enums = new Map() // "table.column" -> union

const lines = []
lines.push('// GENERATED FILE — do not edit by hand.')
lines.push('// Regenerate with: node scripts/gen-db-types.mjs <postgres-url>')
lines.push('// Source of truth is supabase/migrations/*.sql.')
lines.push('')
lines.push('export type Json =')
lines.push('  | string')
lines.push('  | number')
lines.push('  | boolean')
lines.push('  | null')
lines.push('  | { [key: string]: Json | undefined }')
lines.push('  | Json[]')
lines.push('')
lines.push('export interface Database {')
lines.push('  public: {')
lines.push('    Tables: {')

for (const table of [...byTable.keys()].sort()) {
  const cols = byTable.get(table)
  lines.push(`      ${table}: {`)

  lines.push('        Row: {')
  for (const c of cols) {
    const literal = enumFromCheck(c.check_def)
    if (literal) enums.set(`${table}.${c.column_name}`, literal)
    const t = literal && !c.is_array ? literal : tsType(c.udt_name, c.is_array)
    lines.push(`          ${c.column_name}: ${t}${c.is_nullable ? ' | null' : ''}`)
  }
  lines.push('        }')

  lines.push('        Insert: {')
  for (const c of cols) {
    if (c.is_generated) continue
    const literal = enums.get(`${table}.${c.column_name}`)
    const t = literal && !c.is_array ? literal : tsType(c.udt_name, c.is_array)
    const optional = c.has_default || c.is_nullable
    lines.push(`          ${c.column_name}${optional ? '?' : ''}: ${t}${c.is_nullable ? ' | null' : ''}`)
  }
  lines.push('        }')

  lines.push('        Update: {')
  for (const c of cols) {
    if (c.is_generated) continue
    const literal = enums.get(`${table}.${c.column_name}`)
    const t = literal && !c.is_array ? literal : tsType(c.udt_name, c.is_array)
    lines.push(`          ${c.column_name}?: ${t}${c.is_nullable ? ' | null' : ''}`)
  }
  lines.push('        }')

  const rels = relsByTable.get(table) ?? []
  lines.push('        Relationships: [')
  for (const r of rels) {
    lines.push('          {')
    lines.push(`            foreignKeyName: ${JSON.stringify(r.constraint_name)}`)
    lines.push(`            columns: [${r.columns.map((c) => JSON.stringify(c)).join(', ')}]`)
    lines.push('            isOneToOne: false')
    lines.push(`            referencedRelation: ${JSON.stringify(r.foreign_table_name)}`)
    lines.push(`            referencedColumns: [${r.foreign_columns.map((c) => JSON.stringify(c)).join(', ')}]`)
    lines.push('          },')
  }
  lines.push('        ]')
  lines.push('      }')
}

lines.push('    }')
lines.push('    Views: Record<never, never>')
// The RPC signatures are hand-written (see the Functions block in the current
// types.ts): the introspection below has no PostgREST route table, and
// regenerating the file must not silently drop the typed calls. Carried over
// verbatim from the previous output.
lines.push('    ' + readCarriedFunctions())
lines.push('    Enums: Record<never, never>')
lines.push('    CompositeTypes: Record<never, never>')
lines.push('  }')
lines.push('}')
lines.push('')

// Convenience aliases, so call sites read as `Employee` rather than a deep
// index into Database.
lines.push('type PublicTables = Database[\'public\'][\'Tables\']')
lines.push('export type Tables<T extends keyof PublicTables> = PublicTables[T][\'Row\']')
lines.push('export type TablesInsert<T extends keyof PublicTables> = PublicTables[T][\'Insert\']')
lines.push('export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T][\'Update\']')
lines.push('')

// Status/enum unions promoted to named types — these are the values the UI
// switches on, and they should not be re-declared per component.
const named = [
  ['EmployeeStatus', 'employees.status'],
  ['RoleKey', 'memberships.role'],
  ['TicketStatus', 'tickets.status'],
  ['TicketPriority', 'tickets.priority'],
  ['TicketArea', 'tickets.area'],
  ['SignatureStatus', 'signature_requests.status'],
  ['SignatureKind', 'signature_requests.kind'],
  ['DocumentStatus', 'documents.status'],
  ['DocumentKind', 'documents.kind'],
  ['InventoryStatus', 'inventory_assets.status'],
  ['InventoryCategory', 'inventory_assets.category'],
  ['RiskSeverity', 'risks.severity'],
  ['RiskStatus', 'risks.status'],
  ['RiskCategory', 'risks.category'],
  ['AbsenceKind', 'absences.kind'],
  ['AbsenceStatus', 'absences.status'],
  ['ProjectStatus', 'projects.status'],
]
for (const [name, key] of named) {
  const union = enums.get(key)
  if (union) lines.push(`export type ${name} = ${union}`)
}
lines.push('')

mkdirSync(dirname(OUT), { recursive: true })

/**
 * Carries the hand-maintained RPC signatures across a regeneration.
 *
 * `Functions:` is a typed block written by hand (see above). Extracted from
 * the previous file if it exists; a fresh checkout without one falls back to
 * the empty form.
 */
function readCarriedFunctions() {
  try {
    const previous = readFileSync(OUT, 'utf8')
    const match = previous.match(/Functions: \{[\s\S]*?\n    \}/)
    return match ? match[0] : 'Functions: Record<never, never>'
  } catch {
    return 'Functions: Record<never, never>'
  }
}

writeFileSync(OUT, lines.join('\n'))
console.log(`wrote ${OUT} — ${byTable.size} tables, ${enums.size} check-constraint unions`)
