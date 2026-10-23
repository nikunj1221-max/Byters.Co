import { useState } from 'react'
import {
  LayoutDashboard,
  Store,
  TrendingUp,
  Flame,
  ShoppingBag,
  FlaskConical,
  MessageSquare,
  Settings,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { cx } from '../ui'
import { CafeDetail, Cafes, Overview } from './Accounts'
import { Backtest, ForecastView, Messages, Orders, Roasting, SettingsView } from './Ops'

const NAV_GROUPS = [
  {
    title: 'Operations',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'cafes', label: 'Cafés', icon: Store },
      { id: 'orders', label: 'Orders', icon: ShoppingBag },
      { id: 'roasting', label: 'Roasting plan', icon: Flame },
    ],
  },
  {
    title: 'Analytics & Config',
    items: [
      { id: 'forecast', label: 'Forecast', icon: TrendingUp },
      { id: 'backtest', label: 'Back-test', icon: FlaskConical },
      { id: 'messages', label: 'Messages', icon: MessageSquare },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
] as const

export function Roastery() {
  const { st } = useStore()
  const [view, setView] = useState('overview')
  const [cafe, setCafe] = useState<string | null>(null)
  const open = (id: string) => {
    setCafe(id)
    setView('cafes')
  }
  const go = (v: string) => {
    setCafe(null)
    setView(v)
  }
  const badge: Record<string, number> = {
    cafes: st.cafes.filter((c) => !c.approved).length,
    orders: st.orders.filter((o) => o.flag).length,
  }

  const allItems = NAV_GROUPS.flatMap((g) => g.items)
  const currentItem = allItems.find((n) => n.id === view)
  const title = currentItem?.label || 'Overview'

  return (
    <div className="flex min-h-[calc(100vh-70px)] flex-col md:flex-row">
      {/* Upgraded Roastery Sidebar */}
      <aside className="border-b border-stone-200/80 bg-[#f4eee7]/90 backdrop-blur-md md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="p-4 md:sticky md:top-20">
          {/* Sidebar Upper Header Card */}
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-stone-200/90 bg-white/90 p-3 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-stone-900 text-sm text-amber-50 shadow-sm">
                ☕
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-display text-sm font-bold tracking-tight text-stone-900">
                  Siolim Roastery
                </span>
                <span className="text-[10px] font-medium tracking-wide text-stone-400 uppercase">
                  Inventory OS
                </span>
              </div>
            </div>
            <span
              className="flex size-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100"
              title="System Online"
            />
          </div>

          <nav className="flex gap-1 overflow-x-auto md:flex-col md:space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="hidden px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 md:block">
                {group.title}
              </div>
              <div className="flex gap-1 md:flex-col">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = view === item.id
                  const count = badge[item.id]

                  return (
                    <button
                      key={item.id}
                      onClick={() => go(item.id)}
                      className={cx(
                        'group flex items-center justify-between whitespace-nowrap rounded-xl px-3 py-2 text-left text-xs font-medium transition-all duration-150',
                        isActive
                          ? 'bg-stone-900 text-white shadow-sm'
                          : 'text-stone-700 hover:bg-stone-200/70 hover:text-stone-900'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={cx(
                            'size-4 transition-transform group-hover:scale-110',
                            isActive ? 'text-amber-300' : 'text-stone-500'
                          )}
                        />
                        <span>{item.label}</span>
                      </div>

                      {count ? (
                        <span
                          className={cx(
                            'ml-2 flex size-5 items-center justify-center rounded-full text-[10px] font-bold shadow-sm',
                            isActive
                              ? 'bg-amber-100 text-stone-900'
                              : 'bg-[#b5562b] text-white'
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
        </div>
      </aside>

      {/* Main View Area */}
      <main className="min-w-0 flex-1 p-5 md:p-8">
        {!(view === 'cafes' && cafe) && (
          <h1 className="mb-6 font-display text-4xl text-stone-900">{title}</h1>
        )}
        {view === 'overview' && <Overview open={open} go={go} />}
        {view === 'cafes' &&
          (cafe ? (
            <CafeDetail id={cafe} back={() => setCafe(null)} />
          ) : (
            <Cafes open={open} />
          ))}
        {view === 'forecast' && <ForecastView />}
        {view === 'roasting' && <Roasting />}
        {view === 'orders' && <Orders />}
        {view === 'backtest' && <Backtest />}
        {view === 'messages' && <Messages />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
