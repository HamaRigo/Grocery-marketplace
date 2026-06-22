import { z } from 'zod'
import { FastifyPluginAsync } from 'fastify'
import { TenantService } from './tenant.service'
import { validate } from '../../platform/validate'
import { onlyRole, onlyTenantRole, authenticated } from '../../platform/rbac'

const onboardSchema    = z.object({ name: z.string().min(2).max(100) })
const serviceAreaSchema = z.object({ lat: z.number(), lng: z.number(), radiusKm: z.number().positive() })
const profileSchema    = z.object({
  name:                z.string().min(2).optional(),
  logoUrl:             z.string().url().optional(),
  dispatchPolicy:      z.enum(['OWN_ONLY', 'OWN_FIRST', 'POOL_ONLY']).optional(),
  escalationTimeoutS:  z.number().int().positive().optional(),
})

export const tenantRoutes: FastifyPluginAsync = async (app) => {
  // ── Public ──────────────────────────────────��─────────────────────────────
  app.get('/', async (req) => {
    const { lat, lng } = req.query as any
    if (!lat || !lng) return TenantService.findNearby(0, 0)
    return TenantService.findNearby(parseFloat(lat), parseFloat(lng))
  })

  app.get('/:id', async (req) => TenantService.get((req.params as any).id))

  // ── Any authenticated user: onboard ──────────────────────────────────────
  app.post('/', { onRequest: [authenticated] }, async (req, reply) => {
    const { name } = validate(onboardSchema, req.body)
    const store = await TenantService.onboard(name, (req as any).user.sub)
    return reply.code(201).send(store)
  })

  // ── Manager of this tenant ────────────────────────────────────────────────
  app.put('/:id/profile', {
    onRequest: [onlyTenantRole('manager', req => (req.params as any).id)],
  }, async (req) => {
    const { id } = req.params as any
    return TenantService.updateProfile(id, validate(profileSchema, req.body))
  })

  app.put('/:id/service-area', {
    onRequest: [onlyTenantRole('manager', req => (req.params as any).id)],
  }, async (req) => {
    const { id } = req.params as any
    const { lat, lng, radiusKm } = validate(serviceAreaSchema, req.body)
    return TenantService.setServiceArea(id, lat, lng, radiusKm)
  })

  // ── Admin only ────────────────────────────────────────────────────────────
  app.post('/:id/approve', { onRequest: [onlyRole('admin')] }, async (req) =>
    TenantService.approve((req.params as any).id)
  )
  app.post('/:id/suspend', { onRequest: [onlyRole('admin')] }, async (req) =>
    TenantService.suspend((req.params as any).id)
  )

  app.put('/:id/commission', { onRequest: [onlyRole('admin')] }, async (req, reply) => {
    const { commissionBps } = req.body as any
    if (typeof commissionBps !== 'number' || commissionBps < 0 || commissionBps > 10000)
      return reply.code(400).send({ error: 'commissionBps must be 0–10000' })
    return TenantService.updateCommission((req.params as any).id, commissionBps)
  })

  // ── Favorites (authenticated customer) ───────────────────────────────────
  app.get('/favorites', { onRequest: [authenticated] }, async (req) => {
    const session = (req as any).sessionUser
    const { db } = await import('../../platform/db')
    const { favorites, stores } = await import('../../db/schema')
    const { eq } = await import('drizzle-orm')
    return db.select({ store: stores })
      .from(favorites)
      .leftJoin(stores, eq(stores.id, favorites.storeId))
      .where(eq(favorites.userId, session.userId))
  })

  app.post('/:id/favorite', { onRequest: [authenticated] }, async (req, reply) => {
    const session = (req as any).sessionUser
    const storeId = (req.params as any).id
    const { db } = await import('../../platform/db')
    const { favorites } = await import('../../db/schema')
    await db.insert(favorites).values({ userId: session.userId, storeId }).onConflictDoNothing()
    return reply.code(201).send({ ok: true })
  })

  app.delete('/:id/favorite', { onRequest: [authenticated] }, async (req, reply) => {
    const session = (req as any).sessionUser
    const storeId = (req.params as any).id
    const { db } = await import('../../platform/db')
    const { favorites } = await import('../../db/schema')
    const { and, eq } = await import('drizzle-orm')
    await db.delete(favorites).where(and(eq(favorites.userId, session.userId), eq(favorites.storeId, storeId)))
    return reply.send({ ok: true })
  })
}
