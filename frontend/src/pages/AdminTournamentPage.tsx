import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/admin-api'
import { useAuth } from '@/context/AuthContext'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { AdminBasicInfoSection } from '@/components/admin/AdminBasicInfoSection'
import { AdminDraftRulesSection } from '@/components/admin/AdminDraftRulesSection'
import { AdminBanRulesSection } from '@/components/admin/AdminBanRulesSection'
import { AdminTeamsSection } from '@/components/admin/AdminTeamsSection'
import { AdminOperationsSection } from '@/components/admin/AdminOperationsSection'
import type {
  Tournament,
  Team,
  User,
  DraftDetail,
  SeasonItem,
  MatchDetail,
} from '@/types/domain'

export const AdminTournamentPage: React.FC = () => {
  const { id: routeTournamentId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()

  // Basic Info State
  const [name, setName] = useState('FVPL SUMMER 2026: RISE TO INFINITY')
  const [tournamentCode, setTournamentCode] = useState('s2-2026-draft')
  const [gameMode, setGameMode] = useState('pro_tier')
  const [scheduleDate, setScheduleDate] = useState('2026-07-15T19:30')

  // Draft Rules State
  const [rosterSize, setRosterSize] = useState<number>(24)
  const [budget, setBudget] = useState<number>(305)
  const [pickTimeSeconds, setPickTimeSeconds] = useState<number>(30)
  const [playersPerTurn, setPlayersPerTurn] = useState<number>(1)
  const [uniqueBy, setUniqueBy] = useState<'PLAYER' | 'CARD'>('PLAYER')
  const [timeoutPolicy, setTimeoutPolicy] = useState<'AUTO_PICK_CHEAPEST' | 'SKIP_TURN'>('AUTO_PICK_CHEAPEST')
  const [allowedSeasons, setAllowedSeasons] = useState<string[]>([])

  // Ban Rules State
  const [banQuota, setBanQuota] = useState<number>(5)
  const [banTimeSeconds, setBanTimeSeconds] = useState<number>(45)
  const [banTarget, setBanTarget] = useState<'OPPONENT_ROSTER' | 'OWN_ROSTER'>('OPPONENT_ROSTER')
  const [banOrder, setBanOrder] = useState<'SIMULTANEOUS' | 'ALTERNATING'>('SIMULTANEOUS')

  // Global action error / notification
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 1. Fetch available seasons
  const { data: seasons = [] } = useQuery<SeasonItem[]>({
    queryKey: ['seasons'],
    queryFn: adminApi.listSeasons,
  })

  // 2. Fetch all users
  const { data: users = [], refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: adminApi.listUsers,
    enabled: isAdmin,
  })

  // 3. If tournament ID is provided in route, load existing tournament
  const { data: existingTournament, refetch: refetchExistingTournament } = useQuery<Tournament>({
    queryKey: ['tournament', routeTournamentId],
    queryFn: () => adminApi.getTournament(routeTournamentId!),
    enabled: !!routeTournamentId,
  })

  // Populate form if existing tournament is loaded
  useEffect(() => {
    if (existingTournament) {
      setName(existingTournament.name)
      const rules = existingTournament.rules as any
      if (rules) {
        if (rules.rosterSize) setRosterSize(rules.rosterSize)
        if (rules.budget) setBudget(rules.budget)
        if (rules.pickTimeSeconds) setPickTimeSeconds(rules.pickTimeSeconds)
        if (rules.playersPerTurn) setPlayersPerTurn(rules.playersPerTurn)
        if (rules.uniqueBy) setUniqueBy(rules.uniqueBy)
        if (rules.timeoutPolicy) setTimeoutPolicy(rules.timeoutPolicy)
        if (rules.allowedSeasonIds) setAllowedSeasons(rules.allowedSeasonIds)
        if (rules.banCount !== undefined) setBanQuota(rules.banCount)
        else if (rules.banQuota !== undefined) setBanQuota(rules.banQuota)
        if (rules.banTimeSeconds !== undefined) setBanTimeSeconds(rules.banTimeSeconds)
        if (rules.banTarget) setBanTarget(rules.banTarget)
        if (rules.banOrder) setBanOrder(rules.banOrder)
      }
    }
  }, [existingTournament])

  // 4. Fetch teams for current tournament
  const { data: teams = [], refetch: refetchTeams } = useQuery<Team[]>({
    queryKey: ['tournament-teams', routeTournamentId],
    queryFn: () => adminApi.listTeams(routeTournamentId!),
    enabled: !!routeTournamentId,
  })

  // 5. Fetch draft status for current tournament
  const { data: draftInfo = null, refetch: refetchDraft } = useQuery<DraftDetail | null>({
    queryKey: ['tournament-draft', routeTournamentId],
    queryFn: () => adminApi.getDraft(routeTournamentId!),
    enabled: !!routeTournamentId,
    refetchInterval: 5000,
  })

  // 6. Fetch matches for current tournament
  const { data: matches = [], refetch: refetchMatches } = useQuery<MatchDetail[]>({
    queryKey: ['tournament-matches', routeTournamentId],
    queryFn: () => adminApi.listMatches(routeTournamentId!),
    enabled: !!routeTournamentId,
  })

  // Check if draft or ban phase or tournament progress locks team ordering
  const isDraftActive = draftInfo?.status === 'PICKING' || draftInfo?.status === 'PAUSED'
  const isDraftCompleted = draftInfo?.status === 'COMPLETED'
  const isBanPhaseActive = matches.some((m) => m.status === 'BAN_PHASE')
  const isTournamentRunningOrCompleted =
    existingTournament?.status === 'RUNNING' || existingTournament?.status === 'COMPLETED'
  const isOrderLocked =
    isDraftActive || isDraftCompleted || isBanPhaseActive || isTournamentRunningOrCompleted

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  // Deploy / Create Tournament Mutation
  const deployTournamentMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        rules: {
          rulesVersion: 1,
          budget,
          rosterSize,
          playersPerTurn,
          pickTimeSeconds,
          uniqueBy,
          timeoutPolicy,
          allowedSeasonIds: allowedSeasons,
          banCount: banQuota,
          banTimeSeconds,
          banTarget,
          banOrder,
        },
      }
      return await adminApi.createTournament(payload)
    },
    onSuccess: (newTrn) => {
      setSuccessMessage('Khởi tạo giải đấu thành công!')
      setActionError(null)
      navigate(`/admin/tournaments/${newTrn.id}`)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Không thể triển khai giải đấu.')
    },
  })

  // Update Tournament Mutation
  const updateTournamentMutation = useMutation({
    mutationFn: async () => {
      if (!routeTournamentId) return
      const payload = {
        name,
        rules: {
          rulesVersion: 1,
          budget,
          rosterSize,
          playersPerTurn,
          pickTimeSeconds,
          uniqueBy,
          timeoutPolicy,
          allowedSeasonIds: allowedSeasons,
          banCount: banQuota,
          banTimeSeconds,
          banTarget,
          banOrder,
        },
      }
      return await adminApi.updateTournament(routeTournamentId, payload)
    },
    onSuccess: () => {
      setSuccessMessage('Cập nhật cấu hình giải đấu thành công!')
      setActionError(null)
      refetchExistingTournament()
    },
    onError: (err: any) => {
      setActionError(err.message || 'Không thể cập nhật cấu hình giải đấu.')
    },
  })

  // Add Team Mutation
  const addTeamMutation = useMutation({
    mutationFn: async ({ teamName, draftOrder }: { teamName: string; draftOrder: number }) => {
      if (!routeTournamentId) {
        throw new Error('Vui lòng khởi tạo giải đấu trước khi thêm đội.')
      }
      return await adminApi.createTeam(routeTournamentId, { name: teamName, draftOrder })
    },
    onSuccess: () => {
      refetchTeams()
      setSuccessMessage('Đăng ký đội thành công!')
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Không thể thêm đội.')
    },
  })

  // Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: async ({
      teamId,
      username,
      password,
    }: {
      teamId: string
      username: string
      password: string
    }) => {
      return await adminApi.createUser({
        username,
        password,
        role: 'TEAM_USER',
        teamId,
        tournamentId: routeTournamentId,
      })
    },
    onSuccess: () => {
      refetchUsers()
      setSuccessMessage('Đã tạo và liên kết tài khoản đội trưởng!')
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Không thể tạo tài khoản đội trưởng.')
    },
  })

  // Reassign User Mutation
  const reassignUserMutation = useMutation({
    mutationFn: async ({
      userId,
      teamId,
    }: {
      userId: string
      teamId: string
    }) => {
      if (!routeTournamentId) {
        throw new Error('Vui lòng khởi tạo giải đấu trước khi liên kết đội.')
      }
      return await adminApi.reassignUserTeam(userId, teamId, routeTournamentId)
    },
    onSuccess: () => {
      refetchUsers()
      setSuccessMessage('Đã tái sử dụng và liên kết tài khoản đội trưởng thành công!')
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Không thể liên kết lại tài khoản đội trưởng.')
    },
  })

  // Randomize Draft Order Mutation
  const randomizeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!routeTournamentId) {
        throw new Error('Vui lòng khởi tạo giải đấu trước khi trộn thứ tự.')
      }
      return await adminApi.randomizeDraftOrder(routeTournamentId)
    },
    onSuccess: () => {
      refetchTeams()
      queryClient.invalidateQueries({ queryKey: ['admin-teams', routeTournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournament-teams', routeTournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournament', routeTournamentId] })
      setSuccessMessage('Đã đảo ngẫu nhiên thứ tự bốc thăm Draft!')
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Không thể đảo thứ tự Draft.')
    },
  })

  // Reorder Teams Mutation (Drag and Drop)
  const reorderTeamsMutation = useMutation({
    mutationFn: async (teamIds: string[]) => {
      if (!routeTournamentId) {
        throw new Error('Vui lòng khởi tạo giải đấu trước khi thay đổi thứ tự.')
      }
      return await adminApi.reorderTeams(routeTournamentId, teamIds)
    },
    onSuccess: () => {
      refetchTeams()
      queryClient.invalidateQueries({ queryKey: ['admin-teams', routeTournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournament-teams', routeTournamentId] })
      queryClient.invalidateQueries({ queryKey: ['tournament', routeTournamentId] })
      setSuccessMessage('Đã cập nhật thứ tự bốc thăm Draft!')
      setActionError(null)
    },
    onError: (err: any) => {
      setActionError(err.message || 'Không thể cập nhật thứ tự Draft.')
    },
  })

  // Draft Mutations
  const startDraftMutation = useMutation({
    mutationFn: async () => {
      if (!routeTournamentId) return
      return await adminApi.startDraft(routeTournamentId)
    },
    onSuccess: () => {
      refetchDraft()
      setSuccessMessage('Bắt đầu phiên Draft thành công!')
    },
    onError: (err: any) => setActionError(err.message || 'Không thể bắt đầu phiên Draft.'),
  })

  const pauseDraftMutation = useMutation({
    mutationFn: (draftId: string) => adminApi.pauseDraft(draftId),
    onSuccess: () => {
      refetchDraft()
      setSuccessMessage('Đã tạm dừng phiên Draft.')
    },
  })

  const resumeDraftMutation = useMutation({
    mutationFn: (draftId: string) => adminApi.resumeDraft(draftId),
    onSuccess: () => {
      refetchDraft()
      setSuccessMessage('Đã tiếp tục phiên Draft.')
    },
  })

  const cancelDraftMutation = useMutation({
    mutationFn: (draftId: string) => adminApi.cancelDraft(draftId),
    onSuccess: () => {
      refetchDraft()
      setSuccessMessage('Đã huỷ phiên Draft.')
    },
  })

  // Match Mutations
  const scheduleMatchMutation = useMutation({
    mutationFn: ({ homeTeamId, awayTeamId }: { homeTeamId: string; awayTeamId: string }) => {
      if (!routeTournamentId) throw new Error('Cần chọn giải đấu.')
      return adminApi.scheduleMatch(routeTournamentId, { homeTeamId, awayTeamId })
    },
    onSuccess: () => {
      refetchMatches()
      setSuccessMessage('Đã lên lịch trận đấu!')
    },
    onError: (err: any) => setActionError(err.message || 'Không thể lên lịch trận đấu.'),
  })

  const startBanPhaseMutation = useMutation({
    mutationFn: (matchId: string) => adminApi.startBanPhase(matchId),
    onSuccess: () => {
      refetchMatches()
      setSuccessMessage('Đã bắt đầu giai đoạn Cấm Chọn (Ban)!')
    },
    onError: (err: any) => setActionError(err.message || 'Không thể bắt đầu giai đoạn Ban.'),
  })

  const completeMatchMutation = useMutation({
    mutationFn: (matchId: string) => adminApi.completeMatch(matchId),
    onSuccess: () => {
      refetchMatches()
      setSuccessMessage('Trận đấu đã hoàn tất!')
    },
    onError: (err: any) => setActionError(err.message || 'Không thể hoàn tất trận đấu.'),
  })

  // Allowed Seasons Helpers
  const handleToggleSeason = (code: string) => {
    setAllowedSeasons((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const handleSelectAllSeasons = () => {
    if (allowedSeasons.length === seasons.length) {
      setAllowedSeasons([])
    } else {
      setAllowedSeasons(seasons.map((s) => s.code))
    }
  }

  return (
    <div className="bg-[#0B0D0E] text-gray-200 font-sans min-h-screen selection:bg-[#3DFF6B] selection:text-black">
      {/* 1. Top App Navigation Bar */}
      <AdminHeader
        tournamentTitle={name}
        isDeploying={deployTournamentMutation.isPending || updateTournamentMutation.isPending}
        onDeploy={
          routeTournamentId
            ? () => updateTournamentMutation.mutate()
            : () => deployTournamentMutation.mutate()
        }
        deployLabel={routeTournamentId ? 'Lưu Cấu Hình' : 'Khởi Tạo Giải Đấu'}
      />

      {/* 2. Sub-header Breadcrumb and Stepper */}
      <div className="border-b border-[#2A3138] bg-[#121517] px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400 mb-1">
            <Link to="/tournaments" className="hover:text-white">
              GIẢI ĐẤU
            </Link>
            <span>/</span>
            <span className="text-[#3DFF6B]">BẢNG ĐIỀU KHIỂN ADMIN</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-3">
            {routeTournamentId ? name.toUpperCase() : 'TẠO GIẢI ĐẤU MỚI'}
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded bg-[#181C1F] text-gray-300 border border-[#2A3138]">
              DRAFT SPEC v2.4
            </span>
          </h1>
        </div>

        {/* Quick Navigation Jumps */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-mono py-1">
          <a
            href="#basic-info"
            className="px-3 py-1.5 rounded bg-[#181C1F] border border-[#2A3138] text-gray-300 hover:text-[#3DFF6B] hover:border-[#3DFF6B]/40 transition-colors whitespace-nowrap"
          >
            <span className="text-[#3DFF6B] font-bold">01</span> Thông Tin Cơ Bản
          </a>
          <a
            href="#draft-rules"
            className="px-3 py-1.5 rounded bg-[#181C1F] border border-[#2A3138] text-gray-300 hover:text-[#3DFF6B] hover:border-[#3DFF6B]/40 transition-colors whitespace-nowrap"
          >
            <span className="text-[#3DFF6B] font-bold">02</span> Luật Draft
          </a>
          <a
            href="#ban-rules"
            className="px-3 py-1.5 rounded bg-[#181C1F] border border-[#2A3138] text-gray-300 hover:text-[#3DFF6B] hover:border-[#3DFF6B]/40 transition-colors whitespace-nowrap"
          >
            <span className="text-[#3DFF6B] font-bold">03</span> Luật Ban
          </a>
          <a
            href="#teams-table"
            className="px-3 py-1.5 rounded bg-[#181C1F] border border-[#2A3138] text-gray-300 hover:text-[#3DFF6B] hover:border-[#3DFF6B]/40 transition-colors whitespace-nowrap"
          >
            <span className="text-[#3DFF6B] font-bold">04</span> Đội Tham Gia ({teams.length})
          </a>
          {routeTournamentId && (
            <a
              href="#draft-operations"
              className="px-3 py-1.5 rounded bg-[#181C1F] border border-cyan-500/40 text-cyan-300 hover:text-white transition-colors whitespace-nowrap"
            >
              <span className="text-cyan-400 font-bold">05</span> Vận Hành Trực Tiếp
            </a>
          )}
          <Link
            to="/admin/players"
            className="px-3 py-1.5 rounded bg-[#181C1F] border border-neon/40 text-neon hover:bg-neon/10 transition-colors whitespace-nowrap flex items-center gap-1.5 font-bold"
          >
            <span>⚡</span> Kho Cầu Thủ Toàn Hệ Thống ↗
          </Link>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="max-w-[1720px] mx-auto p-6 md:p-8 space-y-8">
        {/* Alerts */}
        {actionError && (
          <div className="bg-red-950/80 border border-red-500/50 rounded-lg p-4 text-red-200 text-xs font-mono flex items-center justify-between">
            <span>⚠️ {actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-lg p-4 text-emerald-200 text-xs font-mono flex items-center justify-between">
            <span>✓ {successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* SECTION 1: BASIC INFO */}
        <AdminBasicInfoSection
          name={name}
          onNameChange={setName}
          tournamentCode={tournamentCode}
          onTournamentCodeChange={setTournamentCode}
          gameMode={gameMode}
          onGameModeChange={setGameMode}
          scheduleDate={scheduleDate}
          onScheduleDateChange={setScheduleDate}
        />

        {/* SECTION 2: DRAFT RULES */}
        <AdminDraftRulesSection
          rosterSize={rosterSize}
          onRosterSizeChange={setRosterSize}
          budget={budget}
          onBudgetChange={setBudget}
          pickTimeSeconds={pickTimeSeconds}
          onPickTimeSecondsChange={setPickTimeSeconds}
          playersPerTurn={playersPerTurn}
          onPlayersPerTurnChange={setPlayersPerTurn}
          uniqueBy={uniqueBy}
          onUniqueByChange={setUniqueBy}
          timeoutPolicy={timeoutPolicy}
          onTimeoutPolicyChange={setTimeoutPolicy}
          availableSeasons={seasons}
          allowedSeasons={allowedSeasons}
          onToggleSeason={handleToggleSeason}
          onSelectAllSeasons={handleSelectAllSeasons}
        />

        {/* SECTION 3: BAN RULES */}
        <AdminBanRulesSection
          banQuota={banQuota}
          onBanQuotaChange={setBanQuota}
          banTimeSeconds={banTimeSeconds}
          onBanTimeSecondsChange={setBanTimeSeconds}
          banTarget={banTarget}
          onBanTargetChange={setBanTarget}
          banOrder={banOrder}
          onBanOrderChange={setBanOrder}
        />

        {/* SECTION 4: TEAMS & USER ACCOUNTS */}
        <AdminTeamsSection
          teams={teams}
          users={users}
          tournamentId={routeTournamentId}
          onAddTeam={(teamName, draftOrder) => addTeamMutation.mutate({ teamName, draftOrder })}
          onCreateUserForTeam={(teamId, username, password) =>
            createUserMutation.mutate({ teamId, username, password })
          }
          onReassignUserToTeam={(userId, teamId) =>
            reassignUserMutation.mutate({ userId, teamId })
          }
          onRandomizeOrder={() => randomizeOrderMutation.mutate()}
          onReorderTeams={(teamIds) => reorderTeamsMutation.mutate(teamIds)}
          isSubmitting={
            addTeamMutation.isPending ||
            createUserMutation.isPending ||
            reassignUserMutation.isPending ||
            randomizeOrderMutation.isPending ||
            reorderTeamsMutation.isPending
          }
          isLocked={isOrderLocked}
        />

        {/* OPERATIONS CONSOLE (when tournament exists) */}
        {routeTournamentId && (
          <AdminOperationsSection
            tournamentId={routeTournamentId}
            draftInfo={draftInfo}
            teams={teams}
            matches={matches}
            onStartDraft={() => startDraftMutation.mutate()}
            onPauseDraft={(draftId) => pauseDraftMutation.mutate(draftId)}
            onResumeDraft={(draftId) => resumeDraftMutation.mutate(draftId)}
            onCancelDraft={(draftId) => cancelDraftMutation.mutate(draftId)}
            onScheduleMatch={(hId, aId) =>
              scheduleMatchMutation.mutate({ homeTeamId: hId, awayTeamId: aId })
            }
            onStartBanPhase={(mId) => startBanPhaseMutation.mutate(mId)}
            onCompleteMatch={(mId) => completeMatchMutation.mutate(mId)}
            isSubmitting={
              startDraftMutation.isPending ||
              pauseDraftMutation.isPending ||
              resumeDraftMutation.isPending ||
              cancelDraftMutation.isPending ||
              scheduleMatchMutation.isPending ||
              startBanPhaseMutation.isPending ||
              completeMatchMutation.isPending
            }
          />
        )}

        {/* Sticky Submission Footer */}
        <div className="bg-[#121517] border border-[#2A3138] rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-6 shadow-2xl z-40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#3DFF6B]/10 border border-[#3DFF6B]/30 text-[#3DFF6B] flex items-center justify-center font-bold font-mono">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {routeTournamentId ? `Cấu Hình Giải Đấu: ${name}` : 'Giải Đấu Đã Sẵn Sàng Khởi Tạo'}
              </h4>
              <p className="text-xs text-gray-400 font-mono">
                {rosterSize} Lượt Pick &bull; Quỹ Lương {budget} &bull; Lượt Pick: {pickTimeSeconds}s &bull; {banQuota} Lượt Ban ({banOrder})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {routeTournamentId ? (
              <button
                type="button"
                onClick={() => updateTournamentMutation.mutate()}
                disabled={updateTournamentMutation.isPending}
                className="px-6 py-2.5 text-xs font-mono uppercase tracking-wider font-bold bg-[#3DFF6B] text-black hover:bg-[#2ceb58] rounded flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(61,255,107,0.25)] disabled:opacity-50"
              >
                {updateTournamentMutation.isPending ? 'Đang lưu...' : 'Lưu Thay Đổi Cấu Hình'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => deployTournamentMutation.mutate()}
                disabled={deployTournamentMutation.isPending}
                className="px-6 py-2.5 text-xs font-mono uppercase tracking-wider font-bold bg-[#3DFF6B] text-black hover:bg-[#2ceb58] rounded flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(61,255,107,0.25)]"
              >
                {deployTournamentMutation.isPending ? 'Đang khởi tạo...' : 'Khởi Tạo & Kích Hoạt Giải Đấu'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
export default AdminTournamentPage
