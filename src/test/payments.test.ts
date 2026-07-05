import { describe, it, expect } from 'vitest'
import { recomputeOrderAmount, canTransitionOnPaymentEvent, isFullyRefunded } from '../modules/payments/payments.service'

describe('recomputeOrderAmount() — server-side price recomputation', () => {
  it('charges the current product price, not whatever the line was created with', () => {
    const lines = [{ productId: 'p1', qty: 2 }]
    const currentPrices = new Map([['p1', 500]]) // 5.00 now, regardless of what the cart said
    expect(recomputeOrderAmount(lines, currentPrices, 200)).toBe(1_200) // 2×500 + 200 delivery
  })

  it('rejects a tampered/stale line referencing a product with no current price', () => {
    const lines = [{ productId: 'p1', qty: 1 }, { productId: 'missing', qty: 1 }]
    const currentPrices = new Map([['p1', 500]])
    expect(() => recomputeOrderAmount(lines, currentPrices, 0)).toThrow(/no longer available/)
  })

  it('sums multiple lines correctly', () => {
    const lines = [{ productId: 'a', qty: 3 }, { productId: 'b', qty: 1 }]
    const currentPrices = new Map([['a', 100], ['b', 250]])
    expect(recomputeOrderAmount(lines, currentPrices, 0)).toBe(3 * 100 + 250)
  })
})

describe('canTransitionOnPaymentEvent() — idempotent webhook state guard', () => {
  it('allows the transition when the order is still awaiting payment', () => {
    expect(canTransitionOnPaymentEvent('pending_payment')).toBe(true)
  })
  it('rejects a duplicate delivery of an already-placed order', () => {
    expect(canTransitionOnPaymentEvent('placed')).toBe(false)
  })
  it('rejects an event arriving for an order the reservation-expiry worker already cancelled', () => {
    expect(canTransitionOnPaymentEvent('cancelled')).toBe(false)
  })
  it('rejects an event for an order already marked payment_failed', () => {
    expect(canTransitionOnPaymentEvent('payment_failed')).toBe(false)
  })
})

describe('isFullyRefunded()', () => {
  it('a partial refund is not full', () => expect(isFullyRefunded(500, 1_000)).toBe(false))
  it('a refund equal to the charge is full', () => expect(isFullyRefunded(1_000, 1_000)).toBe(true))
  it('a refund exceeding the charge (shouldn\'t happen, but) counts as full', () => expect(isFullyRefunded(1_100, 1_000)).toBe(true))
})
