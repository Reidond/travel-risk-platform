import { http } from './client'
import type { CriteriaConfig, CriteriaConfigInput } from './types'

export const criteriaApi = {
  get: () => http.get<CriteriaConfig>('/api/criteria'),
  /** Full replacement; 409 when a structural edit would orphan existing ratings. */
  put: (body: CriteriaConfigInput) => http.put<CriteriaConfig>('/api/criteria', body),
}
