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
}
