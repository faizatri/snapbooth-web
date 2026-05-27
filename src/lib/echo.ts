import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import axios from 'axios'
import { getToken } from '../utils/storage'

interface ChannelAuthData {
  auth: string
  channel_data?: string
  shared_secret?: string
}

const API_ROOT = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/api\/v1$/, '')

const echo = new Echo({
  broadcaster: 'pusher',
  key: import.meta.env.VITE_PUSHER_APP_KEY as string,
  cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER as string,
  forceTLS: true,
  Pusher,
  authorizer: (channel: { name: string }) => ({
    authorize: (socketId: string, callback: (error: Error | null, data: ChannelAuthData | null) => void) => {
      axios
        .post(
          `${API_ROOT}/broadcasting/auth`,
          { socket_id: socketId, channel_name: channel.name },
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
              Accept: 'application/json',
            },
          }
        )
        .then(resp => callback(null, resp.data as ChannelAuthData))
        .catch(err => callback(err instanceof Error ? err : new Error(String(err)), null))
    },
  }),
})

export default echo
