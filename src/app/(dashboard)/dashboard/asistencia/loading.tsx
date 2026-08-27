export default function Loading() {
  return (
    <div>
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
