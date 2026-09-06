import React, { useEffect, useState } from 'react'
import { Users, Ticket as TicketIcon, Star } from 'lucide-react'
import type { CustomerContext } from '../../types'

/**
 * Customer context card (Kayako "SingleView" parity): aggregates every ticket
 * the contact has ever filed, plus portal-account info, into one strip.
 * Staff-facing — the endpoint enforces tickets_view_all server-side.
 */
export const CustomerContextCard: React.FC<{ email: string }> = ({ email }) => {
  const [ctx, setCtx] = useState<CustomerContext | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let dead = false
    setCtx(null)
    fetch(`/api/admin/customers/${encodeURIComponent(email)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (!dead) setCtx(d) })
      .catch(() => { /* 403 for roles without tickets_view_all — card stays hidden */ })
    return () => { dead = true }
  }, [email])

  if (!ctx || ctx.totals.count === 0) return null

  return (
    <div className="text-xs bg-indigo-50/60 border border-indigo-100 rounded-lg p-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left font-semibold text-indigo-800">
        <Users className="w-3.5 h-3.5" />
        Customer history — {ctx.totals.count} ticket{ctx.totals.count === 1 ? '' : 's'}
        <span className="ml-auto text-indigo-400">{open ? 'hide' : 'show'}</span>
      </button>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-indigo-900/70">
        <span>{ctx.totals.open} open · {ctx.totals.resolved} resolved</span>
        {ctx.totals.avgCsat !== null && (
          <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-500" /> {ctx.totals.avgCsat}/5 avg CSAT</span>
        )}
        {ctx.totals.firstSeen && <span>customer since {new Date(ctx.totals.firstSeen).toLocaleDateString()}</span>}
        {ctx.portalUser && <span className="font-mono">{ctx.portalUser.zaiId}</span>}
      </div>
      {open && (
        <ul className="mt-2 space-y-1">
          {ctx.tickets.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-slate-600">
              <TicketIcon className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="font-mono">{t.id}</span>
              <span className="truncate">{t.subject}</span>
              <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded bg-white border border-slate-200">{t.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}