import { useState, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  toggleEventActive,
  type Event,
  type EventPayload,
} from '../../api/events'
import { listTemplates, type Template } from '../../api/templates'

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: 'none', label: 'Tanpa Filter' },
  { value: 'grayscale', label: 'Hitam Putih' },
  { value: 'warm', label: 'Hangat' },
  { value: 'cool', label: 'Dingin' },
  { value: 'vintage', label: 'Vintage' },
]

const COUNTDOWN_OPTIONS = [
  { value: '3', label: '3 detik' },
  { value: '5', label: '5 detik' },
  { value: '10', label: '10 detik' },
]

const INPUT = 'w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition'
const SELECT = 'w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition'

interface FormState {
  name: string
  slug: string
  date: string
  location: string
  max_photos: string
  countdown_seconds: string
  filter: string
  template_id: string
}

const DEFAULT_FORM: FormState = {
  name: '',
  slug: '',
  date: '',
  location: '',
  max_photos: '1',
  countdown_seconds: '3',
  filter: 'none',
  template_id: '',
}

interface ModalState {
  mode: 'create' | 'edit'
  event?: Event
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5 border' : 'w-8 h-8 border-2'
  return <div className={`${s} border-white border-t-transparent rounded-full animate-spin`} />
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-gray-500 text-xs uppercase tracking-widest">{label}</label>
      {children}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => { void load() }, [])

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [evs, tmps] = await Promise.all([listEvents(), listTemplates()])
      setEvents(evs)
      setTemplates(tmps)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setForm(DEFAULT_FORM)
    setFormError(null)
    setModal({ mode: 'create' })
  }

  const openEdit = (ev: Event) => {
    setForm({
      name: ev.name,
      slug: ev.slug,
      date: ev.date ?? '',
      location: ev.location ?? '',
      max_photos: String(ev.max_photos),
      countdown_seconds: String(ev.countdown_seconds ?? 3),
      filter: ev.filter ?? 'none',
      template_id: ev.template_id ? String(ev.template_id) : '',
    })
    setFormError(null)
    setModal({ mode: 'edit', event: ev })
  }

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      slug: modal?.mode === 'create' ? toSlug(name) : prev.slug,
    }))
  }

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    const payload: EventPayload = {
      name: form.name,
      slug: form.slug,
      date: form.date || undefined,
      location: form.location || undefined,
      max_photos: parseInt(form.max_photos, 10) || 1,
      countdown_seconds: parseInt(form.countdown_seconds, 10) || 3,
      filter: form.filter !== 'none' ? form.filter : undefined,
      template_id: form.template_id ? parseInt(form.template_id, 10) : null,
    }
    try {
      if (modal?.mode === 'create') {
        const created = await createEvent(payload)
        setEvents(prev => [created, ...prev])
      } else if (modal?.event) {
        const updated = await updateEvent(modal.event.id, payload)
        setEvents(prev => prev.map(e => (e.id === updated.id ? updated : e)))
      }
      setModal(null)
    } catch {
      setFormError('Gagal menyimpan. Periksa data dan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (ev: Event) => {
    setTogglingId(ev.id)
    try {
      const updated = await toggleEventActive(ev.id)
      setEvents(prev => prev.map(e => (e.id === updated.id ? updated : e)))
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (ev: Event) => {
    if (
      !confirm(`Hapus event "${ev.name}"?\n\nSemua sesi dan foto akan terhapus permanen dan tidak bisa dikembalikan.`)
    ) return
    setDeletingId(ev.id)
    try {
      await deleteEvent(ev.id)
      setEvents(prev => prev.filter(e => e.id !== ev.id))
    } finally {
      setDeletingId(null)
    }
  }

  const handleCopyLink = async (ev: Event) => {
    const url = `${window.location.origin}/booth/${ev.slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(ev.id)
      const evId = ev.id
      setTimeout(() => setCopiedId(prev => (prev === evId ? null : prev)), 1500)
    } catch { /* clipboard API unavailable */ }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Events</h1>
        <button
          onClick={openCreate}
          className="bg-white text-black text-sm font-bold px-4 py-2 rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
        >
          + Buat Event
        </button>
      </div>

      {/* States */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : loadError ? (
        <div className="text-center py-24 text-gray-500">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="font-semibold mb-1">Gagal memuat data event</p>
          <p className="text-sm text-gray-600 mb-6">Periksa koneksi atau coba lagi.</p>
          <button
            onClick={() => void load()}
            className="px-5 py-2 rounded-xl border border-gray-700 text-sm hover:border-gray-500 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-24 text-gray-600">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-lg font-semibold mb-1">Belum ada event</p>
          <p className="text-sm">Buat event pertamamu untuk mulai foto booth.</p>
        </div>
      ) : (
        /* Table */
        <div className="overflow-x-auto rounded-2xl border border-gray-800">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-gray-500 font-medium">
                  Nama
                </th>
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-gray-500 font-medium">
                  Tanggal
                </th>
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-gray-500 font-medium">
                  Status
                </th>
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-gray-500 font-medium">
                  Statistik
                </th>
                <th className="px-5 py-3 text-xs uppercase tracking-widest text-gray-500 font-medium text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {events.map(ev => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  isCopied={copiedId === ev.id}
                  isToggling={togglingId === ev.id}
                  isDeleting={deletingId === ev.id}
                  onCopy={() => void handleCopyLink(ev)}
                  onEdit={() => openEdit(ev)}
                  onToggle={() => void handleToggle(ev)}
                  onDelete={() => void handleDelete(ev)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-800 flex flex-col max-h-full">
            {/* Modal header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-800 shrink-0">
              <h2 className="text-lg font-bold">
                {modal.mode === 'create' ? 'Buat Event Baru' : 'Edit Event'}
              </h2>
            </div>

            {/* Scrollable body */}
            <form
              id="event-form"
              onSubmit={(e) => void handleSubmit(e)}
              className="overflow-y-auto px-6 py-5 flex flex-col gap-5"
            >
              {/* Seksi 1: Informasi Event */}
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Informasi Event
                </p>
                <Field label="Nama Event">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={form.name}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="Pernikahan Rani & Doni"
                    className={INPUT}
                  />
                </Field>
                <Field label="Slug (URL Booth)">
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="rani-doni-2025"
                    className={INPUT}
                  />
                  <p className="text-gray-600 text-xs">
                    URL booth:{' '}
                    <span className="text-gray-400 font-mono">
                      /booth/{form.slug || '...'}
                    </span>
                  </p>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tanggal">
                    <input
                      type="date"
                      value={form.date}
                      onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                      className={INPUT}
                    />
                  </Field>
                  <Field label="Lokasi">
                    <input
                      type="text"
                      value={form.location}
                      onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Ballroom Hotel XYZ"
                      className={INPUT}
                    />
                  </Field>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-800" />

              {/* Seksi 2: Konfigurasi Booth */}
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Konfigurasi Booth
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Countdown">
                    <select
                      value={form.countdown_seconds}
                      onChange={e => setForm(prev => ({ ...prev, countdown_seconds: e.target.value }))}
                      className={SELECT}
                    >
                      {COUNTDOWN_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Maks. Foto / Sesi">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      required
                      value={form.max_photos}
                      onChange={e => setForm(prev => ({ ...prev, max_photos: e.target.value }))}
                      className={INPUT}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Filter Foto">
                    <select
                      value={form.filter}
                      onChange={e => setForm(prev => ({ ...prev, filter: e.target.value }))}
                      className={SELECT}
                    >
                      {FILTER_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Template">
                    <select
                      value={form.template_id}
                      onChange={e => setForm(prev => ({ ...prev, template_id: e.target.value }))}
                      className={SELECT}
                    >
                      <option value="">— Tanpa template —</option>
                      {templates.map(t => (
                        <option key={t.id} value={String(t.id)}>{t.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              {formError && (
                <p className="text-red-400 text-sm">{formError}</p>
              )}
            </form>

            {/* Modal footer */}
            <div className="px-6 pb-6 pt-4 border-t border-gray-800 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-300 hover:border-gray-500 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                form="event-form"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-white text-black font-bold text-sm disabled:opacity-50 hover:bg-gray-100 active:scale-95 transition-all"
              >
                {submitting ? 'Menyimpan...' : modal.mode === 'create' ? 'Buat Event' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Table row component ───────────────────────────────────────────────────────

function EventRow({
  event,
  isCopied,
  isToggling,
  isDeleting,
  onCopy,
  onEdit,
  onToggle,
  onDelete,
}: {
  event: Event
  isCopied: boolean
  isToggling: boolean
  isDeleting: boolean
  onCopy: () => void
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <tr className="bg-gray-900 hover:bg-gray-800/50 transition-colors">
      {/* Nama */}
      <td className="px-5 py-4">
        <p className="font-medium text-white leading-snug">{event.name}</p>
        <p className="text-gray-500 text-xs font-mono mt-0.5">{event.slug}</p>
        {event.location && (
          <p className="text-gray-600 text-xs mt-0.5">{event.location}</p>
        )}
      </td>

      {/* Tanggal */}
      <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
        {formatDate(event.date)}
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <span
          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
            event.is_active
              ? 'bg-green-500/15 text-green-400'
              : 'bg-gray-700/60 text-gray-500'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              event.is_active ? 'bg-green-400' : 'bg-gray-500'
            }`}
          />
          {event.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>

      {/* Statistik */}
      <td className="px-5 py-4">
        {event.sessions_count !== undefined || event.photos_count !== undefined ? (
          <div className="flex flex-col gap-0.5 text-xs text-gray-400">
            {event.sessions_count !== undefined && (
              <span>{event.sessions_count} sesi</span>
            )}
            {event.photos_count !== undefined && (
              <span>{event.photos_count} foto</span>
            )}
          </div>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>

      {/* Aksi */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5 justify-end flex-wrap">
          <Link
            to={`/dashboard/events/${event.id}/gallery`}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            Galeri
          </Link>

          <button
            onClick={onCopy}
            className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap ${
              isCopied
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {isCopied ? '✓ Tersalin' : 'Salin Link'}
          </button>

          <button
            onClick={onEdit}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Edit
          </button>

          <button
            onClick={onToggle}
            disabled={isToggling}
            className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 disabled:opacity-60 ${
              event.is_active
                ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
            }`}
          >
            {isToggling ? (
              <><Spinner size="sm" /><span>...</span></>
            ) : event.is_active ? (
              'Nonaktifkan'
            ) : (
              'Aktifkan'
            )}
          </button>

          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            {isDeleting ? (
              <><Spinner size="sm" /><span>...</span></>
            ) : (
              'Hapus'
            )}
          </button>
        </div>
      </td>
    </tr>
  )
}
