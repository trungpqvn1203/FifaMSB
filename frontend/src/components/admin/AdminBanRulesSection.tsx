import React from 'react'

interface AdminBanRulesProps {
  banQuota: number
  onBanQuotaChange: (val: number) => void
  banTimeSeconds: number
  onBanTimeSecondsChange: (val: number) => void
  banTarget: 'OPPONENT_ROSTER' | 'OWN_ROSTER'
  onBanTargetChange: (val: 'OPPONENT_ROSTER' | 'OWN_ROSTER') => void
  banOrder: 'SIMULTANEOUS' | 'ALTERNATING'
  onBanOrderChange: (val: 'SIMULTANEOUS' | 'ALTERNATING') => void
}

export const AdminBanRulesSection: React.FC<AdminBanRulesProps> = ({
  banQuota,
  onBanQuotaChange,
  banTimeSeconds,
  onBanTimeSecondsChange,
  banTarget,
  onBanTargetChange,
  banOrder,
  onBanOrderChange,
}) => {
  return (
    <section id="ban-rules" className="bg-[#121517] border border-[#2A3138] rounded-xl p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#3DFF6B]" />
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#2A3138]">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded bg-[#3DFF6B]/10 border border-[#3DFF6B]/30 text-[#3DFF6B] font-mono text-xs font-bold flex items-center justify-center">
            03
          </span>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Luật Giai Đoạn Cấm Chọn (Ban) &amp; Mục Tiêu
            </h2>
            <p className="text-xs text-gray-400">
              Cấu hình số lượt cấm, phạm vi đội hình bị cấm và trình tự cấm thẻ
            </p>
          </div>
        </div>
        <span className="text-xs font-mono text-[#3DFF6B] bg-[#3DFF6B]/10 px-2 py-0.5 rounded border border-[#3DFF6B]/20">
          Quy Định Chiến Thuật
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Bans Per Team */}
        <div className="space-y-2 bg-[#181C1F]/60 p-4 rounded-lg border border-[#2A3138]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase tracking-wider text-gray-200 font-semibold">
              Số Lượt Cấm / Đội
            </label>
            <span className="text-[10px] font-mono text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded border border-red-400/30">
              Cấm (Ban)
            </span>
          </div>
          <p className="text-[11px] text-gray-400">Tổng số thẻ cầu thủ mỗi đội có thể cấm.</p>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={banQuota}
              onChange={(e) => onBanQuotaChange(Number(e.target.value))}
              min={0}
              max={12}
              className="w-full bg-[#121517] border border-[#2A3138] focus:border-[#3DFF6B] text-lg text-white font-mono font-bold px-3 py-1.5 rounded outline-none"
            />
            <span className="text-xs font-mono text-gray-400">THẺ</span>
          </div>
          <div className="text-[11px] font-mono text-gray-400 pt-1">
            Áp dụng cho mỗi trận đối đầu.
          </div>
        </div>

        {/* Ban Phase Timer */}
        <div className="space-y-2 bg-[#181C1F]/60 p-4 rounded-lg border border-[#2A3138]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono uppercase tracking-wider text-gray-200 font-semibold">
              Thời Gian Cấm Chọn (Ban)
            </label>
            <span className="text-[10px] font-mono text-gray-400">Đếm Ngược</span>
          </div>
          <p className="text-[11px] text-gray-400">Thời lượng dành cho việc cấm chọn chiến thuật.</p>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              value={banTimeSeconds}
              onChange={(e) => onBanTimeSecondsChange(Number(e.target.value))}
              min={10}
              max={600}
              className="w-full bg-[#121517] border border-[#2A3138] focus:border-[#3DFF6B] text-lg text-white font-mono font-bold px-3 py-1.5 rounded outline-none"
            />
            <span className="text-xs font-mono text-gray-400">GIÂY</span>
          </div>
          <div className="text-[11px] font-mono text-gray-400 pt-1">
            Tự động khoá lựa chọn khi về 00:00.
          </div>
        </div>

        {/* Ban Target Scope */}
        <div className="space-y-2 bg-[#181C1F]/60 p-4 rounded-lg border border-[#2A3138] lg:col-span-2">
          <label className="text-xs font-mono uppercase tracking-wider text-gray-200 font-semibold">
            Phạm Vi Mục Tiêu Cấm (Ban Target)
          </label>
          <p className="text-[11px] text-gray-400">Xác định cách thẻ bị cấm ảnh hưởng tới các đội.</p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <label
              onClick={() => onBanTargetChange('OPPONENT_ROSTER')}
              className={`p-2.5 rounded cursor-pointer flex items-start gap-2.5 transition ${
                banTarget === 'OPPONENT_ROSTER'
                  ? 'bg-[#121517] border border-[#3DFF6B]/50 bg-[#3DFF6B]/5'
                  : 'bg-[#121517] border border-[#2A3138] hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="ban_target"
                checked={banTarget === 'OPPONENT_ROSTER'}
                onChange={() => onBanTargetChange('OPPONENT_ROSTER')}
                className="mt-0.5 text-[#3DFF6B] focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-white block">Đội Hình Đối Thủ (Opponent)</span>
                <span className="text-[10px] text-gray-400">
                  Cấm trực tiếp các thẻ từ danh sách đội hình đối phương đã draft.
                </span>
              </div>
            </label>

            <label
              onClick={() => onBanTargetChange('OWN_ROSTER')}
              className={`p-2.5 rounded cursor-pointer flex items-start gap-2.5 transition ${
                banTarget === 'OWN_ROSTER'
                  ? 'bg-[#121517] border border-[#3DFF6B]/50 bg-[#3DFF6B]/5'
                  : 'bg-[#121517] border border-[#2A3138] hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="ban_target"
                checked={banTarget === 'OWN_ROSTER'}
                onChange={() => onBanTargetChange('OWN_ROSTER')}
                className="mt-0.5 text-[#3DFF6B] focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-gray-300 block">Đội Hình Của Mình (Own Roster)</span>
                <span className="text-[10px] text-gray-400">
                  Chế độ đề cử bảo vệ các thẻ dự bị của chính đội mình.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Ban Execution Flow */}
        <div className="space-y-2 bg-[#181C1F]/60 p-4 rounded-lg border border-[#2A3138] lg:col-span-4">
          <label className="text-xs font-mono uppercase tracking-wider text-gray-200 font-semibold">
            Trình Tự Thực Hiện Lượt Cấm (Ban Execution Flow)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <label
              onClick={() => onBanOrderChange('SIMULTANEOUS')}
              className={`p-3.5 rounded cursor-pointer flex items-start gap-3 transition ${
                banOrder === 'SIMULTANEOUS'
                  ? 'bg-[#121517] border border-[#3DFF6B] bg-[#3DFF6B]/5 shadow-[0_0_10px_rgba(61,255,107,0.15)]'
                  : 'bg-[#121517] border border-[#2A3138] hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="ban_order"
                checked={banOrder === 'SIMULTANEOUS'}
                onChange={() => onBanOrderChange('SIMULTANEOUS')}
                className="mt-1 text-[#3DFF6B] focus:ring-0"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#3DFF6B] uppercase font-mono">
                    Cấm Chọn Ẩn Đồng Thời (Simultaneous Blind Lock)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3DFF6B]/20 text-[#3DFF6B] font-mono font-bold">
                    Chuẩn Thi Đấu
                  </span>
                </div>
                <p className="text-xs text-gray-300">
                  Cả hai đội cùng chọn và khoá lượt cấm một cách bí mật dưới đồng hồ đếm ngược đồng bộ. Thẻ cấm chỉ hiển thị khi cả 2 đội cùng khoá hoặc hết giờ.
                </p>
              </div>
            </label>

            <label
              onClick={() => onBanOrderChange('ALTERNATING')}
              className={`p-3.5 rounded cursor-pointer flex items-start gap-3 transition ${
                banOrder === 'ALTERNATING'
                  ? 'bg-[#121517] border border-[#3DFF6B] bg-[#3DFF6B]/5'
                  : 'bg-[#121517] border border-[#2A3138] hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name="ban_order"
                checked={banOrder === 'ALTERNATING'}
                onChange={() => onBanOrderChange('ALTERNATING')}
                className="mt-1 text-[#3DFF6B] focus:ring-0"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-300 uppercase font-mono">
                    Cấm Chọn Luân Phiên (Alternating)
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Các đội lần lượt đưa ra lượt cấm theo từng lượt. Thẻ cấm hiển thị trực tiếp theo thời gian thực cho khán giả và bình luận viên.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </section>
  )
}
