import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { usePages } from '../pages/pages'
import { CloseIcon } from '../ui/Icons'
import { SearchDialog } from './SearchDialog'
import { ShellContext } from './ShellContext'
import { Sidebar } from './Sidebar'

/**
 * Sidebar + main area. At >= 768 px the sidebar is persistent; below that it is an
 * overlay drawer opened from the top bar, closed on navigation (spec "Responsive layout").
 */
export function AppShell() {
  const location = useLocation()
  const { notice, dismissNotice } = usePages()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [lastKey, setLastKey] = useState(location.key)

  // Choosing a page (any navigation) closes the drawer.
  if (location.key !== lastKey) {
    setLastKey(location.key)
    setDrawerOpen(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      } else if (e.key === 'Escape') {
        setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(dismissNotice, 4000)
    return () => clearTimeout(t)
  }, [notice, dismissNotice])

  const shell = useMemo(
    () => ({ drawerOpen, openDrawer: () => setDrawerOpen(true), openSearch: () => setSearchOpen(true) }),
    [drawerOpen],
  )

  return (
    <ShellContext value={shell}>
      <div className={`shell ${drawerOpen ? 'drawer-open' : ''}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Sidebar
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSearch={() => {
            setDrawerOpen(false)
            setSearchOpen(true)
          }}
        />
        {drawerOpen && <div className="drawer-backdrop" aria-hidden="true" onClick={() => setDrawerOpen(false)} />}
        <main id="main" className="main" tabIndex={-1}>
          <Outlet />
        </main>
        {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
        <div className="toast-region" role="status" aria-live="polite">
          {notice && (
            <div className="toast">
              <span>{notice}</span>
              <button type="button" className="icon-btn" aria-label="Dismiss" onClick={dismissNotice}>
                <CloseIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </ShellContext>
  )
}
