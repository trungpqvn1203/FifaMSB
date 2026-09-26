import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Trophy, LogOut, User as UserIcon, Radio } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isCurrent = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen flex flex-col bg-app-void text-white">
      {/* HUD Header */}
      <header className="sticky top-0 z-40 w-full bg-surface-panel/90 backdrop-blur-md border-b border-border-default">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand & Telemetry */}
          <div className="flex items-center gap-4">
            <Link to="/tournaments" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-lg bg-neon/10 border border-neon/30 flex items-center justify-center text-neon shadow-glow-neon group-hover:scale-105 transition-transform">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-extrabold text-base tracking-wider uppercase text-white group-hover:text-neon transition-colors leading-none">
                  FC MSB <span className="text-neon">Pro</span>
                </span>
                <span className="font-mono text-[10px] text-zinc-400 tracking-widest uppercase">
                  Hệ thống Giải đấu
                </span>
              </div>
            </Link>

            <div className="hidden sm:flex items-center gap-2 bg-surface-card border border-border-subtle px-2.5 py-1 rounded-sm">
              <span className="w-2 h-2 rounded-full bg-neon animate-pulse"></span>
              <span className="font-mono text-[11px] text-neon uppercase font-semibold">Trực tiếp (Live)</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/tournaments"
              className={`px-3.5 py-1.5 rounded-md font-display text-xs uppercase tracking-wider transition-colors ${
                isCurrent('/tournaments') || isCurrent('/')
                  ? 'bg-surface-elevated text-neon border border-border-prominent'
                  : 'text-zinc-400 hover:text-white hover:bg-surface-card'
              }`}
            >
              Giải Đấu
            </Link>

            {isAdmin && (
              <Link
                to="/admin/tournaments/new"
                className={`px-3.5 py-1.5 rounded-md font-display text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-neon/15 text-neon border border-neon/30 font-bold'
                    : 'text-zinc-400 hover:text-neon hover:bg-surface-card'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse" />
                Quản Trị Admin
              </Link>
            )}
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-2.5 bg-surface-card border border-border-default px-3 py-1.5 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-surface-elevated flex items-center justify-center text-zinc-400">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-display font-bold text-white leading-tight">
                      {user.username}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {isAdmin ? 'Quản trị viên (Admin)' : 'Đội trưởng'}
                    </span>
                  </div>
                  <Badge variant={isAdmin ? 'purple' : 'cyan'} className="ml-1 text-[10px]">
                    {user.role}
                  </Badge>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-zinc-400 hover:text-danger px-2.5"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="neon" size="sm">
                  Đăng Nhập
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {children}
      </main>

      {/* Footer Telemetry */}
      <footer className="border-t border-border-subtle bg-surface-panel/40 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-neon animate-pulse" />
            <span>Hệ thống Phát sóng FC Online Esports · Kết nối Realtime đang hoạt động</span>
          </div>
          <span>FIFA / FC Online Draft Pro</span>
        </div>
      </footer>
    </div>
  )
}
