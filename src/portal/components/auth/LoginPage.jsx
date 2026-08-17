/**
 * LoginPage.jsx
 * Authenticates against POST /api/auth/login (backend + MongoDB).
 * Stores the returned JWT in sessionStorage under 'cp_token'.
 * The decoded user profile is stored alongside it as 'cp_user'.
 */
import { useState } from 'react';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { IMAGES } from '../../../public-site/config/cloudinary';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Simple input sanitizer — strips HTML tags and trims
function sanitize(str) {
  return str.replace(/<[^>]*>/g, '').trim();
}

export function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = sanitize(email).toLowerCase();
    const cleanPw    = password;

    if (!cleanEmail || !cleanPw) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: cleanEmail, password: cleanPw }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      // Store token + user profile in sessionStorage
      sessionStorage.setItem('cp_token', data.token);
      sessionStorage.setItem('cp_user',  JSON.stringify(data.user));

      onLogin(data.user);
    } catch {
      setError('Cannot reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <div className="w-full max-w-sm space-y-8">

        {/* Logo + branding */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <img
              src={IMAGES.logo}
              alt="Sewing Circle"
              className="w-20 h-20 object-contain"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Staff Portal
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
              Sewing Circle · IT Recruitment Suite
            </p>
          </div>
        </div>

        {/* Login card */}
        <div
          className="rounded-2xl border p-8 space-y-5"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Sign in to your account
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
              Use your company email and password
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@sewingcircle.io"
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-faint)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
              >
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)',
                boxShadow: '0 2px 10px rgba(6,182,212,0.3)',
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                <>
                  <LogIn size={15} />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Back to site */}
        <p className="text-center text-xs" style={{ color: 'var(--text-ghost)' }}>
          <a href="/" className="hover:underline transition-colors"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-light)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}>
            ← Back to Sewing Circle website
          </a>
        </p>
      </div>
    </div>
  );
}
