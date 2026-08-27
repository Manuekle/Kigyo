'use client'

import { usePathname } from 'next/navigation'
import { META, META_SUB } from '@/lib/data/nav'

/**
 * The page's own title and its one line of explanation.
 *
 * Both were already written — `META` and `META_SUB` are projections of the
 * module registry, where every entry carries a `title` and a `subtitle` composed
 * for the person opening that screen. The title reached the topbar; **the
 * subtitle reached nothing**. Its only reference outside `lib/data/nav.ts` was
 * an assertion in `registry.test.ts` checking it existed.
 *
 * And the absence had a cost beyond the missing sentence: `.phead` — a title, a
 * subtitle and two buttons — appeared in forty-four files, forty-three of them
 * `loading.tsx`. Every skeleton painted a header the real page never rendered,
 * so every navigation ended with the content jumping up by the height of a
 * heading. The fix is the same in both directions: render the header for real,
 * and stop the skeletons drawing one.
 *
 * ─── Why the layout and not the pages ──────────────────────────────────────
 *
 * Sixty-two pages would each have had to adopt a component, and the sixty-third
 * would have forgotten. Rendered once above `{children}`, it also survives the
 * navigation itself: a layout does not re-render between routes, so the heading
 * stays on screen while the next page loads instead of being repainted as a grey
 * box. That is the jump, removed rather than smoothed.
 */

/**
 * Screens that are an application, not a document.
 *
 * The chat surfaces get `padding: 0` and own the full height (`globals.css`
 * `.content:has(.ia-page)`), so a header above them would push the composer off
 * the bottom of the viewport. They still need the one `<h1>` a page owes a
 * screen reader, so they get it without the block.
 */
const BARE = new Set(['ia', 'canales'])

export default function PageHeader() {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)
  const segment = parts[1] ?? 'dashboard'

  /**
   * A deeper route renders its own header.
   *
   * `/dashboard/empleados/<id>` is a person, not the directory, and it already
   * draws a `.phead` with the avatar and the back button. Two headings, one of
   * them wrong, is worse than the state this component exists to fix.
   */
  if (parts.length > 2) return null

  // The home screen greets by name — «Hola, Manuel» — which is a better first
  // line than «Dashboard», and it carries the `<h1>` for that route.
  if (segment === 'dashboard') return null

  const title = META[segment]
  if (!title) return null

  if (BARE.has(segment)) return <h1 className="sr-only">{title}</h1>

  const subtitle = META_SUB[segment]
  return (
    <header className="phead">
      <div style={{ minWidth: 0 }}>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="psub">{subtitle}</p>}
      </div>
    </header>
  )
}
