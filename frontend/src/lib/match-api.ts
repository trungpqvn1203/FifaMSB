import { apiClient } from '@/lib/api-client'
import type {
  MatchDetail,
  MatchBanItem,
  TeamRosterResponse,
} from '@/types/domain'

export interface CreateMatchPayload {
  homeTeamId: string
  awayTeamId: string
  scheduledAt?: string | null
}

export interface SubmitBanPayload {
  playerSeasonId: string
  targetTeamId?: string | null
}

export const matchApi = {
  // 1. List matches for a tournament
  listTournamentMatches: async (tournamentId: string): Promise<MatchDetail[]> => {
    const res = await apiClient.get<MatchDetail[]>(`/tournaments/${tournamentId}/matches`)
    return res.data
  },

  // 2. Schedule a match (ADMIN only)
  createMatch: async (tournamentId: string, payload: CreateMatchPayload): Promise<MatchDetail> => {
    const res = await apiClient.post<MatchDetail>(`/tournaments/${tournamentId}/matches`, payload)
    return res.data
  },

  // 3. Get match detail with secrecy projection
  getMatchDetail: async (matchId: string): Promise<MatchDetail> => {
    const res = await apiClient.get<MatchDetail>(`/matches/${matchId}`)
    return res.data
  },

  // 4. Start Tactical Ban Phase (ADMIN only)
  startBanPhase: async (matchId: string): Promise<MatchDetail> => {
    const res = await apiClient.post<MatchDetail>(`/matches/${matchId}/bans/start`)
    return res.data
  },

  // 5. Submit a ban on a player
  submitBan: async (matchId: string, payload: SubmitBanPayload): Promise<MatchBanItem> => {
    const res = await apiClient.post<MatchBanItem>(`/matches/${matchId}/bans`, payload)
    return res.data
  },

  // 6. Delete a pending ban before lock
  deleteBan: async (matchId: string, banId: string): Promise<void> => {
    await apiClient.delete(`/matches/${matchId}/bans/${banId}`)
  },

  // 7. Confirm bans for current team
  confirmBans: async (matchId: string): Promise<MatchDetail> => {
    const res = await apiClient.post<MatchDetail>(`/matches/${matchId}/bans/confirm`)
    return res.data
  },

  // 8. Mark match as completed (ADMIN only)
  completeMatch: async (matchId: string): Promise<MatchDetail> => {
    const res = await apiClient.post<MatchDetail>(`/matches/${matchId}/complete`)
    return res.data
  },

  // 9. Fetch drafted roster of a team
  getTeamRoster: async (teamId: string): Promise<TeamRosterResponse> => {
    const res = await apiClient.get<TeamRosterResponse>(`/teams/${teamId}/roster`)
    return res.data
  },
}
