'use client'
import AdminOnly from '../../../components/AdminOnly'
import KelolaAkunUPT from '../../../views/admin/KelolaAkunUPT'

export default function Page() {
  return (
    <AdminOnly>
      <KelolaAkunUPT />
    </AdminOnly>
  )
}
