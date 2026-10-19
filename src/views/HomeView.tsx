import { Link } from 'react-router'
import { displayTitle } from '../lib/title'
import { usePages } from '../pages/pages'
import { useSession } from '../session/session'
import { TopBar } from '../shell/TopBar'
import { PageIcon, PlusIcon } from '../ui/Icons'
import { useDocumentTitle } from '../ui/useDocumentTitle'

export function HomeView() {
  const { user } = useSession()
  const { pages, status, createPage } = usePages()
  useDocumentTitle('Home')

  const recent = [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)

  return (
    <>
      <TopBar>
        <span className="crumb">Home</span>
      </TopBar>
      <div className="home">
        {status === 'ready' && pages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-illustration" aria-hidden="true">
              <PageIcon width={40} height={40} />
            </div>
            <h1>No pages yet</h1>
            <p>Create your first page to start writing.</p>
            <button type="button" className="btn btn-primary" onClick={() => void createPage(null)}>
              <PlusIcon /> New page
            </button>
          </div>
        ) : (
          <>
            <h1 className="home-title">{user ? `Welcome back, ${user.name}` : 'Welcome back'}</h1>
            <p className="home-sub">Pick a page from the sidebar, or start something new.</p>
            <button type="button" className="btn btn-primary" onClick={() => void createPage(null)}>
              <PlusIcon /> New page
            </button>
            {recent.length > 0 && (
              <section className="recent" aria-labelledby="recent-heading">
                <h2 id="recent-heading">Recently edited</h2>
                <ul className="recent-list">
                  {recent.map((p) => (
                    <li key={p.id}>
                      <Link to={`/p/${p.id}`} className="recent-card">
                        <span className="recent-icon" aria-hidden="true">
                          {p.icon || <PageIcon width={20} height={20} />}
                        </span>
                        <span className={`recent-title ${p.title.trim() ? '' : 'untitled'}`}>{displayTitle(p.title)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
