'use client'
import { useEffect, useState } from 'react'
import { AuthProvider } from '../AuthContext'
import Splash from './Splash'

/**
 * Seluruh aplikasi bergantung pada sesi di browser (token di localStorage), jadi konten
 * baru dirender setelah komponen ter-mount di sisi klien.
 */
export default function Providers({ children }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <Splash />
  return <AuthProvider>{children}</AuthProvider>
}
