import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { errorMessage, isApiError } from '../api/client'
import { LIMITS, type SearchResult } from '../api/types'
import { highlightParts } from '../lib/highlight'
import { displayTitle } from '../lib/title'
import { PageIcon, SearchIcon } from '../ui/Icons'
import { Modal } from '../ui/Modal'
import { useApi } from '../session/session'

/** Spec page-search "Search from clients": wait ~300 ms after the last keystroke. */
export const SEARCH_DEBOUNCE_MS = 300

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading'; query: string }
  | { kind: 'done'; query: string; results: SearchResult[] }
  | { kind: 'error'; message: string }

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, i) => (part.match ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
    </>
  )
}

export function SearchDialog({ onClose }: { onClose: () => void }) {
  const api = useApi()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ kind: 'idle' })
  const [active, setActive] = useState(0)

  const trimmed = query.trim()

  useEffect(() => {
    if (!trimmed) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setState({ kind: 'loading', query: trimmed })
      api.search(trimmed, controller.signal).then(
        (results) => {
          setState({ kind: 'done', query: trimmed, results })
          setActive(0)
        },
        (err: unknown) => {
          if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return
          if (isApiError(err) && err.status === 401) return
          setState({ kind: 'error', message: errorMessage(err, 'Search failed.') })
        },
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [api, trimmed])

  const results = state.kind === 'done' && trimmed ? state.results : []

  function open(result: SearchResult) {
    onClose()
    navigate(`/p/${result.id}`)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[active]
      if (r) open(r)
    }
  }

  const optionId = (i: number) => `${listId}-opt-${i}`

  return (
    <Modal label="Search" onClose={onClose} initialFocus={inputRef} className="search-modal">
      <div className="search-input-row">
        <SearchIcon />
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          placeholder="Search pages…"
          aria-label="Search pages"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={results.length > 0 ? optionId(active) : undefined}
          maxLength={LIMITS.searchMax}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!e.target.value.trim()) setState({ kind: 'idle' })
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <div className="search-body">
        {!trimmed && <p className="search-hint">Search titles and page content.</p>}
        {trimmed && state.kind === 'loading' && <p className="search-hint">Searching…</p>}
        {trimmed && state.kind === 'error' && (
          <p className="search-hint" role="alert">
            {state.message}
          </p>
        )}
        {trimmed && state.kind === 'done' && state.results.length === 0 && (
          <p className="search-hint">No results for &ldquo;{state.query}&rdquo;</p>
        )}
        <ul id={listId} role="listbox" aria-label="Search results" className="search-results">
          {results.map((r, i) => (
            <li
              key={r.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className={`search-result ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => open(r)}
            >
              <span className="search-result-icon" aria-hidden="true">
                {r.icon || <PageIcon />}
              </span>
              <span className="search-result-text">
                <span className={`search-result-title ${r.title.trim() ? '' : 'untitled'}`}>{displayTitle(r.title)}</span>
                {r.snippet && r.snippet !== r.title && (
                  <span className="search-result-snippet">
                    <Highlighted text={r.snippet} query={state.kind === 'done' ? state.query : ''} />
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
