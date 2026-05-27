import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Email atau password salah. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-white text-2xl font-bold tracking-[0.3em] uppercase mb-1">
            SnapBooth
          </h1>
          <p className="text-gray-600 text-sm">Masuk ke dashboard penyelenggara</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 rounded-2xl p-8 flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-gray-400 text-sm">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="owner@example.com"
              className="bg-gray-800 text-white rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-gray-400 text-sm">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="bg-gray-800 text-white rounded-xl px-4 py-3 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-100 disabled:opacity-50 active:scale-95 transition-all"
          >
            {submitting ? 'Masuk...' : 'Masuk'}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-700 text-sm">
          <Link to="/" className="hover:text-gray-400 transition-colors">
            ← Kembali ke beranda
          </Link>
        </p>
      </div>
    </div>
  )
}
