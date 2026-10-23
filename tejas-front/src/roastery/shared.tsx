import { useState } from 'react'
import { useStore } from '../lib/store'
import { useActions } from '../lib/actions'
import { type Cafe, type State, type Status, backtest, forecast, isOpen, orderSku, tierOf, today } from '../lib/model'
import { Btn, Field, Modal, inputCls } from '../ui'

export function cafeRow(st: State, c: Cafe, mapes?: Map<string, number>) {
  const tier = tierOf(c, st.orders)
  const fcs = c.beans.map((cb) => forecast(c, cb, st, today(), tier))
  const live = fcs.filter((f) => f.likely != null)
  const minRun = live.length ? Math.min(...live.map((f) => f.likely as number)) : null
  const drafts = st.orders.filter((o) => o.cafeId === c.id && (o.status === 'draft' || o.status === 'snoozed'))
  const inbound = st.orders.filter((o) => o.cafeId === c.id && isOpen(o)).reduce((a, o) => a + o.qty, 0)
  const stock = c.beans.reduce((a, b) => a + (b.onHand ?? 0), 0)
  const noStock = c.beans.some((b) => b.onHand == null)
  const lastCount = Math.max(...c.beans.map((b) => b.lastCount))
  const flagged = st.orders.filter((o) => o.cafeId === c.id && o.flag).length
  return { c, tier, fcs, minRun, drafts, draftKg: drafts.reduce((a, o) => a + o.qty, 0), inbound, stock, noStock, lastCount, flagged, mape: mapes?.get(c.id) ?? null, conf: live.find((f) => f.likely === minRun) }
}

export function useMapes() {
  const { st } = useStore()
  const bt = backtest(st, st.settings.alpha, st.settings.window)
  return { bt, mapes: new Map(bt.perCafe.map((p) => [p.cafe.id, p.mape])) }
}

export function StatusDialog({ cafe, onClose, by }: { cafe: Cafe | null; onClose: () => void; by: string }) {
  const a = useActions()
  const [status, setStatus] = useState<Status>('reduced')
  const [pct, setPct] = useState(40)
  const [reason, setReason] = useState('')
  const [reopen, setReopen] = useState('')
  const { st } = useStore()
  if (!cafe) return null
  const confirmed = st.orders.filter((o) => o.cafeId === cafe.id && (o.status === 'confirmed' || o.status === 'roasting'))
  return (
    <Modal open title={`Demand status · ${cafe.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['active', 'reduced', 'paused', 'closed'] as Status[]).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-xl border px-3 py-2.5 text-left text-sm ${status === s ? 'border-stone-900 bg-stone-900 text-amber-50' : 'border-stone-200 hover:border-stone-400'}`}>
              <div className="font-medium capitalize">{s === 'paused' ? 'Paused (temporary)' : s}</div>
              <div className="text-xs opacity-70">{s === 'active' ? 'Multiplier 1.0' : s === 'reduced' ? 'Choose −10% to −90%' : 'Multiplier 0'}</div>
            </button>
          ))}
        </div>
        {status === 'reduced' && (
          <Field label={`Reduction: −${pct}% (multiplier ${(1 - pct / 100).toFixed(2)})`}>
            <input type="range" min={10} max={90} step={5} value={pct} onChange={(e) => setPct(+e.target.value)} className="w-full accent-[#b5562b]" />
          </Field>
        )}
        {status === 'paused' && (
          <Field label="Reopen date"><input type="date" className={inputCls} value={reopen} onChange={(e) => setReopen(e.target.value)} /></Field>
        )}
        <Field label="Reason"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. footfall down after layoffs nearby" /></Field>
        {status !== 'active' && confirmed.length > 0 && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            {confirmed.length} confirmed order(s) will stay untouched and be flagged for the roastery to resolve per contract. Nothing is cancelled automatically.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!reason.trim()} onClick={() => {
            a.setStatus(cafe.id, status, pct, reason.trim(), by, reopen ? Math.floor(new Date(reopen).getTime() / 864e5) : undefined)
            onClose()
          }}>Apply & re-forecast</Btn>
        </div>
      </div>
    </Modal>
  )
}

export function ConfirmOnBehalf({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const a = useActions()
  const { st } = useStore()
  const [reason, setReason] = useState('Phone order from café manager')
  const o = st.orders.find((x) => x.id === orderId)
  if (!o) return null
  const bean = st.beans.find((b) => b.id === orderSku(o))!
  const c = st.cafes.find((x) => x.id === o.cafeId)!
  return (
    <Modal open title="Confirm before roasting" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-stone-600">
          Confirming on behalf of <b>{c.name}</b>: {o.qty} kg {bean.name}. The quantity is locked and enters the roast plan. A reason is required and logged.
        </p>
        {o.subSku && o.subAccepted === undefined && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">A substitute was proposed but the café has not accepted it — the original bean will be ordered.</p>}
        <Field label="Reason (logged)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="accent" disabled={!reason.trim()} onClick={() => { a.confirmOrder(o.id, 'Roastery on behalf', reason.trim()); onClose() }}>Confirm order</Btn>
        </div>
      </div>
    </Modal>
  )
}
