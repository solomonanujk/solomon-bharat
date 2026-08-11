'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useMyMessages, useSendMyMessage } from '@/modules/buyers';

export default function MessagesPage() {
  const { data: messages, isLoading } = useMyMessages();
  const sendMutation = useSendMyMessage();
  const [draft, setDraft] = useState('');

  function handleSend() {
    if (!draft.trim()) return;
    sendMutation.mutate(draft.trim(), { onSuccess: () => setDraft('') });
  }

  return (
    <div>
      <h1 className="font-serif text-h2 text-text-primary">Messages</h1>
      <p className="mt-1 text-body text-text-muted">Your conversation with Solomon Bharat Support.</p>

      <div className="mt-6 flex h-[65vh] flex-col overflow-hidden rounded-card border border-border bg-bg-surface">
        <div className="border-b border-border px-5 py-3.5">
          <p className="text-small font-semibold text-text-primary">Solomon Bharat Support</p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
          {isLoading && <p className="text-body text-text-muted">Loading&hellip;</p>}
          {!isLoading && messages && messages.length === 0 && (
            <p className="text-center text-small text-text-muted">
              No messages yet &mdash; send a note to Solomon Bharat Support below.
            </p>
          )}
          {messages?.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'BUYER' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[72%]">
                <div
                  className={`rounded-2xl px-4 py-2.5 text-small leading-[1.6] ${
                    message.sender === 'BUYER'
                      ? 'rounded-br-sm bg-accent-primary text-white'
                      : 'rounded-bl-sm border border-border bg-bg-primary text-text-primary'
                  }`}
                >
                  {message.sender === 'ADMIN' && (
                    <p className="mb-1 text-caption font-semibold opacity-70">Solomon Bharat Support</p>
                  )}
                  <p>{message.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t border-border bg-bg-surface p-4">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSend()}
            placeholder="Type a message&hellip;"
            className="h-10 flex-1 rounded-input border border-border bg-bg-primary px-3 text-body font-sans text-text-primary outline-none transition-colors placeholder:text-text-muted/60 focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
          />
          <Button type="button" onClick={handleSend} disabled={sendMutation.isPending} className="gap-1.5">
            Send
            <Send size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
