import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validate, parsePagination, S } from '../platform/validate'

describe('validate()', () => {
  it('returns parsed data on success', () => {
    const schema = z.object({ email: S.email, password: S.password })
    const result = validate(schema, { email: 'a@b.com', password: 'secret123' })
    expect(result).toEqual({ email: 'a@b.com', password: 'secret123' })
  })

  it('throws 400 with a message on failure', () => {
    const schema = z.object({ email: S.email })
    expect(() => validate(schema, { email: 'not-an-email' }))
      .toThrowError(/email/)
  })

  it('includes the statusCode 400', () => {
    const schema = z.object({ x: z.number() })
    try { validate(schema, { x: 'nope' }) }
    catch (err: any) { expect(err.statusCode).toBe(400) }
  })
})

describe('parsePagination()', () => {
  it('defaults to limit=20, offset=0', () => {
    expect(parsePagination({})).toEqual({ limit: 20, offset: 0 })
  })

  it('caps limit at 100', () => {
    expect(parsePagination({ limit: '9999' })).toEqual({ limit: 100, offset: 0 })
  })

  it('parses custom values', () => {
    expect(parsePagination({ limit: '50', offset: '40' })).toEqual({ limit: 50, offset: 40 })
  })
})
