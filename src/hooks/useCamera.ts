import { useRef, useState, useCallback, useEffect, type RefObject } from 'react'

export interface UseCameraReturn {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  isReady: boolean
  error: string | null
  startCamera: () => Promise<void>
  stopCamera: () => void
  captureAsync: () => Promise<Blob | null>
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = { current: null as MediaStream | null }
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async () => {
    setError(null)
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('Kamera tidak didukung. Buka halaman via HTTPS atau gunakan localhost.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setIsReady(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kamera tidak dapat diakses')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setIsReady(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const captureAsync = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(video, 0, 0)
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  return { videoRef, canvasRef, isReady, error, startCamera, stopCamera, captureAsync }
}
