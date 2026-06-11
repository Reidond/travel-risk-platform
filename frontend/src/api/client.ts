/** Shared fetch wrapper for the `/api` backend (see API_CONTRACT.md §Conventions). */

export class ApiError extends Error {
  readonly status: number
  /** FastAPI `{"detail": ...}` payload — string, validation array, or object. */
  readonly detail: unknown

  constructor(status: number, detail: unknown) {
    super(`API error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/** Best-effort human-readable text out of a thrown error. */
export function errorDetailText(error: unknown): string | null {
  if (error instanceof ApiError) {
    const d = error.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) {
      return d
        .map((item) => {
          if (item !== null && typeof item === 'object' && 'msg' in item) {
            return String((item as { msg: unknown }).msg)
          }
          return JSON.stringify(item)
        })
        .join('; ')
    }
    if (d !== null && d !== undefined) return JSON.stringify(d)
    return null
  }
  if (error instanceof Error) return error.message
  return null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    let detail: unknown = null
    try {
      const body = (await response.json()) as { detail?: unknown }
      detail = body.detail ?? null
    } catch {
      // non-JSON error body — keep detail null
    }
    throw new ApiError(response.status, detail)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

type QueryValue = string | number | boolean | null | undefined

/** Builds `?a=1&b=x` skipping null/undefined/empty-string values. */
export function queryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text === '' ? '' : `?${text}`
}

export const http = {
  get<T>(path: string): Promise<T> {
    return request<T>(path)
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    })
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  },
  delete(path: string): Promise<void> {
    return request<void>(path, { method: 'DELETE' })
  },
  postForm<T>(path: string, form: FormData): Promise<T> {
    return request<T>(path, { method: 'POST', body: form })
  },
}
