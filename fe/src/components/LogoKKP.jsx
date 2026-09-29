/**
 * components/LogoKKP.jsx
 * Logo resmi Kementerian Kelautan dan Perikanan (fe/public/logo-kkp.jpg). Berkasnya berlatar putih, jadi selalu
 * ditaruh di lingkaran putih agar tetap rapi di atas latar navy (sidebar, panel login). Jangan diubah warna,
 * bentuk, atau proporsinya.
 */
import Image from 'next/image'

export default function LogoKKP({ size = 40, className = '', priority = false }) {
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 rounded-full bg-white overflow-hidden ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: size, padding: Math.max(2, Math.round(size * 0.06)) }}
    >
      <Image
        src="/logo-kkp.jpg"
        alt="Logo Kementerian Kelautan dan Perikanan"
        width={size}
        height={size}
        priority={priority}
        unoptimized
        className="w-full h-full object-contain"
      />
    </span>
  )
}
