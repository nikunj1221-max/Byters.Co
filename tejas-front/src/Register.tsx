import { useMemo, useState } from 'react'
import { useStore } from './lib/store'
import { useActions } from './lib/actions'
import { type CafeType, TYPE_LABEL, coldStartPrior, r1 } from './lib/model'
import { Btn, Field, inputCls, Badge } from './ui'

export function RegisterForm({ mode, onDone }: { mode: 'roastery' | 'self'; onDone: (id: string) => void }) {
  const { st } = useStore()
  const a = useActions()
  const [f, setF] = useState({ name: '', owner: '', phone: '', email: '', address: '', city: 'Panaji', type: 'specialty' as CafeType, seats: '', cups: '', coverDays: 10, minOrderKg: 2, contract: 'Order-on-demand · 30-day terms', standing: false })
  const [beans, setBeans] = useState<Record<string, { on: boolean; kg: string; bags: string }>>({ house: { on: true, kg: '', bags: '' } })
  const [csv, setCsv] = useState('')
  const [ack, setAck] = useState(false)
  const set = (k: keyof typeof f, v: string | number | boolean) => setF((p) => ({ ...p, [k]: v }))
  const chosen = Object.entries(beans).filter(([, v]) => v.on)
  const history = useMemo(() => csv.split(/[\s,;]+/).map(Number).filter((n) => !isNaN(n) && n >= 0 && csv.trim() !== ''), [csv])
  const seats = +f.seats || 0
  const cups = +f.cups || undefined
  const prior = coldStartPrior({ type: f.type, seats, cupsPerDay: cups, city: f.city }, st.cafes, st.settings, Math.max(1, chosen.length))
  const dup = st.cafes.find((c) => (f.phone && c.phone.replace(/\D/g, '') === f.phone.replace(/\D/g, '')) || (f.email && c.email.toLowerCase() === f.email.toLowerCase().trim()) || (f.name && c.name.toLowerCase() === f.name.toLowerCase().trim()))
  const conflict = cups && seats && cups > seats * 15
  const stockOf = (v: { kg: string; bags: string }, sku: string) => {
    if (v.kg !== '') return +v.kg
    if (v.bags !== '') return +v.bags * st.beans.find((b) => b.id === sku)!.bagKg
    return null
  }
  const missingStock = chosen.some(([sku, v]) => stockOf(v, sku) == null)
  const valid = f.name.trim() && (f.phone.trim() || f.email.trim()) && (seats || cups) && chosen.length && !missingStock && !dup && (!conflict || ack)

  const submit = () => {
    const id = a.register({
      name: f.name.trim(), owner: f.owner.trim() || 'Manager', phone: f.phone, email: f.email, address: f.address, city: f.city, type: f.type,
      seats, cupsPerDay: cups, coverDays: f.coverDays, minOrderKg: f.minOrderKg, contract: f.contract, standing: f.standing,
      beans: chosen.map(([sku, v]) => ({ sku, onHand: stockOf(v, sku) })), history: history.length ? history : undefined,
    }, mode)
    onDone(id)
  }

  return (
    <div className="space-y-6">
      <section>
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">Basics</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Café name *"><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Owner / manager"><input className={inputCls} value={f.owner} onChange={(e) => set('owner', e.target.value)} /></Field>
          <Field label="Phone (WhatsApp) *"><input className={inputCls} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91" /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Address"><input className={inputCls} value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
          <Field label="City"><input className={inputCls} value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
        </div>
        {dup && <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">Possible duplicate of <b>{dup.name}</b> (matching name, phone or email).</p>}
      </section>
      <section>
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">Profile</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Café type *">
            <select className={inputCls} value={f.type} onChange={(e) => set('type', e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Seats"><input className={inputCls} inputMode="numeric" value={f.seats} onChange={(e) => set('seats', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Avg cups / day (if known)"><input className={inputCls} inputMode="numeric" value={f.cups} onChange={(e) => set('cups', e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        {conflict && (
          <label className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
            {cups} cups/day looks high for {seats} seats. Tick to confirm the numbers are right.
          </label>
        )}
      </section>
      <section>
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">Beans & starting stock *</h4>
        <div className="space-y-2">
          {st.beans.map((b) => {
            const v = beans[b.id] ?? { on: false, kg: '', bags: '' }
            return (
              <div key={b.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 ${v.on ? 'border-stone-400' : 'border-stone-200'}`}>
                <label className="flex min-w-48 flex-1 items-center gap-2 text-sm">
                  <input type="checkbox" checked={v.on} onChange={(e) => setBeans((p) => ({ ...p, [b.id]: { ...v, on: e.target.checked } }))} />
                  <span className="font-medium">{b.name}</span><span className="text-xs text-stone-500">{b.roast}</span>
                </label>
                {v.on && (
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <input className={inputCls + ' !h-8 !w-20'} placeholder="kg" inputMode="decimal" value={v.kg} onChange={(e) => setBeans((p) => ({ ...p, [b.id]: { ...v, kg: e.target.value } }))} />
                    or
                    <input className={inputCls + ' !h-8 !w-24'} placeholder={`bags (${b.bagKg}kg)`} inputMode="numeric" value={v.bags} onChange={(e) => setBeans((p) => ({ ...p, [b.id]: { ...v, bags: e.target.value } }))} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {missingStock && <p className="mt-2 text-xs text-amber-800">How many bags are on the shelf? We never assume zero or unlimited stock.</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Preferred cover days"><input className={inputCls} type="number" min={3} max={28} value={f.coverDays} onChange={(e) => set('coverDays', +e.target.value)} /></Field>
          <Field label="Minimum order (kg)"><input className={inputCls} type="number" min={1} value={f.minOrderKg} onChange={(e) => set('minOrderKg', +e.target.value)} /></Field>
        </div>
      </section>
      <section>
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">History (optional)</h4>
        <Field label="Daily kg used, oldest first — paste or upload CSV" hint={history.length ? `${history.length} days parsed${history.length >= 28 ? ' — starts directly at Learning tier' : ''}` : 'Skip if you have no records.'}>
          <textarea className={inputCls + ' !h-16 py-2'} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="1.2, 1.4, 0.9, ..." />
        </Field>
        <input type="file" accept=".csv,.txt" className="mt-2 text-xs" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setCsv(await file.text()) }} />
      </section>
      <section>
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">Commercial</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contract terms"><input className={inputCls} value={f.contract} onChange={(e) => set('contract', e.target.value)} /></Field>
          <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={f.standing} onChange={(e) => set('standing', e.target.checked)} /> Standing order</label>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-4">
        <div className="text-sm">
          <div className="flex items-center gap-2"><Badge tone="violet">New · Estimated</Badge><span className="font-medium">Cold-start estimate: {r1(prior.kg * Math.max(1, chosen.length))} kg/day</span></div>
          <div className="mt-1 text-xs text-stone-500">{prior.method} · ±35% range · +2 safety days while learning</div>
        </div>
        <Btn variant="primary" disabled={!valid} onClick={submit}>{mode === 'self' ? 'Submit for approval' : 'Add café'}</Btn>
      </div>
    </div>
  )
}
