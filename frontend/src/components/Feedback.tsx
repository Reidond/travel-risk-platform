import { useTranslation } from 'react-i18next'

import { errorDetailText } from '../api/client'

export function Loading() {
  const { t } = useTranslation()
  return (
    <p className="muted" role="status">
      {t('common.loading')}
    </p>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  const { t } = useTranslation()
  const detail = errorDetailText(error)
  return (
    <div className="alert alert-error" role="alert">
      <strong>{t('common.errorTitle')}: </strong>
      {detail ?? t('errors.generic')}
    </div>
  )
}
