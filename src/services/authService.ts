import api from '../api/axios'

export interface User {
  id: number
  name: string
  email: string
}

export interface LoginResult {
  token: string
  user: User
}

export const loginApi = async (email: string, password: string): Promise<LoginResult> => {
  const { data } = await api.post('/auth/login', { email, password })
  return data.data as LoginResult
}

export const getMeApi = async (): Promise<User> => {
  const { data } = await api.get('/auth/me')
  return data.data as User
}

export const logoutApi = async (): Promise<void> => {
  await api.post('/auth/logout')
}
