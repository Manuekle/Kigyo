export default function Loading() {
  return (
    <div>
      <div className="g2b" style={{ marginBottom: 16 }}>
        <div className="skel" style={{ height: 200, borderRadius: 24 }} />
        <div className="skel" style={{ height: 200, borderRadius: 24 }} />
      </div>
      <div className="card" style={{ marginBottom: 16, padding: 18 }}>
        <div className="skel" style={{ width: 140, height: 18, borderRadius: 5, marginBottom: 14 }} />
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
            <div className="skel" style={{ width: 140, height: 14, borderRadius: 4 }} />
            <div className="skel" style={{ flex: 1, height: 14, borderRadius: 4 }} />
          </div>
        ))}
      </div>
      <div className="skel" style={{ height: 240, borderRadius: 24 }} />
    </div>
  )
}
