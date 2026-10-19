// Build the sidebar tree from the flat GET /pages list (ordered by createdAt asc).
import type { Page } from '../api/types'

export interface TreeNode {
  page: Page
  children: TreeNode[]
}

/**
 * Children keep the input order (oldest first). A page whose parent is not in
 * the list is shown at the top level so it can never disappear from the tree.
 */
export function buildTree(pages: readonly Page[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>()
  for (const page of pages) nodes.set(page.id, { page, children: [] })

  const roots: TreeNode[] = []
  for (const page of pages) {
    const node = nodes.get(page.id)!
    const parent = page.parentId ? nodes.get(page.parentId) : undefined
    if (parent && parent !== node && !isAncestor(nodes, page.id, page.parentId)) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

/** Defensive cycle guard: true if `id` is already an ancestor of `parentId`. */
function isAncestor(nodes: Map<string, TreeNode>, id: string, parentId: string | null): boolean {
  const seen = new Set<string>()
  let cur = parentId
  while (cur && !seen.has(cur)) {
    if (cur === id) return true
    seen.add(cur)
    cur = nodes.get(cur)?.page.parentId ?? null
  }
  return false
}

/** Ancestors of a page, top-level first, excluding the page itself. */
export function ancestorsOf(pages: readonly Page[], id: string): Page[] {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const chain: Page[] = []
  const seen = new Set<string>([id])
  let cur = byId.get(id)?.parentId ?? null
  while (cur && !seen.has(cur)) {
    const page = byId.get(cur)
    if (!page) break
    chain.unshift(page)
    seen.add(cur)
    cur = page.parentId
  }
  return chain
}

/** The page and every descendant id. */
export function subtreeIds(pages: readonly Page[], id: string): Set<string> {
  const ids = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const p of pages) {
      if (p.parentId && ids.has(p.parentId) && !ids.has(p.id)) {
        ids.add(p.id)
        grew = true
      }
    }
  }
  return ids
}
