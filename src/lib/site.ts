/**
 * De dónde vive Kigyo, en una sola línea.
 *
 * Existe porque no lo estaba: la misma pregunta se contestaba de cuatro formas
 * distintas en cuatro archivos, y ninguna de las cuatro decía el dominio real.
 *
 *     robots.ts    'https://whitebox.com'      ← otro producto entero
 *     sitemap.ts   'https://whitebox.com'      ← otro producto entero
 *     layout.tsx   'https://kigyo.vercel.app'  ← el dominio de antes
 *     layout.tsx   'https://kigyo.app/pricing' ← escrito a mano, y con otro TLD
 *
 * Lo de `whitebox.com` es lo grave de la lista, y es del tipo que no se ve en
 * pantalla: `robots.txt` y `sitemap.xml` son para los rastreadores, y estaban
 * anunciándoles el sitio de otra empresa. Nadie abre esos dos archivos, así que
 * podían quedarse mal indefinidamente.
 *
 * ─── Por qué hay un valor por defecto ──────────────────────────────────────
 *
 * `NEXT_PUBLIC_APP_URL` manda siempre que exista, que es lo que permite que un
 * despliegue de vista previa se anuncie a sí mismo y no a producción. El
 * respaldo es el dominio real y no un `localhost`: estos tres consumidores
 * —metadatos, robots y sitemap— solo importan cuando el sitio está publicado, y
 * un despliegue al que se le olvidó la variable debe declarar el dominio bueno,
 * no uno inventado.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kigyo.pro'

/** El dominio a secas, para el copy que lo nombra sin enlazarlo. */
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
