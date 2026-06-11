import { http } from './client'
import type { HealthResponse, MetaResponse } from './types'

export const metaApi = {
  health: () => http.get<HealthResponse>('/api/health'),
  meta: () => http.get<MetaResponse>('/api/meta'),
}
