'use client'
import AdminOnly from '../../../components/AdminOnly'
import TempatSampah from '../../../views/admin/TempatSampah'

export default function Page() {
  return (
    <AdminOnly>
      <TempatSampah />
    </AdminOnly>
  )
}
