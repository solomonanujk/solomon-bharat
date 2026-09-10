'use client'

import { CheckCheck } from 'lucide-react'
import { AccountPageWrapper } from '@/components/shared/AccountPageWrapper'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/queries/useNotifications'
import type { AppNotification } from '@/types'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification
  onRead: (id: string) => void
}) {
  const content = (
    <div
      className={cn(
        'flex items-start gap-3 px-5 py-4 transition-colors',
        !notification.isRead && 'bg-accent/[4%]'
      )}
    >
      <span
        className={cn(
          'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
          notification.isRead ? 'bg-transparent' : 'bg-accent'
        )}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-[700] font-public-sans text-primary">{notification.title}</p>
        <p className="text-[13px] font-public-sans text-muted-text mt-0.5">{notification.message}</p>
        <p className="text-[11px] font-public-sans text-muted-text/70 mt-1">
          {formatDateTime(notification.createdAt)}
        </p>
      </div>
    </div>
  )

  if (!notification.link) {
    return (
      <button
        type="button"
        onClick={() => !notification.isRead && onRead(notification.id)}
        className="w-full text-left hover:bg-muted-bg/40 transition-colors"
      >
        {content}
      </button>
    )
  }

  return (
    <a
      href={notification.link}
      onClick={() => !notification.isRead && onRead(notification.id)}
      className="block hover:bg-muted-bg/40 transition-colors"
    >
      {content}
    </a>
  )
}

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications({ limit: 50 })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const notifications = data?.items ?? []
  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <AccountPageWrapper
      title="Notifications"
      description={isLoading ? 'Loading…' : `${unreadCount} unread`}
    >
      <div className="flex justify-end mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => markAllRead.mutate()}
          disabled={unreadCount === 0 || markAllRead.isPending}
        >
          <CheckCheck size={13} aria-hidden="true" />
          Mark all read
        </Button>
      </div>

      <div className="border border-border-warm rounded bg-surface overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted-bg rounded animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            description="Order updates and account alerts will show up here."
          />
        ) : (
          <div className="divide-y divide-border-warm">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onRead={(id) => markRead.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </AccountPageWrapper>
  )
}
