export default function Loading() {
  return (
    <div>
      <div className="g2">
        <div className="skel" style={{ height: 360, borderRadius: 24 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skel" style={{ height: 22, width: 120, borderRadius: 6 }} />
          {[...Array(5)].map((_, i) => <div key={i} className="skel" style={{ height: 64, borderRadius: 14 }} />)}
        </div>
      </div>
    </div>
  )
}
