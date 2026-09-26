import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/types/domain'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: Role
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-void">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neon border-t-transparent rounded-full animate-spin"></div>
          <span className="font-mono text-xs text-zinc-400 uppercase tracking-widest">
            Authenticating Session...
          </span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-app-void text-center">
        <div className="p-6 rounded-xl bg-surface-panel border border-danger/40 max-w-md">
          <h2 className="font-display text-xl font-bold uppercase text-danger mb-2">Access Denied</h2>
          <p className="text-sm text-zinc-400 mb-4 font-sans">
            You do not have the required permissions ({requiredRole}) to access this page.
          </p>
          <Navigate to="/tournaments" replace />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
