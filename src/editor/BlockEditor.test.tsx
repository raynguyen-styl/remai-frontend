import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Block, BlockType } from '../api/types'
import { createBlock } from '../lib/blocks'
import { BlockEditor } from './BlockEditor'

function Harness({ initial, onChange }: { initial: Block[]; onChange?: (b: Block[]) => void }) {
  const [blocks, setBlocks] = useState(initial)
  return (
    <BlockEditor
      blocks={blocks}
      onChange={(next) => {
        setBlocks(next)
        onChange?.(next)
      }}
    />
  )
}

function setup(initial: Block[]) {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<Harness initial={initial} onChange={onChange} />)
  return { user, onChange }
}

const rows = () => screen.getAllByTestId('block')
const typeOf = (row: HTMLElement) => [...row.classList].find((c) => c.startsWith('block-'))!.slice('block-'.length) as BlockType
const inputs = () => rows().map((r) => r.querySelector('textarea'))
const blk = (type: BlockType, text = '') => createBlock(type, text)

describe('Keyboard block editing (editor)', () => {
  it('Continue a list: Enter at the end of a bulleted block adds a focused empty bulleted block', async () => {
    const { user } = setup([blk('bulleted', 'Milk')])
    await user.click(inputs()[0]!)
    await user.keyboard('{End}{Enter}')
    expect(rows().map(typeOf)).toEqual(['bulleted', 'bulleted'])
    expect(inputs()[1]).toHaveValue('')
    expect(inputs()[1]).toHaveFocus()
  })

  it('Leave a list: Enter in an empty bulleted block makes it a paragraph', async () => {
    const { user } = setup([blk('bulleted')])
    await user.click(inputs()[0]!)
    await user.keyboard('{Enter}')
    expect(rows().map(typeOf)).toEqual(['paragraph'])
  })

  it('Remove empty block: Backspace in an empty non-first paragraph removes it and focuses the end of the previous block', async () => {
    const { user } = setup([blk('paragraph', 'Hello'), blk('paragraph')])
    await user.click(inputs()[1]!)
    await user.keyboard('{Backspace}')
    expect(rows()).toHaveLength(1)
    const first = inputs()[0] as HTMLTextAreaElement
    expect(first).toHaveFocus()
    expect(first.selectionStart).toBe(5)
  })

  it('Shift+Enter inserts a line break inside the block', async () => {
    const { user } = setup([blk('paragraph')])
    await user.click(inputs()[0]!)
    await user.keyboard('a{Shift>}{Enter}{/Shift}b')
    expect(rows()).toHaveLength(1)
    expect(inputs()[0]).toHaveValue('a\nb')
  })
})

describe('Slash command menu (editor)', () => {
  it('Turn into heading: "/head" then Enter on "Heading 1" makes an empty focused heading1 block', async () => {
    const { user } = setup([blk('paragraph')])
    await user.click(inputs()[0]!)
    await user.keyboard('/head')
    const listbox = screen.getByRole('listbox', { name: 'Turn into' })
    expect(within(listbox).getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('Heading 1'),
      expect.stringContaining('Heading 2'),
      expect.stringContaining('Heading 3'),
    ])
    expect(within(listbox).getByRole('option', { selected: true })).toHaveTextContent('Heading 1')
    await user.keyboard('{Enter}')
    expect(rows().map(typeOf)).toEqual(['heading1'])
    expect(inputs()[0]).toHaveValue('')
    expect(inputs()[0]).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('Dismiss: Escape closes the menu and the block text stays "/"', async () => {
    const { user } = setup([blk('paragraph')])
    await user.click(inputs()[0]!)
    await user.keyboard('/')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(inputs()[0]).toHaveValue('/')
    expect(rows().map(typeOf)).toEqual(['paragraph'])
  })

  it('arrow keys move the selection before Enter', async () => {
    const { user } = setup([blk('paragraph')])
    await user.click(inputs()[0]!)
    await user.keyboard('/{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('Heading 2')
    await user.keyboard('{ArrowUp}{Enter}')
    expect(rows().map(typeOf)).toEqual(['heading1'])
  })

  it('is operable by pointer: clicking "To-do list" converts the block', async () => {
    const { user } = setup([blk('paragraph')])
    await user.click(inputs()[0]!)
    await user.keyboard('/')
    await user.click(screen.getByRole('option', { name: /To-do list/ }))
    expect(rows().map(typeOf)).toEqual(['todo'])
    expect(inputs()[0]).toHaveFocus()
  })

  it('does not open when "/" is typed into a non-empty block', async () => {
    const { user } = setup([blk('paragraph', 'a')])
    await user.click(inputs()[0]!)
    await user.keyboard('{End}/')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows "No results" when nothing matches', async () => {
    const { user } = setup([blk('paragraph')])
    await user.click(inputs()[0]!)
    await user.keyboard('/table')
    expect(screen.getByText('No results')).toBeInTheDocument()
  })
})

describe('Block rendering (editor)', () => {
  it('Numbered list restarts: numbered, numbered, paragraph, numbered shows 1, 2, (paragraph), 1', () => {
    setup([blk('numbered', 'a'), blk('numbered', 'b'), blk('paragraph', 'c'), blk('numbered', 'd')])
    const markers = rows().map((r) => r.querySelector('.block-marker')?.textContent ?? null)
    expect(markers).toEqual(['1.', '2.', null, '1.'])
  })

  it('Toggle a to-do: tapping the checkbox checks it, strikes the text through and reports the change', async () => {
    const { user, onChange } = setup([blk('todo', 'Ship')])
    const box = screen.getByRole('checkbox', { name: 'To-do: Ship' })
    expect(box).not.toBeChecked()
    await user.click(box)
    expect(box).toBeChecked()
    expect(rows()[0]).toHaveClass('is-checked')
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ type: 'todo', checked: true })])
  })

  it('renders a divider as a non-editable rule, removable with Backspace', async () => {
    const { user } = setup([blk('paragraph', 'a'), blk('divider')])
    const divider = screen.getByRole('group', { name: /Divider/ })
    expect(divider.querySelector('hr')).not.toBeNull()
    expect(rows()[1]!.querySelector('textarea')).toBeNull()
    divider.focus()
    await user.keyboard('{Backspace}')
    expect(rows().map(typeOf)).toEqual(['paragraph'])
  })

  it('renders user text as text, never as HTML', () => {
    setup([blk('paragraph', '<img src=x onerror=alert(1)>')])
    expect(inputs()[0]).toHaveValue('<img src=x onerror=alert(1)>')
    expect(document.querySelector('img')).toBeNull()
  })
})
