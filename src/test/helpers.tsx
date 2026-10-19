import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { vi } from 'vitest'
import type { Page } from '../api/types'
import { AppRoutes } from '../App'
import { TOKEN_KEY } from '../session/session'
import { SessionProvider } from '../session/SessionProvider'

export const API = 'http://api.test'

export interface MockRequest {
  method: string
  path: string
  url: URL
  body: unknown
  headers: Record<string, string>
}

export interface MockResponse {
  status: number
  body?: unknown
}

export type Handler = (req: MockRequest) => MockResponse | undefined | Promise<MockResponse | undefined>

/** Stub global fetch. Unhandled requests get a 404 envelope so tests fail loudly. */
export function mockFetch(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const req: MockRequest = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      url,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    }
    const res = (await handler(req)) ?? {
      status: 404,
      body: { error: { code: 'not_found', message: `unmocked ${req.method} ${req.path}` } },
    }
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export function json(status: number, body?: unknown): MockResponse {
  return { status, body }
}

export function apiError(status: number, code: string, message = code): MockResponse {
  return { status, body: { error: { code, message } } }
}

let seq = 0
export function makePage(overrides: Partial<Page> = {}): Page {
  seq += 1
  const ts = new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString()
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    parentId: null,
    title: `Page ${seq}`,
    icon: '',
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

export const USER = { id: 'u1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-01-01T00:00:00.000Z' }

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

/** Render the whole app at `path`, optionally signed in. */
export function renderApp(path: string, { token }: { token?: string } = {}) {
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider apiUrl={API}>
        <AppRoutes />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  )
}
