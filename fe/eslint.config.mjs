// Pemeriksa kode (npm run lint). Aturan bawaan Next.js: kesalahan React Hooks, impor, aksesibilitas dasar, dsb.
import nextVitals from 'eslint-config-next/core-web-vitals'

export default [
  ...nextVitals,
  { ignores: ['.next/**', '.next-*/**', 'node_modules/**', 'public/**'] },
  {
    rules: {
      // Aturan baru untuk React Compiler (tidak dipakai di proyek ini). Pola yang ditandai tetap berjalan benar,
      // jadi dijadikan peringatan: dirapikan bertahap saat file itu disentuh, bukan menggagalkan pemeriksaan.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      // Teks antarmuka berbahasa Indonesia banyak memakai tanda kutip "..."; React menampilkannya dengan benar.
      'react/no-unescaped-entities': 'off',
    },
  },
]
