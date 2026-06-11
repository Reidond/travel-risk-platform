import { http, queryString } from './client'
import type { ConfigCreate, ConfigVersion, CurvesResponse, ListResponse } from './types'

export const configApi = {
  /** Active platform configuration version. */
  getActive: () => http.get<ConfigVersion>('/api/config'),
  versions: () => http.get<ListResponse<ConfigVersion>>('/api/config/versions'),
  /** Creates a new active version. */
  create: (body: ConfigCreate) => http.post<ConfigVersion>('/api/config', body),
  activate: (version: number) =>
    http.post<ConfigVersion>(`/api/config/versions/${version}/activate`),
  /** MF plot data sampled from the core library. */
  curves: (version?: number) =>
    http.get<CurvesResponse>(`/api/config/curves${queryString({ version })}`),
}
