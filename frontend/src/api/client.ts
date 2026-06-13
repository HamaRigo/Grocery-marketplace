// All requests go to the same origin via Vite proxy — cookies flow automatically.
async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
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

export const get  = <T>(url: string)                 => req<T>(url)
export const post = <T>(url: string, body?: unknown) => req<T>(url, { method: 'POST',   body: JSON.stringify(body) })
export const put  = <T>(url: string, body?: unknown) => req<T>(url, { method: 'PUT',    body: JSON.stringify(body) })
export const del  = <T>(url: string)                 => req<T>(url, { method: 'DELETE' })
