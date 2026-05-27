import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
  loginApi,
  logoutApi,
  getMeApi,
  type User,
  type LoginResult,
} from '../services/authService'
import { getToken, setToken, getStoredUser, storeUser, clearAuth } from '../utils/storage'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser<User>())
  // isLoading is true only when there's a token to validate on mount
  const [isLoading, setIsLoading] = useState(() => !!getToken())

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setIsLoading(false)
      return
    }

    getMeApi()
      .then(me => {
        setUser(me)
        storeUser(me)
      })
      .catch(() => {
        clearAuth()
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const result = await loginApi(email, password)
    setToken(result.token)
    storeUser(result.user)
    setUser(result.user)
    return result
  }

  const logout = () => {
    logoutApi().catch(() => {})
    clearAuth()
    setUser(null)
    window.location.replace('/login')
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export type { User }
