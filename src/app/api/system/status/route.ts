import { NextResponse } from 'next/server'
import { status as syncStatus } from '@/lib/helpdesk/github'
import { getBotInfo } from '@/lib/helpdesk/telegram'

export const dynamic = 'force-dynamic'

/** Live system status: GitHub sync engine + Telegram bot. Used by the staff panel. */
export async function GET() {
  const [sync, bot] = await Promise.all([Promise.resolve(syncStatus()), getBotInfo()])
  return NextResponse.json({ sync, bot })
}
