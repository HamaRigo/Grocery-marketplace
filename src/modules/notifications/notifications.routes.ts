import { FastifyPluginAsync } from 'fastify'
import { authenticated } from '../../platform/rbac'
import { getNotifications, markAllRead } from './notifications.service'

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { onRequest: [authenticated] }, async (req) => {
    const user = (req as any).sessionUser
    return getNotifications(user.userId)
  })

  app.post('/read', { onRequest: [authenticated] }, async (req, reply) => {
    const user = (req as any).sessionUser
    await markAllRead(user.userId)
    return reply.send({ ok: true })
  })
}
