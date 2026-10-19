# AGENTS.md — remai-frontend

Guidance for coding agents and contributors working in this repo.

## Where the specs live

The specs are normative and live in the sibling repo `../remai-central-specs`. Don't copy them here.

- `openspec/changes/archive/2026-10-19-add-notion-core/design.md`: D8 (web stack), D10 (autosave protocol), D11 (wire conventions)
- `openspec/specs/web-client/spec.md`: layout, URLs, keyboard editing, slash menu, page header
- `openspec/specs/{user-auth,page-management,page-content,page-search,page-trash}/spec.md`: client-facing scenarios
- `docs/api/openapi.yaml`: the exact API contract. `src/api/types.ts` mirrors it, so keep the two in sync.
- `openspec/changes/archive/2026-10-19-add-notion-core/tasks.md` group 6 lists the frontend tasks. Spec owners tick tasks off; agents don't.

Once the change is archived, the specs move to `openspec/specs/<capability>/spec.md`.

## Conventions

- **Stack**: React 19, Vite, TypeScript (strict, `noUncheckedIndexedAccess`) and react-router. No UI kit, no state library, no CSS framework.
- **Styling**: plain CSS in `src/styles.css` with custom properties on `:root`. One breakpoint at `768px` (`max-width: 767.98px`). Respect `prefers-reduced-motion`. Light theme only.
- **Editor**: one auto-growing `<textarea>` per block, never `contentEditable`. Never use `dangerouslySetInnerHTML`, which ESLint enforces.
- **Pure logic goes in `src/lib/`**, with unit tests next to it (`*.test.ts`). Components call these modules instead of re-implementing the rules.
- **Fast refresh**: component files export components only. Put contexts, hooks and helpers in `.ts` files, for example `session/session.ts` and `pages/pages.ts`.
- **API**: all HTTP goes through `createApiClient` (`src/api/client.ts`). Errors are `ApiError {status, code, message}`. A 401 on an authenticated request calls the session's sign-out.
- **Autosave**: use `AutosaveController` (`src/lib/autosave.ts`) and register it with `saveRegistry` so sign-out and trash can flush first.
- **Accessibility**: every icon-only button needs an `aria-label`. To-dos use real checkboxes. Keep `:focus-visible` styles. Popovers close on Escape and on outside click.
- **Tests**: Vitest + Testing Library + jsdom. Name tests after spec scenarios, e.g. `'Continue a list: …'`. Mock `fetch` with `src/test/helpers.tsx` or `src/test/fakeBackend.ts`, and never depend on a running backend.
- **Dependencies**: pin exact versions. Only use stable releases that are at least about two weeks old.

## Before you finish

```sh
npm run lint && npm test && npm run build
```

All three must pass.
