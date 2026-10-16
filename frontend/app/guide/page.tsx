'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, MessageCircle, RotateCcw } from 'lucide-react'
import { NavBar } from '@/components/shared/NavBar'
import { GuideMarkdown } from '@/components/guide/GuideMarkdown'
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
  followUps?: string[]
  whatsapp?: boolean
  products?: ProductCard[]
}

interface ProductCard {
  slug: string
  name: string
  image: string | null
  category: string
}

function ProductCards({ products }: { products: ProductCard[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5">
      {products.map((p) => (
        <a
          key={p.slug}
          href={`/products/${p.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group block overflow-hidden rounded-xl border border-[#2A473A] bg-[#15291F] hover:border-[#E9A23B] transition-colors"
        >
          <div className="aspect-square bg-[#0F241D] overflow-hidden">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform" />
            ) : null}
          </div>
          <div className="px-2.5 py-2">
            <p className="text-[13px] leading-snug text-[#EEF2EC] line-clamp-2">{p.name}</p>
            <p className="text-[11.5px] text-[#9DB3A6] mt-0.5">{p.category}</p>
          </div>
        </a>
      ))}
    </div>
  )
}

const STARTERS = [
  "I'm looking for the next big product for my brand",
  'I want to start a business with a set budget',
  "I'm curious about business ideas and unique products",
]

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
      className="shrink-0 rounded-full grid place-items-center font-[600] text-[#1A1206] bg-[radial-gradient(circle_at_35%_35%,#F4C77A,#E9A23B_55%,#9C5F12)]"
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

  const field = 'h-12 rounded-lg border border-[#2A473A] bg-[#0E1D18] px-4 text-[15px] text-[#EEF2EC] placeholder:text-[#6F8A7C] focus:outline-none focus:border-[#E9A23B]'
  return (
    <form onSubmit={submit} className="w-full max-w-[460px] bg-[#15291F] border border-[#2A473A] rounded-2xl p-6 sm:p-8 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar size={44} />
        <div>
          <p className="font-[600] text-[#EEF2EC]">Solomon AI</p>
          <p className="text-[13px] text-[#9DB3A6]">Your India sourcing and export guide</p>
        </div>
      </div>
      <p className="text-[14px] text-[#C9D6CC]">Tell us who you are and start chatting. It&apos;s free, and our team can follow up if you want help sourcing.</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-[600] text-[#C9D6CC]">Your name *</span>
        <input id="guide-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={field} autoComplete="name" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-[600] text-[#C9D6CC]">Email *</span>
        <input id="guide-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className={field} autoComplete="email" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-[600] text-[#C9D6CC]">Phone / WhatsApp *</span>
        <input id="guide-phone" required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 900123" className={field} autoComplete="tel" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-[600] text-[#C9D6CC]">Where do you live?</span>
        <select id="guide-country" value={country} onChange={(e) => setCountry(e.target.value)} className={field}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      {error && <p className="text-[13px] text-[#F2A79B]" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="h-12 rounded-lg bg-[#E9A23B] text-[#1A1206] font-[700] text-[15px] hover:bg-[#F0B256] transition-colors disabled:opacity-60">
        {busy ? 'Starting…' : 'Start chatting'}
      </button>
      <p className="text-[12px] text-[#6F8A7C]">By continuing you agree to our Terms and Privacy Policy. We use your details to reply and follow up about your enquiry.</p>
    </form>
  )
}

function Chat({ token, name, onReset }: { token: string; name: string; onReset: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [visitorName, setVisitorName] = useState(name)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .get('/guide/history', { params: { token } })
      .then((res) => {
        setVisitorName(res.data.data.name)
        setTurns(res.data.data.messages.map((m: Turn) => ({ role: m.role, content: m.content, followUps: m.followUps, whatsapp: m.whatsapp, products: m.products })))
      })
      .catch(() => onReset())
  }, [token, onReset])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, busy])

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy) return
    setError(null)
    setInput('')
    setTurns((t) => [...t, { role: 'user', content: message }])
    setBusy(true)
    try {
      const res = await api.post('/guide/chat', { token, message }, { timeout: 3 * 60 * 1000 })
      setTurns((t) => [...t, { role: 'assistant', content: res.data.data.reply, followUps: res.data.data.followUps, whatsapp: res.data.data.whatsapp, products: res.data.data.products }])
    } catch (err) {
      setError(getApiError(err))
      setTurns((t) => t.slice(0, -1))
      setInput(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-[820px] flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#2A473A]">
        <div className="flex items-center gap-3">
          <Avatar />
          <div>
            <p className="font-[600] text-[#EEF2EC]">Solomon AI</p>
            <p className="text-[12.5px] text-[#9DB3A6]">India sourcing and export guide</p>
          </div>
        </div>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1.5 text-[12.5px] text-[#9DB3A6] hover:text-[#EEF2EC]">
          <RotateCcw size={13} aria-hidden="true" /> New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-4" aria-live="polite">
        <div className="flex gap-3 items-start">
          <Avatar size={30} />
          <div className="bg-[#1C3428] border border-[#2A473A] rounded-2xl rounded-tl-sm px-4 py-3 text-[15px] text-[#EEF2EC] max-w-[85%]">
            Hi {visitorName.split(' ')[0]} 👋 Lovely to meet you. Before I suggest anything, I&apos;d like to understand you a little. What brings you here: are you looking for the next big product for your brand, starting a business with a certain budget, or just curious about business ideas and unique products?
          </div>
        </div>
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2 pl-[42px]">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => void send(s)} className="text-left text-[13px] px-3 py-2 rounded-full border border-[#2A473A] text-[#C9D6CC] hover:border-[#E9A23B] hover:text-[#E9A23B] transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="self-end bg-[#E9A23B] text-[#1A1206] rounded-2xl rounded-tr-sm px-4 py-3 text-[15px] max-w-[85%] whitespace-pre-wrap break-words">
              {t.content}
            </div>
          ) : (
            <div key={i} className="flex gap-3 items-start">
              <Avatar size={30} />
              <div className="bg-[#1C3428] border border-[#2A473A] rounded-2xl rounded-tl-sm px-4 py-3 text-[15px] leading-[1.6] text-[#EEF2EC] max-w-[85%] min-w-0 break-words">
                <GuideMarkdown text={t.content} />
                {!!t.products?.length && <ProductCards products={t.products} />}
                {t.whatsapp && <WhatsAppButton />}
              </div>
            </div>
          ),
        )}
        {!busy && (() => {
          const last = turns[turns.length - 1]
          if (last?.role !== 'assistant' || !last.followUps?.length) return null
          return (
            <div className="flex flex-wrap gap-2 pl-[42px]">
              {last.followUps.map((f) => (
                <button key={f} type="button" onClick={() => void send(f)} className="text-left text-[13px] px-3 py-2 rounded-full border border-[#2A473A] text-[#C9D6CC] hover:border-[#E9A23B] hover:text-[#E9A23B] transition-colors">
                  {f}
                </button>
              ))}
            </div>
          )
        })()}
        {busy && (
          <div className="flex gap-3 items-center">
            <Avatar size={30} />
            <span className="text-[13px] text-[#9DB3A6]">Solomon AI is typing…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="text-[13px] text-[#F2A79B] pb-2" role="alert">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="flex items-end gap-2 bg-[#15291F] border border-[#2A473A] rounded-2xl p-2 focus-within:border-[#E9A23B]"
      >
        <textarea
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
          placeholder="Ask about products, costs, shipping, selling…"
          aria-label="Your message"
          className="flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-[#EEF2EC] placeholder:text-[#6F8A7C] focus:outline-none max-h-40"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="w-10 h-10 rounded-xl bg-[#E9A23B] text-[#1A1206] grid place-items-center disabled:opacity-40">
          <ArrowUp size={18} />
        </button>
      </form>
      <p className="text-[11.5px] text-[#6F8A7C] mt-2 text-center">Solomon AI can make mistakes. Check important figures such as duty rates before you act on them.</p>
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
    <div className="min-h-screen bg-[#0E1D18] flex flex-col">
      <NavBar />
      <main className={cn('flex-1 flex flex-col items-center px-4 py-8 sm:py-12', session && 'h-[calc(100vh-120px)]')}>
        {!session && (
          <div className="w-full max-w-[1040px] grid lg:grid-cols-[1fr_460px] gap-10 items-center">
            <div className="flex flex-col gap-4">
              <p className="text-[12px] tracking-[0.14em] uppercase font-[700] text-[#E9A23B]">Solomon AI</p>
              <h1 className="font-display text-[34px] sm:text-[44px] leading-[1.1] text-[#EEF2EC]">Plan your Indian craft business with an AI export guide.</h1>
              <p className="text-[16px] text-[#C9D6CC] max-w-[520px]">
                Ask what to sell in your country, what it costs to bring it over (product, shipping, duty and VAT), where to sell it, and what to register. Answers are based on Solomon Bharat&apos;s own sourcing knowledge from Jaipur.
              </p>
              <ul className="flex flex-col gap-2 text-[14px] text-[#9DB3A6]">
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
