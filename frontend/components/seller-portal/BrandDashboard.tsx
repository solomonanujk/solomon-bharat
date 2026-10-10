'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, BadgeCheck, Hourglass, Percent, Plus, ShoppingBag, TrendingUp, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMyBrand, useMyBrandStats } from '@/hooks/queries/useBrandPortal'
import { formatINR } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function Stat({ label, value, icon: Icon, hint }: {
  label: string
  value: string
  icon: React.ElementType
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-[500] font-sans text-muted">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-ivory flex items-center justify-center">
          <Icon size={15} className="text-forest" aria-hidden="true" />
        </div>
      </div>
      <p className="text-[26px] font-[700] font-sans leading-none tabular-nums text-ink">{value}</p>
      {hint && <p className="text-[11px] font-sans text-muted leading-snug">{hint}</p>}
    </div>
  )
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function BrandDashboard() {
  const brandQ = useMyBrand()
  const statsQ = useMyBrandStats()
  const brand = brandQ.data
  const stats = statsQ.data

  const days = stats?.last30Days ?? []
  const last30Orders = days.reduce((sum, d) => sum + d.orders, 0)
  const last30Gmv = days.reduce((sum, d) => sum + d.gmv, 0)
  const bestDay = days.reduce<(typeof days)[number] | null>((best, d) => (best === null || d.gmv > best.gmv ? d : best), null)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[12px] font-[600] font-sans text-brass-dark tracking-[0.06em] uppercase mb-1">Brand dashboard</p>
          <h1 className="type-h2 text-ink flex items-center gap-2">
            {brand?.name ?? 'Your brand'}
            {brand?.isVerified && <BadgeCheck size={20} className="text-forest" aria-label="Verified brand" />}
          </h1>
          <p className="text-[13.5px] font-sans text-muted mt-0.5">Sales, commission and payouts for your brand.</p>
        </div>
        <Link href="/portal/products/new" className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'gap-2')}>
          <Plus size={14} aria-hidden="true" />
          Add product
        </Link>
      </div>

      {brand?.status === 'SUSPENDED' && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-error/40 bg-white p-4">
          <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[13px] font-sans text-ink">
            Your brand is suspended. Your products are hidden from buyers until Solomon Bharat reinstates it.{' '}
            <Link href="/portal/brand" className="underline text-forest">See brand profile</Link>
          </p>
        </div>
      )}

      {statsQ.isError ? (
        <p className="text-[14px] font-sans text-error" role="alert">Could not load your sales numbers.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Stat label="Orders" value={stats ? String(stats.ordersCount) : '—'} icon={ShoppingBag} hint="Paid orders" />
          <Stat label="Gross sales (GMV)" value={stats ? formatINR(stats.gmv) : '—'} icon={TrendingUp} hint="What buyers paid you" />
          <Stat label="Commission paid" value={stats ? formatINR(stats.commissionPaid) : '—'} icon={Percent} hint="Solomon Bharat's share" />
          <Stat label="Net earned" value={stats ? formatINR(stats.netEarned) : '—'} icon={Wallet} hint="After commission" />
          <Stat label="Pending payout" value={stats ? formatINR(stats.pendingPayout) : '—'} icon={Hourglass} hint="Paid out manually by Solomon Bharat" />
        </div>
      )}

      <section aria-labelledby="chart-heading" className="rounded-xl border border-line bg-white p-5">
        <h2 id="chart-heading" className="text-[11px] font-[700] font-sans text-brass-dark tracking-[0.1em] uppercase mb-1">
          Last 30 days
        </h2>
        <p className="text-[13px] font-sans text-muted mb-4">
          {statsQ.isLoading
            ? 'Loading…'
            : days.length === 0
              ? 'No sales in the last 30 days yet.'
              : `${last30Orders} order${last30Orders === 1 ? '' : 's'} totalling ${formatINR(last30Gmv)}${
                  bestDay && bestDay.gmv > 0 ? `; best day ${shortDate(bestDay.date)} with ${formatINR(bestDay.gmv)}` : ''
                }.`}
        </p>
        {days.length > 0 && (
          <>
            <div className="h-[220px]" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#E5DCCB" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#665F55' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: '#665F55' }} width={48} allowDecimals={false} />
                  <Tooltip
                    formatter={(v) => [formatINR(Number(v)), 'Sales']}
                    labelFormatter={(l) => shortDate(String(l))}
                  />
                  <Bar dataKey="gmv" fill="#183D33" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-3">
              <summary className="text-[12px] font-[600] font-sans text-forest cursor-pointer">View as table</summary>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-[12.5px] font-sans">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-1.5 pr-4 font-[600]">Date</th>
                      <th className="py-1.5 pr-4 font-[600]">Orders</th>
                      <th className="py-1.5 font-[600]">Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.filter((d) => d.orders > 0 || d.gmv > 0).map((d) => (
                      <tr key={d.date} className="border-t border-line">
                        <td className="py-1.5 pr-4">{shortDate(d.date)}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{d.orders}</td>
                        <td className="py-1.5 tabular-nums">{formatINR(d.gmv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>

      <section aria-labelledby="top-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="top-heading" className="text-[11px] font-[700] font-sans text-brass-dark tracking-[0.1em] uppercase">Top products</h2>
          <Link href="/portal/products" className="flex items-center gap-1 text-[12px] font-[600] font-sans text-forest hover:underline">
            All products <ArrowRight size={11} aria-hidden="true" />
          </Link>
        </div>
        <div className="rounded-xl border border-line bg-white overflow-x-auto">
          {(stats?.topProducts.length ?? 0) === 0 ? (
            <p className="p-8 text-center text-[13.5px] font-sans text-muted">
              {statsQ.isLoading ? 'Loading…' : 'Your best sellers will appear here once you have sales.'}
            </p>
          ) : (
            <table className="w-full min-w-[360px] text-[13px] font-sans">
              <thead>
                <tr className="bg-ivory text-left text-[11px] uppercase tracking-[0.07em] text-muted">
                  <th className="px-5 py-2.5 font-[700]">Product</th>
                  <th className="px-5 py-2.5 font-[700]">Units</th>
                  <th className="px-5 py-2.5 font-[700]">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats!.topProducts.map((p) => (
                  <tr key={p.productId}>
                    <td className="px-5 py-3 font-[500] text-ink">{p.name}</td>
                    <td className="px-5 py-3 tabular-nums">{p.units}</td>
                    <td className="px-5 py-3 tabular-nums">{formatINR(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
