/**
 * The counter: a grid of product tiles and the sale beside it. The generic
 * skeleton it shared with twenty-five other routes drew three figures and four
 * cards — this is the one screen where somebody is standing in front of the
 * person using it, so a load that redraws into a different layout is the worst
 * place in the product to have one.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Cargando el punto de venta">
      <div className="g3" style={{ marginBottom: 16 }} aria-hidden="true">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skel" style={{ height: 104, borderRadius: 'var(--r-xl)' }} />
        ))}
      </div>
      <div className="card cpad" aria-hidden="true">
        <div className="pos-layout">
          <div>
            <div className="skel" style={{ height: 36, borderRadius: 999, marginBottom: 14 }} />
            <div className="pos-grid">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="skel" style={{ height: 84, borderRadius: 14 }} />
              ))}
            </div>
          </div>
          <div className="skel" style={{ height: 320, borderRadius: 'var(--r-xl)' }} />
        </div>
      </div>
    </div>
  )
}
