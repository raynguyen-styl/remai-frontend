import { useEffect, useState } from 'react'
import { errorMessage, isApiError } from '../api/client'
import type { TrashedPage } from '../api/types'
import { displayTitle } from '../lib/title'
import { usePages } from '../pages/pages'
import { useApi } from '../session/session'
import { TopBar } from '../shell/TopBar'
import { PageIcon, RestoreIcon, TrashIcon } from '../ui/Icons'
import { ConfirmDialog } from '../ui/Modal'
import { useDocumentTitle } from '../ui/useDocumentTitle'

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; items: TrashedPage[] }

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Spec page-trash "Trash in clients": Restore, and Delete forever after confirmation. */
export function TrashView() {
  const api = useApi()
  const { reload, showNotice } = usePages()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [confirming, setConfirming] = useState<TrashedPage | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useDocumentTitle('Trash')

  useEffect(() => {
    let cancelled = false
    api.listTrash().then(
      (items) => {
        if (!cancelled) setState({ kind: 'ready', items })
      },
      (err: unknown) => {
        if (cancelled || (isApiError(err) && err.status === 401)) return
        setState({ kind: 'error', message: errorMessage(err, "Couldn't load the trash.") })
      },
    )
    return () => {
      cancelled = true
    }
  }, [api, attempt])

  function removeItem(id: string) {
    setState((s) => (s.kind === 'ready' ? { kind: 'ready', items: s.items.filter((i) => i.id !== id) } : s))
  }

  async function restore(item: TrashedPage) {
    setBusyId(item.id)
    try {
      await api.restorePage(item.id)
      removeItem(item.id)
      await reload()
      showNotice(`Restored “${displayTitle(item.title)}”`)
    } catch (err) {
      showNotice(errorMessage(err, "Couldn't restore the page."))
    } finally {
      setBusyId(null)
    }
  }

  async function deleteForever(item: TrashedPage) {
    setConfirming(null)
    setBusyId(item.id)
    try {
      await api.deleteForever(item.id)
      removeItem(item.id)
      showNotice(`Deleted “${displayTitle(item.title)}” forever`)
    } catch (err) {
      showNotice(errorMessage(err, "Couldn't delete the page."))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <TopBar>
        <span className="crumb">Trash</span>
      </TopBar>
      <div className="trash">
        <h1 className="view-title">Trash</h1>
        <p className="view-sub">Restore pages you moved to the trash, or delete them forever.</p>

        {state.kind === 'loading' && <p className="muted">Loading…</p>}
        {state.kind === 'error' && (
          <p className="muted" role="alert">
            {state.message}{' '}
            <button type="button" className="link-btn" onClick={() => {
              setState({ kind: 'loading' })
              setAttempt((a) => a + 1)
            }}>
              Try again
            </button>
          </p>
        )}
        {state.kind === 'ready' && state.items.length === 0 && (
          <div className="empty-state compact">
            <div className="empty-illustration" aria-hidden="true">
              <TrashIcon width={32} height={32} />
            </div>
            <p>The trash is empty.</p>
          </div>
        )}
        {state.kind === 'ready' && state.items.length > 0 && (
          <ul className="trash-list">
            {state.items.map((item) => {
              const title = displayTitle(item.title)
              return (
                <li key={item.id} className="trash-item">
                  <span className="trash-icon" aria-hidden="true">
                    {item.icon || <PageIcon />}
                  </span>
                  <span className="trash-text">
                    <span className={`trash-title ${item.title.trim() ? '' : 'untitled'}`}>{title}</span>
                    <span className="trash-date">Trashed {dateFormat.format(new Date(item.trashedAt))}</span>
                  </span>
                  <span className="trash-actions">
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={busyId === item.id}
                      aria-label={`Restore ${title}`}
                      onClick={() => void restore(item)}
                    >
                      <RestoreIcon /> <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger-ghost"
                      disabled={busyId === item.id}
                      aria-label={`Delete ${title} forever`}
                      onClick={() => setConfirming(item)}
                    >
                      <TrashIcon /> <span>Delete forever</span>
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Delete “${displayTitle(confirming.title)}” forever?`}
          message="This page and its subpages will be permanently deleted. This can’t be undone."
          confirmLabel="Delete forever"
          danger
          onCancel={() => setConfirming(null)}
          onConfirm={() => void deleteForever(confirming)}
        />
      )}
    </>
  )
}
