import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import { type Order, type Status, TIER_LABEL, WD, fmtDay, fmtShort, fmtTime, forecast, inr, orderSku, r1, tierOf, today, uid, weekday } from '../lib/model'
import { Badge, Btn, ForecastChart, Modal, cx, inputCls } from '../ui'
import { Invoice } from '../roastery/Ops'
import { RegisterForm } from '../Register'

type Tab = 'home' | 'stock' | 'orders' | 'messages' | 'account'

function useNow() {
  const [n, setN] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(i) }, [])
  return n
}

export function CafeApp({ cafeId, onRegistered }: { cafeId: string; onRegistered: (id: string) => void }) {
  const { st } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const c = st.cafes.find((x) => x.id === cafeId)
  if (!c) return null
  const alerts = st.alerts.filter((a) => a.to === c.id)
  return (
    <div className="flex h-full flex-col bg-[#f7f3ee]">
      <header className="flex items-center justify-between px-5 pb-3 pt-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-stone-500">Siolim Coffee · Partner</div>
          <div className="font-display text-2xl leading-tight text-stone-900">{c.name}</div>
        </div>
        <button onClick={() => setTab('messages')} className="relative rounded-full bg-white p-2.5 shadow-sm" aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          {alerts.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-[#b5562b] text-[9px] font-bold text-white">{Math.min(9, alerts.length)}</span>}
        </button>
      </header>
      <main className="flex-1 overflow-y-auto px-4 pb-6">
        {!c.approved ? (
          <div className="mt-6 rounded-2xl bg-white p-5 text-sm text-stone-600">Your registration is pending approval by the roastery. Your estimated forecast will appear once approved.</div>
        ) : tab === 'home' ? <Home cafeId={c.id} go={setTab} /> : tab === 'stock' ? <Stock cafeId={c.id} /> : tab === 'orders' ? <Orders cafeId={c.id} /> : tab === 'messages' ? <Inbox cafeId={c.id} /> : <Account cafeId={c.id} onRegistered={onRegistered} />}
      </main>
      <nav className="grid grid-cols-5 border-t border-stone-200 bg-white pb-2 pt-1">
        {(['home', 'stock', 'orders', 'messages', 'account'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx('flex flex-col items-center gap-0.5 py-2 text-[11px] capitalize', tab === t ? 'font-semibold text-[#b5562b]' : 'text-stone-500')}>
            <span className={cx('h-1 w-6 rounded-full', tab === t ? 'bg-[#b5562b]' : 'bg-transparent')} />
            {t}
          </button>
        ))}
      </nav>
    </div>
  )
}

const conf = (tier: 'T0' | 'T1' | 'T2') => <Badge tone={tier === 'T0' ? 'violet' : tier === 'T1' ? 'blue' : 'green'}>{TIER_LABEL[tier]}</Badge>

function Home({ cafeId, go }: { cafeId: string; go: (t: Tab) => void }) {
  const { st } = useStore()
  const a = useActions()
  const now = useNow()
  const c = st.cafes.find((x) => x.id === cafeId)!
  const tier = tierOf(c, st.orders)
  const drafts = st.orders.filter((o) => o.cafeId === c.id && o.status === 'draft')
  const recent = st.orders.filter((o) => o.cafeId === c.id && o.status === 'confirmed' && now - (o.confirmedAt ?? 0) < 6e5)
  const [why, setWhy] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const bean = (id: string) => st.beans.find((b) => b.id === id)!
  const stale = today() - Math.max(...c.beans.map((b) => b.lastCount)) >= 3 || tier === 'T0'
  const closed = c.status === 'closed' || c.status === 'paused'
  return (
    <div className="space-y-3">
      {recent.map((o) => {
        const left = Math.max(0, 600 - Math.floor((now - (o.confirmedAt ?? 0)) / 1000))
        return (
          <div key={o.id} className="flex items-center justify-between rounded-2xl bg-emerald-700 px-4 py-3 text-sm text-white">
            <span>Order confirmed · {o.qty} kg {bean(orderSku(o)).name}</span>
            <button onClick={() => a.undoConfirm(o.id)} className="rounded-lg bg-white/15 px-3 py-1.5 font-medium">Undo {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</button>
          </div>
        )
      })}
      {closed && <div className="rounded-2xl bg-stone-900 p-4 text-sm text-amber-50">Your account is {c.status}. No reorders will be drafted. Confirmed orders stay in place — the roastery will contact you.</div>}
      {c.beans.map((cb) => {
        const f = forecast(c, cb, st, today(), tier)
        const b = bean(cb.sku)
        return (
          <div key={cb.sku} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-stone-500"><span>{b.name}</span>{conf(tier)}</div>
            <div className="mt-1 font-display text-[22px] leading-snug text-stone-900">
              {f.noStock ? 'Tell us how many bags are on the shelf' : f.likely == null ? 'No run-out in sight' : <>Runs out in <span className={cx(f.likely <= 3 && 'text-[#b5562b]')}>{f.likely} days</span> ({WD[weekday(today() + f.likely)]})</>}
            </div>
            {f.earliest != null && f.latest != null && tier !== 'T2' && <div className="text-xs text-stone-500">Likely between {fmtShort(today() + f.earliest)} and {fmtShort(today() + f.latest)}</div>}
            <div className="mt-1 text-xs text-stone-500">{cb.onHand ?? '?'} kg left · ~{r1(f.rate)} kg/day</div>
          </div>
        )
      })}
      {drafts.map((o) => {
        const b = bean(orderSku(o))
        const orig = bean(o.sku)
        const sub = o.subSku ? bean(o.subSku) : null
        const f = forecast(c, c.beans.find((x) => x.sku === o.sku) ?? c.beans[0], st)
        return (
          <div key={o.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-2 ring-[#b5562b]/70">
            {sub && o.subAccepted === undefined && (
              <div className="bg-amber-50 p-4 text-sm">
                <div className="font-medium text-amber-900">{orig.name} is low at the roastery. Use {sub.name} instead?</div>
                <div className="mt-1 text-xs text-amber-800">Same {sub.roast} roast, {sub.family.toLowerCase()} profile · lot {sub.lot} · {sub.cert}</div>
                <div className="mt-3 grid grid-cols-2 gap-2"><Btn variant="primary" onClick={() => a.setSub(o.id, true)}>Accept</Btn><Btn onClick={() => a.setSub(o.id, false)}>Decline</Btn></div>
              </div>
            )}
            <div className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b5562b]">Reorder ready</div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-2xl">{o.qty} kg {b.name}</div>
                <div className="text-sm tabular-nums">{inr(o.qty * b.pricePerKg)}</div>
              </div>
              <div className="text-xs text-stone-500">Delivery {fmtDay(o.neededBy)} · lot {b.lot}{o.subAccepted ? ' · substitute accepted' : ''}</div>
              {editing === o.id && (
                <div className="mt-3 flex items-center justify-center gap-4">
                  <button className="size-11 rounded-full border border-stone-300 text-xl" onClick={() => a.editQty(o.id, o.qty - b.bagKg)}>−</button>
                  <span className="w-16 text-center font-display text-2xl tabular-nums">{o.qty}</span>
                  <button className="size-11 rounded-full border border-stone-300 text-xl" onClick={() => a.editQty(o.id, o.qty + b.bagKg)}>+</button>
                </div>
              )}
              <button onClick={() => a.confirmOrder(o.id, 'Café')} className="mt-3 h-14 w-full rounded-xl bg-[#b5562b] text-base font-semibold text-white active:scale-[.99]">Confirm order</button>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <button className="h-10 rounded-lg bg-stone-100" onClick={() => setEditing(editing === o.id ? null : o.id)}>Edit qty</button>
                <button className="h-10 rounded-lg bg-stone-100" onClick={() => a.snooze(o.id)}>Snooze 24h</button>
                <button className="h-10 rounded-lg bg-stone-100" onClick={() => setWhy(why === o.id ? null : o.id)}>See why</button>
              </div>
              {why === o.id && <p className="mt-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-600">{f.explanation} Reorder because stock would hit your {f.safety}-day safety level before the next delivery ({c.leadDays}-day lead time).</p>}
            </div>
          </div>
        )
      })}
      {stale && !closed && (
        <button onClick={() => go('stock')} className="flex w-full items-center justify-between rounded-2xl bg-stone-900 p-4 text-left text-amber-50">
          <span><span className="block font-medium">Update stock (10 sec)</span><span className="text-xs text-amber-100/70">{tier === 'T0' ? 'Your forecast is an estimate — a count makes it learn.' : 'Keeps your run-out date accurate.'}</span></span>
          <span className="text-xl">→</span>
        </button>
      )}
      <div className="pt-2">
        <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Alerts</div>
        {st.alerts.filter((x) => x.to === c.id).slice(0, 4).map((al) => (
          <div key={al.id} className="mb-2 rounded-xl bg-white/70 px-3 py-2 text-sm text-stone-700">{al.text}<div className="text-[10px] text-stone-400">{fmtTime(al.ts)}</div></div>
        ))}
      </div>
    </div>
  )
}

function Stock({ cafeId }: { cafeId: string }) {
  const { st } = useStore()
  const a = useActions()
  const c = st.cafes.find((x) => x.id === cafeId)!
  const [vals, setVals] = useState<Record<string, number>>({})
  const [saved, setSaved] = useState<string | null>(null)
  const [eventDay, setEventDay] = useState('')
  return (
    <div className="space-y-3">
      {c.beans.map((cb) => {
        const b = st.beans.find((x) => x.id === cb.sku)!
        const f = forecast(c, cb, st)
        const v = vals[cb.sku] ?? cb.onHand ?? 0
        const days = f.likely ?? 30
        return (
          <div key={cb.sku} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><span className="font-medium">{b.name}</span><span className="text-xs text-stone-500">counted {fmtShort(cb.lastCount)}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100"><div className={cx('h-full rounded-full', days <= 3 ? 'bg-[#b5562b]' : days <= 7 ? 'bg-amber-500' : 'bg-emerald-600')} style={{ width: Math.min(100, (days / 21) * 100) + '%' }} /></div>
            <div className="mt-1 text-xs text-stone-500">{f.likely == null ? (f.noStock ? 'Stock unknown' : 'Plenty') : `${f.likely} days remaining`}</div>
            <div className="mt-4 flex items-center justify-between">
              <button className="size-12 rounded-full border border-stone-300 text-2xl" onClick={() => setVals((p) => ({ ...p, [cb.sku]: Math.max(0, r1(v - b.bagKg / 2)) }))}>−</button>
              <div className="text-center"><div className="font-display text-3xl tabular-nums">{r1(v)} <span className="text-base text-stone-500">kg</span></div><div className="text-[11px] text-stone-500">≈ {r1(v / b.bagKg)} bags of {b.bagKg} kg</div></div>
              <button className="size-12 rounded-full border border-stone-300 text-2xl" onClick={() => setVals((p) => ({ ...p, [cb.sku]: r1(v + b.bagKg / 2) }))}>+</button>
            </div>
            <input type="range" min={0} max={Math.max(20, (cb.onHand ?? 0) * 2)} step={0.5} value={v} onChange={(e) => setVals((p) => ({ ...p, [cb.sku]: +e.target.value }))} className="mt-3 w-full accent-[#b5562b]" />
            <Btn variant="primary" className="mt-2 w-full" size="lg" onClick={() => { a.stockCount(c.id, cb.sku, v, 'Café'); setSaved(cb.sku); setTimeout(() => setSaved(null), 2500) }}>{saved === cb.sku ? 'Saved — forecast updated' : 'Save count'}</Btn>
            {cb.history.length > 0 && <div className="mt-4"><div className="mb-1 text-[11px] text-stone-500">Last 30 days & forecast</div><ForecastChart history={cb.history} rate={f.rate} cv={f.cv} height={90} /></div>}
          </div>
        )
      })}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="font-medium">Report an unusual day</div>
        <div className="text-xs text-stone-500">Event, holiday or closed day — the model will treat it as an outlier.</div>
        <div className="mt-3 flex gap-2"><input type="date" className={inputCls} value={eventDay} onChange={(e) => setEventDay(e.target.value)} /><Btn disabled={!eventDay} onClick={() => { a.reportEvent(c.id, Math.floor(new Date(eventDay).getTime() / 864e5)); setEventDay('') }}>Report</Btn></div>
        {c.events.length > 0 && <div className="mt-2 text-xs text-stone-500">Reported: {c.events.map(fmtShort).join(', ')}</div>}
      </div>
    </div>
  )
}

function Orders({ cafeId }: { cafeId: string }) {
  const { st, update } = useStore()
  const a = useActions()
  const now = useNow()
  const [inv, setInv] = useState<Order | null>(null)
  const mine = st.orders.filter((o) => o.cafeId === cafeId)
  const groups: [string, Order[]][] = [
    ['Awaiting your confirmation', mine.filter((o) => o.status === 'draft' || o.status === 'snoozed')],
    ['Confirmed', mine.filter((o) => o.status === 'confirmed')],
    ['In roasting', mine.filter((o) => o.status === 'roasting')],
    ['Dispatched', mine.filter((o) => o.status === 'dispatched')],
    ['Delivered', mine.filter((o) => o.status === 'delivered').sort((x, y) => y.neededBy - x.neededBy).slice(0, 6)],
  ]
  const reorder = (o: Order) => update((s) => {
    const c = s.cafes.find((x) => x.id === cafeId)!
    s.orders.push({ id: uid(), cafeId, sku: orderSku(o), qty: o.qty, status: 'draft', type: 'manual', neededBy: today() + c.leadDays, createdAt: Date.now(), edited: true })
  }, { who: 'Café', what: `Reorder previous ${o.id}` })
  return (
    <div className="space-y-4">
      {groups.map(([label, list]) => list.length > 0 && (
        <div key={label}>
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</div>
          <div className="space-y-2">
            {list.map((o) => {
              const b = st.beans.find((x) => x.id === orderSku(o))!
              const canUndo = o.status === 'confirmed' && now - (o.confirmedAt ?? 0) < 6e5
              return (
                <div key={o.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex justify-between"><span className="font-medium">{o.qty} kg {b.name}</span><span className="tabular-nums text-sm">{inr(o.qty * b.pricePerKg * 1.05)}</span></div>
                  <div className="text-xs text-stone-500">{o.status === 'delivered' ? 'Delivered' : 'Delivery'} {fmtDay(o.neededBy)}{o.status === 'snoozed' ? ' · snoozed' : ''}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(o.status === 'draft' || o.status === 'snoozed') && <Btn variant="accent" onClick={() => a.confirmOrder(o.id, 'Café')}>Confirm</Btn>}
                    {canUndo && <Btn onClick={() => a.undoConfirm(o.id)}>Undo</Btn>}
                    <Btn variant="ghost" onClick={() => setInv(o)}>{o.status === 'draft' ? 'Invoice preview' : 'Invoice'}</Btn>
                    {o.status === 'delivered' && <Btn variant="ghost" onClick={() => reorder(o)}>Reorder</Btn>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <Modal open={!!inv} onClose={() => setInv(null)} title="Invoice">{inv && <Invoice o={inv} />}</Modal>
    </div>
  )
}

function Inbox({ cafeId }: { cafeId: string }) {
  const { st } = useStore()
  const a = useActions()
  const c = st.cafes.find((x) => x.id === cafeId)!
  const msgs = st.messages.filter((m) => m.cafeId === cafeId && m.status === 'sent')
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 font-medium">Preferences</div>
        {(['whatsapp', 'email'] as const).map((ch) => (
          <label key={ch} className="flex items-center justify-between py-2 text-sm">
            <span>{ch === 'whatsapp' ? 'WhatsApp' : 'Email'} summaries</span>
            <input type="checkbox" className="size-5 accent-[#b5562b]" checked={c.optIn[ch]} onChange={(e) => a.updateCafe(c.id, { optIn: { ...c.optIn, [ch]: e.target.checked } })} />
          </label>
        ))}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select className={inputCls} value={c.summaryDay} onChange={(e) => a.updateCafe(c.id, { summaryDay: +e.target.value })}>{WD.map((d, i) => <option key={d} value={i}>Summary on {d}</option>)}</select>
          <select className={inputCls} value={c.language} onChange={(e) => a.updateCafe(c.id, { language: e.target.value })}>{['English', 'Hindi', 'Konkani', 'Marathi'].map((l) => <option key={l}>{l}</option>)}</select>
        </div>
      </div>
      <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Messages</div>
      {msgs.length === 0 && <p className="px-1 text-sm text-stone-500">No summaries received yet.</p>}
      {msgs.map((m) => <pre key={m.id} className="whitespace-pre-wrap rounded-2xl bg-[#e7f3e3] p-4 font-sans text-[13px] text-stone-800">{m.body}<div className="mt-2 text-[10px] text-stone-500">{fmtTime(m.ts)} · {m.channel}</div></pre>)}
      <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Notifications</div>
      {st.alerts.filter((x) => x.to === cafeId).map((al) => <div key={al.id} className="rounded-xl bg-white/70 px-3 py-2 text-sm">{al.text}<div className="text-[10px] text-stone-400">{fmtTime(al.ts)}</div></div>)}
    </div>
  )
}

function Account({ cafeId, onRegistered }: { cafeId: string; onRegistered: (id: string) => void }) {
  const { st } = useStore()
  const a = useActions()
  const c = st.cafes.find((x) => x.id === cafeId)!
  const [sit, setSit] = useState<Status | null>(null)
  const [pct, setPct] = useState(30)
  const [reopen, setReopen] = useState('')
  const [reg, setReg] = useState(false)
  const options: [Status, string, string][] = [['active', 'Open as normal', ''], ['reduced', 'Reduced demand', 'Choose how much'], ['paused', 'Temporarily closed', 'With reopen date'], ['closed', 'Closing permanently', 'We’ll contact you about open orders']]
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="font-medium">Change my situation</div>
        <div className="mb-3 text-xs text-stone-500">Currently: {c.status === 'reduced' ? `Reduced −${c.reductionPct}%` : c.status}</div>
        <div className="space-y-2">
          {options.map(([s, l, d]) => (
            <button key={s} onClick={() => setSit(s)} className={cx('w-full rounded-xl border px-4 py-3 text-left', sit === s ? 'border-[#b5562b] bg-orange-50' : 'border-stone-200')}>
              <div className="text-sm font-medium">{l}</div>{d && <div className="text-xs text-stone-500">{d}</div>}
            </button>
          ))}
        </div>
        {sit === 'reduced' && <div className="mt-3"><div className="text-sm">−{pct}%</div><input type="range" min={10} max={90} step={10} value={pct} onChange={(e) => setPct(+e.target.value)} className="w-full accent-[#b5562b]" /></div>}
        {sit === 'paused' && <input type="date" className={inputCls + ' mt-3'} value={reopen} onChange={(e) => setReopen(e.target.value)} />}
        {sit && <Btn variant="primary" size="lg" className="mt-3 w-full" onClick={() => { a.setStatus(c.id, sit, pct, 'Updated by café', 'Café', reopen ? Math.floor(new Date(reopen).getTime() / 864e5) : undefined); setSit(null) }}>Update & notify roastery</Btn>}
        <p className="mt-2 text-[11px] text-stone-500">Confirmed orders stay in place; the roastery will contact you about them.</p>
      </div>
      <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
        <div className="mb-2 font-medium">Profile & contract</div>
        <div className="space-y-1 text-stone-600">
          <div>{c.owner} · {c.phone}</div><div>{c.email}</div><div>{c.address}, {c.city}</div><div>{c.contract} · {c.paymentTerms}</div>
          <div>Delivery lead time {c.leadDays} days · min order {c.minOrderKg} kg</div>
        </div>
      </div>
      <div className="rounded-2xl bg-white p-4 text-sm shadow-sm"><div className="font-medium">Support</div><div className="text-stone-600">Siolim Specialty Coffee · +91 832 000 1919 · orders@siolim.coffee</div></div>
      <button onClick={() => setReg(true)} className="w-full rounded-2xl border border-dashed border-stone-300 p-4 text-sm text-stone-600">Register another café (self sign-up)</button>
      <Modal open={reg} onClose={() => setReg(false)} title="Register your café" wide>
        <RegisterForm mode="self" onDone={(id) => { setReg(false); onRegistered(id) }} />
      </Modal>
    </div>
  )
}
