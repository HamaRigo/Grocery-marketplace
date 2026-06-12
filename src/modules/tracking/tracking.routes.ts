import { FastifyPluginAsync } from 'fastify'
import { WebSocket } from 'ws'
import { redis } from '../../platform/redis'
import { on, Events } from '../../platform/events'

const sessions = new Map<string, Set<WebSocket>>()

export const trackingRoutes: FastifyPluginAsync = async (app) => {
  // Rider: push GPS ping
  app.post('/ping', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { orderId, lat, lng } = req.body as any
    const location = JSON.stringify({ lat, lng, at: Date.now() })
    await redis.setex(`loc:${orderId}`, 3600, location)

    const subs = sessions.get(orderId)
    if (subs) {
      const msg = JSON.stringify({ type: 'location', lat, lng })
      for (const ws of subs) if (ws.readyState === WebSocket.OPEN) ws.send(msg)
    }
    return reply.send({ ok: true })
  })

  // Customer: subscribe to live location
  app.get('/ws/:orderId', { websocket: true }, async (socket, req) => {
    const { orderId } = req.params as any

    if (!sessions.has(orderId)) sessions.set(orderId, new Set())
    sessions.get(orderId)!.add(socket as unknown as WebSocket)

    const cached = await redis.get(`loc:${orderId}`)
    if (cached) (socket as any).send(JSON.stringify({ type: 'location', ...JSON.parse(cached) }))

    socket.on('close', () => {
      const set = sessions.get(orderId)
      if (set) { set.delete(socket as unknown as WebSocket); if (!set.size) sessions.delete(orderId) }
    })
  })
}

// Auto-close session on delivery
on<{ orderId: string }>(Events.OrderDelivered, ({ payload }) => sessions.delete(payload.orderId))
