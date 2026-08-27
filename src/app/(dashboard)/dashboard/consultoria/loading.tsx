export default function Loading() {
  return (
    <div>
      <div className="g2b" style={{ alignItems: 'start' }}>
        <div className="skel" style={{ height: 420, borderRadius: 24 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skel" style={{ height: 90, borderRadius: 14 }} />)}
        </div>
      </div>
    </div>
  )
}
