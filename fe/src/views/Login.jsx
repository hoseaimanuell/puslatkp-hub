/**
 * views/Login.jsx
 * Halaman login — autentikasi via backend Express (JWT)
 */
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../AuthContext'
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react'
import LogoKKP from '../components/LogoKKP'
import LautBergerak from '../components/LautBergerak'

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
    <div className="min-h-screen bg-kkp-ocean flex flex-col lg:flex-row">
      {/* Panel institusi — identitas KKP, disembunyikan di layar sempit demi keringkasan */}
      <div className="hidden lg:flex lg:w-[44%] relative overflow-hidden bg-gradient-to-br from-[#0B1830] via-[#10233F] to-[#0B1830] flex-col justify-between p-12">
        {/* Gelombang bergerak + siluet ikan */}
        <LautBergerak />
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <LogoKKP size={52} priority />
            <div>
              <p className="text-white font-bold text-lg leading-tight">PUSLATKP</p>
              <p className="text-white/50 text-xs leading-tight">Management Hub</p>
            </div>
          </div>
          <p className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.2em] mt-10">
            Republik Indonesia
          </p>
          <p className="text-white text-sm font-medium mt-1">
            Kementerian Kelautan dan Perikanan
          </p>
        </div>

        <div className="relative">
          <h2 className="text-white text-2xl font-bold leading-snug max-w-sm">
            Portal Pelaporan Pusat Pelatihan Kelautan dan Perikanan
          </h2>
          <p className="text-white/50 text-sm mt-3 max-w-sm leading-relaxed">
            Pencatatan aktivitas dan kinerja pelatihan mingguan, bulanan, triwulan,
            dan tahunan bagi seluruh UPT/Balai di lingkungan PUSLATKP.
          </p>
          <div className="flex items-center gap-2 mt-6 text-white/40 text-xs">
            <ShieldCheck size={14} className="text-amber-300/80" />
            <span>Akses khusus pegawai &amp; UPT terdaftar</span>
          </div>
        </div>
      </div>

      {/* Form login */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-scale-in">
          {/* Wordmark — tampil hanya di layar sempit, panel kiri sudah menampilkannya di layar lebar */}
          <div className="text-center mb-8 lg:hidden">
            <LogoKKP size={72} priority className="mb-4 shadow-sm" />
            <h1 className="font-bold text-xl text-[#0B1830]">PUSLATKP</h1>
            <p className="text-gray-500 text-xs mt-1">Kementerian Kelautan dan Perikanan</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <h2 className="text-[#0B1830] font-bold text-xl mb-1">Masuk ke akun Anda</h2>
            <p className="text-gray-500 text-sm mb-6">Gunakan akun dari administrator.</p>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg p-3 mb-4">
                {error === 'Invalid login credentials'
                  ? 'Email atau password salah. Coba lagi.'
                  : error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                  placeholder="email@kkp.go.id"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm text-gray-900 bg-white placeholder-gray-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0B1830] hover:bg-[#152D50] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 mt-2"
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
          <p className="text-center text-gray-400 text-xs mt-6">
            Ingin melihat data publik?{' '}
            <Link href="/publik" className="text-blue-600 hover:text-blue-700 font-medium underline">
              Tampilan Publik
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
