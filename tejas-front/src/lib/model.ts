export type Status = 'active' | 'reduced' | 'paused' | 'closed'
export type CafeType = 'specialty' | 'chain' | 'restaurant' | 'barista_school' | 'hotel'
export type Tier = 'T0' | 'T1' | 'T2'
export type OrderStatus = 'draft' | 'snoozed' | 'confirmed' | 'roasting' | 'dispatched' | 'delivered' | 'cancelled'

export interface Bean {
  id: string
  name: string
  origin: string
  lot: string
  cert: string
  roast: 'light' | 'medium' | 'medium-dark'
  family: string
  shelfLife: number
  peakDays: number
  bagKg: number
  pricePerKg: number
  singleOrigin: boolean
  traceScore: number
  lotKg: number
}

export interface CafeBean {
  sku: string
  onHand: number | null
  lastCount: number
  histStart: number
  history: number[]
  prior: number
}

export interface StatusChange {
  ts: number
  status: Status
  pct: number
  reason: string
  by: string
  effective: number
}

export interface Cafe {
  id: string
  name: string
  owner: string
  phone: string
  email: string
  address: string
  city: string
  type: CafeType
  seats: number
  cupsPerDay?: number
  status: Status
  reductionPct: number
  reopenDay?: number
  statusHistory: StatusChange[]
  safetyDays: number
  leadDays: number
  coverDays: number
  minOrderKg: number
  contract: string
  paymentTerms: string
  standing: boolean
  approved: boolean
  onboarded: number
  counts: number
  optIn: { whatsapp: boolean; email: boolean }
  language: string
  summaryDay: number
  beans: CafeBean[]
  notes: { ts: number; text: string }[]
  events: number[]
}

export interface Order {
  id: string
  cafeId: string
  sku: string
  qty: number
  status: OrderStatus
  type: 'standing' | 'forecast' | 'rush' | 'manual'
  neededBy: number
  createdAt: number
  confirmedAt?: number
  confirmedBy?: string
  reason?: string
  subSku?: string
  subAccepted?: boolean
  snoozeUntil?: number
  edited?: boolean
  flag?: string
}

export interface Alert {
  id: string
  ts: number
  to: string
  kind: 'info' | 'warn' | 'risk' | 'ok'
  text: string
}

export interface Msg {
  id: string
  ts: number
  cafeId: string
  channel: 'whatsapp' | 'email'
  status: 'sent' | 'failed'
  body: string
  attempts: number
  error?: string
}

export interface Audit {
  id: string
  ts: number
  who: string
  what: string
}

export interface Settings {
  capacity: number[]
  coRoast: number[]
  safetyDefault: number
  leadDefault: number
  mapeThreshold: number
  alpha: number
  window: number
  gramsPerCup: number
  waste: number
  utilAlert: number
}

export interface State {
  version: number
  beans: Bean[]
  cafes: Cafe[]
  orders: Order[]
  alerts: Alert[]
  messages: Msg[]
  audit: Audit[]
  settings: Settings
  moves: Record<string, number>
  rejected: string[]
  dismissedRisk: string[]
}

// ---------- dates (integer day numbers, local calendar) ----------
export const DAY = 864e5
export const today = () => {
  const d = new Date()
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / DAY)
}
export const weekday = (d: number) => new Date(d * DAY).getUTCDay()
export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const fmtDay = (d: number) =>
  new Date(d * DAY).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
export const fmtShort = (d: number) =>
  new Date(d * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const uid = () => Math.random().toString(36).slice(2, 10)
export const r1 = (n: number) => Math.round(n * 10) / 10
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

export const TYPE_LABEL: Record<CafeType, string> = {
  specialty: 'Specialty café',
  chain: 'Chain outlet',
  restaurant: 'Restaurant',
  barista_school: 'Barista school',
  hotel: 'Hotel',
}
export const TIER_LABEL: Record<Tier, string> = { T0: 'Estimated', T1: 'Learning', T2: 'Reliable' }
export const TIER_NAME: Record<Tier, string> = { T0: 'New', T1: 'Learning', T2: 'Calibrated' }

// Default day-of-week shape (Sun..Sat) per café type, used until a café has 14+ days of data.
export const DOW_SHAPE: Record<CafeType, number[]> = {
  specialty: [1.25, 0.85, 0.85, 0.9, 0.95, 1.05, 1.35],
  chain: [1.1, 0.95, 0.95, 0.95, 1.0, 1.05, 1.15],
  restaurant: [1.3, 0.7, 0.8, 0.85, 0.95, 1.2, 1.4],
  barista_school: [0.2, 1.3, 1.3, 1.3, 1.3, 1.3, 0.3],
  hotel: [1.15, 0.95, 0.9, 0.9, 0.95, 1.05, 1.2],
}
// kg of beans per seat per day, by type (profile-based prior)
export const KG_PER_SEAT: Record<CafeType, number> = {
  specialty: 0.055,
  chain: 0.06,
  restaurant: 0.025,
  barista_school: 0.09,
  hotel: 0.03,
}

export const multiplier = (c: Cafe) =>
  c.status === 'active' ? 1 : c.status === 'reduced' ? 1 - c.reductionPct / 100 : 0

export const isOpen = (o: Order) => ['confirmed', 'roasting', 'dispatched'].includes(o.status)
export const deliveredOrConfirmed = (o: Order) => ['confirmed', 'roasting', 'dispatched', 'delivered'].includes(o.status)

export function tierOf(c: Cafe, orders: Order[]): Tier {
  const hist = Math.max(0, ...c.beans.map((b) => b.history.length))
  const n = orders.filter((o) => o.cafeId === c.id && deliveredOrConfirmed(o)).length
  if (hist >= 28 && n >= 3) return 'T2'
  if (hist > 0 || c.counts > 0) return 'T1'
  return 'T0'
}

export function coldStartPrior(
  input: { type: CafeType; seats: number; cupsPerDay?: number; city: string; days?: number },
  cafes: Cafe[],
  s: Settings,
  beanCount: number,
): { kg: number; method: string } {
  let total: number
  let method: string
  if (input.cupsPerDay && input.cupsPerDay > 0) {
    total = ((input.cupsPerDay * s.gramsPerCup) / 1000) * (1 + s.waste)
    method = `${input.cupsPerDay} cups/day × ${s.gramsPerCup} g + ${Math.round(s.waste * 100)}% waste`
  } else if (input.seats > 0) {
    total = input.seats * KG_PER_SEAT[input.type]
    method = `${input.seats} seats × ${KG_PER_SEAT[input.type]} kg/seat (${TYPE_LABEL[input.type]} default)`
  } else {
    const cohort = cafes
      .filter((c) => c.type === input.type && c.beans.some((b) => b.history.length > 14))
      .map((c) => c.beans.reduce((a, b) => a + avg(b.history.slice(-28)), 0))
      .sort((a, b) => a - b)
    if (cohort.length) {
      total = cohort[Math.floor(cohort.length / 2)]
      method = `Median of ${cohort.length} similar ${TYPE_LABEL[input.type].toLowerCase()}s`
    } else {
      total = 1.5
      method = 'Global default (no similar cafés) — flagged for review'
    }
  }
  return { kg: total / Math.max(1, beanCount), method }
}

export const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)

export function ewma(h: number[], alpha: number, window: number) {
  const xs = h.slice(-window)
  if (!xs.length) return 0
  let v = avg(xs.slice(0, Math.min(3, xs.length)))
  for (const x of xs) v = alpha * x + (1 - alpha) * v
  return v
}

export function dowIndex(cb: CafeBean, type: CafeType): number[] {
  if (cb.history.length < 14) return DOW_SHAPE[type]
  const sums = Array(7).fill(0)
  const ns = Array(7).fill(0)
  cb.history.slice(-56).forEach((v, i, arr) => {
    const day = cb.histStart + cb.history.length - arr.length + i
    sums[weekday(day)] += v
    ns[weekday(day)]++
  })
  const means = sums.map((s, i) => (ns[i] ? s / ns[i] : 0))
  const m = avg(means) || 1
  return means.map((x) => x / m || 1)
}

export interface Forecast {
  sku: string
  noStock: boolean
  tier: Tier
  base: number
  rate: number
  mult: number
  cv: number
  likely: number | null
  earliest: number | null
  latest: number | null
  safety: number
  needsReorder: boolean
  reorderPointDays: number | null
  qty: number
  inbound: number
  explanation: string
}

export function forecast(c: Cafe, cb: CafeBean, st: State, t = today(), tier?: Tier): Forecast {
  const s = st.settings
  const bean = st.beans.find((b) => b.id === cb.sku)!
  tier = tier ?? tierOf(c, st.orders)
  const n = cb.history.length
  const own = ewma(cb.history, s.alpha, s.window)
  const w = n / (n + 14)
  const base = n ? w * own + (1 - w) * cb.prior : cb.prior
  const mult = multiplier(c)
  const rate = base * mult
  const dow = dowIndex(cb, c.type)
  const recent = cb.history.slice(-14)
  const m = avg(recent)
  const sd = recent.length > 2 ? Math.sqrt(avg(recent.map((x) => (x - m) ** 2))) : 0
  let cv = m ? Math.min(0.5, sd / m / Math.sqrt(3)) : 0.35
  if (tier === 'T0') cv = 0.35
  else if (tier === 'T1') cv = Math.max(cv, 0.22)
  else cv = Math.max(cv, 0.08)

  const inboundOrders = st.orders.filter(
    (o) => o.cafeId === c.id && (o.subAccepted ? o.subSku : o.sku) === cb.sku && isOpen(o),
  )
  const inbound = inboundOrders.reduce((a, o) => a + o.qty, 0)
  const safety = c.safetyDays + (tier === 'T0' ? 2 : 0)
  const lead = c.leadDays

  if (cb.onHand == null) {
    return {
      sku: cb.sku, noStock: true, tier, base, rate, mult, cv, likely: null, earliest: null, latest: null,
      safety, needsReorder: false, reorderPointDays: null, qty: 0, inbound,
      explanation: 'No starting stock known — ask the café for bags on shelf.',
    }
  }
  const sim = (scale: number) => {
    if (rate <= 0) return null
    let stock = cb.onHand as number
    for (let d = 0; d < 180; d++) {
      const day = t + d
      for (const o of inboundOrders) if (Math.max(o.neededBy, t) === day) stock += o.qty
      stock -= rate * scale * dow[weekday(day)]
      if (stock <= 0) return d
    }
    return null
  }
  const likely = sim(1)
  const earliest = sim(1 + cv)
  const latest = sim(Math.max(0.3, 1 - cv))
  const reorderPointDays = likely == null ? null : likely - lead - safety
  const needsReorder = c.approved && rate > 0 && reorderPointDays != null && reorderPointDays <= 0
  const cover = Math.min(c.coverDays, bean.peakDays)
  const raw = rate * (cover + lead) - (cb.onHand as number) - inbound
  const qty = raw > 0 ? Math.max(c.minOrderKg, Math.ceil(raw / bean.bagKg) * bean.bagKg) : 0

  const parts: string[] = []
  if (n === 0) parts.push(`cold-start estimate ${r1(cb.prior)} kg/day`)
  else if (w < 0.75) parts.push(`${n} days of data blended ${Math.round(w * 100)}% with prior estimate`)
  else parts.push(`${Math.min(n, s.window)}-day smoothed average ${r1(own)} kg/day`)
  const peak = dow.indexOf(Math.max(...dow))
  if (dow[peak] > 1.12) parts.push(`${WD[peak]} uplift ×${dow[peak].toFixed(2)}`)
  if (c.status === 'reduced') parts.push(`status −${c.reductionPct}%`)
  if (c.status === 'closed' || c.status === 'paused') parts.push(`café ${c.status}, demand 0`)
  if (inbound) parts.push(`${r1(inbound)} kg confirmed inbound`)
  if (cover < c.coverDays) parts.push(`cover capped at ${cover} days for freshness`)

  return {
    sku: cb.sku, noStock: false, tier, base, rate, mult, cv, likely, earliest, latest, safety,
    needsReorder, reorderPointDays, qty, inbound,
    explanation: 'Based on ' + parts.join(', ') + '.',
  }
}

export function findSubstitute(bean: Bean, beans: Bean[], qty: number) {
  return beans.find(
    (b) =>
      b.id !== bean.id &&
      b.roast === bean.roast &&
      b.family === bean.family &&
      b.traceScore >= bean.traceScore &&
      b.lotKg >= qty,
  )
}

export const orderSku = (o: Order) => (o.subAccepted && o.subSku ? o.subSku : o.sku)

/** Keeps forecast drafts in sync with current forecasts. Never touches confirmed orders. */
export function syncDrafts(st: State, t = today()) {
  const now = Date.now()
  for (const o of st.orders) {
    if (o.status === 'snoozed' && (o.snoozeUntil ?? 0) <= now) o.status = 'draft'
  }
  const remove = new Set<string>()
  for (const c of st.cafes) {
    if (!c.approved) continue
    const tier = tierOf(c, st.orders)
    const drafts = st.orders.filter((o) => o.cafeId === c.id && (o.status === 'draft' || o.status === 'snoozed'))
    if (c.status === 'closed' || c.status === 'paused') {
      drafts.forEach((d) => remove.add(d.id))
      continue
    }
    for (const cb of c.beans) {
      const f = forecast(c, cb, st, t, tier)
      const existing = drafts.find((d) => d.sku === cb.sku)
      if (existing) {
        if (existing.status === 'draft' && !existing.edited) {
          if (!f.needsReorder || f.qty <= 0) remove.add(existing.id)
          else existing.qty = f.qty
        }
        continue
      }
      if (f.needsReorder && f.qty > 0) {
        const bean = st.beans.find((b) => b.id === cb.sku)!
        const neededBy = t + Math.max(c.leadDays, Math.min((f.likely ?? c.leadDays) - 1, c.leadDays + 3))
        const sub = bean.lotKg < f.qty ? findSubstitute(bean, st.beans, f.qty) : undefined
        st.orders.push({
          id: uid(), cafeId: c.id, sku: cb.sku, qty: f.qty, status: 'draft', type: 'forecast',
          neededBy, createdAt: now, subSku: sub?.id,
        })
        st.alerts.unshift({
          id: uid(), ts: now, to: c.id, kind: 'warn',
          text: `${bean.name} runs out in ~${f.likely} days. Draft reorder of ${f.qty} kg is ready to confirm.`,
        })
      }
    }
  }
  if (remove.size) st.orders = st.orders.filter((o) => !remove.has(o.id))
  st.alerts = st.alerts.slice(0, 200)
}

// ---------- roasting plan ----------
export interface Batch {
  order: Order
  cafe: Cafe
  bean: Bean
  day: number
  moved: boolean
  locked: boolean
}
export interface PlanDay {
  day: number
  cap: number
  co: number
  used: number
  forecastKg: number
  batches: Batch[]
  drafts: { order: Order; cafe: Cafe; bean: Bean }[]
}
export interface Move {
  orderId: string
  from: number
  to: number
  kg: number
  reason: string
  label: string
}

export function roastDayFor(o: Order, st: State, t: number) {
  return Math.max(t, st.moves[o.id] ?? o.neededBy - 1)
}

export function roastPlan(st: State, t = today()) {
  const days: PlanDay[] = Array.from({ length: 7 }, (_, i) => {
    const day = t + i
    return { day, cap: st.settings.capacity[weekday(day)], co: st.settings.coRoast[weekday(day)], used: 0, forecastKg: 0, batches: [], drafts: [] }
  })
  const bean = (id: string) => st.beans.find((b) => b.id === id)!
  const cafe = (id: string) => st.cafes.find((c) => c.id === id)!
  for (const o of st.orders) {
    if (o.status === 'confirmed' || o.status === 'roasting') {
      const d = roastDayFor(o, st, t)
      const pd = days.find((x) => x.day === d)
      if (!pd) continue
      pd.batches.push({ order: o, cafe: cafe(o.cafeId), bean: bean(orderSku(o)), day: d, moved: o.id in st.moves, locked: o.status === 'roasting' })
      pd.used += o.qty
    } else if (o.status === 'draft' || o.status === 'snoozed') {
      const d = Math.max(t, o.neededBy - 1)
      const pd = days.find((x) => x.day === d)
      if (!pd) continue
      pd.drafts.push({ order: o, cafe: cafe(o.cafeId), bean: bean(orderSku(o)) })
      pd.forecastKg += o.qty
    }
  }
  // Re-balance suggestions: move flexible batches from overloaded days to earlier days.
  const moves: Move[] = []
  const tentative = days.map((d) => d.used)
  days.forEach((pd, i) => {
    let over = tentative[i] - pd.cap
    if (over <= 0) return
    const cands = pd.batches
      .filter((b) => !b.locked && !st.rejected.includes(b.order.id))
      .sort((a, b) => b.bean.shelfLife - a.bean.shelfLife)
    for (const b of cands) {
      if (over <= 0) break
      for (let j = 0; j < i; j++) {
        const target = days[j]
        const freshOk = b.order.neededBy - target.day <= b.bean.peakDays
        if (freshOk && target.cap - tentative[j] >= b.order.qty) {
          tentative[j] += b.order.qty
          tentative[i] -= b.order.qty
          over -= b.order.qty
          moves.push({
            orderId: b.order.id, from: pd.day, to: target.day, kg: b.order.qty,
            label: `Move ${r1(b.order.qty)} kg ${b.bean.name} (${b.cafe.name}) from ${WD[weekday(pd.day)]} to ${WD[weekday(target.day)]}`,
            reason: `Shelf life ${b.bean.shelfLife} days, peak ${b.bean.peakDays}; needed ${fmtDay(b.order.neededBy)}. ${WD[weekday(pd.day)]} is ${r1(pd.used - pd.cap)} kg over capacity.`,
          })
          break
        }
      }
    }
  })
  const cap = days.reduce((a, d) => a + d.cap, 0)
  const used = days.reduce((a, d) => a + d.used, 0)
  const coTotal = days.reduce((a, d) => a + d.co, 0)
  const forecastKg = days.reduce((a, d) => a + d.forecastKg, 0)
  return { days, moves, cap, used, util: cap ? used / cap : 0, unused: days.reduce((a, d) => a + Math.max(0, d.cap - d.used), 0), coTotal, forecastKg }
}

// ---------- back-test ----------
export interface BackPoint { cafeId: string; sku: string; actual: number; pred: number; ape: number; at: number }
export function backtest(st: State, alpha: number, window: number) {
  const pts: BackPoint[] = []
  const cold: Cafe[] = []
  for (const c of st.cafes) {
    if (!c.approved) continue
    if (tierOf(c, st.orders) !== 'T2') { cold.push(c); continue }
    for (const cb of c.beans) {
      const h = cb.history
      let k = 0
      for (let t = 35; t + 15 <= h.length; t += 7, k++) {
        const D = 7 + ((c.id.charCodeAt(c.id.length - 1) + k * 3 + cb.sku.length) % 8)
        const stock = h.slice(t, t + D).reduce((a, b) => a + b, 0)
        const past: CafeBean = { ...cb, history: h.slice(0, t) }
        const rate = ewma(past.history, alpha, window)
        const dow = dowIndex(past, c.type)
        let s = stock, pred = 0
        while (s > 0 && pred < 60) { s -= rate * dow[weekday(cb.histStart + t + pred)]; pred++ }
        pts.push({ cafeId: c.id, sku: cb.sku, actual: D, pred, ape: Math.abs(D - pred) / D, at: t })
      }
    }
  }
  const by = new Map<string, number[]>()
  pts.forEach((p) => by.set(p.cafeId, [...(by.get(p.cafeId) ?? []), p.ape]))
  const perCafe = [...by.entries()].map(([id, a]) => ({ cafe: st.cafes.find((c) => c.id === id)!, mape: avg(a) * 100, n: a.length }))
  const trendMap = new Map<number, number[]>()
  pts.forEach((p) => trendMap.set(p.at, [...(trendMap.get(p.at) ?? []), p.ape]))
  const trend = [...trendMap.entries()].sort((a, b) => a[0] - b[0]).map(([at, a]) => ({ at, mape: avg(a) * 100 }))
  const buckets = [5, 10, 15, 20, 30, 40, Infinity]
  const hist = buckets.map((b, i) => ({
    label: b === Infinity ? '40%+' : `${i ? buckets[i - 1] : 0}–${b}%`,
    n: pts.filter((p) => p.ape * 100 < b && p.ape * 100 >= (i ? buckets[i - 1] : 0)).length,
  }))
  return { mape: avg(pts.map((p) => p.ape)) * 100, perCafe, trend, hist, cold, n: pts.length }
}

export function cafeMape(st: State, cafeId: string) {
  const c = st.cafes.find((x) => x.id === cafeId)!
  if (tierOf(c, st.orders) !== 'T2') return null
  const bt = backtest({ ...st, cafes: [c] }, st.settings.alpha, st.settings.window)
  return bt.n ? bt.mape : null
}

// Auto-risk: established active cafés whose last 21 days fell 40%+ vs the prior 6 weeks.
export function riskSignals(st: State) {
  const out: { cafe: Cafe; drop: number }[] = []
  for (const c of st.cafes) {
    if (c.status !== 'active' || !c.approved || st.dismissedRisk.includes(c.id)) continue
    if (tierOf(c, st.orders) !== 'T2') continue
    const recent = c.beans.reduce((a, b) => a + avg(b.history.slice(-21)), 0)
    const before = c.beans.reduce((a, b) => a + avg(b.history.slice(-63, -21)), 0)
    if (before > 0 && recent / before <= 0.6) out.push({ cafe: c, drop: Math.round((1 - recent / before) * 100) })
  }
  return out
}

export function summaryMessage(st: State, c: Cafe, channel: 'whatsapp' | 'email') {
  const lines: string[] = []
  const greet = channel === 'email' ? `Subject: Your weekly coffee summary — ${c.name}\n\nHi ${c.owner.split(' ')[0]},` : `Hi ${c.owner.split(' ')[0]},`
  lines.push(greet, '', 'Projected run-out:')
  let total = 0
  for (const cb of c.beans) {
    const b = st.beans.find((x) => x.id === cb.sku)!
    const f = forecast(c, cb, st)
    lines.push(`• ${b.name}: ${f.noStock ? 'stock count needed' : f.likely == null ? 'no run-out in sight' : `in ${f.likely} days (${fmtDay(today() + f.likely)})`}`)
  }
  const drafts = st.orders.filter((o) => o.cafeId === c.id && o.status === 'draft')
  if (drafts.length) {
    lines.push('', 'Drafted reorders (NOT placed — needs your confirmation):')
    for (const o of drafts) {
      const b = st.beans.find((x) => x.id === orderSku(o))!
      const amt = o.qty * b.pricePerKg
      total += amt
      lines.push(`• ${b.name} ${o.qty} kg × ${inr(b.pricePerKg)} = ${inr(amt)} — delivery ${fmtDay(o.neededBy)}`)
    }
    lines.push('', `Invoice preview: subtotal ${inr(total)}, GST 5% ${inr(total * 0.05)}, total ${inr(total * 1.05)}`)
    lines.push(`Review & confirm: https://siolim.coffee/checkout/${c.id}`)
  } else lines.push('', 'No reorders needed this week.')
  lines.push('', '— Siolim Specialty Coffee')
  return { body: lines.join('\n'), total }
}
