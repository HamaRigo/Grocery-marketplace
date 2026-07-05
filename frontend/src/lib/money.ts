export const CURRENCY = 'QAR'

/** Format an amount already in minor units (e.g. priceMinor, totalMinor). */
export function formatMinor(amountMinor: number): string {
  return `${(amountMinor / 100).toFixed(2)} ${CURRENCY}`
}

/** Format an amount already in major units (e.g. a backend-computed *Major field). */
export function formatMajor(amountMajor: number): string {
  return `${amountMajor.toFixed(2)} ${CURRENCY}`
}
