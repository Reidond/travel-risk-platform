import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { Loading } from './components/Feedback'
import { Layout } from './components/Layout'
import { PanelPage } from './pages/panel/PanelPage'
import { ParametersPage } from './pages/parameters/ParametersPage'
import { RegionsPage } from './pages/regions/RegionsPage'

// Dashboard pulls in recharts — keep it out of the main chunk.
const DashboardPage = lazy(() =>
  import('./pages/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/regions" replace />} />
            <Route path="/regions" element={<RegionsPage />} />
            <Route path="/panel" element={<PanelPage />} />
            <Route
              path="/dashboard"
              element={
                <Suspense fallback={<Loading />}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route path="/parameters" element={<ParametersPage />} />
            <Route path="*" element={<Navigate to="/regions" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
