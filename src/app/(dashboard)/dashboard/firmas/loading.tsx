export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[...Array(3)].map((_, i) => <div key={i} className="skel" style={{ width: 90, height: 32, borderRadius: 999 }} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skel" style={{ height: 76, borderRadius: 14 }} />
        ))}
      </div>
    </div>
  )
}
