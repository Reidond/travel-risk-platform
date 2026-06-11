import { http } from './client'
import type { ListResponse, RuleSetCreate, RuleSetVersion } from './types'

export const rulesetsApi = {
  list: () => http.get<ListResponse<RuleSetVersion>>('/api/rulesets'),
  active: () => http.get<RuleSetVersion>('/api/rulesets/active'),
  /** Creates a new active rule-set version. */
  create: (body: RuleSetCreate) => http.post<RuleSetVersion>('/api/rulesets', body),
  /** New version = the article preset (MATH_SPEC §2.2). */
  resetDefault: () => http.post<RuleSetVersion>('/api/rulesets/reset-default'),
}
