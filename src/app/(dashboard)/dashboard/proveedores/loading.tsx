export default function Loading() {
  return (
    <div>
      <div className="phead" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel" style={{ width: 160, height: 26, borderRadius: 8 }} />
          <div className="skel" style={{ width: 280, height: 15, borderRadius: 5 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skel" style={{ width: 150, height: 36, borderRadius: 999 }} />
        </div>
      </div>
      <div className="gkpi" style={{ marginBottom: 16 }}>
        {[...Array(3)].map((_, i) => <div key={i} className="skel" style={{ height: 110, borderRadius: 24 }} />)}
      </div>
      <div className="skel" style={{ height: 340, borderRadius: 24 }} />
    </div>
  )
}