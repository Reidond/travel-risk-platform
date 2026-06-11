import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

/** Accessible modal on top of the native <dialog> element. */
export function Modal({ title, onClose, children, wide }: ModalProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className={wide === true ? 'modal modal-wide' : 'modal'}
      onClose={onClose}
      aria-label={title}
    >
      <div className="modal-header">
        <h2 className="modal-title">{title}</h2>
        <button
          type="button"
          className="btn btn-icon"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ✕
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  )
}
