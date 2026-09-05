import React, { useState } from 'react'
import { Star, MessageSquareHeart, CheckCircle2 } from 'lucide-react'
import type { Ticket, TicketCSAT } from '../../types'
import { toast } from '../common/ToastContainer'

interface CustomerCSATWidgetProps {
  ticket: Ticket
  onCsatSubmitted: (csat: TicketCSAT) => void
}

export const CustomerCSATWidget: React.FC<CustomerCSATWidgetProps> = ({ ticket, onCsatSubmitted }) => {
  const [rating, setRating] = useState<number>(ticket.csat?.rating || 5)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string>(ticket.csat?.feedback || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(Boolean(ticket.csat))

  // Only active when ticket is resolved or closed
  if (ticket.status !== 'resolved' && ticket.status !== 'closed' && !ticket.csat) {
    return null
  }

  const ratingLabels = ['', 'Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Extremely Satisfied!']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/csat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, feedback }),
      })
      const data = await res.json()
      if (res.ok && data.csat) {
        onCsatSubmitted(data.csat)
        setIsDone(true)
        toast.success('Thank you!', 'Your feedback helps us continuously improve our service')
      } else {
        toast.error('Submission Failed', data.error)
      }
    } catch (err: any) {
      toast.error('Network Error', err?.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isDone) {
    return (
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-full bg-emerald-600 text-white">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold">Customer Satisfaction Rating Submitted</div>
            <div className="text-[11px] text-emerald-700 flex items-center space-x-1 mt-0.5">
              <span>Rating:</span>
              <div className="flex text-amber-500">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3 h-3 ${s <= (ticket.csat?.rating || rating) ? 'fill-current' : 'text-slate-300'}`}
                  />
                ))}
              </div>
              {ticket.csat?.feedback && <span className="text-slate-600 italic ml-1">"{ticket.csat.feedback}"</span>}
            </div>
          </div>
        </div>
        <span className="text-[10px] text-emerald-700 font-semibold bg-white/80 px-2 py-0.5 rounded border border-emerald-200">
          Feedback Recorded
        </span>
      </div>
    )
  }

  const activeStar = hoverRating || rating

  return (
    <form onSubmit={handleSubmit} className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2.5 text-xs shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquareHeart className="w-4 h-4 text-amber-600" />
          <h4 className="font-bold text-slate-800">How was your support experience?</h4>
        </div>
        <span className="text-[11px] font-semibold text-amber-800">{ratingLabels[activeStar]}</span>
      </div>

      <p className="text-[11px] text-slate-600">
        This ticket has been marked resolved. We'd love to know how well our engineering team assisted you.
      </p>

      {/* Stars */}
      <div className="flex items-center space-x-1.5 py-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
            onClick={() => setRating(star)}
            className="p-1 rounded hover:bg-amber-100/80 transition-transform active:scale-95"
          >
            <Star
              className={`w-5 h-5 transition-colors ${
                star <= activeStar ? 'text-amber-500 fill-current' : 'text-slate-300'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Optional feedback text */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Any additional feedback or compliments for the team? (optional)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-hidden focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </div>
    </form>
  )
}
