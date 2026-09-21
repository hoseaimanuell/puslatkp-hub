'use client'
import AdminOnly from '../../../components/AdminOnly'
import KelolaJenisData from '../../../views/admin/KelolaJenisData'

export default function Page() {
  return (
    <AdminOnly>
      <KelolaJenisData />
    </AdminOnly>
  )
}
