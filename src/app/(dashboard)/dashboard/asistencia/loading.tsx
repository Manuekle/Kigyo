export default function Loading() {
  return (
    <div>
      <div className="phead" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel" style={{ width: 120, height: 26, borderRadius: 8 }} />
          <div className="skel" style={{ width: 200, height: 15, borderRadius: 5 }} />
        </div>
        <div className="skel" style={{ width: 110, height: 36, borderRadius: 999 }} />
      </div>
      <div className="card" style={{ marginBottom: 16, padding: 18 }}>
        <div className="skel" style={{ width: 160, height: 18, borderRadius: 5, marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {[...Array(35)].map((_, i) => <div key={i} className="skel" style={{ aspectRatio: '1', borderRadius: 6 }} />)}
        </div>
      </div>
      <div className="g2b">
        <div className="skel" style={{ height: 240, borderRadius: 24 }} />
        <div className="skel" style={{ height: 240, borderRadius: 24 }} />
      </div>
    </div>
  )
}
