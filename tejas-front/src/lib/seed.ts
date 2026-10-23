import { type Bean, type Cafe, type CafeType, type Order, type State, type Status, DOW_SHAPE, today, weekday, uid, syncDrafts } from './model'

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const BEANS: Bean[] = [
  { id: 'eth-guji', name: 'Ethiopia Guji', origin: 'Guji, Oromia', lot: 'ETG-24-117', cert: 'Organic · Fair Trade', roast: 'light', family: 'Floral & fruity', shelfLife: 28, peakDays: 21, bagKg: 1, pricePerKg: 1850, singleOrigin: true, traceScore: 3, lotKg: 6 },
  { id: 'col-huila', name: 'Colombia Huila', origin: 'Pitalito, Huila', lot: 'COH-24-052', cert: 'Rainforest Alliance · Farm-level', roast: 'light', family: 'Floral & fruity', shelfLife: 28, peakDays: 21, bagKg: 1, pricePerKg: 1720, singleOrigin: true, traceScore: 3, lotKg: 180 },
  { id: 'ken-nyeri', name: 'Kenya Nyeri AA', origin: 'Nyeri County', lot: 'KNY-24-009', cert: 'Washing-station level', roast: 'light', family: 'Floral & fruity', shelfLife: 28, peakDays: 21, bagKg: 1, pricePerKg: 1990, singleOrigin: true, traceScore: 2, lotKg: 60 },
  { id: 'bra-cerrado', name: 'Brazil Cerrado', origin: 'Cerrado Mineiro', lot: 'BRC-24-201', cert: 'Rainforest Alliance', roast: 'medium', family: 'Chocolate & nutty', shelfLife: 35, peakDays: 28, bagKg: 2, pricePerKg: 1180, singleOrigin: true, traceScore: 2, lotKg: 420 },
  { id: 'ind-chik', name: 'India Chikmagalur', origin: 'Baba Budangiri, Karnataka', lot: 'INC-24-033', cert: 'Estate-level · Shade grown', roast: 'medium', family: 'Chocolate & nutty', shelfLife: 35, peakDays: 28, bagKg: 2, pricePerKg: 1090, singleOrigin: true, traceScore: 3, lotKg: 380 },
  { id: 'house', name: 'Siolim House Espresso', origin: 'Brazil · India blend', lot: 'HSE-24-310', cert: 'Component lots tracked', roast: 'medium-dark', family: 'Chocolate & nutty', shelfLife: 30, peakDays: 24, bagKg: 2, pricePerKg: 980, singleOrigin: false, traceScore: 2, lotKg: 600 },
]

const USER_CAFES = [
  'Absolute Coffee Brewers',
  'Cafe Chapter One',
  'Coffee By Di Bella',
  'DripCo',
  'Love Over Coffee',
  'Starbucks',
  'Virtual Coworks',
  'The Eyry (Apollo Premier)',
  'Cafe Terazza (Airen Heights)',
  'Chai-Vaai Cafe',
  'Mama Loca',
  'Farzi Cafe',
  'Cafe Palette',
  'Mangosteen Cafe',
  'The Nest',
  'Mitti Cafe',
]

const NAMES = [
  ...USER_CAFES,
  ...USER_CAFES.map((c) => `${c} (Central)`),
  ...USER_CAFES.map((c) => `${c} (Express)`),
  ...USER_CAFES.map((c) => `${c} (Roastery)`),
]
const OWNERS = ['Ana Fernandes', 'Rohan Naik', 'Priya Kamat', 'Joel D’Souza', 'Meera Shetty', 'Karan Desai', 'Sana Shaikh', 'Vikram Rao', 'Leah Pinto', 'Arjun Prabhu', 'Nisha Gaonkar', 'Dev Sawant']
const CITIES = ['Panaji', 'Mapusa', 'Assagao', 'Margao', 'Vasco', 'Anjuna', 'Siolim']
const TYPES: CafeType[] = ['specialty', 'specialty', 'specialty', 'chain', 'restaurant', 'hotel', 'specialty', 'chain']

export function buildSeed(): State {
  const r = rng(19)
  const t = today()
  const H = 90
  const histStart = t - H
  const cafes: Cafe[] = []
  const orders: Order[] = []
  // 17 closed, 22 reduced (40–60%), 5 active, 2 active with falling demand, 1 learning, 2 new (pending + approved)
  const plan: { status: Status; pct: number; hist: number; falling?: boolean; approved?: boolean }[] = [
    ...Array.from({ length: 5 }, () => ({ status: 'active' as Status, pct: 0, hist: H })),
    ...Array.from({ length: 2 }, () => ({ status: 'active' as Status, pct: 0, hist: H, falling: true })),
    ...Array.from({ length: 22 }, (_, i) => ({ status: 'reduced' as Status, pct: [40, 40, 45, 50, 60][i % 5], hist: H })),
    ...Array.from({ length: 17 }, () => ({ status: 'closed' as Status, pct: 100, hist: H })),
    { status: 'active', pct: 0, hist: 12 },
    { status: 'active', pct: 0, hist: 0 },
    { status: 'active', pct: 0, hist: 0, approved: false },
  ]
  plan.forEach((p, i) => {
    const type: CafeType = i === 29 || i === 38 ? 'barista_school' : TYPES[i % TYPES.length]
    const seats = Math.round(18 + r() * 50)
    const beanIds = i % 3 === 0 ? ['eth-guji', 'house'] : i % 3 === 1 ? ['bra-cerrado', 'col-huila'] : ['house', 'ind-chik']
    if (i === 0) beanIds.splice(0, 2, 'eth-guji', 'bra-cerrado')
    const changeAt = t - 10 - Math.floor(r() * 25)
    const beans = beanIds.map((sku, bi) => {
      const base = (0.5 + r() * 1.6) * (bi === 0 ? 1 : 0.7)
      const history: number[] = []
      for (let d = H - p.hist; d < H; d++) {
        const day = histStart + d
        let v = base * DOW_SHAPE[type][weekday(day)] * (0.8 + r() * 0.4)
        if (p.status === 'reduced' && day >= changeAt) v *= 1 - p.pct / 100
        if (p.status === 'closed' && day >= changeAt) v = 0
        if (p.falling && d >= H - 21) v *= 0.5
        history.push(Math.round(v * 100) / 100)
      }
      const mult = p.status === 'reduced' ? 1 - p.pct / 100 : p.status === 'closed' ? 0 : 1
      const daysLeft = i < 3 ? 3 + i : 4 + r() * 18
      return {
        sku, history, histStart: t - p.hist, prior: Math.round(base * 100) / 100,
        onHand: p.hist === 0 && p.approved === false ? null : Math.round(base * Math.max(mult, 0.3) * daysLeft * 10) / 10,
        lastCount: t - Math.floor(r() * (i % 9 === 4 ? 12 : 6)),
      }
    })
    const cafe: Cafe = {
      id: 'c' + (i + 1),
      name: NAMES[i % NAMES.length],
      owner: OWNERS[i % OWNERS.length],
      phone: '+91 98' + String(20000000 + Math.floor(r() * 7e7)).slice(0, 8),
      email: (NAMES[i % NAMES.length] || 'cafe').toLowerCase().replace(/[^a-z0-9]+/g, '') + '@mail.in',
      address: `${Math.floor(r() * 200) + 1}, Main Road`,
      city: CITIES[i % CITIES.length],
      type, seats, status: p.status, reductionPct: p.status === 'reduced' ? p.pct : 0,
      statusHistory: p.status === 'active' ? [] : [{ ts: changeAt * 864e5, status: p.status, pct: p.pct, reason: p.status === 'closed' ? 'Business shut — Great Compression' : 'Lower footfall, cutting order volume', by: 'Roastery admin', effective: changeAt }],
      safetyDays: 2, leadDays: 2, coverDays: 10, minOrderKg: 2,
      contract: i % 4 === 0 ? 'Standing order · 12-month supply agreement' : 'Order-on-demand · 30-day terms',
      paymentTerms: 'Net 15', standing: i % 4 === 0,
      approved: p.approved !== false, onboarded: t - p.hist - (p.hist ? 30 : 1), counts: p.hist === 12 ? 2 : 0,
      optIn: { whatsapp: i % 5 !== 3, email: true }, language: 'English', summaryDay: 1,
      beans, notes: [], events: [],
    }
    if (p.approved === false) cafe.cupsPerDay = 140
    cafes.push(cafe)
    // order history so established cafés reach Calibrated
    if (p.hist >= 28) {
      for (let k = 1; k <= 4; k++) {
        orders.push({ id: uid(), cafeId: cafe.id, sku: beanIds[k % 2], qty: 6, status: 'delivered', type: cafe.standing ? 'standing' : 'manual', neededBy: t - k * 14 - (i % 7), createdAt: (t - k * 14 - 5) * 864e5, confirmedAt: (t - k * 14 - 4) * 864e5, confirmedBy: 'Café' })
      }
    }
    if (p.hist === 12) orders.push({ id: uid(), cafeId: cafe.id, sku: beanIds[0], qty: 4, status: 'delivered', type: 'manual', neededBy: t - 5, createdAt: (t - 8) * 864e5, confirmedBy: 'Café' })
  })

  // Confirmed orders for the coming week (roast day = neededBy - 1). Thursday is overloaded on purpose.
  const thu = [...Array(7)].map((_, k) => t + k).find((d) => weekday(d) === 4)!
  const confirmed: [number, number, string, number][] = [
    // [cafe index, roast day, sku, kg]
    [3, thu, 'bra-cerrado', 28], [6, thu, 'house', 24], [9, thu, 'eth-guji', 6], [12, thu, 'house', 22], [15, thu, 'ind-chik', 18], [4, thu, 'col-huila', 14],
    [1, t + 1, 'bra-cerrado', 16], [7, t + 1, 'house', 12], [10, t + 2, 'col-huila', 10], [13, t + 2, 'bra-cerrado', 14],
    [16, t + 3, 'house', 18], [19, t + 4, 'ind-chik', 12], [22, t + 5, 'house', 16], [25, t + 5, 'bra-cerrado', 12],
    [28, t + 6, 'col-huila', 10], [2, t + 0, 'house', 14], [8, t + 3, 'ind-chik', 10],
    // closed cafés that still hold confirmed contract orders
    [30, t + 2, 'house', 12], [33, t + 4, 'bra-cerrado', 10],
  ]
  for (const [ci, rawDay, sku, qty] of confirmed) {
    const day = weekday(rawDay) === 0 ? rawDay + 1 : rawDay
    const c = cafes[ci]
    if (!c.beans.some((b) => b.sku === sku)) c.beans[1] = { ...c.beans[1], sku }
    orders.push({
      id: uid(), cafeId: c.id, sku, qty, status: 'confirmed', type: c.standing ? 'standing' : 'manual', neededBy: day + 1,
      createdAt: (t - 3) * 864e5, confirmedAt: (t - 3) * 864e5, confirmedBy: c.standing ? 'Standing contract' : 'Café',
      flag: c.status === 'closed' ? 'Café closed while this confirmed order exists — resolve per contract' : undefined,
    })
  }

  const st: State = {
    version: 5, beans: BEANS.map((b) => ({ ...b })), cafes, orders, messages: [], audit: [], moves: {}, rejected: [], dismissedRisk: [],
    alerts: [
      { id: uid(), ts: Date.now() - 36e5 * 5, to: 'roastery', kind: 'risk', text: 'Great Compression: 17 partners closed, 22 cut orders by 40% or more.' },
      { id: uid(), ts: Date.now() - 36e5 * 3, to: 'roastery', kind: 'info', text: 'New café self-registered: Mitti Cafe (pending approval).' },
      { id: uid(), ts: Date.now() - 36e5 * 2, to: 'roastery', kind: 'warn', text: 'Low green-coffee lot: Ethiopia Guji ETG-24-117 has 6 kg left.' },
    ],
    settings: {
      capacity: [0, 80, 80, 80, 80, 80, 80], coRoast: [0, 20, 20, 20, 20, 20, 10], safetyDefault: 2, leadDefault: 2,
      mapeThreshold: 20, alpha: 0.25, window: 21, gramsPerCup: 18, waste: 0.08, utilAlert: 0.65,
    },
  }
  syncDrafts(st, t)
  return st
}
