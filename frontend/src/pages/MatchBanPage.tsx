import React, { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { matchApi } from '@/lib/match-api'
import { useAuth } from '@/context/AuthContext'
import { useMatchSocket } from '@/hooks/useMatchSocket'
import { MatchHeader } from '@/components/match/MatchHeader'
import { MatchScoreboard } from '@/components/match/MatchScoreboard'
import { FriendlyRosterPanel } from '@/components/match/FriendlyRosterPanel'
import { TargetRosterPanel } from '@/components/match/TargetRosterPanel'
import { TacticalActionDock } from '@/components/match/TacticalActionDock'
import type {
  MatchDetail,
  TeamRosterResponse,
  RosterItem,
  MatchBanItem,
} from '@/types/domain'

// Sample 24 players fallback matching docs/ui/match-bans.html in case tournament roster is empty
const SAMPLE_FRIENDLY_ROSTER: RosterItem[] = [
  { pickId: '1', round: 1, turnNumber: 1, salaryAtPick: 28, pickedAt: '', player: { playerSeasonId: 'ps-1', playerId: 'p-1', name: 'K. Mbappé', position: 'ST', rating: 116, salary: 28, season: { id: 's-1', code: '24TOTY', name: 'TOTY 24' } } },
  { pickId: '2', round: 2, turnNumber: 2, salaryAtPick: 26, pickedAt: '', player: { playerSeasonId: 'ps-2', playerId: 'p-2', name: 'Kaká', position: 'CAM', rating: 114, salary: 26, season: { id: 's-2', code: 'ICON', name: 'Icon' } } },
  { pickId: '3', round: 3, turnNumber: 3, salaryAtPick: 25, pickedAt: '', player: { playerSeasonId: 'ps-3', playerId: 'p-3', name: 'L. Thuram', position: 'CB', rating: 113, salary: 25, season: { id: 's-3', code: 'ICON', name: 'Icon' } } },
  { pickId: '4', round: 4, turnNumber: 4, salaryAtPick: 24, pickedAt: '', player: { playerSeasonId: 'ps-4', playerId: 'p-4', name: 'T. Courtois', position: 'GK', rating: 112, salary: 24, season: { id: 's-4', code: 'LOL', name: 'Legend' } } },
  { pickId: '5', round: 5, turnNumber: 5, salaryAtPick: 27, pickedAt: '', player: { playerSeasonId: 'ps-5', playerId: 'p-5', name: 'P. Vieira', position: 'CDM', rating: 115, salary: 27, season: { id: 's-5', code: 'CAP', name: 'Captain' } } },
  { pickId: '6', round: 6, turnNumber: 6, salaryAtPick: 26, pickedAt: '', player: { playerSeasonId: 'ps-6', playerId: 'p-6', name: 'Ronaldinho', position: 'LW', rating: 114, salary: 26, season: { id: 's-6', code: 'BTB', name: 'Back to Back' } } },
  { pickId: '7', round: 7, turnNumber: 7, salaryAtPick: 23, pickedAt: '', player: { playerSeasonId: 'ps-7', playerId: 'p-7', name: 'D. Beckham', position: 'RW', rating: 111, salary: 23, season: { id: 's-7', code: 'WC22', name: 'World Cup 22' } } },
  { pickId: '8', round: 8, turnNumber: 8, salaryAtPick: 24, pickedAt: '', player: { playerSeasonId: 'ps-8', playerId: 'p-8', name: 'L. Modrić', position: 'CM', rating: 112, salary: 24, season: { id: 's-8', code: 'SPL', name: 'Spotlight' } } },
  { pickId: '9', round: 9, turnNumber: 9, salaryAtPick: 21, pickedAt: '', player: { playerSeasonId: 'ps-9', playerId: 'p-9', name: 'M. van de Ven', position: 'CB', rating: 109, salary: 21, season: { id: 's-9', code: '23NG', name: 'Next Gen' } } },
  { pickId: '10', round: 10, turnNumber: 10, salaryAtPick: 22, pickedAt: '', player: { playerSeasonId: 'ps-10', playerId: 'p-10', name: 'A. Hakimi', position: 'RB', rating: 110, salary: 22, season: { id: 's-10', code: '22UCL', name: 'UCL 22' } } },
  { pickId: '11', round: 11, turnNumber: 11, salaryAtPick: 23, pickedAt: '', player: { playerSeasonId: 'ps-11', playerId: 'p-11', name: 'A. Davies', position: 'LB', rating: 111, salary: 23, season: { id: 's-11', code: 'BTB', name: 'Back to Back' } } },
  { pickId: '12', round: 12, turnNumber: 12, salaryAtPick: 25, pickedAt: '', player: { playerSeasonId: 'ps-12', playerId: 'p-12', name: 'J. Cruyff', position: 'CF', rating: 113, salary: 25, season: { id: 's-12', code: 'ICON', name: 'Icon' } } },
  { pickId: '13', round: 13, turnNumber: 13, salaryAtPick: 22, pickedAt: '', player: { playerSeasonId: 'ps-13', playerId: 'p-13', name: 'L. Goretzka', position: 'CM', rating: 110, salary: 22, season: { id: 's-13', code: 'BTB', name: 'Back to Back' } } },
  { pickId: '14', round: 14, turnNumber: 14, salaryAtPick: 24, pickedAt: '', player: { playerSeasonId: 'ps-14', playerId: 'p-14', name: 'K. Benzema', position: 'ST', rating: 112, salary: 24, season: { id: 's-14', code: '21UCL', name: 'UCL 21' } } },
  { pickId: '15', round: 15, turnNumber: 15, salaryAtPick: 20, pickedAt: '', player: { playerSeasonId: 'ps-15', playerId: 'p-15', name: 'Kim Min Jae', position: 'CB', rating: 109, salary: 20, season: { id: 's-15', code: 'BTB', name: 'Back to Back' } } },
  { pickId: '16', round: 16, turnNumber: 16, salaryAtPick: 23, pickedAt: '', player: { playerSeasonId: 'ps-16', playerId: 'p-16', name: 'K. Kvaratskhelia', position: 'LW', rating: 111, salary: 23, season: { id: 's-16', code: '26TS', name: 'Team of Season' } } },
  { pickId: '17', round: 17, turnNumber: 17, salaryAtPick: 22, pickedAt: '', player: { playerSeasonId: 'ps-17', playerId: 'p-17', name: 'F. Lampard', position: 'CM', rating: 110, salary: 22, season: { id: 's-17', code: 'CAP', name: 'Captain' } } },
  { pickId: '18', round: 18, turnNumber: 18, salaryAtPick: 21, pickedAt: '', player: { playerSeasonId: 'ps-18', playerId: 'p-18', name: 'M. Neuer', position: 'GK', rating: 110, salary: 21, season: { id: 's-18', code: 'BTB', name: 'Back to Back' } } },
  { pickId: '19', round: 19, turnNumber: 19, salaryAtPick: 19, pickedAt: '', player: { playerSeasonId: 'ps-19', playerId: 'p-19', name: 'D. Dumfries', position: 'RB', rating: 107, salary: 19, season: { id: 's-19', code: 'E21', name: 'Euro 21' } } },
  { pickId: '20', round: 20, turnNumber: 20, salaryAtPick: 23, pickedAt: '', player: { playerSeasonId: 'ps-20', playerId: 'p-20', name: 'T. Kroos', position: 'CM', rating: 111, salary: 23, season: { id: 's-20', code: 'BTB', name: 'Back to Back' } } },
  { pickId: '21', round: 21, turnNumber: 21, salaryAtPick: 21, pickedAt: '', player: { playerSeasonId: 'ps-21', playerId: 'p-21', name: 'O. Dembélé', position: 'ST', rating: 109, salary: 21, season: { id: 's-21', code: '26TY', name: 'TOTY 26' } } },
  { pickId: '22', round: 22, turnNumber: 22, salaryAtPick: 25, pickedAt: '', player: { playerSeasonId: 'ps-22', playerId: 'p-22', name: 'Zico', position: 'CAM', rating: 113, salary: 25, season: { id: 's-22', code: 'ICON', name: 'Icon' } } },
  { pickId: '23', round: 23, turnNumber: 23, salaryAtPick: 17, pickedAt: '', player: { playerSeasonId: 'ps-23', playerId: 'p-23', name: 'A. Areola', position: 'GK', rating: 104, salary: 17, season: { id: 's-23', code: 'TB', name: 'Top Boom' } } },
  { pickId: '24', round: 24, turnNumber: 24, salaryAtPick: 20, pickedAt: '', player: { playerSeasonId: 'ps-24', playerId: 'p-24', name: 'Marcelo', position: 'LB', rating: 109, salary: 20, season: { id: 's-24', code: 'BTB', name: 'Back to Back' } } },
]

const SAMPLE_TARGET_ROSTER: RosterItem[] = [
  { pickId: 't1', round: 1, turnNumber: 1, salaryAtPick: 28, pickedAt: '', player: { playerSeasonId: 'tps-1', playerId: 'tp-1', name: 'E. Haaland', position: 'ST', rating: 116, salary: 28, season: { id: 's-1', code: '24TOTY', name: 'TOTY 24' } } },
  { pickId: 't2', round: 2, turnNumber: 2, salaryAtPick: 27, pickedAt: '', player: { playerSeasonId: 'tps-2', playerId: 'tp-2', name: 'K. De Bruyne', position: 'CAM', rating: 115, salary: 27, season: { id: 's-1', code: '24TOTY', name: 'TOTY 24' } } },
  { pickId: 't3', round: 3, turnNumber: 3, salaryAtPick: 27, pickedAt: '', player: { playerSeasonId: 'tps-3', playerId: 'tp-3', name: 'P. Maldini', position: 'CB', rating: 115, salary: 27, season: { id: 's-2', code: 'ICON', name: 'Icon' } } },
  { pickId: 't4', round: 4, turnNumber: 4, salaryAtPick: 26, pickedAt: '', player: { playerSeasonId: 'tps-4', playerId: 'tp-4', name: 'L. Messi', position: 'RW', rating: 114, salary: 26, season: { id: 's-7', code: 'WC22', name: 'World Cup 22' } } },
  { pickId: 't5', round: 5, turnNumber: 5, salaryAtPick: 25, pickedAt: '', player: { playerSeasonId: 'tps-5', playerId: 'tp-5', name: 'Vinicius Jr.', position: 'LW', rating: 113, salary: 25, season: { id: 's-1', code: '24TOTY', name: 'TOTY 24' } } },
  { pickId: 't6', round: 6, turnNumber: 6, salaryAtPick: 26, pickedAt: '', player: { playerSeasonId: 'tps-6', playerId: 'tp-6', name: 'Rodri', position: 'CDM', rating: 114, salary: 26, season: { id: 's-1', code: '24TOTY', name: 'TOTY 24' } } },
  { pickId: 't7', round: 7, turnNumber: 7, salaryAtPick: 25, pickedAt: '', player: { playerSeasonId: 'tps-7', playerId: 'tp-7', name: 'V. van Dijk', position: 'CB', rating: 114, salary: 25, season: { id: 's-10', code: 'WS', name: 'World Stars' } } },
  { pickId: 't8', round: 8, turnNumber: 8, salaryAtPick: 24, pickedAt: '', player: { playerSeasonId: 'tps-8', playerId: 'tp-8', name: 'J. Bellingham', position: 'CM', rating: 113, salary: 24, season: { id: 's-10', code: 'WS', name: 'World Stars' } } },
  { pickId: 't9', round: 9, turnNumber: 9, salaryAtPick: 24, pickedAt: '', player: { playerSeasonId: 'tps-9', playerId: 'tp-9', name: 'R. Lewandowski', position: 'ST', rating: 112, salary: 24, season: { id: 's-10', code: 'WS', name: 'World Stars' } } },
  { pickId: 't10', round: 10, turnNumber: 10, salaryAtPick: 24, pickedAt: '', player: { playerSeasonId: 'tps-10', playerId: 'tp-10', name: 'E. van der Sar', position: 'GK', rating: 112, salary: 24, season: { id: 's-6', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 't11', round: 11, turnNumber: 11, salaryAtPick: 23, pickedAt: '', player: { playerSeasonId: 'tps-11', playerId: 'tp-11', name: 'A. Rüdiger', position: 'CB', rating: 111, salary: 23, season: { id: 's-8', code: 'SPL', name: 'Spotlight' } } },
  { pickId: 't12', round: 12, turnNumber: 12, salaryAtPick: 22, pickedAt: '', player: { playerSeasonId: 'tps-12', playerId: 'tp-12', name: 'K. Walker', position: 'RB', rating: 110, salary: 22, season: { id: 's-6', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 't13', round: 13, turnNumber: 13, salaryAtPick: 24, pickedAt: '', player: { playerSeasonId: 'tps-13', playerId: 'tp-13', name: 'L. Matthäus', position: 'CM', rating: 112, salary: 24, season: { id: 's-2', code: 'ICON', name: 'Icon' } } },
  { pickId: 't14', round: 14, turnNumber: 14, salaryAtPick: 25, pickedAt: '', player: { playerSeasonId: 'tps-14', playerId: 'tp-14', name: 'Eusébio', position: 'CF', rating: 113, salary: 25, season: { id: 's-6', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 't15', round: 15, turnNumber: 15, salaryAtPick: 23, pickedAt: '', player: { playerSeasonId: 'tps-15', playerId: 'tp-15', name: 'S. Mané', position: 'LW', rating: 111, salary: 23, season: { id: 's-10', code: 'WS', name: 'World Stars' } } },
  { pickId: 't16', round: 16, turnNumber: 16, salaryAtPick: 22, pickedAt: '', player: { playerSeasonId: 'tps-16', playerId: 'tp-16', name: 'P. Pogba', position: 'CM', rating: 110, salary: 22, season: { id: 's-6', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 't17', round: 17, turnNumber: 17, salaryAtPick: 22, pickedAt: '', player: { playerSeasonId: 'tps-17', playerId: 'tp-17', name: 'R. Varane', position: 'CB', rating: 110, salary: 22, season: { id: 's-6', code: 'BTB', name: 'Back to Back' } } },
  { pickId: 't18', round: 18, turnNumber: 18, salaryAtPick: 23, pickedAt: '', player: { playerSeasonId: 'tps-18', playerId: 'tp-18', name: 'A. Shevchenko', position: 'ST', rating: 111, salary: 23, season: { id: 's-11', code: 'LN', name: 'Loyal Heroes' } } },
  { pickId: 't19', round: 19, turnNumber: 19, salaryAtPick: 22, pickedAt: '', player: { playerSeasonId: 'tps-19', playerId: 'tp-19', name: 'M. Ballack', position: 'CAM', rating: 110, salary: 22, season: { id: 's-2', code: 'ICON', name: 'Icon' } } },
  { pickId: 't20', round: 20, turnNumber: 20, salaryAtPick: 19, pickedAt: '', player: { playerSeasonId: 'tps-20', playerId: 'tp-20', name: 'P. Estupiñán', position: 'LB', rating: 107, salary: 19, season: { id: 's-4', code: 'LOL', name: 'Legend' } } },
  { pickId: 't21', round: 21, turnNumber: 21, salaryAtPick: 23, pickedAt: '', player: { playerSeasonId: 'tps-21', playerId: 'tp-21', name: 'Y. Touré', position: 'CM', rating: 111, salary: 23, season: { id: 's-10', code: 'WS', name: 'World Stars' } } },
  { pickId: 't22', round: 22, turnNumber: 22, salaryAtPick: 18, pickedAt: '', player: { playerSeasonId: 'tps-22', playerId: 'tp-22', name: 'N. Pope', position: 'GK', rating: 106, salary: 18, season: { id: 's-12', code: 'TB', name: 'Top Boom' } } },
  { pickId: 't23', round: 23, turnNumber: 23, salaryAtPick: 26, pickedAt: '', player: { playerSeasonId: 'tps-23', playerId: 'tp-23', name: 'Ferenc Puskás', position: 'CF', rating: 114, salary: 26, season: { id: 's-2', code: 'ICON', name: 'Icon' } } },
  { pickId: 't24', round: 24, turnNumber: 24, salaryAtPick: 23, pickedAt: '', player: { playerSeasonId: 'tps-24', playerId: 'tp-24', name: 'W. Saliba', position: 'CB', rating: 111, salary: 23, season: { id: 's-10', code: 'WS', name: 'World Stars' } } },
]

export const MatchBanPage: React.FC = () => {
  const { matchId = '', tournamentId = '' } = useParams<{ matchId: string; tournamentId?: string }>()
  const { user, isAdmin } = useAuth()

  // State Simulator mode: 'live' (real WS/REST), 'active' (3/5), 'locked', 'revealed'
  const [simulatedMode, setSimulatedMode] = useState<'live' | 'active' | 'locked' | 'revealed'>('live')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 1. Fetch initial match data via REST
  const {
    data: fetchedMatch,
    refetch: refetchMatch,
  } = useQuery<MatchDetail>({
    queryKey: ['match', matchId],
    queryFn: () => matchApi.getMatchDetail(matchId),
    enabled: !!matchId,
    refetchInterval: simulatedMode === 'live' ? 10000 : false,
  })

  // 2. Real-time WebSocket hook
  const {
    matchState: socketMatch,
    secondsRemaining: socketSeconds,
    setMatchState,
  } = useMatchSocket({
    matchId,
    onBanChange: () => {
      refetchMatch()
    },
  })

  // Prefer socket state over fetched REST data
  const currentMatch = socketMatch || fetchedMatch

  // Determine user perspective
  const userTeamId = user?.teamId
  const isAwayUser = userTeamId && currentMatch && userTeamId === currentMatch.awayTeam.id

  const friendlyTeam = useMemo(() => {
    if (!currentMatch) return { id: 'friendly', name: 'Valiant FC', confirmed: false, banCount: 0 }
    return isAwayUser ? currentMatch.awayTeam : currentMatch.homeTeam
  }, [currentMatch, isAwayUser])

  const targetTeam = useMemo(() => {
    if (!currentMatch) return { id: 'target', name: 'Titan Esports', confirmed: false, banCount: 0 }
    return isAwayUser ? currentMatch.homeTeam : currentMatch.awayTeam
  }, [currentMatch, isAwayUser])

  // 3. Fetch friendly and target rosters
  const { data: friendlyRosterData } = useQuery<TeamRosterResponse>({
    queryKey: ['team-roster', friendlyTeam.id],
    queryFn: () => matchApi.getTeamRoster(friendlyTeam.id),
    enabled: !!friendlyTeam.id && friendlyTeam.id !== 'friendly',
  })

  const { data: targetRosterData } = useQuery<TeamRosterResponse>({
    queryKey: ['team-roster', targetTeam.id],
    queryFn: () => matchApi.getTeamRoster(targetTeam.id),
    enabled: !!targetTeam.id && targetTeam.id !== 'target',
  })

  const friendlyRoster =
    friendlyRosterData?.roster && friendlyRosterData.roster.length > 0
      ? friendlyRosterData.roster
      : SAMPLE_FRIENDLY_ROSTER

  const targetRoster =
    targetRosterData?.roster && targetRosterData.roster.length > 0
      ? targetRosterData.roster
      : SAMPLE_TARGET_ROSTER

  // Filter bans
  const rules = currentMatch?.rulesSnapshot || {}
  const maxBans = rules.banCount ?? rules.banQuota ?? 5

  // 4. Mutations for bans
  const submitBanMutation = useMutation({
    mutationFn: (playerSeasonId: string) =>
      matchApi.submitBan(matchId, {
        playerSeasonId,
        targetTeamId: targetTeam.id,
      }),
    onSuccess: (newBan) => {
      setErrorMessage(null)
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
    onError: (err: any) => {
      setErrorMessage(err.message || 'Không thể gửi lượt ban.')
    },
  })

  const deleteBanMutation = useMutation({
    mutationFn: (banId: string) => matchApi.deleteBan(matchId, banId),
    onSuccess: (_, banId) => {
      setErrorMessage(null)
      if (setMatchState) {
        setMatchState((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            bans: prev.bans.filter((b) => b.id !== banId),
          }
        })
      }
      refetchMatch()
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Không thể gỡ lượt ban.')
    },
  })

  const confirmBansMutation = useMutation({
    mutationFn: () => matchApi.confirmBans(matchId),
    onSuccess: (updated) => {
      setErrorMessage(null)
      if (setMatchState) {
        setMatchState(updated as any)
      }
      refetchMatch()
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Không thể xác nhận danh sách ban.')
    },
  })

  // Admin Start Ban Phase mutation
  const startBanPhaseMutation = useMutation({
    mutationFn: () => matchApi.startBanPhase(matchId),
    onSuccess: (updated) => {
      setErrorMessage(null)
      if (setMatchState) setMatchState(updated as any)
      refetchMatch()
    },
  })

  // Calculate actual friendly target bans
  const actualTargetBans = useMemo(() => {
    const bans = currentMatch?.bans
    if (!bans) return []
    return bans.filter((b) => b.banningTeamId === friendlyTeam.id)
  }, [currentMatch, friendlyTeam.id])

  // Simulated state overrides when user clicks "1. ACTIVE", "2. LOCKED", or "3. REVEALED"
  const simulatedTargetBans: MatchBanItem[] = useMemo(() => {
    if (simulatedMode === 'active') {
      return [
        { id: 'sb-1', banningTeamId: friendlyTeam.id, targetTeamId: targetTeam.id, playerSeasonId: 'tps-1', playerName: 'E. Haaland', position: 'ST', rating: 116, seasonCode: '24TOTY', createdAt: '' },
        { id: 'sb-2', banningTeamId: friendlyTeam.id, targetTeamId: targetTeam.id, playerSeasonId: 'tps-2', playerName: 'K. De Bruyne', position: 'CAM', rating: 115, seasonCode: '24TOTY', createdAt: '' },
        { id: 'sb-3', banningTeamId: friendlyTeam.id, targetTeamId: targetTeam.id, playerSeasonId: 'tps-3', playerName: 'P. Maldini', position: 'CB', rating: 115, seasonCode: 'ICON', createdAt: '' },
      ]
    }
    if (simulatedMode === 'locked' || simulatedMode === 'revealed') {
      return [
        { id: 'sb-1', banningTeamId: friendlyTeam.id, targetTeamId: targetTeam.id, playerSeasonId: 'tps-1', playerName: 'E. Haaland', position: 'ST', rating: 116, seasonCode: '24TOTY', createdAt: '' },
        { id: 'sb-2', banningTeamId: friendlyTeam.id, targetTeamId: targetTeam.id, playerSeasonId: 'tps-2', playerName: 'K. De Bruyne', position: 'CAM', rating: 115, seasonCode: '24TOTY', createdAt: '' },
        { id: 'sb-3', banningTeamId: friendlyTeam.id, targetTeamId: targetTeam.id, playerSeasonId: 'tps-3', playerName: 'P. Maldini', position: 'CB', rating: 115, seasonCode: 'ICON', createdAt: '' },
        { id: 'sb-4', banningTeamId: friendlyTeam.id, targetTeamId: targetTeam.id, playerSeasonId: 'tps-4', playerName: 'L. Messi', position: 'RW', rating: 114, seasonCode: 'WC22', createdAt: '' },
        { id: 'sb-5', banningTeamId: friendlyTeam.id, targetTeamId: targetTeam.id, playerSeasonId: 'tps-5', playerName: 'Vinicius Jr.', position: 'LW', rating: 113, seasonCode: '24TOTY', createdAt: '' },
      ]
    }
    return actualTargetBans
  }, [simulatedMode, friendlyTeam.id, targetTeam.id, actualTargetBans])

  const effectiveStatus = useMemo(() => {
    if (simulatedMode === 'active') return 'BAN_PHASE'
    if (simulatedMode === 'locked') return 'BAN_PHASE'
    if (simulatedMode === 'revealed') return 'BANS_LOCKED'
    return currentMatch?.status || 'BAN_PHASE'
  }, [simulatedMode, currentMatch?.status])

  const effectiveSeconds = useMemo(() => {
    if (simulatedMode === 'active') return 38
    if (simulatedMode === 'locked') return 0
    if (simulatedMode === 'revealed') return 0
    return socketSeconds
  }, [simulatedMode, socketSeconds])

  const effectiveConfirmed = useMemo(() => {
    if (simulatedMode === 'locked') return true
    if (simulatedMode === 'revealed') return true
    if (simulatedMode === 'active') return false
    return friendlyTeam.confirmed
  }, [simulatedMode, friendlyTeam.confirmed])

  const isBansRevealed = effectiveStatus === 'BANS_LOCKED' || effectiveStatus === 'COMPLETED'

  // Handlers
  const handleSelectBan = (playerSeasonId: string) => {
    if (simulatedMode !== 'live') {
      setErrorMessage('Chuyển sang chế độ LIVE WS để gửi lệnh ban trực tiếp lên máy chủ.')
      return
    }
    submitBanMutation.mutate(playerSeasonId)
  }

  const handleRemoveBan = (banId: string) => {
    if (simulatedMode !== 'live') {
      setErrorMessage('Chuyển sang chế độ LIVE WS để gỡ lệnh ban trực tiếp trên máy chủ.')
      return
    }
    deleteBanMutation.mutate(banId)
  }

  const handleUndoLastPick = () => {
    if (actualTargetBans.length === 0) return
    const lastBan = actualTargetBans[actualTargetBans.length - 1]
    handleRemoveBan(lastBan.id)
  }

  const handleConfirmBans = () => {
    if (simulatedMode !== 'live') {
      setErrorMessage('Chuyển sang chế độ LIVE WS để xác nhận lệnh ban trực tiếp lên máy chủ.')
      return
    }
    confirmBansMutation.mutate()
  }

  const isPendingAction =
    submitBanMutation.isPending ||
    deleteBanMutation.isPending ||
    confirmBansMutation.isPending

  return (
    <div className="min-h-screen bg-[#0c0d10] text-[#e0e3eb] selection:bg-[#3DFF6B] selection:text-black flex flex-col justify-between overflow-x-hidden font-sans">
      {/* 1. Top Header Banner */}
      <MatchHeader
        tournamentId={tournamentId || currentMatch?.tournamentId || ''}
        matchId={matchId}
        simulatedMode={simulatedMode}
        onSimulateModeChange={(mode) => {
          setSimulatedMode(mode)
          setErrorMessage(null)
        }}
      />

      {/* Admin Start Ban Phase Action if scheduled */}
      {isAdmin && currentMatch?.status === 'SCHEDULED' && simulatedMode === 'live' && (
        <div className="bg-[#1a1d26] border-b border-[#2e3342] py-2 px-4 flex items-center justify-between text-xs">
          <span className="text-amber-400 font-medium">
            Trận đấu đang ở trạng thái LÊN LỊCH. Với quyền ADMIN, bạn có thể bắt đầu giai đoạn cấm chọn (Ban) ngay bây giờ.
          </span>
          <button
            type="button"
            disabled={startBanPhaseMutation.isPending}
            onClick={() => startBanPhaseMutation.mutate()}
            className="px-4 py-1.5 rounded bg-[#3DFF6B] hover:bg-[#32e05b] text-black font-bold uppercase transition"
          >
            Bắt Đầu Giai Đoạn Ban
          </button>
        </div>
      )}

      {/* Error Alert Strip */}
      {errorMessage && (
        <div className="bg-red-950/80 border-b border-red-500/50 text-red-200 px-4 py-2 text-xs font-mono flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Central Scoreboard & Digital Timer */}
      <MatchScoreboard
        homeTeam={currentMatch?.homeTeam || { id: 'h', name: 'Valiant FC', confirmed: false, banCount: 0 }}
        awayTeam={currentMatch?.awayTeam || { id: 'a', name: 'Titan Esports', confirmed: false, banCount: 0 }}
        userTeamId={userTeamId}
        rules={rules}
        status={effectiveStatus}
        secondsRemaining={effectiveSeconds}
        isUserConfirmed={effectiveConfirmed}
      />

      {/* 3. Main Draft Battlefield */}
      <main className="w-full flex-1 max-w-[1920px] mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Friendly Roster (Defensive / Protected View) */}
        <div className="lg:col-span-6 w-full">
          <FriendlyRosterPanel
            teamName={friendlyTeam.name}
            teamId={friendlyTeam.id}
            roster={friendlyRoster}
            bansRevealed={isBansRevealed}
            opponentBans={currentMatch?.bans || []}
          />
        </div>

        {/* RIGHT COLUMN: Opponent Target Roster (Interactive Targeting View) */}
        <div className="lg:col-span-6 w-full">
          <TargetRosterPanel
            targetTeamName={targetTeam.name}
            targetTeamId={targetTeam.id}
            roster={targetRoster}
            bans={simulatedTargetBans}
            maxBans={maxBans}
            isLocked={effectiveConfirmed || isBansRevealed}
            isPendingAction={isPendingAction}
            onSelectBan={handleSelectBan}
            onRemoveBan={handleRemoveBan}
          />
        </div>
      </main>

      {/* 4. Bottom Tactical Action Dock */}
      <TacticalActionDock
        currentBanCount={simulatedTargetBans.length}
        maxBans={maxBans}
        isConfirmed={effectiveConfirmed}
        isLocked={isBansRevealed}
        isPendingAction={isPendingAction}
        status={effectiveStatus}
        onUndoLastPick={handleUndoLastPick}
        onConfirmBans={handleConfirmBans}
      />
    </div>
  )
}
export default MatchBanPage
