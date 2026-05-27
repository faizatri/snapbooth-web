import axios from 'axios'
import { getToken, clearAuth } from '../utils/storage'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
  headers: { Accept: 'application/json' },
})

// Attach Bearer token on every request
api.interceptors.request.use(config => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401: clear stored credentials and redirect to login
api.interceptors.response.use(
  response => response,
  error => {
    const is401 = error.response?.status === 401
    const notOnLogin = !window.location.pathname.startsWith('/login')
    if (is401 && notOnLogin) {
      clearAuth()
      window.location.replace('/login')
    }
    return Promise.reject(error)
  }
)

export default api
