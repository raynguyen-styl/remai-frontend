import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createBlock } from '../lib/blocks'
import { fakeBackend } from '../test/fakeBackend'
import { makePage, renderApp } from '../test/helpers'

const sidebar = () => screen.getByRole('complementary', { name: 'Sidebar' })
const location = () => screen.getByTestId('location').textContent

describe('Page header and autosave', () => {
  it('Untitled display: an empty title shows as "Untitled" in the sidebar, the header and the tab', async () => {
    const page = makePage({ title: '' })
    fakeBackend({ pages: [page] })
    renderApp(`/p/${page.id}`, { token: 't' })
    const title = await screen.findByRole('textbox', { name: 'Page title' })
    expect(title).toHaveAttribute('placeholder', 'Untitled')
    expect(within(sidebar()).getByRole('link', { name: 'Untitled' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Untitled – remai'))
  })

  it('Rename from the header: the sidebar entry and the browser tab show the new title once saved', async () => {
    const page = makePage({ title: 'Ideas' })
    const { requests, state } = fakeBackend({ pages: [page] })
    const user = userEvent.setup()
    renderApp(`/p/${page.id}`, { token: 't' })
    const title = await screen.findByRole('textbox', { name: 'Page title' })
    await user.clear(title)
    await user.type(title, 'Roadmap')

    await screen.findByText('Saved', {}, { timeout: 3000 })
    expect(state.pages[0]!.title).toBe('Roadmap')
    expect(requests('PATCH', page.id).at(-1)!.init.body).toBe(JSON.stringify({ title: 'Roadmap' }))
    expect(within(sidebar()).getByRole('link', { name: 'Roadmap' })).toBeInTheDocument()
    expect(document.title).toBe('Roadmap – remai')
  })

  it('Edit then pause: content is saved within about a second and the client shows "Saved"', async () => {
    const page = makePage({ title: 'Notes' })
    const { requests, state } = fakeBackend({ pages: [page], blocks: { [page.id]: [createBlock('paragraph', 'Hi')] } })
    const user = userEvent.setup()
    renderApp(`/p/${page.id}`, { token: 't' })
    const block = await screen.findByRole('textbox', { name: 'Text' })
    await user.click(block)
    await user.keyboard('{End} there')
    expect(requests('PUT', '/blocks')).toHaveLength(0) // debounced, not per keystroke
    await screen.findByText('Saved', {}, { timeout: 2000 })
    expect(requests('PUT', '/blocks')).toHaveLength(1)
    expect(state.blocks[page.id]).toEqual([expect.objectContaining({ type: 'paragraph', text: 'Hi there' })])
  })

  it('Save failure surfaced: shows a save-failed state and keeps the edits on screen', async () => {
    const page = makePage({ title: 'Notes' })
    fakeBackend({ pages: [page], failSaves: 1 })
    const user = userEvent.setup()
    renderApp(`/p/${page.id}`, { token: 't' })
    const block = await screen.findByRole('textbox', { name: 'Text' })
    await user.type(block, 'Important')
    expect(await screen.findByText("Couldn't save – retrying", {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue('Important')
    // The 2 s retry succeeds.
    expect(await screen.findByText('Saved', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('Toggle a to-do: the change is saved', async () => {
    const page = makePage()
    const { state } = fakeBackend({ pages: [page], blocks: { [page.id]: [createBlock('todo', 'Ship')] } })
    const user = userEvent.setup()
    renderApp(`/p/${page.id}`, { token: 't' })
    await user.click(await screen.findByRole('checkbox', { name: 'To-do: Ship' }))
    await waitFor(() => expect(state.blocks[page.id]?.[0]).toMatchObject({ type: 'todo', checked: true }), { timeout: 2000 })
  })

  it('Leaving the page flushes a pending save', async () => {
    const a = makePage({ title: 'A' })
    const b = makePage({ title: 'B' })
    const { state } = fakeBackend({ pages: [a, b] })
    const user = userEvent.setup()
    renderApp(`/p/${a.id}`, { token: 't' })
    await user.type(await screen.findByRole('textbox', { name: 'Text' }), 'draft')
    await user.click(within(sidebar()).getByRole('link', { name: 'B' }))
    // Saved right away on leave, without waiting for the debounce.
    await waitFor(() => expect(state.blocks[a.id]?.[0]?.text).toBe('draft'), { timeout: 500 })
  })

  it('emoji picker offers at least 20 emoji, sets the icon and can remove it', async () => {
    const page = makePage({ title: 'Trip' })
    const { state } = fakeBackend({ pages: [page] })
    const user = userEvent.setup()
    renderApp(`/p/${page.id}`, { token: 't' })
    await user.click(await screen.findByRole('button', { name: 'Add icon' }))
    const picker = screen.getByRole('dialog', { name: 'Choose an icon' })
    expect(within(picker).getAllByRole('button', { name: /^Use .* as icon$/ }).length).toBeGreaterThanOrEqual(20)
    await user.click(within(picker).getByRole('button', { name: 'Use ✈️ as icon' }))
    expect(screen.getByRole('button', { name: 'Change icon' })).toHaveTextContent('✈️')
    await waitFor(() => expect(state.pages[0]!.icon).toBe('✈️'), { timeout: 2000 })

    await user.click(screen.getByRole('button', { name: 'Change icon' }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(state.pages[0]!.icon).toBe(''), { timeout: 2000 })
  })
})

describe('Sidebar', () => {
  it('shows an empty state with a prompt to create the first page', async () => {
    const { requests } = fakeBackend()
    const user = userEvent.setup()
    renderApp('/', { token: 't' })
    expect(await screen.findByRole('heading', { name: 'No pages yet' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'New page' }))
    await waitFor(() => expect(location()).toMatch(/^\/p\//))
    expect(requests('POST', '/api/v1/pages')).toHaveLength(1)
    expect(await screen.findByRole('textbox', { name: 'Page title' })).toHaveFocus()
  })

  it('adds a subpage from the tree and expands the parent', async () => {
    const parent = makePage({ title: 'Projects' })
    const { requests } = fakeBackend({ pages: [parent] })
    const user = userEvent.setup()
    renderApp('/', { token: 't' })
    await user.click(await screen.findByRole('button', { name: 'Add a page inside Projects' }))
    await waitFor(() => expect(requests('POST', '/api/v1/pages')).toHaveLength(1))
    expect(JSON.parse(requests('POST', '/api/v1/pages')[0]!.init.body as string)).toEqual({ parentId: parent.id })
    expect(await within(sidebar()).findByRole('button', { name: 'Collapse Projects' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(sidebar()).getByRole('link', { name: 'Untitled' })).toBeInTheDocument()
  })

  it('collapses and expands children', async () => {
    const parent = makePage({ title: 'Projects' })
    const child = makePage({ title: 'Website', parentId: parent.id })
    fakeBackend({ pages: [parent, child] })
    const user = userEvent.setup()
    renderApp('/', { token: 't' })
    await user.click(await screen.findByRole('button', { name: 'Expand Projects' }))
    expect(within(sidebar()).getByRole('link', { name: 'Website' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collapse Projects' }))
    expect(within(sidebar()).queryByRole('link', { name: 'Website' })).not.toBeInTheDocument()
  })

  it('moves the open page to the trash from the tree and leaves it', async () => {
    const page = makePage({ title: 'Old notes' })
    const child = makePage({ title: 'Child', parentId: page.id })
    fakeBackend({ pages: [page, child] })
    const user = userEvent.setup()
    renderApp(`/p/${child.id}`, { token: 't' })
    await screen.findByRole('textbox', { name: 'Page title' })
    await user.click(within(sidebar()).getByRole('button', { name: 'More actions for Old notes' }))
    await user.click(screen.getByRole('menuitem', { name: 'Move to trash' }))
    await waitFor(() => expect(location()).toBe('/'))
    expect(within(sidebar()).queryByRole('link', { name: 'Old notes' })).not.toBeInTheDocument()
    expect(within(sidebar()).queryByRole('link', { name: 'Child' })).not.toBeInTheDocument()
  })

  it('Phone: the menu button opens the drawer and choosing a page closes it', async () => {
    const a = makePage({ title: 'Alpha' })
    fakeBackend({ pages: [a] })
    const user = userEvent.setup()
    renderApp('/', { token: 't' })
    const menu = await screen.findByRole('button', { name: 'Open sidebar' })
    expect(sidebar()).not.toHaveClass('open')
    await user.click(menu)
    expect(sidebar()).toHaveClass('open')
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    await user.click(await within(sidebar()).findByRole('link', { name: 'Alpha' }))
    expect(sidebar()).not.toHaveClass('open')
    expect(location()).toBe(`/p/${a.id}`)
  })
})

describe('Search from clients', () => {
  it('Open from search: waits ~300 ms after typing, then selecting a result opens the page', async () => {
    const page = makePage({ title: 'Quarterly Roadmap' })
    makePage()
    const { requests } = fakeBackend({ pages: [page, makePage({ title: 'Groceries' })] })
    const user = userEvent.setup()
    renderApp('/', { token: 't' })
    await user.click(await within(sidebar()).findByRole('button', { name: /Search/ }))
    const input = screen.getByRole('combobox', { name: 'Search pages' })
    await user.type(input, 'road')
    expect(requests('GET', '/search')).toHaveLength(0)
    const option = await screen.findByRole('option', { name: /Quarterly Roadmap/ })
    // One request for the final query, not one per keystroke.
    expect(requests('GET', '/search').map((r) => r.url.searchParams.get('q'))).toEqual(['road'])
    await user.click(option)
    await waitFor(() => expect(location()).toBe(`/p/${page.id}`))
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument()
  })

  it('Match on block text: an untitled page shows as "Untitled" with a highlighted snippet', async () => {
    const page = makePage({ title: '' })
    fakeBackend({ pages: [page], blocks: { [page.id]: [createBlock('paragraph', 'remember to buy oat milk')] } })
    const user = userEvent.setup()
    renderApp('/', { token: 't' })
    await screen.findByRole('button', { name: 'Account menu' })
    await user.keyboard('{Control>}k{/Control}')
    await user.type(screen.getByRole('combobox', { name: 'Search pages' }), 'oat milk')
    const option = await screen.findByRole('option', { name: /Untitled/ })
    expect(within(option).getByText('oat milk', { selector: 'mark' })).toBeInTheDocument()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(location()).toBe(`/p/${page.id}`))
  })

  it('shows a no-results message', async () => {
    fakeBackend({ pages: [makePage({ title: 'Groceries' })] })
    const user = userEvent.setup()
    renderApp('/', { token: 't' })
    await user.click(await within(sidebar()).findByRole('button', { name: /Search/ }))
    await user.type(screen.getByRole('combobox', { name: 'Search pages' }), '100%')
    expect(await screen.findByText('No results for “100%”')).toBeInTheDocument()
  })
})

describe('Trash in clients', () => {
  it('Confirm before delete forever: asks first, and deletes only after confirming', async () => {
    const page = makePage({ title: 'Old', trashedAt: '2026-02-01T00:00:00.000Z' } as never)
    const { requests } = fakeBackend({ pages: [page] })
    const user = userEvent.setup()
    renderApp('/trash', { token: 't' })

    await user.click(await screen.findByRole('button', { name: 'Delete Old forever' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete “Old” forever?' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(requests('DELETE', '/trash/')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Delete Old forever' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete forever' }))
    await waitFor(() => expect(requests('DELETE', '/trash/')).toHaveLength(1))
    expect(await screen.findByText('The trash is empty.')).toBeInTheDocument()
  })

  it('Restore brings the page back into the tree', async () => {
    const page = makePage({ title: 'Recovered', trashedAt: '2026-02-01T00:00:00.000Z' } as never)
    fakeBackend({ pages: [page] })
    const user = userEvent.setup()
    renderApp('/trash', { token: 't' })
    await user.click(await screen.findByRole('button', { name: 'Restore Recovered' }))
    expect(await within(sidebar()).findByRole('link', { name: 'Recovered' })).toBeInTheDocument()
  })
})
