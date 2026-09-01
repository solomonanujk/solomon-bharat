import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types'

// Role type lives on User (see types/index.ts): 'SUPER_ADMIN' | 'SELLER' | 'BUYER'

const TOKEN_KEY = 'sb_token'
const CSRF_TOKEN_KEY = 'sb_csrf'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isAuthModalOpen: boolean
  authModalTab: 'login' | 'signup'
  pendingAction: string | null
  _hasHydrated: boolean
  cartCount: number
  notificationCount: number
}

interface AuthActions {
  setUser: (user: User) => void
  patchUser: (patch: Partial<User>) => void
  logout: () => void
  openAuthModal: (tab?: 'login' | 'signup', pendingAction?: string) => void
  closeAuthModal: () => void
  _setHasHydrated: (v: boolean) => void
  setCartCount: (count: number) => void
  setNotificationCount: (count: number) => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // ─── State ────────────────────────────────────────────────────────────
      user: null,
      isAuthenticated: false,
      isAuthModalOpen: false,
      authModalTab: 'login',
      pendingAction: null,
      _hasHydrated: false,
      cartCount: 0,
      notificationCount: 0,

      // ─── Actions ──────────────────────────────────────────────────────────
      _setHasHydrated: (v) => set({ _hasHydrated: v }),
      setCartCount: (count) => set({ cartCount: count }),
      setNotificationCount: (count) => set({ notificationCount: count }),

      setUser: (user: User) =>
        set({
          user,
          isAuthenticated: true,
          isAuthModalOpen: false,
          pendingAction: null,
        }),

      patchUser: (patch: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : state.user,
        })),

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(CSRF_TOKEN_KEY)
        }
        set({
          user: null,
          isAuthenticated: false,
          isAuthModalOpen: false,
          pendingAction: null,
          cartCount: 0,
          notificationCount: 0,
        })
      },

      openAuthModal: (tab: 'login' | 'signup' = 'login', pendingAction?: string) =>
        set({
          isAuthModalOpen: true,
          authModalTab: tab,
          pendingAction: pendingAction ?? null,
        }),

      closeAuthModal: () =>
        set({
          isAuthModalOpen: false,
          pendingAction: null,
        }),
    }),
    {
      name: 'sb_auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : (null as never)
      ),
      // Only persist user/auth; modal/UI state is ephemeral
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true)
      },
    }
  )
)
