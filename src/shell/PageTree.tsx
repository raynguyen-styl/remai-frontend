import { memo } from 'react'
import { Link } from 'react-router'
import { displayTitle } from '../lib/title'
import type { TreeNode } from '../lib/tree'
import { ChevronIcon, DotsIcon, PageIcon, PlusIcon, TrashIcon } from '../ui/Icons'
import { Menu } from '../ui/Menu'

interface TreeProps {
  nodes: TreeNode[]
  activeId: string | undefined
  expanded: ReadonlySet<string>
  onToggle: (id: string) => void
  onAddChild: (id: string) => void
  onTrash: (id: string) => void
  depth?: number
}

export const PageTree = memo(function PageTree({ nodes, depth = 0, ...rest }: TreeProps) {
  return (
    <ul className="tree" role={depth === 0 ? undefined : 'group'}>
      {nodes.map((node) => (
        <TreeItem key={node.page.id} node={node} depth={depth} {...rest} />
      ))}
    </ul>
  )
})

function TreeItem({
  node,
  depth,
  activeId,
  expanded,
  onToggle,
  onAddChild,
  onTrash,
}: Omit<TreeProps, 'nodes'> & { node: TreeNode; depth: number }) {
  const { page, children } = node
  const title = displayTitle(page.title)
  const isOpen = expanded.has(page.id)
  const isActive = activeId === page.id
  const hasChildren = children.length > 0

  return (
    <li>
      <div className={`tree-row ${isActive ? 'active' : ''}`} style={{ paddingLeft: 4 + depth * 14 }}>
        {hasChildren ? (
          <button
            type="button"
            className="icon-btn tree-toggle"
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
            aria-expanded={isOpen}
            onClick={() => onToggle(page.id)}
          >
            <ChevronIcon className={isOpen ? 'rot90' : undefined} />
          </button>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <Link to={`/p/${page.id}`} className="tree-link" aria-current={isActive ? 'page' : undefined}>
          <span className="tree-icon" aria-hidden="true">
            {page.icon || <PageIcon />}
          </span>
          <span className={`tree-title ${page.title.trim() ? '' : 'untitled'}`}>{title}</span>
        </Link>
        <span className="tree-actions">
          <Menu
            label={`More actions for ${title}`}
            trigger={<DotsIcon />}
            triggerClassName="icon-btn"
            align="end"
            items={[{ label: 'Move to trash', icon: <TrashIcon />, onSelect: () => onTrash(page.id), danger: true }]}
          />
          <button type="button" className="icon-btn" aria-label={`Add a page inside ${title}`} onClick={() => onAddChild(page.id)}>
            <PlusIcon />
          </button>
        </span>
      </div>
      {hasChildren && isOpen && (
        <PageTree
          nodes={children}
          depth={depth + 1}
          activeId={activeId}
          expanded={expanded}
          onToggle={onToggle}
          onAddChild={onAddChild}
          onTrash={onTrash}
        />
      )}
    </li>
  )
}
