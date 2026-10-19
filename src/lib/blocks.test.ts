import { describe, expect, it } from 'vitest'
import type { Block, BlockType } from '../api/types'
import {
  applyBackspace,
  applyEnter,
  applySlashChoice,
  computeNumbers,
  createBlock,
  ensureEditable,
  normalizeBlock,
  removeBlockAt,
  setBlockType,
  toggleTodo,
} from './blocks'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function b(type: BlockType, text = '', checked = false): Block {
  return { ...createBlock(type, text), checked }
}

describe('Keyboard block editing — Enter', () => {
  it('Continue a list: Enter at the end of a bulleted block adds an empty bulleted block below with focus', () => {
    const blocks = [b('bulleted', 'Milk')]
    const r = applyEnter(blocks, 0, 4, 4)!
    expect(r.blocks.map((x) => [x.type, x.text])).toEqual([
      ['bulleted', 'Milk'],
      ['bulleted', ''],
    ])
    expect(r.focus).toEqual({ blockId: r.blocks[1]!.id, offset: 0 })
  })

  it.each<BlockType>(['todo', 'numbered'])('keeps the %s type for the new block (unchecked)', (type) => {
    const r = applyEnter([b(type, 'x', true)], 0, 1, 1)!
    expect(r.blocks[1]).toMatchObject({ type, text: '', checked: false })
  })

  it.each<BlockType>(['paragraph', 'heading1', 'heading2', 'heading3', 'quote', 'code'])(
    'creates a paragraph after a %s block',
    (type) => {
      const r = applyEnter([b(type, 'x')], 0, 1, 1)!
      expect(r.blocks[1]!.type).toBe('paragraph')
    },
  )

  it.each<BlockType>(['bulleted', 'todo', 'numbered'])('Leave a list: Enter in an empty %s block makes it a paragraph', (type) => {
    const blocks = [b(type, '', true)]
    const r = applyEnter(blocks, 0, 0, 0)!
    expect(r.blocks).toHaveLength(1)
    expect(r.blocks[0]).toMatchObject({ id: blocks[0]!.id, type: 'paragraph', checked: false })
    expect(r.focus).toEqual({ blockId: blocks[0]!.id, offset: 0 })
  })

  it('splits the text at the caret when Enter is pressed mid-block', () => {
    const r = applyEnter([b('paragraph', 'Hello world')], 0, 5, 5)!
    expect(r.blocks.map((x) => x.text)).toEqual(['Hello', ' world'])
  })

  it('drops a selected range when splitting', () => {
    const r = applyEnter([b('paragraph', 'abcdef')], 0, 2, 4)!
    expect(r.blocks.map((x) => x.text)).toEqual(['ab', 'ef'])
  })

  it('adds a paragraph after a divider', () => {
    const r = applyEnter([b('divider')], 0, 0, 0)!
    expect(r.blocks.map((x) => x.type)).toEqual(['divider', 'paragraph'])
  })

  it('does nothing at the 1000-block limit', () => {
    const blocks = Array.from({ length: 1000 }, () => b('paragraph', 'x'))
    expect(applyEnter(blocks, 999, 1, 1)).toBeNull()
  })

  it('gives new blocks a UUID v4 id', () => {
    const r = applyEnter([b('paragraph', 'x')], 0, 1, 1)!
    expect(r.blocks[1]!.id).toMatch(UUID)
  })
})

describe('Keyboard block editing — Backspace', () => {
  it('Remove empty block: an empty paragraph that is not first is removed; caret to end of previous', () => {
    const blocks = [b('paragraph', 'Hello'), b('paragraph', '')]
    const r = applyBackspace(blocks, 1, 0, 0)!
    expect(r.blocks).toEqual([blocks[0]])
    expect(r.focus).toEqual({ blockId: blocks[0]!.id, offset: 'end' })
  })

  it('removes an empty list block too', () => {
    const blocks = [b('paragraph', 'a'), b('bulleted', '')]
    expect(applyBackspace(blocks, 1, 0, 0)!.blocks).toHaveLength(1)
  })

  it('turns an empty first block of another type into a paragraph instead of deleting it', () => {
    const blocks = [b('heading1', '')]
    const r = applyBackspace(blocks, 0, 0, 0)!
    expect(r.blocks[0]).toMatchObject({ id: blocks[0]!.id, type: 'paragraph' })
  })

  it('does nothing for an empty first paragraph', () => {
    expect(applyBackspace([b('paragraph', '')], 0, 0, 0)).toBeNull()
  })

  it('lets the browser handle Backspace when the caret is not at the start', () => {
    expect(applyBackspace([b('paragraph', 'a'), b('paragraph', 'bc')], 1, 1, 1)).toBeNull()
    expect(applyBackspace([b('paragraph', 'a'), b('paragraph', 'bc')], 1, 0, 2)).toBeNull()
  })

  it('at the start of a non-empty list item, turns it into a paragraph keeping the text', () => {
    const r = applyBackspace([b('paragraph', 'a'), b('bulleted', 'item')], 1, 0, 0)!
    expect(r.blocks[1]).toMatchObject({ type: 'paragraph', text: 'item' })
  })

  it('at the start of a non-empty paragraph, merges it into the previous block', () => {
    const blocks = [b('heading2', 'Hello '), b('paragraph', 'world')]
    const r = applyBackspace(blocks, 1, 0, 0)!
    expect(r.blocks).toEqual([{ ...blocks[0], text: 'Hello world' }])
    expect(r.focus).toEqual({ blockId: blocks[0]!.id, offset: 6 })
  })

  it('removes a divider right before the caret', () => {
    const blocks = [b('paragraph', 'a'), b('divider'), b('paragraph', 'c')]
    const r = applyBackspace(blocks, 2, 0, 0)!
    expect(r.blocks.map((x) => x.type)).toEqual(['paragraph', 'paragraph'])
  })
})

describe('type transitions', () => {
  it('keeps the id when turning a block into another type', () => {
    const block = b('paragraph', 'x')
    expect(setBlockType(block, 'quote')).toMatchObject({ id: block.id, type: 'quote', text: 'x' })
  })

  it('Checked ignored on non-todo: only to-dos stay checked', () => {
    expect(setBlockType(b('todo', 'x', true), 'paragraph').checked).toBe(false)
    expect(normalizeBlock({ ...b('paragraph'), checked: true }).checked).toBe(false)
  })

  it('dividers have no text', () => {
    expect(setBlockType(b('paragraph', 'x'), 'divider').text).toBe('')
  })

  it('Turn into heading: the slash choice clears the "/" text and keeps focus on the block', () => {
    const blocks = [b('paragraph', '/head')]
    const r = applySlashChoice(blocks, 0, 'heading1')!
    expect(r.blocks).toEqual([{ ...blocks[0], type: 'heading1', text: '' }])
    expect(r.focus).toEqual({ blockId: blocks[0]!.id, offset: 0 })
  })

  it('choosing Divider adds a paragraph after it to keep typing', () => {
    const r = applySlashChoice([b('paragraph', '/div')], 0, 'divider')!
    expect(r.blocks.map((x) => x.type)).toEqual(['divider', 'paragraph'])
    expect(r.focus?.blockId).toBe(r.blocks[1]!.id)
  })

  it('toggles only to-do blocks', () => {
    const blocks = [b('todo', 'Ship'), b('paragraph', 'x')]
    const toggled = toggleTodo(blocks, blocks[0]!.id)
    expect(toggled[0]!.checked).toBe(true)
    expect(toggleTodo(toggled, blocks[1]!.id)[1]!.checked).toBe(false)
  })

  it('removing the only divider leaves an empty paragraph', () => {
    const r = removeBlockAt([b('divider')], 0)
    expect(r.blocks.map((x) => x.type)).toEqual(['paragraph'])
  })

  it('an empty page shows one empty paragraph', () => {
    expect(ensureEditable([])).toMatchObject([{ type: 'paragraph', text: '' }])
  })
})

describe('Block rendering — numbering', () => {
  it('Numbered list restarts: numbered, numbered, paragraph, numbered shows 1, 2, (paragraph), 1', () => {
    const types: BlockType[] = ['numbered', 'numbered', 'paragraph', 'numbered']
    expect(computeNumbers(types.map((type) => ({ type })))).toEqual([1, 2, null, 1])
  })

  it('restarts after any non-numbered block, including bulleted', () => {
    const types: BlockType[] = ['numbered', 'bulleted', 'numbered', 'numbered', 'numbered']
    expect(computeNumbers(types.map((type) => ({ type })))).toEqual([1, null, 1, 2, 3])
  })
})
