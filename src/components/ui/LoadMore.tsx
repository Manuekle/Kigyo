'use client'

/**
 * The footer of a paged list.
 *
 * Every list screen used to stop at its `.limit()` without saying so, which is
 * the failure this component exists to make impossible: it always states how
 * many of how many rows are on screen, and only offers the button when there
 * is genuinely more to fetch. A list that fits in one page says nothing at all
 * — a count under a list of six is noise.
 */
export default function LoadMore({
  loaded,
  total,
  loading,
  error,
  onLoadMore,
  noun,
}: {
  loaded: number
  total: number
  loading: boolean
  error?: string
  onLoadMore: () => void
  /** Plural noun for the counter: "registros", "empleados", "documentos". */
  noun: string
}) {
  const complete = loaded >= total
  if (complete && !error) return null

  return (
    <div className="loadmore">
      {error && (
        <p className="errline" role="alert" style={{ justifyContent: 'center', marginTop: 0 }}>
          {error}
        </p>
      )}

      {!complete && (
        <>
          {/* Polite rather than assertive: the count changing under a reader
              who pressed the button is an update, not an interruption. */}
          <p className="loadmore-count" aria-live="polite">
            Mostrando {loaded} de {total} {noun}
          </p>
          <button
            type="button"
            className="btn"
            onClick={onLoadMore}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Cargando…' : 'Cargar más'}
          </button>
        </>
      )}
    </div>
  )
}
