/**
 * Mengganti password sebuah akun.
 *   npm run user:password -- email@contoh.go.id PasswordBaru123
 */
import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'

const [email, password] = process.argv.slice(2)
if (!email || !password || password.length < 8) {
  console.error('Pemakaian: npm run user:password -- <email> <password-baru-min-8-karakter>')
  process.exit(1)
}
const [res] = await pool.query('UPDATE profiles SET password_hash = ? WHERE email = ?', [await bcrypt.hash(password, 10), email.toLowerCase()])
console.log(res.affectedRows ? `Password ${email} diperbarui.` : `Akun ${email} tidak ditemukan.`)
await pool.end()
