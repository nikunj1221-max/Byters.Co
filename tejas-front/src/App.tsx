import { useState, useEffect } from 'react'
import { StoreProvider, useStore } from './lib/store'
import { Roastery } from './roastery/Roastery'
import { CafeApp } from './cafe/CafeApp'
import { AuthPage } from './AuthPage'
import { cx } from './ui'

interface User {
  id: string
  name: string
  email: string
  role?: string
}

function Shell() {
  const { st } = useStore()
  const [side, setSide] = useState<'roastery' | 'cafe'>('roastery')
  const [cafeId, setCafeId] = useState(st.cafes[0].id)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const choices = st.cafes.filter((c) => c.status !== 'closed' || c.id === cafeId)

  // Verify authentication session on load
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('merka_user')
      const token = localStorage.getItem('merka_token')
      if (savedUser && token) {
        setCurrentUser(JSON.parse(savedUser))
      } else {
        setCurrentUser(null)
      }
    } catch (e) {
      console.error('Failed to restore session:', e)
      setCurrentUser(null)
    } finally {
      setLoadingSession(false)
    }
  }, [])

  const handleLoginSuccess = (user: User, token: string) => {
    localStorage.setItem('merka_user', JSON.stringify(user))
    localStorage.setItem('merka_token', token)
    setCurrentUser(user)
    setSide('roastery')
  }

  const handleLogout = () => {
    localStorage.removeItem('merka_user')
    localStorage.removeItem('merka_token')
    setCurrentUser(null)
  }

  // Initial loading indicator while verifying stored session
  if (loadingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f3ee]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-4 border-[#b5562b] border-t-transparent" />
          <span className="font-display text-sm tracking-wide text-stone-700">Loading Merka Coffee...</span>
        </div>
      </div>
    )
  }

  // GUARD: If user is not authenticated, ONLY show Login / Sign Up with NO navbar
  if (!currentUser) {
    return <AuthPage onSuccess={handleLoginSuccess} />
  }

  // Once authenticated, show full app with Floating Pill Navbar
  return (
    <div className="min-h-screen bg-[#f7f3ee]">
      {/* Floating Pill Navbar */}
      <div className="sticky top-3 z-40 mx-auto w-full max-w-4xl px-4">
        <header className="flex items-center justify-between gap-3 rounded-full border border-stone-200/90 bg-white/95 px-2.5 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md">
          {/* Brand Pill */}
          <div className="flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-tight text-white shadow-sm">
            <span>merka coffee.</span>
          </div>

          {/* Center Navigation Links */}
          <nav className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setSide('roastery')}
              className={cx(
                'rounded-full px-4 py-1.5 font-medium transition',
                side === 'roastery'
                  ? 'bg-stone-100 font-semibold text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-900'
              )}
            >
              Roastery
            </button>

            <button
              onClick={() => setSide('cafe')}
              className={cx(
                'rounded-full px-4 py-1.5 font-medium transition',
                side === 'cafe'
                  ? 'bg-stone-100 font-semibold text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-900'
              )}
            >
              Café
            </button>

            {side === 'cafe' && (
              <select
                value={cafeId}
                onChange={(e) => setCafeId(e.target.value)}
                className="h-7 rounded-full border border-stone-200 bg-stone-50 px-2.5 text-xs text-stone-700 outline-none hover:bg-stone-100"
              >
                {choices.map((c) => (
                  <option key={c.id} value={c.id} className="text-stone-900">
                    {c.name}{!c.approved ? ' (pending)' : ''}
                  </option>
                ))}
              </select>
            )}
          </nav>

          {/* Right Action CTA Pill */}
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-stone-400 sm:inline" title={currentUser.email}>
              {currentUser.name}
            </span>
            <button
              onClick={handleLogout}
              className="group flex items-center gap-2 rounded-full bg-black py-1.5 pl-4 pr-1.5 text-xs font-medium text-white transition hover:bg-stone-800"
              title="Sign out from Merka Coffee"
            >
              <span>Sign out</span>
              <span className="flex size-6 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black shadow-sm transition group-hover:scale-105">
                ↗
              </span>
            </button>
          </div>
        </header>
      </div>

      {/* Authenticated Views */}
      <main className="pt-2">
        {side === 'roastery' ? (
          <Roastery />
        ) : (
          <div className="flex justify-center bg-[#e8e1d8] sm:py-8">
            <div className="h-[calc(100vh-100px)] w-full overflow-hidden bg-[#f7f3ee] sm:h-[780px] sm:w-[390px] sm:rounded-[40px] sm:border-[10px] sm:border-stone-900 sm:shadow-2xl">
              <CafeApp key={cafeId} cafeId={cafeId} onRegistered={setCafeId} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
