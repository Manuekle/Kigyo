import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { SECTOR_LANDINGS } from '@/lib/modules'

/**
 * What a crawler is invited to index.
 *
 * It used to list twenty-two `/dashboard/*` routes. Every one of them is behind
 * `requireMember()` and answers a signed-out request with a 307 to `/login`, so
 * the sitemap was handing Google twenty-two URLs that redirect to the same page
 * — the shape a search engine reads as a thin, duplicated site. They were
 * plausible entries because they *are* the product; they were the wrong ones
 * because a crawler cannot log in.
 *
 * What replaces them is the twenty-three pages that actually say something to
 * somebody who has not signed up: one per sector, derived from `SECTOR_LANDINGS`
 * — the same list `generateStaticParams` builds the routes from, so the sitemap
 * cannot announce a URL that `dynamicParams = false` would answer with a 404. That is also why the list is generated rather than written:
 * this file already carried `https://whitebox.com` — another company's domain —
 * for long enough that nobody noticed, because nobody opens `sitemap.xml`.
 */

const publicRoutes = ['/soluciones', '/about', '/pricing', '/faq', '/contact', '/terms', '/privacy']

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const landing = {
    url: SITE_URL,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 1,
  }

  /**
   * Above the rest of the public pages on purpose: a prospect searching for
   * «software para clínicas» should land on the page written for a clinic, not
   * on `/about`.
   */
  const sectors = SECTOR_LANDINGS.map((type) => ({
    url: `${SITE_URL}/soluciones/${type.key}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  const publicPages = publicRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [landing, ...sectors, ...publicPages]
}
