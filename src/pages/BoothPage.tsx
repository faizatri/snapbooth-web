import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCamera } from '../hooks/useCamera'
import { startSession, uploadPhoto, completeSession, type EventInfo } from '../api/booth'
import { getQR, getWhatsAppLink, sendEmail } from '../api/share'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | 'welcome'
  | 'loading'
  | 'guest-name'
  | 'countdown'
  | 'review'
  | 'gallery'
  | 'uploading'
  | 'done'
  | 'camera-error'

interface CapturedPhoto {
  blobUrl: string
  blob: Blob
}

// ─── Small reusable UI helpers ────────────────────────────────────────────────

function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-screen bg-black text-white flex flex-col select-none ${className}`}>
      {children}
    </div>
  )
}

function Center({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">{children}</div>
  )
}

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10'
  return (
    <div className={`${s} border-2 border-white border-t-transparent rounded-full animate-spin`} />
  )
}

function ProgressDots({ total, done }: { total: number; done: number }) {
  if (total <= 1) return null
  return (
    <div className="flex gap-2.5 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full transition-all ${
            i < done ? 'bg-white scale-110' : 'bg-white/25'
          }`}
        />
      ))}
    </div>
  )
}

const BTN_PRIMARY =
  'w-full font-bold text-xl py-5 rounded-2xl active:scale-[0.97] transition-all disabled:opacity-40 bg-white text-black hover:bg-gray-100'
const BTN_SECONDARY =
  'w-full font-semibold text-lg py-4 rounded-2xl active:scale-[0.97] transition-all border-2 border-gray-700 text-white hover:border-gray-500'

// ─── Main component ───────────────────────────────────────────────────────────

export default function BoothPage() {
  const { eventSlug } = useParams<{ eventSlug: string }>()
  const navigate = useNavigate()

  // Session
  const [step, setStep] = useState<Step>('welcome')
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null)
  const [guestName, setGuestName] = useState('')
  const sessionTokenRef = useRef<string | null>(null)

  // Photo capture
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [countdown, setCountdown] = useState(3)

  // Upload / completion
  const [uploadedCount, setUploadedCount] = useState(0)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)

  // Errors & email share
  const [apiError, setApiError] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const maxPhotos = eventInfo?.max_photos ?? 1

  const {
    videoRef,
    canvasRef,
    isReady,
    error: cameraError,
    startCamera,
    stopCamera,
    captureAsync,
  } = useCamera()

  // ── Effects ────────────────────────────────────────────────────────────────

  // Start / stop camera based on step
  useEffect(() => {
    if (step === 'countdown') startCamera()
    else stopCamera()
  }, [step, startCamera, stopCamera])

  // Camera permission denied or hardware error
  useEffect(() => {
    if (cameraError && step === 'countdown') setStep('camera-error')
  }, [cameraError, step])

  // Countdown timer — only begins once camera is ready
  useEffect(() => {
    if (step !== 'countdown' || !isReady) return
    setCountdown(3)
    const id = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) {
          clearInterval(id)
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [step, isReady])

  // Auto-capture when countdown reaches zero
  useEffect(() => {
    if (countdown !== 0 || step !== 'countdown') return
    captureAsync().then(blob => {
      if (!blob) return
      stopCamera()
      setCurrentBlob(blob)
      setStep('review')
    })
  }, [countdown, step, captureAsync, stopCamera])

  // Object URL for review screen — revoked automatically when blob clears
  useEffect(() => {
    if (!currentBlob) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(currentBlob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [currentBlob])

  // Fetch QR once session is complete
  useEffect(() => {
    if (step !== 'done' || !shareToken) return
    getQR(shareToken).then(setQrUrl).catch(() => {})
  }, [step, shareToken])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!eventSlug) return
    setStep('loading')
    setApiError(null)
    try {
      const result = await startSession(eventSlug)
      sessionTokenRef.current = result.session_token
      setEventInfo(
        result.event ?? { id: 0, name: eventSlug, slug: eventSlug, max_photos: 1 }
      )
      setCountdown(3)
      setStep('guest-name')
    } catch {
      setApiError('Event tidak ditemukan. Periksa URL booth kamu.')
      setStep('welcome')
    }
  }

  const handleNameSubmit = () => {
    setCountdown(3)
    setStep('countdown')
  }

  const handleRetake = () => {
    setCurrentBlob(null)
    setCountdown(3)
    setStep('countdown')
  }

  const handleKeepPhoto = () => {
    if (!currentBlob) return
    const blobUrl = URL.createObjectURL(currentBlob)
    const kept: CapturedPhoto = { blobUrl, blob: currentBlob }
    const newPhotos = [...photos, kept]
    setPhotos(newPhotos)
    setCurrentBlob(null)

    if (newPhotos.length >= maxPhotos) {
      if (maxPhotos > 1) {
        setSelectedIdx(0)
        setStep('gallery')
      } else {
        doUpload(newPhotos, 0)
      }
    } else {
      setCountdown(3)
      setStep('countdown')
    }
  }

  const doUpload = async (photosToUpload: CapturedPhoto[], _favoriteIdx: number) => {
    const token = sessionTokenRef.current
    if (!token) return
    setStep('uploading')
    setUploadedCount(0)
    setApiError(null)
    try {
      const ids: number[] = []
      for (let i = 0; i < photosToUpload.length; i++) {
        const result = await uploadPhoto(token, photosToUpload[i].blob)
        ids.push(result.id)
        setUploadedCount(i + 1)
      }
      const result = await completeSession(token, {
        selected_photo_ids: ids,
        guest_name: guestName.trim() || undefined,
      })
      photosToUpload.forEach(p => URL.revokeObjectURL(p.blobUrl))
      setShareToken(result.share_token)
      setStep('done')
    } catch {
      setApiError('Upload gagal. Coba lagi.')
    }
  }

  const handleFinishGallery = () => { void doUpload(photos, selectedIdx) }

  const handleSendEmail = async () => {
    if (!shareToken || !emailInput.trim()) return
    setEmailStatus('sending')
    try {
      await sendEmail(shareToken, emailInput.trim())
      setEmailStatus('sent')
    } catch {
      setEmailStatus('error')
    }
  }

  const handleWhatsApp = async () => {
    if (!shareToken) return
    try {
      const url = await getWhatsAppLink(shareToken)
      window.open(url, '_blank')
    } catch { /* silent */ }
  }

  const handleRestart = () => {
    photos.forEach(p => URL.revokeObjectURL(p.blobUrl))
    sessionTokenRef.current = null
    setStep('welcome')
    setEventInfo(null)
    setGuestName('')
    setPhotos([])
    setCurrentBlob(null)
    setSelectedIdx(0)
    setCountdown(3)
    setUploadedCount(0)
    setShareToken(null)
    setQrUrl(null)
    setApiError(null)
    setEmailInput('')
    setEmailStatus('idle')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // 0. Loading (start-session in progress)
  if (step === 'loading') {
    return (
      <Screen>
        <Center>
          <Spinner size="lg" />
        </Center>
      </Screen>
    )
  }

  // 1. Welcome screen
  if (step === 'welcome') {
    return (
      <Screen>
        <Center>
          <div className="text-center w-full max-w-xs">
            <p className="text-gray-600 text-xs uppercase tracking-[0.3em] mb-6">SnapBooth</p>
            <h1 className="text-5xl font-black leading-tight mb-4 break-words">
              {eventInfo?.name ?? eventSlug ?? 'Selamat Datang'}
            </h1>
            <p className="text-gray-500 text-lg mb-14">Siap untuk foto?</p>
            <button onClick={handleStart} className={BTN_PRIMARY}>
              Mulai
            </button>
            {apiError && (
              <p className="text-red-400 text-sm mt-5">{apiError}</p>
            )}
          </div>
        </Center>
      </Screen>
    )
  }

  // 2. Guest name (optional)
  if (step === 'guest-name') {
    return (
      <Screen>
        <Center>
          <div className="w-full max-w-xs">
            <h2 className="text-4xl font-bold mb-2">Siapa namamu?</h2>
            <p className="text-gray-500 mb-10">Opsional — boleh dilewati</p>
            <form onSubmit={e => { e.preventDefault(); handleNameSubmit() }} className="flex flex-col gap-4">
              <input
                type="text"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder="Nama kamu..."
                autoFocus
                autoComplete="given-name"
                className="bg-gray-900 text-white text-2xl rounded-2xl px-6 py-5 placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-white/20 transition"
              />
              <button type="submit" className={BTN_PRIMARY}>
                {guestName.trim() ? 'Lanjut →' : 'Lewati →'}
              </button>
            </form>
          </div>
        </Center>
      </Screen>
    )
  }

  // 3. Camera countdown (fullscreen camera + overlay)
  if (step === 'countdown') {
    return (
      <Screen className="relative overflow-hidden">
        {/* Live camera feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Dim overlay */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Top: photo progress */}
        <div className="absolute top-8 inset-x-0 flex justify-center">
          <ProgressDots total={maxPhotos} done={photos.length} />
        </div>

        {/* Center: countdown number */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {isReady ? (
            <span
              key={countdown}
              className="font-black text-white drop-shadow-2xl leading-none"
              style={{
                fontSize: 'clamp(8rem, 40vw, 20rem)',
                animation: 'pop-in 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
            >
              {countdown === 0 ? '📸' : countdown}
            </span>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Spinner size="lg" />
              <p className="text-white/70 text-lg">Memulai kamera...</p>
            </div>
          )}
        </div>

        {/* Bottom: photo number label */}
        <div className="absolute bottom-8 inset-x-0 text-center">
          <p className="text-white/50 text-sm tracking-widest uppercase">
            Foto {photos.length + 1} dari {maxPhotos}
          </p>
        </div>
      </Screen>
    )
  }

  // Camera permission error
  if (step === 'camera-error') {
    return (
      <Screen>
        <Center>
          <div className="text-center w-full max-w-xs">
            <p className="text-6xl mb-6">📷</p>
            <h2 className="text-2xl font-bold mb-3">Kamera tidak dapat diakses</h2>
            <p className="text-gray-400 text-sm mb-10 leading-relaxed">
              {cameraError ?? 'Berikan izin akses kamera pada browser, lalu coba lagi.'}
            </p>
            <button
              onClick={() => { setCountdown(3); setStep('countdown') }}
              className={BTN_PRIMARY}
            >
              Coba Lagi
            </button>
            <button onClick={() => setStep('welcome')} className={`${BTN_SECONDARY} mt-3`}>
              Kembali
            </button>
          </div>
        </Center>
      </Screen>
    )
  }

  // 5. Review captured photo
  if (step === 'review') {
    return (
      <Screen>
        {/* Full-height photo preview */}
        <div className="flex-1 relative bg-gray-950 overflow-hidden">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Foto preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Spinner size="lg" />
            </div>
          )}

          {/* Photo counter badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-full px-5 py-2">
            <p className="text-white text-sm tracking-wide">
              Foto {photos.length + 1} dari {maxPhotos}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 px-6 py-6 flex flex-col gap-3 bg-black">
          <button onClick={handleKeepPhoto} className={BTN_PRIMARY}>
            {photos.length + 1 < maxPhotos ? 'Simpan & Lanjut →' : 'Simpan ✓'}
          </button>
          <button onClick={handleRetake} className={BTN_SECONDARY}>
            ↩ Foto Ulang
          </button>
        </div>
      </Screen>
    )
  }

  // 7. Gallery — select favorite
  if (step === 'gallery') {
    return (
      <Screen>
        <div className="shrink-0 px-6 pt-10 pb-4 text-center">
          <h2 className="text-3xl font-bold mb-1">Pilih foto favoritmu</h2>
          <p className="text-gray-500 text-sm">Foto ini akan ditampilkan di halaman share</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto pb-4">
            {photos.map((photo, i) => (
              <button
                key={photo.blobUrl}
                onClick={() => setSelectedIdx(i)}
                className={`relative aspect-square rounded-2xl overflow-hidden border-4 transition-all duration-200 ${
                  i === selectedIdx
                    ? 'border-yellow-400 scale-[1.03]'
                    : 'border-transparent opacity-70'
                }`}
              >
                <img
                  src={photo.blobUrl}
                  alt={`Foto ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                {i === selectedIdx && (
                  <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-black font-bold text-base shadow-lg">
                    ★
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="shrink-0 px-6 py-6 bg-black">
          {apiError && (
            <p className="text-red-400 text-sm text-center mb-3">{apiError}</p>
          )}
          <button onClick={handleFinishGallery} className={BTN_PRIMARY}>
            Selesai →
          </button>
        </div>
      </Screen>
    )
  }

  // Uploading
  if (step === 'uploading') {
    return (
      <Screen>
        <Center>
          {apiError ? (
            <div className="text-center w-full max-w-xs">
              <p className="text-2xl mb-2">⚠️</p>
              <p className="text-red-400 text-lg font-semibold mb-2">Upload gagal</p>
              <p className="text-gray-500 text-sm mb-8">{apiError}</p>
              <button
                onClick={() => { void doUpload(photos, selectedIdx) }}
                className={BTN_PRIMARY}
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <div className="text-center">
              <Spinner size="lg" />
              <p className="text-xl font-semibold mt-8 mb-2">Menyimpan foto...</p>
              <p className="text-gray-500">
                {uploadedCount} / {maxPhotos}
              </p>
              {/* Progress bar */}
              <div className="w-48 h-1.5 bg-gray-800 rounded-full mt-4 mx-auto overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${(uploadedCount / maxPhotos) * 100}%` }}
                />
              </div>
            </div>
          )}
        </Center>
      </Screen>
    )
  }

  // 8. Done — share screen
  if (step === 'done') {
    return (
      <Screen>
        <div className="flex-1 overflow-y-auto">
          <Center>
            <div className="text-center w-full max-w-xs py-8">
              <p className="text-5xl mb-4">🎉</p>
              <h2 className="text-3xl font-bold mb-1">Foto siap!</h2>
              <p className="text-gray-500 text-sm mb-8">
                Scan QR code untuk menyimpan fotomu
              </p>

              {/* QR Code */}
              <div className="flex justify-center mb-8">
                {qrUrl ? (
                  <div className="bg-white p-5 rounded-3xl shadow-2xl">
                    <img
                      src={qrUrl}
                      alt="QR Code"
                      className="w-52 h-52 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 bg-gray-900 rounded-3xl flex items-center justify-center">
                    <Spinner />
                  </div>
                )}
              </div>

              {/* Share buttons */}
              <div className="flex flex-col gap-3 mb-6">
                <button onClick={() => navigate(`/share/${shareToken}`)} className={BTN_PRIMARY}>
                  Lihat Galeri
                </button>
                <button onClick={() => { void handleWhatsApp() }} className={BTN_SECONDARY}>
                  WhatsApp
                </button>
              </div>

              {/* Email form */}
              <div className="border-t border-gray-800 pt-6">
                {emailStatus === 'sent' ? (
                  <p className="text-green-400 text-sm py-2">✓ Email terkirim!</p>
                ) : (
                  <form onSubmit={e => { e.preventDefault(); void handleSendEmail() }} className="flex gap-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      placeholder="Email kamu..."
                      required
                      className="flex-1 bg-gray-900 text-white text-base rounded-xl px-4 py-3 placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-white/20 transition"
                    />
                    <button
                      type="submit"
                      disabled={emailStatus === 'sending' || !emailInput.trim()}
                      className="bg-white text-black font-bold px-5 py-3 rounded-xl disabled:opacity-40 hover:bg-gray-100 active:scale-95 transition-all shrink-0"
                    >
                      {emailStatus === 'sending' ? '...' : 'Kirim'}
                    </button>
                  </form>
                )}
                {emailStatus === 'error' && (
                  <p className="text-red-400 text-xs mt-2">Gagal mengirim email. Coba lagi.</p>
                )}
              </div>

              {/* Restart */}
              <button
                onClick={handleRestart}
                className="mt-8 text-gray-600 text-sm hover:text-gray-400 transition-colors py-2"
              >
                ↩ Mulai Lagi
              </button>
            </div>
          </Center>
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <Center>
        <Spinner size="lg" />
      </Center>
    </Screen>
  )
}
