'use client'
import AdminOnly from '../../../components/AdminOnly'
import KelolaDashboard from '../../../views/admin/KelolaDashboard'

export default function Page() {
  return (
    <AdminOnly>
      <KelolaDashboard />
    </AdminOnly>
  )
}
