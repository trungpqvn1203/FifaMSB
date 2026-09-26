import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoginPage } from '@/pages/LoginPage'
import { TournamentListPage } from '@/pages/TournamentListPage'
import { TournamentDetailPage } from '@/pages/TournamentDetailPage'
import { DraftBoardPage } from '@/pages/DraftBoardPage'
import { MatchBanPage } from '@/pages/MatchBanPage'
import { AdminTournamentPage } from '@/pages/AdminTournamentPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected application routes */}
            <Route
              path="/tournaments"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <TournamentListPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/tournaments/:id"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <TournamentDetailPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            {/* Immersive Draft Board routes */}
            <Route
              path="/tournaments/:tournamentId/draft"
              element={
                <ProtectedRoute>
                  <DraftBoardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/drafts/:draftId"
              element={
                <ProtectedRoute>
                  <DraftBoardPage />
                </ProtectedRoute>
              }
            />

            {/* Tactical Ban Arena routes (Phase 10) */}
            <Route
              path="/tournaments/:tournamentId/matches/:matchId/bans"
              element={
                <ProtectedRoute>
                  <MatchBanPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/matches/:matchId/bans"
              element={
                <ProtectedRoute>
                  <MatchBanPage />
                </ProtectedRoute>
              }
            />

            {/* Admin Operations Portal routes (Phase 11) */}
            <Route
              path="/admin/tournaments/new"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AdminTournamentPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/tournaments/:id"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AdminTournamentPage />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/tournaments" replace />} />
            <Route path="*" element={<Navigate to="/tournaments" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
)
}

export default App
