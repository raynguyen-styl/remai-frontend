import { createContext, use } from 'react'

export interface ShellValue {
  drawerOpen: boolean
  openDrawer: () => void
  openSearch: () => void
}

export const ShellContext = createContext<ShellValue>({
  drawerOpen: false,
  openDrawer: () => {},
  openSearch: () => {},
})

export function useShell(): ShellValue {
  return use(ShellContext)
}
