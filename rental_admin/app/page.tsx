'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminAuthPage() {
  const [isRegister, setIsRegister] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Loading & Redirect Guard State
  const [checkingToken, setCheckingToken] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  // 1. Check for token on mount & redirect if logged in
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      router.replace('/admin');
    } else {
      setCheckingToken(false);
    }
  }, [router]);

  const toggleAuthMode = () => {
    setIsRegister(!isRegister);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister ? { name, email, password } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // REGISTRATION
      if (isRegister) {
        if (res.ok && data.success) {
          setIsRegister(false);
          setPassword('');
          setConfirmPassword('');
          setError('');
          return;
        }

        setError(data.error || 'Registration failed. Please try again.');
        return;
      }

      // LOGIN
      if (res.ok && data.success && data.token) {
        localStorage.setItem('admin_token', data.token);
localStorage.setItem('admin', JSON.stringify(data.admin));        router.push('/admin');
        return;
      }

      setError(data.error || 'Login failed. Please check your details.');
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Prevent flash of form while checking token
  if (checkingToken) {
    return (
      <div className="min-h-screen w-full bg-[#0B1220] flex items-center justify-center text-slate-400 text-sm font-medium">
        Verifying session...
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex">
      {/* ================= LEFT BRAND PANEL ================= */}
      <div className="hidden lg:flex lg:w-[62%] bg-[#0B1220] text-white relative flex-col justify-between p-12 xl:p-16 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-blue-500/10 blur-[120px]" />

        {/* Brand mark */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-white/10 border border-white/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9z" />
            </svg>
          </div>
          <span className="text-sm font-medium tracking-wide text-slate-200">Rental Hub</span>
        </div>

        {/* Middle content */}
        <div className="relative z-10 max-w-sm">
          <p className="text-[13px] font-medium text-blue-300 tracking-wide uppercase mb-4">
            Admin console
          </p>
          <h1 className="text-[28px] xl:text-[32px] font-semibold leading-[1.25] text-white">
            Operational control for your fleet, listings, and payments.
          </h1>
          <p className="text-[14px] text-slate-400 leading-relaxed mt-4">
            Track inventory in real time, manage security deposits, and review late-fee
            exceptions from a single dashboard.
          </p>

          <div className="mt-10 space-y-3.5 border-t border-white/10 pt-8">
            {[
              'Live inventory across every listing',
              'Automated deposit reconciliation',
              'Audit log for every admin action',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-[13px] text-slate-300">
                <svg
                  className="mt-0.5 shrink-0 text-blue-400"
                  width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-[12px] text-slate-500 border-t border-white/10 pt-6">
          <span>© {new Date().getFullYear()} Rental Hub</span>
          <span>Internal use only</span>
        </div>
      </div>

      {/* ================= RIGHT FORM PANEL ================= */}
      <div className="lg:w-[38%] w-full flex items-center justify-start pl-16 xl:pl-24 bg-white px-6 sm:px-10">
        <div className="w-full max-w-[420px] py-16">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75">
                <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-800">Rental Hub</span>
          </div>

          <div className="mb-8">
            <h2 className="text-[22px] font-semibold text-slate-900 tracking-tight">
              {isRegister ? 'Create admin account' : 'Sign in to admin'}
            </h2>
            <p className="text-[13.5px] text-slate-500 mt-1.5">
              {isRegister
                ? 'Register with your work email to get access.'
                : 'Enter your credentials to continue.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 px-3.5 py-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-[13px] font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jordan Lee"
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@rentalhub.com"
                className="w-full h-10 px-3 rounded-md border border-slate-300 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors"
              />
            </div>

            {/* PASSWORD FIELD WITH TOGGLE */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13px] font-medium text-slate-700">
                  Password
                </label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => alert('Please contact system administrator to reset password.')}
                    className="text-[12.5px] font-medium text-slate-500 hover:text-slate-800"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 pl-3 pr-10 rounded-md border border-slate-300 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* CONFIRM PASSWORD FIELD WITH TOGGLE */}
            {isRegister && (
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 pl-3 pr-10 rounded-md border border-slate-300 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-[14px] font-medium transition-colors"
            >
              {loading ? 'Verifying…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-7 text-center text-[13px] text-slate-500">
            {isRegister ? 'Already have an account?' : 'No account yet?'}{' '}
            <button
              type="button"
              onClick={toggleAuthMode}
              className="font-medium text-slate-900 hover:underline"
            >
              {isRegister ? 'Sign in' : 'Register'}
            </button>
          </p>

          <div className="mt-14 pt-6 border-t border-slate-100 flex items-center justify-between text-[12px] text-slate-400">
            <span>Secured admin authentication</span>
            <div className="flex gap-3">
              <span className="hover:text-slate-600 cursor-pointer">Privacy</span>
              <span className="hover:text-slate-600 cursor-pointer">Terms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}