import React, { useState, useEffect } from 'react'
import { Users, Eye, Edit3 } from 'lucide-react'

interface AgentPresenceIndicatorProps {
  ticketId: string
  currentUsername: string
}

interface ViewerInfo {
  username: string
  action: 'viewing' | 'typing'
  timestamp: number
}

export const AgentPresenceIndicator: React.FC<AgentPresenceIndicatorProps> = ({ ticketId, currentUsername }) => {
  const [activeViewers, setActiveViewers] = useState<ViewerInfo[]>([])

  useEffect(() => {
    // Send initial view heartbeat
    const sendHeartbeat = async (action: 'viewing' | 'typing' = 'viewing') => {
      try {
        const res = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId, username: currentUsername, action }),
        })
        const data = await res.json()
        if (data.activeViewers) {
          setActiveViewers(data.activeViewers)
        }
      } catch (err) {
        // silent fail
      }
    }

    sendHeartbeat('viewing')
    const interval = setInterval(() => sendHeartbeat('viewing'), 10000)

    return () => {
      clearInterval(interval)
      // Send leave beacon
      void fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, username: currentUsername, action: 'leave' }),
        keepalive: true,
      })
    }
  }, [ticketId, currentUsername])

  if (activeViewers.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5 px-3 flex items-center justify-between text-xs animate-in fade-in shadow-2xs">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
        <Users className="w-3.5 h-3.5 text-amber-600" />
        <span className="font-medium">
          Collision Warning:{' '}
          <strong>
            {activeViewers.map((v) => v.username).join(', ')}
          </strong>{' '}
          {activeViewers.length === 1 ? 'is' : 'are'} also looking at this ticket.
        </span>
      </div>
      <div className="flex items-center space-x-1 text-[10px] text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded font-mono">
        <Eye className="w-3 h-3" />
        <span>Active Viewing</span>
      </div>
    </div>
  )
}
