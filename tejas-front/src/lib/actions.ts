import { useStore } from './store'
import {
  type Cafe, type CafeType, type State, type Status, type Msg,
  coldStartPrior, orderSku, summaryMessage, tierOf, today, uid, TIER_NAME, r1,
} from './model'

const alert = (s: State, to: string, kind: 'info' | 'warn' | 'risk' | 'ok', text: string) =>
  s.alerts.unshift({ id: uid(), ts: Date.now(), to, kind, text })

export interface NewCafe {
  name: string; owner: string; phone: string; email: string; address: string; city: string
  type: CafeType; seats: number; cupsPerDay?: number; beans: { sku: string; onHand: number | null }[]
  coverDays: number; minOrderKg: number; contract: string; standing: boolean; history?: number[]
}

export function useActions() {
  const { update } = useStore()
  return {
    setStatus(cafeId: string, status: Status, pct: number, reason: string, by: string, reopenDay?: number) {
      update((s) => {
        const c = s.cafes.find((x) => x.id === cafeId)!
        c.status = status
        c.reductionPct = status === 'reduced' ? pct : 0
        c.reopenDay = status === 'paused' ? reopenDay : undefined
        c.statusHistory.unshift({ ts: Date.now(), status, pct, reason, by, effective: today() })
        s.dismissedRisk = s.dismissedRisk.filter((x) => x !== cafeId)
        let flagged = 0
        if (status !== 'active') {
          for (const o of s.orders) {
            if (o.cafeId === cafeId && (o.status === 'confirmed' || o.status === 'roasting')) {
              o.flag = `Café marked ${status}${status === 'reduced' ? ` −${pct}%` : ''} while this confirmed order exists — resolve per contract`
              flagged++
            }
          }
        }
        const label = status === 'reduced' ? `Reduced −${pct}%` : status[0].toUpperCase() + status.slice(1)
        alert(s, 'roastery', status === 'active' ? 'ok' : 'risk', `${c.name} status → ${label} (${by}). Re-forecast done.${flagged ? ` ${flagged} confirmed order(s) flagged for resolution.` : ''}`)
        alert(s, cafeId, 'info', `Your status is now ${label}. Confirmed orders are unchanged; the roastery will contact you about them.`)
      }, { who: by, what: `Set ${cafeId} status to ${status}${status === 'reduced' ? ` −${pct}%` : ''}: ${reason}` })
    },
    confirmOrder(orderId: string, by: string, reason?: string) {
      update((s) => {
        const o = s.orders.find((x) => x.id === orderId)
        if (!o || (o.status !== 'draft' && o.status !== 'snoozed')) return // idempotent
        if (o.subSku && o.subAccepted === undefined) o.subAccepted = false
        o.status = 'confirmed'
        o.confirmedAt = Date.now()
        o.confirmedBy = by
        o.reason = reason
        const bean = s.beans.find((b) => b.id === orderSku(o))!
        bean.lotKg = Math.max(0, bean.lotKg - o.qty)
        const c = s.cafes.find((x) => x.id === o.cafeId)!
        alert(s, o.cafeId, 'ok', `Order confirmed: ${o.qty} kg ${bean.name}, delivery ${new Date(o.neededBy * 864e5).toDateString()}.`)
        alert(s, 'roastery', 'ok', `${c.name} confirmed ${o.qty} kg ${bean.name}${by !== 'Café' ? ` (on behalf: ${reason})` : ''} — added to roast plan.`)
      }, { who: by, what: `Confirmed order ${orderId}${reason ? ` — ${reason}` : ''}` })
    },
    undoConfirm(orderId: string) {
      update((s) => {
        const o = s.orders.find((x) => x.id === orderId)
        if (!o || o.status !== 'confirmed' || Date.now() - (o.confirmedAt ?? 0) > 6e5) return
        const bean = s.beans.find((b) => b.id === orderSku(o))!
        bean.lotKg += o.qty
        o.status = 'draft'
        o.edited = true
        o.confirmedAt = undefined
        delete s.moves[o.id]
        alert(s, 'roastery', 'info', `Confirmation undone for ${o.qty} kg ${bean.name}.`)
      }, { who: 'Café', what: `Undo confirmation ${orderId}` })
    },
    snooze(orderId: string) {
      update((s) => {
        const o = s.orders.find((x) => x.id === orderId)!
        o.status = 'snoozed'
        o.snoozeUntil = Date.now() + 864e5
      })
    },
    editQty(orderId: string, qty: number) {
      update((s) => {
        const o = s.orders.find((x) => x.id === orderId)!
        if (o.status !== 'draft') return
        o.qty = Math.max(1, qty)
        o.edited = true
      })
    },
    setSub(orderId: string, accept: boolean) {
      update((s) => { s.orders.find((x) => x.id === orderId)!.subAccepted = accept })
    },
    stockCount(cafeId: string, sku: string, kg: number, by: string) {
      update((s) => {
        const t = today()
        const c = s.cafes.find((x) => x.id === cafeId)!
        const before = tierOf(c, s.orders)
        const cb = c.beans.find((b) => b.sku === sku)!
        if (cb.onHand != null) {
          const delivered = s.orders
            .filter((o) => o.cafeId === cafeId && orderSku(o) === sku && o.status === 'delivered' && o.neededBy > cb.lastCount && o.neededBy <= t)
            .reduce((a, o) => a + o.qty, 0)
          const used = cb.onHand + delivered - kg
          const end = cb.histStart + cb.history.length
          if (!cb.history.length) cb.histStart = Math.min(cb.lastCount, t - 1)
          const from = cb.histStart + cb.history.length
          const days = Math.max(1, t - from)
          if (used >= 0 && from < t) for (let d = 0; d < days; d++) cb.history.push(r1((used / days) * 100) / 100)
          void end
        }
        cb.onHand = Math.max(0, kg)
        cb.lastCount = t
        c.counts++
        const after = tierOf(c, s.orders)
        if (after !== before) {
          alert(s, cafeId, 'ok', `Forecast confidence improved: ${TIER_NAME[before]} → ${TIER_NAME[after]}.`)
          alert(s, 'roastery', 'info', `${c.name} promoted ${TIER_NAME[before]} → ${TIER_NAME[after]}.`)
        }
      }, { who: by, what: `Stock count ${cafeId} ${sku}: ${kg} kg` })
    },
    advance(orderId: string, to: 'roasting' | 'dispatched' | 'delivered') {
      update((s) => {
        const o = s.orders.find((x) => x.id === orderId)!
        o.status = to
        if (to === 'delivered') {
          const c = s.cafes.find((x) => x.id === o.cafeId)!
          const cb = c.beans.find((b) => b.sku === orderSku(o))
          if (cb) cb.onHand = (cb.onHand ?? 0) + o.qty
          else c.beans.push({ sku: orderSku(o), onHand: o.qty, lastCount: today(), histStart: today(), history: [], prior: 0.8 })
          o.neededBy = Math.min(o.neededBy, today())
        }
        alert(s, o.cafeId, 'info', `Order ${to}: ${o.qty} kg ${s.beans.find((b) => b.id === orderSku(o))!.name}.`)
      }, { who: 'Roastery', what: `Order ${orderId} → ${to}` })
    },
    resolveFlag(orderId: string, how: 'honour' | 'redirect' | 'cancel', note: string, redirectTo?: string) {
      update((s) => {
        const o = s.orders.find((x) => x.id === orderId)!
        if (how === 'honour') o.flag = undefined
        if (how === 'redirect' && redirectTo) { o.cafeId = redirectTo; o.flag = undefined; o.reason = `Redirected: ${note}` }
        if (how === 'cancel') { o.status = 'cancelled'; o.flag = undefined; o.reason = `Cancelled by mutual agreement: ${note}`; s.beans.find((b) => b.id === orderSku(o))!.lotKg += o.qty }
      }, { who: 'Roastery admin', what: `Resolved flagged order ${orderId}: ${how} — ${note}` })
    },
    note(cafeId: string, text: string) {
      update((s) => { s.cafes.find((c) => c.id === cafeId)!.notes.unshift({ ts: Date.now(), text }) }, { who: 'Roastery admin', what: `Note on ${cafeId}` })
    },
    reportEvent(cafeId: string, day: number) {
      update((s) => { s.cafes.find((c) => c.id === cafeId)!.events.push(day) }, { who: 'Café', what: `Reported unusual day ${day}` })
    },
    acceptMove(orderId: string, to: number) {
      update((s) => { s.moves[orderId] = to }, { who: 'Planner', what: `Moved batch ${orderId}` })
    },
    revertMove(orderId: string) {
      update((s) => { delete s.moves[orderId]; s.rejected.push(orderId) }, { who: 'Planner', what: `Reverted batch move ${orderId}` })
    },
    rejectMove(orderId: string) {
      update((s) => { s.rejected.push(orderId) })
    },
    dismissRisk(cafeId: string) {
      update((s) => { s.dismissedRisk.push(cafeId) })
    },
    register(input: NewCafe, by: 'roastery' | 'self'): string {
      const id = 'c' + uid()
      update((s) => {
        const prior = coldStartPrior(input, s.cafes, s.settings, input.beans.length)
        const t = today()
        const hist = input.history ?? []
        const c: Cafe = {
          id, name: input.name, owner: input.owner, phone: input.phone, email: input.email, address: input.address, city: input.city,
          type: input.type, seats: input.seats, cupsPerDay: input.cupsPerDay, status: 'active', reductionPct: 0, statusHistory: [],
          safetyDays: s.settings.safetyDefault, leadDays: s.settings.leadDefault, coverDays: input.coverDays, minOrderKg: input.minOrderKg,
          contract: input.contract, paymentTerms: 'Net 15', standing: input.standing, approved: by === 'roastery', onboarded: t, counts: 0,
          optIn: { whatsapp: true, email: true }, language: 'English', summaryDay: 1, notes: [{ ts: Date.now(), text: `Prior: ${prior.method}` }], events: [],
          beans: input.beans.map((b) => ({ sku: b.sku, onHand: b.onHand, lastCount: t, histStart: t - hist.length, history: [...hist].map((x) => r1((x / input.beans.length) * 100) / 100), prior: Math.round(prior.kg * 100) / 100 })),
        }
        s.cafes.push(c)
        alert(s, 'roastery', 'info', by === 'self' ? `New café self-registered: ${c.name} (pending approval).` : `New café registered: ${c.name}.`)
        alert(s, id, 'info', 'Welcome! Your forecast is an estimate for now — a quick weekly stock count makes it reliable.')
      }, { who: by === 'self' ? 'Café (self-registration)' : 'Roastery admin', what: `Registered café ${input.name}` })
      return id
    },
    approve(cafeId: string) {
      update((s) => {
        const c = s.cafes.find((x) => x.id === cafeId)!
        c.approved = true
        alert(s, cafeId, 'ok', 'Your account was approved by Siolim Specialty Coffee.')
      }, { who: 'Roastery admin', what: `Approved café ${cafeId}` })
    },
    updateCafe(cafeId: string, patch: Partial<Cafe>) {
      update((s) => { Object.assign(s.cafes.find((c) => c.id === cafeId)!, patch) }, { who: 'User', what: `Updated settings for ${cafeId}` })
    },
    dispatch(cafeIds: string[], channel: 'whatsapp' | 'email') {
      update((s) => {
        for (const id of cafeIds) {
          const c = s.cafes.find((x) => x.id === id)!
          const { body } = summaryMessage(s, c, channel)
          const ok = c.optIn[channel] && (channel === 'email' ? c.email.includes('@') : c.phone.length > 8)
          const m: Msg = { id: uid(), ts: Date.now(), cafeId: id, channel, status: ok ? 'sent' : 'failed', body, attempts: 1, error: ok ? undefined : c.optIn[channel] ? 'Invalid contact' : 'Café opted out of this channel' }
          s.messages.unshift(m)
          if (ok) alert(s, id, 'info', `Weekly summary sent via ${channel === 'email' ? 'Email' : 'WhatsApp'}.`)
        }
        const failed = s.messages.slice(0, cafeIds.length).filter((m) => m.status === 'failed').length
        if (failed) alert(s, 'roastery', 'warn', `${failed} summary message(s) failed to send.`)
      }, { who: 'Dispatcher', what: `Dispatched ${cafeIds.length} ${channel} summaries` })
    },
    retry(msgId: string) {
      update((s) => {
        const m = s.messages.find((x) => x.id === msgId)!
        const c = s.cafes.find((x) => x.id === m.cafeId)!
        m.attempts++
        if (c.optIn[m.channel]) { m.status = 'sent'; m.error = undefined }
      })
    },
    settings(patch: Partial<State['settings']>) {
      update((s) => { Object.assign(s.settings, patch) }, { who: 'Roastery admin', what: 'Updated settings' })
    },
    bean(id: string, patch: Partial<State['beans'][number]>) {
      update((s) => { Object.assign(s.beans.find((b) => b.id === id)!, patch) }, { who: 'Roastery admin', what: `Updated bean ${id}` })
    },
  }
}
