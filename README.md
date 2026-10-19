# remai-frontend

Web client for **remai**, a Notion-like notes app (MVP). React 19, Vite, TypeScript, react-router and plain CSS.

Behaviour is specified in [`../remai-central-specs`](../remai-central-specs) (OpenSpec change `add-notion-core`). This repo has no copies of the specs. See [AGENTS.md](AGENTS.md) for where each spec lives.

Capabilities implemented here: `web-client`, plus the client-facing parts of `user-auth`, `page-management`, `page-content`, `page-search` and `page-trash`.

## Requirements

- Node.js 22.22+ or 24.x (developed on Node 24.11, npm 11)
- A running [remai-backend](../remai-backend) for real use. Tests don't need it, because they mock `fetch`.

## Setup

```sh
npm install
# optional: point at a backend that isn't on the default URL
echo "VITE_API_URL=http://localhost:8080" > .env.local
npm run dev            # http://localhost:5173
```

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Base URL of remai-backend, without a trailing slash. Read at build time, as with all `VITE_*` variables. |

`.env.example` documents the variable. `.env` and `.env.*` files are git-ignored, except `.env.example`. The backend's CORS allowlist (`REMAI_CORS_ORIGINS`) must include the origin the app is served from. Its default is `http://localhost:5173`, which is why the dev server uses `strictPort` on 5173.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | `tsc -b` type-check, then `vite build` into `dist/` |
| `npm run preview` | Serves the production build |
| `npm test` | Vitest (jsdom + Testing Library), single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | `tsc -b --noEmit`, then ESLint (typescript-eslint, react-hooks, react-refresh) |

## Layout

```
src/
  api/         wire types (mirror docs/api/openapi.yaml) and the fetch client
  lib/         pure logic: block rules, slash filtering, tree, autosave controller, helpers
  session/     token + user context, RequireAuth / PublicOnly route guards
  pages/       page-tree context (list, create, trash, optimistic title/icon)
  shell/       app shell: sidebar + tree, drawer, top bar, search dialog
  editor/      block editor (textarea per block) and slash menu
  views/       routes: sign-in/up, home, page, trash
  ui/          small shared components (modal, menu, emoji picker, icons, auto-growing textarea)
  test/        test setup, fetch mock and in-memory fake backend
```

Routes: `/login`, `/register`, `/` (home), `/p/:pageId`, `/trash`.

## Notes

- **Autosave** (design D10): 800 ms debounce, one save in flight per page, and another save follows if you edit during one. Pending changes are flushed when you leave a page, when the tab is hidden, and before sign-out or trashing. The status reads `Saving…`, `Saved` or `Couldn't save – retrying` (backoff 2 s → 30 s). Content goes through `PUT /pages/{id}/blocks` and title/icon through `PATCH`.
- **Security**: the session token lives in `localStorage` (see design Risks). User content is only ever rendered as text, and ESLint forbids `dangerouslySetInnerHTML`. The client never sends a token after sign-out, and any 401 from an authenticated call signs out.
- **Layout**: one breakpoint at 768 px. Below it the sidebar becomes an overlay drawer, and the page has no horizontal scroll down to 360 px.
