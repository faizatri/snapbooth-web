import { useState, useEffect, useRef, type FormEvent } from 'react'
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type Template,
} from '../../api/templates'

const INPUT = 'w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition'

function Spinner() {
  return <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
}

interface ModalState {
  mode: 'create' | 'edit'
  template?: Template
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void load() }, [])

  const load = async () => {
    setLoading(true)
    try { setTemplates(await listTemplates()) }
    finally { setLoading(false) }
  }

  const openCreate = () => {
    setName('')
    setFile(null)
    setPreview(null)
    setFormError(null)
    setModal({ mode: 'create' })
  }

  const openEdit = (t: Template) => {
    setName(t.name)
    setFile(null)
    setPreview(t.preview_url)
    setFormError(null)
    setModal({ mode: 'edit', template: t })
  }

  const handleFileChange = (f: File | null) => {
    setFile(f)
    if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : modal?.template?.preview_url ?? null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      if (modal?.mode === 'create') {
        const created = await createTemplate(name, file ?? undefined)
        setTemplates(prev => [created, ...prev])
      } else if (modal?.template) {
        const updated = await updateTemplate(modal.template.id, name, file ?? undefined)
        setTemplates(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      }
      setModal(null)
    } catch {
      setFormError('Gagal menyimpan template. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (t: Template) => {
    if (!confirm(`Hapus template "${t.name}"?`)) return
    try {
      await deleteTemplate(t.id)
      setTemplates(prev => prev.filter(x => x.id !== t.id))
    } catch { /* 401 interceptor handles it */ }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Templates</h1>
        <button
          onClick={openCreate}
          className="bg-white text-black text-sm font-bold px-4 py-2 rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
        >
          + Tambah Template
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-4xl mb-3">🖼️</p>
          <p className="text-lg font-semibold mb-1">Belum ada template</p>
          <p className="text-sm">Buat template untuk digunakan di event.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => openEdit(t)}
              onDelete={() => void handleDelete(t)}
            />
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-800">
            <h2 className="text-lg font-bold mb-5">
              {modal.mode === 'create' ? 'Tambah Template' : 'Edit Template'}
            </h2>
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-400 text-xs uppercase tracking-widest">Nama</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Template Wedding"
                  className={INPUT}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-gray-400 text-xs uppercase tracking-widest">
                  Preview {modal.mode === 'edit' && '(opsional — kosongkan untuk tidak mengubah)'}
                </label>
                {preview && (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-800 mb-1">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="py-2.5 rounded-xl border border-dashed border-gray-700 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors"
                >
                  {file ? file.name : 'Pilih gambar...'}
                </button>
              </div>

              {formError && <p className="text-red-400 text-sm">{formError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-300 hover:border-gray-500 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-white text-black font-bold text-sm disabled:opacity-50 hover:bg-gray-100 active:scale-95 transition-all"
                >
                  {submitting ? 'Menyimpan...' : modal.mode === 'create' ? 'Buat' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: Template
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
      <div className="aspect-video bg-gray-800 flex items-center justify-center">
        {template.preview_url ? (
          <img
            src={template.preview_url}
            alt={template.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-4xl">🖼️</span>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-sm truncate mb-2">{template.name}</p>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 text-xs py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 text-xs py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  )
}
