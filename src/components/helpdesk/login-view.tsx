'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Fingerprint, KeyRound, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LoginSuccess {
  session: string
  role: 'user' | 'staff'
  profile: Record<string, unknown> & { zaiId?: string; username?: string; fullName?: string; displayName?: string }
}

export function LoginView({ onSuccess, onBack }: { onSuccess: (r: LoginSuccess) => void; onBack: () => void }) {
  const [zaiId, setZaiId] = useState('')
  const [token, setToken] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'user' | 'staff' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function doLogin(mode: 'user' | 'staff') {
    setError(null)
    setBusy(mode)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'user' ? { mode, zaiId, token } : { mode, username, password }),
      })
      const data = (await res.json()) as (LoginSuccess & { error?: string })
      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }
      onSuccess(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const inputCls = 'bg-zinc-900/60 border-zinc-800 focus-visible:ring-zinc-500 text-zinc-100'

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
        <h2 className="text-center text-xl font-semibold text-zinc-100">Sign in to RyzenDesk</h2>
        <p className="mt-1 text-center text-sm text-zinc-400">Track tickets, reply to staff, or open new requests.</p>

        <Tabs defaultValue="user" className="mt-6">
          <TabsList className="grid h-auto w-full grid-cols-2 border border-zinc-800 bg-zinc-950 p-1">
            <TabsTrigger
              value="user"
              className="min-h-9 border-transparent bg-transparent text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
            >
              <UserRound className="mr-1.5 h-4 w-4" /> Client
            </TabsTrigger>
            <TabsTrigger
              value="staff"
              className="min-h-9 border-transparent bg-transparent text-zinc-400 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
            >
              <UsersRound className="mr-1.5 h-4 w-4" /> Staff
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user" className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-zaiId" className="text-zinc-300">User ID</Label>
              <Input id="login-zaiId" value={zaiId} onChange={(e) => setZaiId(e.target.value)} placeholder="Your user ID" className={inputCls} autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-token" className="text-zinc-300">Secret Access Token</Label>
              <Input id="login-token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="zt_…" className={cn(inputCls, 'font-mono')} autoComplete="current-password" />
              <p className="text-xs text-zinc-500">The zt_… token you received when you created your first ticket.</p>
            </div>
            <Button onClick={() => doLogin('user')} disabled={busy !== null} className="min-h-11 w-full bg-zinc-100 text-zinc-900 hover:bg-white">
              {busy === 'user' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />}
              Sign in as Client
            </Button>
          </TabsContent>

          <TabsContent value="staff" className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-username" className="text-zinc-300">Staff Username</Label>
              <Input id="login-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your staff username" className={inputCls} autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-zinc-300">Password</Label>
              <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} autoComplete="current-password" />
            </div>
            <Button onClick={() => doLogin('staff')} disabled={busy !== null} className="min-h-11 w-full bg-zinc-100 text-zinc-900 hover:bg-white">
              {busy === 'staff' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Sign in as Staff
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
              <KeyRound className="h-3 w-3" /> Staff access · passwords are issued by your administrator
            </p>
          </TabsContent>
        </Tabs>

        {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      </div>

      <div className="mt-4 text-center">
        <Button variant="ghost" onClick={onBack} className="text-zinc-400 hover:text-zinc-200">
          ← Back to RyzenDesk
        </Button>
      </div>
    </div>
  )
}
