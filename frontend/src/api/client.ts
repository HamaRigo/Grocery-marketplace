// In local dev, Vite proxies same-origin paths to the API.
// On Vercel, set VITE_API_URL to your API origin (no trailing slash).
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

function url(path: string) {
  return `${API_BASE}${path}`
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url(path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as T
}

export const apiUrl = url
export const get   = <T>(path: string)                 => req<T>(path)
export const post  = <T>(path: string, body?: unknown) => req<T>(path, { method: 'POST',  body: JSON.stringify(body) })
export const put   = <T>(path: string, body?: unknown) => req<T>(path, { method: 'PUT',   body: JSON.stringify(body) })
export const patch = <T>(path: string, body?: unknown) => req<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
export const del   = <T>(path: string)                 => req<T>(path, { method: 'DELETE' })
