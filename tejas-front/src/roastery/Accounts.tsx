import { Fragment, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import {
  type Cafe, TYPE_LABEL, fmtDay, fmtShort, fmtTime, forecast, isOpen, orderSku, r1, riskSignals, roastPlan, today, inr,
} from '../lib/model'
import { Badge, Bar, Btn, Card, ForecastChart, Kpi, Modal, StatusBadge, TierBadge, cx, inputCls } from '../ui'
import { ConfirmOnBehalf, StatusDialog, cafeRow, useMapes } from './shared'
import { RegisterForm } from '../Register'

export function Overview({ open, go }: { open: (id: string) => void; go: (v: string) => void }) {
  const { st } = useStore()
  const a = useActions()
  const plan = roastPlan(st)
  const live = st.cafes.filter((c) => c.approved)
  const rows = live.filter((c) => c.status !== 'closed').map((c) => cafeRow(st, c))
  const atRisk = rows.filter((r) => r.minRun != null && r.minRun <= 7).sort((x, y) => (x.minRun ?? 99) - (y.minRun ?? 99))
  const count = (s: string) => live.filter((c) => c.status === s).length
  const tiers = rows.filter((r) => r.tier !== 'T2').length
  const weekConfirmed = st.orders.filter((o) => isOpen(o) && o.neededBy <= today() + 7).reduce((x, o) => x + o.qty, 0)
  const weekForecast = st.orders.filter((o) => o.status === 'draft' || o.status === 'snoozed').reduce((x, o) => x + o.qty, 0)
  const rush = st.orders.filter((o) => o.type === 'rush' && o.createdAt > Date.now() - 30 * 864e5).length
  const risks = riskSignals(st)
  const [statusFor, setStatusFor] = useState<Cafe | null>(null)
  const flagged = st.orders.filter((o) => o.flag)
  const stale = rows.filter((r) => r.c.status !== 'paused' && today() - r.lastCount >= 7)
  const overloaded = plan.days.filter((d) => d.used > d.cap)

  return (
    <div className="space-y-6">
      {plan.util < st.settings.utilAlert && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#2a1d16] px-6 py-5 text-amber-50">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300/80">Crisis mode · The Great Compression</div>
            <div className="mt-1 font-display text-2xl">Roaster utilisation is {Math.round(plan.util * 100)}% — {r1(plan.unused)} kg of capacity unused this week</div>
            <div className="mt-1 text-sm text-amber-100/70">{count('closed')} partners closed · {count('reduced')} reduced · confirmed orders are protected and nothing unconfirmed is roasted.</div>
          </div>
          <Btn variant="accent" onClick={() => go('roasting')}>Open unused-slot panel</Btn>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Active cafés" value={count('active')} sub={`${tiers} new / learning`} />
        <Kpi label="Reduced" value={count('reduced')} tone="amber" sub={`${live.filter((c) => c.status === 'reduced' && c.reductionPct >= 40).length} cut ≥40%`} />
        <Kpi label="Closed / paused" value={`${count('closed')} / ${count('paused')}`} tone="red" />
        <Kpi label="Confirmed kg (7d)" value={r1(weekConfirmed)} sub={<span>Forecast drafts <b>{r1(weekForecast)} kg</b> unconfirmed</span>} />
        <Kpi label="Utilisation" value={`${Math.round(plan.util * 100)}%`} tone={plan.util < st.settings.utilAlert ? 'red' : 'green'} sub={`${r1(plan.unused)} kg unused + ${plan.coTotal} kg co-roast`} />
        <Kpi label="Run-out ≤ 7 days" value={atRisk.length} tone={atRisk.length ? 'amber' : undefined} sub={`${rush} rush orders this month`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Run-out risk" action={<Btn size="sm" variant="ghost" onClick={() => go('cafes')}>All cafés →</Btn>}>
          <div className="divide-y divide-stone-100">
            {atRisk.length === 0 && <p className="p-5 text-sm text-stone-500">No café runs out within 7 days.</p>}
            {atRisk.slice(0, 9).map((r) => (
              <button key={r.c.id} onClick={() => open(r.c.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 text-left hover:bg-stone-50 sm:grid-cols-[1.4fr_1fr_auto]">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">{r.c.name} <TierBadge tier={r.tier} /></div>
                  <div className="text-xs text-stone-500">{r.c.city} · <StatusText c={r.c} /></div>
                </div>
                <div className="hidden sm:block">
                  <Bar value={Math.max(0.3, r.minRun ?? 0)} max={14} tone={(r.minRun ?? 0) <= 3 ? 'red' : 'amber'} />
                  <div className="mt-1 text-[11px] text-stone-500">range {r.conf?.earliest ?? '–'}–{r.conf?.latest ?? '–'} days</div>
                </div>
                <div className="text-right">
                  <div className={cx('font-display text-xl', (r.minRun ?? 0) <= 3 ? 'text-red-700' : 'text-stone-900')}>{r.minRun}d</div>
                  <div className="text-[11px] text-stone-500">{r.draftKg ? `${r.draftKg} kg drafted` : 'no draft'}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          {(flagged.length > 0 || risks.length > 0 || overloaded.length > 0 || stale.length > 0) && (
            <Card title="Needs attention">
              <div className="divide-y divide-stone-100 text-sm">
                {flagged.length > 0 && (
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <span><Badge tone="red">Contract</Badge> {flagged.length} confirmed order(s) at closed/reduced cafés need resolution</span>
                    <Btn size="sm" onClick={() => go('orders')}>Resolve</Btn>
                  </div>
                )}
                {overloaded.map((d) => (
                  <div key={d.day} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span><Badge tone="amber">Capacity</Badge> {fmtDay(d.day)} is {r1(d.used - d.cap)} kg over capacity</span>
                    <Btn size="sm" onClick={() => go('roasting')}>Re-balance</Btn>
                  </div>
                ))}
                {risks.map((r) => (
                  <div key={r.cafe.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <span><Badge tone="clay">Auto-risk</Badge> {r.cafe.name}: usage down {r.drop}% over 3 weeks — suggest Reduced</span>
                    <span className="flex gap-1">
                      <Btn size="sm" onClick={() => setStatusFor(r.cafe)}>Review</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => a.dismissRisk(r.cafe.id)}>Dismiss</Btn>
                    </span>
                  </div>
                ))}
                {stale.slice(0, 4).map((r) => (
                  <div key={r.c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span><Badge>Data stale</Badge> {r.c.name}: no stock count for {today() - r.lastCount} days — call {r.c.phone}</span>
                    <Btn size="sm" variant="ghost" onClick={() => open(r.c.id)}>Open</Btn>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card title="Alerts">
            <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
              {st.alerts.filter((x) => x.to === 'roastery').slice(0, 20).map((al) => (
                <li key={al.id} className="flex gap-3 px-5 py-2.5 text-sm">
                  <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', al.kind === 'risk' ? 'bg-red-500' : al.kind === 'warn' ? 'bg-amber-500' : al.kind === 'ok' ? 'bg-emerald-500' : 'bg-sky-500')} />
                  <div><div className="text-stone-800">{al.text}</div><div className="text-[11px] text-stone-400">{fmtTime(al.ts)}</div></div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <StatusDialog cafe={statusFor} onClose={() => setStatusFor(null)} by="Roastery admin" />
    </div>
  )
}

function StatusText({ c }: { c: Cafe }) {
  return <span>{c.status === 'reduced' ? `Reduced −${c.reductionPct}%` : c.status[0].toUpperCase() + c.status.slice(1)}</span>
}

export function Cafes({ open }: { open: (id: string) => void }) {
  const { st } = useStore()
  const a = useActions()
  const { mapes } = useMapes()
  const [tab, setTab] = useState<'all' | 'pending'>('all')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [tier, setTier] = useState('all')
  const [win, setWin] = useState('all')
  const [city, setCity] = useState('all')
  const [bean, setBean] = useState('all')
  const [statusFor, setStatusFor] = useState<Cafe | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [noteFor, setNoteFor] = useState<Cafe | null>(null)
  const [noteText, setNoteText] = useState('')
  const pending = st.cafes.filter((c) => !c.approved)
  const rows = useMemo(() => st.cafes.filter((c) => c.approved).map((c) => cafeRow(st, c, mapes)), [st, mapes])
  const cities = [...new Set(st.cafes.map((c) => c.city))]
  const filtered = rows
    .filter((r) => (status === 'all' || r.c.status === status) && (tier === 'all' || r.tier === tier) && (city === 'all' || r.c.city === city))
    .filter((r) => bean === 'all' || r.c.beans.some((b) => b.sku === bean))
    .filter((r) => win === 'all' || (r.minRun != null && r.minRun <= +win))
    .filter((r) => !q || r.c.name.toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => (x.minRun ?? 999) - (y.minRun ?? 999))
  const sel = 'h-8 rounded-lg border border-stone-300 bg-white px-2 text-xs'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg bg-stone-200/60 p-0.5 text-sm">
          <button onClick={() => setTab('all')} className={cx('rounded-md px-3 py-1', tab === 'all' && 'bg-white shadow-sm')}>B2B accounts</button>
          <button onClick={() => setTab('pending')} className={cx('rounded-md px-3 py-1', tab === 'pending' && 'bg-white shadow-sm')}>Pending approval {pending.length > 0 && <Badge tone="clay">{pending.length}</Badge>}</button>
        </div>
        <Btn variant="primary" onClick={() => setAdding(true)}>+ Add café</Btn>
      </div>
      {tab === 'pending' ? (
        <Card>
          {pending.length === 0 && <p className="p-5 text-sm text-stone-500">No pending registrations.</p>}
          {pending.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4 last:border-0">
              <div>
                <div className="font-medium">{c.name} <Badge tone="violet">Self-registered</Badge></div>
                <div className="text-xs text-stone-500">{TYPE_LABEL[c.type]} · {c.seats} seats{c.cupsPerDay ? ` · ${c.cupsPerDay} cups/day` : ''} · {c.city} · {c.phone} · {c.email}</div>
                <div className="text-xs text-stone-500">Beans: {c.beans.map((b) => `${st.beans.find((x) => x.id === b.sku)?.name} (${b.onHand == null ? 'stock unknown' : b.onHand + ' kg'})`).join(', ')}</div>
              </div>
              <Btn variant="accent" onClick={() => a.approve(c.id)}>Approve</Btn>
            </div>
          ))}
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap gap-2 border-b border-stone-100 p-3">
            <input className={inputCls + ' !h-8 !w-48 text-xs'} placeholder="Search café" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="reduced">Reduced</option><option value="paused">Paused</option><option value="closed">Closed</option></select>
            <select className={sel} value={tier} onChange={(e) => setTier(e.target.value)}><option value="all">All tiers</option><option value="T0">New</option><option value="T1">Learning</option><option value="T2">Calibrated</option></select>
            <select className={sel} value={win} onChange={(e) => setWin(e.target.value)}><option value="all">Any run-out</option><option value="3">≤ 3 days</option><option value="7">≤ 7 days</option><option value="14">≤ 14 days</option></select>
            <select className={sel} value={city} onChange={(e) => setCity(e.target.value)}><option value="all">All cities</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>
            <select className={sel} value={bean} onChange={(e) => setBean(e.target.value)}><option value="all">All beans</option>{st.beans.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <span className="ml-auto self-center text-xs text-stone-500">{filtered.length} cafés</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-stone-500">
                <tr className="border-b border-stone-100">{['Café', 'Status', 'Tier', 'Stock', 'Run-out', 'Draft reorder', 'Confirmed inbound', 'MAPE', 'Last count', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.c.id} className={cx('border-b border-stone-100 hover:bg-stone-50/70', r.c.status === 'closed' && 'text-stone-400')}>
                    <td className="px-4 py-2.5"><button className="text-left font-medium text-stone-900 hover:underline" onClick={() => open(r.c.id)}>{r.c.name}</button><div className="text-xs text-stone-500">{r.c.city}{r.flagged ? <Badge tone="red" className="ml-1">{r.flagged} flagged</Badge> : null}</div></td>
                    <td className="px-4"><StatusBadge status={r.c.status} pct={r.c.reductionPct} /></td>
                    <td className="px-4"><TierBadge tier={r.tier} /></td>
                    <td className="px-4 tabular-nums">{r.noStock ? <Badge tone="amber">Ask bags</Badge> : `${r1(r.stock)} kg`}</td>
                    <td className="px-4 tabular-nums">{r.c.status === 'closed' ? '—' : r.minRun == null ? 'none' : <span className={cx(r.minRun <= 3 && 'font-semibold text-red-700')}>{fmtShort(today() + r.minRun)} <span className="text-xs text-stone-500">({r.minRun}d)</span></span>}</td>
                    <td className="px-4">{r.draftKg ? <span className="tabular-nums">{r.draftKg} kg <Badge tone="stone" className="ml-1">Unconfirmed forecast, not scheduled</Badge></span> : '—'}</td>
                    <td className="px-4 tabular-nums">{r.inbound ? `${r1(r.inbound)} kg` : '—'}</td>
                    <td className="px-4 tabular-nums">{r.mape == null ? <span className="text-xs text-stone-400">n/a</span> : <span className={cx(r.mape > st.settings.mapeThreshold && 'text-red-700')}>{r1(r.mape)}%</span>}</td>
                    <td className="px-4 text-xs text-stone-500">{today() - r.lastCount === 0 ? 'today' : `${today() - r.lastCount}d ago`}</td>
                    <td className="px-4">
                      <div className="flex justify-end gap-1">
                        {r.drafts.length > 0 && <Btn size="sm" variant="accent" onClick={() => setConfirmId(r.drafts[0].id)}>Confirm before roasting</Btn>}
                        <Btn size="sm" onClick={() => setStatusFor(r.c)}>Status</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => { setNoteFor(r.c); setNoteText('') }}>Note</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <StatusDialog cafe={statusFor} onClose={() => setStatusFor(null)} by="Roastery admin" />
      <ConfirmOnBehalf orderId={confirmId} onClose={() => setConfirmId(null)} />
      <Modal open={adding} onClose={() => setAdding(false)} title="Add café" wide>
        <RegisterForm mode="roastery" onDone={(id) => { setAdding(false); open(id) }} />
      </Modal>
      <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title={`Note · ${noteFor?.name ?? ''}`}>
        <textarea className={inputCls + ' !h-24 py-2'} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
        <div className="mt-3 flex justify-end"><Btn variant="primary" disabled={!noteText.trim()} onClick={() => { a.note(noteFor!.id, noteText.trim()); setNoteFor(null) }}>Save note</Btn></div>
      </Modal>
    </div>
  )
}

export function CafeDetail({ id, back }: { id: string; back: () => void }) {
  const { st } = useStore()
  const a = useActions()
  const c = st.cafes.find((x) => x.id === id)
  const [statusFor, setStatusFor] = useState<Cafe | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [countSku, setCountSku] = useState<string | null>(null)
  const [countKg, setCountKg] = useState('')
  const { mapes } = useMapes()
  if (!c) return null
  const r = cafeRow(st, c, mapes)
  const orders = st.orders.filter((o) => o.cafeId === c.id)
  const drafts = orders.filter((o) => o.status === 'draft' || o.status === 'snoozed')
  const confirmed = orders.filter((o) => ['confirmed', 'roasting', 'dispatched', 'delivered', 'cancelled'].includes(o.status)).sort((x, y) => y.neededBy - x.neededBy)
  const bean = (sku: string) => st.beans.find((b) => b.id === sku)!
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button onClick={back} className="text-xs text-stone-500 hover:text-stone-900">← Cafés</button>
          <h1 className="mt-1 font-display text-4xl text-stone-900">{c.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-500">
            <StatusBadge status={c.status} pct={c.reductionPct} /> <TierBadge tier={r.tier} />
            {!c.approved && <Badge tone="violet">Pending approval</Badge>}
            <span>{TYPE_LABEL[c.type]} · {c.seats} seats · {c.city}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {!c.approved && <Btn variant="accent" onClick={() => a.approve(c.id)}>Approve</Btn>}
          <Btn onClick={() => setStatusFor(c)}>Set demand status</Btn>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Stock on hand" value={r.noStock ? '?' : `${r1(r.stock)} kg`} sub={r.noStock ? 'Bags on shelf needed' : `counted ${today() - r.lastCount}d ago`} />
        <Kpi label="Projected run-out" value={c.status === 'closed' ? '—' : r.minRun == null ? 'none' : `${r.minRun} days`} sub={r.conf ? `${r.conf.earliest}–${r.conf.latest} days (earliest–latest)` : undefined} tone={(r.minRun ?? 99) <= 3 ? 'red' : undefined} />
        <Kpi label="Draft reorder" value={`${r.draftKg} kg`} sub="Unconfirmed — not scheduled" />
        <Kpi label="Confirmed inbound" value={`${r1(r.inbound)} kg`} sub={r.mape != null ? `Back-test MAPE ${r1(r.mape)}%` : 'MAPE n/a until calibrated'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {c.beans.map((cb) => {
            const f = forecast(c, cb, st)
            const b = bean(cb.sku)
            return (
              <Card key={cb.sku} title={<span>{b.name} <span className="font-normal text-stone-500">· {b.lot} · {b.cert}</span></span>} action={<Btn size="sm" onClick={() => { setCountSku(cb.sku); setCountKg(cb.onHand?.toString() ?? '') }}>Log stock count</Btn>}>
                <div className="p-5">
                  <div className="mb-3 flex flex-wrap items-end gap-6">
                    <div><div className="text-[11px] uppercase tracking-wider text-stone-500">Likely run-out</div><div className="font-display text-2xl">{f.noStock ? 'Need count' : f.likely == null ? '—' : fmtDay(today() + f.likely)}</div></div>
                    {f.earliest != null && <div className="text-sm text-stone-600">Earliest {fmtShort(today() + f.earliest)} · Latest {f.latest != null ? fmtShort(today() + f.latest) : '—'}</div>}
                    <div className="text-sm text-stone-600">{r1(f.rate)} kg/day · {cb.onHand ?? '?'} kg on hand</div>
                    <TierBadge tier={f.tier} cafe />
                  </div>
                  <ForecastChart history={cb.history} rate={f.rate} cv={f.cv} />
                  <div className="mt-1 flex justify-between text-[11px] text-stone-400"><span>last 30 days actual</span><span>14-day forecast band</span></div>
                  <p className="mt-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-600">{f.explanation}</p>
                </div>
              </Card>
            )
          })}
          <Card title="Draft reorders (forecast — not roasted until confirmed)">
            {drafts.length === 0 && <p className="p-5 text-sm text-stone-500">No drafts.</p>}
            {drafts.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-3 last:border-0">
                <div className="text-sm">
                  <b>{o.qty} kg {bean(o.sku).name}</b> · needed {fmtDay(o.neededBy)} {o.status === 'snoozed' && <Badge tone="blue">Snoozed</Badge>}
                  {o.subSku && <div className="text-xs text-amber-800">Substitute proposed: {bean(o.subSku).name} ({bean(o.subSku).cert}) — {o.subAccepted === undefined ? 'awaiting café' : o.subAccepted ? 'accepted' : 'declined'}</div>}
                  <div><Badge>Unconfirmed forecast, not scheduled</Badge></div>
                </div>
                <Btn variant="accent" size="sm" onClick={() => setConfirmId(o.id)}>Confirm before roasting</Btn>
              </div>
            ))}
          </Card>
          <Card title="Confirmed orders (locked)">
            {confirmed.length === 0 && <p className="p-5 text-sm text-stone-500">None.</p>}
            {confirmed.slice(0, 12).map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-2.5 text-sm last:border-0">
                <span>{o.qty} kg {bean(orderSku(o)).name} · {fmtDay(o.neededBy)} · <span className="text-stone-500">{o.confirmedBy}</span></span>
                <span className="flex items-center gap-1">{o.flag && <Badge tone="red">Flagged</Badge>}<Badge tone={o.status === 'cancelled' ? 'red' : o.status === 'delivered' ? 'green' : 'stone'}>{o.status}</Badge></span>
              </div>
            ))}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Profile & contract">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-5 text-sm">
              {[['Owner', c.owner], ['Phone', c.phone], ['Email', c.email], ['Address', `${c.address}, ${c.city}`], ['Contract', c.contract], ['Payment', c.paymentTerms], ['Lead / safety', `${c.leadDays}d / ${c.safetyDays}d${r.tier === 'T0' ? ' (+2 cold start)' : ''}`], ['Cover days', c.coverDays], ['Min order', `${c.minOrderKg} kg`], ['Onboarded', fmtDay(c.onboarded)], ['Price list', c.beans.map((b) => `${bean(b.sku).name} ${inr(bean(b.sku).pricePerKg)}/kg`).join(', ')]].map(([k, v]) => (
                <Fragment key={k}><dt className="text-stone-500">{k}</dt><dd className="text-stone-800">{v}</dd></Fragment>
              ))}
            </dl>
          </Card>
          <Card title="Demand status history">
            <ul className="divide-y divide-stone-100 text-sm">
              {c.statusHistory.length === 0 && <li className="p-5 text-stone-500">Active since onboarding.</li>}
              {c.statusHistory.map((h, i) => (
                <li key={i} className="px-5 py-2.5"><StatusBadge status={h.status} pct={h.pct} /> <span className="text-stone-600">{h.reason}</span><div className="text-[11px] text-stone-400">{fmtTime(h.ts)} · {h.by}</div></li>
              ))}
            </ul>
          </Card>
          <Card title="Notes & audit trail">
            <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto text-sm">
              {c.notes.map((n, i) => <li key={'n' + i} className="px-5 py-2.5"><Badge>Note</Badge> {n.text}<div className="text-[11px] text-stone-400">{fmtTime(n.ts)}</div></li>)}
              {st.audit.filter((x) => x.what.includes(c.id) || orders.some((o) => x.what.includes(o.id))).slice(0, 20).map((x) => (
                <li key={x.id} className="px-5 py-2.5 text-xs text-stone-600">{x.what}<div className="text-[11px] text-stone-400">{fmtTime(x.ts)} · {x.who}</div></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <StatusDialog cafe={statusFor} onClose={() => setStatusFor(null)} by="Roastery admin" />
      <ConfirmOnBehalf orderId={confirmId} onClose={() => setConfirmId(null)} />
      <Modal open={!!countSku} onClose={() => setCountSku(null)} title="Log stock count">
        <input className={inputCls} inputMode="decimal" value={countKg} onChange={(e) => setCountKg(e.target.value)} placeholder="kg on hand" autoFocus />
        <div className="mt-3 flex justify-end"><Btn variant="primary" disabled={countKg === '' || isNaN(+countKg)} onClick={() => { a.stockCount(c.id, countSku!, +countKg, 'Roastery admin'); setCountSku(null) }}>Save & re-forecast</Btn></div>
      </Modal>
    </div>
  )
}
