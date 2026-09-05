import crypto from 'crypto'
import { getDb, saveDb, logAudit } from './db'
import type { WebhookDelivery } from '../src/types'

export async function triggerWebhooks(event: string, payloadData: Record<string, unknown>): Promise<void> {
  const db = getDb()
  const activeWebhooks = db.webhooks.filter((wh) => wh.active && wh.events.includes(event))

  if (!activeWebhooks.length) return

  const payloadString = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payloadData,
  })

  for (const wh of activeWebhooks) {
    const startTime = Date.now()
    let statusCode = 200
    let success = true
    let responseSummary = 'Simulated delivery success (200 OK)'

    const hmac = crypto.createHmac('sha256', wh.secret || 'default_secret')
    hmac.update(payloadString)
    const signature = `sha256=${hmac.digest('hex')}`

    try {
      if (wh.targetUrl.startsWith('http://') || wh.targetUrl.startsWith('https://')) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000)

        const res = await fetch(wh.targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'RyzenDesk-Webhook-Agent/2.0',
            'X-RyzenDesk-Event': event,
            'X-RyzenDesk-Signature': signature,
            'X-RyzenDesk-Timestamp': String(Date.now()),
          },
          body: payloadString,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        statusCode = res.status
        success = res.ok
        const bodyText = await res.text().catch(() => '')
        responseSummary = `${res.status} ${res.statusText} ${bodyText.slice(0, 100)}`
      }
    } catch (err) {
      statusCode = 504
      success = false
      responseSummary = err instanceof Error ? err.message : String(err)
    }

    const durationMs = Date.now() - startTime
    wh.lastFiredAt = new Date().toISOString()

    const delivery: WebhookDelivery = {
      id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      webhookId: wh.id,
      webhookName: wh.name,
      event,
      payload: payloadString,
      statusCode,
      success,
      responseSummary,
      durationMs,
      at: new Date().toISOString(),
    }

    db.webhookDeliveries.unshift(delivery)
    if (db.webhookDeliveries.length > 200) db.webhookDeliveries.pop()
  }

  saveDb(db)
  logAudit(
    'system_webhook',
    'system',
    'WEBHOOK_EVENT_TRIGGERED',
    'webhooks',
    `Triggered event "${event}" to ${activeWebhooks.length} webhook subscriber(s).`
  )
}

export async function testWebhookEndpoint(webhookId: string): Promise<WebhookDelivery> {
  const db = getDb()
  const wh = db.webhooks.find((w) => w.id === webhookId)
  if (!wh) throw new Error('Webhook not found')

  const testPayload = JSON.stringify({
    event: 'test.ping',
    timestamp: new Date().toISOString(),
    message: 'RyzenDesk Webhook Test Ping',
    webhook: {
      id: wh.id,
      name: wh.name,
    },
  })

  const hmac = crypto.createHmac('sha256', wh.secret || 'test_secret')
  hmac.update(testPayload)
  const signature = `sha256=${hmac.digest('hex')}`

  const startTime = Date.now()
  let statusCode = 200
  let success = true
  let responseSummary = 'Test ping delivered successfully'

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(wh.targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RyzenDesk-Webhook-Agent/2.0',
        'X-RyzenDesk-Event': 'test.ping',
        'X-RyzenDesk-Signature': signature,
        'X-RyzenDesk-Timestamp': String(Date.now()),
      },
      body: testPayload,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    statusCode = res.status
    success = res.ok
    const text = await res.text().catch(() => '')
    responseSummary = `${res.status} ${res.statusText} ${text.slice(0, 100)}`
  } catch (err) {
    statusCode = 504
    success = false
    responseSummary = err instanceof Error ? err.message : String(err)
  }

  const durationMs = Date.now() - startTime
  wh.lastFiredAt = new Date().toISOString()

  const delivery: WebhookDelivery = {
    id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    webhookId: wh.id,
    webhookName: wh.name,
    event: 'test.ping',
    payload: testPayload,
    statusCode,
    success,
    responseSummary,
    durationMs,
    at: new Date().toISOString(),
  }

  db.webhookDeliveries.unshift(delivery)
  saveDb(db)
  return delivery
}
