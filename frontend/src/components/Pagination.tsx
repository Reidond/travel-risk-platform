import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZES = [10, 25, 50] as const

interface PaginationProps {
  offset: number
  limit: number
  total: number
  onOffsetChange: (offset: number) => void
  /** When provided, renders a page-size selector. */
  onLimitChange?: (limit: number) => void
}

export function Pagination({ offset, limit, total, onOffsetChange, onLimitChange }: PaginationProps) {
  const { t } = useTranslation()
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + limit, total)
  return (
    <nav
      className="mt-3 flex flex-wrap items-center gap-3"
      aria-label={t('common.pageRange', { from, to, total })}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={offset === 0}
        onClick={() => onOffsetChange(Math.max(0, offset - limit))}
      >
        {t('common.pagePrev')}
      </Button>
      <span className="text-muted-foreground text-sm" aria-live="polite">
        {t('common.pageRange', { from, to, total })}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={to >= total}
        onClick={() => onOffsetChange(offset + limit)}
      >
        {t('common.pageNext')}
      </Button>
      {onLimitChange && (
        <span className="ml-auto flex items-center gap-2">
          <Label htmlFor="page-size" className="text-muted-foreground text-sm font-normal">
            {t('common.perPage')}
          </Label>
          <Select
            value={String(limit)}
            onValueChange={(value) => {
              onLimitChange(Number(value))
              onOffsetChange(0)
            }}
          >
            <SelectTrigger id="page-size" size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      )}
    </nav>
  )
}
