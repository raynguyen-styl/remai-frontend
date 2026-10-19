import { createContext, use } from 'react'
import type { Page } from '../api/types'

export type LoadStatus = 'loading' | 'ready' | 'error'

export interface PagesValue {
  pages: Page[]
  status: LoadStatus
  reload: () => Promise<void>
  /** Creates a page (optionally inside `parentId`) and opens it. */
  createPage: (parentId?: string | null) => Promise<Page | null>
  /** Moves a page and its subpages to the trash; leaves the page if it was open. */
  trashPage: (id: string) => Promise<void>
  /** Optimistic local update (title/icon typed in the header). */
  patchLocal: (id: string, patch: Partial<Pick<Page, 'title' | 'icon' | 'updatedAt'>>) => void
  notice: string | null
  showNotice: (message: string) => void
  dismissNotice: () => void
}

export const PagesContext = createContext<PagesValue | null>(null)

export function usePages(): PagesValue {
  const ctx = use(PagesContext)
  if (!ctx) throw new Error('usePages must be used inside <PagesProvider>')
  return ctx
}
