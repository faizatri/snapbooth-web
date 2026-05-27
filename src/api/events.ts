import api from './axios'

export interface Event {
  id: number
  name: string
  slug: string
  date: string | null
  is_active: boolean
  max_photos: number
  location?: string | null
  countdown_seconds?: number
  filter?: string | null
  template_id?: number | null
  sessions_count?: number
  photos_count?: number
  created_at: string
}

export interface EventPayload {
  name: string
  slug: string
  date?: string
  max_photos?: number
  location?: string
  countdown_seconds?: number
  filter?: string
  template_id?: number | null
}

export interface SessionPhoto {
  id: number
  url: string
  thumbnail_url?: string
}

export interface EventSession {
  id: number
  share_token: string
  guest_name: string | null
  created_at: string
  photos: SessionPhoto[]
}

export const listEvents = async (): Promise<Event[]> => {
  const { data } = await api.get('/events')
  return (Array.isArray(data.data) ? data.data : data.data.data) as Event[]
}

export const createEvent = async (payload: EventPayload): Promise<Event> => {
  const { data } = await api.post('/events', payload)
  return data.data as Event
}

export const updateEvent = async (id: number, payload: EventPayload): Promise<Event> => {
  const { data } = await api.put(`/events/${id}`, payload)
  return data.data as Event
}

export const deleteEvent = async (id: number): Promise<void> => {
  await api.delete(`/events/${id}`)
}

export const toggleEventActive = async (id: number): Promise<Event> => {
  const { data } = await api.patch(`/events/${id}/toggle-active`)
  return data.data as Event
}

export const getEvent = async (id: number): Promise<Event> => {
  const { data } = await api.get(`/events/${id}`)
  return data.data as Event
}

export const getEventSessions = async (id: number): Promise<EventSession[]> => {
  const { data } = await api.get(`/events/${id}/sessions`)
  return data.data as EventSession[]
}
