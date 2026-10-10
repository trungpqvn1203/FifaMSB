import { Trophy, Award, TrendingUp, ShieldAlert, Flame } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { TeamStanding } from '@/types/domain'

interface TournamentStandingsSectionProps {
  standings: TeamStanding[]
  isLoading?: boolean
  totalMatchesCount?: number
  completedMatchesCount?: number
}

export const TournamentStandingsSection: React.FC<TournamentStandingsSectionProps> = ({
  standings,
  isLoading = false,
  totalMatchesCount = 0,
  completedMatchesCount = 0,
}) => {
  if (isLoading) {
    return (
      <Card className="p-8 text-center bg-surface-card border-border-default">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-neon border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
            Đang tải bảng xếp hạng giải đấu...
          </span>
        </div>
      </Card>
    )
  }

  if (!standings || standings.length === 0) {
    return (
      <Card className="p-8 text-center bg-surface-card border-dashed border-border-subtle">
        <Trophy className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
        <p className="font-display font-medium text-white text-sm">
          Chưa có dữ liệu bảng xếp hạng
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          Bảng xếp hạng sẽ tự động cập nhật ngay khi các trận đấu được ghi nhận tỉ số.
        </p>
      </Card>
    )
  }

  // Calculate summary highlights
  const leader = standings[0]
  const totalGoals = standings.reduce((sum, s) => sum + s.goalsFor, 0)
  const topScorerTeam = [...standings].sort((a, b) => b.goalsFor - a.goalsFor)[0]
  const bestDefenseTeam = [...standings]
    .filter((s) => s.played > 0)
    .sort((a, b) => a.goalsAgainst - b.goalsAgainst)[0]

  return (
    <div className="flex flex-col gap-6" data-purpose="tournament-standings">
      {/* Top Highlights Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Leader Card */}
        <Card className="p-4 bg-gradient-to-br from-[#1a1c23] via-[#14151b] to-[#121318] border-amber-500/30 flex items-center gap-3.5 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Trophy className="w-24 h-24 text-amber-400" />
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,197,24,0.15)]">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
              ĐỘI DẪN ĐẦU (#1)
            </span>
            <h4 className="text-sm font-display font-black text-white truncate uppercase">
              {leader ? leader.teamName : '---'}
            </h4>
            <span className="text-xs font-mono text-zinc-400">
              {leader ? `${leader.points} Điểm (HS: ${leader.goalDifference > 0 ? `+${leader.goalDifference}` : leader.goalDifference})` : '0 Điểm'}
            </span>
          </div>
        </Card>

        {/* Matches Completed */}
        <Card className="p-4 bg-surface-card border-border-subtle flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-neon/10 border border-neon/30 flex items-center justify-center text-neon shrink-0 shadow-[0_0_15px_rgba(61,255,107,0.1)]">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
              TIẾN ĐỘ TRẬN ĐẤU
            </span>
            <h4 className="text-lg font-mono font-black text-white">
              {completedMatchesCount} / {totalMatchesCount}
            </h4>
            <span className="text-xs font-mono text-zinc-400">
              {totalMatchesCount > 0
                ? `${Math.round((completedMatchesCount / totalMatchesCount) * 100)}% Hoàn thành`
                : 'Chưa có trận'}
            </span>
          </div>
        </Card>

        {/* Total Goals Scored */}
        <Card className="p-4 bg-surface-card border-border-subtle flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-cyan/10 border border-cyan/30 flex items-center justify-center text-cyan shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
              TỔNG BÀN THẮNG
            </span>
            <h4 className="text-lg font-mono font-black text-white">{totalGoals} Bàn</h4>
            <span className="text-xs font-mono text-zinc-400 truncate block">
              {topScorerTeam && topScorerTeam.goalsFor > 0
                ? `Vua phá lưới: ${topScorerTeam.teamName} (${topScorerTeam.goalsFor})`
                : 'Chưa có bàn thắng'}
            </span>
          </div>
        </Card>

        {/* Best Defense */}
        <Card className="p-4 bg-surface-card border-border-subtle flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
              THỦNG LƯỚI ÍT NHẤT
            </span>
            <h4 className="text-sm font-display font-black text-white truncate uppercase">
              {bestDefenseTeam ? bestDefenseTeam.teamName : '---'}
            </h4>
            <span className="text-xs font-mono text-zinc-400">
              {bestDefenseTeam ? `${bestDefenseTeam.goalsAgainst} Bàn thua` : 'Chưa đấu'}
            </span>
          </div>
        </Card>
      </div>

      {/* Main Leaderboard Table */}
      <Card className="bg-surface-card border-border-default overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="font-display font-extrabold text-base text-white uppercase tracking-wider">
              Bảng Xếp Hạng &amp; Điểm Số Giải Đấu
            </h3>
            <Badge variant="neon" className="font-mono text-[10px]">
              QUY CHUẨN: THẮNG 3đ · HOÀ 1đ · THUA 0đ
            </Badge>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            Ưu tiên xếp hạng: Điểm &gt; Hiệu số &gt; Bàn thắng &gt; Thứ tự bốc thăm
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#121319] text-zinc-400 uppercase text-[11px] border-b border-border-subtle">
                <th className="py-3 px-4 text-center font-bold w-14">#</th>
                <th className="py-3 px-4 font-bold min-w-[200px]">Đội Tuyển</th>
                <th className="py-3 px-3 text-center font-bold" title="Số trận đã đấu">
                  TRẬN
                </th>
                <th className="py-3 px-3 text-center font-bold text-emerald-400" title="Thắng">
                  T
                </th>
                <th className="py-3 px-3 text-center font-bold text-amber-400" title="Hoà">
                  H
                </th>
                <th className="py-3 px-3 text-center font-bold text-rose-400" title="Thua">
                  B
                </th>
                <th className="py-3 px-3 text-center font-bold" title="Bàn Thắng">
                  BT
                </th>
                <th className="py-3 px-3 text-center font-bold" title="Bàn Thua">
                  BB
                </th>
                <th className="py-3 px-3 text-center font-bold" title="Hiệu Số">
                  HS
                </th>
                <th className="py-3 px-4 text-center font-bold text-[#3DFF6B] bg-[#3DFF6B]/5">
                  ĐIỂM
                </th>
                <th className="py-3 px-4 text-center font-bold min-w-[120px]">Phong Độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {standings.map((team, idx) => {
                const rank = idx + 1
                const isFirst = rank === 1
                const isSecond = rank === 2
                const isThird = rank === 3

                const rankBadgeClass = isFirst
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-[0_0_10px_rgba(245,197,24,0.2)]'
                  : isSecond
                  ? 'bg-slate-300/20 text-slate-200 border-slate-300/40'
                  : isThird
                  ? 'bg-amber-700/20 text-amber-500 border-amber-700/40'
                  : 'bg-surface-elevated text-zinc-400 border-border-subtle'

                const gdText =
                  team.goalDifference > 0
                    ? `+${team.goalDifference}`
                    : team.goalDifference === 0
                    ? '0'
                    : `${team.goalDifference}`

                const gdColor =
                  team.goalDifference > 0
                    ? 'text-emerald-400'
                    : team.goalDifference < 0
                    ? 'text-rose-400'
                    : 'text-zinc-400'

                return (
                  <tr
                    key={team.teamId}
                    className={`hover:bg-white/[0.02] transition-colors ${
                      isFirst ? 'bg-amber-500/[0.03]' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3.5 px-4 text-center font-bold">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-black border ${rankBadgeClass}`}
                      >
                        {rank}
                      </span>
                    </td>

                    {/* Team Name */}
                    <td className="py-3.5 px-4 font-display font-bold text-sm text-white">
                      <div className="flex items-center gap-2">
                        {isFirst && <Award className="w-4 h-4 text-amber-400 shrink-0" />}
                        <span className="truncate">{team.teamName}</span>
                      </div>
                    </td>

                    {/* Played */}
                    <td className="py-3.5 px-3 text-center text-zinc-300 font-semibold">
                      {team.played}
                    </td>

                    {/* Won */}
                    <td className="py-3.5 px-3 text-center font-bold text-emerald-400">
                      {team.won}
                    </td>

                    {/* Drawn */}
                    <td className="py-3.5 px-3 text-center text-amber-400 font-semibold">
                      {team.drawn}
                    </td>

                    {/* Lost */}
                    <td className="py-3.5 px-3 text-center text-rose-400 font-semibold">
                      {team.lost}
                    </td>

                    {/* Goals For */}
                    <td className="py-3.5 px-3 text-center text-zinc-300">{team.goalsFor}</td>

                    {/* Goals Against */}
                    <td className="py-3.5 px-3 text-center text-zinc-400">{team.goalsAgainst}</td>

                    {/* Goal Difference */}
                    <td className={`py-3.5 px-3 text-center font-bold ${gdColor}`}>{gdText}</td>

                    {/* Points */}
                    <td className="py-3.5 px-4 text-center font-black text-base text-[#3DFF6B] bg-[#3DFF6B]/5">
                      {team.points}
                    </td>

                    {/* Form Pills */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {team.form && team.form.length > 0 ? (
                          team.form.map((f, fIdx) => {
                            if (f === 'W') {
                              return (
                                <span
                                  key={fIdx}
                                  className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold flex items-center justify-center"
                                  title="Thắng"
                                >
                                  T
                                </span>
                              )
                            } else if (f === 'D') {
                              return (
                                <span
                                  key={fIdx}
                                  className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold flex items-center justify-center"
                                  title="Hòa"
                                >
                                  H
                                </span>
                              )
                            } else {
                              return (
                                <span
                                  key={fIdx}
                                  className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-bold flex items-center justify-center"
                                  title="Bại"
                                >
                                  B
                                </span>
                              )
                            }
                          })
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
