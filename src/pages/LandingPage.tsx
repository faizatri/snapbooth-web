import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 gap-10">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-[0.3em] uppercase mb-3">SnapBooth</h1>
        <p className="text-gray-500 text-sm">Foto booth digital untuk eventmu</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <p className="text-center text-gray-600 text-xs uppercase tracking-widest mb-1">Tamu</p>
        <p className="text-center text-gray-500 text-sm">
          Akses booth via URL yang diberikan oleh penyelenggara event.
        </p>

        <div className="border-t border-gray-800 pt-6 mt-2 flex flex-col gap-3">
          <p className="text-center text-gray-600 text-xs uppercase tracking-widest">
            Penyelenggara
          </p>
          <Link
            to="/login"
            className="block text-center bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
          >
            Masuk ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
