const TOKEN_KEY = 'snapbooth_token'
const USER_KEY = 'snapbooth_user'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)

export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token)

export const removeToken = (): void => localStorage.removeItem(TOKEN_KEY)

export const getStoredUser = <T>(): T | null => {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? (JSON.parse(raw) as T) : null
}

export const storeUser = (user: object): void =>
  localStorage.setItem(USER_KEY, JSON.stringify(user))

export const removeUser = (): void => localStorage.removeItem(USER_KEY)

export const clearAuth = (): void => {
  removeToken()
  removeUser()
}
