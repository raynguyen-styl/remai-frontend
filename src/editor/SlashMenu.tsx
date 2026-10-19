import { useEffect, useRef } from 'react'
import type { BlockType } from '../api/types'
import { slashOptionId, type SlashOption } from '../lib/slash'
import { useDismiss } from '../ui/useDismiss'

interface Props {
  id: string
  options: SlashOption[]
  active: number
  onPick: (type: BlockType) => void
  onHover: (index: number) => void
  onDismiss: () => void
}

/** Block-type menu shown under a block; keyboard is handled by the textarea (combobox pattern). */
export function SlashMenu({ id, options, active, onPick, onHover, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, true, onDismiss)

  useEffect(() => {
    const el = document.getElementById(slashOptionId(id, active))
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [id, active])

  return (
    <div ref={ref} className="popover slash-menu" data-slash-menu="">
      <div className="slash-heading" aria-hidden="true">
        Basic blocks
      </div>
      {options.length === 0 ? (
        <div className="slash-empty">No results</div>
      ) : (
        <div id={id} role="listbox" aria-label="Turn into">
          {options.map((o, i) => (
            <div
              key={o.type}
              id={slashOptionId(id, i)}
              role="option"
              aria-selected={i === active}
              className={`slash-option ${i === active ? 'active' : ''}`}
              // Keep focus (and the caret) in the block while picking with a pointer.
              onMouseDown={(e) => e.preventDefault()}
              onPointerDown={(e) => e.preventDefault()}
              onMouseEnter={() => onHover(i)}
              onClick={() => onPick(o.type)}
            >
              <span className="slash-glyph" aria-hidden="true">
                {o.glyph}
              </span>
              <span className="slash-text">
                <span className="slash-label">{o.label}</span>
                <span className="slash-hint">{o.hint}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
