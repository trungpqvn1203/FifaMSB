import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Users,
  Coins,
  Clock,
  Shield,
  Plus,
  Play,
  AlertCircle,
  Radio,
  Swords,
  Settings,
} from 'lucide-react'
import { apiClient, ApiError } from '@/lib/api-client'
import { adminApi } from '@/lib/admin-api'
import { matchApi } from '@/lib/match-api'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import type { Tournament, Team, DraftDetail, CreateTeamRequest, MatchDetail, User } from '@/types/domain'

export const TournamentDetailPage: React.FC = () => {
  const { id: tournamentId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()

  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [draftOrder, setDraftOrder] = useState<number>(1)
  const [actionError, setActionError] = useState<string | null>(null)

  // Matches state
  const [isAddMatchOpen, setIsAddMatchOpen] = useState(false)
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')

  // 1. Fetch Tournament Detail
  const {
    data: tournament,
    isLoading: isTrnLoading,
    error: trnError,
  } = useQuery<Tournament>({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const res = await apiClient.get<Tournament>(`/tournaments/${tournamentId}`)
      return res.data
    },
    enabled: !!tournamentId,
  })

  // 2. Fetch Teams in Tournament
  const {
    data: teams,
    isLoading: isTeamsLoading,
  } = useQuery<Team[]>({
    queryKey: ['tournament-teams', tournamentId],
    queryFn: async () => {
      const res = await apiClient.get<Team[]>(`/tournaments/${tournamentId}/teams`)
      return res.data
    },
    enabled: !!tournamentId,
  })

  // 3. Fetch Draft Status (if exists)
  const { data: draftInfo } = useQuery<DraftDetail | null>({
    queryKey: ['tournament-draft', tournamentId],
    queryFn: async () => {
      try {
        const res = await apiClient.get<DraftDetail>(`/tournaments/${tournamentId}/draft`)
        return res.data
      } catch {
        return null
      }
    },
    enabled: !!tournamentId,
    refetchInterval: 5000,
  })

  // 4. Fetch Tournament Matches
  const {
    data: matches,
    isLoading: isMatchesLoading,
  } = useQuery<MatchDetail[]>({
    queryKey: ['tournament-matches', tournamentId],
    queryFn: () => matchApi.listTournamentMatches(tournamentId!),
    enabled: !!tournamentId,
    refetchInterval: 5000,
  })

  // Schedule Match Mutation
  const createMatchMutation = useMutation({
    mutationFn: (payload: { homeTeamId: string; awayTeamId: string }) =>
      matchApi.createMatch(tournamentId!, payload),
    onSuccess: (newMatch) => {
      queryClient.invalidateQueries({ queryKey: ['tournament-matches', tournamentId] })
      setIsAddMatchOpen(false)
      setHomeTeamId('')
      setAwayTeamId('')
      setActionError(null)
      navigate(`/tournaments/${tournamentId}/matches/${newMatch.id}/bans`)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Không thể lên lịch trận đấu.')
    },
  })

  // 5. Fetch Users for Admin team account linking
  const { data: users = [], refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers(),
    enabled: isAdmin,
  })

  const userByTeamId = new Map<string, User>()
  users.forEach((u) => {
    if (u.teamId) {
      userByTeamId.set(u.teamId, u)
    }
  })

  // User account creation modal state
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [linkingTeam, setLinkingTeam] = useState<Team | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('password123')
  const [userError, setUserError] = useState<string | null>(null)

  const createUserMutation = useMutation({
    mutationFn: async () => {
      if (!linkingTeam) return
      return await adminApi.createUser({
        username: newUsername.trim(),
        password: newPassword.trim(),
        role: 'TEAM_USER',
        teamId: linkingTeam.id,
      })
    },
    onSuccess: () => {
      refetchUsers()
      setIsCreateUserOpen(false)
      setLinkingTeam(null)
      setUserError(null)
    },
    onError: (err: any) => {
      setUserError(err instanceof ApiError ? err.message : 'Không thể tạo tài khoản đội trưởng.')
    },
  })

  // Add Team Mutation
  const addTeamMutation = useMutation({
    mutationFn: async (payload: CreateTeamRequest) => {
      const res = await apiClient.post<Team>(`/tournaments/${tournamentId}/teams`, payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament-teams', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      setIsAddTeamOpen(false)
      setTeamName('')
      setDraftOrder((teams?.length || 0) + 2)
      setActionError(null)
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setActionError(err.message)
      } else {
        setActionError('Không thể đăng ký đội.')
      }
    },
  })

  // Start Draft Mutation
  const startDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<DraftDetail>(`/tournaments/${tournamentId}/draft/start`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournament-draft', tournamentId] })
      setActionError(null)
      navigate(`/tournaments/${tournamentId}/draft`)
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setActionError(err.message)
      } else {
        setActionError('Không thể bắt đầu phiên Draft.')
      }
    },
  })

  const handleAddTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamName.trim()) {
      setActionError('Vui lòng nhập tên đội.')
      return
    }
    addTeamMutation.mutate({ name: teamName.trim(), draftOrder })
  }

  if (isTrnLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neon border-t-transparent rounded-full animate-spin"></div>
          <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
            Đang tải dữ liệu giải đấu...
          </span>
        </div>
      </div>
    )
  }

  if (trnError || !tournament) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Không tìm thấy giải đấu hoặc tải thất bại.</span>
        </div>
        <Link to="/tournaments">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại Danh sách Giải đấu
          </Button>
        </Link>
      </div>
    )
  }

  const rules = tournament.rules
  const isDraftRunning = draftInfo?.status === 'PICKING' || draftInfo?.status === 'PAUSED'

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
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col gap-4 border-b border-border-default pb-6">
        <Link
          to="/tournaments"
          className="inline-flex items-center gap-2 text-xs font-display uppercase tracking-wider text-zinc-400 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Danh Sách Giải Đấu
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white">
                {tournament.name}
              </h1>
              <Badge variant={tournament.status === 'READY' ? 'neon' : tournament.status === 'RUNNING' ? 'cyan' : 'warning'}>
                {getStatusLabel(tournament.status)}
              </Badge>
            </div>
            <span className="font-mono text-xs text-zinc-400">
              Mã: {tournament.id} · Khởi tạo lúc {new Date(tournament.createdAt).toLocaleString('vi-VN')}
            </span>
          </div>

          {/* Action Hub */}
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link to={`/admin/tournaments/${tournament.id}`}>
                <Button variant="outline" size="md" className="border-border-prominent hover:text-neon text-zinc-300">
                  <Settings className="w-4 h-4 mr-1.5 text-neon" /> Cấu Hình Giải (Admin)
                </Button>
              </Link>
            )}

            {isAdmin && tournament.status === 'DRAFT' && (
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setDraftOrder((teams?.length || 0) + 1)
                  setIsAddTeamOpen(true)
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Thêm Đội
              </Button>
            )}

            {isAdmin && tournament.status === 'READY' && !isDraftRunning && (
              <Button
                variant="neon"
                size="md"
                onClick={() => startDraftMutation.mutate()}
                isLoading={startDraftMutation.isPending}
                className="shadow-[0_0_20px_rgba(61,255,107,0.4)]"
              >
                <Play className="w-4 h-4 mr-1.5 fill-current" /> Bắt Đầu Phiên Draft
              </Button>
            )}

            {isDraftRunning && (
              <Link to={`/tournaments/${tournamentId}/draft`}>
                <Button
                  variant="neon"
                  size="md"
                  className="shadow-glow-neon flex items-center gap-2"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>Vào Phòng Draft ({getStatusLabel(draftInfo?.status || '')})</span>
                </Button>
              </Link>
            )}

            {draftInfo?.status === 'COMPLETED' && (
              <Link to={`/tournaments/${tournamentId}/draft`}>
                <Button
                  variant="outline"
                  size="md"
                  className="flex items-center gap-2 border-neon/40 text-neon hover:bg-neon/10"
                >
                  <Radio className="w-4 h-4" />
                  <span>Xem Bảng Draft Đã Hoàn Thành</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {actionError && (
          <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2 mt-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {/* Rules Grid */}
      <div>
        <h2 className="font-display text-base font-bold uppercase tracking-wider text-zinc-300 mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-neon" /> Luật Thi Đấu &amp; Quy Định Giải
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4 bg-surface-card border-border-subtle">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono uppercase">
              <Coins className="w-3.5 h-3.5 text-warning" /> Quỹ Lương (Budget)
            </div>
            <div className="font-mono text-xl font-bold text-white mt-1">
              {rules.budget} <span className="text-xs text-zinc-400 font-normal">pts</span>
            </div>
          </Card>

          <Card className="p-4 bg-surface-card border-border-subtle">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono uppercase">
              <Users className="w-3.5 h-3.5 text-cyan" /> Quy Mô Đội Hình
            </div>
            <div className="font-mono text-xl font-bold text-white mt-1">
              {rules.rosterSize} <span className="text-xs text-zinc-400 font-normal">cầu thủ</span>
            </div>
          </Card>

          <Card className="p-4 bg-surface-card border-border-subtle">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono uppercase">
              <Clock className="w-3.5 h-3.5 text-neon" /> Thời Gian Lượt
            </div>
            <div className="font-mono text-xl font-bold text-white mt-1">
              {rules.pickTimeSeconds} <span className="text-xs text-zinc-400 font-normal">giây</span>
            </div>
          </Card>

          <Card className="p-4 bg-surface-card border-border-subtle">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono uppercase">
              <Shield className="w-3.5 h-3.5 text-purple-400" /> Lượt Ban / Trận
            </div>
            <div className="font-mono text-xl font-bold text-white mt-1">
              {rules.banCount} <span className="text-xs text-zinc-400 font-normal">mỗi đội</span>
            </div>
          </Card>

          <Card className="p-4 bg-surface-card border-border-subtle">
            <div className="text-zinc-400 text-xs font-mono uppercase">Quy Tắc Trùng</div>
            <div className="font-mono text-sm font-bold text-neon mt-2 uppercase">
              {rules.uniqueBy}
            </div>
          </Card>

          <Card className="p-4 bg-surface-card border-border-subtle">
            <div className="text-zinc-400 text-xs font-mono uppercase">Xử Lý Hết Giờ</div>
            <div className="font-mono text-sm font-bold text-zinc-300 mt-2 uppercase">
              {rules.timeoutPolicy === 'AUTO_PICK_CHEAPEST' ? 'Tự Chọn Rẻ Nhất' : 'Bỏ Qua Lượt'}
            </div>
          </Card>
        </div>
      </div>

      {/* Teams Roster & Standings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan" /> Danh Sách Đội Tham Gia ({teams?.length || 0})
          </h2>

          {isAdmin && tournament.status === 'DRAFT' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraftOrder((teams?.length || 0) + 1)
                setIsAddTeamOpen(true)
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Thêm Đội
            </Button>
          )}
        </div>

        {isTeamsLoading && (
          <div className="py-8 text-center font-mono text-xs text-zinc-400">Đang tải danh sách đội...</div>
        )}

        {!isTeamsLoading && teams?.length === 0 && (
          <Card className="p-8 text-center border-dashed">
            <p className="font-display text-sm text-zinc-400 uppercase">
              Chưa có đội nào đăng ký. Cần tối thiểu 2 đội để bắt đầu phiên Draft.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams?.map((team) => {
            const budgetPercent = Math.min(
              100,
              Math.round((team.budgetUsed / rules.budget) * 100)
            )

            return (
              <Card key={team.id} className="p-4 bg-surface-card border-border-default flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-border-prominent flex items-center justify-center font-mono font-bold text-sm text-neon">
                      #{team.draftOrder}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-white">{team.name}</h3>
                      <span className="font-mono text-[10px] text-zinc-400">Mã: {team.id.slice(0, 8)}</span>
                    </div>
                  </div>

                  <Badge variant="cyan" className="font-mono">
                    Thứ tự #{team.draftOrder}
                  </Badge>
                </div>

                {/* Budget Bar */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-border-subtle">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-400">Ngân Sách Đã Dùng</span>
                    <span className="font-bold text-white">
                      {team.budgetUsed} / {rules.budget} pts ({budgetPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neon transition-all duration-300"
                      style={{ width: `${budgetPercent}%` }}
                    />
                  </div>
                </div>

                {/* Captain Account Info */}
                {isAdmin && (
                  <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs font-mono">
                    {userByTeamId.has(team.id) ? (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-zinc-400">Đội trưởng:</span>
                        <span className="text-white font-bold">@{userByTeamId.get(team.id)!.username}</span>
                        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">
                          SẴN SÀNG
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 text-amber-400">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          <span>Chưa có tài khoản</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs font-mono text-neon border-neon/40 hover:bg-neon hover:text-black py-0.5 h-7"
                          onClick={() => {
                            setLinkingTeam(team)
                            const clean = team.name.toLowerCase().replace(/[^a-z0-9]/g, '')
                            setNewUsername(`${clean || 'team'}_captain`)
                            setNewPassword('password123')
                            setIsCreateUserOpen(true)
                          }}
                        >
                          + Tạo Tài Khoản
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* Matches & Tactical Bans Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-neon" />
            <h2 className="font-display font-bold text-xl text-white">
              Trận Đấu &amp; Cấm Chọn (Ban)
            </h2>
            <Badge variant="default" className="font-mono">
              {matches?.length || 0} Trận
            </Badge>
          </div>

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (teams && teams.length >= 2) {
                  setHomeTeamId(teams[0].id)
                  setAwayTeamId(teams[1].id)
                }
                setIsAddMatchOpen(true)
              }}
              disabled={(teams?.length || 0) < 2}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Lên Lịch Trận Đấu
            </Button>
          )}
        </div>

        {isMatchesLoading ? (
          <div className="text-zinc-500 font-mono text-xs py-6">Đang tải danh sách trận đấu...</div>
        ) : !matches || matches.length === 0 ? (
          <Card className="p-8 flex flex-col items-center justify-center text-center gap-3 border-dashed border-border-subtle bg-surface-card/40">
            <Swords className="w-10 h-10 text-zinc-600" />
            <div>
              <p className="font-display font-medium text-white text-sm">Chưa có trận đấu nào được lên lịch</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isAdmin
                  ? 'Bấm "Lên Lịch Trận Đấu" để ghép cặp hai đội và vào phòng Cấm Chọn (Ban).'
                  : 'Trận đấu sẽ xuất hiện ở đây sau khi quản trị viên lên lịch.'}
              </p>
            </div>
            {isAdmin && (teams?.length || 0) >= 2 && (
              <Button
                variant="neon"
                size="sm"
                onClick={() => {
                  setHomeTeamId(teams![0].id)
                  setAwayTeamId(teams![1].id)
                  setIsAddMatchOpen(true)
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Lên Lịch Trận Đầu Tiên
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((m) => {
              const statusColor =
                m.status === 'BAN_PHASE'
                  ? 'neon'
                  : m.status === 'BANS_LOCKED'
                    ? 'gold'
                    : m.status === 'COMPLETED'
                      ? 'default'
                      : 'cyan'

              const statusText =
                m.status === 'BAN_PHASE'
                  ? 'CẤM CHỌN'
                  : m.status === 'BANS_LOCKED'
                    ? 'ĐÃ KHOÁ BAN'
                    : m.status === 'COMPLETED'
                      ? 'HOÀN THÀNH'
                      : m.status

              return (
                <Card key={m.id} className="p-4 flex flex-col justify-between gap-4 border-border-subtle hover:border-border transition">
                  <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                    <span className="font-mono text-[11px] text-zinc-400">
                      TRẬN #{m.id.substring(0, 6)}
                    </span>
                    <Badge variant={statusColor as any} className="font-mono text-[10px]">
                      {statusText}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-white">{m.homeTeam.name}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {m.homeTeam.confirmed ? '🔒 Đã khoá' : 'Đang chọn'}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-xs text-zinc-500 px-2">VS</span>
                    <div className="flex flex-col text-right">
                      <span className="font-bold text-sm text-white">{m.awayTeam.name}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {m.awayTeam.confirmed ? '🔒 Đã khoá' : 'Đang chọn'}
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/tournaments/${tournamentId}/matches/${m.id}/bans`}
                    className="w-full"
                  >
                    <Button variant="neon" size="sm" className="w-full font-bold uppercase tracking-wider text-xs">
                      <Swords className="w-3.5 h-3.5 mr-1.5" />
                      Vào Phòng Cấm Chọn (Ban)
                    </Button>
                  </Link>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Team Modal */}
      <Modal
        isOpen={isAddTeamOpen}
        onClose={() => {
          setIsAddTeamOpen(false)
          setActionError(null)
        }}
        title="Đăng Ký Đội Tham Gia"
      >
        <form onSubmit={handleAddTeamSubmit} className="flex flex-col gap-4">
          {actionError && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <Input
            label="Tên Đội"
            placeholder="Ví dụ: Saigon Titans FC"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            disabled={addTeamMutation.isPending}
            required
          />

          <Input
            label="Thứ Tự Lượt Draft"
            type="number"
            value={draftOrder}
            onChange={(e) => setDraftOrder(Number(e.target.value))}
            disabled={addTeamMutation.isPending}
            min={1}
            max={32}
            required
          />

          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsAddTeamOpen(false)}
              disabled={addTeamMutation.isPending}
            >
              Huỷ Bỏ
            </Button>
            <Button type="submit" variant="neon" size="md" isLoading={addTeamMutation.isPending}>
              Đăng Ký Đội
            </Button>
          </div>
        </form>
      </Modal>

      {/* Schedule Match Modal */}
      <Modal
        isOpen={isAddMatchOpen}
        onClose={() => {
          setIsAddMatchOpen(false)
          setActionError(null)
        }}
        title="Lên Lịch Trận Đấu &amp; Cấm Chọn (Ban)"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (homeTeamId === awayTeamId) {
              setActionError('Đội Nhà và Đội Khách phải là hai đội khác nhau.')
              return
            }
            createMatchMutation.mutate({ homeTeamId, awayTeamId })
          }}
          className="flex flex-col gap-4"
        >
          {actionError && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono font-medium text-zinc-300">Đội Nhà (Home)</label>
            <select
              value={homeTeamId}
              onChange={(e) => setHomeTeamId(e.target.value)}
              className="bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon"
              required
            >
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (Thứ tự #{t.draftOrder})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono font-medium text-zinc-300">Đội Khách (Away)</label>
            <select
              value={awayTeamId}
              onChange={(e) => setAwayTeamId(e.target.value)}
              className="bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon"
              required
            >
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (Thứ tự #{t.draftOrder})
                </option>
              ))}
            </select>
          </div>

          <p className="text-[11px] text-zinc-400 font-mono">
            Hệ thống sẽ tạo phiên trận đấu và cho phép hai đội vào phòng Cấm Chọn (Ban).
          </p>

          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsAddMatchOpen(false)}
              disabled={createMatchMutation.isPending}
            >
              Huỷ Bỏ
            </Button>
            <Button
              type="submit"
              variant="neon"
              size="md"
              isLoading={createMatchMutation.isPending}
            >
              Lên Lịch &amp; Vào Phòng Đấu
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Captain Account Modal */}
      <Modal
        isOpen={isCreateUserOpen}
        onClose={() => {
          setIsCreateUserOpen(false)
          setLinkingTeam(null)
          setUserError(null)
        }}
        title={`Cấp Tài Khoản Đội Trưởng - ${linkingTeam?.name || ''}`}
      >
        <p className="text-xs text-zinc-400 font-mono -mt-2">
          Tài khoản này dùng để đội trưởng đăng nhập và tự chọn cầu thủ (Pick) trong phiên Draft.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createUserMutation.mutate()
          }}
          className="flex flex-col gap-4 mt-2"
        >
          {userError && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-xs">
              {userError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono font-medium text-zinc-300">
              Tên Đăng Nhập (Username)
            </label>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="vd: test1_captain"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono font-medium text-zinc-300">
              Mật Khẩu (Password)
            </label>
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mật khẩu đăng nhập"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-border-subtle">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => {
                setIsCreateUserOpen(false)
                setLinkingTeam(null)
              }}
              disabled={createUserMutation.isPending}
            >
              Huỷ Bỏ
            </Button>
            <Button
              type="submit"
              variant="neon"
              size="md"
              isLoading={createUserMutation.isPending}
            >
              Tạo &amp; Liên Kết Đội
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
