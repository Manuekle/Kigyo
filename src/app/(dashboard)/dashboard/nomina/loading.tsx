export default function Loading() {
  return (
    <div>
      <div className="gkpi" style={{ marginBottom: 16 }}>
        {[...Array(3)].map((_, i) => <div key={i} className="skel" style={{ height: 110, borderRadius: 24 }} />)}
      </div>
      <div className="g2" style={{ marginBottom: 16 }}>
        <div className="skel" style={{ height: 280, borderRadius: 24 }} />
        <div className="skel" style={{ height: 280, borderRadius: 24 }} />
      </div>
      <div className="g2b">
        <div className="skel" style={{ height: 220, borderRadius: 24 }} />
        <div className="skel" style={{ height: 220, borderRadius: 24 }} />
      </div>
    </div>
  )
}
