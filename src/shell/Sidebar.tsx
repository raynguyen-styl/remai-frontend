import { useCallback, useMemo, useState } from 'react'
import { NavLink, useMatch, useNavigate } from 'react-router'
import { usePages } from '../pages/pages'
import { flushAllSaves } from '../lib/saveRegistry'
import { readStorage, writeStorage } from '../lib/storage'
import { ancestorsOf, buildTree } from '../lib/tree'
import { useSession } from '../session/session'
import { CloseIcon, PlusIcon, SearchIcon, SignOutIcon, TrashIcon } from '../ui/Icons'
import { Menu } from '../ui/Menu'
import { PageTree } from './PageTree'

const EXPANDED_KEY = 'remai.sidebar.expanded'

function loadExpanded(): Set<string> {
  try {
    const raw = readStorage(EXPANDED_KEY)
    const ids: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

interface Props {
  open: boolean
  onClose: () => void
  onSearch: () => void
}

export function Sidebar({ open, onClose, onSearch }: Props) {
  const { user, signOut } = useSession()
  const { pages, status, createPage, trashPage, reload } = usePages()
  const navigate = useNavigate()
  const activeId = useMatch('/p/:pageId')?.params.pageId
  const [expanded, setExpanded] = useState<Set<string>>(loadExpanded)
  const [revealedFor, setRevealedFor] = useState<string | undefined>(undefined)

  const tree = useMemo(() => buildTree(pages), [pages])

  const updateExpanded = useCallback((fn: (prev: Set<string>) => Set<string>) => {
    setExpanded((prev) => {
      const next = fn(prev)
      writeStorage(EXPANDED_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  // Reveal the open page: expand its ancestors once per navigation (render-time state adjustment).
  if (activeId && pages.length > 0 && revealedFor !== activeId) {
    setRevealedFor(activeId)
    const ancestors = ancestorsOf(pages, activeId)
    if (ancestors.some((a) => !expanded.has(a.id))) {
      setExpanded(new Set([...expanded, ...ancestors.map((a) => a.id)]))
    }
  }

  const onToggle = useCallback(
    (id: string) =>
      updateExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    [updateExpanded],
  )

  const onAddChild = useCallback(
    (id: string) => {
      updateExpanded((prev) => new Set(prev).add(id))
      void createPage(id)
    },
    [createPage, updateExpanded],
  )

  const onTrash = useCallback((id: string) => void trashPage(id), [trashPage])

  async function onSignOut() {
    await flushAllSaves()
    navigate('/login', { replace: true })
    signOut()
  }

  const displayName = user?.name || 'remai'

  return (
    <aside id="sidebar" className={`sidebar ${open ? 'open' : ''}`} aria-label="Sidebar">
      <div className="sidebar-top">
        <Menu
          label="Account menu"
          triggerClassName="workspace-btn"
          trigger={
            <>
              <span className="avatar" aria-hidden="true">
                {(user?.name || 'r').slice(0, 1).toUpperCase()}
              </span>
              <span className="workspace-name">{displayName}&rsquo;s remai</span>
            </>
          }
          header={user ? <div className="menu-header">{user.email}</div> : null}
          items={[{ label: 'Sign out', icon: <SignOutIcon />, onSelect: () => void onSignOut() }]}
        />
        <button type="button" className="icon-btn drawer-close" aria-label="Close sidebar" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <button type="button" className="side-item" onClick={onSearch}>
        <SearchIcon />
        <span>Search</span>
        <kbd className="kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <nav className="sidebar-pages" aria-label="Pages">
        <div className="side-section">
          <span>Pages</span>
          <button type="button" className="icon-btn" aria-label="Add a page" onClick={() => void createPage(null)}>
            <PlusIcon />
          </button>
        </div>
        {status === 'loading' && <p className="side-hint">Loading…</p>}
        {status === 'error' && (
          <p className="side-hint">
            Couldn&rsquo;t load pages.{' '}
            <button type="button" className="link-btn" onClick={() => void reload()}>
              Retry
            </button>
          </p>
        )}
        {status === 'ready' && pages.length === 0 && <p className="side-hint">No pages yet</p>}
        <PageTree
          nodes={tree}
          activeId={activeId}
          expanded={expanded}
          onToggle={onToggle}
          onAddChild={onAddChild}
          onTrash={onTrash}
        />
        <button type="button" className="side-item muted" onClick={() => void createPage(null)}>
          <PlusIcon />
          <span>New page</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <NavLink to="/trash" className="side-item">
          <TrashIcon />
          <span>Trash</span>
        </NavLink>
      </div>
    </aside>
  )
}
