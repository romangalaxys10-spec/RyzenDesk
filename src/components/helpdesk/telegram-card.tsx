'use client'

import { Badge } from '@/components/ui/badge'
import { Send, BellRing } from 'lucide-react'

export function TelegramCard({
  botUsername,
  command,
  title,
  description,
}: {
  botUsername: string | null
  command: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
      <div className="mb-2 flex items-center gap-2">
        <Send className="h-4 w-4 text-sky-400" />
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        {botUsername ? (
          <Badge variant="outline" className="ml-auto border-sky-500/30 bg-sky-500/10 text-[10px] text-sky-300">
            <BellRing className="mr-1 h-3 w-3" /> @{botUsername}
          </Badge>
        ) : (
          <Badge variant="outline" className="ml-auto border-zinc-700 bg-zinc-900 text-[10px] text-zinc-500">connecting…</Badge>
        )}
      </div>
      <p className="text-sm text-zinc-400">{description}</p>
      <code className="mt-3 block overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-sky-300">
        {command}
      </code>
      {botUsername && (
        <p className="mt-2 text-xs text-zinc-500">
          Open{' '}
          <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="text-sky-400 underline-offset-2 hover:underline">
            t.me/{botUsername}
          </a>{' '}
          and send the command above.
        </p>
      )}
    </div>
  )
}
