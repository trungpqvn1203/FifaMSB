import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Trophy, AlertCircle } from 'lucide-react'
import type { MatchDetail } from '@/types/domain'

interface RecordScoreModalProps {
  isOpen: boolean
  onClose: () => void
  match: MatchDetail | null
  onSaveScore: (matchId: string, homeScore: number, awayScore: number) => Promise<void>
  isLoading?: boolean
}

export const RecordScoreModal: React.FC<RecordScoreModalProps> = ({
  isOpen,
  onClose,
  match,
  onSaveScore,
  isLoading = false,
}) => {
  const [homeScore, setHomeScore] = useState<number>(0)
  const [awayScore, setAwayScore] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (match) {
      setHomeScore(match.homeScore ?? match.homeTeam.score ?? 0)
      setAwayScore(match.awayScore ?? match.awayTeam.score ?? 0)
      setError(null)
    }
  }, [match])

  if (!match) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (homeScore < 0 || awayScore < 0) {
      setError('Tỉ số không thể là số âm.')
      return
    }

    try {
      setError(null)
      await onSaveScore(match.id, Number(homeScore), Number(awayScore))
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Không thể lưu tỉ số trận đấu.')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ghi Nhận Tỉ Số Trận Đấu">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-elevated/60 border border-border-subtle text-xs text-zinc-400">
          <Trophy className="w-5 h-5 text-neon shrink-0" />
          <div>
            <span className="text-white font-bold block">
              Trận Đấu #{match.id.substring(0, 8)}
            </span>
            <span>
              Nhập tỉ số thực tế thi đấu. Hệ thống sẽ tự động cập nhật điểm, hiệu số và bảng xếp hạng giải đấu.
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Score Input Arena */}
        <div className="grid grid-cols-11 items-center gap-2 bg-[#14161f] p-6 rounded-xl border border-[#262938]">
          {/* Home Team */}
          <div className="col-span-4 flex flex-col items-center text-center gap-2">
            <span className="font-display font-bold text-base text-white tracking-wide truncate max-w-full">
              {match.homeTeam.name}
            </span>
            <span className="text-[11px] font-mono text-neon bg-neon/10 px-2 py-0.5 rounded border border-neon/30">
              ĐỘI NHÀ
            </span>
            <input
              type="number"
              min={0}
              max={99}
              value={homeScore}
              onChange={(e) => setHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 h-16 text-center font-mono font-bold text-3xl bg-[#0e1017] border-2 border-border-default focus:border-neon rounded-lg text-white outline-none transition shadow-inner mt-2"
              autoFocus
            />
          </div>

          {/* VS Divider */}
          <div className="col-span-3 flex flex-col items-center justify-center">
            <span className="font-mono text-xs font-bold text-zinc-500 uppercase tracking-widest">
              VS
            </span>
            <span className="text-2xl font-mono font-bold text-zinc-600 my-1">:</span>
            <span className="text-[10px] font-mono text-zinc-400">TỈ SỐ</span>
          </div>

          {/* Away Team */}
          <div className="col-span-4 flex flex-col items-center text-center gap-2">
            <span className="font-display font-bold text-base text-white tracking-wide truncate max-w-full">
              {match.awayTeam.name}
            </span>
            <span className="text-[11px] font-mono text-cyan bg-cyan/10 px-2 py-0.5 rounded border border-cyan/30">
              ĐỘI KHÁCH
            </span>
            <input
              type="number"
              min={0}
              max={99}
              value={awayScore}
              onChange={(e) => setAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 h-16 text-center font-mono font-bold text-3xl bg-[#0e1017] border-2 border-border-default focus:border-cyan rounded-lg text-white outline-none transition shadow-inner mt-2"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Hủy Bỏ
          </Button>
          <Button
            type="submit"
            variant="neon"
            size="sm"
            isLoading={isLoading}
            className="font-bold tracking-wide uppercase text-xs px-6"
          >
            Lưu &amp; Cập Nhật Tỉ Số
          </Button>
        </div>
      </form>
    </Modal>
  )
}
