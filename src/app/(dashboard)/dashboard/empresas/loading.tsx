export default function Loading() {
  return (
    <div>
      <div className="phead" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel" style={{ width: 120, height: 26, borderRadius: 8 }} />
          <div className="skel" style={{ width: 300, height: 15, borderRadius: 5 }} />
        </div>
        <div className="skel" style={{ width: 140, height: 36, borderRadius: 999 }} />
      </div>
      <div className="g2" style={{ marginBottom: 16 }}>
        <div className="skel" style={{ height: 120, borderRadius: 24 }} />
        <div className="skel" style={{ height: 120, borderRadius: 24 }} />
      </div>
    </div>
  )
}
