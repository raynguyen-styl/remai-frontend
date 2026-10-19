import type {
  AuthResponse,
  Block,
  CreatePageInput,
  ErrorCode,
  Page,
  PageWithBlocks,
  SaveBlocksResponse,
  SearchResult,
  TrashedPage,
  UpdatePageInput,
  User,
} from './types'

/** Every non-2xx response (and network failure) surfaces as an ApiError. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode | string

  constructor(status: number, code: ErrorCode | string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

/** A short, human message for any thrown value. Never includes response internals. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isApiError(err) && err.message) return err.message
  return fallback
}

export interface ApiClientOptions {
  baseUrl: string
  /** Read at request time so a signed-out client never sends a discarded token. */
  getToken: () => string | null
  /** Called when an authenticated request gets 401 (expired/invalid token). */
  onUnauthorized: () => void
  fetch?: typeof fetch
}

interface RequestOptions {
  body?: unknown
  /** Attach the bearer token (default true). Login/register pass false. */
  auth?: boolean
  signal?: AbortSignal
}

const GENERIC_MESSAGES: Record<number, string> = {
  400: 'The request was not valid.',
  401: 'Your session has expired. Please sign in again.',
  404: 'Not found.',
  409: 'That already exists.',
  413: 'This page is too large to save.',
}

async function parseError(res: Response): Promise<ApiError> {
  let code: string = res.status >= 500 ? 'internal_error' : 'http_error'
  let message = GENERIC_MESSAGES[res.status] ?? 'The server had a problem. Please try again.'
  try {
    const data: unknown = await res.json()
    const env = (data as { error?: { code?: unknown; message?: unknown } } | null)?.error
    if (env && typeof env.code === 'string') code = env.code
    if (env && typeof env.message === 'string' && env.message) message = env.message
  } catch {
    // Body was not the JSON error envelope; keep the generic message.
  }
  return new ApiError(res.status, code, message)
}

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))

  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const useAuth = opts.auth ?? true
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

    let sentToken = false
    if (useAuth) {
      const token = options.getToken()
      if (!token) {
        // Signed out: never hit the network for a protected endpoint.
        throw new ApiError(401, 'unauthorized', 'You are signed out.')
      }
      headers.Authorization = `Bearer ${token}`
      sentToken = true
    }

    let res: Response
    try {
      res = await doFetch(`${options.baseUrl}${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: opts.signal,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      throw new ApiError(0, 'network_error', "Couldn't reach the server. Check your connection.")
    }

    if (!res.ok) {
      const error = await parseError(res)
      // Only a rejected *token* signs the user out; a 401 from login is just bad credentials.
      if (res.status === 401 && sentToken) options.onUnauthorized()
      throw error
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  const enc = encodeURIComponent

  return {
    request,

    register: (input: { email: string; name: string; password: string }) =>
      request<AuthResponse>('POST', '/api/v1/auth/register', { body: input, auth: false }),
    login: (input: { email: string; password: string }) =>
      request<AuthResponse>('POST', '/api/v1/auth/login', { body: input, auth: false }),
    me: () => request<User>('GET', '/api/v1/auth/me'),

    listPages: async () => (await request<{ pages: Page[] }>('GET', '/api/v1/pages')).pages,
    createPage: (input: CreatePageInput) => request<Page>('POST', '/api/v1/pages', { body: input }),
    getPage: (id: string, signal?: AbortSignal) =>
      request<PageWithBlocks>('GET', `/api/v1/pages/${enc(id)}`, { signal }),
    updatePage: (id: string, input: UpdatePageInput) =>
      request<Page>('PATCH', `/api/v1/pages/${enc(id)}`, { body: input }),
    trashPage: (id: string) => request<void>('DELETE', `/api/v1/pages/${enc(id)}`),
    saveBlocks: (id: string, blocks: Block[]) =>
      request<SaveBlocksResponse>('PUT', `/api/v1/pages/${enc(id)}/blocks`, {
        body: { blocks: blocks.map(({ id: bid, type, text, checked }) => ({ id: bid, type, text, checked })) },
      }),

    search: async (q: string, signal?: AbortSignal) =>
      (await request<{ results: SearchResult[] }>('GET', `/api/v1/search?q=${enc(q)}`, { signal })).results,

    listTrash: async () => (await request<{ pages: TrashedPage[] }>('GET', '/api/v1/trash')).pages,
    restorePage: (id: string) => request<Page>('POST', `/api/v1/trash/${enc(id)}/restore`),
    deleteForever: (id: string) => request<void>('DELETE', `/api/v1/trash/${enc(id)}`),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
