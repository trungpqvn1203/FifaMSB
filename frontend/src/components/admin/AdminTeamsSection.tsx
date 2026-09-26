import React, { useState } from 'react'
import type { Team, User } from '@/types/domain'

interface AdminTeamsProps {
  teams: Team[]
  users: User[]
  onAddTeam: (name: string, draftOrder: number) => void
  onCreateUserForTeam: (teamId: string, username: string, password: string) => void
  onRandomizeOrder: () => void
  isSubmitting?: boolean
}

export const AdminTeamsSection: React.FC<AdminTeamsProps> = ({
  teams,
  users,
  onAddTeam,
  onCreateUserForTeam,
  onRandomizeOrder,
  isSubmitting = false,
}) => {
  const [newTeamName, setNewTeamName] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [linkingTeamId, setLinkingTeamId] = useState<string | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // Map user by teamId
  const userByTeamId = new Map<string, User>()
  users.forEach((u) => {
    if (u.teamId) {
      userByTeamId.set(u.teamId, u)
    }
  })

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
    setLinkingTeamId(null)
    setNewUsername('')
    setNewPassword('')
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
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Danh Sách Đội &amp; Thứ Tự Draft
            </h2>
            <p className="text-xs text-gray-400">
              Quản lý tên đội, thứ tự bốc thăm Draft và tài khoản đội trưởng được liên kết
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRandomizeOrder}
            disabled={teams.length < 2 || isSubmitting}
            className="px-3 py-1.5 text-xs font-mono border border-[#2A3138] rounded text-gray-300 hover:text-white hover:border-gray-500 flex items-center gap-1.5 transition disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5 text-[#3DFF6B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Trộn Thứ Tự
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 text-xs font-mono font-bold bg-[#3DFF6B]/15 text-[#3DFF6B] border border-[#3DFF6B]/40 hover:bg-[#3DFF6B] hover:text-black rounded transition-all flex items-center gap-1.5"
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
              <th className="py-3 px-4 w-20 text-center">Thứ Tự</th>
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
                  <tr key={team.id} className="hover:bg-[#202529]/40 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <div className="w-6 h-6 rounded bg-[#3DFF6B]/20 text-[#3DFF6B] font-bold mx-auto flex items-center justify-center border border-[#3DFF6B]/40">
                        {team.draftOrder || idx + 1}
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
                            onClick={() => {
                              setLinkingTeamId(team.id)
                              setNewUsername(`${code.toLowerCase()}_captain`)
                              setNewPassword('password123')
                            }}
                            className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] hover:bg-amber-500/30"
                          >
                            + Tạo Tài Khoản
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
                          onClick={() => {
                            setLinkingTeamId(team.id)
                            setNewUsername(`${code.toLowerCase()}_captain`)
                            setNewPassword('password123')
                          }}
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
        <span className="text-[#3DFF6B]">Thứ tự Draft xoay vòng (Linear 1..N)</span>
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
          <div className="bg-[#181C1F] border border-[#2A3138] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Tạo &amp; Liên Kết Tài Khoản Đội Trưởng</h3>
            <p className="text-xs text-gray-400 mb-4">
              Tạo tài khoản TEAM_USER gán với đội này để đăng nhập tham gia Draft &amp; Cấm chọn.
            </p>
            <form onSubmit={handleCreateUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1">Tên Đăng Nhập</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-[#121517] border border-[#2A3138] focus:border-[#3DFF6B] text-sm text-white px-3 py-2 rounded outline-none font-mono"
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
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setLinkingTeamId(null)}
                  className="px-4 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Huỷ Bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#3DFF6B] text-black font-bold rounded text-xs uppercase"
                >
                  Tạo &amp; Liên Kết
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
