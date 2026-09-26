import React from 'react'
import type { SeasonItem } from '@/types/domain'

interface AdminDraftRulesProps {
  rosterSize: number
  onRosterSizeChange: (val: number) => void
  budget: number
  onBudgetChange: (val: number) => void
  pickTimeSeconds: number
  onPickTimeSecondsChange: (val: number) => void
  playersPerTurn: number
  onPlayersPerTurnChange: (val: number) => void
  uniqueBy: 'PLAYER' | 'CARD'
  onUniqueByChange: (val: 'PLAYER' | 'CARD') => void
  timeoutPolicy: 'AUTO_PICK_CHEAPEST' | 'SKIP_TURN'
  onTimeoutPolicyChange: (val: 'AUTO_PICK_CHEAPEST' | 'SKIP_TURN') => void
  availableSeasons: SeasonItem[]
  allowedSeasons: string[]
  onToggleSeason: (code: string) => void
  onSelectAllSeasons: () => void
}

export const AdminDraftRulesSection: React.FC<AdminDraftRulesProps> = ({
  rosterSize,
  onRosterSizeChange,
  budget,
  onBudgetChange,
  pickTimeSeconds,
  onPickTimeSecondsChange,
  playersPerTurn,
  onPlayersPerTurnChange,
  uniqueBy,
  onUniqueByChange,
  timeoutPolicy,
  onTimeoutPolicyChange,
  availableSeasons,
  allowedSeasons,
  onToggleSeason,
  onSelectAllSeasons,
}) => {
  return (
    <section id="draft-rules" className="bg-[#121517] border border-[#2A3138] rounded-xl p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#3DFF6B]" />
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#2A3138]">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded bg-[#3DFF6B]/10 border border-[#3DFF6B]/30 text-[#3DFF6B] font-mono text-xs font-bold flex items-center justify-center">
            02
          </span>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Luật Draft &amp; Giới Hạn Quỹ Lương (Budget)
            </h2>
            <p className="text-xs text-gray-400">
              Cấu hình quy mô đội hình, đồng hồ lượt chọn, giới hạn quỹ lương và quy tắc trùng thẻ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400">Mẫu chuẩn:</span>
          <span className="text-xs font-mono bg-[#181C1F] border border-[#2A3138] px-2 py-0.5 rounded text-[#3DFF6B]">
            FVPL Official 2026
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Roster Size */}
        <div className="space-y-2 bg-[#181C1F]/60 p-4 rounded-lg border border-[#2A3138]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase tracking-wider text-gray-200 font-semibold">
              Quy Mô Đội Hình
            </label>
            <span className="text-[10px] font-mono text-[#3DFF6B] bg-[#3DFF6B]/10 px-1.5 py-0.5 rounded border border-[#3DFF6B]/30">
              Tổng Lượt Pick
            </span>
          </div>
          <p className="text-[11px] text-gray-400">Số lượng cầu thủ bắt buộc cho mỗi đội tham gia.</p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => onRosterSizeChange(23)}
              className={`rounded p-2 flex items-center justify-between transition-colors ${
                rosterSize === 23
                  ? 'border border-[#3DFF6B] bg-[#3DFF6B]/10 text-white shadow-[0_0_8px_rgba(61,255,107,0.2)]'
                  : 'border border-[#38424B] bg-[#121517] text-gray-300 hover:border-gray-500'
              }`}
            >
              <span className={`text-sm font-mono font-bold ${rosterSize === 23 ? 'text-[#3DFF6B]' : 'text-gray-300'}`}>
                23 Cầu thủ
              </span>
              <span className={`w-3 h-3 rounded-full border ${rosterSize === 23 ? 'bg-[#3DFF6B] border-[#3DFF6B]' : 'border-gray-500'}`} />
            </button>

            <button
              type="button"
              onClick={() => onRosterSizeChange(24)}
              className={`rounded p-2 flex items-center justify-between transition-colors ${
                rosterSize === 24
                  ? 'border border-[#3DFF6B] bg-[#3DFF6B]/10 text-white shadow-[0_0_8px_rgba(61,255,107,0.2)]'
                  : 'border border-[#38424B] bg-[#121517] text-gray-300 hover:border-gray-500'
              }`}
            >
              <span className={`text-sm font-mono font-bold ${rosterSize === 24 ? 'text-[#3DFF6B]' : 'text-gray-300'}`}>
                24 Cầu thủ
              </span>
              <span className={`w-3 h-3 rounded-full border ${rosterSize === 24 ? 'bg-[#3DFF6B] border-[#3DFF6B]' : 'border-gray-500'}`} />
            </button>
          </div>
          <div className="text-[11px] font-mono text-gray-400 pt-1 flex justify-between">
            <span>Đội hình chính: 11</span>
            <span>Dự bị: {rosterSize - 11}</span>
          </div>
        </div>

        {/* Salary Budget Cap */}
        <div className="space-y-2 bg-[#181C1F]/60 p-4 rounded-lg border border-[#2A3138]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase tracking-wider text-gray-200 font-semibold">
              Trần Quỹ Lương (Budget)
            </label>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
              Trần Cố Định
            </span>
          </div>
          <p className="text-[11px] text-gray-400">Tổng điểm lương tối đa cho toàn đội hình.</p>
          <div className="relative mt-1">
            <input
              type="number"
              value={budget}
              onChange={(e) => onBudgetChange(Number(e.target.value))}
              min={rosterSize}
              max={1000}
              className="w-full bg-[#121517] border border-[#3DFF6B] focus:ring-1 focus:ring-[#3DFF6B] text-lg text-[#3DFF6B] font-mono font-bold px-3 py-1.5 rounded outline-none"
            />
            <span className="absolute right-3 top-2 text-xs font-mono text-gray-400">ĐIỂM (TỐI ĐA)</span>
          </div>
          <div className="text-[11px] font-mono text-gray-400 pt-1 flex justify-between">
            <span>Hiển thị phát sóng:</span>
            <span className="text-gray-200">Hiện tại / {budget}</span>
          </div>
        </div>

        {/* Seconds Per Pick */}
        <div className="space-y-2 bg-[#181C1F]/60 p-4 rounded-lg border border-[#2A3138]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase tracking-wider text-gray-200 font-semibold">
              Thời Gian Lượt Pick
            </label>
            <span className="text-[10px] font-mono text-gray-400">Đồng Hồ Live</span>
          </div>
          <p className="text-[11px] text-gray-400">Thời gian đếm ngược hiển thị trên thanh phát sóng.</p>
          <div className="relative mt-1">
            <input
              type="number"
              value={pickTimeSeconds}
              onChange={(e) => onPickTimeSecondsChange(Number(e.target.value))}
              min={5}
              max={300}
              className="w-full bg-[#121517] border border-[#2A3138] focus:border-[#3DFF6B] text-lg text-white font-mono font-bold px-3 py-1.5 rounded outline-none"
            />
            <span className="absolute right-3 top-2 text-xs font-mono text-gray-400">GIÂY</span>
          </div>
          <div className="text-[11px] font-mono text-gray-400 pt-1 flex items-center justify-between">
            <span>Hết giờ:</span>
            <span className="text-[#3DFF6B] font-mono">
              {timeoutPolicy === 'AUTO_PICK_CHEAPEST' ? 'Auto-Pick Rẻ Nhất' : 'Skip Turn'}
            </span>
          </div>
        </div>

        {/* Players Per Turn */}
        <div className="space-y-2 bg-[#181C1F]/60 p-4 rounded-lg border border-[#2A3138]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase tracking-wider text-gray-200 font-semibold">
              Cầu Thủ / Lượt
            </label>
            <span className="text-[10px] font-mono text-gray-400">Chọn Đồng Thời</span>
          </div>
          <p className="text-[11px] text-gray-400">Số lượng thẻ cầu thủ được chọn mỗi lượt.</p>
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onPlayersPerTurnChange(num)}
                className={`py-2 font-mono font-bold text-sm rounded transition ${
                  playersPerTurn === num
                    ? 'bg-[#3DFF6B]/15 border border-[#3DFF6B] text-[#3DFF6B]'
                    : 'bg-[#121517] border border-[#2A3138] text-gray-400 hover:text-white'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
          <div className="text-[11px] font-mono text-gray-400 pt-1">
            Chu kỳ Draft {playersPerTurn} cầu thủ/lượt
          </div>
        </div>
      </div>

      {/* Additional Constraints: Uniqueness, Timeout Action, and Allowed Seasons */}
      <div className="mt-6 pt-6 border-t border-[#2A3138] grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Uniqueness Constraint */}
        <div className="space-y-2">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-200 font-semibold">
            Quy Tắc Trùng Cầu Thủ
          </label>
          <div className="space-y-2">
            <label
              onClick={() => onUniqueByChange('PLAYER')}
              className={`flex items-start gap-3 p-3 rounded cursor-pointer transition ${
                uniqueBy === 'PLAYER'
                  ? 'bg-[#181C1F] border border-[#3DFF6B]/50 bg-[#3DFF6B]/5'
                  : 'bg-[#181C1F] border border-[#2A3138] hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="uniqueness"
                checked={uniqueBy === 'PLAYER'}
                onChange={() => onUniqueByChange('PLAYER')}
                className="mt-0.5 text-[#3DFF6B] focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-white block">Theo Cầu Thủ (Khoá Toàn Cục)</span>
                <span className="text-[11px] text-gray-400">
                  Khi một cầu thủ được chọn (ví dụ: K. Mbappé), mọi phiên bản thẻ mùa của cầu thủ đó sẽ bị khoá với tất cả các đội.
                </span>
              </div>
            </label>

            <label
              onClick={() => onUniqueByChange('CARD')}
              className={`flex items-start gap-3 p-3 rounded cursor-pointer transition ${
                uniqueBy === 'CARD'
                  ? 'bg-[#181C1F] border border-[#3DFF6B]/50 bg-[#3DFF6B]/5'
                  : 'bg-[#181C1F] border border-[#2A3138] hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="uniqueness"
                checked={uniqueBy === 'CARD'}
                onChange={() => onUniqueByChange('CARD')}
                className="mt-0.5 text-[#3DFF6B] focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-gray-300 block">Theo Thẻ Mùa (Khác Mùa Vẫn Chọn Được)</span>
                <span className="text-[11px] text-gray-400">
                  Các đội khác nhau có thể chọn các thẻ mùa khác nhau của cùng cầu thủ (ví dụ: 24TOTY Mbappé và BTB Mbappé).
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Timeout Action */}
        <div className="space-y-2">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-200 font-semibold">
            Khi Hết Thời Gian (00:00)
          </label>
          <div className="space-y-2">
            <label
              onClick={() => onTimeoutPolicyChange('AUTO_PICK_CHEAPEST')}
              className={`flex items-start gap-3 p-3 rounded cursor-pointer transition ${
                timeoutPolicy === 'AUTO_PICK_CHEAPEST'
                  ? 'bg-[#181C1F] border border-[#3DFF6B]/50 bg-[#3DFF6B]/5'
                  : 'bg-[#181C1F] border border-[#2A3138] hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="timeout_policy"
                checked={timeoutPolicy === 'AUTO_PICK_CHEAPEST'}
                onChange={() => onTimeoutPolicyChange('AUTO_PICK_CHEAPEST')}
                className="mt-0.5 text-[#3DFF6B] focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-[#3DFF6B] block">Tự Động Pick Cầu Thủ Lương Thấp Nhất</span>
                <span className="text-[11px] text-gray-400">
                  Hệ thống tự động pick cầu thủ hợp lệ có lương thấp nhất để đảm bảo tính khả thi của quỹ lương.
                </span>
              </div>
            </label>

            <label
              onClick={() => onTimeoutPolicyChange('SKIP_TURN')}
              className={`flex items-start gap-3 p-3 rounded cursor-pointer transition ${
                timeoutPolicy === 'SKIP_TURN'
                  ? 'bg-[#181C1F] border border-[#3DFF6B]/50 bg-[#3DFF6B]/5'
                  : 'bg-[#181C1F] border border-[#2A3138] hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="timeout_policy"
                checked={timeoutPolicy === 'SKIP_TURN'}
                onChange={() => onTimeoutPolicyChange('SKIP_TURN')}
                className="mt-0.5 text-[#3DFF6B] focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-gray-300 block">Bỏ Qua Lượt (Mất Lượt)</span>
                <span className="text-[11px] text-gray-400">
                  Đội bị mất lượt pick hiện tại và đồng hồ tự động chuyển sang đội tiếp theo trong danh sách.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Allowed Seasons Multi-Select */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase tracking-wider text-gray-200 font-semibold">
              Mùa Thẻ Cho Phép ({allowedSeasons.length === 0 ? 'Tất cả' : allowedSeasons.length})
            </label>
            <button
              type="button"
              onClick={onSelectAllSeasons}
              className="text-[10px] font-mono text-[#3DFF6B] hover:underline"
            >
              Chọn Tất Cả
            </button>
          </div>
          <div className="bg-[#181C1F] border border-[#2A3138] rounded p-3 max-h-44 overflow-y-auto space-y-1.5">
            {availableSeasons.length === 0 ? (
              <span className="text-xs text-gray-500 font-mono">Chưa có mùa thẻ nào được tải từ danh mục.</span>
            ) : (
              availableSeasons.map((s) => {
                const isChecked = allowedSeasons.length === 0 || allowedSeasons.includes(s.id)
                return (
                  <label
                    key={s.id}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-[#202529] cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleSeason(s.id)}
                        className="rounded bg-[#121517] border-[#2A3138] text-[#3DFF6B] focus:ring-0"
                      />
                      <span className="font-mono font-bold text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded text-[10px] border border-amber-400/40">
                        {s.code}
                      </span>
                      <span className="text-gray-200">{s.name}</span>
                    </span>
                  </label>
                )
              })
            )}
          </div>
          <p className="text-[11px] text-gray-400">
            {allowedSeasons.length === 0
              ? 'Tất cả các mùa thẻ đều được kích hoạt trong pool Draft.'
              : `${allowedSeasons.length} mùa thẻ đang hoạt động trong pool Draft.`}
          </p>
        </div>
      </div>
    </section>
  )
}
