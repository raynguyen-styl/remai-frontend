import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  label: string
  onClose: () => void
  children: ReactNode
  /** Element to focus on open; defaults to the first focusable element. */
  initialFocus?: RefObject<HTMLElement | null>
  role?: 'dialog' | 'alertdialog'
  className?: string
  describedBy?: string
}

/** Minimal accessible modal: Escape / backdrop closes, Tab is trapped, focus is restored. */
export function Modal({ label, onClose, children, initialFocus, role = 'dialog', className, describedBy }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const target = initialFocus?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel
    target?.focus()
    return () => {
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [initialFocus])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCloseRef.current()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={`modal ${className ?? ''}`}
        role={role}
        aria-modal="true"
        aria-label={label}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  )
}

interface ConfirmProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, danger }: ConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <Modal label={title} onClose={onCancel} role="alertdialog" initialFocus={cancelRef} className="confirm" describedBy="confirm-message">
      <h2 className="confirm-title">{title}</h2>
      <p id="confirm-message" className="confirm-message">
        {message}
      </p>
      <div className="confirm-actions">
        <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
