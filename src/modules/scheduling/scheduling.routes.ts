import { z } from 'zod'
import { FastifyPluginAsync } from 'fastify'
import { SchedulingService } from './scheduling.service'
import { validate } from '../../platform/validate'
import { onlyTenantRole } from '../../platform/rbac'

const slotSchema = z.object({
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/),
  capacity:  z.number().int().min(1).max(200).default(10),
})

const managerHook = (req: any) => (req.params as any).tenantId

export const schedulingRoutes: FastifyPluginAsync = async (app) => {
  // Public — customers browse available slots
  app.get('/:tenantId/slots', async (req) => {
    const { tenantId } = req.params as any
    const { date } = req.query as any
    if (!date) return []
    return SchedulingService.listSlots(tenantId, date)
  })

  // Manager — create slots for a day
  app.post('/:tenantId/slots', {
    onRequest: [onlyTenantRole('manager', managerHook)],
  }, async (req, reply) => {
    const { tenantId } = req.params as any
    const { date, startTime, endTime, capacity } = validate(slotSchema, req.body)
    const slot = await SchedulingService.createSlot(tenantId, date, startTime, endTime, capacity ?? 10)
    return reply.code(201).send(slot)
  })
}
