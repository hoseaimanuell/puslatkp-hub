'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../AuthContext'

/** Halaman khusus Admin: non-admin dialihkan ke dashboard. */
export default function AdminOnly({ children }) {
  const { isAdmin } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!isAdmin) router.replace('/dashboard')
  }, [isAdmin, router])
  return isAdmin ? children : null
}
