'use client'
import AdminOnly from '../../../components/AdminOnly'
import DokumenArsip from '../../../views/DokumenArsip'

export default function Page() {
  return (
    <AdminOnly>
      <DokumenArsip />
    </AdminOnly>
  )
}
