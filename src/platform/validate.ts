import { z } from 'zod'

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const msg = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw Object.assign(new Error(msg), { statusCode: 400 })
  }
  return result.data
}

export function parsePagination(query: Record<string, unknown>) {
  return {
    limit:  Math.min(parseInt(String(query.limit  ?? 20), 10), 100),
    offset: parseInt(String(query.offset ?? 0), 10),
  }
}

// ── Shared schemas ────────────────────────────────────────────────────────────

export const S = {
  uuid:     z.string().uuid(),
  email:    z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone:    z.string().regex(/^\+?[0-9]{7,15}$/).optional(),
  money:    z.number().int().positive(),
  rating:   z.number().int().min(1).max(5),
  latLng: z.object({
    lat:     z.number().min(-90).max(90),
    lng:     z.number().min(-180).max(180),
    address: z.string().optional(),
  }),
  cartLine: z.object({
    productId:  z.string().uuid(),
    name:       z.string().min(1),
    priceMinor: z.number().int().positive(),
    qty:        z.number().int().positive(),
  }),
}
