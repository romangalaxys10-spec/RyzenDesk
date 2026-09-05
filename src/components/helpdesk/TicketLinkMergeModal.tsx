import React, { useState } from 'react'
import { Link2, GitMerge, X, Search, Check, AlertTriangle } from 'lucide-react'
import type { Ticket, LinkedTicket } from '../../types'
import { toast } from '../common/ToastContainer'

interface TicketLinkMergeModalProps {
  isOpen: boolean
  onClose: () => void
  currentTicket: Ticket
  allTickets: Ticket[]
  currentUsername: string
  onTicketsUpdated: (tickets: Ticket[]) => void
}

export const TicketLinkMergeModal: React.FC<TicketLinkMergeModalProps> = ({
  isOpen,
  onClose,
  currentTicket,
  allTickets,
  currentUsername,
  onTicketsUpdated,
}) => {
  const [mode, setMode] = useState<'link' | 'merge'>('link')
  const [search, setSearch] = useState('')
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [relation, setRelation] = useState<'relates_to' | 'duplicate_of' | 'blocks' | 'blocked_by'>('relates_to')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const candidates = allTickets.filter(
    (t) =>
      t.id !== currentTicket.id &&
      t.status !== 'closed' &&
      (t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.contact.fullName.toLowerCase().includes(search.toLowerCase()))
  )

  const handleLink = async () => {
    if (!selectedTargetId) {
      toast.error('Select a ticket', 'Please pick a ticket to link with')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/tickets/${currentTicket.id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTicketId: selectedTargetId,
          relation,
          actor: currentUsername,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Tickets Linked', `Successfully linked with ${selectedTargetId}`)
        // Update local ticket state
        const updated = allTickets.map((t) => {
          if (t.id === currentTicket.id) {
            return {
              ...t,
              linkedTickets: data.linkedTickets,
            }
          }
          return t
        })
        onTicketsUpdated(updated)
        onClose()
      } else {
        toast.error('Link Failed', data.error)
      }
    } catch (err: any) {
      toast.error('Network Error', err?.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMerge = async () => {
    if (!selectedTargetId) {
      toast.error('Select target ticket', 'Please pick the primary ticket to merge into')
      return
    }
    if (!window.confirm(`Are you sure you want to merge ticket ${currentTicket.id} into ${selectedTargetId}? Ticket ${currentTicket.id} will be permanently closed and conversation migrated.`)) {
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/tickets/${currentTicket.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTicketId: selectedTargetId,
          actor: currentUsername,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Ticket Merged', `Successfully merged into ${selectedTargetId}`)
        window.location.reload()
      } else {
        toast.error('Merge Failed', data.error)
      }
    } catch (err: any) {
      toast.error('Network Error', err?.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            {mode === 'link' ? (
              <Link2 className="w-5 h-5 text-sky-600" />
            ) : (
              <GitMerge className="w-5 h-5 text-indigo-600" />
            )}
            <h3 className="font-bold text-sm text-slate-800">
              {mode === 'link' ? 'Link Related Ticket' : 'Merge Duplicate Ticket'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-100/60 p-1 text-xs font-semibold">
          <button
            onClick={() => setMode('link')}
            className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              mode === 'link' ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Link Relation</span>
          </button>
          <button
            onClick={() => setMode('merge')}
            className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              mode === 'merge' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Merge Into Primary</span>
          </button>
        </div>

        <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
          {mode === 'merge' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-xs flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Warning:</strong> Merging will close current ticket{' '}
                <span className="font-mono font-bold">{currentTicket.id}</span> and transfer all message history and
                internal notes into the destination ticket.
              </div>
            </div>
          )}

          {mode === 'link' && (
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Relationship Type
              </label>
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-hidden focus:border-sky-500"
              >
                <option value="relates_to">Relates to</option>
                <option value="duplicate_of">Duplicate of</option>
                <option value="blocks">Blocks</option>
                <option value="blocked_by">Blocked by</option>
              </select>
            </div>
          )}

          {/* Search for candidate */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Select Target Ticket
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search by ID, subject, or customer name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          {/* Candidate list */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-100 rounded-lg p-1">
            {candidates.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">No matching tickets found</div>
            ) : (
              candidates.slice(0, 8).map((t) => {
                const isSelected = selectedTargetId === t.id
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTargetId(t.id)}
                    className={`p-2 rounded-lg cursor-pointer transition-all border flex items-center justify-between ${
                      isSelected
                        ? 'bg-sky-50 border-sky-300 text-sky-950 font-medium'
                        : 'border-transparent hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-500 font-bold">{t.id}</span>
                        <span className="truncate text-xs font-semibold">{t.subject}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t.contact.fullName} • {t.priority} • {t.status}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={mode === 'link' ? handleLink : handleMerge}
            disabled={isSubmitting || !selectedTargetId}
            className={`px-4 py-1.5 rounded-lg text-white font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
              mode === 'link' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {mode === 'link' ? <Link2 className="w-3.5 h-3.5" /> : <GitMerge className="w-3.5 h-3.5" />}
            <span>{isSubmitting ? 'Processing...' : mode === 'link' ? 'Link Ticket' : 'Merge Ticket'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
