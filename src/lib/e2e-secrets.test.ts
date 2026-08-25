import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Ningún spec de e2e puede imprimir `SUPABASE_DB_URL` al fallar.
 *
 * `execFileSync` incluye el comando completo en el mensaje de error, y el
 * comando lleva la cadena de conexión — usuario y contraseña de producción. La
 * forma ingenua:
 *
 *     execFileSync('psql', [..., dbUrl!], { input: sql, encoding: 'utf8' })
 *
 * funciona perfectamente hasta el día en que el fixture falla, y ese día
 * escribe las credenciales en la salida de la suite: la consola del
 * desarrollador, el log de CI, y el informe donde alguien pega «el error que
 * me sale». Pasó en esta base el 2026-08-25 y obligó a rotar la contraseña.
 *
 * Lo que hace segura la llamada es capturar el fallo y relanzar **solo el
 * stderr del servidor**, que dice qué salió mal sin decir contra qué servidor.
 *
 * La regla se comprueba aquí y no en el propio e2e por lo mismo que el resto de
 * guardias de este repositorio: una prueba que solo corre cuando alguien lanza
 * Playwright con la base delante es una prueba que no corre.
 */

const E2E_DIR = resolve(process.cwd(), 'e2e')

function specs(): Array<{ file: string; source: string }> {
  return readdirSync(E2E_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((file) => ({ file, source: readFileSync(resolve(E2E_DIR, file), 'utf8') }))
}

describe('los specs de e2e no filtran la cadena de conexión', () => {
  it('encuentra los specs que hablan con la base', () => {
    const withDb = specs().filter((s) => s.source.includes('execFileSync'))
    // Si esto llega a cero, la prueba pasa sin comprobar nada — que es como se
    // muere en silencio un guardia de esta clase.
    expect(withDb.length, 'ningún spec usa execFileSync: ¿cambió el patrón?')
      .toBeGreaterThan(0)
  })

  it('envuelve cada llamada a psql para no publicar dbUrl en el error', () => {
    const offenders: string[] = []

    for (const { file, source } of specs()) {
      if (!source.includes('execFileSync')) continue

      // El cuerpo del helper, desde su declaración hasta la llave que la cierra
      // a nivel de módulo. Basta con mirar si el `execFileSync` que lleva
      // `dbUrl` está dentro de un `try`.
      const start = source.indexOf('function psql')
      if (start === -1) {
        offenders.push(`${file}: usa execFileSync sin un helper psql reconocible`)
        continue
      }
      const body = source.slice(start, source.indexOf('\n}', start))

      if (!body.includes('execFileSync')) continue
      if (!/try\s*\{[\s\S]*execFileSync/.test(body)) {
        offenders.push(`${file}: psql llama a execFileSync fuera de un try`)
      }
      if (!/catch[\s\S]*stderr/.test(body)) {
        offenders.push(`${file}: psql no relanza el stderr del servidor`)
      }
    }

    expect(
      offenders,
      'Un spec de e2e puede imprimir SUPABASE_DB_URL —con su contraseña— en el mensaje de ' +
        'error de execFileSync. Envuelve la llamada en try/catch y relanza solo `error.stderr`.',
    ).toEqual([])
  })
})
