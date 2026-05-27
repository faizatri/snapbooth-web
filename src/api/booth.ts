import api from './axios'

export interface EventInfo {
  id: number
  name: string
  slug: string
  max_photos: number
  countdown_seconds?: number
}

export interface TemplateInfo {
  overlay_url?: string | null
  background_color?: string | null
  layout?: string | null
}

export interface Photo {
  id: number
  processed_url: string
  thumbnail_url?: string
}

export interface SessionData {
  share_token: string
  photos: Photo[]
  event?: { name: string; slug: string }
  guest_name?: string
  created_at?: string
  favorite_photo_id?: number
}

export interface StartSessionResult {
  session_token: string
  event: EventInfo
  template?: TemplateInfo | null
}

interface CompleteOptions {
  selected_photo_ids: number[]
  guest_name?: string
}

export const startSession = async (eventSlug: string): Promise<StartSessionResult> => {
  const { data } = await api.post('/booth/start-session', { event_slug: eventSlug })
  return data.data as StartSessionResult
}

export const uploadPhoto = async (sessionToken: string, blob: Blob): Promise<Photo> => {
  const form = new FormData()
  form.append('session_token', sessionToken)
  form.append('photo', blob, `photo_${Date.now()}.jpg`)
  const { data } = await api.post('/booth/upload-photo', form)
  return data.data as Photo
}

export const completeSession = async (
  sessionToken: string,
  options: CompleteOptions
): Promise<{ share_token: string }> => {
  const { data } = await api.post('/booth/complete-session', {
    session_token: sessionToken,
    ...options,
  })
  return data.data as { share_token: string }
}

export const getSession = async (shareToken: string): Promise<SessionData> => {
  const { data } = await api.get(`/booth/session/${shareToken}`)
  return data.data as SessionData
}
