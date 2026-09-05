import React, { useEffect, useRef, useState } from 'react'
import { X, Send, CheckCircle2, Copy, Check, LifeBuoy } from 'lucide-react'
import type { IssueType, TicketPriority, Team, FileAttachment, Ticket, WikiPage } from '../../types'
import { AttachmentList, AttachmentUploader } from './AttachmentViewer'
import { useI18n } from '../../i18n/translations'
import { SelfServiceKnowledgeDeflection } from './SelfServiceKnowledgeDeflection'

interface TicketSubmitModalProps {
  isOpen: boolean
  onClose: () => void
  wikiPages?: WikiPage[]
  onSelectWikiPage?: (page: WikiPage) => void
  onSubmitTicket: (payload: {
    contact: { fullName: string; email: string; discordId?: string }
    subject: string
    type: IssueType
    priority: TicketPriority
    team: Team
    body: string
    reproduction?: string
    attachments: FileAttachment[]
  }) => Promise<{ ticket: Ticket; secretToken: string }>
  onViewTicket: (ticket: Ticket) => void
}

export const TicketSubmitModal: React.FC<TicketSubmitModalProps> = ({
  isOpen,
  onClose,
  wikiPages = [],
  onSelectWikiPage,
  onSubmitTicket,
  onViewTicket,
}) => {
  const { t } = useI18n()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [discordId, setDiscordId] = useState('')
  const [subject, setSubject] = useState('')
  const [type, setType] = useState<IssueType>('Technical')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [team, setTeam] = useState<Team>('Technical')
  const [body, setBody] = useState('')
  const [reproduction, setReproduction] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [createdResult, setCreatedResult] = useState<{ ticket: Ticket; secretToken: string } | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)

  // Auto-QA fetcher: as the customer describes the issue, ask the server to
  // match public FAQ/Wiki articles (debounced so we don't hammer the API).
  type Suggestion = { id: string; source: 'wiki'; title: string; snippet: string }
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [aiTip, setAiTip] = useState<string | null>(null)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestQuery = `${subject} ${body}`.trim()

  useEffect(() => {
    if (!isOpen) return
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (suggestQuery.length < 8) {
      setSuggestions([])
      setAiTip(null)
      return
    }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: suggestQuery }),
        })
        if (res.ok) {
          const data = await res.json()
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
          setAiTip(typeof data.aiTip === 'string' ? data.aiTip : null)
        }
      } catch {
        /* suggestions are best-effort; ignore network errors */
      }
    }, 700)
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current)
    }
  }, [suggestQuery, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName || !email || !subject || !body) return

    setSubmitting(true)
    try {
      const res = await onSubmitTicket({
        contact: { fullName, email, discordId: discordId || undefined },
        subject,
        type,
        priority,
        team,
        body,
        reproduction: reproduction || undefined,
        attachments,
      })
      setCreatedResult(res)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyToken = () => {
    if (createdResult) {
      navigator.clipboard.writeText(createdResult.secretToken)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <LifeBuoy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('tickets.createTitle')}</h2>
              <p className="text-xs text-slate-500">Enterprise support request submission</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Confirmation View */}
        {createdResult ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">Support Request Registered!</h3>
              <p className="text-sm text-slate-500">
                Ticket ID <span className="font-mono font-bold text-sky-600">{createdResult.ticket.id}</span> has been dispatched to our engineering team.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2 max-w-md mx-auto">
              <div className="text-xs font-semibold text-slate-500 uppercase">Customer Access Token</div>
              <div className="flex items-center justify-between bg-white p-2 rounded border font-mono text-xs text-slate-800">
                <span>{createdResult.secretToken}</span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="flex items-center space-x-1 text-sky-600 hover:text-sky-700 font-sans font-medium text-xs ml-2 cursor-pointer"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Save this token to check ticket progress or reply from the customer portal without an account.
              </p>
            </div>

            <div className="flex justify-center space-x-3 pt-2">
              <button
                onClick={() => {
                  onViewTicket(createdResult.ticket)
                  onClose()
                }}
                className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm shadow-sm cursor-pointer"
              >
                View Ticket Details
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Form Content */
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
            {/* Contact Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Mercer"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alex@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={type}
                  onChange={(e) => {
                    const newType = e.target.value as IssueType
                    setType(newType)
                    if (newType === 'Billing') setTeam('Billing')
                    else if (newType === 'Security' || newType === 'Abuse') setTeam('Security')
                    else setTeam('Technical')
                  }}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Technical">Technical</option>
                  <option value="Billing">Billing</option>
                  <option value="Security">Security</option>
                  <option value="Abuse">Abuse / Compliance</option>
                  <option value="Service">Service Request</option>
                  <option value="Pre-sale">Pre-sale</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-medium"
                >
                  <option value="low">Low (Standard SLA)</option>
                  <option value="medium">Medium (Standard SLA)</option>
                  <option value="high">High (Accelerated SLA)</option>
                  <option value="urgent">Urgent (Immediate SLA)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Team Route</label>
                <select
                  value={team}
                  onChange={(e) => setTeam(e.target.value as Team)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Technical">Technical Team</option>
                  <option value="Support">General Support</option>
                  <option value="Billing">Billing & Accounts</option>
                  <option value="Security">Security Operations</option>
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Subject <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Brief summary of the issue or inquiry..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            {/* Self-service Knowledge Deflection Suggestions (server-matched) */}
            <SelfServiceKnowledgeDeflection
              query={`${subject} ${body}`}
              wikiPages={wikiPages}
              serverSuggestions={suggestions}
              aiTip={aiTip}
              onSelectPage={(page) => {
                onClose()
                onSelectWikiPage?.(page)
              }}
            />

            {/* Body */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Description of the Issue <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                placeholder="Describe in detail what you are experiencing..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            {/* Reproduction steps */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Steps to Reproduce or Log Output (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Paste command line output, stack traces, or error codes..."
                value={reproduction}
                onChange={(e) => setReproduction(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-[11px]"
              />
            </div>

            {/* File attachments */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Attachments (Screenshots, Logs, Documents)
              </label>
              <AttachmentUploader
                onFilesAdded={(newAtts) => setAttachments((prev) => [...prev, ...newAtts])}
              />
              {attachments.length > 0 && (
                <AttachmentList
                  attachments={attachments}
                  onDelete={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
                />
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center space-x-2 px-6 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-sm transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Submitting...' : 'Submit Ticket'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
