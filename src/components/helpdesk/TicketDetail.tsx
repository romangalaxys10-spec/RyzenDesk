import React, { useState } from 'react'
import {
  ArrowLeft,
  Send,
  Lock,
  MessageSquare,
  Paperclip,
  Share2,
  Sparkles,
  AlertOctagon,
  CheckCircle2,
  User,
  Users,
  Clock,
  Kanban,
  Link2,
  GitMerge,
  ExternalLink,
} from 'lucide-react'
import type { Ticket, StaffRole, StaffMember, CannedReply, FileAttachment, TicketStatus, TicketPriority, Team, TicketTimeLog, TicketCSAT, TicketSummaryAI } from '../../types'
import { SlaTimer } from './SlaTimer'
import { AttachmentList, AttachmentUploader } from './AttachmentViewer'
import { CannedRepliesModal } from './CannedRepliesModal'
import { useI18n } from '../../i18n/translations'
import { TicketAIPanel } from './TicketAIPanel'
import { TicketTimeTracker } from './TicketTimeTracker'
import { CustomerCSATWidget } from './CustomerCSATWidget'
import { AgentPresenceIndicator } from './AgentPresenceIndicator'
import { TicketLinkMergeModal } from './TicketLinkMergeModal'
import { MarkdownComposer } from './MarkdownComposer'
import { playChimeSound } from '../../utils/soundNotifications'
import { toast } from '../common/ToastContainer'

interface TicketDetailProps {
  ticket: Ticket
  onBack: () => void
  onUpdateTicket: (ticketId: string, updates: Partial<Ticket>) => void
  onAddMessage: (
    ticketId: string,
    message: { from: 'staff' | 'user'; author: string; body: string; visibility: 'public' | 'internal'; attachments: FileAttachment[] }
  ) => void
  onEscalate: (ticketId: string, toMember: string, toTeam: string, reason: string) => void
  onLinkToKanban?: (ticket: Ticket) => void
  allTickets?: Ticket[]
  onTicketsUpdated?: (tickets: Ticket[]) => void
  currentRole: StaffRole
  currentUsername: string
  staffList: StaffMember[]
  cannedReplies: CannedReply[]
}

export const TicketDetail: React.FC<TicketDetailProps> = ({
  ticket,
  onBack,
  onUpdateTicket,
  onAddMessage,
  onEscalate,
  onLinkToKanban,
  allTickets = [],
  onTicketsUpdated,
  currentRole,
  currentUsername,
  staffList,
  cannedReplies,
}) => {
  const { t } = useI18n()
  const [replyText, setReplyText] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [cannedModalOpen, setCannedModalOpen] = useState(false)
  const [escalateModalOpen, setEscalateModalOpen] = useState(false)
  const [linkMergeModalOpen, setLinkMergeModalOpen] = useState(false)
  const [escalateTeam, setEscalateTeam] = useState<Team>('Technical')
  const [escalateMember, setEscalateMember] = useState<string>('roman')
  const [escalateReason, setEscalateReason] = useState('')

  const isStaff = currentRole !== 'client' && currentRole !== 'viewer'

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() && attachments.length === 0) return

    onAddMessage(ticket.id, {
      from: isStaff ? 'staff' : 'user',
      author: currentUsername || 'Support Agent',
      body: replyText,
      visibility: isInternalNote ? 'internal' : 'public',
      attachments,
    })

    playChimeSound('message')
    toast.success(isInternalNote ? 'Internal Note Added' : 'Reply Sent to Customer')

    setReplyText('')
    setAttachments([])
    setIsInternalNote(false)
  }

  const handleConfirmEscalate = () => {
    if (!escalateReason.trim()) return
    onEscalate(ticket.id, escalateMember, escalateTeam, escalateReason)
    setEscalateModalOpen(false)
    setEscalateReason('')
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-16">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tickets</span>
        </button>

        <div className="flex items-center space-x-2">
          {onLinkToKanban && isStaff && (
            <button
              onClick={() => onLinkToKanban(ticket)}
              className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Link to Kanban Card</span>
            </button>
          )}

          {isStaff && (
            <button
              onClick={() => setLinkMergeModalOpen(true)}
              className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              <GitMerge className="w-3.5 h-3.5 text-indigo-600" />
              <span>Link / Merge</span>
            </button>
          )}

          {isStaff && (
            <button
              onClick={() => setEscalateModalOpen(true)}
              className="flex items-center space-x-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors cursor-pointer"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Escalate</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Agent Presence & Collision Avoidance Banner */}
      <AgentPresenceIndicator ticketId={ticket.id} currentUsername={currentUsername} />

      {/* Main Ticket Card Header */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {ticket.id}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {ticket.type}
              </span>
              {ticket.escalationLevel > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300">
                  Escalated (L{ticket.escalationLevel})
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1.5">{ticket.subject}</h1>
          </div>

          {/* Quick status & priority controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Select */}
            <select
              value={ticket.status}
              disabled={!isStaff}
              onChange={(e) => onUpdateTicket(ticket.id, { status: e.target.value as TicketStatus })}
              className="text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              <option value="open">Status: Open</option>
              <option value="in_progress">Status: In Progress</option>
              <option value="waiting_customer">Status: Waiting on Customer</option>
              <option value="resolved">Status: Resolved</option>
              <option value="closed">Status: Closed</option>
            </select>

            {/* Priority Select */}
            <select
              value={ticket.priority}
              disabled={!isStaff}
              onChange={(e) => onUpdateTicket(ticket.id, { priority: e.target.value as TicketPriority })}
              className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border focus:ring-2 focus:outline-none ${
                ticket.priority === 'urgent'
                  ? 'bg-rose-50 text-rose-800 border-rose-300 font-bold'
                  : ticket.priority === 'high'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-50 text-slate-800 border-slate-300'
              }`}
            >
              <option value="low">Priority: Low</option>
              <option value="medium">Priority: Medium</option>
              <option value="high">Priority: High</option>
              <option value="urgent">Priority: Urgent</option>
            </select>

            {/* Assignee Select */}
            {isStaff && (
              <select
                value={ticket.assignee || ''}
                onChange={(e) => onUpdateTicket(ticket.id, { assignee: e.target.value || null })}
                className="text-xs font-medium rounded-lg px-2.5 py-1.5 border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Unassigned</option>
                {staffList.map((s) => (
                  <option key={s.username} value={s.username}>
                    {s.displayName} ({s.team})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* SLA Timers Bar */}
        <SlaTimer sla={ticket.sla} status={ticket.status} />

        {/* Customer & Ticket Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50/70 p-3 rounded-lg border border-slate-100">
          <div>
            <span className="text-slate-400 block font-medium">Customer</span>
            <span className="font-semibold text-slate-800">{ticket.contact.fullName}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Email</span>
            <span className="font-mono text-slate-700">{ticket.contact.email}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Team Route</span>
            <span className="font-semibold text-slate-700">{ticket.team} Team</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Created</span>
            <span className="text-slate-700">{new Date(ticket.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Original Ticket Body & Reproduction steps */}
        <div className="space-y-3 pt-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Issue Description
            </h4>
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
              {ticket.body}
            </div>
          </div>

          {ticket.reproduction && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Steps to Reproduce / Technical Details
              </h4>
              <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-xs overflow-x-auto border border-slate-800">
                {ticket.reproduction}
              </div>
            </div>
          )}

          {/* Initial Ticket Attachments */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Ticket Attachments ({ticket.attachments.length})
              </h4>
              <AttachmentList attachments={ticket.attachments} readOnly />
            </div>
          )}
        </div>
      </div>

      {/* Linked Tickets Card */}
      {ticket.linkedTickets && ticket.linkedTickets.length > 0 && (
        <div className="bg-white rounded-xl shadow-xs border border-indigo-100 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Linked Tickets ({ticket.linkedTickets.length})</span>
            </h4>
            {isStaff && (
              <button
                onClick={() => setLinkMergeModalOpen(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                <span>Manage Links</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ticket.linkedTickets.map((link) => (
              <div
                key={link.targetTicketId}
                className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-indigo-700">#{link.targetTicketId}</span>
                    <span className="bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.2 rounded text-[10px] uppercase">
                      {link.relation.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-slate-700 font-medium truncate mt-0.5">{link.targetSubject}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Assistant & Copilot Panel (Staff only) */}
      {isStaff && (
        <TicketAIPanel
          ticket={ticket}
          onSelectSmartReply={(reply) => setReplyText((prev) => (prev ? `${prev}\n\n${reply}` : reply))}
          onUpdateTicket={onUpdateTicket}
        />
      )}

      {/* Live Billable Time Tracker (Staff only) */}
      {isStaff && (
        <TicketTimeTracker
          ticket={ticket}
          currentUsername={currentUsername}
          onTimeAdded={(newLogs) => onUpdateTicket(ticket.id, { timeLogs: newLogs })}
        />
      )}

      {/* Customer CSAT Feedback Widget (when ticket is resolved or closed) */}
      {(ticket.status === 'resolved' || ticket.status === 'closed') && (
        <CustomerCSATWidget
          ticket={ticket}
          onFeedbackSubmitted={(csat) => onUpdateTicket(ticket.id, { csat })}
        />
      )}

      {/* Escalation History Alert */}
      {ticket.escalations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-amber-800 font-semibold text-xs">
            <AlertOctagon className="w-4 h-4" />
            <span>Ticket Escalation Log</span>
          </div>
          {ticket.escalations.map((esc) => (
            <div key={esc.id} className="text-xs text-amber-900 bg-white/70 p-2 rounded border border-amber-100">
              <div className="font-medium">
                Escalated by <span className="font-semibold">{esc.from}</span> to{' '}
                <span className="font-semibold">{esc.toMember}</span> ({esc.toTeam} Team) at{' '}
                {new Date(esc.at).toLocaleTimeString()}
              </div>
              <div className="text-slate-600 mt-0.5">Reason: {esc.reason}</div>
            </div>
          ))}
        </div>
      )}

      {/* Message Thread */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2 px-1">
          <MessageSquare className="w-4 h-4" />
          <span>Thread & Activity ({ticket.messages.length})</span>
        </h3>

        {ticket.messages.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-slate-400 text-sm border border-slate-200">
            No replies yet. Use the reply composer below to reply to the customer.
          </div>
        ) : (
          ticket.messages.map((msg) => {
            const isInternal = msg.visibility === 'internal'
            const isStaffMsg = msg.from === 'staff'

            return (
              <div
                key={msg.id}
                className={`rounded-xl border p-4 shadow-xs space-y-2 transition-all ${
                  isInternal
                    ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                    : isStaffMsg
                    ? 'bg-indigo-50/50 border-indigo-200 text-slate-800'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs border-b pb-2 border-slate-200/60">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold flex items-center space-x-1">
                      {isStaffMsg ? <User className="w-3.5 h-3.5 text-indigo-600" /> : <Users className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>{msg.author}</span>
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        isStaffMsg ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isStaffMsg ? 'Staff Member' : 'Customer'}
                    </span>
                    {isInternal && (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                        <Lock className="w-2.5 h-2.5" />
                        <span>INTERNAL NOTE ONLY</span>
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-[11px]">{new Date(msg.at).toLocaleString()}</span>
                </div>

                {/* Message Body */}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</div>

                {/* Attached Files on Message */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <AttachmentList attachments={msg.attachments} readOnly />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Reply Composer Form */}
      <form onSubmit={handleSendMessage} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        {/* Toggle Public / Internal Note */}
        {isStaff && (
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsInternalNote(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  !isInternalNote
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Public Customer Reply
              </button>
              <button
                type="button"
                onClick={() => setIsInternalNote(true)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isInternalNote
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Internal Staff Note</span>
              </button>
            </div>

            {/* Canned Replies Quick Trigger */}
            <button
              type="button"
              onClick={() => setCannedModalOpen(true)}
              className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Canned Replies</span>
            </button>
          </div>
        )}

        {/* Rich Markdown Composer with formatting toolbar & live preview */}
        <MarkdownComposer
          value={replyText}
          onChange={setReplyText}
          placeholder={
            isInternalNote
              ? 'Write an internal note visible only to your staff team (supports Markdown, tables, quotes)...'
              : 'Write a public reply to the customer (supports Markdown, bold, lists, code)...'
          }
          className={isInternalNote ? 'border-amber-300' : 'border-slate-300'}
        />

        {/* Draft Attachments Preview */}
        {attachments.length > 0 && (
          <AttachmentList
            attachments={attachments}
            onDelete={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
          />
        )}

        {/* Bottom actions */}
        <div className="flex items-center justify-between pt-1">
          <AttachmentUploader
            onFilesAdded={(newAtts) => setAttachments((prev) => [...prev, ...newAtts])}
          />

          <button
            type="submit"
            className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-transform active:scale-95 cursor-pointer ${
              isInternalNote ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>{isInternalNote ? 'Post Internal Note' : 'Send Public Reply'}</span>
          </button>
        </div>
      </form>

      {/* Canned Replies Modal */}
      <CannedRepliesModal
        isOpen={cannedModalOpen}
        onClose={() => setCannedModalOpen(false)}
        cannedReplies={cannedReplies}
        ticket={ticket}
        currentAgent={currentUsername}
        onSelectReply={(text) => setReplyText((prev) => (prev ? `${prev}\n\n${text}` : text))}
      />

      {/* Escalation Dialog */}
      {escalateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <AlertOctagon className="w-5 h-5 text-amber-600" />
              <span>Escalate Ticket {ticket.id}</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Target Team</label>
                <select
                  value={escalateTeam}
                  onChange={(e) => setEscalateTeam(e.target.value as Team)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="Technical">Technical Team</option>
                  <option value="Security">Security Team</option>
                  <option value="Billing">Billing Team</option>
                  <option value="Support">Support Team</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Target Specialist</label>
                <select
                  value={escalateMember}
                  onChange={(e) => setEscalateMember(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  {staffList.map((s) => (
                    <option key={s.username} value={s.username}>
                      {s.displayName} ({s.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Reason for Escalation</label>
                <textarea
                  rows={3}
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="Provide context on why this ticket requires higher-tier intervention..."
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEscalateModalOpen(false)}
                className="px-3 py-1.5 rounded-md border text-slate-700 text-xs font-medium hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEscalate}
                className="px-4 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              >
                Confirm Escalation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Linking & Merging Modal */}
      <TicketLinkMergeModal
        isOpen={linkMergeModalOpen}
        onClose={() => setLinkMergeModalOpen(false)}
        currentTicket={ticket}
        allTickets={allTickets}
        onTicketsUpdated={(updated) => {
          onTicketsUpdated?.(updated)
          // Find updated current ticket
          const refreshed = updated.find((t) => t.id === ticket.id)
          if (refreshed) {
            onUpdateTicket(ticket.id, refreshed)
          }
        }}
      />
    </div>
  )
}
