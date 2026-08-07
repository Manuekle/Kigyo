export default function Loading() {
  return (
    <div>
      <div className="phead" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel" style={{ width: 140, height: 26, borderRadius: 8 }} />
          <div className="skel" style={{ width: 200, height: 15, borderRadius: 5 }} />
        </div>
        <div className="skel" style={{ width: 160, height: 36, borderRadius: 999 }} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div className="skel" style={{ flex: 1, height: 36, borderRadius: 999 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skel" style={{ width: 80, height: 36, borderRadius: 999 }} />)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(230px, 100%), 1fr))', gap: 12 }}>
        {[...Array(9)].map((_, i) => <div key={i} className="skel" style={{ height: 120, borderRadius: 16 }} />)}
      </div>
    </div>
  )
}
