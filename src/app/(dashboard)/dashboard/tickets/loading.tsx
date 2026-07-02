export default function Loading() {
  return (
    <div>
      <div className="phead" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel" style={{ width: 100, height: 26, borderRadius: 8 }} />
          <div className="skel" style={{ width: 220, height: 15, borderRadius: 5 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skel" style={{ width: 140, height: 36, borderRadius: 8 }} />
          <div className="skel" style={{ width: 130, height: 36, borderRadius: 999 }} />
        </div>
      </div>
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
