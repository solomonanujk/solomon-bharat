import { useAuthStore } from '@/lib/store/useAuthStore'

/**
 * Convenience hook that exposes auth state and a requireAuth guard.
 *
 * Usage:
 *   const { user, isAuthenticated, requireAuth } = useAuth()
 *   <button onClick={() => requireAuth(() => addToCart(item), 'add_to_cart')}>
 *     Add to cart
 *   </button>
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openAuthModal = useAuthStore((s) => s.openAuthModal)

  /**
   * If the user is authenticated, run `action` immediately.
   * Otherwise, open the auth modal on the signup tab so they can create an
   * account, and record `pendingAction` so the UI can resume after sign-in.
   * `productImage`, when given, shows that product's photo atop the signup
   * wizard's first step — a visual reminder of what they're unlocking.
   */
  function requireAuth(action: () => void, pendingAction?: string, productImage?: string | null): void {
    if (isAuthenticated) {
      action()
    } else {
      openAuthModal('signup', pendingAction, productImage)
    }
  }

  return {
    user,
    isAuthenticated,
    openAuthModal,
    requireAuth,
  }
}
