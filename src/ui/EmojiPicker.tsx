import { useEffect, useRef } from 'react'
import { EMOJI } from '../lib/emoji'
import { useDismiss } from './useDismiss'

interface Props {
  hasIcon: boolean
  onSelect: (emoji: string) => void
  onRemove: () => void
  onClose: () => void
}

export function EmojiPicker({ hasIcon, onSelect, onRemove, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, true, onClose)

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus()
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    // Arrow keys move through the 8-column grid.
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('.emoji-cell') ?? [])]
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (idx < 0) return
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 }[e.key]
    if (delta === undefined) return
    e.preventDefault()
    buttons[Math.min(buttons.length - 1, Math.max(0, idx + delta))]?.focus()
  }

  return (
    <div ref={ref} className="popover emoji-picker" role="dialog" aria-label="Choose an icon" onKeyDown={onKeyDown}>
      <div className="emoji-picker-head">
        <span>Icons</span>
        {hasIcon && (
          <button type="button" className="btn btn-ghost btn-small" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <div className="emoji-grid">
        {EMOJI.map((emoji) => (
          <button key={emoji} type="button" className="emoji-cell" aria-label={`Use ${emoji} as icon`} onClick={() => onSelect(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
