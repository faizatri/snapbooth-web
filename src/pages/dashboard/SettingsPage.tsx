import { useAuth } from '../../context/AuthContext'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs uppercase tracking-widest text-gray-500">{label}</p>
      <p className="text-white">{value}</p>
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-1">Pengaturan</h1>
      <p className="text-gray-500 mb-8">Kelola akun dan preferensi kamu.</p>

      <section className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
          Profil
        </h2>
        <div className="flex flex-col gap-5">
          <InfoRow label="Nama" value={user?.name ?? '—'} />
          <div className="border-t border-gray-800" />
          <InfoRow label="Email" value={user?.email ?? '—'} />
        </div>
      </section>

      <p className="text-center text-gray-700 text-xs mt-6">
        Fitur edit profil dan ganti password akan segera hadir.
      </p>
    </div>
  )
}
