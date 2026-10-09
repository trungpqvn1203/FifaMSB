import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  Search,
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { adminApi } from '@/lib/admin-api'
import { AdminCsvImportSection } from '@/components/admin/AdminCsvImportSection'

interface PlayerSeasonItem {
  id: string
  playerId: string
  seasonId: string
  position: string
  rating: number
  salary: number
  imageUrl: string | null
  status: string
  player: {
    id: string
    name: string
    externalPlayerId: string
  }
  season: {
    id: string
    code: string
    badgeUrl: string | null
  }
}

interface PlayerSeasonListResponse {
  items: PlayerSeasonItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface SeasonOption {
  id: string
  code: string
  name: string
  badgeUrl: string | null
}

export const AdminPlayersPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'sync' | 'catalogue'>('sync')

  // Filters for Catalogue
  const [search, setSearch] = useState<string>('')
  const [positionGroup, setPositionGroup] = useState<string>('ALL')
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('ALL')
  const [page, setPage] = useState<number>(1)

  // Quick edit salary state
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [editingSalary, setEditingSalary] = useState<number>(1)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // 1. Fetch seasons already in DB
  const { data: seasons = [] } = useQuery<SeasonOption[]>({
    queryKey: ['db-seasons'],
    queryFn: async () => {
      const res = await apiClient.get<SeasonOption[]>('/seasons')
      return res.data
    },
  })

  // 2. Fetch player seasons list
  const {
    data: catalogue,
    isLoading: isCatalogueLoading,
  } = useQuery<PlayerSeasonListResponse>({
    queryKey: ['player-seasons-catalogue', search, positionGroup, selectedSeasonId, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('page', String(page))
      params.append('pageSize', '36')
      if (search.trim()) params.append('search', search.trim())
      if (positionGroup !== 'ALL') params.append('group', positionGroup)
      if (selectedSeasonId !== 'ALL') params.append('seasonId', selectedSeasonId)

      const res = await apiClient.get<PlayerSeasonListResponse>(`/player-seasons?${params.toString()}`)
      return res.data
    },
    enabled: activeTab === 'catalogue',
  })

  // 3. Update Salary mutation
  const updateSalaryMutation = useMutation({
    mutationFn: async ({ cardId, salary }: { cardId: string; salary: number }) => {
      const res = await apiClient.patch(`/admin/player-seasons/${cardId}`, { salary })
      return res.data
    },
    onSuccess: () => {
      setEditingCardId(null)
      setActionSuccess('Cập nhật quỹ lương thẻ thành công!')
      queryClient.invalidateQueries({ queryKey: ['player-seasons-catalogue'] })
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Không thể cập nhật lương.')
    },
  })

  const handleStartEditSalary = (card: PlayerSeasonItem) => {
    setEditingCardId(card.id)
    setEditingSalary(card.salary)
    setActionError(null)
    setActionSuccess(null)
  }

  const handleSaveSalary = (cardId: string) => {
    if (editingSalary < 1 || editingSalary > 50) {
      setActionError('Lương phải từ 1 đến 50.')
      return
    }
    updateSalaryMutation.mutate({ cardId, salary: editingSalary })
  }

  return (
    <div className="min-h-screen bg-app-void text-white pb-20">
      {/* Top Banner Header */}
      <div className="bg-[#121517] border-b border-[#2A3138] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#3DFF6B]/10 border border-[#3DFF6B]/30 text-[#3DFF6B] flex items-center justify-center shadow-lg shadow-[#3DFF6B]/10">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#3DFF6B] font-bold px-2 py-0.5 rounded bg-[#3DFF6B]/10 border border-[#3DFF6B]/20">
                  Master Data System
                </span>
                <span className="text-xs text-gray-500 font-mono">• Kho Dữ Liệu Dùng Chung Toàn Hệ Thống</span>
              </div>
              <h1 className="text-2xl font-display font-extrabold text-white tracking-wide uppercase">
                Kho Cầu Thủ FC Online
              </h1>
            </div>
          </div>

          {/* Quick Stats or Actions */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-lg bg-[#181C1F] border border-[#2A3138] text-right">
              <span className="text-[10px] font-mono text-gray-400 block uppercase">Tổng Thẻ Trong Hệ Thống</span>
              <span className="text-lg font-mono font-bold text-[#3DFF6B]">
                {catalogue?.total ?? '—'} <span className="text-xs text-gray-400 font-normal">thẻ</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-[#2A3138] pb-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab('sync')
              setActionError(null)
              setActionSuccess(null)
            }}
            className={`px-5 py-2.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'sync'
                ? 'bg-[#3DFF6B] text-black shadow-lg shadow-[#3DFF6B]/20'
                : 'bg-[#181C1F] text-gray-400 hover:text-white border border-[#2A3138]'
            }`}
          >
            <span>⚡</span> Đồng Bộ &amp; Nhập Cầu Thủ
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('catalogue')
              setActionError(null)
              setActionSuccess(null)
            }}
            className={`px-5 py-2.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'catalogue'
                ? 'bg-[#3DFF6B] text-black shadow-lg shadow-[#3DFF6B]/20'
                : 'bg-[#181C1F] text-gray-400 hover:text-white border border-[#2A3138]'
            }`}
          >
            <span>📋</span> Danh Mục Cầu Thủ Hiện Có ({catalogue?.total ?? '...'})
          </button>
        </div>

        {/* Global Notifications */}
        {actionError && (
          <div className="p-4 bg-red-950/70 border border-red-500/50 rounded-lg text-xs font-mono text-red-200 flex items-center justify-between">
            <span>⚠️ {actionError}</span>
            <button type="button" onClick={() => setActionError(null)} className="text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {actionSuccess && (
          <div className="p-4 bg-emerald-950/70 border border-emerald-500/50 rounded-lg text-xs font-mono text-emerald-200 flex items-center justify-between">
            <span>✓ {actionSuccess}</span>
            <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* TAB 1: SYNC & IMPORT */}
        {activeTab === 'sync' && (
          <div className="space-y-6">
            <div className="bg-[#181C1F] border border-[#2A3138] rounded-xl p-4 text-xs font-mono text-gray-300 flex items-center gap-3">
              <span className="text-[#3DFF6B] text-base">ℹ️</span>
              <span>
                Cầu thủ sau khi đồng bộ từ <strong>FC Online Nexon</strong> hoặc tải file <strong>CSV</strong> sẽ được lưu trữ vĩnh viễn vào kho dữ liệu chung này. Mọi giải đấu bạn tạo đều có thể chọn thi đấu các mùa thẻ này mà không cần nhập lại!
              </span>
            </div>

            <AdminCsvImportSection
              onImportCsv={(file) => adminApi.importPlayersCsv(file)}
              onSyncNexon={(params) => adminApi.syncNexonPlayers(params)}
            />
          </div>
        )}

        {/* TAB 2: CURRENT CATALOGUE */}
        {activeTab === 'catalogue' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-[#121517] border border-[#2A3138] rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Search */}
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Tìm tên cầu thủ (tiếng Anh / không dấu)..."
                  className="w-full bg-[#181C1F] border border-[#2A3138] rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#3DFF6B]"
                />
              </div>

              {/* Season Filter */}
              <div className="md:col-span-4">
                <select
                  value={selectedSeasonId}
                  onChange={(e) => {
                    setSelectedSeasonId(e.target.value)
                    setPage(1)
                  }}
                  className="w-full bg-[#181C1F] border border-[#2A3138] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#3DFF6B]"
                >
                  <option value="ALL">Tất cả mùa thẻ ({seasons.length} mùa đã có)</option>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Position Group Pills */}
              <div className="md:col-span-3 flex items-center gap-1 bg-[#181C1F] p-1 rounded-lg border border-[#2A3138]">
                {['ALL', 'FW', 'MF', 'DF', 'GK'].map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => {
                      setPositionGroup(grp)
                      setPage(1)
                    }}
                    className={`flex-1 py-1 rounded text-xs font-mono font-bold transition-all ${
                      positionGroup === grp
                        ? 'bg-[#3DFF6B] text-black shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {grp === 'ALL' ? 'TẤT CẢ' : grp}
                  </button>
                ))}
              </div>
            </div>

            {/* Cards Grid */}
            {isCatalogueLoading ? (
              <div className="py-20 text-center text-xs font-mono text-gray-400">
                <div className="w-8 h-8 border-2 border-[#3DFF6B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Đang tải dữ liệu thẻ cầu thủ...
              </div>
            ) : catalogue && catalogue.items.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {catalogue.items.map((card) => {
                    const isEditing = editingCardId === card.id
                    return (
                      <div
                        key={card.id}
                        className="bg-[#15191C] border border-[#2A3138] hover:border-[#3DFF6B]/50 rounded-xl p-3 flex flex-col justify-between relative group transition-all"
                      >
                        {/* Top: Season Badge & Position */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            {card.season.badgeUrl && (
                              <img
                                src={card.season.badgeUrl}
                                alt={card.season.code}
                                className="w-4 h-4 object-contain"
                              />
                            )}
                            <span className="text-[10px] font-mono font-bold text-gray-300">
                              {card.season.code}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded ${
                              card.position === 'GK'
                                ? 'bg-amber-500/20 text-amber-400'
                                : card.position.includes('B') || card.position.includes('CB')
                                ? 'bg-blue-500/20 text-blue-400'
                                : card.position.includes('M')
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {card.position}
                          </span>
                        </div>

                        {/* Player Photo */}
                        <div className="w-full h-24 flex items-center justify-center my-1 relative">
                          {card.imageUrl ? (
                            <img
                              src={card.imageUrl}
                              alt={card.player.name}
                              className="h-full object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-[#202529] border border-[#2A3138] flex items-center justify-center text-gray-500 font-mono text-xs">
                              FCO
                            </div>
                          )}
                        </div>

                        {/* Player Name */}
                        <div className="text-center my-1">
                          <h4 className="text-xs font-bold text-white truncate font-sans" title={card.player.name}>
                            {card.player.name}
                          </h4>
                        </div>

                        {/* Stats Row: OVR & Salary */}
                        <div className="mt-2 pt-2 border-t border-[#23292E] flex items-center justify-between text-xs font-mono">
                          <div>
                            <span className="text-[9px] text-gray-500 uppercase block">OVR</span>
                            <span className="font-extrabold text-[#3DFF6B]">{card.rating ?? '—'}</span>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] text-gray-500 uppercase block">LƯƠNG</span>
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={editingSalary}
                                  onChange={(e) => setEditingSalary(Number(e.target.value))}
                                  className="w-12 bg-black border border-[#3DFF6B] rounded px-1 text-center text-xs text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveSalary(card.id)}
                                  className="p-1 rounded bg-[#3DFF6B] text-black hover:bg-[#32d95b]"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCardId(null)}
                                  className="p-1 rounded bg-gray-700 text-white hover:bg-gray-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => handleStartEditSalary(card)}
                                className="cursor-pointer hover:text-[#3DFF6B] flex items-center gap-1 justify-end"
                                title="Bấm để chỉnh sửa lương"
                              >
                                <span className="font-extrabold text-cyan-400">{card.salary}</span>
                                <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination Controls */}
                <div className="bg-[#121517] border border-[#2A3138] rounded-xl p-4 flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400">
                    Trang <strong className="text-white">{catalogue.page}</strong> / {catalogue.totalPages} • Tổng cộng{' '}
                    <strong className="text-[#3DFF6B]">{catalogue.total}</strong> thẻ
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded bg-[#181C1F] border border-[#2A3138] hover:border-gray-500 disabled:opacity-40 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Trước
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(catalogue.totalPages, p + 1))}
                      disabled={page >= catalogue.totalPages}
                      className="px-3 py-1.5 rounded bg-[#181C1F] border border-[#2A3138] hover:border-gray-500 disabled:opacity-40 flex items-center gap-1"
                    >
                      Sau <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-20 text-center bg-[#15191C] border border-[#2A3138] rounded-xl p-8 space-y-3">
                <Users className="w-12 h-12 text-gray-500 mx-auto" />
                <h3 className="text-base font-bold text-white">Chưa có cầu thủ nào phù hợp bộ lọc</h3>
                <p className="text-xs text-gray-400 font-mono">
                  Hãy chuyển sang tab <strong>"⚡ Đồng Bộ &amp; Nhập Cầu Thủ"</strong> để kéo các mùa thẻ từ FC Online Nexon hoặc tải file CSV vào hệ thống.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('sync')}
                  className="px-4 py-2 rounded-lg bg-[#3DFF6B] text-black font-mono font-bold text-xs"
                >
                  Sang Tab Đồng Bộ Ngay
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
export default AdminPlayersPage
