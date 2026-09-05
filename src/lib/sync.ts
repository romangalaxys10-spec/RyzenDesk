import { useState, useEffect, useCallback } from 'react'

export interface OfflineMutation {
  id: string
  type: string
  payload: any
  timestamp: string
}

const OFFLINE_QUEUE_KEY = 'ryzendesk_offline_queue'
const LAST_SYNC_KEY = 'ryzendesk_last_sync'

export function getOfflineQueue(): OfflineMutation[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveOfflineQueue(queue: OfflineMutation[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to save offline queue', e)
  }
}

export function queueMutation(type: string, payload: any): void {
  const queue = getOfflineQueue()
  queue.push({
    id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type,
    payload,
    timestamp: new Date().toISOString(),
  })
  saveOfflineQueue(queue)
}

export function useSyncManager() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [pendingCount, setPendingCount] = useState<number>(() => getOfflineQueue().length)
  const [lastSyncTime, setLastSyncTime] = useState<string>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_SYNC_KEY) || 'Just now' : 'Just now'
  )

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false)
      return
    }

    setIsSyncing(true)
    try {
      const queue = getOfflineQueue()
      if (queue.length > 0) {
        const res = await fetch('/api/offline/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mutations: queue }),
        })
        if (res.ok) {
          saveOfflineQueue([])
          setPendingCount(0)
        }
      }

      // Also trigger GitHub cloud sync check
      await fetch('/api/sync/pull', { method: 'POST' }).catch(() => {})

      const nowStr = new Date().toLocaleTimeString()
      setLastSyncTime(nowStr)
      localStorage.setItem(LAST_SYNC_KEY, nowStr)
      setIsOnline(true)
    } catch (err) {
      console.warn('Sync failed or offline', err)
      setIsOnline(false)
    } finally {
      setIsSyncing(false)
      setPendingCount(getOfflineQueue().length)
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      void triggerSync()
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic sync attempt every 30s
    const interval = setInterval(() => {
      if (navigator.onLine) void triggerSync()
    }, 30_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [triggerSync])

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    triggerSync,
  }
}
