import React from 'react'
import type { RosterItem, MatchBanItem } from '@/types/domain'

interface FriendlyRosterPanelProps {
  teamName: string
  teamId: string
  roster: RosterItem[]
  bansRevealed: boolean
  opponentBans: MatchBanItem[]
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

export const FriendlyRosterPanel: React.FC<FriendlyRosterPanelProps> = ({
  teamName,
  teamId,
  roster,
  bansRevealed,
  opponentBans,
}) => {
  // Map of banned player season ids against this friendly team
  const bannedPlayerSeasonIds = new Set(
    opponentBans
      .filter((b) => b.targetTeamId === teamId)
      .map((b) => b.playerSeasonId)
  )

  const totalCap = roster.reduce((sum, item) => sum + (item.player.salary || 0), 0)

  return (
    <section
      className="bg-[#13151b] border border-[#222632] rounded-xl p-4 flex flex-col h-[650px] shadow-2xl relative overflow-hidden"
      data-purpose="friendly-roster-column"
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#242836] mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-emerald-500/10 text-[#3DFF6B] border border-emerald-500/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-white text-sm tracking-wide">
              {teamName.toUpperCase()} · ĐỘI HÌNH ĐĂNG KÝ ({roster.length} CẦU THỦ)
            </h3>
            <p className="text-[11px] text-zinc-400">
              {bansRevealed
                ? 'Đã công bố danh sách cấm. Các thẻ bị gạch tên không thể ra sân trong trận đấu.'
                : 'Đội hình của bạn. Đối thủ đang chọn thẻ cấm từ danh sách này.'}
            </p>
          </div>
        </div>
        <div className="text-right">
          {bansRevealed ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/40 border border-red-500/40 text-[11px] text-red-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-red-500" /> ĐÃ CÔNG BỐ THẺ CẤM
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1a1e27] border border-[#2c3242] text-[11px] text-zinc-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#3DFF6B]" /> ĐƯỢC BẢO VỆ (CHỌN ẨN)
            </span>
          )}
        </div>
      </div>

      {/* Subheader Filter & Counter info */}
      <div className="flex items-center justify-between text-xs text-zinc-400 mb-2 px-1 font-mono">
        <span>
          {roster.length} CẦU THỦ ({Math.min(11, roster.length)} ĐÁ CHÍNH ·{' '}
          {Math.max(0, roster.length - 11)} DỰ BỊ)
        </span>
        <span>TỔNG LƯƠNG: {totalCap}/305</span>
      </div>

      {/* Scrollable Grid of Players */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
        {roster.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 font-mono text-xs">
            Chưa có danh sách cầu thủ. Phiên draft đang diễn ra hoặc đang đồng bộ.
          </div>
        ) : (
          roster.map((item, idx) => {
            const isBanned = bansRevealed && bannedPlayerSeasonIds.has(item.player.playerSeasonId)
            const isStarter = idx < 11

            return (
              <div
                key={item.pickId || `${item.player.playerSeasonId}-${idx}`}
                className={`flex items-center justify-between p-2 rounded transition ${
                  isBanned
                    ? 'bg-red-950/40 border-2 border-red-500/80 text-red-200 shadow-[inset_0_0_12px_rgba(255,59,78,0.2)]'
                    : isStarter
                      ? 'bg-[#171922] border border-[#232735] hover:border-zinc-700'
                      : 'bg-[#171922]/80 border border-[#232735] text-zinc-400 hover:border-zinc-700'
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
                        : isStarter
                          ? 'text-white'
                          : 'text-zinc-200'
                    }`}
                  >
                    {item.player.name}
                  </span>
                </div>

                <div className="flex items-center gap-4 font-mono text-xs">
                  <span className={isBanned ? 'text-red-300' : 'text-zinc-400'}>
                    OVR <strong className={isBanned ? 'text-white font-bold' : 'text-white'}>{item.player.rating}</strong>
                  </span>
                  <span className="text-zinc-500">
                    LƯƠNG <strong className="text-zinc-300">{item.player.salary}</strong>
                  </span>

                  {isBanned ? (
                    <span className="px-2.5 py-0.5 rounded bg-red-600 text-white font-black text-xs tracking-wider uppercase font-mono shadow-md flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          clipRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          fillRule="evenodd"
                        />
                      </svg>
                      BỊ CẤM
                    </span>
                  ) : isStarter ? (
                    <span className="px-2 py-0.5 text-[10px] rounded bg-[#202533] text-[#3DFF6B] border border-[#3DFF6B]/30 font-semibold">
                      ĐÁ CHÍNH
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-mono">DỰ BỊ</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer indicator */}
      <div className="mt-3 pt-2.5 border-t border-[#232735] flex items-center justify-between text-xs text-zinc-400 font-mono">
        <span className="flex items-center gap-1.5 text-zinc-300">
          <span
            className={`w-2 h-2 rounded-full ${bansRevealed ? 'bg-red-500' : 'bg-[#3DFF6B]'}`}
          />
          {bansRevealed
            ? `Phân tích mục tiêu hoàn tất · ${bannedPlayerSeasonIds.size} thẻ bị cấm`
            : 'Khiên bảo vệ kích hoạt · Thẻ cấm của đối thủ đang ẩn'}
        </span>
        <span className="text-zinc-500">{teamId.substring(0, 8)}</span>
      </div>
    </section>
  )
}
