import { useState } from 'react'
import { useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import {
  type Order, type OrderStatus, type Status, WD, backtest, fmtDay, fmtShort, fmtTime, forecast, inr, orderSku, r1, roastPlan,
  summaryMessage, today, weekday, isOpen,
} from '../lib/model'
import { Badge, Bar, Btn, Card, Field, Kpi, Modal, cx, inputCls } from '../ui'
import { ConfirmOnBehalf } from './shared'

const hatch = { backgroundImage: 'repeating-linear-gradient(135deg, rgba(120,113,108,.18) 0 6px, transparent 6px 12px)' }

export function ForecastView() {
  const { st } = useStore()
  const a = useActions()
  const [withDrafts, setWithDrafts] = useState(true)
  const [simCafe, setSimCafe] = useState('')
  const [simStatus, setSimStatus] = useState<Status>('closed')
  const [simPct, setSimPct] = useState(40)
  const t = today()
  const weekly = (state = st) => {
    const usage = state.cafes.filter((c) => c.approved).reduce((sum, c) => sum + c.beans.reduce((x, cb) => x + forecast(c, cb, state, t).rate * 7, 0), 0)
    return [0, 1, 2, 3].map((w) => {
      const inWeek = (o: Order) => o.neededBy >= t + w * 7 && o.neededBy < t + w * 7 + 7
      const confirmed = state.orders.filter((o) => isOpen(o) && inWeek(o)).reduce((x, o) => x + o.qty, 0)
      const drafts = state.orders.filter((o) => (o.status === 'draft' || o.status === 'snoozed') && inWeek(o)).reduce((x, o) => x + o.qty, 0)
      return { w, confirmed, drafts, forecast: Math.max(0, usage - confirmed - drafts), usage }
    })
  }
  const base = weekly()
  const max = Math.max(...base.map((b) => b.confirmed + b.drafts + b.forecast)) * 1.1
  const live = st.cafes.filter((c) => c.approved && c.status !== 'closed')
  let sim: null | { before: number; after: number; flagged: number; name: string } = null
  if (simCafe) {
    const c = st.cafes.find((x) => x.id === simCafe)!
    const clone = { ...st, cafes: st.cafes.map((x) => (x.id === simCafe ? { ...x, status: simStatus, reductionPct: simStatus === 'reduced' ? simPct : 0 } : x)) }
    sim = { before: base[0].usage, after: weekly(clone)[0].usage, flagged: st.orders.filter((o) => o.cafeId === simCafe && isOpen(o)).length, name: c.name }
  }
  return (
    <div className="space-y-6">
      <Card title="Demand by week — confirmed vs forecast" action={<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={withDrafts} onChange={(e) => setWithDrafts(e.target.checked)} /> Show drafts</label>}>
        <div className="grid grid-cols-4 items-end gap-6 px-6 pt-6" style={{ height: 280 }}>
          {base.map((b) => (
            <div key={b.w} className="flex h-full flex-col justify-end">
              <div className="text-center text-xs tabular-nums text-stone-500">{r1(b.confirmed + (withDrafts ? b.drafts : 0) + b.forecast)} kg</div>
              <div className="mx-auto flex w-16 flex-col overflow-hidden rounded-t-md">
                <div style={{ height: (b.forecast / max) * 220, ...hatch }} className="bg-stone-100" title="Projected consumption (not ordered)" />
                {withDrafts && <div style={{ height: (b.drafts / max) * 220 }} className="bg-amber-300" title="Draft reorders" />}
                <div style={{ height: (b.confirmed / max) * 220 }} className="bg-stone-900" title="Confirmed" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-6 px-6 pb-4 pt-2 text-center text-xs text-stone-500">{base.map((b) => <div key={b.w}>Week of {fmtShort(t + b.w * 7)}<div className="tabular-nums text-stone-800">{r1(b.confirmed)} kg confirmed</div></div>)}</div>
        <div className="flex gap-4 border-t border-stone-100 px-6 py-3 text-xs text-stone-600">
          <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-stone-900" />Confirmed (roastable)</span>
          <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-amber-300" />Draft reorders (need confirmation)</span>
          <span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-stone-100" style={hatch} />Projected consumption</span>
        </div>
      </Card>
      <Card title="Scenario simulator — preview before applying">
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
          <Field label="Café"><select className={inputCls} value={simCafe} onChange={(e) => setSimCafe(e.target.value)}><option value="">Choose café…</option>{live.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Scenario"><select className={inputCls} value={simStatus} onChange={(e) => setSimStatus(e.target.value as Status)}><option value="closed">Mark closed</option><option value="reduced">Reduce</option><option value="paused">Pause</option><option value="active">Active</option></select></Field>
          {simStatus === 'reduced' && <Field label={`−${simPct}%`}><input type="range" min={10} max={90} step={5} value={simPct} onChange={(e) => setSimPct(+e.target.value)} className="accent-[#b5562b]" /></Field>}
          <Btn variant="primary" disabled={!sim} onClick={() => sim && a.setStatus(simCafe, simStatus, simPct, 'Applied from scenario simulator', 'Roastery admin')}>Apply scenario</Btn>
        </div>
        {sim && (
          <div className="grid gap-3 border-t border-stone-100 p-5 sm:grid-cols-3">
            <Kpi label="Weekly portfolio demand" value={`${r1(sim.before)} → ${r1(sim.after)} kg`} sub={`${r1(sim.after - sim.before)} kg/week`} tone={sim.after < sim.before ? 'red' : undefined} />
            <Kpi label="Confirmed orders affected" value={sim.flagged} sub="Would be flagged, never cancelled" />
            <Kpi label="Roast plan change" value="0 kg" sub="Only confirmed orders are scheduled" />
          </div>
        )}
      </Card>
    </div>
  )
}

export function Roasting() {
  const { st } = useStore()
  const a = useActions()
  const plan = roastPlan(st)
  const moved = Object.keys(st.moves).map((id) => st.orders.find((o) => o.id === id)).filter((o): o is Order => !!o && (o.status === 'confirmed' || o.status === 'roasting'))
  const draftCafes = new Set(st.orders.filter((o) => o.status === 'draft').map((o) => o.cafeId))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Planned (confirmed)" value={`${r1(plan.used)} kg`} sub={`of ${plan.cap} kg capacity`} />
        <Kpi label="Utilisation" value={`${Math.round(plan.util * 100)}%`} tone={plan.util < st.settings.utilAlert ? 'red' : 'green'} />
        <Kpi label="Unused roaster kg" value={r1(plan.unused)} tone="amber" sub={`+ ${plan.coTotal} kg co-roasting slots`} />
        <Kpi label="Forecast layer" value={`${r1(plan.forecastKg)} kg`} sub="Unconfirmed — not schedulable" />
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[1050px] grid-cols-7 gap-3">
          {plan.days.map((d) => {
            const over = d.used > d.cap
            return (
              <div key={d.day} className={cx('flex flex-col rounded-2xl border bg-white', over ? 'border-red-300' : 'border-stone-200/80')}>
                <div className="border-b border-stone-100 p-3">
                  <div className="flex items-baseline justify-between"><span className="font-display text-lg">{WD[weekday(d.day)]}</span><span className="text-xs text-stone-500">{fmtShort(d.day)}</span></div>
                  <Bar value={d.used} max={d.cap || 1} tone={over ? 'red' : d.used / (d.cap || 1) < 0.65 ? 'amber' : 'green'} className="mt-2" />
                  <div className="mt-1 flex justify-between text-[11px] tabular-nums text-stone-500"><span>{r1(d.used)} / {d.cap} kg</span>{over ? <span className="font-semibold text-red-700">+{r1(d.used - d.cap)} over</span> : <span>{r1(d.cap - d.used)} free</span>}</div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {d.cap === 0 && d.batches.length === 0 && <div className="py-6 text-center text-xs text-stone-400">Roaster off</div>}
                  {d.batches.map((b) => (
                    <div key={b.order.id} className={cx('rounded-lg p-2 text-xs', b.locked ? 'bg-stone-900 text-amber-50' : 'bg-stone-800 text-stone-50')}>
                      <div className="flex justify-between font-medium"><span>{b.bean.name}</span><span className="tabular-nums">{b.order.qty}kg</span></div>
                      <div className="opacity-70">{b.cafe.name}</div>
                      <div className="opacity-60">{b.bean.lot} · {b.bean.origin}</div>
                      <div className="opacity-60">{b.bean.cert}</div>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <span className="opacity-70">needed {fmtShort(b.order.neededBy)}</span>
                        {b.locked ? <span className="text-amber-300">Roasting · locked</span> : <button onClick={() => a.advance(b.order.id, 'roasting')} className="rounded bg-white/15 px-1.5 py-0.5 hover:bg-white/25">Start</button>}
                      </div>
                      {b.moved && <div className="mt-1 text-amber-300">Moved by re-balancer</div>}
                      {b.order.flag && <div className="mt-1 text-red-300">Contract flag</div>}
                    </div>
                  ))}
                  {d.drafts.map((x) => (
                    <div key={x.order.id} className="rounded-lg border border-dashed border-stone-300 p-2 text-xs text-stone-500" style={hatch}>
                      <div className="flex justify-between"><span>{x.bean.name}</span><span>{x.order.qty}kg</span></div>
                      <div>{x.cafe.name}</div>
                      <div className="font-medium">Unconfirmed forecast, not scheduled</div>
                    </div>
                  ))}
                  {d.cap - d.used > 0 && <div className="mt-auto rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900">Unused {r1(d.cap - d.used)} kg{d.co ? ` · co-roast ${d.co} kg` : ''}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Re-balance suggestions">
          {plan.moves.length === 0 && moved.length === 0 && <p className="p-5 text-sm text-stone-500">No day exceeds capacity.</p>}
          {plan.moves.map((m) => (
            <div key={m.orderId} className="border-b border-stone-100 px-5 py-3 last:border-0">
              <div className="text-sm font-medium">{m.label}</div>
              <div className="text-xs text-stone-500">{m.reason}</div>
              <div className="mt-1 text-xs text-stone-600">Before: {fmtDay(m.from)} → After: {fmtDay(m.to)}</div>
              <div className="mt-2 flex gap-2"><Btn size="sm" variant="primary" onClick={() => a.acceptMove(m.orderId, m.to)}>Accept</Btn><Btn size="sm" variant="ghost" onClick={() => a.rejectMove(m.orderId)}>Reject</Btn></div>
            </div>
          ))}
          {moved.map((o) => (
            <div key={o.id} className="flex items-center justify-between border-b border-stone-100 px-5 py-3 text-sm last:border-0">
              <span>Moved: {o.qty} kg {st.beans.find((b) => b.id === orderSku(o))!.name} → {fmtDay(st.moves[o.id])}</span>
              {o.status === 'roasting' ? <Badge>Locked</Badge> : <Btn size="sm" onClick={() => a.revertMove(o.id)}>Revert</Btn>}
            </div>
          ))}
        </Card>
        <Card title="Unused capacity — suggested actions">
          <ul className="space-y-3 p-5 text-sm">
            <li className="rounded-xl bg-stone-50 p-3"><b>Offer {r1(plan.unused)} kg of roaster slots</b> and {plan.coTotal} kg co-roasting capacity to co-roasting clients this week ({plan.days.filter((d) => d.cap - d.used > 10).map((d) => WD[weekday(d.day)]).join(', ') || 'none'}).</li>
            <li className="rounded-xl bg-stone-50 p-3"><b>Nudge {draftCafes.size} cafés with drafted reorders</b> ({r1(plan.forecastKg)} kg in this horizon) to confirm early — confirmation is still required.</li>
            <li className="rounded-xl bg-stone-50 p-3"><b>Pull forward standing orders</b> from {st.cafes.filter((c) => c.standing && c.status === 'active').length} active standing-order cafés if they agree.</li>
            <li className="text-xs text-stone-500">Suggestions only. Unconfirmed forecast quantities are never roasted.</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}

const STATUSES: { k: OrderStatus | 'flagged'; label: string }[] = [
  { k: 'flagged', label: 'Flagged' }, { k: 'draft', label: 'Pending confirmation' }, { k: 'confirmed', label: 'Confirmed' },
  { k: 'roasting', label: 'Roasting' }, { k: 'dispatched', label: 'Dispatched' }, { k: 'delivered', label: 'Delivered' }, { k: 'cancelled', label: 'Cancelled' },
]

export function Orders() {
  const { st } = useStore()
  const a = useActions()
  const [tab, setTab] = useState<OrderStatus | 'flagged'>(st.orders.some((o) => o.flag) ? 'flagged' : 'draft')
  const [sel, setSel] = useState<string[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [bulk, setBulk] = useState(false)
  const [reason, setReason] = useState('Phone order from café manager')
  const [invoice, setInvoice] = useState<Order | null>(null)
  const [resolve, setResolve] = useState<Order | null>(null)
  const [how, setHow] = useState<'honour' | 'redirect' | 'cancel'>('honour')
  const [note, setNote] = useState('')
  const [redirect, setRedirect] = useState('')
  const list = st.orders.filter((o) => (tab === 'flagged' ? !!o.flag : tab === 'draft' ? o.status === 'draft' || o.status === 'snoozed' : o.status === tab)).sort((x, y) => x.neededBy - y.neededBy)
  const cafe = (id: string) => st.cafes.find((c) => c.id === id)!
  const bean = (id: string) => st.beans.find((b) => b.id === id)!
  const count = (k: OrderStatus | 'flagged') => st.orders.filter((o) => (k === 'flagged' ? !!o.flag : k === 'draft' ? o.status === 'draft' || o.status === 'snoozed' : o.status === k)).length
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg bg-stone-200/60 p-0.5 text-sm">
        {STATUSES.map((s) => (
          <button key={s.k} onClick={() => { setTab(s.k); setSel([]) }} className={cx('rounded-md px-3 py-1', tab === s.k && 'bg-white shadow-sm', s.k === 'flagged' && count('flagged') > 0 && 'text-red-700')}>{s.label} <span className="text-xs text-stone-500">{count(s.k)}</span></button>
        ))}
      </div>
      {tab === 'draft' && sel.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-stone-900 px-4 py-2 text-sm text-amber-50">{sel.length} selected <Btn size="sm" variant="accent" onClick={() => setBulk(true)}>Confirm on behalf…</Btn></div>
      )}
      <Card>
        {list.length === 0 && <p className="p-5 text-sm text-stone-500">Nothing here.</p>}
        {list.map((o) => {
          const c = cafe(o.cafeId)
          const b = bean(orderSku(o))
          return (
            <div key={o.id} className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-5 py-3 last:border-0">
              {tab === 'draft' && <input type="checkbox" checked={sel.includes(o.id)} onChange={(e) => setSel((p) => (e.target.checked ? [...p, o.id] : p.filter((x) => x !== o.id)))} />}
              <div className="min-w-56 flex-1 text-sm">
                <div className="font-medium">{c.name} · {o.qty} kg {b.name} {o.type === 'rush' && <Badge tone="red">Rush</Badge>} {o.type === 'standing' && <Badge>Standing</Badge>}</div>
                <div className="text-xs text-stone-500">Needed {fmtDay(o.neededBy)} · {inr(o.qty * b.pricePerKg)} · lot {b.lot}{o.confirmedBy ? ` · by ${o.confirmedBy}` : ''}{o.reason ? ` · ${o.reason}` : ''}</div>
                {o.flag && <div className="mt-1 text-xs text-red-700">{o.flag}</div>}
                {(o.status === 'draft' || o.status === 'snoozed') && <Badge className="mt-1">Unconfirmed forecast, not scheduled</Badge>}
              </div>
              <div className="flex gap-1">
                {o.flag && <Btn size="sm" variant="danger" onClick={() => { setResolve(o); setHow('honour'); setNote(''); setRedirect('') }}>Resolve</Btn>}
                {(o.status === 'draft' || o.status === 'snoozed') && <Btn size="sm" variant="accent" onClick={() => setConfirmId(o.id)}>Confirm before roasting</Btn>}
                {o.status === 'confirmed' && <Btn size="sm" onClick={() => a.advance(o.id, 'roasting')}>Start roasting</Btn>}
                {o.status === 'roasting' && <Btn size="sm" onClick={() => a.advance(o.id, 'dispatched')}>Dispatch</Btn>}
                {o.status === 'dispatched' && <Btn size="sm" onClick={() => a.advance(o.id, 'delivered')}>Mark delivered</Btn>}
                {o.status !== 'draft' && o.status !== 'snoozed' && <Btn size="sm" variant="ghost" onClick={() => setInvoice(o)}>Invoice</Btn>}
              </div>
            </div>
          )
        })}
      </Card>
      <ConfirmOnBehalf orderId={confirmId} onClose={() => setConfirmId(null)} />
      <Modal open={bulk} onClose={() => setBulk(false)} title={`Confirm ${sel.length} orders on behalf`}>
        <Field label="Reason (required, logged)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="mt-4 flex justify-end"><Btn variant="accent" disabled={!reason.trim()} onClick={() => { sel.forEach((id) => a.confirmOrder(id, 'Roastery on behalf', reason.trim())); setSel([]); setBulk(false) }}>Confirm all</Btn></div>
      </Modal>
      <Modal open={!!resolve} onClose={() => setResolve(null)} title="Resolve per contract">
        {resolve && (
          <div className="space-y-4 text-sm">
            <p className="text-stone-600">{cafe(resolve.cafeId).name}: {resolve.qty} kg confirmed. Contract: {cafe(resolve.cafeId).contract}.</p>
            <div className="grid gap-2">
              {([['honour', 'Honour — deliver as confirmed'], ['redirect', 'Redirect to another café'], ['cancel', 'Cancel by mutual agreement (after contact)']] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="radio" checked={how === k} onChange={() => setHow(k)} />{l}</label>
              ))}
            </div>
            {how === 'redirect' && <select className={inputCls} value={redirect} onChange={(e) => setRedirect(e.target.value)}><option value="">Choose café…</option>{st.cafes.filter((c) => c.status === 'active' && c.approved).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
            <Field label="Note (logged)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. spoke to owner, agreed to…" /></Field>
            <div className="flex justify-end"><Btn variant="primary" disabled={!note.trim() || (how === 'redirect' && !redirect)} onClick={() => { a.resolveFlag(resolve.id, how, note.trim(), redirect); setResolve(null) }}>Save resolution</Btn></div>
          </div>
        )}
      </Modal>
      <Modal open={!!invoice} onClose={() => setInvoice(null)} title="Invoice">
        {invoice && <Invoice o={invoice} />}
      </Modal>
    </div>
  )
}

export function Invoice({ o }: { o: Order }) {
  const { st } = useStore()
  const c = st.cafes.find((x) => x.id === o.cafeId)!
  const b = st.beans.find((x) => x.id === orderSku(o))!
  const sub = o.qty * b.pricePerKg
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between"><div><div className="font-display text-lg">Siolim Specialty Coffee</div><div className="text-xs text-stone-500">Invoice #{o.id.toUpperCase()}</div></div><div className="text-right text-xs text-stone-500">{c.name}<br />{c.address}, {c.city}</div></div>
      <table className="w-full text-sm"><tbody>
        <tr className="border-y border-stone-100"><td className="py-2">{b.name} · lot {b.lot}<div className="text-xs text-stone-500">{b.origin} · {b.cert}</div></td><td className="text-right tabular-nums">{o.qty} kg × {inr(b.pricePerKg)}</td><td className="text-right tabular-nums">{inr(sub)}</td></tr>
        <tr><td className="pt-2 text-stone-500" colSpan={2}>GST 5%</td><td className="pt-2 text-right tabular-nums">{inr(sub * 0.05)}</td></tr>
        <tr className="font-semibold"><td colSpan={2}>Total</td><td className="text-right tabular-nums">{inr(sub * 1.05)}</td></tr>
      </tbody></table>
      <div className="text-xs text-stone-500">Delivery {fmtDay(o.neededBy)} · {c.paymentTerms} · Status: {o.status}</div>
      <Btn size="sm" onClick={() => window.print()}>Print</Btn>
    </div>
  )
}

export function Backtest() {
  const { st } = useStore()
  const a = useActions()
  const [alpha, setAlpha] = useState(st.settings.alpha)
  const [win, setWin] = useState(st.settings.window)
  const bt = backtest(st, alpha, win)
  const worst = [...bt.perCafe].sort((x, y) => y.mape - x.mape).slice(0, 10)
  const hmax = Math.max(1, ...bt.hist.map((h) => h.n))
  const tmax = Math.max(30, ...bt.trend.map((x) => x.mape))
  const changed = alpha !== st.settings.alpha || win !== st.settings.window
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Portfolio MAPE" value={`${r1(bt.mape)}%`} tone={bt.mape <= 20 ? 'green' : 'red'} sub="Target under 20%" />
        <Kpi label="Predictions replayed" value={bt.n} sub={`${bt.perCafe.length} calibrated cafés`} />
        <Kpi label={`Above ${st.settings.mapeThreshold}%`} value={bt.perCafe.filter((p) => p.mape > st.settings.mapeThreshold).length} tone="amber" sub="Flagged for tuning" />
        <Kpi label="Excluded (cold start)" value={bt.cold.length} sub="Under 4 weeks of data" />
      </div>
      <Card title="Tuning" action={changed && <Btn size="sm" variant="primary" onClick={() => a.settings({ alpha, window: win })}>Save as live model</Btn>}>
        <div className="grid gap-6 p-5 md:grid-cols-2">
          <Field label={`Smoothing α = ${alpha.toFixed(2)} (higher reacts faster)`}><input type="range" min={0.05} max={0.8} step={0.05} value={alpha} onChange={(e) => setAlpha(+e.target.value)} className="w-full accent-[#b5562b]" /></Field>
          <Field label={`Look-back window = ${win} days`}><input type="range" min={7} max={42} step={7} value={win} onChange={(e) => setWin(+e.target.value)} className="w-full accent-[#b5562b]" /></Field>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Error distribution (APE)">
          <div className="flex h-48 items-end gap-3 p-5">
            {bt.hist.map((h) => (
              <div key={h.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] tabular-nums text-stone-500">{h.n}</span>
                <div className="w-full rounded-t bg-stone-800" style={{ height: (h.n / hmax) * 130 }} />
                <span className="text-[10px] text-stone-500">{h.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="MAPE trend over replay windows">
          <svg viewBox="0 0 400 160" className="h-48 w-full p-4" preserveAspectRatio="none">
            <line x1={0} x2={400} y1={160 - (20 / tmax) * 150} y2={160 - (20 / tmax) * 150} stroke="#b5562b" strokeDasharray="4 4" />
            <path d={bt.trend.map((p, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, bt.trend.length - 1)) * 400},${160 - (p.mape / tmax) * 150}`).join('')} stroke="#292524" strokeWidth={2} fill="none" />
          </svg>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Worst 10 cafés">
          {worst.map((p) => (
            <div key={p.cafe.id} className="flex items-center gap-3 border-b border-stone-100 px-5 py-2 text-sm last:border-0">
              <span className="flex-1">{p.cafe.name}</span>
              <Bar value={p.mape} max={60} tone={p.mape > st.settings.mapeThreshold ? 'red' : 'green'} className="w-32" />
              <span className="w-14 text-right tabular-nums">{r1(p.mape)}%</span>
            </div>
          ))}
        </Card>
        <Card title="Cold-start cafés (shown separately)">
          {bt.cold.length === 0 && <p className="p-5 text-sm text-stone-500">None.</p>}
          {bt.cold.map((c) => <div key={c.id} className="border-b border-stone-100 px-5 py-2 text-sm last:border-0">{c.name} <span className="text-xs text-stone-500">· {Math.max(0, ...c.beans.map((b) => b.history.length))} days of data</span></div>)}
        </Card>
      </div>
    </div>
  )
}

export function Messages() {
  const { st } = useStore()
  const a = useActions()
  const eligible = st.cafes.filter((c) => c.approved && c.status !== 'closed')
  const [cafeId, setCafeId] = useState(eligible[0]?.id ?? '')
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const c = st.cafes.find((x) => x.id === cafeId)
  const preview = c ? summaryMessage(st, c, channel) : null
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card title="Weekly summary dispatcher" action={<Badge>Scheduled Mondays 08:00</Badge>}>
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Café"><select className={inputCls} value={cafeId} onChange={(e) => setCafeId(e.target.value)}>{eligible.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            <Field label="Channel"><select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value as 'whatsapp' | 'email')}><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></Field>
          </div>
          {c && !c.optIn[channel] && <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">{c.name} has opted out of {channel}. Sending will be logged as failed.</p>}
          <pre className={cx('max-h-96 overflow-auto whitespace-pre-wrap rounded-xl p-4 font-sans text-[13px] leading-relaxed', channel === 'whatsapp' ? 'bg-[#e7f3e3] text-stone-800' : 'border border-stone-200 bg-stone-50')}>{preview?.body}</pre>
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" disabled={!c} onClick={() => a.dispatch([cafeId], channel)}>Send to this café</Btn>
            <Btn onClick={() => a.dispatch(eligible.filter((x) => x.optIn[channel]).map((x) => x.id), channel)}>Send to all opted-in ({eligible.filter((x) => x.optIn[channel]).length})</Btn>
          </div>
          <p className="text-xs text-stone-500">Simulated delivery: messages are rendered and logged. The adapter is ready to plug in WhatsApp/Email APIs. Summaries never place orders.</p>
        </div>
      </Card>
      <Card title={`Send log (${st.messages.length})`}>
        <div className="max-h-[640px] overflow-y-auto">
          {st.messages.length === 0 && <p className="p-5 text-sm text-stone-500">No messages sent yet.</p>}
          {st.messages.slice(0, 100).map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-2.5 text-sm last:border-0">
              <div><div>{st.cafes.find((x) => x.id === m.cafeId)?.name} <span className="text-xs text-stone-500">· {m.channel} · attempt {m.attempts}</span></div><div className="text-[11px] text-stone-400">{fmtTime(m.ts)}{m.error ? ` · ${m.error}` : ''}</div></div>
              <span className="flex items-center gap-1"><Badge tone={m.status === 'sent' ? 'green' : 'red'}>{m.status}</Badge>{m.status === 'failed' && <Btn size="sm" variant="ghost" onClick={() => a.retry(m.id)}>Retry</Btn>}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export function SettingsView() {
  const { st, reset } = useStore()
  const a = useActions()
  const s = st.settings
  const num = 'h-8 w-16 rounded-md border border-stone-300 px-2 text-sm tabular-nums'
  return (
    <div className="space-y-6">
      <Card title="Roaster capacity (kg per day)">
        <div className="overflow-x-auto p-5">
          <table className="text-sm"><thead><tr><th />{WD.map((d) => <th key={d} className="px-2 pb-2 text-xs font-medium text-stone-500">{d}</th>)}</tr></thead>
            <tbody>
              <tr><td className="pr-4 text-stone-600">Roaster</td>{s.capacity.map((v, i) => <td key={i} className="px-1"><input className={num} type="number" min={0} value={v} onChange={(e) => a.settings({ capacity: s.capacity.map((x, j) => (j === i ? +e.target.value : x)) })} /></td>)}</tr>
              <tr><td className="pr-4 pt-2 text-stone-600">Co-roasting</td>{s.coRoast.map((v, i) => <td key={i} className="px-1 pt-2"><input className={num} type="number" min={0} value={v} onChange={(e) => a.settings({ coRoast: s.coRoast.map((x, j) => (j === i ? +e.target.value : x)) })} /></td>)}</tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Forecast defaults">
        <div className="grid gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
          {([['safetyDefault', 'Safety days'], ['leadDefault', 'Lead time days'], ['mapeThreshold', 'MAPE flag %'], ['gramsPerCup', 'Grams per cup'], ['waste', 'Waste factor'], ['utilAlert', 'Crisis banner below']] as const).map(([k, l]) => (
            <Field key={k} label={l}><input className={inputCls} type="number" step={k === 'waste' || k === 'utilAlert' ? 0.01 : 1} value={s[k]} onChange={(e) => a.settings({ [k]: +e.target.value })} /></Field>
          ))}
        </div>
      </Card>
      <Card title="Bean catalogue, lots & substitutes">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-stone-500"><tr className="border-b border-stone-100">{['Bean', 'Lot / certification', 'Roast · family', 'Shelf / peak', 'Trace', 'Price/kg', 'Lot kg', 'Eligible substitutes'].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {st.beans.map((b) => (
                <tr key={b.id} className="border-b border-stone-100">
                  <td className="px-4 py-2 font-medium">{b.name}{b.singleOrigin && <Badge className="ml-1">SO</Badge>}</td>
                  <td className="px-4 text-xs text-stone-600">{b.lot}<br />{b.cert}</td>
                  <td className="px-4 text-xs">{b.roast} · {b.family}</td>
                  <td className="px-4 text-xs">{b.shelfLife}d / {b.peakDays}d</td>
                  <td className="px-4 text-xs">{'●'.repeat(b.traceScore)}</td>
                  <td className="px-4"><input className={num + ' !w-20'} type="number" value={b.pricePerKg} onChange={(e) => a.bean(b.id, { pricePerKg: +e.target.value })} /></td>
                  <td className="px-4"><input className={num} type="number" value={b.lotKg} onChange={(e) => a.bean(b.id, { lotKg: +e.target.value })} /></td>
                  <td className="px-4 text-xs text-stone-600">{st.beans.filter((x) => x.id !== b.id && x.roast === b.roast && x.family === b.family && x.traceScore >= b.traceScore).map((x) => x.name).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Demo data">
        <div className="flex items-center justify-between gap-4 p-5 text-sm">
          <span className="text-stone-600">Restore the seeded crisis dataset (50 cafés, 90 days of history). All changes are stored in this browser.</span>
          <Btn variant="danger" onClick={() => confirm('Reset all data to the seeded demo?') && reset()}>Reset demo data</Btn>
        </div>
      </Card>
    </div>
  )
}
