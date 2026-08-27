/**
 * Canales is a chat, not a document: a list of channels on the left and the
 * conversation on the right, both full height. The generic skeleton it shared
 * with twenty-five other routes drew three figures and four cards, which is the
 * shape of the page it is not.
 */
export default function Loading() {
  return (
    <div className="ch-page" role="status" aria-label="Cargando los canales">
      <div className="ch-side" aria-hidden="true">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skel" style={{ height: 46, borderRadius: 12, margin: '6px 10px' }} />
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: 20, minWidth: 0 }} aria-hidden="true">
        {[62, 44, 78, 38, 56].map((h, i) => (
          <div
            key={i}
            className="skel"
            style={{
              height: h,
              width: i % 2 ? '52%' : '64%',
              maxWidth: '78%',
              borderRadius: 16,
              alignSelf: i % 2 ? 'flex-end' : 'flex-start',
            }}
          />
        ))}
      </div>
    </div>
  )
}
