import type { CapturedPhoto } from '../../hooks/useBoothSession'

interface PhotoStripProps {
  photos: CapturedPhoto[]
  onRemove: (index: number) => void
}

export function PhotoStrip({ photos, onRemove }: PhotoStripProps) {
  if (photos.length === 0) return null

  return (
    <div className="px-4 py-3 border-t border-gray-800 bg-black">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo, i) => (
          <div
            key={photo.localUrl}
            className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-800"
          >
            <img
              src={photo.localUrl}
              alt={`Foto ${i + 1}`}
              className="w-full h-full object-cover"
            />

            {photo.uploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {photo.error && (
              <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center">
                <span className="text-white text-lg font-bold">!</span>
              </div>
            )}

            {photo.uploaded && !photo.uploading && (
              <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-xs leading-none">✓</span>
              </div>
            )}

            <button
              onClick={() => onRemove(i)}
              aria-label={`Hapus foto ${i + 1}`}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
