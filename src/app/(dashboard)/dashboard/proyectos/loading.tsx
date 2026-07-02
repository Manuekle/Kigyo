export default function Loading() {
  return (
    <div>
      <div className="g3" style={{ marginBottom: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <div className="card kpi rise d{i}" key={i}>
            <div className="skel" style={{ height: 14, width: '60%', marginBottom: 8 }} />
            <div className="skel" style={{ height: 28, width: '40%' }} />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="skel" style={{ height: 40, marginBottom: 12 }} />
        {[1, 2, 3, 4].map((i) => (
          <div className="skel" key={i} style={{ height: 48, marginBottom: 8 }} />
        ))}
      </div>
    </div>
  )
}
