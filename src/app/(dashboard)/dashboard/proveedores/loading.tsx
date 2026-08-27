export default function Loading() {
  return (
    <div>
      <div className="gkpi" style={{ marginBottom: 16 }}>
        {[...Array(3)].map((_, i) => <div key={i} className="skel" style={{ height: 110, borderRadius: 24 }} />)}
      </div>
      <div className="skel" style={{ height: 340, borderRadius: 24 }} />
    </div>
  )
}