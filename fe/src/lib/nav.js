'use client'
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

/** Navigasi berdasarkan nama halaman ('dashboard', 'input-data', 'publik', ...) -> route Next.js `/nama-halaman`. */
export function useNavigate() {
  const router = useRouter()
  return useCallback(page => router.push('/' + page), [router])
}
