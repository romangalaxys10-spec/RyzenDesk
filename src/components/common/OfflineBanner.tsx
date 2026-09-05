import React, { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react'

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [reconnected, setReconnected] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setReconnected(true)
      setTimeout(() => setReconnected(false), 3500)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline && !reconnected) return null

  if (reconnected) {
    return (
      <div className="bg-emerald-600 text-white text-xs px-4 py-1.5 flex items-center justify-center space-x-2 font-medium animate-in fade-in">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>Connection restored. Local changes synced successfully.</span>
      </div>
    )
  }

  return (
    <div className="bg-amber-600 text-white text-xs px-4 py-1.5 flex items-center justify-between font-medium shadow-xs">
      <div className="flex items-center space-x-2">
        <WifiOff className="w-3.5 h-3.5 animate-pulse" />
        <span>Offline Mode: Working from local cache. Changes will queue and sync when connection returns.</span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="text-[11px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors flex items-center space-x-1"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Retry</span>
      </button>
    </div>
  )
}
