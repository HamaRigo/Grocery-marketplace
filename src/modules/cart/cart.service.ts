import { redis } from '../../platform/redis'

const TTL = 60 * 60 * 24 // 24 h

export interface CartLine {
  productId:  string
  name:       string
  priceMinor: number
  qty:        number
}

const key = (customerId: string, tenantId: string) => `cart:${customerId}:${tenantId}`

export const CartService = {
  async get(customerId: string, tenantId: string): Promise<CartLine[]> {
    const raw = await redis.get(key(customerId, tenantId))
    return raw ? JSON.parse(raw) : []
  },

  async upsertLine(customerId: string, tenantId: string, line: CartLine) {
    const lines = await CartService.get(customerId, tenantId)
    const idx = lines.findIndex(l => l.productId === line.productId)
    if (idx >= 0) lines[idx] = line; else lines.push(line)
    await redis.setex(key(customerId, tenantId), TTL, JSON.stringify(lines))
    return lines
  },

  async removeLine(customerId: string, tenantId: string, productId: string) {
    const lines = (await CartService.get(customerId, tenantId)).filter(l => l.productId !== productId)
    await redis.setex(key(customerId, tenantId), TTL, JSON.stringify(lines))
    return lines
  },

  async clear(customerId: string, tenantId: string) {
    await redis.del(key(customerId, tenantId))
  },
}
