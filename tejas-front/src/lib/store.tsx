import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { type State, syncDrafts, uid } from './model'
import { buildSeed } from './seed'

const KEY = 'siolim-runout-v4'

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as State
      if (s.version === 4) { syncDrafts(s); return s }
    }
  } catch { /* corrupted storage: reseed */ }
  return buildSeed()
}

type Ctx = {
  st: State
  update: (fn: (s: State) => void, audit?: { who: string; what: string }) => void
  reset: () => void
}
const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<State>(load)
  const update = useCallback<Ctx['update']>((fn, audit) => {
    setSt((prev) => {
      const next = structuredClone(prev)
      fn(next)
      if (audit) next.audit.unshift({ id: uid(), ts: Date.now(), ...audit })
      next.audit = next.audit.slice(0, 300)
      syncDrafts(next)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])
  const reset = useCallback(() => {
    const s = buildSeed()
    localStorage.setItem(KEY, JSON.stringify(s))
    setSt(s)
  }, [])
  return <StoreCtx.Provider value={{ st, update, reset }}>{children}</StoreCtx.Provider>
}

export const useStore = () => useContext(StoreCtx)!
