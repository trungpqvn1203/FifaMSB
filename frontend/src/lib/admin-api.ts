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

  // 3. User Accounts
  listUsers: async (): Promise<User[]> => {
    const res = await apiClient.get<User[]>('/admin/users')
    return res.data
  },

  createUser: async (payload: CreateUserPayload): Promise<User> => {
    const res = await apiClient.post<User>('/admin/users', payload)
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
