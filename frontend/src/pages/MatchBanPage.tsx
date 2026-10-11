import React, { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { matchApi } from '@/lib/match-api'
import { useAuth } from '@/context/AuthContext'
import { useMatchSocket } from '@/hooks/useMatchSocket'
import { FvplTopHud } from '@/components/match/FvplTopHud'
import { FvplRosterBoard } from '@/components/match/FvplRosterBoard'
import { FvplBigBanReveal, type BannedPlayerDetail } from '@/components/match/FvplBigBanReveal'
import { FvplFooter } from '@/components/match/FvplFooter'
import { RecordScoreModal } from '@/components/match/RecordScoreModal'
import { getPositionLine, LINE_NAME_VI } from '@/lib/draft-utils'
import type {
  MatchDetail,
  TeamRosterResponse,
  RosterItem,
} from '@/types/domain'

// 23 Iconic Players Fallback for Home Team (TA GLOBAL) matching FVPL Screenshot
const FALLBACK_TA_GLOBAL_23: RosterItem[] = [
  { pickId: 'ta-1', round: 1, turnNumber: 1, salaryAtPick: 30, pickedAt: '', player: { playerSeasonId: 'ta-p1', playerId: 'p-1', name: 'T. Henry', position: 'ST', rating: 130, salary: 30, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'ta-2', round: 2, turnNumber: 2, salaryAtPick: 30, pickedAt: '', player: { playerSeasonId: 'ta-p2', playerId: 'p-2', name: 'R. Baggio', position: 'CF', rating: 131, salary: 30, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'ta-3', round: 3, turnNumber: 3, salaryAtPick: 29, pickedAt: '', player: { playerSeasonId: 'ta-p3', playerId: 'p-3', name: 'A. Shevchenko', position: 'ST', rating: 130, salary: 29, season: { id: 's-ln', code: 'LN', name: 'Loyal Heroes' } } },
  { pickId: 'ta-4', round: 4, turnNumber: 4, salaryAtPick: 29, pickedAt: '', player: { playerSeasonId: 'ta-p4', playerId: 'p-4', name: 'Luis Figo', position: 'RW', rating: 130, salary: 29, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'ta-5', round: 5, turnNumber: 5, salaryAtPick: 29, pickedAt: '', player: { playerSeasonId: 'ta-p5', playerId: 'p-5', name: 'A. Del Piero', position: 'CF', rating: 130, salary: 29, season: { id: 's-btb', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 'ta-6', round: 6, turnNumber: 6, salaryAtPick: 29, pickedAt: '', player: { playerSeasonId: 'ta-p6', playerId: 'p-6', name: 'A. Pirlo', position: 'CM', rating: 130, salary: 29, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },

  { pickId: 'ta-7', round: 7, turnNumber: 7, salaryAtPick: 28, pickedAt: '', player: { playerSeasonId: 'ta-p7', playerId: 'p-7', name: 'F. Torres', position: 'ST', rating: 128, salary: 28, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'ta-8', round: 8, turnNumber: 8, salaryAtPick: 29, pickedAt: '', player: { playerSeasonId: 'ta-p8', playerId: 'p-8', name: 'F. Totti', position: 'CF', rating: 130, salary: 29, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'ta-9', round: 9, turnNumber: 9, salaryAtPick: 31, pickedAt: '', player: { playerSeasonId: 'ta-p9', playerId: 'p-9', name: 'Z. Zidane', position: 'CAM', rating: 131, salary: 31, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'ta-10', round: 10, turnNumber: 10, salaryAtPick: 29, pickedAt: '', player: { playerSeasonId: 'ta-p10', playerId: 'p-10', name: 'P. Nedved', position: 'LM', rating: 130, salary: 29, season: { id: 's-btb', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 'ta-11', round: 11, turnNumber: 11, salaryAtPick: 31, pickedAt: '', player: { playerSeasonId: 'ta-p11', playerId: 'p-11', name: 'Ronaldinho', position: 'LW', rating: 131, salary: 31, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'ta-12', round: 12, turnNumber: 12, salaryAtPick: 28, pickedAt: '', player: { playerSeasonId: 'ta-p12', playerId: 'p-12', name: 'Vinicius Jr.', position: 'LW', rating: 128, salary: 28, season: { id: 's-toty', code: '24TOTY', name: 'TOTY 24' } } },

  { pickId: 'ta-13', round: 13, turnNumber: 13, salaryAtPick: 26, pickedAt: '', player: { playerSeasonId: 'ta-p13', playerId: 'p-13', name: 'P. Pogba', position: 'CM', rating: 126, salary: 26, season: { id: 's-btb', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 'ta-14', round: 14, turnNumber: 14, salaryAtPick: 28, pickedAt: '', player: { playerSeasonId: 'ta-p14', playerId: 'p-14', name: 'W. Sneijder', position: 'CAM', rating: 129, salary: 28, season: { id: 's-cap', code: 'CAP', name: 'Captain' } } },
  { pickId: 'ta-15', round: 15, turnNumber: 15, salaryAtPick: 27, pickedAt: '', player: { playerSeasonId: 'ta-p15', playerId: 'p-15', name: 'C. Seedorf', position: 'CM', rating: 128, salary: 27, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'ta-16', round: 16, turnNumber: 16, salaryAtPick: 32, pickedAt: '', player: { playerSeasonId: 'ta-p16', playerId: 'p-16', name: 'P. Maldini', position: 'CB', rating: 131, salary: 32, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'ta-17', round: 17, turnNumber: 17, salaryAtPick: 28, pickedAt: '', player: { playerSeasonId: 'ta-p17', playerId: 'p-17', name: 'R. Carlos', position: 'LB', rating: 128, salary: 28, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'ta-18', round: 18, turnNumber: 18, salaryAtPick: 26, pickedAt: '', player: { playerSeasonId: 'ta-p18', playerId: 'p-18', name: 'D. Alaba', position: 'CB', rating: 126, salary: 26, season: { id: 's-toty', code: '24TOTY', name: 'TOTY 24' } } },

  { pickId: 'ta-19', round: 19, turnNumber: 19, salaryAtPick: 26, pickedAt: '', player: { playerSeasonId: 'ta-p19', playerId: 'p-19', name: 'G. Zambrotta', position: 'RB', rating: 126, salary: 26, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'ta-20', round: 20, turnNumber: 20, salaryAtPick: 27, pickedAt: '', player: { playerSeasonId: 'ta-p20', playerId: 'p-20', name: 'K. Walker', position: 'RB', rating: 127, salary: 27, season: { id: 's-btb', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 'ta-21', round: 21, turnNumber: 21, salaryAtPick: 28, pickedAt: '', player: { playerSeasonId: 'ta-p21', playerId: 'p-21', name: 'H. Son', position: 'LM', rating: 128, salary: 28, season: { id: 's-toty', code: '23TOTY', name: 'TOTY 23' } } },
  { pickId: 'ta-22', round: 22, turnNumber: 22, salaryAtPick: 26, pickedAt: '', player: { playerSeasonId: 'ta-p22', playerId: 'p-22', name: 'H. Lloris', position: 'GK', rating: 128, salary: 26, season: { id: 's-ucl', code: '22UCL', name: 'UCL 22' } } },
  { pickId: 'ta-23', round: 23, turnNumber: 23, salaryAtPick: 26, pickedAt: '', player: { playerSeasonId: 'ta-p23', playerId: 'p-23', name: 'Donnarumma', position: 'GK', rating: 128, salary: 26, season: { id: 's-toty', code: '24TOTY', name: 'TOTY 24' } } },
]

// 23 Iconic Players Fallback for Away Team (AMITA FC) matching FVPL Screenshot
const FALLBACK_AMITA_FC_23: RosterItem[] = [
  { pickId: 'am-1', round: 1, turnNumber: 1, salaryAtPick: 32, pickedAt: '', player: { playerSeasonId: 'am-p1', playerId: 'p-101', name: 'Ronaldo', position: 'ST', rating: 132, salary: 32, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'am-2', round: 2, turnNumber: 2, salaryAtPick: 33, pickedAt: '', player: { playerSeasonId: 'am-p2', playerId: 'p-102', name: 'Pelé', position: 'CF', rating: 133, salary: 33, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'am-3', round: 3, turnNumber: 3, salaryAtPick: 31, pickedAt: '', player: { playerSeasonId: 'am-p3', playerId: 'p-103', name: 'K. Mbappé', position: 'ST', rating: 131, salary: 31, season: { id: 's-toty', code: '24TOTY', name: 'TOTY 24' } } },
  { pickId: 'am-4', round: 4, turnNumber: 4, salaryAtPick: 31, pickedAt: '', player: { playerSeasonId: 'am-p4', playerId: 'p-104', name: 'Ronaldinho', position: 'LW', rating: 131, salary: 31, season: { id: 's-btb', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 'am-5', round: 5, turnNumber: 5, salaryAtPick: 29, pickedAt: '', player: { playerSeasonId: 'am-p5', playerId: 'p-105', name: 'E. Hazard', position: 'LW', rating: 130, salary: 29, season: { id: 's-wc', code: 'WC22', name: 'World Cup 22' } } },
  { pickId: 'am-6', round: 6, turnNumber: 6, salaryAtPick: 30, pickedAt: '', player: { playerSeasonId: 'am-p6', playerId: 'p-106', name: 'K. Benzema', position: 'ST', rating: 131, salary: 30, season: { id: 's-ucl', code: '21UCL', name: 'UCL 21' } } },

  { pickId: 'am-7', round: 7, turnNumber: 7, salaryAtPick: 32, pickedAt: '', player: { playerSeasonId: 'am-p7', playerId: 'p-107', name: 'J. Cruyff', position: 'CF', rating: 132, salary: 32, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'am-8', round: 8, turnNumber: 8, salaryAtPick: 31, pickedAt: '', player: { playerSeasonId: 'am-p8', playerId: 'p-108', name: 'T. Henry', position: 'ST', rating: 131, salary: 31, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'am-9', round: 9, turnNumber: 9, salaryAtPick: 30, pickedAt: '', player: { playerSeasonId: 'am-p9', playerId: 'p-109', name: 'Kaká', position: 'CAM', rating: 130, salary: 30, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'am-10', round: 10, turnNumber: 10, salaryAtPick: 30, pickedAt: '', player: { playerSeasonId: 'am-p110', playerId: 'p-110', name: 'D. Beckham', position: 'RM', rating: 131, salary: 30, season: { id: 's-wc', code: 'WC22', name: 'World Cup 22' } } },
  { pickId: 'am-11', round: 11, turnNumber: 11, salaryAtPick: 31, pickedAt: '', player: { playerSeasonId: 'am-p111', playerId: 'p-111', name: 'Zico', position: 'CAM', rating: 131, salary: 31, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'am-12', round: 12, turnNumber: 12, salaryAtPick: 30, pickedAt: '', player: { playerSeasonId: 'am-p112', playerId: 'p-112', name: 'Luis Figo', position: 'RW', rating: 131, salary: 30, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },

  { pickId: 'am-13', round: 13, turnNumber: 13, salaryAtPick: 28, pickedAt: '', player: { playerSeasonId: 'am-p113', playerId: 'p-113', name: 'F. Lampard', position: 'CM', rating: 129, salary: 28, season: { id: 's-cap', code: 'CAP', name: 'Captain' } } },
  { pickId: 'am-14', round: 14, turnNumber: 14, salaryAtPick: 29, pickedAt: '', player: { playerSeasonId: 'am-p114', playerId: 'p-114', name: 'van der Sar', position: 'GK', rating: 131, salary: 29, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'am-15', round: 15, turnNumber: 15, salaryAtPick: 29, pickedAt: '', player: { playerSeasonId: 'am-p115', playerId: 'p-115', name: 'L. Modrić', position: 'CM', rating: 130, salary: 29, season: { id: 's-spl', code: 'SPL', name: 'Spotlight' } } },
  { pickId: 'am-16', round: 16, turnNumber: 16, salaryAtPick: 32, pickedAt: '', player: { playerSeasonId: 'am-p116', playerId: 'p-116', name: 'P. Maldini', position: 'CB', rating: 131, salary: 32, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'am-17', round: 17, turnNumber: 17, salaryAtPick: 28, pickedAt: '', player: { playerSeasonId: 'am-p117', playerId: 'p-117', name: 'L. Thuram', position: 'CB', rating: 129, salary: 28, season: { id: 's-icon', code: 'ICON', name: 'Icon' } } },
  { pickId: 'am-18', round: 18, turnNumber: 18, salaryAtPick: 27, pickedAt: '', player: { playerSeasonId: 'am-p118', playerId: 'p-118', name: 'A. Hakimi', position: 'RB', rating: 128, salary: 27, season: { id: 's-ucl', code: '22UCL', name: 'UCL 22' } } },

  { pickId: 'am-19', round: 19, turnNumber: 19, salaryAtPick: 25, pickedAt: '', player: { playerSeasonId: 'am-p119', playerId: 'p-119', name: 'D. Dumfries', position: 'RB', rating: 125, salary: 25, season: { id: 's-euro', code: 'E21', name: 'Euro 21' } } },
  { pickId: 'am-20', round: 20, turnNumber: 20, salaryAtPick: 25, pickedAt: '', player: { playerSeasonId: 'am-p120', playerId: 'p-120', name: 'S. de Vrij', position: 'CB', rating: 126, salary: 25, season: { id: 's-btb', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 'am-21', round: 21, turnNumber: 21, salaryAtPick: 28, pickedAt: '', player: { playerSeasonId: 'am-p121', playerId: 'p-121', name: 'S. Ramos', position: 'CB', rating: 129, salary: 28, season: { id: 's-btb', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 'am-22', round: 22, turnNumber: 22, salaryAtPick: 27, pickedAt: '', player: { playerSeasonId: 'am-p122', playerId: 'p-122', name: 'T. Courtois', position: 'GK', rating: 128, salary: 27, season: { id: 's-lol', code: 'LOL', name: 'Legend' } } },
  { pickId: 'am-23', round: 23, turnNumber: 23, salaryAtPick: 17, pickedAt: '', player: { playerSeasonId: 'am-p123', playerId: 'p-123', name: 'A. Areola', position: 'GK', rating: 103, salary: 17, season: { id: 's-tb', code: 'TB', name: 'Top Boom' } } },
]

export const MatchBanPage: React.FC = () => {
  const { matchId = '', tournamentId = '' } = useParams<{
    matchId: string
    tournamentId?: string
  }>()
  const { user, isAdmin } = useAuth()

  // State simulator mode for live / preview testing
  const [simulatedMode, setSimulatedMode] = useState<
    'live' | 'home_turn' | 'away_turn' | 'reveal' | 'locked'
  >('live')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRecordScoreOpen, setIsRecordScoreOpen] = useState(false)
  const [bigBanReveal, setBigBanReveal] = useState<BannedPlayerDetail | null>(null)

  // Optimistic UI state for 0ms visual feedback
  const [optimisticBannedIds, setOptimisticBannedIds] = useState<Set<string>>(new Set())
  const [optimisticTurnTeamId, setOptimisticTurnTeamId] = useState<string | null>(null)
  const [optimisticTimerResetAt, setOptimisticTimerResetAt] = useState<number | null>(null)
  const [optimisticSeconds, setOptimisticSeconds] = useState<number>(30)
  const [turnToast, setTurnToast] = useState<string | null>(null)

  // Countdown loop for optimistic 30s timer
  useEffect(() => {
    if (!optimisticTimerResetAt) return
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.ceil((optimisticTimerResetAt - Date.now()) / 1000))
      setOptimisticSeconds(diff)
      if (diff <= 0) {
        setOptimisticTimerResetAt(null)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [optimisticTimerResetAt])

  // 1. Fetch initial match data via REST
  const {
    data: fetchedMatch,
    refetch: refetchMatch,
  } = useQuery<MatchDetail>({
    queryKey: ['match', matchId],
    queryFn: () => matchApi.getMatchDetail(matchId),
    enabled: !!matchId,
    refetchInterval: simulatedMode === 'live' ? 8000 : false,
  })

  // 2. Real-time WebSocket hook
  const {
    matchState: socketMatch,
    secondsRemaining: socketSeconds,
    setMatchState,
  } = useMatchSocket({
    matchId,
    onMatchEvent: (event) => {
      // If a ban was just submitted with player info, trigger Big Ban Reveal Modal!
      if (event.eventType === 'BAN_SUBMITTED' && event.lastBannedPlayer) {
        setBigBanReveal({
          playerName: event.lastBannedPlayer.playerName,
          position: event.lastBannedPlayer.position,
          rating: event.lastBannedPlayer.rating,
          salary: event.lastBannedPlayer.salary,
          imageUrl: event.lastBannedPlayer.imageUrl,
          seasonCode: event.lastBannedPlayer.seasonCode,
          banningTeamName: event.lastBannedPlayer.banningTeamName,
        })
      }
    },
    onBanChange: () => {
      refetchMatch()
    },
  })

  // Clear optimistic timer when server syncs socketMatch banExpiresAt
  useEffect(() => {
    if (socketMatch?.banExpiresAt) {
      setOptimisticTimerResetAt(null)
    }
  }, [socketMatch?.banExpiresAt])

  // Merge socket and fetched match data with version precedence
  const currentMatch = useMemo(() => {
    if (!socketMatch && !fetchedMatch) return null
    if (!socketMatch) return fetchedMatch
    if (!fetchedMatch) return socketMatch

    const primary =
      (socketMatch.version ?? 0) >= (fetchedMatch.version ?? 0)
        ? socketMatch
        : fetchedMatch
    const secondary =
      (socketMatch.version ?? 0) >= (fetchedMatch.version ?? 0)
        ? fetchedMatch
        : socketMatch

    return {
      ...secondary,
      ...primary,
      bans: primary.bans?.length ? primary.bans : secondary.bans,
      currentBanningTeamId:
        primary.currentBanningTeamId ?? secondary.currentBanningTeamId,
      banExpiresAt: primary.banExpiresAt ?? secondary.banExpiresAt,
    }
  }, [socketMatch, fetchedMatch])

  // Clear optimistic turn override when match version advances from server
  useEffect(() => {
    if (currentMatch?.version) {
      setOptimisticTurnTeamId(null)
    }
  }, [currentMatch?.version, currentMatch?.currentBanningTeamId])

  const homeTeam = useMemo(() => {
    return (
      currentMatch?.homeTeam || {
        id: 'home-team',
        name: 'TA GLOBAL',
        confirmed: false,
        banCount: 0,
        score: null,
      }
    )
  }, [currentMatch?.homeTeam])

  const awayTeam = useMemo(() => {
    return (
      currentMatch?.awayTeam || {
        id: 'away-team',
        name: 'AMITA FC',
        confirmed: false,
        banCount: 0,
        score: null,
      }
    )
  }, [currentMatch?.awayTeam])

  // 3. Fetch drafted rosters of both teams
  const { data: homeRosterData } = useQuery<TeamRosterResponse>({
    queryKey: ['team-roster', homeTeam.id],
    queryFn: () => matchApi.getTeamRoster(homeTeam.id),
    enabled: !!homeTeam.id && homeTeam.id !== 'home-team',
  })

  const { data: awayRosterData } = useQuery<TeamRosterResponse>({
    queryKey: ['team-roster', awayTeam.id],
    queryFn: () => matchApi.getTeamRoster(awayTeam.id),
    enabled: !!awayTeam.id && awayTeam.id !== 'away-team',
  })

  const homeRoster = useMemo(() => {
    if (homeRosterData?.roster && homeRosterData.roster.length >= 23) {
      return homeRosterData.roster
    }
    if (homeRosterData?.roster && homeRosterData.roster.length > 0) {
      // Pad to 23 with fallbacks if needed
      return [
        ...homeRosterData.roster,
        ...FALLBACK_TA_GLOBAL_23.slice(homeRosterData.roster.length),
      ]
    }
    return FALLBACK_TA_GLOBAL_23
  }, [homeRosterData?.roster])

  const awayRoster = useMemo(() => {
    if (awayRosterData?.roster && awayRosterData.roster.length >= 23) {
      return awayRosterData.roster
    }
    if (awayRosterData?.roster && awayRosterData.roster.length > 0) {
      return [
        ...awayRosterData.roster,
        ...FALLBACK_AMITA_FC_23.slice(awayRosterData.roster.length),
      ]
    }
    return FALLBACK_AMITA_FC_23
  }, [awayRosterData?.roster])

  // Extract set of banned playerSeasonIds (merged with optimistic bans for 0ms response)
  const bannedPlayerSeasonIds = useMemo(() => {
    const set = new Set<string>()
    if (currentMatch?.bans) {
      for (const b of currentMatch.bans) {
        set.add(b.playerSeasonId)
      }
    }
    // Merge optimistic bans immediately
    for (const id of optimisticBannedIds) {
      set.add(id)
    }
    // If in locked simulated mode, mark several as banned for visual accuracy
    if (simulatedMode === 'locked') {
      set.add('ta-p16') // Maldini
      set.add('ta-p3') // Shevchenko
      set.add('am-p16') // Maldini
      set.add('am-p8') // Henry
    }
    return set
  }, [currentMatch?.bans, simulatedMode, optimisticBannedIds])

  // Compute live ban counts including optimistic bans
  const effectiveHomeBanCount = useMemo(() => {
    const fromAway = awayRoster.filter((r) =>
      bannedPlayerSeasonIds.has(r.player.playerSeasonId)
    ).length
    return Math.max(homeTeam.banCount, fromAway)
  }, [awayRoster, bannedPlayerSeasonIds, homeTeam.banCount])

  const effectiveAwayBanCount = useMemo(() => {
    const fromHome = homeRoster.filter((r) =>
      bannedPlayerSeasonIds.has(r.player.playerSeasonId)
    ).length
    return Math.max(awayTeam.banCount, fromHome)
  }, [homeRoster, bannedPlayerSeasonIds, awayTeam.banCount])

  // Determine current banning turn
  const effectiveCurrentBanningTeamId = useMemo(() => {
    if (simulatedMode === 'home_turn') return homeTeam.id
    if (simulatedMode === 'away_turn') return awayTeam.id
    if (simulatedMode === 'reveal') return homeTeam.id
    if (simulatedMode === 'locked') return null
    if (optimisticTurnTeamId) return optimisticTurnTeamId
    return currentMatch?.currentBanningTeamId || homeTeam.id
  }, [
    simulatedMode,
    optimisticTurnTeamId,
    currentMatch?.currentBanningTeamId,
    homeTeam.id,
    awayTeam.id,
  ])

  const effectiveStatus = useMemo(() => {
    if (simulatedMode === 'locked') return 'BANS_LOCKED'
    return currentMatch?.status || 'BAN_PHASE'
  }, [simulatedMode, currentMatch?.status])

  const effectiveSeconds = useMemo(() => {
    if (simulatedMode === 'home_turn' || simulatedMode === 'away_turn') return 29
    if (simulatedMode === 'locked') return 0
    if (optimisticTimerResetAt) return optimisticSeconds
    return socketSeconds || 30
  }, [simulatedMode, optimisticTimerResetAt, optimisticSeconds, socketSeconds])

  // Target team logic:
  // If Home Team is banning -> Target is Away Team
  // If Away Team is banning -> Target is Home Team
  const isHomeTurn = effectiveCurrentBanningTeamId === homeTeam.id
  const isAwayTurn = effectiveCurrentBanningTeamId === awayTeam.id

  const canUserBanHomeRoster = useMemo(() => {
    // In simulated mode, allow user to click target board to preview
    if (simulatedMode !== 'live') return isAwayTurn
    // Only banned when it is Away Team's turn
    if (effectiveStatus !== 'BAN_PHASE') return false
    if (!isAwayTurn) return false
    if (isAdmin) return true
    return user?.teamId === awayTeam.id
  }, [simulatedMode, effectiveStatus, isAwayTurn, isAdmin, user?.teamId, awayTeam.id])

  const canUserBanAwayRoster = useMemo(() => {
    // In simulated mode, allow user to click target board to preview
    if (simulatedMode !== 'live') return isHomeTurn
    // Only banned when it is Home Team's turn
    if (effectiveStatus !== 'BAN_PHASE') return false
    if (!isHomeTurn) return false
    if (isAdmin) return true
    return user?.teamId === homeTeam.id
  }, [simulatedMode, effectiveStatus, isHomeTurn, isAdmin, user?.teamId, homeTeam.id])

  // 4. Mutations
  const submitBanMutation = useMutation({
    mutationFn: (vars: {
      playerSeasonId: string
      targetTeamId: string
      banningTeamId: string
      playerObj: any
    }) =>
      matchApi.submitBan(matchId, {
        playerSeasonId: vars.playerSeasonId,
        targetTeamId: vars.targetTeamId,
        banningTeamId: vars.banningTeamId,
      }),
    onSuccess: (newBan, vars) => {
      setErrorMessage(null)
      // Open reveal modal instantly for smooth UX
      setBigBanReveal({
        playerName: vars.playerObj.name,
        position: vars.playerObj.position,
        rating: vars.playerObj.rating,
        salary: vars.playerObj.salary,
        imageUrl: vars.playerObj.imageUrl,
        seasonCode: vars.playerObj.seasonCode,
        banningTeamName:
          vars.banningTeamId === homeTeam.id ? homeTeam.name : awayTeam.name,
      })

      if (setMatchState) {
        setMatchState((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            bans: [...prev.bans, newBan],
          }
        })
      }
      refetchMatch()
    },
    onError: (err: any, vars) => {
      // Rollback optimistic updates on failure
      setTurnToast(null)
      setOptimisticBannedIds((prev) => {
        const next = new Set(prev)
        next.delete(vars.playerSeasonId)
        return next
      })
      setOptimisticTurnTeamId(null)
      setOptimisticTimerResetAt(null)
      setBigBanReveal(null)
      setErrorMessage(
        err?.response?.data?.message || err.message || 'Không thể cấm cầu thủ.'
      )
    },
  })

  const skipTurnMutation = useMutation({
    mutationFn: () => matchApi.skipBanTurn(matchId),
    onSuccess: (updated) => {
      setErrorMessage(null)
      setOptimisticTimerResetAt(Date.now() + 30000)
      setOptimisticSeconds(30)
      if (setMatchState) setMatchState(updated as any)
      refetchMatch()
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || err.message || 'Không thể bỏ qua lượt.')
    },
  })

  const startBanPhaseMutation = useMutation({
    mutationFn: () => matchApi.startBanPhase(matchId),
    onSuccess: (updated) => {
      setErrorMessage(null)
      setOptimisticBannedIds(new Set())
      setOptimisticTurnTeamId(null)
      setOptimisticTimerResetAt(Date.now() + 30000)
      setOptimisticSeconds(30)
      setTurnToast(`BẮT ĐẦU GIAI ĐOẠN CẤM (LƯỢT ${homeTeam.name})!`)
      setTimeout(() => setTurnToast(null), 3000)
      if (setMatchState) setMatchState(updated as any)
      refetchMatch()
    },
  })

  const resetBanMutation = useMutation({
    mutationFn: () => matchApi.resetBanPhase(matchId),
    onSuccess: (updated) => {
      setErrorMessage(null)
      setOptimisticBannedIds(new Set())
      setOptimisticTurnTeamId(null)
      setOptimisticTimerResetAt(Date.now() + 30000)
      setOptimisticSeconds(30)
      setBigBanReveal(null)
      setTurnToast(`ĐÃ RESET! LƯỢT 1: ${homeTeam.name} CẤM (30s)`)
      setTimeout(() => setTurnToast(null), 3000)
      if (setMatchState) setMatchState(updated as any)
      refetchMatch()
    },
    onError: (err: any) => {
      setErrorMessage(
        err?.response?.data?.message || err.message || 'Không thể reset giai đoạn cấm.'
      )
    },
  })

  const recordScoreMutation = useMutation({
    mutationFn: async ({
      matchId,
      homeScore,
      awayScore,
    }: {
      matchId: string
      homeScore: number
      awayScore: number
    }) => {
      return matchApi.recordScore(matchId, { homeScore, awayScore })
    },
    onSuccess: (updated) => {
      refetchMatch()
      if (setMatchState) setMatchState(updated as any)
      setIsRecordScoreOpen(false)
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Không thể lưu tỉ số trận đấu.')
    },
  })

  // Ban click handlers with 0ms Optimistic updates & 30s timer resets
  const handleBanFromHomeRoster = (playerSeasonId: string, player: any) => {
    // Check tactical line limit: maximum 2 bans per line (FW, MF, DF)
    const line = getPositionLine(player.position)
    const lineName = LINE_NAME_VI[line] || line

    const fromRosterCount = homeRoster.filter(
      (r) =>
        bannedPlayerSeasonIds.has(r.player.playerSeasonId) &&
        getPositionLine(r.player.position) === line
    ).length
    const fromBansCount = (currentMatch?.bans || []).filter(
      (b) =>
        b.targetTeamId === homeTeam.id &&
        getPositionLine(b.position || '') === line
    ).length
    const existingHomeLineBans = Math.max(fromRosterCount, fromBansCount)

    if (existingHomeLineBans >= 2) {
      setTurnToast(null)
      setErrorMessage(
        `⚠️ Đã cấm tối đa 2 cầu thủ thuộc tuyến ${lineName} (${player.position})! Vui lòng chọn cầu thủ thuộc tuyến khác.`
      )
      return
    }

    // 0ms Optimistic UI: mark card banned, immediately switch turn to Home team & reset 30s timer
    setOptimisticBannedIds((prev) => new Set([...prev, playerSeasonId]))
    setOptimisticTurnTeamId(homeTeam.id)
    setOptimisticTimerResetAt(Date.now() + 30000)
    setOptimisticSeconds(30)
    setTurnToast(`ĐÃ CẤM ${player.name}! ĐỔI LƯỢT SANG ${homeTeam.name} (30s)`)
    setTimeout(() => setTurnToast(null), 3500)

    setBigBanReveal({
      playerName: player.name,
      position: player.position,
      rating: player.rating,
      salary: player.salary,
      imageUrl: player.imageUrl,
      seasonCode: player.seasonCode,
      banningTeamName: awayTeam.name,
    })

    if (simulatedMode !== 'live') {
      return
    }

    submitBanMutation.mutate({
      playerSeasonId,
      targetTeamId: homeTeam.id,
      banningTeamId: awayTeam.id,
      playerObj: player,
    })
  }

  const handleBanFromAwayRoster = (playerSeasonId: string, player: any) => {
    // Check tactical line limit: maximum 2 bans per line (FW, MF, DF)
    const line = getPositionLine(player.position)
    const lineName = LINE_NAME_VI[line] || line

    const fromRosterCount = awayRoster.filter(
      (r) =>
        bannedPlayerSeasonIds.has(r.player.playerSeasonId) &&
        getPositionLine(r.player.position) === line
    ).length
    const fromBansCount = (currentMatch?.bans || []).filter(
      (b) =>
        b.targetTeamId === awayTeam.id &&
        getPositionLine(b.position || '') === line
    ).length
    const existingAwayLineBans = Math.max(fromRosterCount, fromBansCount)

    if (existingAwayLineBans >= 2) {
      setTurnToast(null)
      setErrorMessage(
        `⚠️ Đã cấm tối đa 2 cầu thủ thuộc tuyến ${lineName} (${player.position})! Vui lòng chọn cầu thủ thuộc tuyến khác.`
      )
      return
    }

    // 0ms Optimistic UI: mark card banned, immediately switch turn to Away team & reset 30s timer
    setOptimisticBannedIds((prev) => new Set([...prev, playerSeasonId]))
    setOptimisticTurnTeamId(awayTeam.id)
    setOptimisticTimerResetAt(Date.now() + 30000)
    setOptimisticSeconds(30)
    setTurnToast(`ĐÃ CẤM ${player.name}! ĐỔI LƯỢT SANG ${awayTeam.name} (30s)`)
    setTimeout(() => setTurnToast(null), 3500)

    setBigBanReveal({
      playerName: player.name,
      position: player.position,
      rating: player.rating,
      salary: player.salary,
      imageUrl: player.imageUrl,
      seasonCode: player.seasonCode,
      banningTeamName: homeTeam.name,
    })

    if (simulatedMode !== 'live') {
      return
    }

    submitBanMutation.mutate({
      playerSeasonId,
      targetTeamId: awayTeam.id,
      banningTeamId: homeTeam.id,
      playerObj: player,
    })
  }

  const handleCannotBan = (reason?: string) => {
    if (effectiveStatus === 'BANS_LOCKED') {
      setErrorMessage(
        'Giai đoạn cấm đã KẾT THÚC (Bans Locked)! Cả 2 đội đã hoàn thành cấm. Nếu bạn là Admin, có thể bấm "Reset Ban" ở góc trên để mở lại lượt cấm từ đầu.'
      )
    } else if (effectiveStatus === 'SCHEDULED') {
      setErrorMessage('Trận đấu chưa bắt đầu giai đoạn cấm. Bấm "Bắt Đầu Ban" ở góc trên để bắt đầu.')
    } else if (isAdmin) {
      const activeTeamName = isHomeTurn ? homeTeam.name : awayTeam.name
      const targetTeamName = isHomeTurn ? awayTeam.name : homeTeam.name
      setErrorMessage(
        `[ADMIN] Hiện đang là lượt cấm của ${activeTeamName}. Bạn hãy bấm cấm thẻ thuộc đội hình ${targetTeamName} (Bảng viền đỏ)!`
      )
    } else {
      const isMyTurn =
        (isHomeTurn && user?.teamId === homeTeam.id) ||
        (isAwayTurn && user?.teamId === awayTeam.id)
      if (!isMyTurn) {
        const activeTeamName = isHomeTurn ? homeTeam.name : awayTeam.name
        setErrorMessage(
          `⚠️ Chưa tới lượt cấm của đội bạn! Hiện đang là lượt cấm của ${activeTeamName}. Vui lòng chờ đối thủ hoàn thành lượt.`
        )
      } else {
        setErrorMessage(reason || 'Bạn chỉ được phép cấm cầu thủ thuộc đội hình đối phương!')
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100 flex flex-col justify-between overflow-x-hidden font-sans relative selection:bg-[#00FF87] selection:text-black">
      {/* Background Esports Stadium Light Ambiance */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,255,135,0.07),rgba(255,255,255,0))] z-0" />

      {/* Floating Turn Toast Notification */}
      {turnToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#00FF87] text-black font-black px-6 py-2 rounded-full shadow-[0_0_35px_rgba(0,255,135,0.85)] border-2 border-white text-xs sm:text-sm animate-in zoom-in-95 duration-200 tracking-wide">
          🔄 {turnToast}
        </div>
      )}

      {/* 1. TOP BROADCAST HUD */}
      <FvplTopHud
        tournamentId={tournamentId || currentMatch?.tournamentId || ''}
        homeTeam={{ ...homeTeam, banCount: effectiveHomeBanCount }}
        awayTeam={{ ...awayTeam, banCount: effectiveAwayBanCount }}
        currentBanningTeamId={effectiveCurrentBanningTeamId}
        secondsRemaining={effectiveSeconds}
        status={effectiveStatus}
        isAdmin={isAdmin}
        onSkipTurn={() => skipTurnMutation.mutate()}
        isSkipPending={skipTurnMutation.isPending}
        onStartBanPhase={() => startBanPhaseMutation.mutate()}
        isStartPending={startBanPhaseMutation.isPending}
        onResetBanPhase={() => resetBanMutation.mutate()}
        isResetPending={resetBanMutation.isPending}
        onOpenScoreModal={() => setIsRecordScoreOpen(true)}
      />

      {/* Error / Alert banner */}
      {errorMessage && (
        <div className="bg-red-950/90 border-b border-red-500/50 text-red-200 px-4 py-2.5 text-xs font-mono flex items-center justify-between z-30 animate-in fade-in">
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* State Switcher Bar (Quick view toggle for Admin / testing) */}
      <div className="w-full bg-[#0a0d13] border-b border-white/5 py-1 px-4 flex items-center justify-between text-xs z-20">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            CHẾ ĐỘ XEM:
          </span>
          <button
            type="button"
            onClick={() => {
              setSimulatedMode('live')
              setErrorMessage(null)
            }}
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
              simulatedMode === 'live'
                ? 'bg-emerald-500 text-black'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            ● LIVE WS
          </button>
          <button
            type="button"
            onClick={() => setSimulatedMode('home_turn')}
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
              simulatedMode === 'home_turn'
                ? 'bg-[#00DF81] text-black'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            LƯỢT ĐỘI NHÀ
          </button>
          <button
            type="button"
            onClick={() => setSimulatedMode('away_turn')}
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
              simulatedMode === 'away_turn'
                ? 'bg-[#00DF81] text-black'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            LƯỢT ĐỘI KHÁCH
          </button>
          <button
            type="button"
            onClick={() => {
              setBigBanReveal({
                playerName: 'P. Maldini',
                position: 'LB',
                rating: 131,
                salary: 32,
                seasonCode: 'ICON',
                banningTeamName: 'TA GLOBAL',
              })
            }}
            className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/40"
          >
            THỬ POPUP BAN (MODAL)
          </button>
        </div>

        <div className="text-[11px] font-mono text-zinc-400">
          Quy tắc:{' '}
          <span className="text-emerald-400 font-bold">
            BAN LUÂN PHIÊN (30s / lượt)
          </span>
        </div>
      </div>

      {/* Turn Action Status Banner */}
      <div className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 pt-3 pb-1 z-20">
        <div
          className={`w-full py-2.5 px-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs md:text-sm font-semibold transition-all ${
            effectiveStatus === 'BANS_LOCKED'
              ? 'bg-red-950/40 border-red-500/40 text-red-300'
              : isAdmin ||
                (isHomeTurn && user?.teamId === homeTeam.id) ||
                (isAwayTurn && user?.teamId === awayTeam.id)
              ? 'bg-emerald-950/50 border-[#00FF87]/50 text-[#00FF87] shadow-[0_0_20px_rgba(0,255,135,0.15)] animate-pulse'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {effectiveStatus === 'BANS_LOCKED'
                ? '🔒'
                : isAdmin ||
                  (isHomeTurn && user?.teamId === homeTeam.id) ||
                  (isAwayTurn && user?.teamId === awayTeam.id)
                ? '🎯'
                : '⏳'}
            </span>
            <span>
              {effectiveStatus === 'BANS_LOCKED'
                ? 'Giai đoạn Cấm (Ban) đã hoàn thành! Cả hai đội đã hoàn tất danh sách cấm.'
                : isAdmin
                ? isHomeTurn
                  ? `[LƯỢT 1: ${homeTeam.name} CẤM] 👉 Bấm chọn 1 cầu thủ bên bảng ${awayTeam.name} (Bảng viền đỏ bên phải) để cấm!`
                  : `[LƯỢT 2: ${awayTeam.name} CẤM] 👉 Bấm chọn 1 cầu thủ bên bảng ${homeTeam.name} (Bảng viền đỏ bên trái) để cấm!`
                : isHomeTurn && user?.teamId === homeTeam.id
                ? `👉 ĐẾN LƯỢT ĐỘI BẠN (${homeTeam.name})! Hãy bấm chọn 1 cầu thủ bên bảng ${awayTeam.name} để CẤM (Còn ${effectiveSeconds}s)`
                : isAwayTurn && user?.teamId === awayTeam.id
                ? `👉 ĐẾN LƯỢT ĐỘI BẠN (${awayTeam.name})! Hãy bấm chọn 1 cầu thủ bên bảng ${homeTeam.name} để CẤM (Còn ${effectiveSeconds}s)`
                : `⏳ CHƯA ĐẾN LƯỢT CỦA BẠN: Đang chờ ${
                    isHomeTurn ? homeTeam.name : awayTeam.name
                  } hoàn thành lượt cấm (Còn ${effectiveSeconds}s)...`}
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs opacity-90">
            <span>
              Lượt cấm:{' '}
              <strong className="text-white">
                {isHomeTurn ? homeTeam.name : awayTeam.name}
              </strong>
            </span>
            <span>
              Tài khoản:{' '}
              <strong className="text-white">
                {user?.username || 'Khách'}{' '}
                {isAdmin
                  ? '(Admin)'
                  : user?.teamId === homeTeam.id
                  ? `(${homeTeam.name})`
                  : user?.teamId === awayTeam.id
                  ? `(${awayTeam.name})`
                  : ''}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN ARENA: TWO 23-PLAYER ROSTER BOARDS SIDE-BY-SIDE */}
      <main className="w-full flex-1 max-w-[1920px] mx-auto p-2 sm:p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start relative z-10">
        {/* LEFT BOARD: Home Team (e.g. TA GLOBAL - 23 cards: 6-6-6-5) */}
        <FvplRosterBoard
          teamName={homeTeam.name}
          teamId={homeTeam.id}
          roster={homeRoster}
          bannedPlayerSeasonIds={bannedPlayerSeasonIds}
          isCurrentTurn={isHomeTurn}
          isTargetBoard={isAwayTurn} // Target of away team
          canUserBan={canUserBanHomeRoster}
          onBanPlayer={handleBanFromHomeRoster}
          onCannotBan={handleCannotBan}
          isActionPending={submitBanMutation.isPending}
        />

        {/* RIGHT BOARD: Away Team (e.g. AMITA FC - 23 cards: 6-6-6-5) */}
        <FvplRosterBoard
          teamName={awayTeam.name}
          teamId={awayTeam.id}
          roster={awayRoster}
          bannedPlayerSeasonIds={bannedPlayerSeasonIds}
          isCurrentTurn={isAwayTurn}
          isTargetBoard={isHomeTurn} // Target of home team
          canUserBan={canUserBanAwayRoster}
          onBanPlayer={handleBanFromAwayRoster}
          onCannotBan={handleCannotBan}
          isActionPending={submitBanMutation.isPending}
        />
      </main>

      {/* 3. CENTER BIG BAN REVEAL MODAL (Image 2) */}
      <FvplBigBanReveal
        data={bigBanReveal}
        onDismiss={() => setBigBanReveal(null)}
      />

      {/* 4. FOOTER: FVPL SUMMER 2026 // RISE TO INFINITY */}
      <FvplFooter />

      {/* 5. Record Score Modal for Admin */}
      {isAdmin && (
        <RecordScoreModal
          isOpen={isRecordScoreOpen}
          onClose={() => setIsRecordScoreOpen(false)}
          match={currentMatch}
          onSaveScore={async (id, homeScore, awayScore) => {
            await recordScoreMutation.mutateAsync({
              matchId: id,
              homeScore,
              awayScore,
            })
          }}
          isLoading={recordScoreMutation.isPending}
        />
      )}
    </div>
  )
}
export default MatchBanPage
