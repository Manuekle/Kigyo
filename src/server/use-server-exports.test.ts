import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Un archivo `'use server'` solo puede exportar funciones async.
 *
 * Esta prueba existe por un fallo concreto y por cómo se manifestó. Se exportó
 * un array de constantes —las etiquetas de `employee_events.tag`— desde
 * `mutations/empleados.ts`, que lleva `'use server'`. Next lo rechaza en tiempo
 * de evaluación del módulo:
 *
 *     A "use server" file can only export async functions, found object.
 *
 * Lo que lo hace peligroso es dónde salta y dónde no:
 *
 *   · `tsc` no dice nada — es TypeScript perfectamente válido;
 *   · `eslint` no dice nada;
 *   · **`npm run build` pasó en verde**;
 *   · y en ejecución no rompe la pantalla de empleados, rompe **el dashboard
 *     entero**, porque el cargador de server actions junta los módulos de toda
 *     la ruta y el fallo se lleva por delante a los vecinos. Se descubrió con
 *     los seis specs de e2e en rojo a la vez y una traza que apuntaba a
 *     `company-switch`.
 *
 * Los tipos y las interfaces sí pueden salir: se borran al compilar y no llegan
 * al grafo de módulos. Por eso la regla mira `export const|let|var|class` y
 * `export function` sin `async`, y no `export type|interface`.
 */

const ROOTS = ['src/server', 'src/app', 'src/lib', 'src/components']

function sourceFiles(dir: string): string[] {
  const full = resolve(process.cwd(), dir)
  let entries: string[]
  try {
    entries = readdirSync(full)
  } catch {
    return []
  }
  return entries.flatMap((name) => {
    const path = `${dir}/${name}`
    if (statSync(resolve(process.cwd(), path)).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

/**
 * Los archivos que declaran `'use server'` en su primera línea con contenido.
 *
 * Memoizado: recorrer `src/` entero por cada `it` es trabajo repetido que, con
 * la suite en paralelo, se nota en los vecinos que leen los mismos archivos.
 */
let cached: Array<{ path: string; source: string }> | null = null

function serverActionFiles(): Array<{ path: string; source: string }> {
  cached ??= ROOTS.flatMap(sourceFiles)
    .map((path) => ({ path, source: readFileSync(resolve(process.cwd(), path), 'utf8') }))
    .filter(({ source }) => /^\s*['"]use server['"]/.test(source))
  return cached
}

describe("los archivos 'use server' solo exportan funciones async", () => {
  it('encuentra los archivos de server actions', () => {
    // Si esto llega a cero, la prueba pasa sin comprobar nada — que es la forma
    // en que un guardia de este tipo se muere en silencio.
    expect(serverActionFiles().length).toBeGreaterThan(30)
  })

  it('no exporta valores desde un archivo de server actions', () => {
    const offenders: string[] = []

    for (const { path, source } of serverActionFiles()) {
      const lines = source.split('\n')
      lines.forEach((line, i) => {
        // `export const`, `export let`, `export var`, `export class`: todos son
        // valores en el grafo de módulos.
        if (/^export\s+(const|let|var|class)\s/.test(line)) {
          offenders.push(`${path}:${i + 1} — ${line.trim().slice(0, 70)}`)
        }
        // Una función exportada sin `async` tampoco vale, aunque devuelva una
        // promesa: Next mira la declaración, no el tipo de retorno.
        if (/^export\s+function\s/.test(line)) {
          offenders.push(`${path}:${i + 1} — ${line.trim().slice(0, 70)}`)
        }
      })
    }

    expect(
      offenders,
      'Un archivo \'use server\' exporta algo que no es una función async. Next lo rechaza al ' +
        'evaluar el módulo y se lleva por delante toda la ruta — y ni tsc ni el build lo ven. ' +
        'Mueve la constante a lib/ (por ejemplo lib/domain.ts) y vuelve a importarla aquí.',
    ).toEqual([])
  })
})
