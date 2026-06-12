import { FastifyPluginAsync } from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../../platform/db'
import { redis } from '../../platform/redis'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {}

    await db.execute(sql`SELECT 1`).then(() => { checks.postgres = 'ok' })
      .catch(() => { checks.postgres = 'error' })

    await redis.ping().then(() => { checks.redis = 'ok' })
      .catch(() => { checks.redis = 'error' })

    const healthy = Object.values(checks).every(v => v === 'ok')
    return reply.code(healthy ? 200 : 503).send({
      status:    healthy ? 'ok' : 'degraded',
      checks,
      uptime:    Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    })
  })
}
