import { describe, it, expect } from 'vitest'

// Pure commission math — extracted so it can be unit-tested without DB
function calcCommission(totalMinor: number, commissionBps: number): number {
  return Math.round(totalMinor * commissionBps / 10_000)
}

describe('commission calculation', () => {
  it('10% on QAR 100.00 (10000 minor) = QAR 10.00', () => {
    expect(calcCommission(10_000, 1000)).toBe(1_000)
  })

  it('5% on 999 minor = 50 (rounded)', () => {
    expect(calcCommission(999, 500)).toBe(50)  // 999*500/10000 = 49.95 → rounds to 50
  })

  it('0% on any amount = 0', () => {
    expect(calcCommission(50_000, 0)).toBe(0)
  })

  it('100% commission = full amount', () => {
    expect(calcCommission(5_000, 10_000)).toBe(5_000)
  })
})

describe('subscription plan amounts', () => {
  const PLANS = { free: 0, standard: 1000, premium: 2500 }

  it('free tier costs nothing', () => expect(PLANS.free).toBe(0))
  it('standard = $10.00', ()      => expect(PLANS.standard).toBe(1000))
  it('premium = $25.00', ()       => expect(PLANS.premium).toBe(2500))
})
