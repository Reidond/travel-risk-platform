import { AlertCircleIcon, Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { errorDetailText } from '../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

export function Loading() {
  const { t } = useTranslation()
  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
      {t('common.loading')}
    </p>
  )
}

/** Content-shaped loading placeholder; announces itself to screen readers. */
export function LoadingSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <div role="status" className={className ?? 'space-y-2'}>
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  const { t } = useTranslation()
  const detail = errorDetailText(error)
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircleIcon aria-hidden="true" />
      <AlertTitle>{t('common.errorTitle')}</AlertTitle>
      <AlertDescription>{detail ?? t('errors.generic')}</AlertDescription>
    </Alert>
  )
}
