import { apiClient } from '@/lib/api-client'
import type {
  Tournament,
  TournamentListItem,
  TournamentCreate,
  TournamentRules,
  Team,
  CreateTeamRequest,
  User,
  DraftDetail,
  ImportReport,
  SeasonItem,
  MatchDetail,
} from '@/types/domain'

export interface CreateUserPayload {
  username: string
  password: string
  role?: 'ADMIN' | 'TEAM_USER'
  teamId?: string | null
  tournamentId?: string | null
}

export interface UserTeamHistoryItem {
  id: string
  teamId: string | null
  tournamentId: string | null
  joinedAt: string
}

export interface NexonSeasonMeta {
  season_id: number
  code: string
  name: string
  badge_url: string | null
  player_count: number
}

export interface NexonPlayerSearchItem {
  spid: number
  name: string
  season_id: number
  season_code: string
  badge_url: string | null
}

export interface NexonSyncParams {
  spids?: number[]
  season_id?: number
  limit?: number
}

export const adminApi = {
  // 1. Tournaments
  listTournaments: async (): Promise<TournamentListItem[]> => {
    const res = await apiClient.get<TournamentListItem[]>('/tournaments')
    return res.data
  },

  getTournament: async (id: string): Promise<Tournament> => {
    const res = await apiClient.get<Tournament>(`/tournaments/${id}`)
    return res.data
  },

  createTournament: async (payload: TournamentCreate): Promise<Tournament> => {
    const res = await apiClient.post<Tournament>('/tournaments', payload)
    return res.data
  },

  updateTournament: async (
    id: string,
    payload: { name?: string; rules?: Partial<TournamentRules> }
  ): Promise<Tournament> => {
    const res = await apiClient.patch<Tournament>(`/tournaments/${id}`, payload)
    return res.data
  },

  // 2. Teams
  listTeams: async (tournamentId: string): Promise<Team[]> => {
    const res = await apiClient.get<Team[]>(`/tournaments/${tournamentId}/teams`)
    return res.data
  },

  createTeam: async (tournamentId: string, payload: CreateTeamRequest): Promise<Team> => {
    const res = await apiClient.post<Team>(`/tournaments/${tournamentId}/teams`, payload)
    return res.data
  },

  randomizeDraftOrder: async (tournamentId: string): Promise<Team[]> => {
    const res = await apiClient.post<Team[]>(`/tournaments/${tournamentId}/teams/randomize`)
    return res.data
  },

  reorderTeams: async (tournamentId: string, teamIds: string[]): Promise<Team[]> => {
    const res = await apiClient.post<Team[]>(`/tournaments/${tournamentId}/teams/reorder`, {
      teamIds,
    })
    return res.data
  },

  // 3. User Accounts
  listUsers: async (): Promise<User[]> => {
    const res = await apiClient.get<User[]>('/admin/users')
    return res.data
  },

  createUser: async (payload: CreateUserPayload): Promise<User> => {
    const res = await apiClient.post<User>('/admin/users', payload)
    return res.data
  },

  reassignUserTeam: async (
    userId: string,
    teamId: string,
    tournamentId: string
  ): Promise<User> => {
    const res = await apiClient.patch<User>(`/admin/users/${userId}/team`, {
      teamId,
      tournamentId,
    })
    return res.data
  },

  getUserHistory: async (userId: string): Promise<UserTeamHistoryItem[]> => {
    const res = await apiClient.get<UserTeamHistoryItem[]>(`/admin/users/${userId}/history`)
    return res.data
  },

  // 4. Seasons
  listSeasons: async (): Promise<SeasonItem[]> => {
    const res = await apiClient.get<SeasonItem[]>('/seasons')
    return res.data
  },

  // 5. CSV Player Import
  importPlayersCsv: async (file: File): Promise<ImportReport> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post<ImportReport>('/admin/players/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return res.data
  },

  // 5.1 Nexon FC Online Sync
  getNexonSeasons: async (): Promise<NexonSeasonMeta[]> => {
    const res = await apiClient.get<NexonSeasonMeta[]>('/admin/players/nexon-meta/seasons')
    return res.data
  },

  searchNexonPlayers: async (q: string, limit = 30): Promise<NexonPlayerSearchItem[]> => {
    const res = await apiClient.get<NexonPlayerSearchItem[]>('/admin/players/nexon-meta/search', {
      params: { q, limit },
    })
    return res.data
  },

  syncNexonPlayers: async (params: NexonSyncParams | number[]): Promise<ImportReport> => {
    const payload = Array.isArray(params) ? { spids: params } : params
    const res = await apiClient.post<ImportReport>('/admin/players/sync-nexon', payload)
    return res.data
  },

  // 6. Draft Controls
  getDraft: async (tournamentId: string): Promise<DraftDetail | null> => {
    try {
      const res = await apiClient.get<DraftDetail>(`/tournaments/${tournamentId}/draft`)
      return res.data
    } catch {
      return null
    }
  },

  startDraft: async (tournamentId: string): Promise<DraftDetail> => {
    const res = await apiClient.post<DraftDetail>(`/tournaments/${tournamentId}/draft/start`)
    return res.data
  },

  pauseDraft: async (draftId: string): Promise<void> => {
    await apiClient.post(`/drafts/${draftId}/pause`)
  },

  resumeDraft: async (draftId: string): Promise<void> => {
    await apiClient.post(`/drafts/${draftId}/resume`)
  },

  cancelDraft: async (draftId: string): Promise<void> => {
    await apiClient.post(`/drafts/${draftId}/cancel`)
  },

  // 7. Matches
  listMatches: async (tournamentId: string): Promise<MatchDetail[]> => {
    const res = await apiClient.get<MatchDetail[]>(`/tournaments/${tournamentId}/matches`)
    return res.data
  },

  scheduleMatch: async (
    tournamentId: string,
    payload: { homeTeamId: string; awayTeamId: string; scheduledAt?: string | null }
  ): Promise<MatchDetail> => {
    const res = await apiClient.post<MatchDetail>(`/tournaments/${tournamentId}/matches`, payload)
    return res.data
  },

  startBanPhase: async (matchId: string): Promise<MatchDetail> => {
    const res = await apiClient.post<MatchDetail>(`/matches/${matchId}/bans/start`)
    return res.data
  },

  completeMatch: async (matchId: string): Promise<MatchDetail> => {
    const res = await apiClient.post<MatchDetail>(`/matches/${matchId}/complete`)
    return res.data
  },
}
