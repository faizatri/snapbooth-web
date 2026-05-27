import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Photo, SessionData } from '../api/booth'
import { getSession } from '../api/booth'
import { getDownloadUrl, getQR, getWhatsAppLink, sendEmail } from '../api/share'

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(iso))
}

async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank')
  }
}

interface PhotoCardProps {
  photo: Photo
  isFavorite: boolean
  onDownload: () => void
  onClick: () => void
}

function PhotoCard({ photo, isFavorite, onDownload, onClick }: PhotoCardProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative rounded-2xl overflow-hidden aspect-square bg-gray-900">
      {!loaded && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse" />
      )}
      <img
        src={photo.thumbnail_url ?? photo.url}
        alt="Foto"
        className={`w-full h-full object-cover cursor-pointer transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onClick={onClick}
      />
      {isFavorite && (
        <div className="absolute top-2 left-2 bg-yellow-400 text-black text-xs font-bold px-2 py-0.5 rounded-full leading-none">
          ★
        </div>
      )}
      <button
        onClick={e => { e.stopPropagation(); onDownload() }}
        aria-label="Download foto"
        className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all text-base"
      >
        ↓
      </button>
    </div>
  )
}

interface LightboxProps {
  photo: Photo
  onClose: () => void
  onDownload: () => void
}

function Lightbox({ photo, onClose, onDownload }: LightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Tutup"
        className="absolute top-4 right-5 text-white text-4xl leading-none opacity-60 hover:opacity-100 transition-opacity"
      >
        ×
      </button>
      <img
        src={photo.url}
        alt="Foto fullscreen"
        className="max-w-full max-h-[78vh] rounded-2xl object-contain shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
      <button
        onClick={e => { e.stopPropagation(); onDownload() }}
        className="mt-6 bg-white text-black font-semibold px-8 py-3 rounded-full text-sm hover:bg-gray-100 active:scale-95 transition-all"
      >
        Download Foto Ini
      </button>
    </div>
  )
}

export default function SharePage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [session, setSession] = useState<SessionData | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [whatsappLoading, setWhatsappLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    if (!shareToken) return
    getSession(shareToken)
      .then(setSession)
      .catch(() => setError('Sesi tidak ditemukan atau sudah kadaluarsa.'))
      .finally(() => setSessionLoading(false))
  }, [shareToken])

  useEffect(() => {
    if (!shareToken) return
    getQR(shareToken).then(setQrUrl).catch(() => undefined)
  }, [shareToken])

  const handleDownload = async (photo: Photo) => {
    setDownloadingId(photo.id)
    try {
      const url = await getDownloadUrl(photo.id)
      await downloadFile(url, `snapbooth-${photo.id}.jpg`)
    } catch {
      window.open(photo.url, '_blank')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleWhatsApp = async () => {
    if (!shareToken) return
    setWhatsappLoading(true)
    try {
      const url = await getWhatsAppLink(shareToken)
      window.open(url, '_blank')
    } catch {
      // ignore
    } finally {
      setWhatsappLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!shareToken || !email.trim()) return
    setEmailStatus('sending')
    try {
      await sendEmail(shareToken, email.trim())
      setEmailStatus('sent')
      setEmail('')
    } catch {
      setEmailStatus('error')
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <p className="text-red-400 text-center">{error}</p>
      </div>
    )
  }

  const photos = session?.photos ?? []
  const skeletonCount = sessionLoading ? 2 : 0

  return (
    <>
      {lightboxPhoto && (
        <Lightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
          onDownload={() => { void handleDownload(lightboxPhoto) }}
        />
      )}

      <div className="min-h-screen bg-black text-white flex flex-col">
        <header className="shrink-0 py-5 text-center border-b border-gray-800/60">
          <h1 className="text-xl font-bold tracking-[0.3em] uppercase">SnapBooth</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-sm mx-auto px-5 py-8 flex flex-col gap-10">

            {/* Event info */}
            <div className="text-center">
              {sessionLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-7 w-48 bg-gray-800 animate-pulse rounded-lg" />
                  <div className="h-4 w-32 bg-gray-800 animate-pulse rounded-lg" />
                </div>
              ) : session?.event ? (
                <>
                  <p className="text-2xl font-bold">{session.event.name}</p>
                  {session.created_at && (
                    <p className="text-gray-500 text-sm mt-1">{fmtDate(session.created_at)}</p>
                  )}
                  {session.guest_name && (
                    <p className="text-gray-400 text-sm mt-1">untuk {session.guest_name}</p>
                  )}
                </>
              ) : (
                <p className="text-gray-600 text-sm">Foto Booth</p>
              )}
            </div>

            {/* Photo grid */}
            <section>
              <p className="text-center text-gray-500 text-xs uppercase tracking-widest mb-4">
                Foto-foto kamu
              </p>
              <div className="grid grid-cols-2 gap-3">
                {sessionLoading
                  ? Array.from({ length: skeletonCount }).map((_, i) => (
                      <div key={i} className="rounded-2xl overflow-hidden aspect-square bg-gray-800 animate-pulse" />
                    ))
                  : photos.map(photo => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        isFavorite={session?.favorite_photo_id === photo.id}
                        onDownload={() => { void handleDownload(photo) }}
                        onClick={() => setLightboxPhoto(photo)}
                      />
                    ))
                }
              </div>
              {downloadingId !== null && (
                <p className="text-center text-gray-500 text-xs mt-3 animate-pulse">
                  Mengunduh foto...
                </p>
              )}
            </section>

            {/* QR Code */}
            <section className="flex flex-col items-center gap-4">
              <p className="text-gray-500 text-xs uppercase tracking-widest">
                Scan untuk simpan
              </p>
              {qrUrl ? (
                <div className="bg-white p-5 rounded-3xl shadow-2xl">
                  <img src={qrUrl} alt="QR Code" className="w-52 h-52 object-contain" />
                </div>
              ) : (
                <div className="w-64 h-64 rounded-3xl bg-gray-800 animate-pulse" />
              )}
              <p className="text-gray-600 text-xs text-center">
                Scan QR code dengan kamera ponselmu
              </p>
            </section>

            {/* WhatsApp */}
            <section className="flex flex-col items-center">
              <button
                onClick={() => { void handleWhatsApp() }}
                disabled={whatsappLoading}
                className="w-full bg-[#25D366] text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-3 hover:brightness-110 active:scale-95 transition-all disabled:opacity-60"
              >
                {whatsappLoading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.944-1.419A9.954 9.954 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                  </svg>
                )}
                Share via WhatsApp
              </button>
            </section>

            {/* Email form */}
            <section className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <p className="text-sm font-semibold mb-1">Kirim ke Email</p>
              <p className="text-gray-500 text-xs mb-4">
                Kami akan kirim link galeri ke email kamu.
              </p>
              {emailStatus === 'sent' ? (
                <p className="text-green-400 text-sm text-center py-2">
                  Email berhasil dikirim!
                </p>
              ) : (
                <form
                  onSubmit={e => { e.preventDefault(); void handleSendEmail() }}
                  className="flex flex-col gap-3"
                >
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@kamu.com"
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
                  />
                  {emailStatus === 'error' && (
                    <p className="text-red-400 text-xs">Gagal mengirim. Coba lagi.</p>
                  )}
                  <button
                    type="submit"
                    disabled={emailStatus === 'sending' || !email.trim()}
                    className="w-full bg-white text-black font-semibold py-3 rounded-xl text-sm hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {emailStatus === 'sending' ? 'Mengirim...' : 'Kirim'}
                  </button>
                </form>
              )}
            </section>

            <p className="text-center text-gray-700 text-xs pb-4">Powered by SnapBooth</p>
          </div>
        </div>
      </div>
    </>
  )
}
