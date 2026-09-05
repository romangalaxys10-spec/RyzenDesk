import React, { useState, useEffect } from 'react'
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react'

export interface ToastItem {
  id: string
  title: string
  message?: string
  type?: 'success' | 'warning' | 'info' | 'error'
  duration?: number
}

// Global toast event dispatcher
type ToastListener = (toast: ToastItem) => void
const listeners: ToastListener[] = []

export const toast = {
  show: (item: Omit<ToastItem, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const toastWithId = { ...item, id }
    listeners.forEach((fn) => fn(toastWithId))
  },
  success: (title: string, message?: string) => toast.show({ title, message, type: 'success' }),
  error: (title: string, message?: string) => toast.show({ title, message, type: 'error' }),
  info: (title: string, message?: string) => toast.show({ title, message, type: 'info' }),
  warning: (title: string, message?: string) => toast.show({ title, message, type: 'warning' }),
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler: ToastListener = (newToast) => {
      setToasts((prev) => [...prev, newToast])
      const duration = newToast.duration || 4000
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id))
      }, duration)
    }

    listeners.push(handler)
    return () => {
      const idx = listeners.indexOf(handler)
      if (idx !== -1) listeners.splice(idx, 1)
    }
  }, [])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((item) => {
        const isSuccess = item.type === 'success'
        const isError = item.type === 'error'
        const isWarning = item.type === 'warning'

        return (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg bg-white/95 backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-3 ${
              isSuccess
                ? 'border-emerald-200 text-emerald-950'
                : isError
                ? 'border-rose-200 text-rose-950'
                : isWarning
                ? 'border-amber-200 text-amber-950'
                : 'border-slate-200 text-slate-900'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {isError && <XCircle className="w-4 h-4 text-rose-600" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4 text-sky-600" />}
            </div>

            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-semibold leading-tight">{item.title}</h5>
              {item.message && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.message}</p>}
            </div>

            <button
              onClick={() => removeToast(item.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
