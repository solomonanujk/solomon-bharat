'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Heart, MessageCircle, RotateCcw } from 'lucide-react'
import { NavBar } from '@/components/shared/NavBar'
import { GuideMarkdown } from '@/components/guide/GuideMarkdown'
import { GuidePickCard, type GuidePick, type GuideSavedItem } from '@/components/guide/GuidePickCard'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { COUNTRIES } from '@/lib/countries'
import { getApiError } from '@/lib/getApiError'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

// Solomon AI: a public business guide. Visitors give name, email and phone before chatting
// (no account needed); the chat itself is answered by the backend from Solomon's knowledge.

const TOKEN_KEY = 'sb_guide_token'

interface Turn {
  role: 'user' | 'assistant'
  content: string
  at?: string
  followUps?: string[]
  whatsapp?: boolean
  products?: ProductCard[]
  photos?: WebPhoto[]
  picks?: GuidePick[]
  note?: string
}

interface WebPhoto {
  query: string
  title: string
  image: string
  link: string
  credit: string
  license: string
}

function WebPhotos({ photos }: { photos: WebPhoto[] }) {
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const shown = photos.filter((p) => !broken.has(p.image))
  if (!shown.length) return null
  return (
    <div className="guide-scroll mt-2 flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1">
      {shown.map((p) => (
        <a
          key={p.image}
          href={p.link}
          target="_blank"
          rel="noopener noreferrer"
          className="group shrink-0 w-[150px] sm:w-[170px] snap-start block overflow-hidden rounded-2xl border border-[#E3E8E1] bg-[#FFFFFF] hover:border-[#183D33] transition-colors"
        >
          <div className="aspect-square bg-[#EEF1EC] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image} alt={p.query} loading="lazy" onError={() => setBroken((b) => new Set(b).add(p.image))} className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform" />
          </div>
          <div className="px-2.5 py-2">
            <p className="text-[13px] leading-snug text-[#0F241D] capitalize line-clamp-1">{p.query}</p>
            <p className="text-[10.5px] text-[#8D9B92] mt-0.5 line-clamp-1">Photo: {p.credit}, {p.license}</p>
          </div>
        </a>
      ))}
    </div>
  )
}

interface ProductCard {
  slug: string
  name: string
  image: string | null
  category: string
}

function ProductCards({ products }: { products: ProductCard[] }) {
  return (
    <div className="guide-scroll mt-2 flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1">
      {products.map((p) => (
        <a
          key={p.slug}
          href={`/products/${p.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group shrink-0 w-[150px] sm:w-[170px] snap-start block overflow-hidden rounded-2xl border border-[#E3E8E1] bg-[#FFFFFF] hover:border-[#183D33] transition-colors"
        >
          <div className="aspect-square bg-[#EEF1EC] overflow-hidden">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform" />
            ) : null}
          </div>
          <div className="px-2.5 py-2">
            <p className="text-[13px] leading-snug text-[#0F241D] line-clamp-2">{p.name}</p>
            <p className="text-[11.5px] text-[#6B7E72] mt-0.5">{p.category}</p>
          </div>
        </a>
      ))}
    </div>
  )
}

const WHATSAPP_URL = `https://wa.me/919588007925?text=${encodeURIComponent('Hi Pranjal, I was chatting with Solomon AI and would like help sourcing products from India.')}`

function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-[13.5px] font-[600] text-[#08301A] hover:brightness-95"
    >
      <MessageCircle size={16} aria-hidden="true" /> Chat with Pranjal on WhatsApp
    </a>
  )
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage blocked: the chat still works for this visit.
  }
}

function Avatar({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full grid place-items-center font-[600] text-white bg-[radial-gradient(circle_at_30%_30%,#3F7F67,#183D33_60%,#0F241D)]"
    >
      S
    </span>
  )
}

function DetailsForm({ onStarted }: { onStarted: (token: string, name: string) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('United Kingdom')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.post('/guide/start', { name, email, phone, country })
      onStarted(res.data.data.token, res.data.data.name)
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const field = 'h-12 rounded-lg border border-[#E3E8E1] bg-[#F5F5F0] px-4 text-[15px] text-[#0F241D] placeholder:text-[#8D9B92] focus:outline-none focus:border-[#183D33] focus:ring-2 focus:ring-[#183D33]/10'
  return (
    <form onSubmit={submit} className="w-full max-w-[460px] bg-[#FFFFFF] border border-[#E3E8E1] rounded-2xl p-6 sm:p-8 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar size={44} />
        <div>
          <p className="font-[600] text-[#0F241D]">Solomon AI</p>
          <p className="text-[13px] text-[#6B7E72]">Your India sourcing and export guide</p>
        </div>
      </div>
      <p className="text-[14px] text-[#3D5248]">Tell us who you are and start chatting. It&apos;s free, and our team can follow up if you want help sourcing.</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-[600] text-[#3D5248]">Your name *</span>
        <input id="guide-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={field} autoComplete="name" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-[600] text-[#3D5248]">Email *</span>
        <input id="guide-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className={field} autoComplete="email" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-[600] text-[#3D5248]">Phone / WhatsApp *</span>
        <input id="guide-phone" required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 900123" className={field} autoComplete="tel" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-[600] text-[#3D5248]">Where do you live?</span>
        <select id="guide-country" value={country} onChange={(e) => setCountry(e.target.value)} className={field}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      {error && <p className="text-[13px] text-[#B42318]" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="h-12 rounded-lg bg-[#183D33] text-white font-[700] text-[15px] hover:bg-[#24503F] transition-colors disabled:opacity-60">
        {busy ? 'Starting…' : 'Start chatting'}
      </button>
      <p className="text-[12px] text-[#8D9B92]">By continuing you agree to our Terms and Privacy Policy. We use your details to reply and follow up about your enquiry.</p>
    </form>
  )
}

function TypingBubble({ label }: { label?: string }) {
  return (
    <div className="flex gap-2.5 items-end guide-in">
      <Avatar size={28} />
      <div className="bg-[#F1F3EF] rounded-2xl rounded-bl-md px-4 py-3.5 flex items-center gap-2" aria-label="Solomon AI is typing">
        <span className="flex gap-1.5">
          {[0, 1, 2].map((d) => (
            <span key={d} className="w-2 h-2 rounded-full bg-[#8D9B92] animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
          ))}
        </span>
        {label && <span className="text-[12.5px] text-[#6B7E72]">{label}</span>}
      </div>
    </div>
  )
}

function timeOf(at?: string) {
  if (!at) return ''
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-end guide-in">
      <Avatar size={28} />
      <div className="bg-[#F1F3EF] rounded-2xl rounded-bl-md px-4 py-2.5 text-[15px] leading-[1.55] text-[#0F241D] max-w-[80%]">{children}</div>
    </div>
  )
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="self-end max-w-[80%] bg-[#183D33] text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-[1.55] whitespace-pre-wrap break-words guide-in">
      {children}
    </div>
  )
}

// ─── Intake: a few tap-to-answer questions before the first recommendation ───

const CURRENCY: Record<string, string> = {
  'United Kingdom': '£', 'United States': '$', Canada: 'C$', Australia: 'A$', 'New Zealand': 'NZ$', Singapore: 'S$',
  'United Arab Emirates': 'AED ', India: '₹', Japan: '¥', Switzerland: 'CHF ', 'South Africa': 'R', Thailand: '฿',
  Sweden: 'SEK ', Norway: 'NOK ', Denmark: 'DKK ',
}
const EURO = ['France', 'Germany', 'Netherlands', 'Belgium', 'Italy', 'Spain', 'Portugal', 'Ireland', 'Austria', 'Finland', 'Greece', 'Luxembourg']
const currencyFor = (country: string | null) => (country && (CURRENCY[country] ?? (EURO.includes(country) ? '€' : null))) || '$'

const FALLBACK_CATEGORIES = ['Home Décor', 'Home Textiles', 'Kitchen & Dining', 'Pottery & Ceramics', 'Bags & Accessories', 'Jewellery', 'Wood Crafts', 'Metal Crafts', 'Baskets & Natural Fibres', 'Furniture']

interface IntakeStep {
  id: 'role' | 'audience' | 'categories' | 'price'
  ask: (first: string) => string
  multi: boolean
  options: string[]
}

function buildSteps(categories: string[], cur: string): IntakeStep[] {
  return [
    {
      id: 'role',
      ask: (first) => `Hi ${first} 👋 I'll ask you 4 quick questions so I can suggest products that genuinely fit you. First, what do you do?`,
      multi: false,
      options: ['I run my own brand', 'I have a shop or boutique', 'I sell online', 'I want to start a business', "I'm just exploring"],
    },
    {
      id: 'audience',
      ask: () => 'Nice. Who would you love to sell to? Pick as many as you like.',
      multi: true,
      options: ['Young professionals', 'Premium and luxury buyers', 'Eco-conscious shoppers', 'Gift buyers', 'Home and interior lovers', 'Hotels, cafés and offices', 'Not sure yet'],
    },
    {
      id: 'categories',
      ask: () => 'Which kinds of products are you drawn to?',
      multi: true,
      options: categories.length ? categories : FALLBACK_CATEGORIES,
    },
    {
      id: 'price',
      ask: () => 'Last one: roughly what price would you like to sell each piece at?',
      multi: false,
      options: [`Under ${cur}20`, `${cur}20 to ${cur}50`, `${cur}50 to ${cur}100`, `Over ${cur}100`, 'Not sure yet'],
    },
  ]
}

function profileMessage(answers: Record<string, string[]>, country: string | null) {
  return [
    `About me: ${answers.role?.[0] ?? ''}${country ? `, based in ${country}` : ''}.`,
    `I want to sell to: ${(answers.audience ?? []).join(', ')}.`,
    `Products I like: ${(answers.categories ?? []).join(', ')}.`,
    `Selling price per piece: ${answers.price?.[0] ?? 'not sure'}.`,
    'What should I sell?',
  ].join('\n')
}

function OptionChips({ step, onDone }: { step: IntakeStep; onDone: (values: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>([])
  return (
    <div className="pl-[38px] flex flex-col gap-2.5 guide-in">
      <div className="flex flex-wrap gap-2">
        {step.options.map((o) => {
          const on = picked.includes(o)
          return (
            <button
              key={o}
              type="button"
              aria-pressed={step.multi ? on : undefined}
              onClick={() => (step.multi ? setPicked((p) => (on ? p.filter((x) => x !== o) : [...p, o])) : onDone([o]))}
              className={cn(
                'text-[13.5px] px-3.5 py-2 rounded-full border transition-colors',
                on ? 'bg-[#183D33] border-[#183D33] text-white' : 'bg-white border-[#D5DDD5] text-[#183D33] hover:border-[#183D33]',
              )}
            >
              {on && '✓ '}
              {o}
            </button>
          )
        })}
      </div>
      {step.multi && (
        <button
          type="button"
          disabled={!picked.length}
          onClick={() => onDone(picked)}
          className="self-start h-10 px-5 rounded-full bg-[#183D33] text-white text-[14px] font-[600] hover:bg-[#24503F] disabled:opacity-35 transition-colors"
        >
          Continue{picked.length ? ` (${picked.length})` : ''}
        </button>
      )}
    </div>
  )
}

function SavedPanel({ items, onClose }: { items: GuideSavedItem[]; onClose: () => void }) {
  return (
    <div className="absolute right-3 top-[60px] z-20 w-[300px] max-h-[60vh] overflow-y-auto rounded-2xl bg-white border border-[#E3E8E1] shadow-[0_20px_50px_-20px_rgba(15,36,29,0.4)] p-3 guide-in">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-[14px] font-[600] text-[#0F241D]">Your shortlist</p>
        <button type="button" onClick={onClose} className="text-[12.5px] text-[#6B7E72] hover:text-[#0F241D]">Close</button>
      </div>
      {items.length === 0 ? (
        <p className="px-1 pb-2 text-[13px] text-[#6B7E72]">Tap ♥ or the bookmark on any product to keep it here.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((it) => (
            <li key={it.key}>
              <a href={it.link ?? undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-[#F5F5F0]">
                <span className="w-11 h-11 rounded-lg bg-[#EEF1EC] overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.image && <img src={it.image} alt="" className="w-full h-full object-cover" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] text-[#0F241D] truncate">{it.name}</span>
                  <span className="text-[11.5px] text-[#6B7E72]">{[it.liked && '♥ Liked', it.saved && 'Saved'].filter(Boolean).join(' · ')}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Chat({ token, name, onReset }: { token: string; name: string; onReset: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [loaded, setLoaded] = useState(false)
  const [visitorName, setVisitorName] = useState(name)
  const [country, setCountry] = useState<string | null>(null)
  const [saved, setSaved] = useState<GuideSavedItem[]>([])
  const [showSaved, setShowSaved] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { data: tree } = useCategoryTree()

  useEffect(() => {
    api
      .get('/guide/history', { params: { token } })
      .then((res) => {
        const d = res.data.data
        setVisitorName(d.name)
        setCountry(d.country ?? null)
        setTurns(d.messages)
        setSaved(d.saved ?? [])
        setLoaded(true)
      })
      .catch(() => onReset())
  }, [token, onReset])

  const steps = buildSteps((tree ?? []).filter((c) => c.productCount > 0).map((c) => c.name).slice(0, 12), currencyFor(country))
  const stepIndex = steps.findIndex((st) => !answers[st.id])
  const inIntake = loaded && turns.length === 0 && stepIndex !== -1

  useEffect(() => {
    // Scroll only the message list, never the page. A new answer with product cards is shown
    // from its top, so the visitor reads the intro and sees the photos first.
    const el = scrollRef.current
    if (!el) return
    const lastTurn = turns[turns.length - 1]
    const anchor = el.querySelector<HTMLElement>('[data-last-answer]')
    if (!busy && lastTurn?.role === 'assistant' && lastTurn.picks?.length && anchor) {
      el.scrollTo({ top: anchor.offsetTop - 16, behavior: 'smooth' })
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [turns, busy, answers])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy) return
    setError(null)
    setInput('')
    setTurns((t) => [...t, { role: 'user', content: message, at: new Date().toISOString() }])
    setBusy(true)
    try {
      const res = await api.post('/guide/chat', { token, message }, { timeout: 3 * 60 * 1000 })
      const d = res.data.data
      setTurns((t) => [
        ...t,
        { role: 'assistant', content: d.reply, followUps: d.followUps, whatsapp: d.whatsapp, products: d.products, photos: d.photos, picks: d.picks, note: d.note, at: new Date().toISOString() },
      ])
    } catch (err) {
      setError(getApiError(err))
      setTurns((t) => t.slice(0, -1))
      setInput(message)
    } finally {
      setBusy(false)
    }
  }

  function answer(step: IntakeStep, values: string[]) {
    const next = { ...answers, [step.id]: values }
    setAnswers(next)
    if (steps.every((st) => next[st.id])) void send(profileMessage(next, country))
  }

  async function toggle(pick: GuidePick, kind: 'liked' | 'saved', on: boolean) {
    const item = { key: pick.key, name: pick.name, image: pick.image, link: pick.link }
    // Update at once; the server confirms in the background.
    setSaved((list) => {
      const cur = list.find((x) => x.key === pick.key) ?? { ...item, liked: false, saved: false }
      const nextItem = { ...cur, [kind]: on }
      const rest = list.filter((x) => x.key !== pick.key)
      return nextItem.liked || nextItem.saved ? [nextItem, ...rest] : rest
    })
    try {
      const res = await api.post('/guide/saved', { token, item, kind, on })
      setSaved(res.data.data)
    } catch {
      // Keep the local state; it will sync next time.
    }
  }

  const first = visitorName.split(' ')[0]
  const last = turns[turns.length - 1]
  const chips = !busy && last?.role === 'assistant' ? last.followUps ?? [] : []
  const savedByKey = new Map(saved.map((x) => [x.key, x]))
  const shortlist = saved.filter((x) => x.liked || x.saved)

  return (
    <div className="relative w-full max-w-[860px] flex flex-col flex-1 min-h-0 bg-white sm:border sm:border-[#E3E8E1] sm:rounded-3xl overflow-hidden sm:shadow-[0_20px_60px_-30px_rgba(15,36,29,0.35)]">
      <style>{`@keyframes guideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.guide-in{animation:guideIn .25s ease-out both}.guide-scroll::-webkit-scrollbar{display:none}.guide-scroll{scrollbar-width:none}`}</style>

      <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#E3E8E1] bg-white">
        <div className="flex items-center gap-3">
          <span className="relative">
            <Avatar size={40} />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#3DDC84] ring-2 ring-white" aria-hidden="true" />
          </span>
          <div>
            <p className="font-[600] text-[15px] text-[#0F241D] leading-tight">Solomon AI</p>
            <p className="text-[12px] text-[#6B7E72]">{busy ? 'typing…' : 'Online'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSaved((v) => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12.5px] text-[#183D33] border border-[#E3E8E1] hover:border-[#183D33] transition-colors"
          >
            <Heart size={13} className={shortlist.length ? 'fill-[#E0475B] text-[#E0475B]' : ''} aria-hidden="true" />
            <span className="hidden sm:inline">Shortlist</span>
            {shortlist.length ? <span className="sm:ml-0.5">{shortlist.length}</span> : null}
          </button>
          <button type="button" onClick={onReset} aria-label="New chat" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12.5px] text-[#3D5248] border border-[#E3E8E1] hover:border-[#183D33] hover:text-[#183D33] transition-colors">
            <RotateCcw size={13} aria-hidden="true" /> <span className="hidden sm:inline">New chat</span>
          </button>
        </div>
      </header>
      {showSaved && <SavedPanel items={shortlist} onClose={() => setShowSaved(false)} />}

      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-5 py-5 flex flex-col gap-3" aria-live="polite">
        {turns.length === 0 &&
          steps.map((st, i) => {
            if (!loaded || (stepIndex !== -1 && i > stepIndex)) return null
            const done = answers[st.id]
            return (
              <div key={st.id} className="flex flex-col gap-3">
                <BotBubble>{st.ask(first)}</BotBubble>
                {done ? <UserBubble>{done.join(', ')}</UserBubble> : <OptionChips step={st} onDone={(v) => answer(st, v)} />}
              </div>
            )
          })}

        {turns.map((t, i) => {
          const showTime = i === turns.length - 1 || turns[i + 1]?.role !== t.role
          return t.role === 'user' ? (
            <div key={i} className="self-end flex flex-col items-end max-w-[80%] guide-in">
              <div className="bg-[#183D33] text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-[1.55] whitespace-pre-wrap break-words">{t.content}</div>
              {showTime && <span className="text-[10.5px] text-[#8D9B92] mt-1">{timeOf(t.at)}</span>}
            </div>
          ) : (
            <div key={i} data-last-answer={i === turns.length - 1 ? '' : undefined} className="flex gap-2.5 items-start guide-in">
              <span className="mt-auto"><Avatar size={28} /></span>
              <div className="flex flex-col gap-2.5 min-w-0 flex-1">
                {t.content && (
                  <div className="self-start max-w-[92%] sm:max-w-[80%] bg-[#F1F3EF] rounded-2xl rounded-bl-md px-4 py-2.5 text-[15px] leading-[1.55] text-[#0F241D] break-words">
                    <GuideMarkdown text={t.content} />
                  </div>
                )}
                {!!t.picks?.length && (
                  <div className="guide-scroll -mr-3 sm:-mr-5 pr-3 sm:pr-5 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
                    {t.picks.map((pk) => (
                      <GuidePickCard key={pk.key} pick={pk} state={savedByKey.get(pk.key)} onToggle={toggle} />
                    ))}
                  </div>
                )}
                {t.note && (
                  <div className="self-start max-w-[92%] sm:max-w-[80%] bg-[#F1F3EF] rounded-2xl rounded-bl-md px-4 py-2.5 text-[15px] leading-[1.55] text-[#0F241D] break-words">
                    <GuideMarkdown text={t.note} />
                  </div>
                )}
                {!!t.products?.length && <ProductCards products={t.products} />}
                {!!t.photos?.length && <WebPhotos photos={t.photos} />}
                {t.whatsapp && <WhatsAppButton />}
                {showTime && <span className="text-[10.5px] text-[#8D9B92]">{timeOf(t.at)}</span>}
              </div>
            </div>
          )
        })}
        {busy && <TypingBubble label={turns.length <= 1 ? 'Finding products that fit you…' : undefined} />}
      </div>

      <div className="border-t border-[#E3E8E1] bg-white px-3 sm:px-4 pt-2.5 pb-3">
        {chips.length > 0 && (
          <div className="guide-scroll flex gap-2 overflow-x-auto pb-2.5 -mx-1 px-1">
            {chips.map((f) => (
              <button key={f} type="button" onClick={() => void send(f)} className="shrink-0 text-[13px] px-3.5 py-1.5 rounded-full bg-[#F1F3EF] text-[#183D33] hover:bg-[#E6EBE5] transition-colors">
                {f}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-[13px] text-[#B42318] pb-2" role="alert">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            id="guide-message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={inIntake ? 'Tap an answer above, or type your own' : 'Type a message'}
            aria-label="Your message"
            className="flex-1 resize-none rounded-3xl bg-[#F5F5F0] border border-[#E3E8E1] px-4 py-2.5 text-[15px] leading-[1.45] text-[#0F241D] placeholder:text-[#8D9B92] focus:outline-none focus:border-[#183D33] focus:ring-2 focus:ring-[#183D33]/10"
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="w-11 h-11 shrink-0 rounded-full bg-[#183D33] text-white grid place-items-center hover:bg-[#24503F] transition-colors disabled:opacity-40">
            <ArrowUp size={19} />
          </button>
        </form>
        <p className="text-[10.5px] text-[#8D9B92] mt-2 text-center">Costs are estimates. Double-check duty rates before you order.</p>
      </div>
    </div>
  )
}

export default function GuidePage() {
  const [session, setSession] = useState<{ token: string; name: string } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = readToken()
    // Reading device storage after mount; it can't be known during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) setSession({ token, name: 'there' })
    setReady(true)
  }, [])

  return (
    <div className={cn('bg-[#F5F5F0] flex flex-col', session ? 'h-[100svh] overflow-hidden' : 'min-h-screen')}>
      <NavBar />
      <main className={cn('flex-1 flex flex-col items-center', session ? 'min-h-0 sm:px-4 sm:py-5' : 'px-4 py-8 sm:py-12')}>
        {!session && (
          <div className="w-full max-w-[1040px] grid lg:grid-cols-[1fr_460px] gap-10 items-center">
            <div className="flex flex-col gap-4">
              <p className="text-[12px] tracking-[0.14em] uppercase font-[700] text-[#B8862F]">Solomon AI</p>
              <h1 className="font-display text-[34px] sm:text-[44px] leading-[1.1] text-[#0F241D]">Plan your Indian craft business with an AI export guide.</h1>
              <p className="text-[16px] text-[#3D5248] max-w-[520px]">
                Ask what to sell in your country, what it costs to bring it over (product, shipping, duty and VAT), where to sell it, and what to register. Answers are based on Solomon Bharat&apos;s own sourcing knowledge from Jaipur.
              </p>
              <ul className="flex flex-col gap-2 text-[14px] text-[#6B7E72]">
                <li>✓ Product ideas for your budget and goal</li>
                <li>✓ Landed cost and margin, explained simply</li>
                <li>✓ Marketplaces, registration and documents for your country</li>
              </ul>
            </div>
            {ready && <DetailsForm onStarted={(token, name) => { writeToken(token); setSession({ token, name }) }} />}
          </div>
        )}
        {session && (
          <Chat
            token={session.token}
            name={session.name}
            onReset={() => {
              writeToken(null)
              setSession(null)
            }}
          />
        )}
      </main>
    </div>
  )
}
