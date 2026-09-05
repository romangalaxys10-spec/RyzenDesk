import React, { useState, useEffect } from 'react'
import { Clock, Play, Pause, Plus, Check, DollarSign } from 'lucide-react'
import type { Ticket, TicketTimeLog } from '../../types'
import { toast } from '../common/ToastContainer'

interface TicketTimeTrackerProps {
  ticket: Ticket
  currentUsername: string
  onTimeLogged: (newLog: TicketTimeLog) => void
}

export const TicketTimeTracker: React.FC<TicketTimeTrackerProps> = ({ ticket, currentUsername, onTimeLogged }) => {
  const [isRunning, setIsRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [manualMinutes, setManualMinutes] = useState('')
  const [description, setDescription] = useState('')
  const [isBillable, setIsBillable] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Stopwatch interval
  useEffect(() => {
    let timer: any = null
    if (isRunning) {
      timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    }
    return () => clearInterval(timer)
  }, [isRunning])

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStopAndSave = async () => {
    const mins = Math.max(1, Math.round(seconds / 60))
    await submitTime(mins, description || 'Live session timer')
    setIsRunning(false)
    setSeconds(0)
    setDescription('')
  }

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const mins = parseInt(manualMinutes, 10)
    if (!mins || mins <= 0) {
      toast.error('Invalid duration', 'Please enter a valid number of minutes')
      return
    }
    await submitTime(mins, description || 'Manual time entry')
    setManualMinutes('')
    setDescription('')
  }

  const submitTime = async (mins: number, desc: string) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/timelogs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes: mins,
          description: desc,
          isBillable,
          author: currentUsername,
        }),
      })
      const data = await res.json()
      if (res.ok && data.timeLog) {
        onTimeLogged(data.timeLog)
        toast.success('Time Logged', `${mins} minutes added to ticket ${ticket.id}`)
      } else {
        toast.error('Logging Failed', data.error)
      }
    } catch (err: any) {
      toast.error('Network Error', err?.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalLoggedMinutes = (ticket.timeLogs || []).reduce((acc, curr) => acc + curr.minutes, 0)
  const totalBillableMinutes = (ticket.timeLogs || [])
    .filter((l) => l.isBillable)
    .reduce((acc, curr) => acc + curr.minutes, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 text-xs shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-sky-600" />
          <h4 className="font-bold text-slate-800">Time & Billing Tracking</h4>
        </div>
        <div className="flex items-center space-x-2 text-[11px]">
          <span className="text-slate-500">
            Total: <strong className="text-slate-800">{Math.floor(totalLoggedMinutes / 60)}h {totalLoggedMinutes % 60}m</strong>
          </span>
          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
            {Math.floor(totalBillableMinutes / 60)}h {totalBillableMinutes % 60}m billable
          </span>
        </div>
      </div>

      {/* Stopwatch & Manual Entry Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* Stopwatch Card */}
        <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Live Session Timer</span>
            <div className="font-mono text-sm font-bold text-slate-800">{formatTimer(seconds)}</div>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            {!isRunning ? (
              <button
                type="button"
                onClick={() => setIsRunning(true)}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-medium py-1 px-2 rounded flex items-center justify-center gap-1 transition-colors"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Start Timer</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsRunning(false)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-1 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                >
                  <Pause className="w-3 h-3" />
                  <span>Pause</span>
                </button>
                <button
                  type="button"
                  onClick={handleStopAndSave}
                  disabled={isSubmitting || seconds === 0}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1 px-2 rounded flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Check className="w-3 h-3" />
                  <span>Log Time</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Manual Minutes Form */}
        <form onSubmit={handleManualAdd} className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Quick Log Entry</span>
          <div className="flex gap-1.5">
            <input
              type="number"
              min="1"
              max="1440"
              placeholder="Minutes"
              value={manualMinutes}
              onChange={(e) => setManualMinutes(e.target.value)}
              className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-hidden focus:border-sky-500"
            />
            <input
              type="text"
              placeholder="Work activity description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center space-x-1 cursor-pointer text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={isBillable}
                onChange={(e) => setIsBillable(e.target.checked)}
                className="rounded text-sky-600 focus:ring-0"
              />
              <span className="flex items-center gap-0.5">
                <DollarSign className="w-3 h-3 text-emerald-600" /> Billable
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !manualMinutes}
              className="bg-slate-800 hover:bg-slate-900 text-white font-medium px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
        </form>
      </div>

      {/* Recent Time Logs Table */}
      {ticket.timeLogs && ticket.timeLogs.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400">Activity Log History</div>
          <div className="max-h-28 overflow-y-auto space-y-1">
            {ticket.timeLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100 text-[11px]"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-700">{log.minutes}m</span>
                  <span className="text-slate-500 truncate max-w-xs">{log.description}</span>
                </div>
                <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                  {log.isBillable && <span className="text-emerald-600 font-bold">$</span>}
                  <span>by {log.author}</span>
                  <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
