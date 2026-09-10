'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { AccountPageWrapper } from '@/components/shared/AccountPageWrapper'
import { cn } from '@/lib/utils'
import { useMyMessages, useSendMyMessage } from '@/hooks/queries/useMessages'
import type { BuyerMessage } from '@/types'

// Messages are buyer <-> Solomon Bharat admin only — a buyer has exactly one
// conversation, so there is no thread list here (unlike the ported
// solomon-bharat2 buyer<->brand inbox this page used to be).

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function ChatBubble({ message }: { message: BuyerMessage }) {
  const isMe = message.sender === 'BUYER'
  return (
    <div className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[72%]">
        <div className={cn(
          'px-4 py-2.5 rounded-2xl font-public-sans text-[14px] leading-[1.6]',
          isMe
            ? 'bg-primary text-white rounded-br-sm'
            : 'bg-surface border border-border-warm text-primary rounded-bl-sm'
        )}>
          {message.body}
        </div>
        <p className={cn('font-public-sans text-[11px] text-muted-text mt-1', isMe ? 'text-right' : 'text-left')}>
          {isMe ? 'You' : 'Solomon Bharat'} &middot; {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  const [input, setInput] = useState('')
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const { data: messages = [], isLoading } = useMyMessages()
  const sendMessage = useSendMyMessage()

  useEffect(() => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  function handleSend() {
    const body = input.trim()
    if (!body) return
    sendMessage.mutate(body)
    setInput('')
  }

  return (
    <AccountPageWrapper title="Messages" description="Your direct line to the Solomon Bharat team">
      <div className="border border-border-warm rounded overflow-hidden flex flex-col h-[calc(100dvh-260px)] min-h-[420px] md:h-[calc(100vh-320px)] md:min-h-[520px]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-warm bg-surface flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 font-playfair font-[600] text-accent text-[15px]">
            SB
          </div>
          <div>
            <p className="font-public-sans text-[13px] font-[700] text-primary">Solomon Bharat Support</p>
            <p className="font-public-sans text-[11px] text-muted-text">We usually reply within one business day</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-4 bg-bg">
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          )}
          {!isLoading && messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <MessageSquare size={24} className="text-muted-text mb-2" aria-hidden="true" />
              <p className="font-public-sans text-[13px] text-muted-text">
                No messages yet. Send a note to the Solomon Bharat team below.
              </p>
            </div>
          )}
          {!isLoading && messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-border-warm px-4 py-3 bg-white flex-shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder="Message Solomon Bharat…"
              rows={1}
              className="flex-1 resize-none rounded border border-border-warm bg-muted-bg px-3 py-2 font-public-sans text-[13px] text-primary placeholder:text-muted-text/60 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors leading-[1.5] max-h-[120px]"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              aria-label="Send message"
              className="w-9 h-9 flex-shrink-0 rounded bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} aria-hidden="true" />
            </button>
          </div>
          <p className="font-public-sans text-[11px] text-muted-text/60 mt-1.5">
            Press Enter to send &middot; Shift+Enter for new line
          </p>
        </div>
      </div>
    </AccountPageWrapper>
  )
}
