import { createContext, useContext, useEffect, useState } from 'react'
import { api, setToken, clearToken, getToken, UNAUTHORIZED_EVENT } from './lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Pulihkan sesi dari token tersimpan
    if (getToken()) {
      api('/auth/me', { method: 'GET' }).then(({ data, error }) => {
        if (data && !error) {
          setSession({ user: data.user })
          setProfile(data.profile)
        } else {
          clearToken()
        }
        setLoading(false)
      })
    } else {
      setLoading(false)
    }

    // Token kedaluwarsa / akun dihapus -> kembali ke halaman login
    const onUnauthorized = () => {
      setSession(null)
      setProfile(null)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  async function signIn(email, password) {
    const { data, error } = await api('/auth/login', { body: { email, password } })
    if (error || !data) return { data: null, error: error || { message: 'Gagal login' } }
    setToken(data.token)
    setSession({ user: data.user })
    setProfile(data.profile)
    return { data: { user: data.user, session: { user: data.user } }, error: null }
  }

  async function signOut() {
    clearToken()
    setProfile(null)
    setSession(null)
  }

  const isAdmin = profile?.role === 'admin'
  const isUPT = profile?.role === 'upt'
  const uptKey = profile?.upt_key

  return (
    <AuthContext.Provider value={{ session, profile, loading, isAdmin, isUPT, uptKey, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
