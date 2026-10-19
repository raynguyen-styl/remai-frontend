import { useId, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { LIMITS, type Block, type BlockType } from '../api/types'
import {
  applyBackspace,
  applyEnter,
  applySlashChoice,
  computeNumbers,
  createBlock,
  removeBlockAt,
  toggleTodo,
  updateBlockText,
  type EditResult,
  type FocusTarget,
} from '../lib/blocks'
import { filterSlashOptions, moveSelection, opensSlashMenu, slashOptionId, slashQuery } from '../lib/slash'
import { AutoTextarea } from '../ui/AutoTextarea'
import { SlashMenu } from './SlashMenu'

export interface BlockEditorHandle {
  /** Focus the start of the first block (e.g. Enter in the page title). */
  focusFirst: () => void
}

interface Props {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  /** ArrowUp at the very start of the first block. */
  onExitTop?: () => void
  ref?: Ref<BlockEditorHandle>
}

const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: 'Text',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  todo: 'To-do',
  bulleted: 'Bulleted list item',
  numbered: 'Numbered list item',
  quote: 'Quote',
  code: 'Code',
  divider: 'Divider',
}

const PLACEHOLDERS: Partial<Record<BlockType, string>> = {
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  todo: 'To-do',
  bulleted: 'List',
  numbered: 'List',
  quote: 'Quote',
  code: 'Code',
}

const SLASH_HINT = "Type '/' for commands"

/** Paragraphs show the slash hint only when focused (or the page is empty); other types always label themselves. */
function placeholderFor(type: BlockType, showHint: boolean): string | undefined {
  if (type === 'paragraph') return showHint ? SLASH_HINT : undefined
  return PLACEHOLDERS[type]
}

function elementFor(container: HTMLElement | null, blockId: string): HTMLElement | null {
  const nodes = container?.querySelectorAll<HTMLElement>('[data-block-id]') ?? []
  for (const node of nodes) if (node.dataset.blockId === blockId) return node
  return null
}

/** Focus a block and place the caret. Returns false if the block is not rendered yet. */
function focusIn(container: HTMLElement | null, target: FocusTarget): boolean {
  const el = elementFor(container, target.blockId)
  if (!el) return false
  el.focus()
  if (el instanceof HTMLTextAreaElement) {
    const pos = target.offset === 'end' ? el.value.length : Math.min(target.offset, el.value.length)
    el.setSelectionRange(pos, pos)
  }
  return true
}

interface SlashState {
  blockId: string
  active: number
}

/**
 * Controlled block list editor. Implements spec web-client "Keyboard block editing"
 * and "Slash command menu"; rendering per page-content "Block rendering".
 */
export function BlockEditor({ blocks, onChange, onExitTop, ref }: Props) {
  const menuId = useId()
  const pendingFocus = useRef<FocusTarget | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [slash, setSlash] = useState<SlashState | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const numbers = computeNumbers(blocks)

  const focusTarget = (target: FocusTarget) => focusIn(containerRef.current, target)

  // Apply a focus request after the edit that produced it has rendered.
  useLayoutEffect(() => {
    const target = pendingFocus.current
    if (target && focusIn(containerRef.current, target)) pendingFocus.current = null
  })

  useImperativeHandle(
    ref,
    () => ({
      focusFirst: () => {
        const first = blocks[0]
        if (first) focusIn(containerRef.current, { blockId: first.id, offset: 0 })
      },
    }),
    [blocks],
  )

  function commit(result: EditResult) {
    pendingFocus.current = result.focus
    onChange(result.blocks)
  }

  function slashFor(block: Block) {
    if (!slash || slash.blockId !== block.id) return null
    const query = slashQuery(block.text)
    if (query === null) return null
    const options = filterSlashOptions(query)
    return { options, active: Math.min(slash.active, Math.max(0, options.length - 1)) }
  }

  function onTextChange(block: Block, next: string) {
    if (opensSlashMenu(block.text, next)) setSlash({ blockId: block.id, active: 0 })
    else if (slash?.blockId === block.id) setSlash(slashQuery(next) === null ? null : { blockId: block.id, active: 0 })
    onChange(updateBlockText(blocks, block.id, next))
  }

  function pick(index: number, type: BlockType) {
    setSlash(null)
    const result = applySlashChoice(blocks, index, type)
    if (result) commit(result)
  }

  function moveFocus(index: number, offset: number | 'end') {
    const target = blocks[index]
    if (target) focusTarget({ blockId: target.id, offset })
  }

  function onTextKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) {
    if (e.nativeEvent.isComposing) return
    const ta = e.currentTarget
    const menu = slashFor(block)

    if (menu) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSlash({ blockId: block.id, active: moveSelection(menu.active, e.key === 'ArrowDown' ? 1 : -1, menu.options.length) })
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const option = menu.options[menu.active]
        if (option) pick(index, option.type)
        else setSlash(null)
        return
      }
      if (e.key === 'Escape') {
        // Close the menu and leave the typed text as it is ("Dismiss").
        e.preventDefault()
        e.stopPropagation()
        setSlash(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      // Shift+Enter falls through to the textarea: a line break inside the block.
      e.preventDefault()
      const result = applyEnter(blocks, index, ta.selectionStart, ta.selectionEnd)
      if (result) commit(result)
      return
    }
    if (e.key === 'Backspace') {
      const result = applyBackspace(blocks, index, ta.selectionStart, ta.selectionEnd)
      if (result) {
        e.preventDefault()
        commit(result)
      }
      return
    }
    if (e.key === 'ArrowUp' && ta.selectionStart === 0 && ta.selectionEnd === 0) {
      e.preventDefault()
      if (index === 0) onExitTop?.()
      else moveFocus(index - 1, 'end')
      return
    }
    if (e.key === 'ArrowDown' && ta.selectionStart === ta.value.length && index < blocks.length - 1) {
      e.preventDefault()
      moveFocus(index + 1, 0)
    }
  }

  function onDividerKeyDown(e: KeyboardEvent<HTMLDivElement>, index: number) {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      commit(removeBlockAt(blocks, index))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const result = applyEnter(blocks, index, 0, 0)
      if (result) commit(result)
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      moveFocus(index - 1, 'end')
    } else if (e.key === 'ArrowDown' && index < blocks.length - 1) {
      e.preventDefault()
      moveFocus(index + 1, 0)
    }
  }

  /** Clicking the empty space under the blocks continues the page. */
  function onTailClick() {
    const last = blocks[blocks.length - 1]
    if (last && last.type === 'paragraph' && last.text === '') {
      focusTarget({ blockId: last.id, offset: 0 })
      return
    }
    if (blocks.length >= LIMITS.blocksMax) return
    const fresh = createBlock()
    commit({ blocks: [...blocks, fresh], focus: { blockId: fresh.id, offset: 0 } })
  }

  const onlyEmptyParagraph = blocks.length === 1 && blocks[0]?.type === 'paragraph' && blocks[0].text === ''

  return (
    <div className="editor" ref={containerRef}>
      {blocks.map((block, index) => {
        const menu = slashFor(block)
        const focused = focusedId === block.id
        const placeholder = placeholderFor(block.type, focused || onlyEmptyParagraph)
        const number = numbers[index]
        return (
          <div key={block.id} className={`block block-${block.type} ${block.checked ? 'is-checked' : ''}`} data-testid="block">
            {block.type === 'todo' && (
              <input
                type="checkbox"
                className="todo-check"
                checked={block.checked}
                aria-label={block.text ? `To-do: ${block.text}` : 'To-do'}
                onChange={() => onChange(toggleTodo(blocks, block.id))}
              />
            )}
            {block.type === 'bulleted' && (
              <span className="block-marker" aria-hidden="true">
                •
              </span>
            )}
            {block.type === 'numbered' && (
              <span className="block-marker" aria-hidden="true">
                {number}.
              </span>
            )}
            {block.type === 'divider' ? (
              <div
                data-block-id={block.id}
                className="divider"
                role="group"
                tabIndex={0}
                aria-label="Divider (Backspace removes it)"
                onKeyDown={(e) => onDividerKeyDown(e, index)}
              >
                <hr />
              </div>
            ) : (
              <AutoTextarea
                data-block-id={block.id}
                className="block-input"
                value={block.text}
                maxLength={LIMITS.blockTextMax}
                placeholder={placeholder}
                aria-label={block.type === 'numbered' ? `${BLOCK_LABELS.numbered} ${number}` : BLOCK_LABELS[block.type]}
                aria-haspopup={menu ? 'listbox' : undefined}
                aria-expanded={menu ? true : undefined}
                aria-controls={menu ? menuId : undefined}
                aria-activedescendant={menu && menu.options.length > 0 ? slashOptionId(menuId, menu.active) : undefined}
                spellCheck={block.type !== 'code'}
                onChange={(e) => onTextChange(block, e.target.value)}
                onKeyDown={(e) => onTextKeyDown(e, block, index)}
                onFocus={() => {
                  setFocusedId(block.id)
                  if (slash && slash.blockId !== block.id) setSlash(null)
                }}
                onBlur={() => setFocusedId((id) => (id === block.id ? null : id))}
              />
            )}
            {menu && (
              <SlashMenu
                id={menuId}
                options={menu.options}
                active={menu.active}
                onPick={(type) => pick(index, type)}
                onHover={(i) => setSlash({ blockId: block.id, active: i })}
                onDismiss={() => setSlash(null)}
              />
            )}
          </div>
        )
      })}
      <div className="editor-tail" aria-hidden="true" onClick={onTailClick} />
    </div>
  )
}
