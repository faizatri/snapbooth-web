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

// Flatten backend booth_config into Event interface fields
function normalizeEvent(raw: Record<string, unknown>): Event {
  const config = (raw.booth_config as Record<string, unknown> | null) ?? {}
  return {
    id: raw.id as number,
    name: raw.name as string,
    slug: raw.slug as string,
    date: (raw.date as string | null) ?? null,
    location: (raw.location as string | null) ?? null,
    is_active: raw.is_active as boolean,
    max_photos: (config.photos_per_session as number) ?? 1,
    countdown_seconds: (config.countdown as number) ?? 3,
    filter: (config.filter as string | null) ?? null,
    template_id: (config.template_id as number | null) ?? null,
    sessions_count: raw.sessions_count as number | undefined,
    photos_count: raw.photos_count as number | undefined,
    created_at: raw.created_at as string,
  }
}

// Convert flat EventPayload → nested booth_config for backend
function toApiPayload(payload: EventPayload) {
  return {
    name: payload.name,
    date: payload.date,
    location: payload.location,
    booth_config: {
      photos_per_session: payload.max_photos ?? 1,
      countdown: payload.countdown_seconds ?? 3,
      filter: payload.filter && payload.filter !== 'none' ? payload.filter : null,
      template_id: payload.template_id ?? null,
    },
  }
}

export const listEvents = async (): Promise<Event[]> => {
  const { data } = await api.get('/events')
  const items = Array.isArray(data.data) ? data.data : data.data.data
  return (items as Record<string, unknown>[]).map(normalizeEvent)
}

export const createEvent = async (payload: EventPayload): Promise<Event> => {
  const { data } = await api.post('/events', toApiPayload(payload))
  return normalizeEvent(data.data as Record<string, unknown>)
}

export const updateEvent = async (id: number, payload: EventPayload): Promise<Event> => {
  const { data } = await api.put(`/events/${id}`, toApiPayload(payload))
  return normalizeEvent(data.data as Record<string, unknown>)
}

export const deleteEvent = async (id: number): Promise<void> => {
  await api.delete(`/events/${id}`)
}

export const toggleEventActive = async (id: number): Promise<Event> => {
  const { data } = await api.patch(`/events/${id}/toggle-active`)
  return normalizeEvent(data.data as Record<string, unknown>)
}

export const getEvent = async (id: number): Promise<Event> => {
  const { data } = await api.get(`/events/${id}`)
  return normalizeEvent(data.data as Record<string, unknown>)
}

export const getEventSessions = async (id: number): Promise<EventSession[]> => {
  const { data } = await api.get(`/events/${id}/sessions`)
  return data.data as EventSession[]
}
