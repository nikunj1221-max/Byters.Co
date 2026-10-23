import { useState } from 'react'

interface User {
  id: string
  name: string
  email: string
  role?: string
}

interface AuthPageProps {
  onSuccess?: (user: User, token: string) => void
  onCancel?: () => void
  initialMode?: 'login' | 'signup'
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export function AuthPage({ onSuccess, onCancel, initialMode = 'login' }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  // Status
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleFillDemo = () => {
    setEmail('johndoe@mail.com')
    setPassword('Password123!')
    setErrorMsg('')
    setSuccessMsg('Filled demo account credentials!')
    setTimeout(() => setSuccessMsg(''), 2500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (mode === 'forgot') {
      if (!email.trim()) {
        setErrorMsg('Please enter your email address')
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Failed to request reset')
        setSuccessMsg(data.message || 'Reset link sent! Please check your inbox.')
      } catch (err: unknown) {
        const error = err as Error
        setErrorMsg(error.message || 'An unexpected error occurred')
      } finally {
        setLoading(false)
      }
      return
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setErrorMsg('Please enter your name')
        return
      }
      if (!email.trim()) {
        setErrorMsg('Please enter your email')
        return
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters')
        return
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match')
        return
      }

      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Signup failed')

        if (rememberMe) {
          localStorage.setItem('merka_token', data.token)
          localStorage.setItem('merka_user', JSON.stringify(data.user))
        }

        setSuccessMsg(data.message || 'Account created successfully!')
        if (onSuccess) {
          setTimeout(() => onSuccess(data.user, data.token), 800)
        }
      } catch (err: unknown) {
        const error = err as Error
        setErrorMsg(error.message || 'An error occurred during signup')
      } finally {
        setLoading(false)
      }
      return
    }

    // Login mode
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Login failed')

      if (rememberMe) {
        localStorage.setItem('merka_token', data.token)
        localStorage.setItem('merka_user', JSON.stringify(data.user))
      }

      setSuccessMsg(data.message || 'Welcome back!')
      if (onSuccess) {
        setTimeout(() => onSuccess(data.user, data.token), 700)
      }
    } catch (err: unknown) {
      const error = err as Error
      setErrorMsg(error.message || 'An error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialClick = (provider: string) => {
    setSuccessMsg(`Signing in with ${provider}... (Demo connection active)`)
    setTimeout(() => {
      const demoUser = {
        id: `social_${provider.toLowerCase()}`,
        name: `${provider} Coffee Enthusiast`,
        email: `user@${provider.toLowerCase()}.com`,
        role: 'customer',
      }
      const demoToken = `demo_token_${Date.now()}`
      if (rememberMe) {
        localStorage.setItem('merka_token', demoToken)
        localStorage.setItem('merka_user', JSON.stringify(demoUser))
      }
      if (onSuccess) onSuccess(demoUser, demoToken)
    }, 600)
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-white md:flex-row">
      {/* LEFT COLUMN: Hero Coffee Imagery & Quote */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-stone-900 md:w-1/2 lg:w-5/12">
        {/* Background Image */}
        <img
          src="/barista.jpg"
          alt="Barista pouring artisanal coffee"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/30" />

        {/* Optional Back Button (if onCancel provided) */}
        {onCancel && (
          <div className="relative z-10 flex items-center justify-end p-6 md:p-8">
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md transition hover:bg-white/25"
            >
              ← Back to app
            </button>
          </div>
        )}

        {/* Bottom Quote (Matching Reference Design) */}
        <div className="relative z-10 p-6 md:p-12 lg:p-16">
          <blockquote className="mb-6 font-display text-2xl font-normal leading-snug text-white sm:text-3xl lg:text-[34px]">
            &ldquo;Not just great coffee, but a great experience.&rdquo;
          </blockquote>
          <div>
            <div className="text-base font-semibold tracking-wide text-white">Amanda Rivera</div>
            <div className="text-sm font-light text-stone-300">Daily Brewer</div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Authentication Form */}
      <div className="flex flex-1 items-center justify-center bg-white p-6 sm:p-10 md:p-12">
        <div className="w-full max-w-[420px]">
          {/* Brand Logo (Matching Screenshot) */}
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#5c3116] text-white shadow-sm">
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-[#4a260f]">
             Cafeमित्र
            </span>
          </div>

          {/* Heading & Subtitle */}
          <div className="mb-8 text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              {mode === 'login' && 'Hello, welcome back!'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              {mode === 'login' && 'Start your day with the perfect brew'}
              {mode === 'signup' && 'Join Merka Coffee and taste perfection'}
              {mode === 'forgot' && 'Enter your email to receive a password reset link'}
            </p>
          </div>

          {/* Quick Demo Helper */}
          {mode === 'login' && (
            <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-900">
              <span>Demo login: <b>johndoe@mail.com</b></span>
              <button
                type="button"
                onClick={handleFillDemo}
                className="rounded-lg bg-amber-200/70 px-2.5 py-1 font-medium text-amber-950 transition hover:bg-amber-300"
              >
                Auto-fill
              </button>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 animate-in fade-in">
              <svg className="size-4 shrink-0 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700 animate-in fade-in">
              <svg className="size-4 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-stone-700">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Amanda Rivera"
                  className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-stone-700">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Johndoe@mail.com"
                className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            {/* Password Field (Login & Sign Up) */}
            {mode !== 'forgot' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-stone-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 pr-10 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password (Sign Up only) */}
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-stone-700">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 pr-10 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                  >
                    {showConfirmPassword ? (
                      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Remember Me & Forgot Password Row (Login Mode) */}
            {mode === 'login' && (
              <div className="flex items-center justify-between pt-1">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="size-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-xs text-stone-600">Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setErrorMsg(''); setSuccessMsg('') }}
                  className="text-xs font-medium text-stone-700 underline decoration-stone-300 underline-offset-2 hover:text-orange-600"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Action Button (Vibrant Orange 'Let's brew!') */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f25805] text-sm font-semibold tracking-wide text-white shadow-md shadow-orange-500/25 transition-all duration-150 hover:bg-[#e04f02] hover:shadow-lg hover:shadow-orange-500/30 active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg className="size-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Brewing...</span>
                  </>
                ) : (
                  <>
                    {mode === 'login' && "Let's brew!"}
                    {mode === 'signup' && "Join the brew!"}
                    {mode === 'forgot' && "Send Reset Link"}
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Social Sign In Divider */}
          {mode !== 'forgot' && (
            <div className="mt-8">
              <div className="relative flex items-center justify-center">
                <div className="w-full border-t border-stone-200" />
                <span className="relative bg-white px-3 text-xs font-normal text-stone-400">
                  Or continue with :
                </span>
              </div>

              {/* Social Buttons */}
              <div className="mt-6 flex items-center justify-center gap-5">
                {/* Apple */}
                <button
                  type="button"
                  onClick={() => handleSocialClick('Apple')}
                  className="flex size-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-800 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 hover:scale-105 active:scale-95"
                  title="Sign in with Apple"
                >
                  <svg className="size-5 fill-current" viewBox="0 0 170 170">
                    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.74 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-5.87-8.91-10.45-19.18-13.73-30.82-3.28-11.64-4.92-22.75-4.92-33.34 0-14.28 3.52-25.75 10.57-34.42 7.05-8.67 15.89-13.14 26.51-13.42 4.92 0 10.3 1.34 16.14 4.02 5.83 2.68 9.5 4.08 11 4.19 1.13 0 4.96-1.54 11.51-4.63 6.54-3.08 12.16-4.35 16.86-3.8 12.51 1.05 22.37 5.92 29.58 14.61-10.95 6.64-16.29 15.75-16.03 27.32.27 9.07 3.73 16.73 10.39 22.98 6.67 6.25 14.61 9.77 23.82 10.57-2.34 7.27-5.19 14.25-8.54 20.97zM119.22 31.86c0-7.39 2.68-14.34 8.04-20.85 5.37-6.52 11.96-10.65 19.78-12.4 1.13 7.82-.78 15.2-5.74 22.15-4.96 6.95-11.69 11.02-20.19 12.21-.34-.37-.73-.74-1.12-1.11-.5-.65-.77-1.16-.77-1.5z" />
                  </svg>
                </button>

                {/* Google */}
                <button
                  type="button"
                  onClick={() => handleSocialClick('Google')}
                  className="flex size-11 items-center justify-center rounded-full border border-stone-200 bg-white shadow-sm transition hover:border-stone-300 hover:bg-stone-50 hover:scale-105 active:scale-95"
                  title="Sign in with Google"
                >
                  <svg className="size-5" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.1 8.9 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.8z" />
                    <path fill="#FBBC05" d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7 0-1.2.2-2 .4-2.7L1.6 6.4C.6 8.4 0 10.6 0 13s.6 4.6 1.6 6.6l3.7-4.9z" />
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5.3L1.6 17.9C3.5 21.7 7.4 24 12 24z" />
                  </svg>
                </button>

                {/* Facebook */}
                <button
                  type="button"
                  onClick={() => handleSocialClick('Facebook')}
                  className="flex size-11 items-center justify-center rounded-full bg-[#1877f2] text-white shadow-sm transition hover:bg-[#166fe5] hover:scale-105 active:scale-95"
                  title="Sign in with Facebook"
                >
                  <svg className="size-5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Bottom Switcher */}
          <div className="mt-8 text-center text-xs text-stone-600">
            {mode === 'login' ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setErrorMsg(''); setSuccessMsg('') }}
                  className="font-semibold text-[#f25805] hover:underline"
                >
                  Sign Up
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg('') }}
                  className="font-semibold text-[#f25805] hover:underline"
                >
                  Log In
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
