// In-memory stand-in for remai-backend, just enough for component tests.
import type { Block, Page, SearchResult, TrashedPage } from '../api/types'
import { apiError, json, makePage, mockFetch, USER, type MockRequest, type MockResponse } from './helpers'

export interface FakeState {
  pages: (Page & { trashedAt?: string })[]
  blocks: Record<string, Block[]>
  /** Force the next N block saves to fail with 500. */
  failSaves: number
}

export function fakeBackend(initial: Partial<FakeState> = {}) {
  const state: FakeState = { pages: [], blocks: {}, failSaves: 0, ...initial }
  const live = () => state.pages.filter((p) => !p.trashedAt)
  const find = (id: string) => live().find((p) => p.id === id)
  const strip = ({ trashedAt: _t, ...p }: Page & { trashedAt?: string }): Page => p

  const handle = (req: MockRequest): MockResponse | undefined => {
    const { method, path } = req
    if (!req.headers.Authorization) return apiError(401, 'unauthorized')
    if (path === '/api/v1/auth/me') return json(200, USER)

    if (path === '/api/v1/pages' && method === 'GET') return json(200, { pages: live().map(strip) })
    if (path === '/api/v1/pages' && method === 'POST') {
      const body = req.body as { parentId?: string | null; title?: string }
      const page = makePage({ title: body.title ?? '', parentId: body.parentId ?? null })
      state.pages.push(page)
      return json(201, page)
    }

    const pageMatch = /^\/api\/v1\/pages\/([^/]+)(\/blocks)?$/.exec(path)
    if (pageMatch) {
      const page = find(pageMatch[1]!)
      if (!page) return apiError(404, 'not_found', 'Page not found.')
      if (pageMatch[2] && method === 'PUT') {
        if (state.failSaves > 0) {
          state.failSaves -= 1
          return apiError(500, 'internal_error', 'Something went wrong.')
        }
        state.blocks[page.id] = (req.body as { blocks: Block[] }).blocks
        page.updatedAt = new Date().toISOString()
        return json(200, { blocks: state.blocks[page.id], updatedAt: page.updatedAt })
      }
      if (method === 'GET') return json(200, { ...strip(page), blocks: state.blocks[page.id] ?? [] })
      if (method === 'PATCH') {
        Object.assign(page, req.body as object, { updatedAt: new Date().toISOString() })
        return json(200, strip(page))
      }
      if (method === 'DELETE') {
        const ts = new Date().toISOString()
        const ids = new Set([page.id])
        for (const p of state.pages) if (p.parentId && ids.has(p.parentId) && !p.trashedAt) ids.add(p.id)
        for (const p of state.pages) if (ids.has(p.id)) p.trashedAt = ts
        return { status: 204 }
      }
    }

    if (path === '/api/v1/search') {
      const q = (req.url.searchParams.get('q') ?? '').toLowerCase()
      const results: SearchResult[] = []
      for (const p of live()) {
        const hit = (state.blocks[p.id] ?? []).find((b) => b.text.toLowerCase().includes(q))
        if (p.title.toLowerCase().includes(q) || hit) {
          results.push({ id: p.id, parentId: p.parentId, title: p.title, icon: p.icon, snippet: hit?.text ?? p.title })
        }
      }
      return json(200, { results })
    }

    if (path === '/api/v1/trash') {
      const items: TrashedPage[] = state.pages
        .filter((p) => p.trashedAt && !state.pages.find((q) => q.id === p.parentId && q.trashedAt))
        .map((p) => ({ id: p.id, title: p.title, icon: p.icon, trashedAt: p.trashedAt! }))
      return json(200, { pages: items })
    }
    const restore = /^\/api\/v1\/trash\/([^/]+)\/restore$/.exec(path)
    if (restore && method === 'POST') {
      const page = state.pages.find((p) => p.id === restore[1] && p.trashedAt)
      if (!page) return apiError(404, 'not_found')
      const ts = page.trashedAt
      for (const p of state.pages) if (p.trashedAt === ts) delete p.trashedAt
      return json(200, strip(page))
    }
    const hard = /^\/api\/v1\/trash\/([^/]+)$/.exec(path)
    if (hard && method === 'DELETE') {
      state.pages = state.pages.filter((p) => p.id !== hard[1])
      return { status: 204 }
    }
    return undefined
  }

  const fetch = mockFetch(handle)
  const requests = (method: string, pathPart: string) =>
    fetch.mock.calls
      .map(([url, init]) => ({ url: new URL(String(url)), init: init as RequestInit }))
      .filter((c) => (c.init?.method ?? 'GET') === method && c.url.pathname.includes(pathPart))
  return { state, fetch, requests }
}
