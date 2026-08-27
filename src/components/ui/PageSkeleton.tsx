/**
 * The shape of a dashboard page while it loads.
 *
 * There used to be forty-four `loading.tsx` files and twenty-six of them were
 * byte-identical — `pos/loading.tsx` and `clientes/loading.tsx` were the same
 * file, drawing three KPIs and four cards, which is the layout of neither. All
 * forty-three also painted a `.phead`: a title, a subtitle and two buttons that
 * the real page never rendered, so every navigation ended with the content
 * jumping up by the height of a heading.
 *
 * The heading is real now and lives in the layout (`PageHeader`), which does not
 * re-render between routes — so a skeleton starts exactly where the content
 * will, and there is nothing left to jump. What remains is what a page under
 * this product actually looks like: a row of figures, then one card holding a
 * table.
 *
 * Nineteen routes had no `loading.tsx` at all and now do.
 */

/**
 * Varied but fixed.
 *
 * Rows of identical width read as a progress bar rather than as text; rows of
 * random width would differ between the server render and the client's and
 * produce a hydration mismatch on a component whose entire job is to appear
 * before anything else. A cycle is both.
 */
const ROW_WIDTHS = ['92%', '78%', '85%', '64%', '88%', '71%']

interface PageSkeletonProps {
  /** Figures above the card. Zero for a page that opens straight into content. */
  kpis?: number
  /** Lines inside the card. */
  rows?: number
}

export default function PageSkeleton({ kpis = 4, rows = 8 }: PageSkeletonProps) {
  return (
    <div role="status" aria-label="Cargando la página">
      {kpis > 0 && (
        <div className="g3" style={{ marginBottom: 16 }} aria-hidden="true">
          {Array.from({ length: kpis }, (_, i) => (
            <div key={i} className="skel" style={{ height: 104, borderRadius: 'var(--r-xl)' }} />
          ))}
        </div>
      )}
      <div className="card cpad" aria-hidden="true">
        <div className="skel" style={{ width: 168, height: 17, borderRadius: 6, marginBottom: 20 }} />
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="skel"
            style={{
              height: 14,
              borderRadius: 5,
              marginBottom: i === rows - 1 ? 4 : 16,
              width: ROW_WIDTHS[i % ROW_WIDTHS.length],
            }}
          />
        ))}
      </div>
    </div>
  )
}
