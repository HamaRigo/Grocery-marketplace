/** Reverse-geocode lat/lng into a short place / zone label (browser-safe API). */

export async function reverseGeocodeZone(
  lat: number,
  lng: number,
  lang = 'en',
): Promise<string | null> {
  try {
    const localityLanguage = lang.startsWith('ar') ? 'ar' : 'en'
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=${localityLanguage}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json() as {
      locality?: string
      city?: string
      principalSubdivision?: string
      localityInfo?: {
        administrative?: Array<{ name?: string; order?: number }>
        informative?: Array<{ name?: string; order?: number }>
      }
    }

    const informative = data.localityInfo?.informative ?? []
    const administrative = data.localityInfo?.administrative ?? []
    const neighbourhood = [...informative, ...administrative]
      .filter(x => x.name)
      .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
      .find(x => x.name && x.name !== data.city)?.name

    const zone = neighbourhood || data.locality || data.city
    const city = data.city || data.principalSubdivision
    if (zone && city && zone !== city) return `${zone}, ${city}`
    return zone || city || null
  } catch {
    return null
  }
}
