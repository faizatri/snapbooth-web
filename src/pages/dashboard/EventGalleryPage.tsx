import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getEvent,
  getEventSessions,
  type Event,
  type EventSession,
  type SessionPhoto,
} from '../../api/events'
import { getDownloadUrl } from '../../api/share'
import echo from '../../lib/echo'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlatPhoto {
  photoId: number
  url: string
  thumbnailUrl?: string
  guestName: string | null
  sessionDate: string
  shareToken: string
}

type ZipState =
  | { status: 'idle' }
  | { status: 'building'; done: number; total: number }
  | { status: 'error'; message: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s =
    size === 'sm' ? 'w-3.5 h-3.5 border' :
    size === 'lg' ? 'w-10 h-10 border-2' :
    'w-8 h-8 border-2'
  return <div className={`${s} border-white border-t-transparent rounded-full animate-spin`} />
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function EventGalleryPage() {
  const { id } = useParams<{ id: string }>()

  const [event, setEvent] = useState<Event | null>(null)
  const [sessions, setSessions] = useState<EventSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState('')
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [downloading, setDownloading] = useState<number | null>(null)
  const [zipState, setZipState] = useState<ZipState>({ status: 'idle' })
  const [visibleCount, setVisibleCount] = useState(5)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [ev, sess] = await Promise.all([
        getEvent(Number(id)),
        getEventSessions(Number(id)),
      ])
      setEvent(ev)
      setSessions(sess)
    } catch {
      setError('Gagal memuat data galeri.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  // ── Pusher real-time subscription ─────────────────────────────────────────

  useEffect(() => {
    if (!id || loading) return

    const channel = echo.private(`event.${id}`)

    channel.listen('.photo.uploaded', (data: {
      photo_id: number
      session_id: number
      processed_url: string
      thumbnail_url: string | null
      shot_number: number
    }) => {
      setSessions(prev => prev.map(s => {
        if (s.id !== data.session_id) return s
        if (s.photos.some(p => p.id === data.photo_id)) return s
        return {
          ...s,
          photos: [...s.photos, {
            id: data.photo_id,
            url: data.processed_url,
            thumbnail_url: data.thumbnail_url ?? undefined,
          }],
        }
      }))
    })

    channel.listen('.session.completed', () => {
      void load()
    })

    return () => { echo.leave(`event.${id}`) }
  }, [id, loading, load])

  // ── Infinite scroll sentinel ───────────────────────────────────────────────

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setVisibleCount(n => n + 5) },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loading])

  // Reset visible count dan tutup lightbox saat filter berubah
  useEffect(() => {
    setVisibleCount(5)
    setLightboxIdx(null)
  }, [dateFilter])

  // ── Derived data ───────────────────────────────────────────────────────────

  const uniqueDates = useMemo(
    () => [...new Set(sessions.map(s => s.created_at.slice(0, 10)))].sort().reverse(),
    [sessions]
  )

  const filteredSessions = useMemo(
    () => dateFilter
      ? sessions.filter(s => s.created_at.slice(0, 10) === dateFilter)
      : sessions,
    [sessions, dateFilter]
  )

  const flatPhotos = useMemo<FlatPhoto[]>(
    () => filteredSessions.flatMap(session =>
      session.photos.map(photo => ({
        photoId: photo.id,
        url: photo.url,
        thumbnailUrl: photo.thumbnail_url,
        guestName: session.guest_name,
        sessionDate: session.created_at,
        shareToken: session.share_token,
      }))
    ),
    [filteredSessions]
  )

  // Map untuk O(1) lookup di SessionSection (menggantikan O(n) find per foto)
  const flatPhotoMap = useMemo(
    () => new Map(flatPhotos.map(p => [p.photoId, p])),
    [flatPhotos]
  )

  const totalPhotos = flatPhotos.length
  const totalSessions = filteredSessions.length

  // ── Lightbox keyboard navigation ───────────────────────────────────────────

  useEffect(() => {
    if (lightboxIdx === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')
        setLightboxIdx(i => i !== null ? Math.max(0, i - 1) : null)
      if (e.key === 'ArrowRight')
        setLightboxIdx(i => i !== null ? Math.min(flatPhotos.length - 1, i + 1) : null)
      if (e.key === 'Escape')
        setLightboxIdx(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxIdx, flatPhotos.length])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDownload = async (photoId: number) => {
    setDownloading(photoId)
    try {
      const url = await getDownloadUrl(photoId)
      const a = document.createElement('a')
      a.href = url
      a.download = `photo_${photoId}.jpg`
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      setDownloading(null)
    }
  }

  const handleExportZip = async () => {
    if (flatPhotos.length === 0 || zipState.status === 'building') return
    const total = flatPhotos.length
    setZipState({ status: 'building', done: 0, total })
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      let done = 0
      for (const photo of flatPhotos) {
        const signedUrl = await getDownloadUrl(photo.photoId)
        const resp = await fetch(signedUrl)
        const blob = await resp.blob()
        const ext = blob.type.includes('png') ? 'png' : 'jpg'
        zip.file(`photo_${photo.photoId}.${ext}`, blob)
        done++
        setZipState({ status: 'building', done, total })
      }
      const content = await zip.generateAsync({ type: 'blob' })
      const objectUrl = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `event_${id}_photos.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100)
      setZipState({ status: 'idle' })
    } catch {
      setZipState({
        status: 'error',
        message: 'Ekspor gagal. Pastikan CORS R2 diizinkan untuk origin frontend.',
      })
      setTimeout(() => setZipState({ status: 'idle' }), 5000)
    }
  }

  const openLightbox = (photo: FlatPhoto) => {
    const idx = flatPhotos.findIndex(p => p.photoId === photo.photoId)
    if (idx !== -1) setLightboxIdx(idx)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const visibleSessions = filteredSessions.slice(0, visibleCount)
  const hasMore = visibleCount < filteredSessions.length
  const lightboxPhoto = lightboxIdx !== null ? flatPhotos[lightboxIdx] : null

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-1">
        <Link to="/dashboard/events" className="text-gray-500 hover:text-gray-300 transition-colors">
          Events
        </Link>
        <span className="text-gray-700">/</span>
        {event ? (
          <>
            <span className="text-gray-500 truncate max-w-[180px]">{event.name}</span>
            <span className="text-gray-700">/</span>
          </>
        ) : null}
        <span className="text-gray-300">Galeri</span>
      </nav>

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Galeri Sesi</h1>

        {!loading && !error && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date filter */}
            {uniqueDates.length > 1 && (
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="bg-gray-800 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/20 transition"
              >
                <option value="">Semua Tanggal</option>
                {uniqueDates.map(d => (
                  <option key={d} value={d}>{formatDateLabel(d)}</option>
                ))}
              </select>
            )}

            {/* Export ZIP */}
            <button
              onClick={() => void handleExportZip()}
              disabled={zipState.status === 'building' || totalPhotos === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {zipState.status === 'building' ? (
                <>
                  <Spinner size="sm" />
                  <span>{zipState.done} / {zipState.total}</span>
                </>
              ) : (
                <span>Ekspor ZIP</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ZIP error */}
      {zipState.status === 'error' && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {zipState.message}
        </div>
      )}

      {/* States */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-center py-24 text-gray-600">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="font-semibold text-gray-400 mb-1">{error}</p>
          <p className="text-sm mb-2">
            Pastikan endpoint{' '}
            <code className="text-gray-500 font-mono">GET /events/{'{id}'}/sessions</code>{' '}
            sudah ada di backend.
          </p>
          <button
            onClick={() => void load()}
            className="mt-4 px-5 py-2 rounded-xl border border-gray-700 text-sm hover:border-gray-500 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="flex items-center gap-6 mb-6 px-5 py-3 bg-gray-900 rounded-2xl border border-gray-800 text-sm">
            <span className="text-gray-400">
              <span className="text-white font-semibold">{totalPhotos}</span>
              {' '}foto
            </span>
            <div className="w-px h-4 bg-gray-800" />
            <span className="text-gray-400">
              <span className="text-white font-semibold">{totalSessions}</span>
              {' '}sesi
            </span>
            {dateFilter && (
              <>
                <div className="w-px h-4 bg-gray-800" />
                <button
                  onClick={() => setDateFilter('')}
                  className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
                >
                  Hapus filter ×
                </button>
              </>
            )}
          </div>

          {/* Empty state */}
          {filteredSessions.length === 0 ? (
            <div className="text-center py-24 text-gray-600">
              <p className="text-4xl mb-3">📷</p>
              <p className="text-lg font-semibold mb-1">
                {dateFilter ? 'Tidak ada sesi pada tanggal ini' : 'Belum ada sesi'}
              </p>
              <p className="text-sm">
                {dateFilter
                  ? 'Coba pilih tanggal lain atau hapus filter.'
                  : 'Sesi akan muncul setelah tamu menggunakan booth.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {visibleSessions.map(session => (
                <SessionSection
                  key={session.id}
                  session={session}
                  flatPhotoMap={flatPhotoMap}
                  onPhotoClick={openLightbox}
                />
              ))}

              {/* Infinite scroll sentinel */}
              {hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-6">
                  <Spinner />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightboxPhoto && lightboxIdx !== null && (
        <Lightbox
          photo={lightboxPhoto}
          index={lightboxIdx}
          total={flatPhotos.length}
          isDownloading={downloading === lightboxPhoto.photoId}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx(i => (i !== null ? Math.max(0, i - 1) : null))}
          onNext={() => setLightboxIdx(i => (i !== null ? Math.min(flatPhotos.length - 1, i + 1) : null))}
          onDownload={() => void handleDownload(lightboxPhoto.photoId)}
        />
      )}
    </div>
  )
}

// ─── SessionSection ────────────────────────────────────────────────────────────

function SessionSection({
  session,
  flatPhotoMap,
  onPhotoClick,
}: {
  session: EventSession
  flatPhotoMap: Map<number, FlatPhoto>
  onPhotoClick: (photo: FlatPhoto) => void
}) {
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-white">
            {session.guest_name ?? (
              <span className="text-gray-500 font-normal italic">Tamu anonim</span>
            )}
          </p>
          <p className="text-gray-500 text-xs mt-0.5">{formatDateTime(session.created_at)}</p>
        </div>
        <a
          href={`/share/${session.share_token}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors shrink-0"
        >
          Halaman tamu ↗
        </a>
      </div>

      {session.photos.length === 0 ? (
        <p className="text-gray-600 text-sm py-2">Tidak ada foto dalam sesi ini.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {session.photos.map((photo, i) => {
            const flat = flatPhotoMap.get(photo.id)
            return (
              <PhotoThumb
                key={photo.id}
                photo={photo}
                index={i}
                onClick={() => flat && onPhotoClick(flat)}
              />
            )
          })}
        </div>
      )}

      <div className="border-b border-gray-800/60 mt-6" />
    </div>
  )
}

// ─── PhotoThumb ────────────────────────────────────────────────────────────────

function PhotoThumb({
  photo,
  index,
  onClick,
}: {
  photo: SessionPhoto
  index: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="relative group aspect-square rounded-xl overflow-hidden bg-gray-800 focus:outline-none focus:ring-2 focus:ring-white/40"
    >
      <img
        src={photo.thumbnail_url ?? photo.url}
        alt={`Foto ${index + 1}`}
        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
        <span className="text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          ⤢
        </span>
      </div>
    </button>
  )
}

// ─── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({
  photo,
  index,
  total,
  isDownloading,
  onClose,
  onPrev,
  onNext,
  onDownload,
}: {
  photo: FlatPhoto
  index: number
  total: number
  isDownloading: boolean
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  onDownload: () => void
}) {
  const hasPrev = index > 0
  const hasNext = index < total - 1

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          aria-label="Tutup"
        >
          ×
        </button>
        <span className="text-gray-400 text-sm">
          {index + 1} / {total}
        </span>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center px-4 py-4 min-h-0 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Prev arrow */}
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-colors z-10 text-white text-xl"
          aria-label="Foto sebelumnya"
        >
          ←
        </button>

        <img
          src={photo.url}
          alt="Foto lengkap"
          className="max-w-full max-h-full object-contain rounded-lg"
          style={{ maxHeight: 'calc(100vh - 10rem)' }}
        />

        {/* Next arrow */}
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-colors z-10 text-white text-xl"
          aria-label="Foto berikutnya"
        >
          →
        </button>
      </div>

      {/* Bottom bar */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-4 border-t border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <p className="text-white text-sm font-medium">
            {photo.guestName ?? <span className="text-gray-500 italic font-normal">Tamu anonim</span>}
          </p>
          <p className="text-gray-500 text-xs mt-0.5">
            {formatDateTime(photo.sessionDate)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`/share/${photo.shareToken}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
          >
            Halaman tamu ↗
          </a>
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-bold hover:bg-gray-100 disabled:opacity-60 active:scale-95 transition-all"
          >
            {isDownloading ? (
              <>
                <div className="w-3.5 h-3.5 border border-black border-t-transparent rounded-full animate-spin" />
                <span>Mengunduh...</span>
              </>
            ) : (
              <span>↓ Unduh Foto</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
