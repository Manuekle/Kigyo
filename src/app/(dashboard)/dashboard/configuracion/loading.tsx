export default function Loading() {
  return (
    <div>
      {/* tab bar skeleton */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skel" style={{ width: i === 0 ? 130 : 110, height: 30, borderRadius: 999 }} />
        ))}
      </div>

      {/* content card skeleton */}
      <div className="card cpad" style={{ padding: '20px 24px' }}>
        <div className="skel" style={{ width: 140, height: 16, borderRadius: 5, marginBottom: 10 }} />
        <div className="skel" style={{ width: 200, height: 12, borderRadius: 4, marginBottom: 24 }} />

        {/* avatar + button row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div className="skel" style={{ width: 64, height: 64, borderRadius: '50%' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skel" style={{ width: 120, height: 14, borderRadius: 4 }} />
            <div className="skel" style={{ width: 80, height: 11, borderRadius: 3 }} />
          </div>
        </div>

        {/* form fields */}
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <div className="skel" style={{ width: 100, height: 12, borderRadius: 4, marginBottom: 8 }} />
            <div className="skel" style={{ width: '100%', height: 36, borderRadius: 999 }} />
          </div>
        ))}

        {/* save button */}
        <div className="skel" style={{ width: 150, height: 36, borderRadius: 999, marginTop: 8 }} />
      </div>
    </div>
  )
}
