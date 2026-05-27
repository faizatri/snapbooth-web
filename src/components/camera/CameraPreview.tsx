import type { RefObject } from 'react'

interface CameraPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  isReady: boolean
  error: string | null
  isCapturing: boolean
  onCapture: () => void
}

export function CameraPreview({
  videoRef,
  canvasRef,
  isReady,
  error,
  isCapturing,
  onCapture,
}: CameraPreviewProps) {
  return (
    <div className="relative flex-1 bg-gray-900 overflow-hidden min-h-0">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          {error ? (
            <p className="text-red-400 text-center px-8 text-sm">{error}</p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-300 text-sm">Memulai kamera...</p>
            </div>
          )}
        </div>
      )}

      {/* Capture button */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <button
          onClick={onCapture}
          disabled={!isReady || isCapturing}
          aria-label="Ambil foto"
          className="w-20 h-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center"
        >
          <div className="w-14 h-14 rounded-full bg-white" />
        </button>
      </div>
    </div>
  )
}
