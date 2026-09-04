'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, KeyRound, ShieldCheck, Sparkles } from 'lucide-react'

/**
 * Forced first-login setup: members flagged mustChangePassword (the pre-created
 * bootstrap super admin, freshly created staff, or password resets) must choose
 * a new password before they can use the console.
 */
export function SetupWizard({
  username,
  token,
  onDone,
}: {
  username: string
  token: string
  onDone: (profile: { mustChangePassword: false }) => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: password }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error || 'Could not set the password. Please try again.')
        return
      }
      onDone({ mustChangePassword: false })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'bg-zinc-900/60 border-zinc-800 focus-visible:ring-zinc-500 text-zinc-100'

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
        <div className="mb-1 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-400">
          <Sparkles className="h-3.5 w-3.5" /> Initial setup
        </div>
        <h2 className="text-center text-xl font-semibold text-zinc-100">Welcome to RyzenDesk, {username}</h2>
        <p className="mt-1 text-center text-sm text-zinc-400">
          Set your own password to secure this account and finish the setup.
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setup-password" className="text-zinc-300">New password</Label>
            <Input
              id="setup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-confirm" className="text-zinc-300">Confirm new password</Label>
            <Input
              id="setup-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat the password"
              className={inputCls}
              autoComplete="new-password"
              onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
            />
          </div>
          <Button onClick={() => void submit()} disabled={busy} className="min-h-11 w-full bg-zinc-100 text-zinc-900 hover:bg-white">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Complete setup &amp; continue
          </Button>
          <p className="flex items-start gap-1.5 text-xs text-zinc-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            You will use this password for all future staff sign-ins. Until setup is complete, this account cannot
            manage tickets, chats or settings.
          </p>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      </div>
    </div>
  )
}
