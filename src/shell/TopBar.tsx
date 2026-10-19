import type { ReactNode } from 'react'
import { MenuIcon } from '../ui/Icons'
import { useShell } from './ShellContext'

/** Header of the main area: drawer button (phones), breadcrumb, right-side status/actions. */
export function TopBar({ children, end }: { children?: ReactNode; end?: ReactNode }) {
  const { openDrawer, drawerOpen } = useShell()
  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-btn menu-btn"
        aria-label="Open sidebar"
        aria-controls="sidebar"
        aria-expanded={drawerOpen}
        onClick={openDrawer}
      >
        <MenuIcon />
      </button>
      <div className="topbar-crumbs">{children}</div>
      {end && <div className="topbar-end">{end}</div>}
    </header>
  )
}
