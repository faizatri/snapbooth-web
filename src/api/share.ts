import api from './axios'

export const getQR = async (shareToken: string): Promise<string> => {
  const { data } = await api.get(`/share/${shareToken}/qr`)
  return (data.data.qr_url ?? data.data.url) as string
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
