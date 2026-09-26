import React from 'react'
import type { MatchTeamSummary, MatchRulesSnapshot } from '@/types/domain'

interface MatchScoreboardProps {
  homeTeam: MatchTeamSummary
  awayTeam: MatchTeamSummary
  userTeamId?: string | null
  rules: MatchRulesSnapshot
  status: 'SCHEDULED' | 'BAN_PHASE' | 'BANS_LOCKED' | 'COMPLETED'
  secondsRemaining: number
  isUserConfirmed?: boolean
}

export const MatchScoreboard: React.FC<MatchScoreboardProps> = ({
  homeTeam,
  awayTeam,
  userTeamId,
  rules,
  status,
  secondsRemaining,
  isUserConfirmed,
}) => {
  // Determine who is Friendly (You) and who is Opponent (Target)
  const isAwayUser = userTeamId === awayTeam.id
  const friendlyTeam = isAwayUser ? awayTeam : homeTeam
  const targetTeam = isAwayUser ? homeTeam : awayTeam

  const banQuota = rules.banCount ?? rules.banQuota ?? 5
  const banOrder = rules.banOrder ?? 'SIMULTANEOUS'
  const budget = rules.budget ?? 305

  // Formatted countdown time
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Visual header states matching docs/ui/match-bans.html
  let phaseLabel = 'CẤM CHỌN ẨN ĐỒNG THỜI'
  let phaseColor = 'text-[#3DFF6B]'
  let timerText = formatTime(secondsRemaining)
  let timerColor = 'text-[#3DFF6B] drop-shadow-[0_0_12px_rgba(61,255,107,0.45)]'
  let subtext = `Đối thủ đang chọn ẩn ${banQuota} thẻ cấm · Kết quả khoá lúc 00:00`

  if (status === 'SCHEDULED') {
    phaseLabel = 'TRẬN ĐẤU ĐÃ LÊN LỊCH · CHỜ BẮT ĐẦU'
    phaseColor = 'text-zinc-400'
    timerText = 'CHỜ'
    timerColor = 'text-zinc-300'
    subtext = 'Giai đoạn cấm chọn (Ban) chiến thuật sẽ sớm bắt đầu.'
  } else if (status === 'BAN_PHASE') {
    if (isUserConfirmed) {
      phaseLabel = 'ĐANG CHỜ ĐỐI THỦ KHOÁ LƯỢT'
      phaseColor = 'text-amber-400'
      timerText = 'ĐANG CHỜ'
      timerColor = 'text-amber-400 drop-shadow-[0_0_12px_rgba(245,197,24,0.45)]'
      subtext = `Đã khoá ${banQuota} lựa chọn cấm! Đang chờ ${targetTeam.name} khoá lượt...`
    } else {
      phaseLabel = 'CẤM CHỌN ẨN ĐỒNG THỜI'
      phaseColor = 'text-[#3DFF6B]'
      timerText = formatTime(secondsRemaining)
      timerColor = 'text-[#3DFF6B] drop-shadow-[0_0_12px_rgba(61,255,107,0.45)]'
      subtext = `Đối thủ đang chọn ẩn ${banQuota} thẻ cấm · Kết quả khoá lúc 00:00`
    }
  } else if (status === 'BANS_LOCKED' || status === 'COMPLETED') {
    phaseLabel = 'HOÀN THÀNH GIAI ĐOẠN · CÔNG BỐ THẺ CẤM'
    phaseColor = 'text-red-500'
    timerText = '00:00'
    timerColor = 'text-red-500 drop-shadow-[0_0_12px_rgba(255,59,78,0.45)]'
    subtext = `Cả 2 đội đã khoá lượt! ${friendlyTeam.banCount + targetTeam.banCount} thẻ cấm bị loại khỏi trận đấu.`
  }

  const opponentStatusText = targetTeam.confirmed
    ? 'Đã khoá lượt'
    : status === 'BANS_LOCKED' || status === 'COMPLETED'
      ? 'Đã công bố'
      : 'Đang chọn ban...'

  return (
    <section
      className="w-full bg-[#121319] border-b border-[#222530] px-4 lg:px-8 py-4 select-none relative"
      data-purpose="match-header"
    >
      <div className="max-w-[1920px] mx-auto grid grid-cols-12 items-center gap-4">
        {/* Friendly Team (Left) */}
        <div className="col-span-12 md:col-span-4 flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-[#121319] p-[2px] shadow-lg shrink-0">
            <div className="w-full h-full bg-[#161820] rounded-[10px] flex items-center justify-center font-bold text-xl text-[#3DFF6B] border border-white/5">
              {friendlyTeam.name.substring(0, 3).toUpperCase()}
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3DFF6B]/15 text-[#3DFF6B] border border-[#3DFF6B]/30 font-mono">
                PHÒNG THỦ
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                {friendlyTeam.confirmed ? 'TRẠNG THÁI: ĐÃ KHOÁ' : 'TRẠNG THÁI: ĐANG CHỌN'}
              </span>
            </div>
            <h2 className="text-lg lg:text-2xl font-black tracking-tight text-white uppercase truncate flex items-center gap-2">
              {friendlyTeam.name}
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono lowercase border border-zinc-700">
                {userTeamId ? 'bạn' : 'đội nhà'}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 truncate font-mono">
              Quỹ lương: <span className="text-[#3DFF6B] font-bold">{budget}/{budget}</span> · Đội hình: 24 Cầu thủ
            </p>
          </div>
        </div>

        {/* Center Timer & Round Directives */}
        <div className="col-span-12 md:col-span-4 flex flex-col items-center justify-center text-center order-first md:order-none mb-2 md:mb-0">
          <div className="relative inline-flex flex-col items-center">
            <div className="flex items-center gap-2 px-5 py-1.5 rounded-full bg-[#181a23] border border-[#2e3342] shadow-inner mb-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === 'BAN_PHASE' ? 'bg-[#3DFF6B] animate-ping' : 'bg-zinc-500'
                }`}
              />
              <span className={`text-xs font-mono font-bold tracking-wider uppercase ${phaseColor}`}>
                {phaseLabel}
              </span>
            </div>
            <div className={`font-mono text-4xl lg:text-5xl font-black tracking-wider ${timerColor}`}>
              {timerText}
            </div>
            <p className="text-[11px] font-medium text-zinc-400 tracking-wide mt-1">
              {subtext}
            </p>
          </div>
        </div>

        {/* Target Team (Right) */}
        <div className="col-span-12 md:col-span-4 flex items-center justify-end gap-3.5 text-right">
          <div className="min-w-0">
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-zinc-400 font-mono">
                {targetTeam.confirmed ? 'TRẠNG THÁI: ĐÃ KHOÁ' : 'TRẠNG THÁI: ĐANG CHỌN'}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono">
                MỤC TIÊU CẤM
              </span>
            </div>
            <h2 className="text-lg lg:text-2xl font-black tracking-tight text-white uppercase truncate flex items-center justify-end gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-900/40 text-red-300 font-mono border border-red-500/40">
                Đội hình mục tiêu
              </span>
              {targetTeam.name}
            </h2>
            <p className="text-xs text-zinc-400 truncate font-mono">
              Quỹ lương: <span className="text-zinc-200 font-bold">{budget}/{budget}</span> · Mục tiêu: Đối thủ
            </p>
          </div>
          <div className="w-14 h-14 rounded-xl bg-gradient-to-bl from-rose-500 to-[#121319] p-[2px] shadow-lg shrink-0">
            <div className="w-full h-full bg-[#161820] rounded-[10px] flex items-center justify-center font-bold text-xl text-rose-400 border border-white/5">
              {targetTeam.name.substring(0, 3).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Match Rule Ticker Strip */}
      <div className="mt-3 pt-2.5 border-t border-[#1d202b] flex flex-wrap items-center justify-between text-xs text-zinc-400 font-mono">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            <strong className="text-zinc-200">LƯỢT CẤM:</strong> {banQuota} Cầu thủ mỗi đội
          </span>
          <span className="text-zinc-600">|</span>
          <span>
            <strong className="text-zinc-200">CƠ CHẾ:</strong>{' '}
            {banOrder === 'SIMULTANEOUS' ? 'Khoá Ẩn Đồng Thời & Công Bố' : 'Cấm Chọn Luân Phiên'}
          </span>
          <span className="text-zinc-600">|</span>
          <span>
            <strong className="text-zinc-200">QUỸ LƯƠNG:</strong> {budget}/{budget}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 sm:mt-0">
          <span className="inline-flex items-center gap-1.5 text-zinc-300">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                targetTeam.confirmed
                  ? 'bg-[#3DFF6B]'
                  : status === 'BANS_LOCKED' || status === 'COMPLETED'
                    ? 'bg-red-500'
                    : 'bg-amber-400'
              }`}
            />
            Trạng thái cấm của đối thủ:{' '}
            <span
              className={`font-bold ${
                targetTeam.confirmed
                  ? 'text-[#3DFF6B]'
                  : status === 'BANS_LOCKED' || status === 'COMPLETED'
                    ? 'text-red-400'
                    : 'text-amber-400'
              }`}
            >
              {opponentStatusText}
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}
