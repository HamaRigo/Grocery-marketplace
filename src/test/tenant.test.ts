import { describe, it, expect } from 'vitest'

// Haversine extracted for pure unit testing
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const d = (a: number, b: number) => (b - a) * Math.PI / 180
  const a = Math.sin(d(lat1, lat2) / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(d(lng1, lng2) / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

describe('haversineKm()', () => {
  it('same point = 0 km', () => {
    expect(haversineKm(51.5, 0, 51.5, 0)).toBeCloseTo(0, 5)
  })

  it('London → Paris ≈ 342 km', () => {
    expect(haversineKm(51.5074, -0.1278, 48.8566, 2.3522)).toBeCloseTo(342, 0)
  })

  it('nearby points within 1 km', () => {
    // ~0.9 km apart
    expect(haversineKm(25.285, 51.531, 25.293, 51.531)).toBeLessThan(1)
  })

  it('store discovery: point inside 10 km radius matches', () => {
    const storeCenter = { lat: 25.2854, lng: 51.5310, radiusKm: 10 }
    const customer    = { lat: 25.3200, lng: 51.5000 }
    const dist = haversineKm(customer.lat, customer.lng, storeCenter.lat, storeCenter.lng)
    expect(dist).toBeLessThanOrEqual(storeCenter.radiusKm)
  })

  it('store discovery: point outside radius does not match', () => {
    const storeCenter = { lat: 25.2854, lng: 51.5310, radiusKm: 5 }
    const farCustomer = { lat: 25.4000, lng: 51.7000 }
    const dist = haversineKm(farCustomer.lat, farCustomer.lng, storeCenter.lat, storeCenter.lng)
    expect(dist).toBeGreaterThan(storeCenter.radiusKm)
  })
})
