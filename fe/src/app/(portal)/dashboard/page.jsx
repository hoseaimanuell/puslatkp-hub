'use client'
import DashboardHome from '../../../views/DashboardHome'
import { useNavigate } from '../../../lib/nav'

export default function Page() {
  return <DashboardHome onNavigate={useNavigate()} />
}
