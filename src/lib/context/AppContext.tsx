'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Toast, ToastType } from '@/lib/types'

interface AppContextValue {
  toasts: Toast[]
  addToast: (msg: string, type?: ToastType, action?: string, onAction?: () => void) => void
  removeToast: (id: number) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  cmdOpen: boolean
  setCmdOpen: (open: boolean) => void
}

const AppContext = createContext<AppContextValue | null>(null)

let nextId = 0

export function AppProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)

  const addToast = useCallback(
    (msg: string, type: ToastType = 'ok', action?: string, onAction?: () => void) => {
      const id = ++nextId
      setToasts((prev) => [...prev, { id, type, msg, action, onAction }])
      // Lifetime + exit animation are owned by <ToastItem> so the toast can
      // play its .out transition before it unmounts.
    },
    []
  )

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <AppContext.Provider
      value={{ toasts, addToast, removeToast, sidebarOpen, setSidebarOpen, cmdOpen, setCmdOpen }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
