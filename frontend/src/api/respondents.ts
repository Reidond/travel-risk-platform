import { http, queryString } from './client'
import type {
  ListResponse,
  Respondent,
  RespondentCreate,
  RespondentFilters,
  RespondentUpdate,
} from './types'

export const respondentsApi = {
  list: (regionId: number, filters: RespondentFilters = {}) =>
    http.get<ListResponse<Respondent>>(
      `/api/regions/${regionId}/respondents${queryString({
        offset: filters.offset,
        limit: filters.limit,
        year: filters.year,
        month: filters.month,
        accommodation: filters.accommodation,
      })}`,
    ),
  create: (regionId: number, body: RespondentCreate) =>
    http.post<Respondent>(`/api/regions/${regionId}/respondents`, body),
  update: (id: number, body: RespondentUpdate) =>
    http.patch<Respondent>(`/api/respondents/${id}`, body),
  remove: (id: number) => http.delete(`/api/respondents/${id}`),
}
