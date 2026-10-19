import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useDismiss } from './useDismiss'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
}

interface MenuProps {
  /** Accessible name of the trigger button. */
  label: string
  trigger: ReactNode
  items: MenuItem[]
  header?: ReactNode
  triggerClassName?: string
  align?: 'start' | 'end'
}

/** Button + dropdown menu (role="menu") with arrow-key navigation. */
export function Menu({ label, trigger, items, header, triggerClassName, align = 'start' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const id = useId()

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) buttonRef.current?.focus()
  }
  useDismiss(rootRef, open, () => setOpen(false))

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [open])

  function onListKeyDown(e: React.KeyboardEvent) {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const idx = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  return (
    <div className="menu-root" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <div className={`popover menu menu-${align}`}>
          {header}
          <ul id={id} ref={listRef} role="menu" aria-label={label} onKeyDown={onListKeyDown}>
            {items.map((item) => (
              <li key={item.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`menu-item ${item.danger ? 'danger' : ''}`}
                  onClick={() => {
                    close(false)
                    item.onSelect()
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
