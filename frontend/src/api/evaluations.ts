import { http, queryString } from './client'
import type {
  EvaluationCreate,
  EvaluationListItem,
  EvaluationRun,
  ExportFormat,
  IndividualResult,
  Lang,
  ListResponse,
  PageParams,
} from './types'

export const evaluationsApi = {
  /** Runs the T₅ operator with the ACTIVE config + ruleset. Synchronous. */
  create: (body: EvaluationCreate) => http.post<EvaluationRun>('/api/evaluations', body),
  list: (page: PageParams = {}) =>
    http.get<ListResponse<EvaluationListItem>>(
      `/api/evaluations${queryString({ offset: page.offset, limit: page.limit })}`,
    ),
  get: (id: number) => http.get<EvaluationRun>(`/api/evaluations/${id}`),
  remove: (id: number) => http.delete(`/api/evaluations/${id}`),
  individuals: (id: number, regionId: number, page: PageParams = {}) =>
    http.get<ListResponse<IndividualResult>>(
      `/api/evaluations/${id}/regions/${regionId}/individuals${queryString({
        offset: page.offset,
        limit: page.limit,
      })}`,
    ),
  /** Download URL honouring the current language (anchor href, not fetch). */
  exportUrl: (id: number, format: ExportFormat, lang: Lang) =>
    `/api/evaluations/${id}/export${queryString({ format, lang })}`,
}
