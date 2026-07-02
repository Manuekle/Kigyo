export default function Loading() {
  return (
    <div>
      <div className="phead" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel" style={{ width: 110, height: 26, borderRadius: 8 }} />
          <div className="skel" style={{ width: 180, height: 15, borderRadius: 5 }} />
        </div>
        <div className="skel" style={{ width: 130, height: 36, borderRadius: 999 }} />
      </div>
      <div className="g3" style={{ marginBottom: 16 }}>
        {[...Array(3)].map((_, i) => <div key={i} className="skel" style={{ height: 84, borderRadius: 16 }} />)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[...Array(2)].map((_, i) => <div key={i} className="skel" style={{ width: 100, height: 34, borderRadius: 999 }} />)}
      </div>
      <div className="card">
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 18px', borderBottom: '1px solid var(--line2)', alignItems: 'center' }}>
            <div className="skel" style={{ flex: 2, height: 14, borderRadius: 4 }} />
            <div className="skel" style={{ flex: 1, height: 14, borderRadius: 4 }} />
            <div className="skel" style={{ flex: 1, height: 14, borderRadius: 4 }} />
            <div className="skel" style={{ width: 70, height: 24, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
