import { FastifyPluginAsync } from 'fastify'
import { ReportingService } from './reporting.service'

export const reportingRoutes: FastifyPluginAsync = async (app) => {
  // All routes require authentication (admin in production; open for MVP)
  app.get('/overview', { onRequest: [app.authenticate] }, async () =>
    ReportingService.overview()
  )

  app.get('/stores', { onRequest: [app.authenticate] }, async () =>
    ReportingService.storeBreakdown()
  )

  app.get('/stores/:id/ratings', { onRequest: [app.authenticate] }, async (req) =>
    ReportingService.storeRatings((req.params as any).id)
  )

  // GET /reports/revenue?from=2026-01-01&to=2026-06-30
  app.get('/revenue', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { from, to } = req.query as any
    if (!from || !to) return reply.code(400).send({ error: 'from and to are required (ISO dates)' })
    return ReportingService.revenueOverTime(from, to)
  })
}
