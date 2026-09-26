import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trophy, Plus, Users, Clock, Shield, Coins, AlertCircle, ArrowRight } from 'lucide-react'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import type { TournamentListItem, TournamentCreate, Tournament } from '@/types/domain'

export const TournamentListPage: React.FC = () => {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Form state for creating tournament
  const [name, setName] = useState('')
  const [budget, setBudget] = useState(305)
  const [rosterSize, setRosterSize] = useState(10)
  const [pickTimeSeconds, setPickTimeSeconds] = useState(30)
  const [banCount, setBanCount] = useState(0)
  const [uniqueBy, setUniqueBy] = useState<'PLAYER' | 'CARD'>('PLAYER')

  // Fetch tournaments
  const { data: tournaments, isLoading, error } = useQuery<TournamentListItem[]>({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const res = await apiClient.get<TournamentListItem[]>('/tournaments')
      return res.data
    },
  })

  // Create tournament mutation
  const createMutation = useMutation({
    mutationFn: async (payload: TournamentCreate) => {
      const res = await apiClient.post<Tournament>('/tournaments', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
      setIsCreateOpen(false)
      setName('')
      setCreateError(null)
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setCreateError(err.message)
      } else {
        setCreateError('Failed to create tournament.')
      }
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setCreateError('Tournament name is required.')
      return
    }

    createMutation.mutate({
      name: name.trim(),
      rules: {
        rulesVersion: 1,
        budget: Number(budget),
        rosterSize: Number(rosterSize),
        pickTimeSeconds: Number(pickTimeSeconds),
        banCount: Number(banCount),
        uniqueBy,
        timeoutPolicy: 'AUTO_PICK_CHEAPEST',
        banTimeSeconds: 60,
        banTarget: 'OPPONENT_ROSTER',
        banOrder: 'SIMULTANEOUS',
        allowedSeasonIds: [],
      },
    })
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'READY':
        return 'neon'
      case 'RUNNING':
        return 'cyan'
      case 'COMPLETED':
        return 'purple'
      case 'CANCELLED':
        return 'danger'
      default:
        return 'warning'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'READY':
        return 'SẴN SÀNG'
      case 'RUNNING':
        return 'ĐANG DIỄN RA'
      case 'COMPLETED':
        return 'ĐÃ KẾT THÚC'
      case 'CANCELLED':
        return 'ĐÃ HUỶ'
      case 'DRAFT':
        return 'BẢN NHÁP'
      default:
        return status
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-neon" /> Danh Sách Giải Đấu
          </h1>
          <p className="font-mono text-xs text-zinc-400 tracking-wider uppercase mt-1">
            Các giải đấu và mùa giải Draft đang hoạt động
          </p>
        </div>

        {isAdmin && (
          <Button
            variant="neon"
            size="md"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Tạo Giải Đấu
          </Button>
        )}
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-neon border-t-transparent rounded-full animate-spin"></div>
            <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
              Đang tải danh sách giải đấu...
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Không thể tải danh sách giải đấu. Vui lòng thử lại sau.</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && tournaments?.length === 0 && (
        <div className="text-center py-16 px-4 border border-dashed border-border-default rounded-xl bg-surface-panel/40 flex flex-col items-center">
          <Trophy className="w-12 h-12 text-zinc-600 mb-3" />
          <h3 className="font-display text-lg font-bold text-white uppercase tracking-wider">
            Chưa Có Giải Đấu Nào
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mt-1 mb-6">
            {isAdmin
              ? 'Bắt đầu bằng cách tạo giải đấu Draft đầu tiên cho hệ thống của bạn.'
              : 'Hiện tại chưa có giải đấu nào được lên lịch. Vui lòng quay lại sau.'}
          </p>
          {isAdmin && (
            <Button variant="neon" size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4" /> Tạo Giải Đấu Đầu Tiên
            </Button>
          )}
        </div>
      )}

      {/* Tournament Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments?.map((trn) => {
          const rules = trn.rules
          return (
            <Card
              key={trn.id}
              className="flex flex-col justify-between hover:border-border-prominent hover:shadow-[0_10px_30px_rgba(0,0,0,0.7)] transition-all group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={getStatusBadgeVariant(trn.status)}>{getStatusLabel(trn.status)}</Badge>
                  <span className="font-mono text-[11px] text-zinc-400">
                    {new Date(trn.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <CardTitle className="mt-2 text-xl group-hover:text-neon transition-colors">
                  {trn.name}
                </CardTitle>
                <CardDescription className="font-mono text-[11px]">
                  Mã: {trn.id.slice(0, 8)}...
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-2 flex-1">
                {/* Rules telemetry bar */}
                <div className="grid grid-cols-2 gap-2 bg-surface-card p-3 rounded-lg border border-border-subtle text-xs font-mono">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Coins className="w-3.5 h-3.5 text-warning" />
                    <span>Budget: <strong className="text-white">{rules?.budget ?? 305}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Users className="w-3.5 h-3.5 text-cyan" />
                    <span>Đội hình: <strong className="text-white">{rules?.rosterSize ?? 10}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Clock className="w-3.5 h-3.5 text-neon" />
                    <span>Lượt Pick: <strong className="text-white">{rules?.pickTimeSeconds ?? 30}s</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                    <span>Lượt Ban: <strong className="text-white">{rules?.banCount ?? 0}</strong></span>
                  </div>
                </div>
              </CardContent>

              <div className="p-5 pt-0">
                <Link to={`/tournaments/${trn.id}`} className="w-full">
                  <Button variant="outline" size="sm" className="w-full flex items-center justify-between group-hover:border-neon/60">
                    <span>Vào Giải Đấu</span>
                    <ArrowRight className="w-4 h-4 text-neon group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Create Tournament Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false)
          setCreateError(null)
        }}
        title="Tạo Giải Đấu Mới"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          {createError && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <Input
            label="Tên Giải Đấu"
            placeholder="Ví dụ: FVPL Summer Champions Cup 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={createMutation.isPending}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quỹ Lương (Budget)"
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              disabled={createMutation.isPending}
              min={10}
              max={1000}
              required
            />
            <Input
              label="Quy mô Đội hình (Roster Size)"
              type="number"
              value={rosterSize}
              onChange={(e) => setRosterSize(Number(e.target.value))}
              disabled={createMutation.isPending}
              min={2}
              max={30}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Thời Gian Pick (Giây)"
              type="number"
              value={pickTimeSeconds}
              onChange={(e) => setPickTimeSeconds(Number(e.target.value))}
              disabled={createMutation.isPending}
              min={10}
              max={300}
              required
            />
            <Input
              label="Lượt Ban (Mỗi Trận)"
              type="number"
              value={banCount}
              onChange={(e) => setBanCount(Number(e.target.value))}
              disabled={createMutation.isPending}
              min={0}
              max={10}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-display uppercase tracking-wider text-zinc-400 font-medium">
              Quy Tắc Trùng Cầu Thủ (Unique Pick)
            </label>
            <select
              value={uniqueBy}
              onChange={(e) => setUniqueBy(e.target.value as 'PLAYER' | 'CARD')}
              disabled={createMutation.isPending}
              className="w-full bg-surface-card border border-border-default rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon font-sans"
            >
              <option value="PLAYER">PLAYER (Mỗi cầu thủ chỉ được chọn 1 lần trên mọi mùa thẻ)</option>
              <option value="CARD">CARD (Duy nhất theo thẻ mùa - khác mùa vẫn được chọn)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Huỷ Bỏ
            </Button>
            <Button
              type="submit"
              variant="neon"
              size="md"
              isLoading={createMutation.isPending}
            >
              Tạo Giải Đấu
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
