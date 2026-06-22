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
  // Allow plain-text bodies for CSV import
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => done(null, body))
  // ── Public browse ─────────────────────────────────────────────────────────
  app.get('/:tenantId/products', async (req) => {
    const { tenantId } = req.params as any
    const { q, categoryId, maxPrice } = req.query as any
    return CatalogService.listProducts(
      tenantId, q || undefined, categoryId || undefined,
      maxPrice ? Math.round(Number(maxPrice) * 100) : undefined,
    )
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

  // Bulk CSV import — body is raw CSV text (Content-Type: text/plain)
  app.post('/:tenantId/import', {
    onRequest: [onlyTenantRole('manager', managerHook)],
  }, async (req, reply) => {
    const { tenantId } = req.params as any
    const csv = (req.body as string) ?? ''
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return reply.code(400).send({ error: 'CSV must have a header row and at least one product row.' })

    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
    const nameIdx  = header.indexOf('name')
    const descIdx  = header.indexOf('description')
    const priceIdx = header.indexOf('price')
    const catIdx   = header.indexOf('categoryid')

    if (nameIdx === -1 || priceIdx === -1)
      return reply.code(400).send({ error: 'CSV must have "name" and "price" columns.' })

    const created: any[] = []
    for (const line of lines.slice(1)) {
      const cols = line.split(',')
      const name  = cols[nameIdx]?.trim()
      const price = Number(cols[priceIdx]?.trim())
      if (!name || isNaN(price) || price <= 0) continue
      const description = descIdx !== -1 ? (cols[descIdx]?.trim() || undefined) : undefined
      const categoryId  = catIdx  !== -1 ? (cols[catIdx]?.trim()  || undefined) : undefined
      const p = await CatalogService.createProduct(tenantId, {
        tenantId, name, description,
        priceMinor: Math.round(price * 100),
        currency: 'USD',
        categoryId,
      } as any)
      created.push(p)
    }
    return reply.code(201).send({ imported: created.length, products: created })
  })
}
