import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  /** Shown on the confirm button while the mutation runs. */
  pendingLabel?: string
  onConfirm: () => void
  isPending?: boolean
  destructive?: boolean
}

/** Shared confirmation dialog for destructive / irreversible actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
  isPending,
  destructive,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending === true}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({
              variant: destructive === true ? 'destructive' : 'default',
            })}
            disabled={isPending === true}
            onClick={(event) => {
              // Keep the dialog open while the mutation runs; the caller
              // closes it from onSuccess/onError.
              event.preventDefault()
              onConfirm()
            }}
          >
            {isPending === true && pendingLabel !== undefined ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
