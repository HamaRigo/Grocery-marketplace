import { z } from 'zod'
import { FastifyPluginAsync } from 'fastify'
import { CatalogService } from './catalog.service'
import { validate } from '../../platform/validate'
import { onlyTenantRole } from '../../platform/rbac'

const productSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  mediaUrl:    z.string().url().optional(),
  priceMinor:  z.number().int().positive(),
  currency:    z.string().length(3).default('USD'),
  categoryId:  z.string().uuid().optional(),
})

const categorySchema = z.object({
  name:     z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
})

const managerHook = (req: any) => (req.params as any).tenantId

export const catalogRoutes: FastifyPluginAsync = async (app) => {
  // ── Public browse ─────────────────────────────────────────────────────────
  app.get('/:tenantId/products', async (req) => {
    const { tenantId } = req.params as any
    const { q } = req.query as any
    return CatalogService.listProducts(tenantId, q)
  })

  app.get('/:tenantId/categories', async (req) =>
    CatalogService.listCategories((req.params as any).tenantId)
  )

  // ── Manager writes ────────────────────────────────────────────────────────
  app.post('/:tenantId/products', {
    onRequest: [onlyTenantRole('manager', managerHook)],
  }, async (req, reply) => {
    const { tenantId } = req.params as any
    const data = validate(productSchema, req.body)
    return reply.code(201).send(await CatalogService.createProduct(tenantId, data as any))
  })

  app.put('/:tenantId/products/:id', {
    onRequest: [onlyTenantRole('manager', managerHook)],
  }, async (req) => {
    const { tenantId, id } = req.params as any
    return CatalogService.updateProduct(tenantId, id, validate(productSchema.partial(), req.body) as any)
  })

  app.delete('/:tenantId/products/:id', {
    onRequest: [onlyTenantRole('manager', managerHook)],
  }, async (req, reply) => {
    const { tenantId, id } = req.params as any
    await CatalogService.delistProduct(tenantId, id)
    return reply.send({ ok: true })
  })

  app.post('/:tenantId/categories', {
    onRequest: [onlyTenantRole('manager', managerHook)],
  }, async (req, reply) => {
    const { tenantId } = req.params as any
    const { name, parentId } = validate(categorySchema, req.body)
    return reply.code(201).send(await CatalogService.createCategory(tenantId, name, parentId))
  })
}
