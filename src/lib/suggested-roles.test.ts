/**
 * La copia TS y la tabla `public.sector_roles` se pin mutuamente, igual que
 * los presets de módulos con `public.sector_modules`: una matriz que existe
 * en una y no en la otra es un rol que o bien nunca se sembrará o bien se
 * siembra sin que nadie lo haya revisado en diff.
 *
 * El seed vive en tres migraciones: la 46 siembra el catálogo, la 61 aplica
 * el pase de los módulos 47-60 sobre los mismos roles y la 72 añade las
 * matrices de los 33 subsectores nuevos. Se leen todas: la 46 y la 72 como
 * filas base y la 61 como UPDATEs encima, igual que las ejecuta una base
 * fresca.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SUGGESTED_ROLES } from '@/lib/suggested-roles'
import { PERMISSIONS } from '@/lib/auth/permissions'

const read = (f: string) => readFileSync(resolve(process.cwd(), 'supabase/migrations', f), 'utf8')

const insertFiles = [
  '20260814100000_46_sector_roles.sql',
  '20260815210000_72_subsector_roles.sql',
]
const updateFiles = ['20260815100000_61_sector_roles_pass.sql']

/** Todas las filas INSERT de `public.sector_roles` en las migraciones base. */
const dbRows = insertFiles.flatMap((f) =>
  [...read(f).matchAll(/\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*array\[([^\]]+)\]\s*\)/g)].map(
    (m) => ({
      sector: m[1],
      key: m[2],
      label: m[3],
      rank: Number(m[4]),
      permissions: [...m[5].matchAll(/'([^']+)'/g)].map((p) => p[1]).sort(),
    }),
  ),
)

/** Los UPDATEs del pase de módulos, aplicados sobre las filas base. */
for (const m of updateFiles.flatMap((f) =>
  [...read(f).matchAll(
    /set permissions = array\[([^\]]+)\]\s+where sector_key = '([^']+)' and role_key = '([^']+)'/g,
  )],
)) {
  const row = dbRows.find((r) => r.sector === m[2] && r.key === m[3])
  expect(row, `el pase actualiza ${m[2]}/${m[3]}, que las base no siembran`).toBeTruthy()
  if (row) {
    row.permissions = [...m[1].matchAll(/'([^']+)'/g)].map((p) => p[1]).sort()
  }
}

const tsRows = Object.entries(SUGGESTED_ROLES).flatMap(([sector, roles]) =>
  roles.map((r) => ({ sector, ...r, permissions: [...r.permissions].sort() })),
)

describe('suggested roles', () => {
  it('cubre exactamente lo que la base acepta, en ambas direcciones', () => {
    const dbKeys = new Set(dbRows.map((r) => `${r.sector}/${r.key}`))
    const tsKeys = new Set(tsRows.map((r) => `${r.sector}/${r.key}`))
    for (const k of dbKeys) expect(tsKeys, `la base propone ${k} y TS no`).toContain(k)
    for (const k of tsKeys) expect(dbKeys, `TS propone ${k} y la base no`).toContain(k)
  })

  it('usa solo permisos que existen en el vocabulario', () => {
    for (const row of tsRows) {
      for (const p of row.permissions) {
        expect((PERMISSIONS as readonly string[]).includes(p), `${row.sector}/${row.key}: ${p}`).toBe(true)
      }
    }
  })

  it('ningún rol sugerido administra la configuración', () => {
    for (const row of tsRows) {
      expect(row.permissions, `${row.sector}/${row.key}`).not.toContain('configuracion:manage')
    }
  })

  it('claves únicas por subsector', () => {
    for (const [sector, roles] of Object.entries(SUGGESTED_ROLES)) {
      const keys = roles.map((r) => r.key)
      expect(new Set(keys).size, sector).toBe(keys.length)
    }
  })
})
