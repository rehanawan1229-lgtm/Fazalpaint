import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

// Wraps an admin page: shows a "checking access" state while auth loads,
// bounces non-admin logged-in users home, shows the sign-in form for
// logged-out visitors, and only renders children once isAdmin is true.
function AdminGate({ title, children }) {
  const { user, isAdmin, loading, login } = useAdminAuth();
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginPending(true);
    setLoginError('');
    try {
      await login(loginForm.email, loginForm.password);
    } catch (error) {
      setLoginError(error.message || 'Sign in failed');
    } finally {
      setLoginPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFF9F4] px-4">
        <div className="rounded-3xl border border-[#F3E4D4] bg-white px-8 py-6 text-sm text-[#8A7A6D] shadow-soft">Checking access…</div>
      </div>
    );
  }

  if (user && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FFF9F4] px-4 py-20 text-[#4A3527]">
        <Helmet><title>{title || 'Admin Sign In'} — Fazal Paint Hardware</title></Helmet>
        <div className="mx-auto max-w-md rounded-[32px] border border-[#F3E4D4] bg-white p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--color-accent)]">Admin access</p>
          <h1 className="mt-4 text-3xl font-semibold">Sign in to manage content</h1>
          <p className="mt-3 text-sm leading-7 text-[#8A7A6D]">Use your admin credentials to open the edit tools and order manager.</p>
          <form className="mt-8 space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-semibold">Email</label>
              <input value={loginForm.email} onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold">Password</label>
              <div className="relative mt-2">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3 pr-11 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A7A6D]"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {loginError ? <p className="text-sm text-[var(--color-error)]">{loginError}</p> : null}
            <button type="submit" disabled={loginPending} className="w-full rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[#A83D24] disabled:cursor-not-allowed disabled:opacity-70">
              {loginPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return children;
}

export default AdminGate;
