import { useState, useCallback, useRef } from 'react'
import * as boothApi from '../api/booth'

export interface CapturedPhoto {
  localUrl: string
  blob: Blob
  uploading: boolean
  uploaded: boolean
  photoId?: number
  error?: string
}

type Phase = 'idle' | 'starting' | 'capturing' | 'completing'

interface BoothSessionState {
  phase: Phase
  photos: CapturedPhoto[]
  error: string | null
}

export interface UseBoothSessionReturn extends BoothSessionState {
  startSession: (eventCode: string) => Promise<void>
  addPhoto: (blob: Blob) => Promise<void>
  removePhoto: (index: number) => void
  completeSession: () => Promise<string>
}

export function useBoothSession(): UseBoothSessionReturn {
  const [phase, setPhase] = useState<Phase>('idle')
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [error, setError] = useState<string | null>(null)
  const sessionTokenRef = useRef<string | null>(null)

  const startSession = useCallback(async (eventCode: string) => {
    setPhase('starting')
    setError(null)
    try {
      const result = await boothApi.startSession(eventCode)
      sessionTokenRef.current = result.session_token
      setPhase('capturing')
    } catch {
      setPhase('idle')
      setError('Gagal memulai sesi. Periksa kode event dan coba lagi.')
    }
  }, [])

  const addPhoto = useCallback(async (blob: Blob) => {
    const localUrl = URL.createObjectURL(blob)
    setPhotos(prev => [...prev, { localUrl, blob, uploading: true, uploaded: false }])

    const token = sessionTokenRef.current
    if (!token) {
      setPhotos(prev => prev.filter(p => p.localUrl !== localUrl))
      return
    }

    try {
      const photo = await boothApi.uploadPhoto(token, blob)
      setPhotos(prev =>
        prev.map(p =>
          p.localUrl === localUrl
            ? { ...p, uploading: false, uploaded: true, photoId: photo.id }
            : p
        )
      )
    } catch {
      setPhotos(prev =>
        prev.map(p =>
          p.localUrl === localUrl ? { ...p, uploading: false, error: 'Gagal upload' } : p
        )
      )
    }
  }, [])

  const removePhoto = useCallback((index: number) => {
    setPhotos(prev => {
      const photo = prev[index]
      if (photo) URL.revokeObjectURL(photo.localUrl)
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const completeSession = useCallback(async (): Promise<string> => {
    const token = sessionTokenRef.current
    if (!token) throw new Error('No active session')
    setPhase('completing')
    setError(null)
    try {
      const uploadedIds = photos.filter(p => p.photoId).map(p => p.photoId as number)
      const result = await boothApi.completeSession(token, { selected_photo_ids: uploadedIds })
      return result.share_token
    } catch (err) {
      setPhase('capturing')
      setError('Gagal menyelesaikan sesi. Coba lagi.')
      throw err
    }
  }, [photos])

  return { phase, photos, error, startSession, addPhoto, removePhoto, completeSession }
}
