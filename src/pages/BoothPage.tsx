import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCamera } from '../hooks/useCamera'
import {
  startSession,
  uploadPhoto,
  completeSession,
  type EventInfo,
  type TemplateInfo,
} from '../api/booth'
import { getQR, getWhatsAppLink, sendEmail } from '../api/share'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | 'welcome'
  | 'loading'
  | 'guest-name'
  | 'filter-select'
  | 'countdown'
  | 'review'
  | 'composing'
  | 'strip-preview'
  | 'uploading'
  | 'done'
  | 'camera-error'

interface CapturedPhoto {
  blobUrl: string
  blob: Blob
}

// ─── Filter definitions ───────────────────────────────────────────────────────

const FILTERS = [
  { id: 'normal',    label: 'Normal',      css: 'none',                                           emoji: '🌈' },
  { id: 'grayscale', label: 'Hitam Putih', css: 'grayscale(100%)',                                 emoji: '⚫' },
  { id: 'sepia',     label: 'Sepia',       css: 'sepia(80%)',                                      emoji: '🟫' },
  { id: 'vivid',     label: 'Vivid',       css: 'contrast(1.3) saturate(1.5) brightness(1.05)',    emoji: '✨' },
]

const CANVAS_FILTERS: Record<string, string> = {
  normal:    'none',
  grayscale: 'grayscale(100%)',
  sepia:     'sepia(80%)',
  vivid:     'contrast(1.3) saturate(1.5) brightness(1.05)',
}

// ─── Photo strip builder ──────────────────────────────────────────────────────

function loadImg(src: string, crossOrigin?: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = crossOrigin
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function isDarkColor(hex: string): boolean {
  const c = hex.replace('#', '')
  if (c.length < 6) return false
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

interface StripOptions {
  bgColor?: string
  overlayUrl?: string | null
  eventName?: string
  guestName?: string
  filter?: string
  layout?: 'strip' | 'grid'
}

function drawPhotoWithShadow(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  filter: string,
) {
  if (filter !== 'none') ctx.filter = filter
  ctx.shadowColor = 'rgba(0,0,0,0.20)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  ctx.drawImage(img, x, y, w, h)
  ctx.filter = 'none'
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  canvasW: number, headerH: number,
  eventName: string | undefined, guestName: string | undefined,
  textColor: string, subtextColor: string, dividerColor: string,
  padH: number,
) {
  if (eventName) {
    ctx.textAlign = 'center'
    ctx.font = `bold 22px Georgia, "Times New Roman", serif`
    ctx.fillStyle = textColor
    ctx.fillText(eventName, canvasW / 2, headerH / 2 + (guestName ? 4 : 10))
    if (guestName) {
      ctx.font = `italic 15px Georgia, "Times New Roman", serif`
      ctx.fillStyle = subtextColor
      ctx.fillText(guestName, canvasW / 2, headerH / 2 + 26)
    }
  }
  ctx.strokeStyle = dividerColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padH, headerH)
  ctx.lineTo(canvasW - padH, headerH)
  ctx.stroke()
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  canvasW: number, canvasH: number, footerH: number,
  subtextColor: string, dividerColor: string, padH: number,
) {
  const footerY = canvasH - footerH
  ctx.strokeStyle = dividerColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padH, footerY)
  ctx.lineTo(canvasW - padH, footerY)
  ctx.stroke()
  const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.textAlign = 'center'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillStyle = subtextColor
  ctx.fillText(`SnapBooth  ✦  ${dateStr}`, canvasW / 2, footerY + footerH / 2 + 5)
}

async function buildPhotoStrip(
  photos: CapturedPhoto[],
  options: StripOptions = {},
): Promise<Blob> {
  const {
    bgColor = '#ffffff',
    overlayUrl,
    eventName,
    guestName,
    filter = 'normal',
    layout = 'strip',
  } = options

  const images = await Promise.all(photos.map(p => loadImg(p.blobUrl)))
  const canvasFilter = CANVAS_FILTERS[filter] ?? 'none'
  const isDark = isDarkColor(bgColor)
  const textColor = isDark ? '#ffffff' : '#1a1a1a'
  const subtextColor = isDark ? 'rgba(255,255,255,0.50)' : '#888888'
  const dividerColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'

  const padH = 28
  const headerH = 84
  const footerH = 52

  const use2x2 = layout === 'grid' && images.length === 4

  // ── Canvas setup ──────────────────────────────────────────────────────────

  let canvasW: number, canvasH: number
  let photoW: number, photoH: number
  let gapGrid = 12

  if (use2x2) {
    const totalInnerW = 560
    canvasW = totalInnerW
    photoW = Math.floor((totalInnerW - padH * 2 - gapGrid) / 2)
    photoH = Math.round((images[0].naturalHeight / images[0].naturalWidth) * photoW)
    canvasH = headerH + photoH * 2 + gapGrid + 16 * 3 + footerH
  } else {
    photoW = 520
    photoH = Math.round((images[0].naturalHeight / images[0].naturalWidth) * photoW)
    canvasW = photoW + padH * 2
    canvasH = headerH + photoH * images.length + 16 * (images.length + 1) + footerH
  }

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!

  // Background + border
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvasW, canvasH)
  ctx.strokeStyle = 'rgba(0,0,0,0.10)'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, canvasW - 1, canvasH - 1)

  // Header
  drawHeader(ctx, canvasW, headerH, eventName, guestName, textColor, subtextColor, dividerColor, padH)

  // ── Photos ────────────────────────────────────────────────────────────────

  if (use2x2) {
    // 2×2 grid
    const gapV = 16
    const positions: [number, number][] = [
      [padH, headerH + gapV],
      [padH + photoW + gapGrid, headerH + gapV],
      [padH, headerH + gapV + photoH + gapGrid],
      [padH + photoW + gapGrid, headerH + gapV + photoH + gapGrid],
    ]
    for (let i = 0; i < Math.min(images.length, 4); i++) {
      const [x, y] = positions[i]
      drawPhotoWithShadow(ctx, images[i], x, y, photoW, photoH, canvasFilter)
    }
  } else {
    // Vertical strip
    const gapV = 16
    for (let i = 0; i < images.length; i++) {
      const x = padH
      const y = headerH + gapV + i * (photoH + gapV)
      drawPhotoWithShadow(ctx, images[i], x, y, photoW, photoH, canvasFilter)
    }
  }

  // Footer
  drawFooter(ctx, canvasW, canvasH, footerH, subtextColor, dividerColor, padH)

  // Overlay frame
  if (overlayUrl) {
    try {
      const overlay = await loadImg(overlayUrl, 'anonymous')
      ctx.drawImage(overlay, 0, 0, canvasW, canvasH)
    } catch { /* skip */ }
  }

  return new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.93))
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-screen bg-black text-white flex flex-col select-none ${className}`}>
      {children}
    </div>
  )
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex-1 flex flex-col items-center justify-center px-6">{children}</div>
}

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10'
  return <div className={`${s} border-2 border-white border-t-transparent rounded-full animate-spin`} />
}

function ProgressDots({ total, done }: { total: number; done: number }) {
  if (total <= 1) return null
  return (
    <div className="flex gap-2.5 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < done ? 'bg-white scale-110' : 'bg-white/25'}`} />
      ))}
    </div>
  )
}

const BTN_PRIMARY =
  'w-full font-bold text-xl py-5 rounded-2xl active:scale-[0.97] transition-all disabled:opacity-40 bg-white text-black hover:bg-gray-100'
const BTN_SECONDARY =
  'w-full font-semibold text-lg py-4 rounded-2xl active:scale-[0.97] transition-all border-2 border-gray-700 text-white hover:border-gray-500'

const KIOSK_DURATION = 15

// ─── Main component ───────────────────────────────────────────────────────────

export default function BoothPage() {
  const { eventSlug } = useParams<{ eventSlug: string }>()
  const navigate = useNavigate()

  // Session
  const [step, setStep] = useState<Step>('welcome')
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null)
  const [template, setTemplate] = useState<TemplateInfo | null>(null)
  const [guestName, setGuestName] = useState('')
  const [countdownDuration, setCountdownDuration] = useState(3)
  const sessionTokenRef = useRef<string | null>(null)

  // Photo capture
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(3)

  // Filter (feature 3)
  const [selectedFilter, setSelectedFilter] = useState('normal')

  // Strip layout (feature 1)
  const [stripLayout, setStripLayout] = useState<'strip' | 'grid'>('strip')

  // Kiosk mode (feature 2)
  const [kioskMode, setKioskMode] = useState(false)
  const [kioskCountdown, setKioskCountdown] = useState(KIOSK_DURATION)

  // Strip output
  const [stripBlob, setStripBlob] = useState<Blob | null>(null)
  const [stripUrl, setStripUrl] = useState<string | null>(null)

  // Done / share
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)

  // UI
  const [apiError, setApiError] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const maxPhotos = eventInfo?.max_photos ?? 4

  const { videoRef, canvasRef, isReady, error: cameraError, startCamera, stopCamera, captureAsync } =
    useCamera()

  // ── Effects ────────────────────────────────────────────────────────────────

  // Camera: on during filter preview AND countdown
  useEffect(() => {
    if (step === 'filter-select' || step === 'countdown') startCamera()
    else stopCamera()
  }, [step, startCamera, stopCamera])

  useEffect(() => {
    if (cameraError && (step === 'countdown' || step === 'filter-select')) setStep('camera-error')
  }, [cameraError, step])

  // Countdown timer
  useEffect(() => {
    if (step !== 'countdown' || !isReady) return
    setCountdown(countdownDuration)
    const id = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) { clearInterval(id); return 0 }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [step, isReady])

  // Auto-capture when countdown hits 0
  useEffect(() => {
    if (countdown !== 0 || step !== 'countdown') return
    captureAsync().then(blob => {
      if (!blob) return
      stopCamera()
      setCurrentBlob(blob)
      setStep('review')
    })
  }, [countdown, step, captureAsync, stopCamera])

  // Preview URL for review screen
  useEffect(() => {
    if (!currentBlob) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(currentBlob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [currentBlob])

  // QR code when done
  useEffect(() => {
    if (step !== 'done' || !shareToken) return
    getQR(shareToken).then(setQrUrl).catch(() => {})
  }, [step, shareToken])

  // Kiosk auto-restart countdown
  useEffect(() => {
    if (step !== 'done' || !kioskMode) return
    setKioskCountdown(KIOSK_DURATION)
    const id = setInterval(() => {
      setKioskCountdown(n => {
        if (n <= 1) { clearInterval(id); handleRestart(); return 0 }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [step, kioskMode])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!eventSlug) return
    setStep('loading')
    setApiError(null)
    try {
      const result = await startSession(eventSlug)
      sessionTokenRef.current = result.session_token
      setEventInfo(result.event)
      setTemplate(result.template ?? null)
      const cd = result.event.countdown_seconds ?? 3
      setCountdownDuration(cd)
      setCountdown(cd)
      // Layout: 'grid' if template says so and max_photos === 4
      setStripLayout(result.template?.layout === 'grid' ? 'grid' : 'strip')
      // Kiosk mode from event_config (accessed via event.kiosk_mode if backend returns it)
      const cfg = (result as unknown as { event_config?: Record<string, unknown> }).event_config ?? {}
      setKioskMode(Boolean(cfg.kiosk_mode))
      setStep('guest-name')
    } catch {
      setApiError('Event tidak ditemukan. Periksa URL booth kamu.')
      setStep('welcome')
    }
  }

  const handleNameSubmit = () => {
    setStep('filter-select')
  }

  const handleFilterNext = () => {
    setCountdown(countdownDuration)
    setStep('countdown')
  }

  const handleRetake = () => {
    setCurrentBlob(null)
    setCountdown(countdownDuration)
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
      void buildAndShowStrip(newPhotos)
    } else {
      setCountdown(countdownDuration)
      setStep('countdown')
    }
  }

  const buildAndShowStrip = async (photosToStrip: CapturedPhoto[]) => {
    setStep('composing')
    try {
      const blob = await buildPhotoStrip(photosToStrip, {
        bgColor: template?.background_color ?? '#ffffff',
        overlayUrl: template?.overlay_url ?? null,
        eventName: eventInfo?.name,
        guestName: guestName.trim() || undefined,
        filter: selectedFilter,
        layout: stripLayout,
      })
      const url = URL.createObjectURL(blob)
      setStripBlob(blob)
      setStripUrl(url)
      setStep('strip-preview')
    } catch {
      setApiError('Gagal membuat strip foto. Coba lagi.')
      setStep('review')
    }
  }

  const doUpload = async () => {
    if (!stripBlob) return
    const token = sessionTokenRef.current
    if (!token) return
    setStep('uploading')
    setApiError(null)
    try {
      const uploadedPhoto = await uploadPhoto(token, stripBlob)
      const result = await completeSession(token, {
        selected_photo_ids: [uploadedPhoto.id],
        guest_name: guestName.trim() || undefined,
      })
      photos.forEach(p => URL.revokeObjectURL(p.blobUrl))
      if (stripUrl) URL.revokeObjectURL(stripUrl)
      setShareToken(result.share_token)
      setStep('done')
    } catch {
      setApiError('Upload gagal. Coba lagi.')
      setStep('strip-preview')
    }
  }

  const handleRetakeAll = () => {
    photos.forEach(p => URL.revokeObjectURL(p.blobUrl))
    if (stripUrl) URL.revokeObjectURL(stripUrl)
    setPhotos([])
    setStripBlob(null)
    setStripUrl(null)
    setApiError(null)
    setCountdown(countdownDuration)
    setStep('countdown')
  }

  const handleSendEmail = async () => {
    if (!shareToken || !emailInput.trim()) return
    setEmailStatus('sending')
    try {
      await sendEmail(shareToken, emailInput.trim())
      setEmailStatus('sent')
    } catch { setEmailStatus('error') }
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
    if (stripUrl) URL.revokeObjectURL(stripUrl)
    sessionTokenRef.current = null
    setStep('welcome')
    setEventInfo(null)
    setTemplate(null)
    setGuestName('')
    setPhotos([])
    setCurrentBlob(null)
    setCountdown(3)
    setCountdownDuration(3)
    setSelectedFilter('normal')
    setStripLayout('strip')
    setShareToken(null)
    setQrUrl(null)
    setApiError(null)
    setEmailInput('')
    setEmailStatus('idle')
    setStripBlob(null)
    setStripUrl(null)
    setKioskCountdown(KIOSK_DURATION)
  }

  const activeCss = FILTERS.find(f => f.id === selectedFilter)?.css ?? 'none'

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === 'loading' || step === 'composing') {
    return (
      <Screen>
        <Center>
          <Spinner size="lg" />
          {step === 'composing' && (
            <p className="text-gray-400 text-lg mt-8 animate-pulse">Membuat strip foto...</p>
          )}
        </Center>
      </Screen>
    )
  }

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
            <button onClick={() => void handleStart()} className={BTN_PRIMARY}>Mulai</button>
            {apiError && <p className="text-red-400 text-sm mt-5">{apiError}</p>}
          </div>
        </Center>
      </Screen>
    )
  }

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

  // ── Filter select (FEATURE 3) ─────────────────────────────────────────────
  if (step === 'filter-select') {
    return (
      <Screen className="relative overflow-hidden">
        {/* Live camera with selected filter */}
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover transition-all"
          style={{ filter: activeCss }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Template overlay preview */}
        {template?.overlay_url && (
          <img
            src={template.overlay_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
          />
        )}

        {/* Gradient overlay so buttons are readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Filter picker + button */}
        <div className="absolute bottom-0 inset-x-0 z-20 px-5 pb-8 pt-4">
          <p className="text-center text-xs text-white/60 uppercase tracking-widest mb-4">
            Pilih Filter
          </p>

          <div className="grid grid-cols-4 gap-3 mb-6">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all text-sm font-semibold ${
                  selectedFilter === f.id
                    ? 'bg-white text-black scale-105 shadow-lg'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <span className="text-2xl leading-none">{f.emoji}</span>
                <span className="text-xs">{f.label}</span>
              </button>
            ))}
          </div>

          <button onClick={handleFilterNext} className={BTN_PRIMARY}>
            Mulai Foto →
          </button>
        </div>
      </Screen>
    )
  }

  if (step === 'countdown') {
    return (
      <Screen className="relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: activeCss }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {template?.overlay_url && (
          <img
            src={template.overlay_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
          />
        )}

        <div className="absolute inset-0 bg-black/20" />

        <div className="absolute top-8 inset-x-0 flex justify-center z-20">
          <ProgressDots total={maxPhotos} done={photos.length} />
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
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

        <div className="absolute bottom-8 inset-x-0 text-center z-20">
          <p className="text-white/50 text-sm tracking-widest uppercase">
            Foto {photos.length + 1} dari {maxPhotos}
          </p>
        </div>
      </Screen>
    )
  }

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
              onClick={() => { setCountdown(countdownDuration); setStep('countdown') }}
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

  if (step === 'review') {
    return (
      <Screen>
        <div className="flex-1 relative bg-gray-950 overflow-hidden">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Foto preview"
              className="w-full h-full object-cover"
              style={{ filter: activeCss }}
            />
          ) : (
            <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
          )}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-full px-5 py-2">
            <p className="text-white text-sm tracking-wide">
              Foto {photos.length + 1} dari {maxPhotos}
            </p>
          </div>
        </div>
        <div className="shrink-0 px-6 py-6 flex flex-col gap-3 bg-black">
          <button onClick={handleKeepPhoto} className={BTN_PRIMARY}>
            {photos.length + 1 < maxPhotos ? 'Simpan & Lanjut →' : 'Buat Strip ✓'}
          </button>
          <button onClick={handleRetake} className={BTN_SECONDARY}>↩ Foto Ulang</button>
        </div>
      </Screen>
    )
  }

  if (step === 'strip-preview') {
    return (
      <Screen>
        <div className="shrink-0 px-6 pt-8 pb-3 text-center">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">SnapBooth</p>
          <h2 className="text-2xl font-bold">Strip Foto Kamu</h2>
          <p className="text-gray-500 text-sm mt-1">
            {stripLayout === 'grid' ? '2×2 grid' : `${maxPhotos} foto strip`}  ·  filter {FILTERS.find(f => f.id === selectedFilter)?.label}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto flex justify-center px-6 py-4">
          {stripUrl ? (
            <img src={stripUrl} alt="Photo strip" className="max-w-[260px] w-full rounded-2xl shadow-2xl" />
          ) : (
            <div className="flex items-center justify-center flex-1"><Spinner size="lg" /></div>
          )}
        </div>

        <div className="shrink-0 px-6 py-6 bg-black flex flex-col gap-3">
          {apiError && <p className="text-red-400 text-sm text-center">{apiError}</p>}
          <button onClick={() => void doUpload()} className={BTN_PRIMARY}>Simpan & Bagikan →</button>
          <button onClick={handleRetakeAll} className={BTN_SECONDARY}>↩ Ulangi Semua Foto</button>
        </div>
      </Screen>
    )
  }

  if (step === 'uploading') {
    return (
      <Screen>
        <Center>
          <div className="text-center">
            <Spinner size="lg" />
            <p className="text-xl font-semibold mt-8 mb-2">Menyimpan strip foto...</p>
            <p className="text-gray-500 text-sm">Mohon tunggu sebentar</p>
          </div>
        </Center>
      </Screen>
    )
  }

  if (step === 'done') {
    return (
      <Screen>
        <div className="flex-1 overflow-y-auto">
          <Center>
            <div className="text-center w-full max-w-xs py-8">
              <p className="text-5xl mb-4">🎉</p>
              <h2 className="text-3xl font-bold mb-1">Foto siap!</h2>
              <p className="text-gray-500 text-sm mb-8">
                Scan QR code untuk menyimpan strip fotomu
              </p>

              <div className="flex justify-center mb-8">
                {qrUrl ? (
                  <div className="bg-white p-5 rounded-3xl shadow-2xl">
                    <img src={qrUrl} alt="QR Code" className="w-52 h-52 object-contain" />
                  </div>
                ) : (
                  <div className="w-64 h-64 bg-gray-900 rounded-3xl flex items-center justify-center">
                    <Spinner />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 mb-6">
                <button onClick={() => navigate(`/share/${shareToken}`)} className={BTN_PRIMARY}>
                  Lihat Galeri
                </button>
                <button onClick={() => void handleWhatsApp()} className={BTN_SECONDARY}>
                  WhatsApp
                </button>
              </div>

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

              {/* Kiosk auto-restart (FEATURE 2) */}
              {kioskMode ? (
                <div className="mt-8 text-center">
                  <p className="text-gray-500 text-sm mb-2">
                    Sesi baru dalam <span className="text-white font-bold">{kioskCountdown}</span> detik
                  </p>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-full mb-4">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-1000"
                      style={{ width: `${(kioskCountdown / KIOSK_DURATION) * 100}%` }}
                    />
                  </div>
                  <button onClick={handleRestart} className="text-sm text-white/60 hover:text-white transition-colors">
                    Mulai Sekarang →
                  </button>
                </div>
              ) : (
                <button onClick={handleRestart} className="mt-8 text-gray-600 text-sm hover:text-gray-400 transition-colors py-2">
                  ↩ Mulai Lagi
                </button>
              )}
            </div>
          </Center>
        </div>
      </Screen>
    )
  }

  return <Screen><Center><Spinner size="lg" /></Center></Screen>
}
