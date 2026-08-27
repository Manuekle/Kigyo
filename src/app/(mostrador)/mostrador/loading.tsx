export default function Loading() {
  return (
    <div role="status" aria-label="Cargando el mostrador">
      <div className="pos-layout" aria-hidden="true">
        <div>
          <div className="skel" style={{ height: 40, borderRadius: 999, marginBottom: 14 }} />
          <div className="pos-grid">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="skel" style={{ height: 92, borderRadius: 14 }} />
            ))}
          </div>
        </div>
        <div className="skel" style={{ height: 380, borderRadius: 'var(--r-xl)' }} />
      </div>
    </div>
  )
}
