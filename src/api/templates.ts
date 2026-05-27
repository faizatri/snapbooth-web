import api from './axios'

export interface Template {
  id: number
  name: string
  preview_url: string | null
  created_at: string
}

export const listTemplates = async (): Promise<Template[]> => {
  const { data } = await api.get('/templates')
  return (Array.isArray(data.data) ? data.data : data.data.data) as Template[]
}

export const createTemplate = async (name: string, file?: File): Promise<Template> => {
  const form = new FormData()
  form.append('name', name)
  if (file) form.append('preview', file)
  const { data } = await api.post('/templates', form)
  return data.data as Template
}

export const updateTemplate = async (id: number, name: string, file?: File): Promise<Template> => {
  const form = new FormData()
  form.append('name', name)
  form.append('_method', 'PUT')
  if (file) form.append('preview', file)
  const { data } = await api.post(`/templates/${id}`, form)
  return data.data as Template
}

export const deleteTemplate = async (id: number): Promise<void> => {
  await api.delete(`/templates/${id}`)
}
