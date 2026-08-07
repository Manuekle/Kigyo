export default function Loading() {
  return (
    <div>
      <div className="phead" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel" style={{ width: 180, height: 26, borderRadius: 8 }} />
          <div className="skel" style={{ width: 240, height: 15, borderRadius: 5 }} />
        </div>
      </div>
      <div className="g2" style={{ marginBottom: 16 }}>
        <div className="skel" style={{ height: 200, borderRadius: 24 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skel" style={{ height: 58, borderRadius: 14 }} />)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(230px, 100%), 1fr))', gap: 12 }}>
        {[...Array(6)].map((_, i) => <div key={i} className="skel" style={{ height: 130, borderRadius: 16 }} />)}
      </div>
    </div>
  )
}
