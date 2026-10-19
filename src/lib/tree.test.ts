import { describe, expect, it } from 'vitest'
import { makePage } from '../test/helpers'
import { ancestorsOf, buildTree, subtreeIds } from './tree'

describe('page tree building', () => {
  it('Tree listing: B is nested under A, and A comes before C', () => {
    const a = makePage({ title: 'A' })
    const b = makePage({ title: 'B', parentId: a.id })
    const c = makePage({ title: 'C' })
    const tree = buildTree([a, b, c])
    expect(tree.map((n) => n.page.title)).toEqual(['A', 'C'])
    expect(tree[0]!.children.map((n) => n.page.title)).toEqual(['B'])
  })

  it('keeps the server order (oldest first) among siblings even when a child is listed before its parent', () => {
    const parent = makePage({ title: 'P' })
    const c1 = makePage({ title: 'c1', parentId: parent.id })
    const c2 = makePage({ title: 'c2', parentId: parent.id })
    const tree = buildTree([c1, parent, c2])
    expect(tree.map((n) => n.page.title)).toEqual(['P'])
    expect(tree[0]!.children.map((n) => n.page.title)).toEqual(['c1', 'c2'])
  })

  it('shows a page whose parent is missing at the top level', () => {
    const orphan = makePage({ parentId: '00000000-0000-4000-8000-ffffffffffff' })
    expect(buildTree([orphan]).map((n) => n.page.id)).toEqual([orphan.id])
  })

  it('never loops on a corrupt cycle', () => {
    const a = makePage()
    const b = makePage({ parentId: a.id })
    a.parentId = b.id
    expect(buildTree([a, b])).toHaveLength(2)
  })

  it('lists ancestors top-level first for the breadcrumb', () => {
    const a = makePage({ title: 'A' })
    const b = makePage({ title: 'B', parentId: a.id })
    const c = makePage({ title: 'C', parentId: b.id })
    expect(ancestorsOf([a, b, c], c.id).map((p) => p.title)).toEqual(['A', 'B'])
    expect(ancestorsOf([a, b, c], a.id)).toEqual([])
  })

  it('collects a page and all its descendants', () => {
    const a = makePage()
    const b = makePage({ parentId: a.id })
    const c = makePage({ parentId: b.id })
    const d = makePage()
    expect([...subtreeIds([a, b, c, d], a.id)].sort()).toEqual([a.id, b.id, c.id].sort())
  })
})
