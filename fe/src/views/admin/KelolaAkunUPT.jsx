/**
 * views/admin/KelolaAkunUPT.jsx
 * Admin: buat/nonaktifkan akun UPT via Edge Function
 */
import { useState, useEffect } from 'react'
import { db } from '../../lib/db'
import InfoCard from '../../components/InfoCard'
import Modal from '../../components/Modal'
import { Plus, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react'

import PageHeader from '../../components/PageHeader'

export default function KelolaAkunUPT() {
  const [users, setUsers] = useState([])
  const [uptList, setUptList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', nama_lengkap: '', upt_key: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null) // { type: 'success' | 'error', message }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function showToast(message, type = 'success') {
    setToast({ type, message })
  }

  async function loadData() {
    setLoading(true)
    const [{ data: profilesData }, { data: uptData }] = await Promise.all([
      db.from('profiles').select('*').eq('role', 'upt').order('created_at', { ascending: false }),
      db.from('upt_list').select('*').order('label'),
    ])
    setUsers(profilesData || [])
    setUptList(uptData || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Call Edge Function to create user
      const { data, error: fnError } = await db.functions.invoke('create-upt-user', {
        body: {
          email: form.email,
          password: form.password,
          nama_lengkap: form.nama_lengkap,
          upt_key: form.upt_key,
        }
      })

      if (fnError) throw fnError

      showToast(`Akun berhasil dibuat untuk ${form.nama_lengkap} (${form.upt_key})`)
      setForm({ email: '', password: '', nama_lengkap: '', upt_key: '' })
      setModalOpen(false)
      loadData()
    } catch (err) {
      setError(err.message || 'Gagal membuat akun')
      showToast(err.message || 'Gagal membuat akun', 'error')
    }
    setSaving(false)
  }

  async function handleAddUPT() {
    const key = prompt('Masukkan key UPT (huruf kecil, underscore):')?.trim()
    const label = prompt('Masukkan nama UPT:')?.trim()
    if (!key || !label) return
    await db.from('upt_list').upsert({ key, label, aktif: true })
    showToast(`UPT "${label}" berhasil ditambahkan`)
    loadData()
  }

  async function handleDeleteUPT(upt) {
    const userCount = users.filter(u => u.upt_key === upt.key).length
    const warn = userCount > 0
      ? `UPT "${upt.label}" punya ${userCount} akun terdaftar. Menghapus UPT ini akan MENGHAPUS PERMANEN seluruh akun, data input mingguan/bulanan, berkas, dan aktivitas milik UPT tersebut. Lanjutkan?`
      : `Hapus UPT "${upt.label}"? Seluruh data input mingguan/bulanan, berkas, dan aktivitas milik UPT ini ikut terhapus permanen dan tidak bisa dibatalkan.`
    if (!confirm(warn)) return
    try {
      const { error } = await db.from('upt_list').delete().eq('key', upt.key)
      if (error) throw error
      showToast(`UPT "${upt.label}" berhasil dihapus`)
      loadData()
    } catch (err) {
      showToast(err.message || 'Gagal menghapus UPT', 'error')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader title="Kelola Akun UPT" />

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}

      {/* UPT List */}
      <InfoCard
        title="Daftar Unit Pelaksana Teknis"
        action={
          <button onClick={handleAddUPT} className="btn-secondary text-xs">
            <Plus size={14} />
            Tambah UPT
          </button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {uptList.map(upt => {
              const userCount = users.filter(u => u.upt_key === upt.key).length
              return (
                <div key={upt.key} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{upt.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{upt.key} · {userCount} akun</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteUPT(upt)}
                      className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Hapus UPT"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </InfoCard>

      {/* Akun UPT */}
      <InfoCard
        title="Akun Pengguna UPT"
        action={
          <button onClick={() => setModalOpen(true)} className="btn-primary text-xs">
            <Plus size={14} />
            Buat Akun Baru
          </button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Belum ada akun UPT</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Nama</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">UPT</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Dibuat</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-3 px-3 text-gray-900 dark:text-gray-100 font-medium">{user.nama_lengkap || '-'}</td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-300 font-mono text-xs">{user.email || '-'}</td>
                    <td className="py-3 px-3">
                      <span className="badge-blue">{user.upt_key || '-'}</span>
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-xs">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => {
                          if (confirm(`Hapus akun ${user.nama_lengkap}? (akun tidak dapat login lagi)`)) {
                            db.from('profiles').delete().eq('id', user.id).then(({ error }) => {
                              if (error) return showToast(error.message || 'Gagal menghapus akun', 'error')
                              showToast(`Akun ${user.nama_lengkap} berhasil dihapus`)
                              loadData()
                            })
                          }
                        }}
                        className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </InfoCard>

      {/* Create User Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setError('') }}
        title="Buat Akun UPT Baru"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
            <button form="create-upt-form" type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Membuat...' : 'Buat Akun'}
            </button>
          </>
        }
      >
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}
        <form id="create-upt-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="form-label">Nama Lengkap <span className="text-rose-500">*</span></label>
            <input type="text" value={form.nama_lengkap} onChange={e => setForm(f => ({...f, nama_lengkap: e.target.value}))}
              className="form-input" required placeholder="Nama UPT atau penanggung jawab" />
          </div>
          <div>
            <label className="form-label">Email <span className="text-rose-500">*</span></label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
              className="form-input" required placeholder="upt@kp.go.id" />
          </div>
          <div>
            <label className="form-label">Password <span className="text-rose-500">*</span></label>
            <input type="text" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
              className="form-input" required minLength={8} placeholder="Min. 8 karakter" />
          </div>
          <div>
            <label className="form-label">UPT <span className="text-rose-500">*</span></label>
            <select value={form.upt_key} onChange={e => setForm(f => ({...f, upt_key: e.target.value}))}
              className="form-select" required>
              <option value="">Pilih UPT</option>
              {uptList.filter(u => u.aktif).map(u => (
                <option key={u.key} value={u.key}>{u.label}</option>
              ))}
            </select>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-400">
            Akun baru akan langsung aktif dan pengguna dapat langsung login menggunakan email & password yang didaftarkan.
          </div>
        </form>
      </Modal>
    </div>
  )
}
