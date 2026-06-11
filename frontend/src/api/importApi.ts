import { http } from './client'
import type { ImportReport } from './types'

export const importApi = {
  /** Multipart upload of an .xlsx/.csv file; optional target region. */
  importFile: (file: File, regionId?: number | null) => {
    const form = new FormData()
    form.append('file', file)
    if (regionId !== null && regionId !== undefined) {
      form.append('region_id', String(regionId))
    }
    return http.postForm<ImportReport>('/api/import', form)
  },
  /** Seeds the bundled 327-respondent demo dataset (409 if already seeded). */
  loadDemo: () => http.post<ImportReport>('/api/import/demo'),
}
