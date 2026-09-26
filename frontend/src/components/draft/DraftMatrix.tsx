import React from 'react'
import type { TeamDraftStatus, DraftPickBoardItem } from '@/types/domain'
import { getPositionStyle } from '@/lib/draft-utils'

interface DraftMatrixProps {
  teams: TeamDraftStatus[]
  picks: DraftPickBoardItem[]
  totalRounds: number
  currentRound: number
  currentTurn: number
  currentTeamId: string | null
  status: string
}

export const DraftMatrix: React.FC<DraftMatrixProps> = ({
  teams,
  picks,
  totalRounds = 24,
  currentRound,
  currentTurn,
  currentTeamId,
  status,
}) => {
  // Build a lookup map: `${round}_${teamId}` -> DraftPickBoardItem
  const picksMap = React.useMemo(() => {
    const map = new Map<string, DraftPickBoardItem>()
    for (const p of picks) {
      map.set(`${p.round}_${p.team.id}`, p)
    }
    return map
  }, [picks])

  const roundsArray = Array.from({ length: totalRounds }, (_, i) => i + 1)

  return (
    <div className="flex flex-col gap-1 overflow-y-auto max-h-[420px] pr-1 select-none">
      {roundsArray.map((round) => {
        const isCurrentRound = round === currentRound
        const isPastRound = round < currentRound

        return (
          <div key={round} className="flex items-stretch gap-1 min-h-[42px]">
            {/* Round label cell */}
            <div
              className={`w-14 shrink-0 flex items-center justify-center font-mono text-xs font-bold border ${
                isCurrentRound && status === 'PICKING'
                  ? 'bg-neon text-black border-neon shadow-[0_0_10px_rgba(61,255,107,0.3)]'
                  : isPastRound
                  ? 'bg-surface-panel/80 text-zinc-400 border-border-default/40'
                  : 'bg-app-void text-zinc-600 border-border-default/20'
              }`}
            >
              V{round}
            </div>

            {/* Team pick cells for this round */}
            <div className="flex-1 grid grid-flow-col auto-cols-fr gap-1">
              {teams.map((team, idx) => {
                const pick = picksMap.get(`${round}_${team.id}`)
                const isSelectingNow =
                  isCurrentRound &&
                  team.id === currentTeamId &&
                  status === 'PICKING' &&
                  !pick

                // 1. Pick already made
                if (pick) {
                  const posStyle = getPositionStyle(pick.player.position)
                  const seasonCode = pick.player.season?.code || 'CARD'

                  return (
                    <div
                      key={team.id}
                      className="bg-surface-card border border-border-default hover:border-border-prominent p-1.5 flex items-center justify-between gap-1.5 transition-colors group"
                      title={`${pick.player.name} (${pick.player.position}) - ${seasonCode} · ${pick.salaryAtPick}M`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Position Tag */}
                        <span
                          className={`px-1 py-0.5 font-mono text-[9px] font-black border rounded-none shrink-0 ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
                        >
                          {pick.player.position}
                        </span>

                        {/* Season Code Tag */}
                        <span className="bg-surface-elevated text-zinc-300 px-1 py-0.5 font-mono text-[9px] font-bold tracking-wider shrink-0 border border-border-default">
                          {seasonCode}
                        </span>

                        {/* Player Name */}
                        <span className="font-sans font-semibold text-xs text-white truncate group-hover:text-neon transition-colors">
                          {pick.player.name}
                        </span>
                      </div>

                      {/* Salary */}
                      <span className="font-mono text-[10px] text-zinc-400 font-semibold shrink-0">
                        {pick.salaryAtPick}M
                      </span>
                    </div>
                  )
                }

                // 2. Currently Selecting (Active Turn)
                if (isSelectingNow) {
                  return (
                    <div
                      key={team.id}
                      className="bg-neon text-black border border-neon p-1.5 flex items-center justify-between gap-2 shadow-[0_0_16px_rgba(61,255,107,0.35)] relative overflow-hidden"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-black animate-ping shrink-0" />
                        <span className="font-display font-black text-xs uppercase tracking-wider truncate">
                          ĐANG CHỌN...
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
                      className="bg-surface-panel/40 border border-border-subtle/50 p-1.5 flex items-center justify-center text-zinc-500 font-mono text-[10px]"
                    >
                      {isOnDeck ? (
                        <span className="text-warning font-semibold animate-pulse">
                          CHUẨN BỊ · LƯỢT {currentTurn + 1}
                        </span>
                      ) : (
                        <span>CHỜ LƯỢT</span>
                      )}
                    </div>
                  )
                }

                // 4. Future rounds slot
                return (
                  <div
                    key={team.id}
                    className="bg-app-void/40 border border-border-default/20 p-1.5 flex items-center justify-center text-zinc-600 font-mono text-[10px]"
                  >
                    VÒNG {round}
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
