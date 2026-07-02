export default function Loading() {
  return (
    <div>
      <div className="phead" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="skel" style={{ width: 36, height: 36, borderRadius: 999 }} />
          <div className="skel" style={{ width: 48, height: 48, borderRadius: 999 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skel" style={{ width: 200, height: 22, borderRadius: 7 }} />
            <div className="skel" style={{ width: 160, height: 15, borderRadius: 5 }} />
          </div>
        </div>
      </div>
      <div className="g2b" style={{ marginBottom: 16 }}>
        <div className="skel" style={{ height: 320, borderRadius: 24 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skel" style={{ height: 120, borderRadius: 24 }} />
          <div className="skel" style={{ height: 180, borderRadius: 24 }} />
        </div>
      </div>
      <div className="skel" style={{ height: 220, borderRadius: 24 }} />
    </div>
  )
}
