'use client'
import AdminOnly from '../../../components/AdminOnly'
import ImporHistoris from '../../../views/admin/ImporHistoris'

export default function Page() {
  return (
    <AdminOnly>
      <ImporHistoris />
    </AdminOnly>
  )
}
