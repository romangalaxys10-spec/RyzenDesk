/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Bootstraps the GitHub sync (pull remote DB) and starts the Telegram poller.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const g = globalThis as unknown as { __hdBooted?: boolean | Promise<void> }
  if (g.__hdBooted) return
  g.__hdBooted = (async () => {
    try {
      const { bootstrapFromRemote } = await import('@/lib/helpdesk/db')
      await bootstrapFromRemote()
      const { startPoller } = await import('@/lib/helpdesk/telegram')
      await startPoller()
      console.log('[helpdesk] bootstrap complete')
    } catch (err) {
      console.error('[helpdesk] bootstrap failed:', err instanceof Error ? err.message : err)
    }
  })()
  await g.__hdBooted
}
