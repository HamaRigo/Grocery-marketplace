import { describe, it, expect } from 'vitest'
import { canSellWithSubscription } from '../modules/tenant/tenant.service'
import { STATUS_MAP, shouldSuspendForBilling, shouldReinstateFromBilling } from '../modules/billing/subscriptions.service'

describe('canSellWithSubscription() — gating matrix', () => {
  const now = new Date('2026-01-15T00:00:00Z')
  const future = new Date('2026-01-20T00:00:00Z')
  const past   = new Date('2026-01-10T00:00:00Z')

  it('trialing can sell', () => expect(canSellWithSubscription('trialing', null, now)).toBe(true))
  it('active can sell', () => expect(canSellWithSubscription('active', null, now)).toBe(true))
  it('past_due within grace can sell', () => expect(canSellWithSubscription('past_due', future, now)).toBe(true))
  it('past_due exactly at grace deadline can still sell', () => expect(canSellWithSubscription('past_due', now, now)).toBe(true))
  it('past_due past grace cannot sell', () => expect(canSellWithSubscription('past_due', past, now)).toBe(false))
  it('past_due with no grace set cannot sell', () => expect(canSellWithSubscription('past_due', null, now)).toBe(false))
  it('unpaid cannot sell', () => expect(canSellWithSubscription('unpaid', null, now)).toBe(false))
  it('cancelled cannot sell', () => expect(canSellWithSubscription('cancelled', null, now)).toBe(false))
  it('incomplete cannot sell', () => expect(canSellWithSubscription('incomplete', null, now)).toBe(false))
})

describe('STATUS_MAP — Stripe subscription status → local enum', () => {
  it('maps Stripe\'s "canceled" to this schema\'s "cancelled" spelling', () => {
    expect(STATUS_MAP.canceled).toBe('cancelled')
  })
  it('collapses incomplete_expired into incomplete', () => {
    expect(STATUS_MAP.incomplete_expired).toBe('incomplete')
  })
  it('maps paused to past_due, the closest equivalent in our enum', () => {
    expect(STATUS_MAP.paused).toBe('past_due')
  })
  it('passes through statuses that already match', () => {
    expect(STATUS_MAP.active).toBe('active')
    expect(STATUS_MAP.trialing).toBe('trialing')
    expect(STATUS_MAP.past_due).toBe('past_due')
    expect(STATUS_MAP.unpaid).toBe('unpaid')
    expect(STATUS_MAP.incomplete).toBe('incomplete')
  })
})

describe('admin-vs-billing suspension interplay', () => {
  it('a billing failure suspends an active store', () => {
    expect(shouldSuspendForBilling('active')).toBe(true)
  })
  it('a billing failure does not re-suspend an already-suspended store (admin or otherwise)', () => {
    expect(shouldSuspendForBilling('suspended')).toBe(false)
  })
  it('a successful payment reinstates a store suspended for billing', () => {
    expect(shouldReinstateFromBilling('suspended', 'billing')).toBe(true)
  })
  it('a successful payment does NOT reinstate a store an admin suspended manually', () => {
    expect(shouldReinstateFromBilling('suspended', 'admin')).toBe(false)
  })
  it('reinstate is a no-op on a store that is not suspended at all', () => {
    expect(shouldReinstateFromBilling('active', null)).toBe(false)
  })
})
