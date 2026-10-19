import { describe, expect, it, vi } from 'vitest'
import { API, apiError, json, mockFetch } from '../test/helpers'
import { ApiError, createApiClient } from './client'

function client(token: string | null = 'tok-123') {
  const onUnauthorized = vi.fn()
  const api = createApiClient({ baseUrl: API, getToken: () => token, onUnauthorized })
  return { api, onUnauthorized }
}

describe('API client', () => {
  it('sends the bearer token on authenticated requests', async () => {
    const fetch = mockFetch(() => json(200, { pages: [] }))
    const { api } = client()
    await api.listPages()
    const [url, init] = fetch.mock.calls[0]!
    expect(String(url)).toBe(`${API}/api/v1/pages`)
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok-123')
  })

  it('does not send a token to login/register', async () => {
    const fetch = mockFetch(() => json(200, { token: 't', user: {} }))
    const { api } = client()
    await api.login({ email: 'a@b.co', password: 'x' })
    const headers = fetch.mock.calls[0]![1]!.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(fetch.mock.calls[0]![1]!.body).toBe(JSON.stringify({ email: 'a@b.co', password: 'x' }))
  })

  it('parses the error envelope into an ApiError', async () => {
    mockFetch(() => apiError(400, 'validation_error', 'title must be at most 200 characters'))
    const { api } = client()
    const err = await api.updatePage('p1', { title: 'x' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 400, code: 'validation_error', message: 'title must be at most 200 characters' })
  })

  it('falls back to a generic message when the error body is not the envelope', async () => {
    mockFetch(() => ({ status: 502, body: 'Bad gateway' }))
    const { api } = client()
    await expect(api.listPages()).rejects.toMatchObject({ status: 502, code: 'internal_error' })
  })

  it('Expired session: a 401 on an authenticated request calls the sign-out hook', async () => {
    mockFetch(() => apiError(401, 'unauthorized', 'token expired'))
    const { api, onUnauthorized } = client()
    await expect(api.listPages()).rejects.toMatchObject({ status: 401, code: 'unauthorized' })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('Wrong credentials do not sign out: login 401 is just an error', async () => {
    mockFetch(() => apiError(401, 'invalid_credentials', 'Invalid email or password.'))
    const { api, onUnauthorized } = client(null)
    await expect(api.login({ email: 'a@b.co', password: 'nope' })).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: 'Invalid email or password.',
    })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('never sends a request for a protected endpoint after sign-out', async () => {
    const fetch = mockFetch(() => json(200, { pages: [] }))
    const { api } = client(null)
    await expect(api.listPages()).rejects.toMatchObject({ status: 401 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps network failures to network_error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    const { api } = client()
    await expect(api.listPages()).rejects.toMatchObject({ status: 0, code: 'network_error' })
  })

  it('returns undefined for 204 responses', async () => {
    mockFetch(() => ({ status: 204 }))
    const { api } = client()
    await expect(api.trashPage('p1')).resolves.toBeUndefined()
  })

  it('saves blocks with only contract fields, and encodes search queries', async () => {
    const fetch = mockFetch((req) =>
      req.path.endsWith('/blocks') ? json(200, { blocks: [], updatedAt: 'x' }) : json(200, { results: [] }),
    )
    const { api } = client()
    await api.saveBlocks('p1', [{ id: 'b1', type: 'todo', text: 'Ship', checked: true, extra: 1 } as never])
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      blocks: [{ id: 'b1', type: 'todo', text: 'Ship', checked: true }],
    })
    expect(fetch.mock.calls[0]![1]!.method).toBe('PUT')
    await api.search('100% & more')
    expect(String(fetch.mock.calls[1]![0])).toBe(`${API}/api/v1/search?q=100%25%20%26%20more`)
  })
})
