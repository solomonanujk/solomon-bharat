'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useMyMessages, useSendMyMessage } from '@/modules/buyers';
import type { BuyerMessage } from '@/modules/buyers';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'short' });
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function ChatBubble({ message }: { readonly message: BuyerMessage }) {
  const isBuyer = message.sender === 'BUYER';
  return (
    <div className={`flex ${isBuyer ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[72%]">
        <div
          className={`rounded-2xl px-4 py-2.5 text-small leading-[1.6] ${
            isBuyer
              ? 'rounded-br-sm bg-accent-primary text-white'
              : 'rounded-bl-sm border border-border bg-bg-surface text-text-primary'
          }`}
        >
          {!isBuyer && <p className="mb-1 text-caption font-semibold opacity-70">Solomon Bharat Support</p>}
          <p>{message.body}</p>
        </div>
        <p className={`mt-1 text-caption text-text-muted ${isBuyer ? 'text-right' : 'text-left'}`}>
          {formatTimestamp(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { data: messages, isLoading } = useMyMessages();
  const sendMutation = useSendMyMessage();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  function handleSend() {
    if (!draft.trim() || sendMutation.isPending) return;
    sendMutation.mutate(draft.trim(), { onSuccess: () => setDraft('') });
  }

  return (
    <div>
      <h1 className="font-serif text-h2 text-text-primary">Messages</h1>
      <p className="mt-1 text-body text-text-muted">Your conversation with Solomon Bharat Support.</p>

      <div className="mt-6 flex h-[calc(100vh-260px)] min-h-[420px] flex-col overflow-hidden rounded-card border border-border bg-bg-surface">
        <div className="flex items-center gap-3 border-b border-border bg-bg-surface px-5 py-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-primary/10 font-serif text-body-lg text-accent-primary">
            S
          </div>
          <div>
            <p className="text-small font-semibold text-text-primary">Solomon Bharat Support</p>
            <p className="text-caption text-text-muted">We typically reply within one business day</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-bg-primary px-5 py-6">
          {isLoading && (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
            </div>
          )}
          {!isLoading && messages && messages.length === 0 && (
            <p className="pt-8 text-center text-small text-text-muted">
              No messages yet &mdash; send a note to Solomon Bharat Support below.
            </p>
          )}
          {messages?.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
        </div>

        <div className="border-t border-border bg-bg-surface px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message…"
              rows={1}
              className="max-h-[120px] flex-1 resize-none rounded-input border border-border bg-bg-primary px-3 py-2 text-body font-sans leading-[1.5] text-text-primary outline-none transition-colors placeholder:text-text-muted/60 focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
            />
            <Button
              type="button"
              onClick={handleSend}
              disabled={!draft.trim() || sendMutation.isPending}
              aria-label="Send message"
              className="h-10 w-10 shrink-0 rounded-full p-0"
            >
              <Send size={14} aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-1.5 text-caption text-text-muted/70">Press Enter to send &middot; Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
