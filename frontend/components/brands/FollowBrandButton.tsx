'use client'

import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useFollowBrand, useUnfollowBrand } from '@/hooks/queries/useBrands'

/** Follow / Unfollow for BUYER and AGENT accounts; guests get the signup gate. Hidden for sellers/admins. */
export function FollowBrandButton({ slug, name, isFollowing }: { slug: string; name: string; isFollowing: boolean }) {
  const { user, isAuthenticated, requireAuth } = useAuth()
  const follow = useFollowBrand()
  const unfollow = useUnfollowBrand()

  if (isAuthenticated && user?.role !== 'BUYER' && user?.role !== 'AGENT') return null

  const pending = follow.isPending || unfollow.isPending
  const following = isAuthenticated && isFollowing

  return (
    <Button
      type="button"
      variant={following ? 'secondary' : 'primary'}
      size="lg"
      loading={pending}
      aria-pressed={following}
      aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
      onClick={() =>
        requireAuth(() => {
          if (following) unfollow.mutate(slug)
          else follow.mutate(slug)
        }, 'follow_brand')
      }
    >
      <Heart size={16} fill={following ? 'currentColor' : 'none'} aria-hidden="true" />
      {following ? 'Following' : 'Follow'}
    </Button>
  )
}
