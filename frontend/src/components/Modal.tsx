import type { ReactNode } from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

/** Form modal on top of shadcn/Radix Dialog (focus trap, Esc, focus return). */
export function Modal({ title, onClose, children, wide }: ModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(wide === true && 'sm:max-w-3xl')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="-mx-2 max-h-[70vh] overflow-y-auto px-2">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
