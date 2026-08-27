export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, overflowX: 'hidden' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ flex: 1, minWidth: 260 }}>
            <div className="skel" style={{ height: 44, borderRadius: 14, marginBottom: 12 }} />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="skel" style={{ height: 100, borderRadius: 13, marginBottom: 10 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
