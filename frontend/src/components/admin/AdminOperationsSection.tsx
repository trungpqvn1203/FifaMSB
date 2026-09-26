import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, Pause, XCircle, Swords, Radio } from 'lucide-react'
import type { DraftDetail, MatchDetail, Team } from '@/types/domain'

interface AdminOperationsProps {
  tournamentId: string
  draftInfo: DraftDetail | null
  teams: Team[]
  matches: MatchDetail[]
  onStartDraft: () => void
  onPauseDraft: (draftId: string) => void
  onResumeDraft: (draftId: string) => void
  onCancelDraft: (draftId: string) => void
  onScheduleMatch: (homeTeamId: string, awayTeamId: string) => void
  onStartBanPhase: (matchId: string) => void
  onCompleteMatch: (matchId: string) => void
  isSubmitting?: boolean
}

export const AdminOperationsSection: React.FC<AdminOperationsProps> = ({
  tournamentId,
  draftInfo,
  teams,
  matches,
  onStartDraft,
  onPauseDraft,
  onResumeDraft,
  onCancelDraft,
  onScheduleMatch,
  onStartBanPhase,
  onCompleteMatch,
  isSubmitting = false,
}) => {
  const [homeTeamId, setHomeTeamId] = useState(teams[0]?.id || '')
  const [awayTeamId, setAwayTeamId] = useState(teams[1]?.id || '')
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!homeTeamId || !awayTeamId) {
      setScheduleError('Please select both teams.')
      return
    }
    if (homeTeamId === awayTeamId) {
      setScheduleError('Home Team and Away Team cannot be the same.')
      return
    }
    setScheduleError(null)
    onScheduleMatch(homeTeamId, awayTeamId)
  }

  return (
    <section id="draft-operations" className="bg-[#121517] border border-[#2A3138] rounded-xl p-6 relative overflow-hidden space-y-6">
      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400" />
      <div className="flex items-center justify-between pb-4 border-b border-[#2A3138]">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center">
            06
          </span>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Bảng Điều Khiển Vận Hành Draft &amp; Trận Đấu
            </h2>
            <p className="text-xs text-gray-400">
              Kiểm soát vòng đời phiên Draft thời gian thực, tạm dừng/tiếp tục đồng hồ và lên lịch trận đấu
            </p>
          </div>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded border border-cyan-400/20">
          Trung Tâm Điều Khiển
        </span>
      </div>

      {/* Grid: Left Draft Controls / Right Match Scheduling */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Draft Controls */}
        <div className="lg:col-span-6 bg-[#181C1F] border border-[#2A3138] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#2A3138]">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#3DFF6B] animate-pulse" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Vòng Đời Phiên Draft
              </h3>
            </div>
            <span
              className={`text-xs font-mono px-2.5 py-0.5 rounded font-bold uppercase ${
                draftInfo?.status === 'PICKING'
                  ? 'bg-[#3DFF6B]/20 text-[#3DFF6B] border border-[#3DFF6B]/30'
                  : draftInfo?.status === 'PAUSED'
                    ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                    : draftInfo?.status === 'COMPLETED'
                      ? 'bg-purple-400/20 text-purple-400 border border-purple-400/30'
                      : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {draftInfo?.status === 'PICKING'
                ? 'ĐANG PICK'
                : draftInfo?.status === 'PAUSED'
                  ? 'TẠM DỪNG'
                  : draftInfo?.status === 'COMPLETED'
                    ? 'HOÀN THÀNH'
                    : 'CHƯA BẮT ĐẦU'}
            </span>
          </div>

          {draftInfo ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#121517] p-2.5 rounded border border-[#2A3138]">
                  <span className="text-gray-400 block text-[10px]">ROUND HIỆN TẠI</span>
                  <span className="text-white font-bold text-sm">Round #{draftInfo.currentRound}</span>
                </div>
                <div className="bg-[#121517] p-2.5 rounded border border-[#2A3138]">
                  <span className="text-gray-400 block text-[10px]">LƯỢT HIỆN TẠI</span>
                  <span className="text-white font-bold text-sm">Lượt #{draftInfo.currentTurn}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {draftInfo.status === 'PICKING' && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => onPauseDraft(draftInfo.id)}
                    className="px-3.5 py-2 rounded bg-amber-400 hover:bg-amber-500 text-black font-bold text-xs uppercase flex items-center gap-1.5 transition"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Tạm Dừng Draft
                  </button>
                )}

                {draftInfo.status === 'PAUSED' && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => onResumeDraft(draftInfo.id)}
                    className="px-3.5 py-2 rounded bg-[#3DFF6B] hover:bg-[#2ceb58] text-black font-bold text-xs uppercase flex items-center gap-1.5 transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Tiếp Tục Draft
                  </button>
                )}

                {draftInfo.status !== 'COMPLETED' && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => onCancelDraft(draftInfo.id)}
                    className="px-3.5 py-2 rounded bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs uppercase flex items-center gap-1.5 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Huỷ Phiên Draft
                  </button>
                )}

                <Link
                  to={`/tournaments/${tournamentId}/draft`}
                  className="px-4 py-2 rounded bg-[#202529] hover:bg-[#2A3138] text-white text-xs uppercase flex items-center gap-1.5 transition border border-[#2A3138]"
                >
                  <Radio className="w-3.5 h-3.5 text-[#3DFF6B]" />
                  Mở Bảng Draft Trực Tiếp
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center py-4">
              <p className="text-xs text-gray-400">
                Chưa có phiên Draft nào. Bắt đầu phiên Draft sau khi đã cấu hình xong danh sách đội và luật thẻ.
              </p>
              <button
                type="button"
                disabled={teams.length < 2 || isSubmitting}
                onClick={onStartDraft}
                className="px-5 py-2 rounded bg-[#3DFF6B] hover:bg-[#2ceb58] text-black font-bold text-xs uppercase tracking-wide flex items-center gap-2 mx-auto transition disabled:opacity-40"
              >
                <Play className="w-4 h-4" />
                Bắt Đầu Phiên Draft
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Match Operations & Schedule */}
        <div className="lg:col-span-6 bg-[#181C1F] border border-[#2A3138] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#2A3138]">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Trận Đấu &amp; Cấm Chọn (Ban) ({matches.length})
              </h3>
            </div>
            <span className="text-xs font-mono text-gray-400">Tích hợp Realtime</span>
          </div>

          {/* Quick Match Schedule Form */}
          <form onSubmit={handleScheduleSubmit} className="space-y-3 font-mono text-xs">
            {scheduleError && (
              <div className="p-2 bg-red-950/60 border border-red-500/40 text-red-300 rounded text-[11px]">
                {scheduleError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-[10px] block mb-1">ĐỘI NHÀ (HOME)</label>
                <select
                  value={homeTeamId}
                  onChange={(e) => setHomeTeamId(e.target.value)}
                  className="w-full bg-[#121517] border border-[#2A3138] text-white p-2 rounded outline-none"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-[10px] block mb-1">ĐỘI KHÁCH (AWAY)</label>
                <select
                  value={awayTeamId}
                  onChange={(e) => setAwayTeamId(e.target.value)}
                  className="w-full bg-[#121517] border border-[#2A3138] text-white p-2 rounded outline-none"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={teams.length < 2 || isSubmitting}
              className="w-full py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded font-bold text-xs uppercase transition disabled:opacity-40"
            >
              + Lên Lịch Trận Đấu
            </button>
          </form>

          {/* Matches List */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {matches.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2.5 rounded bg-[#121517] border border-[#2A3138] text-xs font-mono"
              >
                <div>
                  <span className="text-white font-bold">
                    {m.homeTeam.name} vs {m.awayTeam.name}
                  </span>
                  <span className="block text-[10px] text-gray-400">
                    Trạng thái: <strong className="text-amber-400">{m.status}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {m.status === 'SCHEDULED' && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => onStartBanPhase(m.id)}
                      className="px-2.5 py-1 bg-[#3DFF6B]/15 text-[#3DFF6B] border border-[#3DFF6B]/30 hover:bg-[#3DFF6B] hover:text-black rounded text-[11px] font-bold uppercase transition"
                    >
                      Bắt Đầu Ban
                    </button>
                  )}

                  {m.status === 'BANS_LOCKED' && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => onCompleteMatch(m.id)}
                      className="px-2.5 py-1 bg-white text-black rounded text-[11px] font-bold uppercase hover:bg-zinc-200 transition"
                    >
                      Hoàn Thành
                    </button>
                  )}

                  <Link
                    to={`/tournaments/${tournamentId}/matches/${m.id}/bans`}
                    className="px-2.5 py-1 bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white border border-rose-500/30 rounded text-[11px] font-bold uppercase transition"
                  >
                    Vào Phòng Cấm Chọn
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
