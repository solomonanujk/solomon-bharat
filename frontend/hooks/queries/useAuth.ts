'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiError } from '@/lib/getApiError'
import { useAuthStore } from '@/lib/store/useAuthStore'
import type { User } from '@/types'

const TOKEN_KEY = 'sb_token'

function hasToken(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(TOKEN_KEY)
}

/**
 * Fetch the currently authenticated user from /auth/me.
 * Only enabled when an access token is present, avoiding a guaranteed 401.
 */
export function useMe() {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await api.get('/auth/me')
      return response.data.data.user
    },
    enabled: hasToken(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export interface SignupInput {
  email: string
  password: string
  contactName: string
  country: string
  companyName?: string
  phone?: string
}

/** Buyer self-signup only — SELLER accounts are created via /sellers/apply → admin approval. */
export function useSignup() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation<{ user: User; accessToken: string }, Error, SignupInput>({
    mutationFn: async (body) => {
      const res = await api.post('/auth/signup', body)
      return res.data.data
    },
    onSuccess: (data) => {
      localStorage.setItem(TOKEN_KEY, data.accessToken)
      setUser(data.user)
      toast.success('Account created — check your email to verify your address.')
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export interface LoginInput {
  email: string
  password: string
}

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation<{ user: User; accessToken: string }, Error, LoginInput>({
    mutationFn: async (body) => {
      const res = await api.post('/auth/login', body)
      return res.data.data
    },
    onSuccess: (data) => {
      localStorage.setItem(TOKEN_KEY, data.accessToken)
      setUser(data.user)
    },
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout)
  const qc = useQueryClient()
  return useMutation<unknown, Error, void>({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      logout()
      qc.clear()
    },
  })
}

export function useForgotPassword() {
  return useMutation<unknown, Error, { email: string }>({
    mutationFn: (body) => api.post('/auth/forgot-password', body),
    onSuccess: () => toast.success('If that email exists, a reset link has been sent.'),
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useResetPassword() {
  return useMutation<unknown, Error, { id: string; token: string; password: string }>({
    mutationFn: (body) => api.post('/auth/reset-password', body),
    onSuccess: () => toast.success('Password reset — you can now sign in.'),
    onError: (err) => toast.error(getApiError(err)),
  })
}

export function useVerifyEmail() {
  return useMutation<unknown, Error, { id: string; token: string }>({
    mutationFn: ({ id, token }) => api.get('/auth/verify-email', { params: { id, token } }),
    onError: (err) => toast.error(getApiError(err)),
  })
}
