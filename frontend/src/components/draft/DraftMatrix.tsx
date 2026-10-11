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
    <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[460px] pr-1 select-none">
      {roundsArray.map((round) => {
        const isCurrentRound = round === currentRound
        const isPastRound = round < currentRound
        const category = getRoundCategoryLabel(round)
        const requiredForRound = getPicksCountForRound(round)

        return (
          <div key={round} className="flex items-stretch gap-1.5 min-h-[46px]">
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
              <div className="text-xs font-bold leading-tight">VÒNG {round}</div>
              <div
                className={`text-[9px] font-semibold leading-tight ${
                  isCurrentRound && status === 'PICKING'
                    ? 'text-black/80'
                    : category.isMain
                    ? 'text-emerald-400/90'
                    : 'text-amber-400/90'
                }`}
              >
                {category.label} ({category.count})
              </div>
            </div>

            {/* Team pick cells for this round */}
            <div className="flex-1 grid grid-flow-col auto-cols-fr gap-1.5">
              {teams.map((team, idx) => {
                const teamPicks = picksMap.get(`${round}_${team.id}`) || []
                const isSelectingNow =
                  isCurrentRound &&
                  team.id === currentTeamId &&
                  status === 'PICKING' &&
                  teamPicks.length < requiredForRound

                // 1. Picks made for this round
                if (teamPicks.length > 0) {
                  return (
                    <div
                      key={team.id}
                      className="bg-surface-card border border-border-default hover:border-border-prominent p-1 flex flex-col justify-center gap-1 transition-colors"
                    >
                      {teamPicks.map((pick) => {
                        const posStyle = getPositionStyle(pick.player.position)
                        const seasonCode = pick.player.season?.code || 'CARD'

                        return (
                          <div
                            key={pick.id}
                            className="flex items-center justify-between gap-1 group py-0.5"
                            title={`${pick.player.name} (${pick.player.position}) - ${seasonCode} · ${pick.salaryAtPick}M`}
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              <span
                                className={`px-1 py-0.2 font-mono text-[8px] font-black border shrink-0 ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
                              >
                                {pick.player.position}
                              </span>
                              <span className="bg-surface-elevated text-zinc-300 px-1 py-0.2 font-mono text-[8px] font-bold shrink-0 border border-border-default">
                                {seasonCode}
                              </span>
                              <span className="font-sans font-semibold text-xs text-white truncate group-hover:text-neon transition-colors">
                                {pick.player.name}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-zinc-400 font-semibold shrink-0">
                              {pick.salaryAtPick}M
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                }

                // 2. Currently Selecting (Active Turn)
                if (isSelectingNow) {
                  return (
                    <div
                      key={team.id}
                      className="bg-neon text-black border border-neon p-2 flex items-center justify-between gap-2 shadow-[0_0_16px_rgba(61,255,107,0.35)] relative overflow-hidden"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-black animate-ping shrink-0" />
                        <span className="font-display font-black text-xs uppercase tracking-wider truncate">
                          ĐANG CHỌN ({requiredForRound} CẦU THỦ)...
                        </span>
                      </div>
                      <span className="bg-black text-neon font-mono text-[9px] px-1.5 py-0.5 font-bold uppercase shrink-0">
                        LƯỢT {currentTurn}
                      </span>
                    </div>
                  )
                }

                // 3. Upcoming slot in active round
                if (isCurrentRound && status === 'PICKING') {
                  const activeIdx = teams.findIndex((t) => t.id === currentTeamId)
                  const isOnDeck = idx === (activeIdx + 1) % teams.length

                  return (
                    <div
                      key={team.id}
                      className="bg-surface-panel/40 border border-border-subtle/50 p-2 flex items-center justify-center text-zinc-500 font-mono text-[10px]"
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
                    className="bg-app-void/40 border border-border-default/20 p-2 flex items-center justify-center text-zinc-600 font-mono text-[10px]"
                  >
                    V{round} · {category.label} ({category.count})
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
