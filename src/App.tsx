import { Navigate, Route, Routes } from 'react-router'
import { PagesProvider } from './pages/PagesProvider'
import { PublicOnly, RequireAuth } from './session/RequireAuth'
import { AppShell } from './shell/AppShell'
import { LoginPage, RegisterPage } from './views/AuthPages'
import { HomeView } from './views/HomeView'
import { PageRoute } from './views/PageView'
import { TrashView } from './views/TrashView'

/** Routes from design D8: /login, /register, /p/:pageId, /trash and /. Router supplied by the caller. */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
      <Route
        element={
          <RequireAuth>
            <PagesProvider>
              <AppShell />
            </PagesProvider>
          </RequireAuth>
        }
      >
        <Route index element={<HomeView />} />
        <Route path="/p/:pageId" element={<PageRoute />} />
        <Route path="/trash" element={<TrashView />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
