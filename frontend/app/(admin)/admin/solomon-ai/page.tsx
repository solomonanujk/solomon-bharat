'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, AlertCircle, CheckCircle2, FileText, ImageIcon, Sheet, Type, Trash2, Upload, Sparkles, RefreshCw, MessageCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { GuideMarkdown } from '@/components/guide/GuideMarkdown'
import { cn } from '@/lib/utils'
import {
  type GuideKnowledgeItem,
  useAddGuideText,
  useDeleteGuideKnowledge,
  useDeleteAllGuideKnowledge,
  useGuideAiKey,
  useSaveGuideAiKey,
  useRemoveGuideAiKey,
  useGuideConversation,
  useGuideConversations,
  useGuideKnowledge,
  useGuideKnowledgeItem,
  useGuideSettings,
  useGuideSuggestions,
  useRefreshGuideSuggestions,
  useUpdateGuideSettings,
  useUploadGuideFile,
} from '@/hooks/queries/useGuide'

const KIND_ICON = { TEXT: Type, PDF: FileText, IMAGE: ImageIcon, SPREADSHEET: Sheet } as const
const KIND_LABEL = { TEXT: 'Text', PDF: 'PDF', IMAGE: 'Image', SPREADSHEET: 'Spreadsheet' } as const
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.csv,.txt,.md'

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// ─── Teach tab ───────────────────────────────────────────────────────────────

function UploadArea() {
  const upload = useUploadGuideFile()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [queue, setQueue] = useState<string[]>([])

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files)
    setQueue(list.map((f) => f.name))
    // One at a time: each file is read by the AI before the next starts.
    let sent = 0
    for (const file of list) {
      await upload.mutateAsync({ file }).then(() => { sent += 1 }).catch(() => {})
      setQueue((q) => q.filter((n) => n !== file.name))
    }
    if (sent > 0) toast.success(`${sent} file${sent === 1 ? '' : 's'} uploaded. Solomon AI is reading ${sent === 1 ? 'it' : 'them'} now.`)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        'rounded-xl border-2 border-dashed p-8 flex flex-col items-center text-center gap-3 transition-colors',
        dragging ? 'border-[#183D33] bg-[#E7EDE7]' : 'border-[#C9D6CC] bg-white',
      )}
    >
      <div className="w-12 h-12 rounded-full bg-[#E7EDE7] flex items-center justify-center text-[#183D33]">
        <Upload size={20} aria-hidden="true" />
      </div>
      <div>
        <p className="text-[15px] font-[600] text-[#0F241D]">Drop files here, or choose them</p>
        <p className="text-[13px] text-[#6B7E6B] mt-1">PDFs, images, spreadsheets (.xlsx, .csv) and text files, up to 25 MB each. Word files: save as PDF first.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={queue.length > 0}>
        {queue.length > 0 ? 'Uploading…' : 'Choose files'}
      </Button>
      {queue.length > 0 && (
        <p className="text-[13px] text-[#183D33]" role="status">
          Uploading {queue[0]}{queue.length > 1 ? ` (+${queue.length - 1} more)` : ''}…
        </p>
      )}
    </div>
  )
}

function AddTextCard() {
  const add = useAddGuideText()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  return (
    <form
      className="bg-white border border-[#D9E2DA] rounded-xl p-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        add.mutate({ title, text }, { onSuccess: () => { setTitle(''); setText('') } })
      }}
    >
      <p className="text-[15px] font-[600] text-[#0F241D]">Write or paste text</p>
      <input
        id="guide-text-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title, e.g. Our sourcing process and fees"
        className="h-10 rounded-lg border border-[#D9E2DA] px-3 text-[14px] focus:outline-none focus:border-[#183D33]"
      />
      <textarea
        id="guide-text-body"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Anything you want Solomon AI to know: how you work, your prices, tips for buyers, answers to common questions…"
        className="rounded-lg border border-[#D9E2DA] px-3 py-2 text-[14px] focus:outline-none focus:border-[#183D33]"
      />
      <Button type="submit" variant="primary" className="self-start" disabled={add.isPending || !title.trim() || !text.trim()}>
        {add.isPending ? 'Adding…' : 'Add to Solomon AI'}
      </Button>
    </form>
  )
}

function SuggestionsCard() {
  const { data } = useGuideSuggestions()
  const refresh = useRefreshGuideSuggestions()
  return (
    <div className="bg-[#0F241D] text-[#E7EDE7] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-[600] flex items-center gap-2">
          <Sparkles size={16} className="text-[#E9A23B]" aria-hidden="true" /> What to upload next
        </p>
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-[#E9A23B] hover:underline disabled:opacity-60"
        >
          <RefreshCw size={12} className={refresh.isPending ? 'animate-spin' : ''} aria-hidden="true" />
          {refresh.isPending ? 'Checking…' : 'Check again'}
        </button>
      </div>
      {data?.text ? (
        <GuideMarkdown text={data.text} className="flex flex-col gap-2 text-[13.5px] leading-[1.55] text-[#D6E2DA]" />
      ) : (
        <p className="text-[13.5px] text-[#9DB3A6]">
          After you add something, Solomon AI looks at everything it has and suggests what to add next. Click “Check again” to get suggestions now.
        </p>
      )}
      {data?.updatedAt && <p className="text-[11.5px] text-[#9DB3A6]">Updated {new Date(data.updatedAt).toLocaleString('en-GB')}</p>}
    </div>
  )
}

function LearnedPanel({ item }: { item: GuideKnowledgeItem }) {
  const [full, setFull] = useState(false)
  const { data, isLoading } = useGuideKnowledgeItem(full ? item.id : null)
  return (
    <div className="bg-[#F3F6F3] rounded-lg p-3 flex flex-col gap-2 text-[13px] text-[#3D5248]">
      {item.summary ? (
        <>
          <p className="text-[12px] font-[700] uppercase tracking-wide text-[#6B7E6B]">Key points learned</p>
          <GuideMarkdown text={item.summary} className="flex flex-col gap-1.5" />
        </>
      ) : (
        <p className="flex items-center gap-2"><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Writing a summary of what it learned…</p>
      )}
      <button type="button" onClick={() => setFull((f) => !f)} className="self-start text-[12.5px] font-[600] text-[#183D33] hover:underline">
        {full ? 'Hide the full text' : `Show the full text (${item.characters.toLocaleString()} characters)`}
      </button>
      {full && (
        <div className="max-h-[420px] overflow-y-auto bg-white border border-[#D9E2DA] rounded-lg p-3 whitespace-pre-wrap break-words text-[12.5px] leading-[1.55]">
          {isLoading ? 'Loading…' : data?.content}
        </div>
      )}
    </div>
  )
}

function StatusChip({ item }: { item: GuideKnowledgeItem }) {
  if (item.status === 'PROCESSING') {
    return <span className="inline-flex items-center gap-1 text-[11.5px] font-[600] text-[#B8862F]"><Loader2 size={11} className="animate-spin" aria-hidden="true" /> Reading…</span>
  }
  if (item.status === 'FAILED') {
    return <span className="inline-flex items-center gap-1 text-[11.5px] font-[600] text-error"><AlertCircle size={11} aria-hidden="true" /> Failed</span>
  }
  return <span className="inline-flex items-center gap-1 text-[11.5px] font-[600] text-[#183D33]"><CheckCircle2 size={11} aria-hidden="true" /> Learned</span>
}

function RemoveAllButton() {
  const { data } = useGuideKnowledge()
  const removeAll = useDeleteAllGuideKnowledge()
  const [open, setOpen] = useState(false)
  const empty = !data?.length
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={empty} title={empty ? 'Nothing to remove yet' : undefined} className="inline-flex items-center gap-1.5 text-[12.5px] font-[600] text-error hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed">
        <Trash2 size={13} aria-hidden="true" /> Remove all
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove all {(data?.length ?? 0)} items?</DialogTitle>
            <DialogDescription>
              Solomon AI will forget everything uploaded here, straight away. Visitor chats are kept. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={removeAll.isPending} onClick={() => removeAll.mutate(undefined, { onSuccess: () => setOpen(false) })}>
              {removeAll.isPending ? 'Removing…' : 'Remove all'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function KnowledgeList() {
  const { data, isLoading } = useGuideKnowledge()
  const del = useDeleteGuideKnowledge()
  const [confirm, setConfirm] = useState<GuideKnowledgeItem | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  if (isLoading) return <p className="text-[13px] text-[#6B7E6B]">Loading…</p>
  if (!data?.length) {
    return (
      <div className="bg-white border border-[#D9E2DA] rounded-xl py-10 text-center text-[14px] text-[#6B7E6B]">
        Nothing added yet. Start with what you know best: how Solomon Bharat works, your product list and prices, and shipping rates.
      </div>
    )
  }
  const reading = data.filter((i) => i.status === 'PROCESSING').length
  return (
    <div className="bg-white border border-[#D9E2DA] rounded-xl divide-y divide-[#E3EAE4]">
      {reading > 0 && (
        <p className="px-4 py-2.5 text-[12.5px] text-[#183D33] bg-[#F3F6F3]" role="status">
          Reading {reading} file{reading === 1 ? '' : 's'} one at a time. You can leave this page; it carries on.
        </p>
      )}
      {data.map((item) => {
        const Icon = KIND_ICON[item.kind]
        return (
          <div key={item.id} className="p-4 flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#E7EDE7] flex items-center justify-center text-[#183D33] shrink-0">
                <Icon size={16} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-[600] text-[#0F241D] break-words">{item.title}</p>
                <p className="text-[12px] text-[#6B7E6B] flex flex-wrap items-center gap-x-1.5">
                  <StatusChip item={item} />
                  <span>· {KIND_LABEL[item.kind]}{item.fileName ? ` · ${item.fileName}` : ''}{item.sizeBytes ? ` · ${formatSize(item.sizeBytes)}` : ''} · added {new Date(item.createdAt).toLocaleDateString('en-GB')}</span>
                </p>
                {item.status === 'FAILED' && item.error && <p className="text-[12.5px] text-error mt-1">{item.error}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.fileUrl && (
                  <a href={item.fileUrl} target="_blank" rel="noreferrer" className="p-2 text-[#6B7E6B] hover:text-[#183D33]" aria-label={`Open ${item.title}`}>
                    <ExternalLink size={15} />
                  </a>
                )}
                <button type="button" onClick={() => setConfirm(item)} className="p-2 text-[#6B7E6B] hover:text-error" aria-label={`Remove ${item.title}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            {item.status === 'READY' && (
              <>
                <button
                  type="button"
                  onClick={() => setOpen(open === item.id ? null : item.id)}
                  className="self-start text-[12.5px] font-[600] text-[#183D33] hover:underline"
                >
                  {open === item.id ? 'Hide what it learned' : 'See what it learned'}
                </button>
                {open === item.id && <LearnedPanel item={item} />}
              </>
            )}
          </div>
        )
      })}
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove “{confirm?.title}”?</DialogTitle>
            <DialogDescription>Solomon AI will stop using it straight away. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => confirm && del.mutate(confirm.id, { onSuccess: () => setConfirm(null) })}
            >
              {del.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const PROVIDERS = [
  {
    id: 'anthropic' as const,
    name: 'Claude by Anthropic (best quality, paid)',
    hint: 'When connected, Claude answers every visitor first: the most natural, accurate conversations. Pay as you go: create a key at console.anthropic.com → API keys and add credit (about $5 to $20 a month for a few hundred chats).',
  },
  {
    id: 'openrouter' as const,
    name: 'OpenRouter (free models)',
    hint: 'Answers chats, writes summaries and reads images. Get a key at openrouter.ai → Keys. Adding $10 of credit once raises the free limit from about 50 to about 1,000 requests a day.',
  },
  {
    id: 'gemini' as const,
    name: 'Google Gemini (backup)',
    hint: 'Used when OpenRouter is busy or out of free requests, and to read scanned PDFs. Get a key at aistudio.google.com.',
  },
]

function ProviderKeyRow({ provider }: { provider: (typeof PROVIDERS)[number] }) {
  const { data } = useGuideAiKey()
  const save = useSaveGuideAiKey()
  const remove = useRemoveGuideAiKey()
  const [key, setKey] = useState('')
  const status = data?.[provider.id]
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13.5px] font-[600] text-[#0F241D]">{provider.name}</p>
        {status && (
          <span className={cn('text-[11.5px] font-[600]', status.source === 'none' ? 'text-[#B8862F]' : 'text-[#183D33]')}>
            {status.source === 'none' ? 'Not connected' : `Connected …${status.last4}${status.source === 'server' ? ' (server)' : ''}`}
          </span>
        )}
      </div>
      <p className="text-[12px] text-[#6B7E6B]">{provider.hint}</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ provider: provider.id, key }, { onSuccess: () => setKey('') })
        }}
      >
        <input
          id={`guide-key-${provider.id}`}
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={status?.source === 'none' ? 'Paste the API key' : 'Paste a key to replace it'}
          className="flex-1 min-w-0 h-9 rounded-lg border border-[#D9E2DA] px-3 text-[13.5px] bg-white focus:outline-none focus:border-[#183D33]"
        />
        <Button type="submit" variant="primary" size="sm" disabled={save.isPending || key.trim().length < 20}>
          {save.isPending ? 'Checking…' : 'Save'}
        </Button>
      </form>
      {status?.source === 'admin' && (
        <button type="button" onClick={() => remove.mutate(provider.id)} disabled={remove.isPending} className="self-start text-[12px] font-[600] text-error hover:underline">
          Remove key
        </button>
      )}
    </div>
  )
}

function AiConnectionCard() {
  const { data } = useGuideAiKey()
  const label = {
    openrouter: 'OpenRouter free models answer first, with Gemini as the backup.',
    gemini: 'Google Gemini is answering. Add an OpenRouter key for a much bigger free allowance.',
    claude: 'Claude is answering visitors, with the free models as backup.',
    none: 'Not connected yet: Solomon AI cannot answer until you add a key.',
  }[data?.active ?? 'none']
  return (
    <div className={cn('rounded-xl p-5 flex flex-col gap-4 border', data && data.active !== 'none' ? 'bg-white border-[#D9E2DA]' : 'bg-[#FFF7E8] border-[#E9A23B]')}>
      <div>
        <p className="text-[15px] font-[600] text-[#0F241D]">AI connection</p>
        <p className="text-[13px] text-[#3D5248] mt-1">{label}</p>
      </div>
      {PROVIDERS.map((p) => <ProviderKeyRow key={p.id} provider={p} />)}
      <p className="text-[11.5px] text-[#6B7E6B]">Keys are checked before saving, stored encrypted, and never shown again.</p>
    </div>
  )
}

function SettingsCard() {
  const { data } = useGuideSettings()
  const update = useUpdateGuideSettings()
  const on = data?.allowWebSearch ?? true
  return (
    <div className="bg-white border border-[#D9E2DA] rounded-xl p-5 flex items-start justify-between gap-4">
      <div>
        <p className="text-[15px] font-[600] text-[#0F241D]">Web search</p>
        <p className="text-[13px] text-[#6B7E6B] mt-1 max-w-[520px]">
          When on, Solomon AI searches the web for current rates, rules and prices, or anything your material doesn&apos;t cover, and tells the visitor which points came from the web.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Web search"
        disabled={update.isPending || !data}
        onClick={() => update.mutate({ allowWebSearch: !on })}
        className={cn('relative w-12 h-7 rounded-full transition-colors shrink-0', on ? 'bg-[#183D33]' : 'bg-[#C9D6CC]')}
      >
        <span className={cn('absolute top-1 w-5 h-5 rounded-full bg-white transition-all', on ? 'left-6' : 'left-1')} />
      </button>
    </div>
  )
}

// ─── Conversations tab ───────────────────────────────────────────────────────

function Conversations() {
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const { data, isLoading } = useGuideConversations(page)
  const { data: convo } = useGuideConversation(openId)

  if (isLoading) return <p className="text-[13px] text-[#6B7E6B]">Loading…</p>
  if (!data?.rows.length) {
    return <div className="bg-white border border-[#D9E2DA] rounded-xl py-10 text-center text-[14px] text-[#6B7E6B]">No chats yet. Visitors start one at solomonbharat.com/guide.</div>
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white border border-[#D9E2DA] rounded-xl overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead className="bg-[#F3F6F3] text-left text-[12px] text-[#6B7E6B] uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Phone</th>
              <th className="px-4 py-2.5">Country</th>
              <th className="px-4 py-2.5">Messages</th>
              <th className="px-4 py-2.5">Last active</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-t border-[#E3EAE4] hover:bg-[#F7F9F7] cursor-pointer" onClick={() => setOpenId(r.id)}>
                <td className="px-4 py-2.5 font-[600] text-[#0F241D]">{r.name}</td>
                <td className="px-4 py-2.5">{r.email}</td>
                <td className="px-4 py-2.5">{r.phone}</td>
                <td className="px-4 py-2.5">{r.country ?? '—'}</td>
                <td className="px-4 py-2.5">{r.messageCount}</td>
                <td className="px-4 py-2.5">{new Date(r.updatedAt).toLocaleString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.totalPages > 1 && (
        <div className="flex items-center gap-2 text-[13px]">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {data.totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
      <Dialog open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-[720px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{convo?.name ?? 'Conversation'}</DialogTitle>
            <DialogDescription>
              {convo ? `${convo.email} · ${convo.phone}${convo.country ? ` · ${convo.country}` : ''}` : 'Loading…'}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 flex flex-col gap-3">
            {convo?.messages.map((m, i) => (
              <div key={i} className={cn('rounded-xl px-4 py-3 text-[13.5px] max-w-[90%]', m.role === 'user' ? 'self-end bg-[#183D33] text-white' : 'self-start bg-[#F3F6F3] text-[#0F241D]')}>
                {m.role === 'assistant' ? <GuideMarkdown text={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
              </div>
            ))}
            {convo && convo.messages.length === 0 && <p className="text-[13px] text-[#6B7E6B]">They gave their details but have not asked anything yet.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SolomonAiPage() {
  const [tab, setTab] = useState<'teach' | 'chats'>('teach')
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-[700] text-[#0F241D] leading-tight flex items-center gap-2">
            <Sparkles size={22} className="text-[#B8862F]" aria-hidden="true" /> Solomon AI
          </h1>
          <p className="text-[13.5px] text-[#6B7E6B] mt-1 max-w-[640px]">
            Add what Solomon AI should know. It learns from everything here, answers visitors in its own words, and searches the web for current details.
          </p>
        </div>
        <Link href="/guide" target="_blank" className="inline-flex items-center gap-1.5 text-[13px] font-[600] text-[#183D33] hover:underline">
          <MessageCircle size={14} aria-hidden="true" /> Open the visitor chat
        </Link>
      </div>

      <div className="flex gap-0 mb-5 border-b border-[#D9E2DA]">
        {([['teach', 'Teach Solomon AI'], ['chats', 'Visitor chats']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'px-4 py-2.5 text-[13px] font-[600] border-b-2 -mb-px transition-colors',
              tab === value ? 'border-[#183D33] text-[#183D33]' : 'border-transparent text-[#6B7E6B] hover:text-[#0F241D]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'teach' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          <div className="flex flex-col gap-5 min-w-0">
            <UploadArea />
            <AddTextCard />
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-[600] text-[#0F241D]">What Solomon AI knows</p>
                <RemoveAllButton />
              </div>
              <KnowledgeList />
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <AiConnectionCard />
            <SuggestionsCard />
            <SettingsCard />
          </div>
        </div>
      ) : (
        <Conversations />
      )}
    </div>
  )
}
