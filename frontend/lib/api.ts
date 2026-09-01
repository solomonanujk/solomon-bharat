import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/lib/store/useAuthStore'

const TOKEN_KEY = 'sb_token'
export const CSRF_TOKEN_KEY = 'sb_csrf'

const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1`,
  withCredentials: true, // send httpOnly cookie (refresh token) + csrf_token cookie
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── CSRF helper ──────────────────────────────────────────────────────────────
// The backend uses double-submit CSRF: whatever value it hands back must be
// echoed as the `x-csrf-token` header on every mutating request once the
// browser holds the refresh-token cookie. The backend ALSO sets a same-named
// cookie, but the frontend runs on a different origin than the API (Vercel vs
// Render) — document.cookie can only see cookies set for the page's own
// origin, so a cross-origin Set-Cookie response is invisible to this JS no
// matter what. The login/refresh response bodies carry the value explicitly
// for exactly this reason; localStorage (not the cookie) is the source of
// truth read here.

function readStoredCsrfToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CSRF_TOKEN_KEY)
}

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attach access token from localStorage + CSRF header to every outgoing request.

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(TOKEN_KEY)
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      const method = (config.method || 'get').toLowerCase()
      if (!['get', 'head', 'options'].includes(method)) {
        const csrfToken = readStoredCsrfToken()
        if (csrfToken) {
          config.headers['x-csrf-token'] = csrfToken
        }
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response Interceptor ─────────────────────────────────────────────────────
// On 401: attempt silent token refresh, retry original request once.
// On second 401: clear stored token and redirect to login.

let isRefreshing = false
let pendingQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else if (token) {
      resolve(token)
    }
  })
  pendingQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    // Never intercept auth endpoints — let the caller handle their own 401s
    const isAuthEndpoint = originalRequest.url?.includes('/auth/')
    if (error.response?.status !== 401 || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // Queue the request while a refresh is already in flight
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token: string) => {
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${token}`
            } else {
              originalRequest.headers = { Authorization: `Bearer ${token}` }
            }
            resolve(api(originalRequest))
          },
          reject,
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const refreshRes = await api.post('/auth/refresh')
      const newToken: string = refreshRes.data.data.accessToken
      const newCsrfToken: string = refreshRes.data.data.csrfToken

      if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, newToken)
        localStorage.setItem(CSRF_TOKEN_KEY, newCsrfToken)
      }

      if (originalRequest.headers) {
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newToken}`
      } else {
        originalRequest.headers = { Authorization: `Bearer ${newToken}` }
      }

      processQueue(null, newToken)
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)

      useAuthStore.getState().logout()
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('sb_session_expired', '1')
        window.location.href = '/'
      }

      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
