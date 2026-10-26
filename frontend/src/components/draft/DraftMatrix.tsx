import React from 'react'
import type { TeamDraftStatus, DraftPickBoardItem } from '@/types/domain'
import { getPositionStyle, getPicksCountForRound, getRoundCategoryLabel } from '@/lib/draft-utils'

interface DraftMatrixProps {
  teams: TeamDraftStatus[]
  picks: DraftPickBoardItem[]
  totalRounds?: number
  currentRound: number
  currentTurn: number
  currentTeamId: string | null
  status: string
}

export const DraftMatrix: React.FC<DraftMatrixProps> = ({
  teams,
  picks,
  totalRounds = 11,
  currentRound,
  currentTurn,
  currentTeamId,
  status,
}) => {
  // Build a lookup map: `${round}_${teamId}` -> DraftPickBoardItem[]
  const picksMap = React.useMemo(() => {
    const map = new Map<string, DraftPickBoardItem[]>()
    for (const p of picks) {
      const key = `${p.round}_${p.team.id}`
      const list = map.get(key) || []
      list.push(p)
      map.set(key, list)
    }
    return map
  }, [picks])

  const roundsArray = Array.from({ length: totalRounds }, (_, i) => i + 1)

  return (
    <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[520px] pr-1 select-none">
      {roundsArray.map((round) => {
        const isCurrentRound = round === currentRound
        const isPastRound = round < currentRound
        const category = getRoundCategoryLabel(round)
        const requiredForRound = getPicksCountForRound(round)

        return (
          <div key={round} className="flex items-stretch gap-1.5 min-h-[38px]">
            {/* Round label cell */}
            <div
              className={`w-20 shrink-0 flex flex-col items-center justify-center font-mono py-1 border transition-colors ${
                isCurrentRound && status === 'PICKING'
                  ? 'bg-neon text-black border-neon shadow-[0_0_10px_rgba(61,255,107,0.3)]'
                  : isPastRound
                  ? 'bg-surface-panel/80 text-zinc-300 border-border-default/40'
                  : 'bg-app-void text-zinc-500 border-border-default/20'
              }`}
            >
              <div className="text-[11px] font-bold leading-tight font-mono">VÒNG {round}</div>
              <div
                className={`text-[9px] font-semibold leading-tight ${
                  isCurrentRound && status === 'PICKING'
                    ? 'text-black/90 font-bold'
                    : category.isMain
                    ? 'text-emerald-400/90'
                    : 'text-amber-400/90'
                }`}
              >
                {category.label} ({requiredForRound})
              </div>
            </div>

            {/* Team pick cells for this round */}
            <div className="flex-1 grid grid-flow-col auto-cols-fr gap-1.5">
              {teams.map((team, idx) => {
                const teamPicks = picksMap.get(`${round}_${team.id}`) || []
                const isCurrentTeam = team.id === currentTeamId
                const isSelectingNow =
                  isCurrentRound && isCurrentTeam && status === 'PICKING'
                const totalExpected = Math.max(requiredForRound, teamPicks.length)

                // Responsive grid columns based on team count and picks count
                const gridColsClass =
                  totalExpected === 1
                    ? 'grid-cols-1'
                    : totalExpected === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : teams.length <= 3
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'

                // 1. Currently active turn with no picks made yet
                if (isSelectingNow && teamPicks.length === 0) {
                  return (
                    <div
                      key={team.id}
                      className="bg-neon/15 text-neon border border-neon p-2 flex items-center justify-between gap-2 shadow-[0_0_16px_rgba(61,255,107,0.3)] relative overflow-hidden rounded-sm min-h-[38px]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-neon animate-ping shrink-0" />
                        <span className="font-display font-black text-xs text-white uppercase tracking-wider truncate">
                          ĐANG CHỌN ({requiredForRound} CẦU THỦ)...
                        </span>
                      </div>
                      <span className="bg-neon text-black font-mono text-[9px] px-1.5 py-0.5 font-bold uppercase shrink-0">
                        LƯỢT {currentTurn}
                      </span>
                    </div>
                  )
                }

                // 2. Picks made (or partial picks made)
                if (teamPicks.length > 0) {
                  return (
                    <div
                      key={team.id}
                      className={`bg-surface-card border ${
                        isSelectingNow
                          ? 'border-neon shadow-[0_0_12px_rgba(61,255,107,0.25)]'
                          : 'border-border-default hover:border-border-prominent'
                      } p-1 flex flex-col justify-center transition-all rounded-sm min-h-[38px]`}
                    >
                      <div className={`grid gap-1 w-full items-center ${gridColsClass}`}>
                        {/* Render existing picks */}
                        {teamPicks.map((pick) => {
                          const posStyle = getPositionStyle(pick.player.position)
                          const seasonCode = pick.player.season?.code || 'CARD'

                          return (
                            <div
                              key={pick.id}
                              className="flex items-center justify-between gap-1 group py-0.5 px-1.5 bg-surface-panel/70 border border-border-default/50 rounded-sm hover:border-neon/40 hover:bg-surface-elevated transition-all min-w-0"
                              title={`${pick.player.name} (${pick.player.position}) - ${seasonCode} · ${pick.salaryAtPick}M`}
                            >
                              <div className="flex items-center gap-1 min-w-0">
                                <span
                                  className={`px-1 py-[1px] font-mono text-[8px] font-black border rounded-[2px] shrink-0 leading-none ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
                                >
                                  {pick.player.position}
                                </span>
                                <span className="bg-surface-elevated text-zinc-300 px-1 py-[1px] font-mono text-[8px] font-bold shrink-0 border border-border-default/70 rounded-[2px] leading-none">
                                  {seasonCode}
                                </span>
                                <span className="font-sans font-semibold text-[11px] text-white truncate group-hover:text-neon transition-colors leading-tight">
                                  {pick.player.name}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-zinc-400 font-bold shrink-0 ml-1">
                                {pick.salaryAtPick}M
                              </span>
                            </div>
                          )
                        })}

                        {/* Render placeholder slots for unfilled picks if requiredForRound > teamPicks.length */}
                        {Array.from({
                          length: Math.max(0, requiredForRound - teamPicks.length),
                        }).map((_, slotIdx) => {
                          const slotNum = teamPicks.length + slotIdx + 1

                          if (isSelectingNow) {
                            return (
                              <div
                                key={`active-slot-${slotIdx}`}
                                className="flex items-center justify-between gap-1 py-1 px-1.5 border border-neon/60 bg-neon/10 rounded-sm animate-pulse min-w-0"
                              >
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-neon animate-ping shrink-0" />
                                  <span className="font-display font-bold text-[10px] text-neon uppercase truncate">
                                    ĐANG CHỌN #{slotNum}...
                                  </span>
                                </div>
                                <span className="bg-neon text-black font-mono text-[8px] px-1 font-bold shrink-0">
                                  L{currentTurn}
                                </span>
                              </div>
                            )
                          }

                          return (
                            <div
                              key={`empty-slot-${slotIdx}`}
                              className="flex items-center justify-center py-1 px-1.5 border border-dashed border-zinc-700/60 rounded-sm bg-app-void/40 text-zinc-500 font-mono text-[10px] select-none min-w-0"
                              title={`Vị trí ${slotNum}: Chưa chọn`}
                            >
                              <span className="opacity-60">+ Vị trí {slotNum}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }

                // 3. Upcoming slot in active round
                if (isCurrentRound && status === 'PICKING') {
                  const activeIdx = teams.findIndex((t) => t.id === currentTeamId)
                  const isOnDeck =
                    activeIdx !== -1 && idx === (activeIdx + 1) % teams.length

                  return (
                    <div
                      key={team.id}
                      className="bg-surface-panel/40 border border-border-subtle/50 p-2 flex items-center justify-center text-zinc-500 font-mono text-[10px] min-h-[38px] rounded-sm"
                    >
                      {isOnDeck ? (
                        <span className="text-warning font-semibold animate-pulse">
                          CHUẨN BỊ · LƯỢT {currentTurn + 1}
                        </span>
                      ) : (
                        <span>CHỜ LƯỢT ({requiredForRound})</span>
                      )}
                    </div>
                  )
                }

                // 4. Future rounds slot
                return (
                  <div
                    key={team.id}
                    className="bg-app-void/40 border border-border-default/20 p-2 flex items-center justify-center text-zinc-600 font-mono text-[10px] min-h-[38px] rounded-sm"
                  >
                    V{round} · {category.label} ({requiredForRound})
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

