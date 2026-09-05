import React, { useState, useEffect } from 'react'
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { TicketSLAMetadata } from '../../types'

interface SlaTimerProps {
  sla: TicketSLAMetadata
  status: string
  compact?: boolean
}

export const SlaTimer: React.FC<SlaTimerProps> = ({ sla, status, compact = false }) => {
  const [, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(timer)
  }, [])

  const isResolved = status === 'resolved' || status === 'closed'
  const isFirstResponded = Boolean(sla.firstRespondedAt)

  // Response SLA calculation
  const targetResponse = new Date(sla.responseDueAt).getTime()
  const targetResolution = new Date(sla.resolutionDueAt).getTime()
  const current = Date.now()

  const responseDiff = targetResponse - current
  const resolutionDiff = targetResolution - current

  const isRespBreached = sla.isResponseBreached || (!isFirstResponded && responseDiff < 0)
  const isResBreached = sla.isResolutionBreached || (!isResolved && resolutionDiff < 0)

  const formatDiff = (diff: number) => {
    const abs = Math.abs(diff)
    const hours = Math.floor(abs / 3600_000)
    const minutes = Math.floor((abs % 3600_000) / 60_000)
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h`
    }
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (compact) {
    if (isResolved) {
      return (
        <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>SLA Met</span>
        </span>
      )
    }

    if (isRespBreached || isResBreached) {
      return (
        <span className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold text-rose-500 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          <span>-{formatDiff(isResBreached ? resolutionDiff : responseDiff)}</span>
        </span>
      )
    }

    const minDiff = !isFirstResponded ? responseDiff : resolutionDiff
    const isWarning = minDiff < 1800_000 // < 30 minutes

    return (
      <span
        className={`inline-flex items-center space-x-1.5 text-xs font-mono font-semibold ${
          isWarning ? 'text-amber-500' : 'text-slate-600'
        }`}
      >
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>{formatDiff(minDiff)}</span>
      </span>
    )
  }

  // Full detail view
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span className="flex items-center space-x-1.5">
          <Clock className="w-4 h-4 text-indigo-600" />
          <span>SLA Compliance Timers</span>
        </span>
        {isResolved ? (
          <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px] font-semibold">
            Ticket Resolved
          </span>
        ) : isRespBreached || isResBreached ? (
          <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[11px] font-bold animate-pulse">
            SLA BREACH ALERT
          </span>
        ) : (
          <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px] font-semibold">
            Active Targets
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Response SLA */}
        <div className="bg-white p-2.5 rounded border border-slate-200/80 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex justify-between">
            <span>First Response SLA</span>
            {isFirstResponded && <span className="text-emerald-600 font-semibold">Responded</span>}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span
              className={`font-semibold ${
                isFirstResponded
                  ? 'text-slate-700'
                  : isRespBreached
                  ? 'text-rose-600 font-bold'
                  : responseDiff < 1800_000
                  ? 'text-amber-600 font-bold'
                  : 'text-slate-800'
              }`}
            >
              {isFirstResponded
                ? 'Fulfilled'
                : isRespBreached
                ? `Breached by ${formatDiff(responseDiff)}`
                : `${formatDiff(responseDiff)} remaining`}
            </span>
          </div>
        </div>

        {/* Resolution SLA */}
        <div className="bg-white p-2.5 rounded border border-slate-200/80 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex justify-between">
            <span>Resolution SLA</span>
            {isResolved && <span className="text-emerald-600 font-semibold">Resolved</span>}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span
              className={`font-semibold ${
                isResolved
                  ? 'text-slate-700'
                  : isResBreached
                  ? 'text-rose-600 font-bold'
                  : resolutionDiff < 3600_000
                  ? 'text-amber-600 font-bold'
                  : 'text-slate-800'
              }`}
            >
              {isResolved
                ? 'Fulfilled'
                : isResBreached
                ? `Breached by ${formatDiff(resolutionDiff)}`
                : `${formatDiff(resolutionDiff)} remaining`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
