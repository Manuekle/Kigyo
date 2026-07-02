export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 18 }}>
      <div className="skel" style={{ width: 52, height: 52, borderRadius: 16 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div className="skel" style={{ width: 220, height: 22, borderRadius: 8 }} />
        <div className="skel" style={{ width: 300, height: 15, borderRadius: 5 }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 9, maxWidth: 540, marginTop: 6 }}>
        {[150, 170, 140, 130].map((w, i) => <div key={i} className="skel" style={{ width: w, height: 38, borderRadius: 999 }} />)}
      </div>
    </div>
  )
}
