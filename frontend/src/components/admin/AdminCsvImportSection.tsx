import React, { useEffect, useRef, useState } from 'react'
import type { ImportReport } from '@/types/domain'
import {
  adminApi,
  type NexonPlayerSearchItem,
  type NexonSeasonMeta,
  type NexonSyncParams,
} from '@/lib/admin-api'

interface AdminCsvImportProps {
  onImportCsv: (file: File) => Promise<ImportReport>
  onSyncNexon?: (params: NexonSyncParams | number[]) => Promise<ImportReport>
  isImporting?: boolean
}

type NexonSubTab = 'season' | 'search' | 'manual'

export const AdminCsvImportSection: React.FC<AdminCsvImportProps> = ({
  onImportCsv,
  onSyncNexon,
  isImporting = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [mode, setMode] = useState<'csv' | 'nexon'>('csv')

  // Nexon Sync State
  const [nexonSubTab, setNexonSubTab] = useState<NexonSubTab>('season')
  const [seasonsList, setSeasonsList] = useState<NexonSeasonMeta[]>([])
  const [isLoadingSeasons, setIsLoadingSeasons] = useState<boolean>(false)
  const [selectedSeasonId, setSelectedSeasonId] = useState<number>(100) // Default: 100 (ICON TM)
  const [seasonSyncLimit, setSeasonSyncLimit] = useState<string>('all') // 'all', '10', '50'

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<NexonPlayerSearchItem[]>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [selectedSpidsFromSearch, setSelectedSpidsFromSearch] = useState<number[]>([])

  // Manual SPID State
  const [spidsInput, setSpidsInput] = useState<string>('877020801, 100000488, 100000250')

  const [isSyncingNexon, setIsSyncingNexon] = useState<boolean>(false)

  // Fetch Nexon seasons on first open
  useEffect(() => {
    if (mode === 'nexon' && seasonsList.length === 0 && !isLoadingSeasons) {
      setIsLoadingSeasons(true)
      adminApi
        .getNexonSeasons()
        .then((res) => {
          setSeasonsList(res)
          if (res.length > 0 && !res.some((s) => s.season_id === selectedSeasonId)) {
            setSelectedSeasonId(res[0].season_id)
          }
        })
        .catch((err) => {
          console.warn('Could not load Nexon seasons metadata:', err)
        })
        .finally(() => {
          setIsLoadingSeasons(false)
        })
    }
  }, [mode, seasonsList.length, isLoadingSeasons, selectedSeasonId])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    setSelectedFileName(file.name)
    setImportError(null)

    try {
      const res = await onImportCsv(file)
      setReport(res)
    } catch (err: any) {
      setImportError(err.message || 'Failed to import CSV.')
    }
  }

  // 1. Sync by Season
  const handleSyncBySeason = async () => {
    if (!onSyncNexon) return
    setImportError(null)
    setIsSyncingNexon(true)

    const limitVal =
      seasonSyncLimit === '10' ? 10 : seasonSyncLimit === '50' ? 50 : undefined

    try {
      const res = await onSyncNexon({
        season_id: selectedSeasonId,
        limit: limitVal,
      })
      setReport(res)
    } catch (err: any) {
      setImportError(err.message || 'Đồng bộ theo mùa giải thất bại.')
    } finally {
      setIsSyncingNexon(false)
    }
  }

  // 2. Search Players by English Name
  const handleSearchPlayers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return

    setIsSearching(true)
    setImportError(null)
    try {
      const res = await adminApi.searchNexonPlayers(q, 40)
      setSearchResults(res)
      // Auto-select all results by default
      setSelectedSpidsFromSearch(res.map((r) => r.spid))
    } catch (err: any) {
      setImportError(err.message || 'Lỗi tìm kiếm cầu thủ.')
    } finally {
      setIsSearching(false)
    }
  }

  // 3. Sync Selected Search Results
  const handleSyncFromSearch = async () => {
    if (!onSyncNexon || selectedSpidsFromSearch.length === 0) return
    setImportError(null)
    setIsSyncingNexon(true)
    try {
      const res = await onSyncNexon({
        spids: selectedSpidsFromSearch,
      })
      setReport(res)
    } catch (err: any) {
      setImportError(err.message || 'Đồng bộ cầu thủ đã chọn thất bại.')
    } finally {
      setIsSyncingNexon(false)
    }
  }

  // 4. Sync Manual SPID list
  const handleSyncManual = async () => {
    if (!onSyncNexon) return
    const rawSpids = spidsInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map(Number)

    if (rawSpids.length === 0) {
      setImportError('Vui lòng nhập ít nhất một mã SPID hợp lệ (dãy số).')
      return
    }

    setImportError(null)
    setIsSyncingNexon(true)
    try {
      const res = await onSyncNexon({ spids: rawSpids })
      setReport(res)
    } catch (err: any) {
      setImportError(err.message || 'Đồng bộ từ FC Online Nexon thất bại.')
    } finally {
      setIsSyncingNexon(false)
    }
  }

  const handleDownloadSample = () => {
    const csvContent =
      'player_id,name,season,position,salary,ovr\n' +
      '1,K. Mbappe,24TOTY,ST,28,116\n' +
      '2,Kaka,ICON,CAM,26,114\n' +
      '3,L. Thuram,ICON,CB,25,113\n' +
      '4,T. Courtois,LOL,GK,24,112\n' +
      '5,P. Vieira,CAP,CDM,27,115\n' +
      '6,Ronaldinho,BTB,LW,26,114\n' +
      '7,D. Beckham,WC22,RW,23,111\n' +
      '8,L. Modric,SPL,CM,24,112\n'
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'fifa_draft_players_sample.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const currentSeason = seasonsList.find((s) => s.season_id === selectedSeasonId)

  // Popular quick seasons
  const popularSeasonIds = [100, 101, 807, 831, 256, 252, 268, 811]

  return (
    <section id="player-import" className="bg-[#121517] border border-[#2A3138] rounded-xl p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#3DFF6B]" />
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2A3138]">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded bg-[#3DFF6B]/10 border border-[#3DFF6B]/30 text-[#3DFF6B] font-mono text-xs font-bold flex items-center justify-center">
            05
          </span>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Nhập &amp; Đồng Bộ Danh Sách Cầu Thủ
            </h2>
            <p className="text-xs text-gray-400">
              Đồng bộ trực tiếp tên tiếng Anh, ảnh và chỉ số từ FC Online Nexon hoặc tải file CSV
            </p>
          </div>
        </div>
        {mode === 'csv' && (
          <button
            type="button"
            onClick={handleDownloadSample}
            className="text-xs font-mono text-[#3DFF6B] hover:underline flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Tải File CSV Mẫu (.csv)
          </button>
        )}
      </div>

      {/* PRIMARY MODE TABS */}
      <div className="flex items-center gap-2 mb-6">
        <button
          type="button"
          onClick={() => { setMode('csv'); setImportError(null); }}
          className={`px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-2 ${
            mode === 'csv'
              ? 'bg-[#3DFF6B] text-black shadow-lg shadow-[#3DFF6B]/20'
              : 'bg-[#1C2024] text-gray-400 hover:text-white border border-[#2A3138]'
          }`}
        >
          <span>📁</span> Tải File CSV / Excel
        </button>
        <button
          type="button"
          onClick={() => { setMode('nexon'); setImportError(null); }}
          className={`px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-2 ${
            mode === 'nexon'
              ? 'bg-[#3DFF6B] text-black shadow-lg shadow-[#3DFF6B]/20'
              : 'bg-[#1C2024] text-gray-400 hover:text-white border border-[#2A3138]'
          }`}
        >
          <span>⚡</span> Đồng Bộ FC Online (Nexon API)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Import / Sync Controls */}
        <div className="lg:col-span-6 space-y-4">
          {mode === 'csv' ? (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
              />

              <div
                onClick={() => {
                  if (!isImporting && fileInputRef.current) {
                    fileInputRef.current.click()
                  }
                }}
                className="border-2 border-dashed border-[#3DFF6B]/40 bg-[#3DFF6B]/[0.02] hover:bg-[#3DFF6B]/[0.05] rounded-xl p-8 text-center cursor-pointer transition-colors group"
              >
                <div className="w-12 h-12 rounded-full bg-[#3DFF6B]/10 border border-[#3DFF6B]/30 text-[#3DFF6B] flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                  {isImporting ? (
                    <div className="w-6 h-6 border-2 border-[#3DFF6B] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                </div>
                <h3 className="text-sm font-bold text-white">
                  {isImporting ? 'Đang Xử Lý Dữ Liệu CSV...' : 'Bấm để Tải Lên hoặc Kéo Thả File CSV Cầu Thủ'}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Chấp nhận định dạng CSV UTF-8 (Tích hợp phân khối và tìm kiếm tiếng Việt không dấu)
                </p>
                {selectedFileName && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#202529] border border-[#2A3138] text-xs font-mono text-gray-300">
                    <span className="w-2 h-2 rounded-full bg-[#3DFF6B]" />
                    Đã chọn: <span className="text-white font-bold">{selectedFileName}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* NEXON SYNC PANEL */
            <div className="bg-[#171B1E] border border-[#2A3138] rounded-xl p-5 space-y-5">
              {/* SUB TABS */}
              <div className="flex items-center gap-1.5 bg-[#121517] p-1 rounded-lg border border-[#2A3138]">
                <button
                  type="button"
                  onClick={() => { setNexonSubTab('season'); setImportError(null); }}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-mono font-bold transition-all ${
                    nexonSubTab === 'season'
                      ? 'bg-[#252C32] text-[#3DFF6B] shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🏆 Theo Mùa Thẻ
                </button>
                <button
                  type="button"
                  onClick={() => { setNexonSubTab('search'); setImportError(null); }}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-mono font-bold transition-all ${
                    nexonSubTab === 'search'
                      ? 'bg-[#252C32] text-[#3DFF6B] shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🔍 Tìm Tên Cầu Thủ
                </button>
                <button
                  type="button"
                  onClick={() => { setNexonSubTab('manual'); setImportError(null); }}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-mono font-bold transition-all ${
                    nexonSubTab === 'manual'
                      ? 'bg-[#252C32] text-[#3DFF6B] shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ⌨️ Nhập Mã SPID
                </button>
              </div>

              {/* 1. SYNC BY SEASON */}
              {nexonSubTab === 'season' && (
                <div className="space-y-4">
                  {/* Quick Select Buttons */}
                  <div>
                    <label className="text-[11px] font-mono text-gray-400 uppercase block mb-1.5">
                      Mùa thẻ thi đấu phổ biến (Click chọn nhanh):
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {popularSeasonIds.map((sid) => {
                        const sMeta = seasonsList.find((s) => s.season_id === sid)
                        const isSelected = selectedSeasonId === sid
                        return (
                          <button
                            key={sid}
                            type="button"
                            onClick={() => setSelectedSeasonId(sid)}
                            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                              isSelected
                                ? 'bg-[#3DFF6B]/15 text-[#3DFF6B] border-[#3DFF6B]'
                                : 'bg-[#202529] text-gray-300 border-[#2A3138] hover:border-gray-500'
                            }`}
                          >
                            {sMeta?.badge_url && (
                              <img src={sMeta.badge_url} alt="" className="w-3.5 h-3.5 object-contain" />
                            )}
                            <span>{sMeta?.code || `ID ${sid}`}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Season Dropdown */}
                  <div>
                    <label className="text-xs font-mono font-bold text-gray-300 uppercase block mb-1.5">
                      Chọn Mùa Giải Cần Đồng Bộ:
                    </label>
                    {isLoadingSeasons ? (
                      <div className="text-xs text-gray-400 font-mono py-2">Đang tải danh sách 153 mùa thẻ...</div>
                    ) : (
                      <select
                        value={selectedSeasonId}
                        onChange={(e) => setSelectedSeasonId(Number(e.target.value))}
                        className="w-full bg-[#121517] border border-[#2A3138] rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#3DFF6B]"
                      >
                        {seasonsList.map((s) => (
                          <option key={s.season_id} value={s.season_id}>
                            {s.code} — {s.name} ({s.player_count} cầu thủ)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Season Info Card */}
                  {currentSeason && (
                    <div className="bg-[#121517] border border-[#2A3138] rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {currentSeason.badge_url && (
                          <img src={currentSeason.badge_url} alt="" className="w-8 h-8 object-contain" />
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-white font-mono">{currentSeason.name}</h4>
                          <span className="text-[11px] text-gray-400 font-mono">
                            Mã: <span className="text-[#3DFF6B]">{currentSeason.code}</span> • Có sẵn{' '}
                            <span className="text-white font-bold">{currentSeason.player_count}</span> cầu thủ
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Limit Option */}
                  <div>
                    <label className="text-[11px] font-mono text-gray-400 uppercase block mb-1.5">
                      Phạm vi đồng bộ:
                    </label>
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      {[
                        { id: '10', label: '10 thẻ đầu (Test nhanh)' },
                        { id: '50', label: '50 thẻ đầu' },
                        { id: 'all', label: 'Toàn bộ mùa giải' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSeasonSyncLimit(opt.id)}
                          className={`py-1.5 px-2 rounded border text-center transition-all ${
                            seasonSyncLimit === opt.id
                              ? 'bg-[#3DFF6B]/10 border-[#3DFF6B] text-[#3DFF6B] font-bold'
                              : 'bg-[#121517] border-[#2A3138] text-gray-400 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncBySeason}
                    disabled={isSyncingNexon}
                    className="w-full py-3 px-4 rounded-lg bg-[#3DFF6B] hover:bg-[#32d95b] disabled:opacity-50 text-black font-bold font-mono text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#3DFF6B]/20"
                  >
                    {isSyncingNexon ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        Đang đồng bộ mùa {currentSeason?.code || selectedSeasonId} từ Nexon...
                      </>
                    ) : (
                      <>
                        <span>⚡</span> Đồng Bộ Mùa {currentSeason?.code || selectedSeasonId} Vào DB
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 2. SEARCH BY PLAYER NAME */}
              {nexonSubTab === 'search' && (
                <div className="space-y-4">
                  <form onSubmit={handleSearchPlayers} className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Gõ tên cầu thủ (ví dụ: Ronaldo, Messi, Beckham, Gullit)..."
                      className="flex-1 bg-[#121517] border border-[#2A3138] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#3DFF6B]"
                    />
                    <button
                      type="submit"
                      disabled={isSearching || !searchQuery.trim()}
                      className="px-4 py-2 rounded-lg bg-[#252C32] hover:bg-[#2F373E] text-white font-mono text-xs font-bold border border-[#2A3138] disabled:opacity-50"
                    >
                      {isSearching ? 'Đang tìm...' : 'Tìm Kiếm'}
                    </button>
                  </form>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
                        <span>Tìm thấy {searchResults.length} thẻ cầu thủ:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedSpidsFromSearch(searchResults.map((r) => r.spid))}
                            className="text-[#3DFF6B] hover:underline"
                          >
                            Chọn tất cả
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => setSelectedSpidsFromSearch([])}
                            className="hover:underline"
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-[#2A3138] rounded-lg p-2 bg-[#121517]">
                        {searchResults.map((card) => {
                          const isChecked = selectedSpidsFromSearch.includes(card.spid)
                          return (
                            <label
                              key={card.spid}
                              className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors border ${
                                isChecked
                                  ? 'bg-[#3DFF6B]/5 border-[#3DFF6B]/40 text-white'
                                  : 'bg-[#181C1F] border-transparent text-gray-400 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedSpidsFromSearch((prev) =>
                                      prev.includes(card.spid)
                                        ? prev.filter((id) => id !== card.spid)
                                        : [...prev, card.spid]
                                    )
                                  }}
                                  className="accent-[#3DFF6B]"
                                />
                                {card.badge_url && (
                                  <img src={card.badge_url} alt="" className="w-4 h-4 object-contain" />
                                )}
                                <span className="text-xs font-bold font-mono">{card.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#252C32] text-gray-300 font-mono">
                                  {card.season_code}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-gray-500">ID: {card.spid}</span>
                            </label>
                          )
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={handleSyncFromSearch}
                        disabled={isSyncingNexon || selectedSpidsFromSearch.length === 0}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#3DFF6B] hover:bg-[#32d95b] disabled:opacity-50 text-black font-bold font-mono text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#3DFF6B]/15"
                      >
                        {isSyncingNexon ? (
                          <>
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            Đang đồng bộ {selectedSpidsFromSearch.length} thẻ...
                          </>
                        ) : (
                          <>
                            <span>⚡</span> Đồng Bộ {selectedSpidsFromSearch.length} Thẻ Đã Chọn Vào DB
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. MANUAL SPID INPUT */}
              {nexonSubTab === 'manual' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-mono font-bold text-gray-300 uppercase block mb-1">
                      Danh sách mã SPID FC Online:
                    </label>
                    <p className="text-[11px] text-gray-400 mb-2">
                      Dán các mã SPID (cách nhau bởi dấu phẩy hoặc xuống dòng).
                    </p>
                    <textarea
                      value={spidsInput}
                      onChange={(e) => setSpidsInput(e.target.value)}
                      rows={4}
                      placeholder="Ví dụ: 877020801, 100000488, 100000250"
                      className="w-full bg-[#121517] border border-[#2A3138] rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-[#3DFF6B]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncManual}
                    disabled={isSyncingNexon}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#3DFF6B] hover:bg-[#32d95b] disabled:opacity-50 text-black font-bold font-mono text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#3DFF6B]/10"
                  >
                    {isSyncingNexon ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        Đang đồng bộ từ Nexon DataCenter...
                      </>
                    ) : (
                      <>
                        <span>⚡</span> Bắt đầu đồng bộ danh sách SPID
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {importError && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-xs font-mono text-red-300 flex items-center justify-between">
              <span>⚠️ {importError}</span>
              <button type="button" onClick={() => setImportError(null)} className="text-red-400 hover:text-white">✕</button>
            </div>
          )}
        </div>

        {/* Right Column: Reports & Result Cards */}
        <div className="lg:col-span-6 bg-[#171B1E] border border-[#2A3138] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#2A3138]">
              <h3 className="text-xs font-mono uppercase font-bold text-gray-300">
                {mode === 'csv' ? 'Báo Cáo Kiểm Tra CSV' : 'Kết Quả Đồng Bộ FC Online'}
              </h3>
              <span className="text-[10px] font-mono text-gray-500">
                {isSyncingNexon || isImporting ? 'Đang thực thi...' : report ? 'Đã hoàn tất' : 'Chờ thực hiện'}
              </span>
            </div>

            {/* Stat Counters */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-[#121517] p-2.5 rounded-lg border border-[#2A3138] text-center">
                <span className="text-[10px] font-mono text-gray-400 uppercase block">Tổng</span>
                <span className="text-base font-mono font-bold text-white">
                  {report ? (report.rowsRead ?? (report as any).rows_read ?? 0) : 0}
                </span>
              </div>
              <div className="bg-[#121517] p-2.5 rounded-lg border border-[#2A3138] text-center">
                <span className="text-[10px] font-mono text-gray-400 uppercase block">Thêm Mới</span>
                <span className="text-base font-mono font-bold text-[#3DFF6B]">
                  {report ? (report.rowsInserted ?? (report as any).rows_inserted ?? 0) : 0}
                </span>
              </div>
              <div className="bg-[#121517] p-2.5 rounded-lg border border-[#2A3138] text-center">
                <span className="text-[10px] font-mono text-gray-400 uppercase block">Cập Nhật</span>
                <span className="text-base font-mono font-bold text-cyan-400">
                  {report ? (report.rowsUpdated ?? (report as any).rows_updated ?? 0) : 0}
                </span>
              </div>
              <div className="bg-[#121517] p-2.5 rounded-lg border border-[#2A3138] text-center">
                <span className="text-[10px] font-mono text-gray-400 uppercase block">Lỗi / Bỏ Qua</span>
                <span className="text-base font-mono font-bold text-red-400">
                  {report ? (report.rowsSkipped ?? (report as any).rows_skipped ?? 0) : 0}
                </span>
              </div>
            </div>

            {/* Logs / Errors */}
            {report && report.errors.length > 0 && (
              <div className="mb-4 max-h-32 overflow-y-auto bg-red-950/40 border border-red-500/30 rounded-lg p-2.5 text-[11px] font-mono text-red-300 space-y-1">
                {report.errors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            {/* Live Result Cards */}
            {report && (
              <div className="bg-[#121517] rounded-lg p-3 border border-[#2A3138]">
                <div className="flex items-center gap-2 text-xs font-mono text-[#3DFF6B] mb-2 font-bold">
                  <span>✓</span> Đồng bộ thành công{' '}
                  {(report.rowsInserted ?? (report as any).rows_inserted ?? 0) +
                    (report.rowsUpdated ?? (report as any).rows_updated ?? 0)}{' '}
                  thẻ cầu thủ vào Database!
                </div>
                <p className="text-[11px] text-gray-400 font-mono">
                  Dữ liệu đã sẵn sàng cho phòng Draft: Tìm kiếm không dấu, bộ lọc quỹ lương, 6 chỉ số core và ảnh đại diện CDN.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#2A3138] flex items-center justify-between text-[11px] font-mono text-gray-500">
            <span>• Dữ liệu: FC Online Nexon Korea</span>
            <span>Tự động chuyển tên Tiếng Anh (Title Case)</span>
          </div>
        </div>
      </div>
    </section>
  )
}
