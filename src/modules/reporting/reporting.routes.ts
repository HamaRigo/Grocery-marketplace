import { FastifyPluginAsync } from 'fastify'
import { ReportingService } from './reporting.service'

export const reportingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/overview', { onRequest: [app.authenticate] }, async () =>
    ReportingService.overview()
  )

  app.get('/stores', { onRequest: [app.authenticate] }, async () =>
    ReportingService.storeBreakdown()
  )

  app.get('/stores/:id/ratings', { onRequest: [app.authenticate] }, async (req) =>
    ReportingService.storeRatings((req.params as any).id)
  )

  app.get('/revenue', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { from, to } = req.query as any
    if (!from || !to) return reply.code(400).send({ error: 'from and to are required (ISO dates)' })
    return ReportingService.revenueOverTime(from, to)
  })

  // GET /reports/prep-time?tenantId=<uuid>  (optional filter)
  app.get('/prep-time', { onRequest: [app.authenticate] }, async (req) => {
    const { tenantId } = req.query as any
    return ReportingService.avgPrepTimeMinutes(tenantId)
  })

  // GET /reports/rider-earnings?riderId=<uuid>&days=7
  app.get('/rider-earnings', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { riderId, days } = req.query as any
    if (!riderId) return reply.code(400).send({ error: 'riderId is required' })
    return ReportingService.riderEarnings(riderId, days ? Number(days) : 7)
  })
}
