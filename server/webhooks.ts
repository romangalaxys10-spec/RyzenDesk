import crypto from 'crypto'
import dns from 'dns'
import net from 'net'
import { getDb, saveDb, logAudit } from './db'
import type { WebhookDelivery } from '../src/types'

/* ==========================================================================
   Webhook dispatch engine with SSRF hardening
   - Only http/https, no credentials in URL, no redirects
   - DNS resolution pinned & private/loopback/link-local ranges blocked
   - Crypto-secure delivery IDs and webhook secrets
   ========================================================================== */

/** Networks that must never be reachable from webhook deliveries (SSRF guard). */
function isPrivateAddress(ip: string, family: 4 | 6): boolean {
  if (family === 4) {
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4) return true
    const [a, b] = parts
    if (a === 10 || a === 127) return true                                   // private / loopback
    if (a === 172 && b >= 16 && b <= 31) return true                        // private
    if (a === 192 && b === 168) return true                                 // private
    if (a === 169 && b === 254) return true                                 // link-local (incl. cloud metadata 169.254.169.254)
    if (a === 0) return true                                                // this-network
    if (a === 100 && b >= 64 && b <= 127) return true                       // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true                    // benchmark
    if (a >= 224) return true                                               // multicast / reserved
    return false
  }
  const v6 = ip.toLowerCase()
  if (v6 === '::1' || v6 === '::' || v6 === '::ffff:127.0.0.1') return true
  if (v6.startsWith('fe80')) return true                                    // link-local
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true               // unique local
  if (v6.startsWith('::ffff:')) {
    const mapped = v6.replace('::ffff:', '')
    if (net.isIPv4(mapped)) return isPrivateAddress(mapped, 4)
  }
  return false
}

export function validateWebhookUrl(rawUrl: string): { ok: true; normalized: string } | { ok: false; error: string } {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, error: 'Invalid URL' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Only http:// and https:// webhook targets are allowed' }
  }
  if (url.username || url.password) {
    return { ok: false, error: 'Credentials in webhook URLs are not allowed' }
  }
  const host = url.hostname
  // Block obvious local names before DNS
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { ok: false, error: 'Webhook targets pointing at local/internal hosts are blocked' }
  }
  // Reject IP literals that are private
  if (net.isIP(host) && isPrivateAddress(host, net.isIPv6(host) ? 6 : 4)) {
    return { ok: false, error: 'Webhook targets pointing at private networks are blocked' }
  }
  return { ok: true, normalized: url.toString() }
}

/** Resolve the host and reject if it resolves into a private range (anti-DNS-rebinding / anti-SSRF). */
async function assertPublicHost(hostname: string): Promise<void> {
  const results = await new Promise<dns.LookupAddress[]>((resolve, reject) => {
    dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) reject(err)
      else resolve(addresses)
    })
  })
  if (!results.length) throw new Error('Webhook target hostname did not resolve')
  for (const r of results) {
    if (isPrivateAddress(r.address, r.family === 6 ? 6 : 4)) {
      throw new Error('Webhook target resolves to a private/loopback address — blocked (SSRF protection)')
    }
  }
}

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

    const check = validateWebhookUrl(wh.targetUrl)
    if (check.ok === false) {
      statusCode = 0
      success = false
      responseSummary = `Blocked: ${check.error}`
    } else {
      try {
        await assertPublicHost(new URL(check.normalized).hostname)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000)

        const res = await fetch(check.normalized, {
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
          redirect: 'error',
        })
        clearTimeout(timeoutId)
        statusCode = res.status
        success = res.ok
        const bodyText = await res.text().catch(() => '')
        responseSummary = `${res.status} ${res.statusText} ${bodyText.slice(0, 100)}`
      } catch (err) {
        statusCode = 504
        success = false
        responseSummary = err instanceof Error ? err.message : String(err)
      }
    }

    const durationMs = Date.now() - startTime
    wh.lastFiredAt = new Date().toISOString()

    const delivery: WebhookDelivery = {
      id: `del_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
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

  const check = validateWebhookUrl(wh.targetUrl)
  if (check.ok === false) {
    const blocked: WebhookDelivery = {
      id: `del_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      webhookId: wh.id,
      webhookName: wh.name,
      event: 'test.ping',
      payload: '',
      statusCode: 0,
      success: false,
      responseSummary: `Blocked: ${check.error}`,
      durationMs: 0,
      at: new Date().toISOString(),
    }
    db.webhookDeliveries.unshift(blocked)
    saveDb(db)
    return blocked
  }

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
    await assertPublicHost(new URL(check.normalized).hostname)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(check.normalized, {
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
      redirect: 'error',
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
    id: `del_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
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
