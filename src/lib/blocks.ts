// Pure block-editing rules (spec web-client "Keyboard block editing",
// page-content "Block model" / "Block rendering"). No React, no DOM.
import { LIMITS, type Block, type BlockType } from '../api/types'
import { newId } from './ids'

/** Types that carry over to the new block on Enter. */
const CONTINUING: ReadonlySet<BlockType> = new Set<BlockType>(['todo', 'bulleted', 'numbered'])

export function isContinuingType(type: BlockType): boolean {
  return CONTINUING.has(type)
}

/** Where to put the caret after an edit. `offset: 'end'` means end of text. */
export interface FocusTarget {
  blockId: string
  offset: number | 'end'
}

export interface EditResult {
  blocks: Block[]
  focus: FocusTarget | null
}

export function createBlock(type: BlockType = 'paragraph', text = ''): Block {
  return normalizeBlock({ id: newId(), type, text, checked: false })
}

/** Mirrors the server's normalisation: only todos are checked, dividers have no text. */
export function normalizeBlock(block: Block): Block {
  const checked = block.type === 'todo' ? block.checked : false
  const text = block.type === 'divider' ? '' : block.text
  if (checked === block.checked && text === block.text) return block
  return { ...block, checked, text }
}

/** Turn a block into another type, keeping its id. */
export function setBlockType(block: Block, type: BlockType): Block {
  if (block.type === type) return block
  return normalizeBlock({ ...block, type })
}

/** A page always shows at least one block so there is somewhere to type. */
export function ensureEditable(blocks: Block[]): Block[] {
  return blocks.length > 0 ? blocks : [createBlock()]
}

function replaceAt(blocks: Block[], index: number, ...items: Block[]): Block[] {
  return [...blocks.slice(0, index), ...items, ...blocks.slice(index + 1)]
}

/**
 * Enter (without Shift) in block `index` with the given selection.
 * - Empty todo/bulleted/numbered -> becomes a paragraph ("Leave a list").
 * - Otherwise the text after the caret moves into a new block below, which keeps
 *   the type for todo/bulleted/numbered and is a paragraph for everything else
 *   ("Continue a list"). At the end of a block that is a new empty block.
 * Returns null when nothing should happen (e.g. the 1000-block limit).
 */
export function applyEnter(blocks: Block[], index: number, selStart: number, selEnd: number): EditResult | null {
  const block = blocks[index]
  if (!block) return null

  if (block.text === '' && isContinuingType(block.type)) {
    return {
      blocks: replaceAt(blocks, index, setBlockType(block, 'paragraph')),
      focus: { blockId: block.id, offset: 0 },
    }
  }

  if (blocks.length >= LIMITS.blocksMax) return null

  if (block.type === 'divider') {
    const next = createBlock()
    return { blocks: replaceAt(blocks, index, block, next), focus: { blockId: next.id, offset: 0 } }
  }

  const start = Math.max(0, Math.min(selStart, block.text.length))
  const end = Math.max(start, Math.min(selEnd, block.text.length))
  const kept: Block = { ...block, text: block.text.slice(0, start) }
  const next = createBlock(isContinuingType(block.type) ? block.type : 'paragraph', block.text.slice(end))
  return { blocks: replaceAt(blocks, index, kept, next), focus: { blockId: next.id, offset: 0 } }
}

/**
 * Backspace with a collapsed caret at offset 0 of block `index`.
 * - Empty block that is not the first -> removed, caret to end of previous ("Remove empty block").
 * - First block, or non-empty block, of a non-paragraph type -> becomes a paragraph.
 * - Non-empty paragraph -> merged into the previous text block.
 * Returns null to let the browser handle the key (caret not at 0, selection, nothing to do).
 */
export function applyBackspace(blocks: Block[], index: number, selStart: number, selEnd: number): EditResult | null {
  const block = blocks[index]
  if (!block || selStart !== 0 || selEnd !== 0) return null
  const prev = index > 0 ? blocks[index - 1] : undefined

  if (block.text === '' && prev) {
    return {
      blocks: [...blocks.slice(0, index), ...blocks.slice(index + 1)],
      focus: { blockId: prev.id, offset: 'end' },
    }
  }

  if (block.type !== 'paragraph') {
    return {
      blocks: replaceAt(blocks, index, setBlockType(block, 'paragraph')),
      focus: { blockId: block.id, offset: 0 },
    }
  }

  if (!prev) return null

  if (prev.type === 'divider') {
    // Backspace right after a divider deletes the divider.
    return {
      blocks: [...blocks.slice(0, index - 1), ...blocks.slice(index)],
      focus: { blockId: block.id, offset: 0 },
    }
  }

  const merged = prev.text + block.text
  if (merged.length > LIMITS.blockTextMax) return null
  return {
    blocks: [...blocks.slice(0, index - 1), { ...prev, text: merged }, ...blocks.slice(index + 1)],
    focus: { blockId: prev.id, offset: prev.text.length },
  }
}

/** Remove block `index` (used for dividers, which have no caret). */
export function removeBlockAt(blocks: Block[], index: number): EditResult {
  const rest = [...blocks.slice(0, index), ...blocks.slice(index + 1)]
  if (rest.length === 0) {
    const fresh = createBlock()
    return { blocks: [fresh], focus: { blockId: fresh.id, offset: 0 } }
  }
  const target = rest[Math.max(0, index - 1)]!
  return { blocks: rest, focus: { blockId: target.id, offset: index > 0 ? 'end' : 0 } }
}

/**
 * Turn a block into `type` from the slash menu: clears the "/query" text.
 * A divider gets a fresh paragraph after it so typing can continue.
 */
export function applySlashChoice(blocks: Block[], index: number, type: BlockType): EditResult | null {
  const block = blocks[index]
  if (!block) return null
  const turned = setBlockType({ ...block, text: '' }, type)
  if (type === 'divider') {
    const nextBlock = blocks[index + 1]
    if (nextBlock && nextBlock.type !== 'divider') {
      return { blocks: replaceAt(blocks, index, turned), focus: { blockId: nextBlock.id, offset: 0 } }
    }
    if (blocks.length >= LIMITS.blocksMax) {
      return { blocks: replaceAt(blocks, index, turned), focus: null }
    }
    const after = createBlock()
    return { blocks: replaceAt(blocks, index, turned, after), focus: { blockId: after.id, offset: 0 } }
  }
  return { blocks: replaceAt(blocks, index, turned), focus: { blockId: block.id, offset: 0 } }
}

export function updateBlockText(blocks: Block[], id: string, text: string): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, text } : b))
}

export function toggleTodo(blocks: Block[], id: string): Block[] {
  return blocks.map((b) => (b.id === id && b.type === 'todo' ? { ...b, checked: !b.checked } : b))
}

/**
 * Running numbers for `numbered` blocks, restarting at 1 after any other block
 * ("Numbered list restarts"). Non-numbered blocks get null.
 */
export function computeNumbers(blocks: readonly Pick<Block, 'type'>[]): (number | null)[] {
  let n = 0
  return blocks.map((b) => {
    if (b.type !== 'numbered') {
      n = 0
      return null
    }
    n += 1
    return n
  })
}
