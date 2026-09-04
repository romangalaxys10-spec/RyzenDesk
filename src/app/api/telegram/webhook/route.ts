import { NextResponse } from 'next/server'
import { handleWebhookUpdate, getBotInfo } from '@/lib/helpdesk/telegram'

export const dynamic = 'force-dynamic'

/** Telegram outgoing webhook (optional alternative to polling). */
export async function POST(req: Request) {
  const update = await req.json().catch(() => null)
  if (!update) return NextResponse.json({ ok: false }, { status: 400 })
  await handleWebhookUpdate(update)
  return NextResponse.json({ ok: true })
}

/** Bot status: username, mode, linked chat counts. */
export async function GET() {
  const info = await getBotInfo()
  return NextResponse.json(info)
}
