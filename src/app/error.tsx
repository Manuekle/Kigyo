'use client'

import { useEffect } from 'react'
import StatusCard from '@/components/ui/StatusCard'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="loginwrap">
      <StatusCard
        type="err"
        title="Algo salió mal"
        sub={error.message || 'Ocurrió un error inesperado. Intenta de nuevo.'}
        actions={
          <button onClick={reset} className="btn dark">
            Reintentar
          </button>
        }
      />
    </div>
  )
}
