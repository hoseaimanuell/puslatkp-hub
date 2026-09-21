/**
 * views/Login.jsx
 * Halaman login — autentikasi via backend Express (JWT)
 */
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../AuthContext'
import { Eye, EyeOff, Waves, LogIn } from 'lucide-react'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0B1830] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Card */}
      <div className="relative w-full max-w-sm animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-4">
            <span className="text-2xl font-bold text-white">P</span>
          </div>
          <h1 className="font-bold text-2xl text-white">PUSLATKP</h1>
          <p className="text-white/50 text-sm mt-1">Management Hub</p>
        </div>

        {/* Form Card */}
        <div className="bg-[#122443] border border-white/10 rounded-xl p-8">
          <h2 className="text-white font-semibold text-lg mb-1">Masuk</h2>
          <p className="text-white/50 text-sm mb-6">Gunakan akun dari administrator.</p>

          {error && (
            <div className="bg-rose-500/20 border border-rose-500/30 text-rose-300 text-sm rounded-lg p-3 mb-4">
              {error === 'Invalid login credentials'
                ? 'Email atau password salah. Coba lagi.'
                : error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wide text-white/50 mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="email@kp.go.id"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wide text-white/50 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {loading ? 'Masuk...' : 'Masuk'}
            </button>
          </form>

        </div>

        {/* Public link */}
        <p className="text-center text-white/40 text-xs mt-6">
          Ingin melihat data publik?{' '}
          <Link href="/publik" className="text-blue-400 hover:text-blue-300 underline">
            Tampilan Publik
          </Link>
        </p>
      </div>
    </div>
  )
}
