import { useTranslation } from 'react-i18next'

interface PaginationProps {
  offset: number
  limit: number
  total: number
  onOffsetChange: (offset: number) => void
}

export function Pagination({ offset, limit, total, onOffsetChange }: PaginationProps) {
  const { t } = useTranslation()
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + limit, total)
  return (
    <nav className="pagination" aria-label={t('common.pageRange', { from, to, total })}>
      <button
        type="button"
        className="btn"
        disabled={offset === 0}
        onClick={() => onOffsetChange(Math.max(0, offset - limit))}
      >
        {t('common.pagePrev')}
      </button>
      <span className="muted">{t('common.pageRange', { from, to, total })}</span>
      <button
        type="button"
        className="btn"
        disabled={to >= total}
        onClick={() => onOffsetChange(offset + limit)}
      >
        {t('common.pageNext')}
      </button>
    </nav>
  )
}
