import { FastifyPluginAsync } from 'fastify'
import { FulfillmentService } from './fulfillment.service'
import { authenticated } from '../../platform/rbac'

export const fulfillmentRoutes: FastifyPluginAsync = async (app) => {
  // Current rider record for the logged-in user
  app.get('/me', { onRequest: [authenticated] }, async (req, reply) => {
    const session = (req as any).sessionUser
    const rider = await FulfillmentService.getRiderByUserId(session.userId)
    if (!rider) return reply.code(404).send({ error: 'No rider record for this account' })
    return rider
  })

  // Riders management (Manager / Admin)
  app.get('/riders', { onRequest: [app.authenticate] }, async (req) => {
    const { tenantId } = req.query as any
    return FulfillmentService.listRiders(tenantId)
  })

  app.post('/riders', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId, tenantId, vehicle } = req.body as any
    const rider = await FulfillmentService.addRider(userId, tenantId ?? null, vehicle)
    return reply.code(201).send(rider)
  })

  // Rider: my jobs
  app.get('/jobs', { onRequest: [app.authenticate] }, async (req) => {
    const { riderId } = req.query as any
    return FulfillmentService.listJobs(riderId)
  })

  // Rider: confirm pickup
  app.post('/jobs/:id/pickup', { onRequest: [app.authenticate] }, async (req, reply) => {
    await FulfillmentService.confirmPickup((req.params as any).id)
    return reply.send({ ok: true })
  })

  // Rider: confirm delivery
  app.post('/jobs/:id/deliver', { onRequest: [app.authenticate] }, async (req, reply) => {
    await FulfillmentService.confirmDelivery((req.params as any).id)
    return reply.send({ ok: true })
  })

  // Rider: set availability
  app.put('/availability', { onRequest: [app.authenticate] }, async (req) => {
    const { riderId, status } = req.body as any
    return FulfillmentService.setAvailability(riderId, status)
  })
}
