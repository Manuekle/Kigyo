export default function Loading() {
  return (
    <div>
      <div className="gkpi" style={{ marginBottom: 16 }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skel" style={{ height: 110, borderRadius: 24 }} />)}
      </div>
      <div className="skel" style={{ height: 340, borderRadius: 24 }} />
    </div>
  )
}