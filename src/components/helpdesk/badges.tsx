'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, PRIORITY_LABELS, type TicketStatus, type TicketPriority, type IssueType } from '@/lib/helpdesk/types'
import { CreditCard, Headphones, Wrench, MessageCircleQuestion, ShieldAlert, ShieldCheck, Ticket as TicketIcon } from 'lucide-react'

export const statusStyle: Record<TicketStatus, string> = {
  open: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  waiting_customer: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  resolved: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  closed: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

export const priorityStyle: Record<TicketPriority, string> = {
  urgent: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge variant="outline" className={cn('rounded-full font-medium', statusStyle[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge variant="outline" className={cn('rounded-full font-medium', priorityStyle[priority])}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}

export const typeIcons: Record<IssueType, typeof TicketIcon> = {
  Billing: CreditCard,
  Service: Headphones,
  Technical: Wrench,
  'Pre-sale': MessageCircleQuestion,
  Abuse: ShieldAlert,
  Security: ShieldCheck,
}

export function TypeBadge({ type }: { type: IssueType }) {
  const Icon = typeIcons[type] || TicketIcon
  return (
    <Badge variant="outline" className="rounded-full border-zinc-700 bg-zinc-800/60 font-medium text-zinc-300">
      <Icon className="mr-1 h-3 w-3" />
      {type}
    </Badge>
  )
}
