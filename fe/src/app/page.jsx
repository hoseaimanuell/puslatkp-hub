'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// "/" -> dashboard. Tautan lama "/?page=publik" tetap dialihkan ke halaman yang sesuai.
export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const page = new URLSearchParams(window.location.search).get('page')
    router.replace('/' + (/^[a-z-]+$/.test(page || '') ? page : 'dashboard'))
  }, [router])
  return null
}
