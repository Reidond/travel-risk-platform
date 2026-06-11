import { http, queryString } from './client'
import type { ListResponse, PageParams, Region, RegionCreate, RegionUpdate } from './types'

/** Backend maximum page size for GET /api/regions. */
export const REGIONS_MAX_LIMIT = 500

export const regionsApi = {
  list: (params: PageParams = {}) =>
    http.get<ListResponse<Region>>(
      `/api/regions${queryString({ offset: params.offset, limit: params.limit })}`,
    ),
  get: (id: number) => http.get<Region>(`/api/regions/${id}`),
  create: (body: RegionCreate) => http.post<Region>('/api/regions', body),
  update: (id: number, body: RegionUpdate) => http.patch<Region>(`/api/regions/${id}`, body),
  remove: (id: number) => http.delete(`/api/regions/${id}`),
}
