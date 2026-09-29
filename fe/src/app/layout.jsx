// Font dipasang bersama aplikasi (bukan dari Google Fonts): lebih cepat, tidak ada permintaan ke luar, dan tetap
// tampil di jaringan kantor tanpa internet. Plus Jakarta Sans = judul & angka besar; Inter = teks & tabel.
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/inter'
import './globals.css'
import Providers from '../components/Providers'

export const metadata = {
  title: 'PUSLATKP Management Hub',
  description: 'PUSLATKP Management Hub — Dashboard pelaporan aktivitas dan kinerja tim Pusat Pelatihan Kelautan dan Perikanan.',
  icons: { icon: '/logo-kkp.jpg', apple: '/logo-kkp.jpg' },
}

export const viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
