import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { returnPath } from '../lib/returnPath'
import { apiError, json, makePage, mockFetch, renderApp, USER } from '../test/helpers'
import { TOKEN_KEY } from './session'

const PAGE = makePage({ title: 'Quarterly Roadmap' })

function backend({ token = 'good-token' } = {}) {
  return mockFetch((req) => {
    if (req.path === '/api/v1/auth/login') {
      const body = req.body as { password: string }
      return body.password === 'correct-horse'
        ? json(200, { token, user: USER })
        : apiError(401, 'invalid_credentials', 'Invalid email or password.')
    }
    if (req.headers.Authorization !== `Bearer ${token}`) return apiError(401, 'unauthorized', 'Unauthorized')
    if (req.path === '/api/v1/auth/me') return json(200, USER)
    if (req.path === '/api/v1/pages') return json(200, { pages: [PAGE] })
    if (req.path === `/api/v1/pages/${PAGE.id}`) return json(200, { ...PAGE, blocks: [] })
    return undefined
  })
}

describe('Addressable pages', () => {
  it('Deep link while signed out: shows sign-in, then the requested page after signing in', async () => {
    backend()
    const user = userEvent.setup()
    renderApp(`/p/${PAGE.id}`)

    expect(await screen.findByRole('heading', { name: 'Sign in to remai' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('textbox', { name: 'Page title' })).toHaveValue('Quarterly Roadmap')
    expect(screen.getByTestId('location')).toHaveTextContent(`/p/${PAGE.id}`)
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('good-token')
  })

  it('Wrong credentials keep the user on the sign-in screen with the server message', async () => {
    backend()
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it('Expired session: a 401 clears the token and shows the sign-in screen', async () => {
    backend({ token: 'fresh-token' }) // the stored token is no longer accepted
    renderApp(`/p/${PAGE.id}`, { token: 'expired-token' })
    expect(await screen.findByRole('heading', { name: 'Sign in to remai' })).toBeInTheDocument()
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('Sign out on a client: deletes the token and shows sign-in; reopening still shows sign-in', async () => {
    const fetch = backend()
    const user = userEvent.setup()
    const { unmount } = renderApp('/', { token: 'good-token' })

    await user.click(await screen.findByRole('button', { name: 'Account menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in to remai' })).toBeInTheDocument()
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull()

    const callsAfterSignOut = fetch.mock.calls.length
    unmount()
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Sign in to remai' })).toBeInTheDocument()
    // The discarded token is never sent again.
    await waitFor(() => expect(fetch.mock.calls.length).toBe(callsAfterSignOut))
  })

  it('Successful registration signs in and opens the app', async () => {
    mockFetch((req) => {
      if (req.path === '/api/v1/auth/register') return json(201, { token: 't', user: USER })
      if (req.path === '/api/v1/pages') return json(200, { pages: [] })
      if (req.path === '/api/v1/auth/me') return json(200, USER)
      return undefined
    })
    const user = userEvent.setup()
    renderApp('/register')
    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Password must be 8–72 characters.')

    await user.type(screen.getByLabelText('Password'), '-enough')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'No pages yet' })).toBeInTheDocument()
  })
})

describe('returnPath', () => {
  it('returns to the deep link, keeping search and hash', () => {
    expect(returnPath({ from: { pathname: '/p/abc', search: '?x=1', hash: '#h' } })).toBe('/p/abc?x=1#h')
  })
  it('falls back to home for missing, auth or protocol-relative paths', () => {
    expect(returnPath(null)).toBe('/')
    expect(returnPath({ from: { pathname: '/login', search: '', hash: '' } })).toBe('/')
    expect(returnPath({ from: { pathname: '//evil.example', search: '', hash: '' } })).toBe('/')
    expect(returnPath({ from: { pathname: 'https://evil.example', search: '', hash: '' } })).toBe('/')
  })
})
