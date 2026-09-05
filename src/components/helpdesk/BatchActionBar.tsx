import React, { useState } from 'react'
import { CheckSquare, User, Flag, Tag, FileSpreadsheet, X, Layers } from 'lucide-react'
import type { TicketStatus, TicketPriority, StaffMember } from '../../types'
import { toast } from '../common/ToastContainer'

interface BatchActionBarProps {
  selectedCount: number
  selectedIds: string[]
  staffMembers: StaffMember[]
  onClearSelection: () => void
  onBulkUpdate: (action: string, value: string) => Promise<void>
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  selectedIds,
  staffMembers,
  onClearSelection,
  onBulkUpdate,
}) => {
  const [isUpdating, setIsUpdating] = useState(false)

  if (selectedCount === 0) return null

  const handleAction = async (action: string, value: string) => {
    if (!value) return
    setIsUpdating(true)
    try {
      await onBulkUpdate(action, value)
      toast.success('Bulk Update Applied', `Updated ${selectedCount} tickets (${action}: ${value})`)
    } catch (err: any) {
      toast.error('Bulk Update Failed', err?.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleExportSelectedCsv = () => {
    const csvUrl = `/api/tickets/export?format=csv`
    window.open(csvUrl, '_blank')
    toast.success('Exporting', `Exporting tickets to CSV`)
  }

  const handlePromptAddTag = () => {
    const tag = window.prompt('Enter tag to add to selected tickets:')
    if (tag && tag.trim()) {
      void handleAction('add_tag', tag.trim())
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-3 border border-slate-700 animate-in slide-in-from-bottom-5 text-xs">
      <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
        <span className="w-5 h-5 rounded-full bg-sky-500 text-white font-bold text-[11px] flex items-center justify-center">
          {selectedCount}
        </span>
        <span className="font-semibold text-slate-200">Selected</span>
      </div>

      {/* Bulk Status */}
      <div className="flex items-center gap-1">
        <Layers className="w-3.5 h-3.5 text-slate-400" />
        <select
          defaultValue=""
          disabled={isUpdating}
          onChange={(e) => {
            if (e.target.value) handleAction('status', e.target.value)
            e.target.value = ''
          }}
          className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-hidden focus:border-sky-500"
        >
          <option value="" disabled>
            Set Status...
          </option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting_customer">Waiting on Customer</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Bulk Priority */}
      <div className="flex items-center gap-1">
        <Flag className="w-3.5 h-3.5 text-slate-400" />
        <select
          defaultValue=""
          disabled={isUpdating}
          onChange={(e) => {
            if (e.target.value) handleAction('priority', e.target.value)
            e.target.value = ''
          }}
          className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-hidden focus:border-sky-500"
        >
          <option value="" disabled>
            Set Priority...
          </option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {/* Bulk Assignee */}
      <div className="flex items-center gap-1">
        <User className="w-3.5 h-3.5 text-slate-400" />
        <select
          defaultValue=""
          disabled={isUpdating}
          onChange={(e) => {
            if (e.target.value) handleAction('assign', e.target.value)
            e.target.value = ''
          }}
          className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-hidden focus:border-sky-500 max-w-[120px] truncate"
        >
          <option value="" disabled>
            Assign Agent...
          </option>
          {staffMembers.map((sm) => (
            <option key={sm.username} value={sm.username}>
              {sm.displayName || sm.username}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Tag */}
      <button
        onClick={handlePromptAddTag}
        disabled={isUpdating}
        className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition-colors"
      >
        <Tag className="w-3 h-3 text-sky-400" />
        <span>Add Tag</span>
      </button>

      {/* Export CSV */}
      <button
        onClick={handleExportSelectedCsv}
        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600/60 rounded-lg text-white transition-colors"
      >
        <FileSpreadsheet className="w-3 h-3" />
        <span>Export CSV</span>
      </button>

      {/* Clear */}
      <button
        onClick={onClearSelection}
        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-1"
        title="Clear Selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
