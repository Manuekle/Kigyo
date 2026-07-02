export default function Loading() {
  return (
    <div>
      <div className="phead" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel" style={{ width: 140, height: 26, borderRadius: 8 }} />
          <div className="skel" style={{ width: 200, height: 15, borderRadius: 5 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skel" style={{ width: 100, height: 36, borderRadius: 999 }} />
          <div className="skel" style={{ width: 140, height: 36, borderRadius: 999 }} />
        </div>
      </div>
      <div className="card">
        <div style={{ padding: '14px 18px', display: 'flex', gap: 10 }}>
          <div className="skel" style={{ flex: 1, height: 36, borderRadius: 999 }} />
          <div className="skel" style={{ width: 300, height: 36, borderRadius: 999 }} />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 18px', borderBottom: '1px solid var(--line2)', alignItems: 'center' }}>
            <div className="skel" style={{ width: 32, height: 32, borderRadius: 999, flexShrink: 0 }} />
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div className="skel" style={{ width: '60%', height: 14, borderRadius: 4 }} />
              <div className="skel" style={{ width: '40%', height: 12, borderRadius: 4 }} />
            </div>
            <div className="skel" style={{ flex: 1, height: 14, borderRadius: 4 }} />
            <div className="skel" style={{ flex: 1, height: 14, borderRadius: 4 }} />
            <div className="skel" style={{ width: 70, height: 24, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
