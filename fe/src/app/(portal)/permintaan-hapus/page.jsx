'use client'
import AdminOnly from '../../../components/AdminOnly'
import PermintaanHapus from '../../../views/admin/PermintaanHapus'

export default function Page() {
  return (
    <AdminOnly>
      <PermintaanHapus />
    </AdminOnly>
  )
}
