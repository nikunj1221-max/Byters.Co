import type { ReactNode } from 'react'
import type { Status, Tier } from './lib/model'
import { TIER_LABEL, TIER_NAME } from './lib/model'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-stone-200/80 bg-white', className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-3.5">
          <h3 className="text-[13px] font-semibold tracking-wide text-stone-800">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'accent'
export function Btn({ children, variant = 'outline', className, size = 'md', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' && 'h-7 px-2.5 text-xs',
        size === 'md' && 'h-9 px-3.5 text-sm',
        size === 'lg' && 'h-13 px-5 text-base',
        variant === 'primary' && 'bg-stone-900 text-amber-50 hover:bg-stone-700',
        variant === 'accent' && 'bg-[#b5562b] text-white hover:bg-[#9a4723]',
        variant === 'outline' && 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50',
        variant === 'ghost' && 'text-stone-600 hover:bg-stone-100',
        variant === 'danger' && 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'stone', className }: { children: ReactNode; tone?: 'stone' | 'green' | 'amber' | 'red' | 'blue' | 'clay' | 'violet'; className?: string }) {
  const t = {
    stone: 'bg-stone-100 text-stone-700',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    blue: 'bg-sky-50 text-sky-700 ring-sky-200',
    clay: 'bg-orange-50 text-[#9a4723] ring-orange-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ring-transparent', t, className)}>{children}</span>
}

export function StatusBadge({ status, pct }: { status: Status; pct: number }) {
  if (status === 'active') return <Badge tone="green">Active</Badge>
  if (status === 'reduced') return <Badge tone="amber">Reduced −{pct}%</Badge>
  if (status === 'paused') return <Badge tone="blue">Paused</Badge>
  return <Badge tone="red">Closed</Badge>
}

export function TierBadge({ tier, cafe }: { tier: Tier; cafe?: boolean }) {
  const tone = tier === 'T0' ? 'violet' : tier === 'T1' ? 'blue' : 'stone'
  return <Badge tone={tone}>{cafe ? TIER_LABEL[tier] : TIER_NAME[tier]}</Badge>
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'red' | 'amber' | 'green' }) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white px-4 py-3.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">{label}</div>
      <div className={cx('mt-1 font-display text-[28px] leading-none', tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-stone-900')}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-stone-500">{sub}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-950/40 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div className={cx('w-full rounded-2xl bg-white shadow-2xl', wide ? 'max-w-3xl' : 'max-w-md')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="font-display text-xl text-stone-900">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 text-xl leading-none text-stone-400 hover:text-stone-800" aria-label="Close">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-stone-500">{hint}</span>}
    </label>
  )
}
export const inputCls = 'h-9 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'

export function Bar({ value, max, className, tone = 'stone' }: { value: number; max: number; className?: string; tone?: 'stone' | 'red' | 'amber' | 'green' }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-stone-100', className)}>
      <div className={cx('h-full rounded-full', tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'green' ? 'bg-emerald-600' : 'bg-stone-800')} style={{ width: pct + '%' }} />
    </div>
  )
}

/** History line + forecast band chart. */
export function ForecastChart({ history, rate, cv, horizon = 14, height = 160 }: { history: number[]; rate: number; cv: number; horizon?: number; height?: number }) {
  const h = history.slice(-30)
  const f = Array.from({ length: horizon }, () => rate)
  const all = [...h, ...f.map((x) => x * (1 + cv))]
  const max = Math.max(0.5, ...all) * 1.1
  const W = 600
  const n = h.length + horizon
  const x = (i: number) => (i / Math.max(1, n - 1)) * W
  const y = (v: number) => height - (v / max) * (height - 12) - 4
  const line = h.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')
  const start = h.length - 1
  const band = [
    ...f.map((v, i) => `${i ? 'L' : 'M'}${x(start + 1 + i)},${y(v * (1 + cv))}`),
    ...f.map((v, i) => `L${x(start + horizon - i)},${y(v * (1 - cv))}`),
    'Z',
  ].join('')
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {h.length > 0 && <line x1={x(start)} x2={x(start)} y1={0} y2={height} stroke="#d6d3d1" strokeDasharray="3 3" />}
      <path d={band} fill="#b5562b" opacity={0.14} />
      <path d={f.map((v, i) => `${i ? 'L' : 'M'}${x(start + 1 + i)},${y(v)}`).join('')} stroke="#b5562b" strokeWidth={2} strokeDasharray="5 4" fill="none" />
      <path d={line} stroke="#292524" strokeWidth={2} fill="none" />
    </svg>
  )
}
