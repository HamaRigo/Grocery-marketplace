/**
 * Standalone Tracking Service
 * Owns: GPS ping ingestion, WebSocket fan-out, session lifecycle.
 * Listens for OrderDelivered via Redis Streams to auto-close sessions.
 */
import 'dotenv/config'
import Fastify from 'fastify'
import fws from '@fastify/websocket'
import { WebSocket } from 'ws'
import { redis } from '../../platform/redis'
import { ensureConsumerGroup, readBatch, ack } from '../../platform/broker'

const sessions  = new Map<string, Set<WebSocket>>()
const GROUP     = 'tracking-svc'
const CONSUMER  = `tracking-${process.pid}`

// ── Event consumer loop ──────────────────────────────────────────────────────

async function startConsumer() {
  await ensureConsumerGroup(GROUP)
  while (true) {
    const batch = await readBatch(GROUP, CONSUMER)
    for (const msg of batch) {
      if (msg.type === 'OrderDelivered') {
        const { orderId } = (msg.data as any).payload ?? {}
        if (orderId) sessions.delete(orderId)
      }
      await ack(GROUP, msg.id)
    }
  }
}

// ── HTTP + WebSocket server ──────────────────────────────────────────────────

async function main() {
  const app = Fastify({ logger: { level: 'info' } })
  await app.register(fws)

  // Rider: push GPS ping
  app.post('/ping', async (req, reply) => {
    const { orderId, lat, lng } = req.body as any
    await redis.setex(`loc:${orderId}`, 3600, JSON.stringify({ lat, lng, at: Date.now() }))
    const subs = sessions.get(orderId)
    if (subs) {
      const msg = JSON.stringify({ type: 'location', lat, lng })
      for (const ws of subs) if (ws.readyState === WebSocket.OPEN) ws.send(msg)
    }
    return reply.send({ ok: true })
  })

  // Customer: subscribe
  app.get('/ws/:orderId', { websocket: true }, async (socket, req) => {
    const { orderId } = req.params as any
    if (!sessions.has(orderId)) sessions.set(orderId, new Set())
    sessions.get(orderId)!.add(socket as unknown as WebSocket)

    const cached = await redis.get(`loc:${orderId}`)
    if (cached) (socket as any).send(JSON.stringify({ type: 'location', ...JSON.parse(cached) }))

    socket.on('close', () => {
      const s = sessions.get(orderId)
      if (s) { s.delete(socket as unknown as WebSocket); if (!s.size) sessions.delete(orderId) }
    })
  })

  app.get('/health', async () => ({ ok: true, sessions: sessions.size }))

  startConsumer().catch(console.error)

  const port = parseInt(process.env.TRACKING_PORT ?? '3001', 10)
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`[TrackingSvc] :${port}`)
}

main().catch(err => { console.error(err); process.exit(1) })
