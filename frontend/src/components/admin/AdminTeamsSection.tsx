import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Lock } from 'lucide-react'
import type { Team, User } from '@/types/domain'

interface AdminTeamsProps {
  teams: Team[]
  users: User[]
  tournamentId: string | undefined
  onAddTeam: (name: string, draftOrder: number) => void
  onCreateUserForTeam: (teamId: string, username: string, password: string) => void
  onReassignUserToTeam: (userId: string, teamId: string) => void
  onRandomizeOrder: () => void
  onReorderTeams?: (teamIds: string[]) => void
  isSubmitting?: boolean
  isLocked?: boolean
}

// Small badge showing if a user has participated in previous tournaments
const HistoryBadge: React.FC<{ hasPreviousTeam: boolean }> = ({ hasPreviousTeam }) => {
  if (!hasPreviousTeam) return <span className="text-gray-500 text-[10px]">Giải đầu tiên</span>
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono">
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
      Đã tham gia giải trước
    </span>
  )
}

export const AdminTeamsSection: React.FC<AdminTeamsProps> = ({
  teams,
  users,
  tournamentId,
  onAddTeam,
  onCreateUserForTeam,
  onReassignUserToTeam,
  onRandomizeOrder,
  onReorderTeams,
  isSubmitting = false,
  isLocked = false,
}) => {
  const [newTeamName, setNewTeamName] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [linkingTeamId, setLinkingTeamId] = useState<string | null>(null)
  const [linkTab, setLinkTab] = useState<'create' | 'reuse'>('create')

  // Tab "Tạo Mới" state
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // Tab "Dùng Lại" state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Set of team IDs in this tournament — used to exclude their linked users from reuse list
  const currentTournamentTeamIds = useMemo(
    () => new Set(teams.map((t) => t.id)),
    [teams]
  )

  // Map user by teamId for current tournament display
  const userByTeamId = useMemo(() => {
    const m = new Map<string, User>()
    users.forEach((u) => { if (u.teamId) m.set(u.teamId, u) })
    return m
  }, [users])

  // Users eligible for reuse: TEAM_USER whose current team is NOT in this tournament
  const reusableUsers = useMemo(
    () => users.filter(
      (u) => u.role === 'TEAM_USER' && (!u.teamId || !currentTournamentTeamIds.has(u.teamId))
    ),
    [users, currentTournamentTeamIds]
  )

  const filteredReusable = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return reusableUsers
    return reusableUsers.filter((u) => u.username.toLowerCase().includes(q))
  }, [reusableUsers, searchQuery])

  // Derive the team object currently being linked for modal title
  const linkingTeam = teams.find((t) => t.id === linkingTeamId)

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const openLinkModal = (teamId: string, teamName: string) => {
    const code = teamName.substring(0, 3).toUpperCase()
    setLinkingTeamId(teamId)
    setLinkTab('create')
    setNewUsername(`${code.toLowerCase()}_captain`)
    setNewPassword('password123')
    setSearchQuery('')
    setSelectedUserId(null)
  }

  const closeModal = () => {
    setLinkingTeamId(null)
    setNewUsername('')
    setNewPassword('')
    setSearchQuery('')
    setSelectedUserId(null)
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim()) return
    onAddTeam(newTeamName.trim(), teams.length + 1)
    setNewTeamName('')
    setIsAddModalOpen(false)
  }

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkingTeamId || !newUsername.trim() || !newPassword.trim()) return
    onCreateUserForTeam(linkingTeamId, newUsername.trim(), newPassword.trim())
    closeModal()
  }

  const handleReuseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkingTeamId || !selectedUserId) return
    onReassignUserToTeam(selectedUserId, linkingTeamId)
    closeModal()
  }

  // Reorder helper
  const handleMove = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= teams.length) return
    const newTeams = [...teams]
    const [movedTeam] = newTeams.splice(fromIndex, 1)
    newTeams.splice(toIndex, 0, movedTeam)

    if (onReorderTeams) {
      onReorderTeams(newTeams.map((t) => t.id))
    }
  }

  // Drag and drop reordering handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    handleMove(draggedIndex, targetIndex)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <section id="teams-table" className="bg-[#121517] border border-[#2A3138] rounded-xl p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#3DFF6B]" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-[#2A3138] gap-4">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded bg-[#3DFF6B]/10 border border-[#3DFF6B]/30 text-[#3DFF6B] font-mono text-xs font-bold flex items-center justify-center">
            04
          </span>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-white uppercase tracking-wide">
                Danh Sách Đội &amp; Thứ Tự Draft
              </h2>
              {isLocked && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-medium">
                  <Lock className="w-3 h-3 text-amber-400" />
                  Thứ tự đã khóa (Đang cấm chọn)
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Quản lý tên đội, thứ tự bốc thăm Draft và tài khoản đội trưởng.{' '}
              {isLocked ? (
                <span className="text-amber-400/90">🔒 Đã khóa sắp xếp vì phiên cấm chọn hoặc giải đấu đang diễn ra</span>
              ) : (
                <span className="text-[#3DFF6B]">💡 Kéo thả hàng hoặc dùng mũi tên để đổi vị trí</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRandomizeOrder}
            disabled={isLocked || teams.length < 2 || isSubmitting}
            title={isLocked ? 'Không thể đảo thứ tự khi đang cấm chọn' : undefined}
            className="px-3 py-1.5 text-xs font-mono border border-[#2A3138] rounded text-gray-300 hover:text-white hover:border-gray-500 flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5 text-[#3DFF6B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Trộn Ngẫu Nhiên
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            disabled={isLocked || isSubmitting}
            title={isLocked ? 'Không thể thêm đội mới khi giải đấu đang diễn ra' : undefined}
            className="px-3.5 py-1.5 text-xs font-mono font-bold bg-[#3DFF6B]/15 text-[#3DFF6B] border border-[#3DFF6B]/40 hover:bg-[#3DFF6B] hover:text-black rounded transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Thêm Đội Mới
          </button>
        </div>
      </div>

      {/* Teams Data Table */}
      <div className="overflow-x-auto border border-[#2A3138] rounded-lg bg-[#181C1F]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#2A3138] bg-[#202529] text-gray-400 font-mono uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4 w-28 text-center">Thứ Tự</th>
              <th className="py-3 px-4">Tên Đội / CLB</th>
              <th className="py-3 px-4 w-28">Mã Đội</th>
              <th className="py-3 px-4">Tài Khoản Đội Trưởng Liên Kết</th>
              <th className="py-3 px-4 w-36">Trạng Thái</th>
              <th className="py-3 px-4 w-36 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A3138] font-mono">
            {teams.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 font-mono">
                  Chưa có đội nào. Bấm &quot;Thêm Đội Mới&quot; để bổ sung các đội tham gia.
                </td>
              </tr>
            ) : (
              teams.map((team, idx) => {
                const linkedUser = userByTeamId.get(team.id)
                const code = team.name.substring(0, 3).toUpperCase()

                return (
                  <tr
                    key={team.id}
                    draggable={!isLocked && !isSubmitting && teams.length > 1}
                    onDragStart={(e) => !isLocked && handleDragStart(e, idx)}
                    onDragOver={(e) => !isLocked && handleDragOver(e, idx)}
                    onDragLeave={() => {
                      if (dragOverIndex === idx) setDragOverIndex(null)
                    }}
                    onDrop={(e) => !isLocked && handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`transition-all select-none ${
                      draggedIndex === idx
                        ? 'opacity-30 bg-[#2A3138]'
                        : dragOverIndex === idx
                        ? 'border-t-2 border-[#3DFF6B] bg-[#3DFF6B]/10'
                        : 'hover:bg-[#202529]/40'
                    }`}
                  >
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isLocked ? (
                          <div
                            className="p-1 text-gray-600 cursor-not-allowed"
                            title="Thứ tự đã khóa do phiên cấm chọn đang diễn ra"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div
                            className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-[#3DFF6B] transition-colors p-1"
                            title="Kéo thả hàng này để thay đổi thứ tự"
                          >
                            <svg
                              className="w-3.5 h-3.5 shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-12a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                            </svg>
                          </div>
                        )}
                        <div className="w-6 h-6 rounded bg-[#3DFF6B]/20 text-[#3DFF6B] font-bold flex items-center justify-center border border-[#3DFF6B]/40">
                          {team.draftOrder || idx + 1}
                        </div>
                        {!isLocked && (
                          <div className="flex flex-col gap-0.5 ml-0.5">
                            <button
                              type="button"
                              disabled={idx === 0 || isSubmitting}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMove(idx, idx - 1)
                              }}
                              className="text-gray-500 hover:text-[#3DFF6B] disabled:opacity-20 disabled:hover:text-gray-500 transition-colors p-0.5 rounded"
                              title="Di chuyển lên trên"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === teams.length - 1 || isSubmitting}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMove(idx, idx + 1)
                              }}
                              className="text-gray-500 hover:text-[#3DFF6B] disabled:opacity-20 disabled:hover:text-gray-500 transition-colors p-0.5 rounded"
                              title="Di chuyển xuống dưới"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-neutral-800 border border-[#38424B] flex items-center justify-center font-bold text-white text-xs">
                          {code}
                        </div>
                        <div>
                          <span className="text-white font-bold font-sans text-sm block">
                            {team.name}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Mã: {team.id.substring(0, 8)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded bg-[#121517] border border-[#2A3138] text-[#3DFF6B] text-xs">
                        {code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {linkedUser ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-gray-200">{linkedUser.username}</span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            (Quyền: {linkedUser.role})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          <span className="text-amber-300 text-xs">Chưa có tài khoản</span>
                          <button
                            type="button"
                            onClick={() => openLinkModal(team.id, team.name)}
                            className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] hover:bg-amber-500/30"
                          >
                            + Liên Kết / Tạo TK
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {linkedUser ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/30 text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ĐÃ SẴN SÀNG
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> CHƯA LIÊN KẾT
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!linkedUser && (
                        <button
                          type="button"
                          onClick={() => openLinkModal(team.id, team.name)}
                          className="text-[#3DFF6B] hover:underline text-[11px]"
                        >
                          Liên Kết
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs font-mono text-gray-400">
        <span>Quy mô Draft: {teams.length} đội tham gia</span>
        <span className="text-[#3DFF6B]">
          💡 Kéo thả hàng bất kỳ để đổi thứ tự chính xác (hoặc bấm &quot;Trộn Thứ Tự&quot;)
        </span>
      </div>

      {/* Add Team Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181C1F] border border-[#2A3138] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Thêm Đội Tham Gia</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1">Tên Đội / CLB</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Ví dụ: Titan Esports"
                  className="w-full bg-[#121517] border border-[#2A3138] focus:border-[#3DFF6B] text-sm text-white px-3 py-2 rounded outline-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Huỷ Bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#3DFF6B] text-black font-bold rounded text-xs uppercase"
                >
                  Thêm Đội
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Link User Modal */}
      {linkingTeamId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181C1F] border border-[#2A3138] rounded-xl p-6 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A3138] mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Liên Kết Tài Khoản Đội Trưởng
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Đội: <span className="text-[#3DFF6B] font-semibold">{linkingTeam?.name}</span>{' '}
                  <span className="text-[10px] font-mono text-gray-500">
                    ({tournamentId ? `Giải: ${tournamentId.substring(0, 8)}` : 'Giải mới'})
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#202529]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-[#2A3138] mb-5 gap-2">
              <button
                type="button"
                onClick={() => setLinkTab('create')}
                className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-mono font-semibold border-b-2 transition-all ${
                  linkTab === 'create'
                    ? 'border-[#3DFF6B] text-[#3DFF6B]'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Tạo Mới
              </button>
              <button
                type="button"
                onClick={() => setLinkTab('reuse')}
                className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-mono font-semibold border-b-2 transition-all ${
                  linkTab === 'reuse'
                    ? 'border-[#3DFF6B] text-[#3DFF6B]'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Dùng Lại ({reusableUsers.length})
              </button>
            </div>

            {/* TAB 1: TẠO MỚI */}
            {linkTab === 'create' && (
              <form onSubmit={handleCreateUserSubmit} className="space-y-4">
                <p className="text-xs text-gray-400">
                  Tạo tài khoản mới với quyền <span className="font-mono text-gray-300 font-semibold">TEAM_USER</span> gán trực tiếp cho đội này.
                </p>
                <div>
                  <label className="block text-xs font-mono text-gray-300 mb-1">Tên Đăng Nhập</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-[#121517] border border-[#2A3138] focus:border-[#3DFF6B] text-sm text-white px-3 py-2 rounded outline-none font-mono"
                    placeholder="ví dụ: titan_captain"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-gray-300 mb-1">Mật Khẩu</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#121517] border border-[#2A3138] focus:border-[#3DFF6B] text-sm text-white px-3 py-2 rounded outline-none font-mono"
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3 border-t border-[#2A3138]">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Huỷ Bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newUsername.trim() || !newPassword.trim()}
                    className="px-4 py-1.5 bg-[#3DFF6B] text-black font-bold rounded text-xs uppercase disabled:opacity-50"
                  >
                    Tạo &amp; Liên Kết
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: DÙNG LẠI TÀI KHOẢN CŨ */}
            {linkTab === 'reuse' && (
              <form onSubmit={handleReuseSubmit} className="space-y-4">
                <div className="bg-[#121517] p-3 rounded-lg border border-[#2A3138] text-xs text-gray-300 space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-[#3DFF6B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Tái sử dụng tài khoản đội trưởng
                  </p>
                  <p className="text-gray-400 text-[11px] leading-relaxed">
                    Đội trưởng giữ nguyên tên đăng nhập &amp; mật khẩu cũ. Lịch sử các giải đấu trước vẫn được lưu trữ nguyên vẹn trong hệ thống.
                  </p>
                </div>

                {reusableUsers.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 font-mono text-xs border border-dashed border-[#2A3138] rounded-lg">
                    Không có tài khoản đội trưởng cũ nào khả dụng. Vui lòng chuyển sang tab &quot;Tạo Mới&quot;.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-mono text-gray-300 mb-1">
                        Tìm kiếm &amp; Chọn Tài Khoản ({reusableUsers.length} tài khoản)
                      </label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Gõ để lọc theo username..."
                        className="w-full bg-[#121517] border border-[#2A3138] focus:border-[#3DFF6B] text-xs text-white px-3 py-1.5 rounded outline-none font-mono mb-2"
                      />
                      
                      <div className="max-h-48 overflow-y-auto border border-[#2A3138] rounded-lg bg-[#121517] divide-y divide-[#202529]">
                        {filteredReusable.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 text-center font-mono">
                            Không tìm thấy tài khoản phù hợp với từ khóa
                          </div>
                        ) : (
                          filteredReusable.map((u) => {
                            const isSelected = selectedUserId === u.id
                            const hasPrevious = Boolean(u.teamId && !currentTournamentTeamIds.has(u.teamId))
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => setSelectedUserId(u.id)}
                                className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors ${
                                  isSelected
                                    ? 'bg-[#3DFF6B]/15 border-l-2 border-[#3DFF6B]'
                                    : 'hover:bg-[#181C1F]'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                    isSelected
                                      ? 'border-[#3DFF6B] bg-[#3DFF6B]'
                                      : 'border-gray-500'
                                  }`}>
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                                  </div>
                                  <div>
                                    <span className="font-mono text-xs font-bold text-white block">
                                      {u.username}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-mono">
                                      ID: {u.id.substring(0, 8)}
                                    </span>
                                  </div>
                                </div>
                                <HistoryBadge hasPreviousTeam={hasPrevious} />
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {selectedUserId && (
                      <div className="p-2.5 bg-[#202529] border border-[#38424B] rounded text-xs flex items-center justify-between">
                        <span className="text-gray-300">
                          Tài khoản đã chọn: <strong className="text-[#3DFF6B] font-mono">{users.find(u => u.id === selectedUserId)?.username}</strong>
                        </span>
                        <span className="text-[10px] text-gray-400">Sẵn sàng liên kết</span>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-end gap-3 pt-3 border-t border-[#2A3138]">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-1.5 text-xs text-gray-400 hover:text-white"
                  >
                    Huỷ Bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedUserId}
                    className="px-4 py-1.5 bg-[#3DFF6B] text-black font-bold rounded text-xs uppercase disabled:opacity-40"
                  >
                    Xác Nhận Dùng Lại
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
