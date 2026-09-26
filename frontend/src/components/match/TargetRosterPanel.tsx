import React from 'react'
import type { RosterItem, MatchBanItem } from '@/types/domain'

interface TargetRosterPanelProps {
  targetTeamName: string
  targetTeamId: string
  roster: RosterItem[]
  bans: MatchBanItem[]
  maxBans: number
  isLocked: boolean
  isPendingAction: boolean
  onSelectBan: (playerSeasonId: string) => void
  onRemoveBan: (banId: string) => void
}

const getPositionColor = (pos: string) => {
  const p = pos.toUpperCase()
  if (['ST', 'CF'].includes(p)) return 'text-amber-400 bg-amber-400/10'
  if (['CAM', 'SS'].includes(p)) return 'text-purple-400 bg-purple-400/10'
  if (['CB', 'SW'].includes(p)) return 'text-blue-400 bg-blue-400/10'
  if (['GK'].includes(p)) return 'text-yellow-400 bg-yellow-400/10'
  if (['CDM'].includes(p)) return 'text-emerald-400 bg-emerald-400/10'
  if (['LW', 'RW', 'LM', 'RM'].includes(p)) return 'text-cyan-400 bg-cyan-400/10'
  if (['CM'].includes(p)) return 'text-indigo-400 bg-indigo-400/10'
  if (['RB', 'LB', 'RWB', 'LWB'].includes(p)) return 'text-sky-400 bg-sky-400/10'
  return 'text-zinc-300 bg-zinc-800'
}

export const TargetRosterPanel: React.FC<TargetRosterPanelProps> = ({
  targetTeamName,
  targetTeamId,
  roster,
  bans,
  maxBans,
  isLocked,
  isPendingAction,
  onSelectBan,
  onRemoveBan,
}) => {
  // Map bans by playerSeasonId for quick lookup
  const banByPlayerSeasonId = new Map<string, MatchBanItem>()
  bans.forEach((b) => {
    banByPlayerSeasonId.set(b.playerSeasonId, b)
  })

  const currentCount = bans.length
  const progressPercent = Math.min(100, Math.round((currentCount / maxBans) * 100))
  const remainingCount = Math.max(0, maxBans - currentCount)

  return (
    <section
      className="bg-[#13151b] border-2 border-[#2b2e3c] rounded-xl p-4 flex flex-col h-[650px] shadow-2xl relative overflow-hidden"
      data-purpose="opponent-target-column"
    >
      {/* Top Target Header & Quota Progress */}
      <div className="flex flex-col gap-2 pb-3 border-b border-[#242836] mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8 0-1.859.64-3.57 1.713-4.935l11.222 11.222C13.57 19.36 11.859 20 12 20zm6.287-3.065L7.065 5.713C8.43 4.64 10.141 4 12 4c4.411 0 8 3.589 8 8 0 1.859-.64 3.57-1.713 4.935z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm tracking-wide">
                {targetTeamName.toUpperCase()} · ĐỘI HÌNH ĐỐI THỦ (MỤC TIÊU CẤM)
              </h3>
              <p className="text-[11px] text-zinc-400">
                Nhấp vào cầu thủ để chọn cấm. Yêu cầu chọn chính xác {maxBans} thẻ cấm.
              </p>
            </div>
          </div>

          {/* Counter Pill */}
          <div className="text-right">
            <div className="inline-flex items-center gap-2 bg-[#1c1822] border border-red-500/40 px-3 py-1 rounded-md">
              <span className="text-xs font-mono text-zinc-300">Số Thẻ Cấm:</span>
              <span className="font-mono font-bold text-sm text-red-400">
                {currentCount} / {maxBans}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-[#1b1c24] h-2 rounded-full overflow-hidden border border-[#2b2e3c] flex">
          <div
            className="bg-gradient-to-r from-red-600 to-[#FF3B4E] h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between text-[11px] font-mono text-zinc-400">
          {remainingCount > 0 ? (
            <span className="text-amber-400 font-medium">
              ⚠️ Cần chọn thêm {remainingCount} thẻ cấm để khoá lượt
            </span>
          ) : (
            <span className="text-[#3DFF6B] font-medium">
              🔒 Đã chọn đủ {maxBans} thẻ cấm mục tiêu &amp; mã hoá
            </span>
          )}
          <span className="text-zinc-500">TỐI ĐA: {maxBans} THẺ CẤM</span>
        </div>
      </div>

      {/* Scrollable List of Opponent's 24 Players */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 select-none">
        {roster.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-xs">
            Chưa có danh sách cầu thủ cho đội đối thủ.
          </div>
        ) : (
          roster.map((item, idx) => {
            const ban = banByPlayerSeasonId.get(item.player.playerSeasonId)
            const isBanned = !!ban
            const canSelect = !isBanned && !isLocked && currentCount < maxBans && !isPendingAction
            const canRemove = isBanned && !isLocked && !isPendingAction

            return (
              <div
                key={item.pickId || `${item.player.playerSeasonId}-${idx}`}
                onClick={() => {
                  if (canSelect) {
                    onSelectBan(item.player.playerSeasonId)
                  }
                }}
                className={`flex items-center justify-between p-2 rounded transition ${
                  isBanned
                    ? 'relative bg-red-950/40 border-2 border-red-500/80 text-red-200 shadow-[inset_0_0_12px_rgba(255,59,78,0.2)]'
                    : canSelect
                      ? 'group bg-[#171922] border border-[#232735] hover:border-red-500/60 hover:bg-[#1f1b22] cursor-pointer'
                      : 'bg-[#171922]/60 border border-[#232735] opacity-60 cursor-not-allowed text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-10 text-center text-xs font-mono font-bold py-0.5 rounded ${
                      isBanned
                        ? 'text-red-400 bg-red-500/20 line-through border border-red-500/40'
                        : getPositionColor(item.player.position)
                    }`}
                  >
                    {item.player.position}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isBanned ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {item.player.season.code}
                  </span>
                  <span
                    className={`font-semibold text-sm ${
                      isBanned
                        ? 'text-white line-through decoration-red-500 decoration-2'
                        : 'text-white group-hover:text-red-300 transition'
                    }`}
                  >
                    {item.player.name}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className={isBanned ? 'text-red-300' : 'text-zinc-400'}>
                    OVR <strong className={isBanned ? 'text-white font-bold' : 'text-white'}>{item.player.rating}</strong>
                  </span>

                  {isBanned ? (
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-red-600 text-white font-black text-xs tracking-wider uppercase font-mono shadow-md flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            clipRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            fillRule="evenodd"
                          />
                        </svg>
                        ĐÃ CẤM
                      </span>
                      {canRemove && ban && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveBan(ban.id)
                          }}
                          title="Gỡ cấm"
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs border border-zinc-700 transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canSelect}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (canSelect) {
                          onSelectBan(item.player.playerSeasonId)
                        }
                      }}
                      className="px-2.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 group-hover:border-red-500 group-hover:bg-red-500/20 group-hover:text-red-300 text-[11px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      + CẤM
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Opponent column footer */}
      <div className="mt-3 pt-2.5 border-t border-[#232735] flex items-center justify-between text-xs text-zinc-400 font-mono">
        <span className="text-zinc-300 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Chế độ cấm mục tiêu: Đối thủ sẽ nhận thông báo thẻ cấm sau khi cả 2 bên cùng khoá
        </span>
        <span className="text-zinc-500">{targetTeamId.substring(0, 8)}</span>
      </div>
    </section>
  )
}
