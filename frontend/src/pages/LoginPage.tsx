import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Trophy, AlertCircle, ShieldCheck, Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ApiError } from '@/lib/api-client'

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/tournaments'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.')
      return
    }

    setIsLoading(true)
    setErrorMsg(null)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.')
      } else {
        setErrorMsg('Không thể kết nối đến máy chủ xác thực.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-app-void relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-neon/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan/10 rounded-full blur-[128px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-card border border-neon/40 shadow-glow-neon flex items-center justify-center text-neon mb-3">
            <Trophy className="w-7 h-7" />
          </div>
          <h1 className="font-display text-2xl font-extrabold uppercase tracking-wider text-white">
            FC MSB <span className="text-neon">Pro</span>
          </h1>
          <p className="font-mono text-xs text-zinc-400 tracking-widest uppercase mt-1">
            Hệ thống Quản lý Giải đấu &amp; Player Draft
          </p>
        </div>

        <Card className="border-border-prominent shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <CardHeader className="text-center pb-2">
            <CardTitle>Đăng Nhập Hệ Thống</CardTitle>
            <CardDescription>
              Đăng nhập với tài khoản Admin hoặc Đội trưởng
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMsg && (
              <div className="mb-4 p-3 rounded-md bg-danger/10 border border-danger/30 flex items-start gap-2.5 text-xs text-danger font-sans">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <Input
                  label="Tên đăng nhập"
                  placeholder="admin hoặc tên đội trưởng"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>

              <div className="relative">
                <Input
                  label="Mật khẩu"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                variant="neon"
                size="md"
                className="w-full mt-2"
                isLoading={isLoading}
              >
                Đăng Nhập
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-neon" /> Phiên bảo mật Cookie
              </span>
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Phân quyền Tài khoản
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
