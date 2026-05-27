import api from './axios'

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1')

export const getQR = (_shareToken: string): Promise<string> => {
  // Backend returns PNG binary directly — just build the URL for <img src>
  return Promise.resolve(`${API_BASE}/share/${_shareToken}/qr`)
}

export const getWhatsAppLink = async (shareToken: string): Promise<string> => {
  const { data } = await api.post(`/share/${shareToken}/whatsapp`)
  return data.data.url as string
}

export const sendEmail = async (shareToken: string, email: string): Promise<void> => {
  await api.post(`/share/${shareToken}/email`, { email })
}

export const getDownloadUrl = async (photoId: number): Promise<string> => {
  const { data } = await api.get(`/download/${photoId}`)
  return data.data.url as string
}
