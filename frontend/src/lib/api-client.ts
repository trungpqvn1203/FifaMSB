import axios, { AxiosError } from 'axios'

export interface ApiProblemDetail {
  type: string
  title: string
  status: number
  code: string
  message: string
}

export class ApiError extends Error {
  code: string
  status: number
  title: string

  constructor(problem: ApiProblemDetail) {
    super(problem.message)
    this.name = 'ApiError'
    this.code = problem.code
    this.status = problem.status
    this.title = problem.title
  }
}

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiProblemDetail>) => {
    if (error.response?.data && error.response.data.code) {
      const problem = error.response.data
      return Promise.reject(new ApiError(problem))
    }
    return Promise.reject(error)
  }
)
