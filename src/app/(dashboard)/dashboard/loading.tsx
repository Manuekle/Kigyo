export default function Loading() {
  return (
    <div style={{ animation: 'none' }}>
      {/* Page header skeleton */}
      <div className="phead" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel" style={{ width: 180, height: 26, borderRadius: 8 }} />
          <div className="skel" style={{ width: 260, height: 16, borderRadius: 6 }} />
        </div>
        <div className="skel" style={{ width: 120, height: 36, borderRadius: 999 }} />
      </div>

      {/* KPI row skeleton */}
      <div className="gkpi" style={{ marginBottom: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skel" style={{ height: 110, borderRadius: 24 }} />
        ))}
      </div>

      {/* Stat row skeleton */}
      <div className="g3" style={{ marginBottom: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skel" style={{ height: 84, borderRadius: 16 }} />
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="g2">
        <div className="skel" style={{ height: 300, borderRadius: 24 }} />
        <div className="skel" style={{ height: 300, borderRadius: 24 }} />
      </div>
    </div>
  )
}
