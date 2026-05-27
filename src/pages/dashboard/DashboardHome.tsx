import { useAuth } from '../../context/AuthContext'

export default function DashboardHome() {
  const { user } = useAuth()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">
        Selamat datang{user ? `, ${user.name}` : ''}!
      </h1>
      <p className="text-gray-500 mb-8">Kelola event dan sesi foto booth kamu di sini.</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Events</p>
          <p className="text-3xl font-bold">—</p>
          <p className="text-gray-600 text-sm mt-1">total event aktif</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Sesi</p>
          <p className="text-3xl font-bold">—</p>
          <p className="text-gray-600 text-sm mt-1">sesi hari ini</p>
        </div>
      </div>

      <p className="text-gray-700 text-sm mt-8">
        Pilih menu di sidebar untuk mulai mengelola event.
      </p>
    </div>
  )
}
