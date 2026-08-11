import { useQuery } from '@tanstack/react-query';
import { authService } from '../services/auth.service';

/**
 * Query-cache-backed fetch of the current user, separate from `AuthProvider`'s
 * mount-time refresh. `AuthProvider` remains the single source of truth for
 * `login`/`logout` state — this hook is for pages that want to refetch/invalidate
 * the current user via TanStack Query (e.g. after an action that may change
 * `status`/`role`) without re-running the refresh-token flow.
 */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.getMe,
    enabled,
  });
}
