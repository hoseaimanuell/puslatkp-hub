'use client'
import PublikView from '../../views/PublikView'
import { useNavigate } from '../../lib/nav'

export default function PublikPage() {
  const navigate = useNavigate()
  return <PublikView onLoginClick={() => navigate('dashboard')} />
}
