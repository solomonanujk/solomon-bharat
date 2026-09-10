'use client'

import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/lib/store/useAuthStore'

// ─── Data ─────────────────────────────────────────────────────────────────────

const AUDIENCES = ['store', 'boutique', 'pop up', 'exhibitions']

const HERO_VIDEO_SRC =
  'https://res.cloudinary.com/dxnqyvcdl/video/upload/q_auto,f_auto/v1789016854/Handwoven_Textile____Threads_o_k286tz.mp4'

// ─── Cycling audience word ────────────────────────────────────────────────────

function CyclingAudience() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % AUDIENCES.length)
        setVisible(true)
      }, 350)
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  return (
    <span
      className="font-[600] text-[#F0C468] transition-opacity duration-300 ease-out"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {AUDIENCES[index]}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HeroSection() {
  const openAuthModal = useAuthStore((s) => s.openAuthModal)

  return (
    <section className="relative overflow-hidden min-h-[580px] h-[90vh] tracking-[0.02em]">

      {/* Full-bleed background video — no overlay */}
      <video
        src={HERO_VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-right"
      />

      {/* Faint left-side scrim — just enough for text contrast, video stays visible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.05) 70%, rgba(0,0,0,0) 100%)' }}
        aria-hidden="true"
      />

      {/* Content overlaid on the left */}
      <div className="relative z-10 flex items-center h-full absolute inset-0">
        <div className="w-full px-5 sm:px-8 md:px-10 lg:px-16 py-12 sm:py-16 lg:py-20">
          <div className="max-w-[520px]">

            {/* Headline */}
            <h1 className="font-playfair font-[500] text-white leading-[1.05] text-[26px] sm:text-[34px] lg:text-[44px]">
              Find your <span className="text-[#F0C468]">winning product</span>
            </h1>

            {/* Body */}
            <p className="font-public-sans text-[14px] sm:text-[15px] font-[300] leading-[1.65] text-white/85 mt-4 sm:mt-6 max-w-[400px]">
              Sign up to unlock wholesale pricing.
            </p>

            {/* CTA */}
            <div className="mt-8">
              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="inline-flex items-center gap-2 rounded bg-white text-primary font-[500] font-public-sans text-[14px] px-6 py-3 hover:bg-white/90 transition-colors"
              >
                Sign Up to Buy
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>

            {/* Audience line */}
            <p className="font-public-sans text-[14px] sm:text-[15px] font-[400] text-white mt-8 sm:mt-10">
              Discover and source bestseller product for your <CyclingAudience />
            </p>

          </div>
        </div>
      </div>

    </section>
  )
}
