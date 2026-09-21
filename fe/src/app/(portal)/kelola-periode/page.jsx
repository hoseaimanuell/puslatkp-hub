'use client'
import AdminOnly from '../../../components/AdminOnly'
import KelolaPeriode from '../../../views/admin/KelolaPeriode'

export default function Page() {
  return (
    <AdminOnly>
      <KelolaPeriode />
    </AdminOnly>
  )
}
