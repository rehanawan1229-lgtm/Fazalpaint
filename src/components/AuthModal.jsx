import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, Eye, EyeOff, ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react';
import { api } from '../lib/adminApi';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useNavigate } from 'react-router-dom';
import OtpInput from './OtpInput';

const RESEND_COOLDOWN_SECONDS = 30;

function AuthModal({ open, onClose, initialMode = 'signup' }) {
  const { login, loginWithToken } = useAdminAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [newPassword, setNewPassword] = useState({ password: '', confirm: '' });
  const [resetToken, setResetToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [googleInitialized, setGoogleInitialized] = useState(false);
  const [googleButtonRendered, setGoogleButtonRendered] = useState(false);
  const cooldownTimer = useRef(null);
  const googleInitAttemptedRef = useRef(false);
  const lastGoogleRenderKeyRef = useRef(null);
  const googleButtonWrapperRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setMessage('');
      setErrorText('');
      setShowPassword(false);
      setResetToken(null);
      setNewPassword({ password: '', confirm: '' });
      setCooldown(0);
    }
  }, [open, initialMode]);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
      return;
    }
    cooldownTimer.current = setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(cooldownTimer.current);
  }, [cooldown > 0]);

  useEffect(() => {
    if (!googleClientId) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id || googleInitAttemptedRef.current) return;

      googleInitAttemptedRef.current = true;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response?.credential) {
            setErrorText('Google sign-in failed. Please try again.');
            setLoading(false);
            return;
          }

          setLoading(true);
          try {
            const signinResponse = await api('/api/auth/google', {
              method: 'POST',
              body: { idToken: response.credential }
            });

            await loginWithToken(signinResponse.token);
            onClose();
            navigate('/');
          } catch (error) {
            console.error('Google callback error:', error);
            setErrorText(error.message || 'Google sign-in failed.');
          } finally {
            setLoading(false);
          }
        },
        ux_mode: 'popup',
        auto_select: false,
        use_fedcm_for_prompt: true
      });

      setGoogleInitialized(true);
    };

    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    const timer = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogle();
        window.clearInterval(timer);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [googleClientId, loginWithToken, navigate, onClose]);

  // -----------------------------------------------------------------
  // Google button render effect (Ultra-stable, animation-proof)
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!googleInitialized || !open || !['signup', 'login'].includes(mode)) {
      if (!open) {
        lastGoogleRenderKeyRef.current = null;
        setGoogleButtonRendered(false);
        if (googleButtonWrapperRef.current) {
          googleButtonWrapperRef.current.innerHTML = '';
        }
      }
      return;
    }

    let cancelled = false;
    let retryTimeoutId = null;
    let initialDelayId = null;
    const renderKey = `${mode}-${open ? 'open' : 'closed'}`;
    const RETRY_INTERVAL_MS = 80;
    const MAX_ATTEMPTS = 50;

    let attempts = 0;

    const renderGoogleButton = () => {
      if (cancelled) return;

      const wrapper = googleButtonWrapperRef.current;
      const googleReady = !!window.google?.accounts?.id;

      if (!wrapper || !googleReady) {
        attempts += 1;
        if (attempts < MAX_ATTEMPTS) {
          retryTimeoutId = window.setTimeout(renderGoogleButton, RETRY_INTERVAL_MS);
        } else {
          console.warn('Google Sign-In button wrapper never mounted in time.');
        }
        return;
      }

      if (
        lastGoogleRenderKeyRef.current === renderKey &&
        wrapper.childElementCount > 0
      ) {
        return;
      }

      lastGoogleRenderKeyRef.current = renderKey;
      wrapper.innerHTML = '';
      setGoogleButtonRendered(false);

      // اسکرین کی چوڑائی کے مطابق مستحکم چوڑائی حاصل کریں تاکہ اینیمیشن کے مسائل پیدا نہ ہوں
      const screenWidth = window.innerWidth;
      const targetWidth = screenWidth > 500 ? 400 : Math.max(280, Math.min(400, screenWidth - 64));

      try {
        window.google.accounts.id.renderButton(wrapper, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill', // خوبصورت گول شکل
          width: targetWidth
        });

        window.setTimeout(() => {
          if (cancelled) return;
          const rendered = !!googleButtonWrapperRef.current && googleButtonWrapperRef.current.childElementCount > 0;
          setGoogleButtonRendered(rendered);
        }, 300);
      } catch (err) {
        console.error("Google button render error:", err);
      }
    };

    initialDelayId = window.setTimeout(() => {
      renderGoogleButton();
    }, 250);

    return () => {
      cancelled = true;
      if (initialDelayId) window.clearTimeout(initialDelayId);
      if (retryTimeoutId) window.clearTimeout(retryTimeoutId);
    };
  }, [googleInitialized, open, mode]);

  const handleGoogleSignup = () => {
    if (!googleClientId) {
      setErrorText('Google sign-in is still loading. Please wait a moment and try again.');
      return;
    }

    if (!window.google?.accounts?.id) {
      setErrorText('Google sign-in is still loading. Please wait a moment and try again.');
      return;
    }

    setErrorText('');
    try {
      window.google.accounts.id.prompt((notification) => {
        if (notification?.isNotDisplayed() || notification?.isSkippedMoment()) {
          console.warn('Google prompt was not displayed. The popup may be blocked or the Google client may need a valid configuration.');
          setErrorText('Google sign-in popup was blocked or could not be shown. Please try again.');
        }
      });
    } catch (error) {
      console.error('Google prompt error:', error);
      setErrorText('Google sign-in could not be started. Please try again.');
    }
  };

  const handleSignupSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorText('');
    setMessage('');

    try {
      await api('/api/auth/register/start', {
        method: 'POST',
        body: { name: form.name, email: form.email, password: form.password }
      });
      setMode('signup-otp');
      setOtpResetKey((k) => k + 1);
      startCooldown();
      setMessage(`We've sent a 4-digit code to ${form.email}.`);
    } catch (error) {
      setErrorText(error.message || 'Unable to sign up.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupOtpComplete = async (code) => {
    setLoading(true);
    setErrorText('');
    try {
      const response = await api('/api/auth/register/verify', {
        method: 'POST',
        body: { email: form.email, code }
      });
      if (response?.token) {
        await loginWithToken(response.token);
      }
      onClose();
      navigate('/');
    } catch (error) {
      setErrorText(error.message || 'Incorrect code. Please try again.');
      setOtpResetKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleResendSignupOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setErrorText('');
    try {
      await api('/api/auth/register/resend', { method: 'POST', body: { email: form.email } });
      setMessage('A new code has been sent to your email.');
      setOtpResetKey((k) => k + 1);
      startCooldown();
    } catch (error) {
      setErrorText(error.message || 'Unable to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorText('');
    setMessage('');

    try {
      await login(form.email, form.password);
      onClose();
      navigate('/');
    } catch (error) {
      setErrorText(error.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotEmailSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorText('');
    setMessage('');

    try {
      await api('/api/auth/forgot-password/start', { method: 'POST', body: { email: form.email } });
      setMode('forgot-otp');
      setOtpResetKey((k) => k + 1);
      startCooldown();
      setMessage(`We've sent a 4-digit code to ${form.email}.`);
    } catch (error) {
      setErrorText(error.message || 'Unable to process request.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotOtpComplete = async (code) => {
    setLoading(true);
    setErrorText('');
    try {
      const response = await api('/api/auth/forgot-password/verify', {
        method: 'POST',
        body: { email: form.email, code }
      });
      setResetToken(response.resetToken);
      setMode('forgot-reset');
      setMessage('');
    } catch (error) {
      setErrorText(error.message || 'Incorrect code. Please try again.');
      setOtpResetKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleResendForgotOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setErrorText('');
    try {
      await api('/api/auth/forgot-password/resend', { method: 'POST', body: { email: form.email } });
      setMessage('A new code has been sent to your email.');
      setOtpResetKey((k) => k + 1);
      startCooldown();
    } catch (error) {
      setErrorText(error.message || 'Unable to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (event) => {
    event.preventDefault();
    setErrorText('');

    if (newPassword.password.length < 6) {
      setErrorText('Password must be at least 6 characters.');
      return;
    }
    if (newPassword.password !== newPassword.confirm) {
      setErrorText('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api('/api/auth/forgot-password/reset', {
        method: 'POST',
        body: { email: form.email, resetToken, newPassword: newPassword.password }
      });
      setMode('login');
      setForm((current) => ({ ...current, password: '' }));
      setNewPassword({ password: '', confirm: '' });
      setMessage('Password reset! Please log in with your new password.');
    } catch (error) {
      setErrorText(error.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const titles = {
    signup: { kicker: 'Create account', title: 'Join Fazal Paint Hardware' },
    'signup-otp': { kicker: 'Verify email', title: 'Enter the 4-digit code' },
    login: { kicker: 'Welcome back', title: 'Sign in to continue' },
    'forgot-email': { kicker: 'Forgot password', title: 'Find your account' },
    'forgot-otp': { kicker: 'Verify it\u2019s you', title: 'Enter the 4-digit code' },
    'forgot-reset': { kicker: 'Almost done', title: 'Choose a new password' }
  };
  const { kicker, title } = titles[mode];

  return createPortal(
    <div className="fixed inset-0 z-[80] flex animate-fade-in items-center justify-center bg-[#4A3527]/70 px-4 py-8">
      <div className="w-full max-w-lg animate-modal-pop rounded-[32px] border border-[#F3E4D4] bg-white p-6 shadow-soft sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {['signup-otp', 'forgot-otp', 'forgot-reset'].includes(mode) && (
              <button
                type="button"
                onClick={() => {
                  setErrorText('');
                  if (mode === 'signup-otp') setMode('signup');
                  else if (mode === 'forgot-otp') setMode('forgot-email');
                  else setMode('forgot-otp');
                }}
                className="mt-1 rounded-full border border-[#F3E4D4] p-2 text-[#8A7A6D] transition-colors hover:bg-[#FFF9F4]"
                aria-label="Go back"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">{kicker}</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#4A3527]">{title}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[#F3E4D4] p-2 text-[#8A7A6D]">
            <X size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22 }}
          >
            {/* ---------------- SIGN UP ---------------- */}
            {mode === 'signup' && (
              <div className="max-w-[400px] mx-auto w-full">
                {/* اب گوگل کا بٹن بالکل سینٹر اور مستحکم انداز میں رینڈر ہوگا */}
                <div className="mt-5 w-full flex justify-center">
                  <div
                    ref={googleButtonWrapperRef}
                    className="min-h-[48px] w-full flex justify-center max-w-[400px]"
                    data-google-sso-root="true"
                  />
                </div>
                <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#B5A594]">
                  <span className="h-px flex-1 bg-[#F3E4D4]" /> or <span className="h-px flex-1 bg-[#F3E4D4]" />
                </div>
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4A3527]">Full name</label>
                    <div className="flex items-center rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3">
                      <User size={16} className="mr-3 text-[#8A7A6D]" />
                      <input required value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Your name" className="w-full bg-transparent text-sm text-[#4A3527] outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4A3527]">Email</label>
                    <div className="flex items-center rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3">
                      <Mail size={16} className="mr-3 text-[#8A7A6D]" />
                      <input required type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="you@example.com" className="w-full bg-transparent text-sm text-[#4A3527] outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4A3527]">Password</label>
                    <div className="flex items-center rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3">
                      <Lock size={16} className="mr-3 text-[#8A7A6D]" />
                      <input required minLength={6} type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} placeholder="At least 6 characters" className="w-full bg-transparent text-sm text-[#4A3527] outline-none" />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="-mr-2 ml-1 flex h-9 w-9 items-center justify-center rounded-full text-[#8A7A6D] active:scale-90" tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  {errorText ? <p className="rounded-2xl border border-[#F9D9D3] bg-[#FCEBEA] px-4 py-3 text-sm text-[#D64545]">{errorText}</p> : null}
                  <button type="submit" disabled={loading} className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70">
                    {loading ? 'Please wait…' : 'Sign Up'}
                  </button>
                </form>
              </div>
            )}

            {/* ---------------- SIGN UP: OTP ---------------- */}
            {mode === 'signup-otp' && (
              <div className="mt-5 space-y-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FDE9DC] text-accent">
                  <ShieldCheck size={26} />
                </div>
                <p className="text-sm text-[#8A7A6D]">
                  Enter the 4-digit code sent to <span className="font-semibold text-[#4A3527]">{form.email}</span>.
                </p>
                <OtpInput length={4} resetKey={otpResetKey} onComplete={handleSignupOtpComplete} />
                {errorText ? <p className="rounded-2xl border border-[#F9D9D3] bg-[#FCEBEA] px-4 py-3 text-sm text-[#D64545]">{errorText}</p> : null}
                {message && !errorText ? <p className="text-xs text-[#8A7A6D]">{message}</p> : null}
                {loading ? <p className="text-xs uppercase tracking-[0.2em] text-accent">Verifying…</p> : null}
                <button
                  type="button"
                  onClick={handleResendSignupOtp}
                  disabled={cooldown > 0 || loading}
                  className="text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:text-[#B5A594]"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>
            )}

            {/* ---------------- LOGIN ---------------- */}
            {mode === 'login' && (
              <div className="max-w-[400px] mx-auto w-full">
                <div className="mt-5 w-full flex justify-center">
                  <div
                    ref={googleButtonWrapperRef}
                    className="min-h-[48px] w-full flex justify-center max-w-[400px]"
                    data-google-sso-root="true"
                  />
                </div>
                <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#B5A594]">
                  <span className="h-px flex-1 bg-[#F3E4D4]" /> or <span className="h-px flex-1 bg-[#F3E4D4]" />
                </div>
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4A3527]">Email</label>
                    <div className="flex items-center rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3">
                      <Mail size={16} className="mr-3 text-[#8A7A6D]" />
                      <input required type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="you@example.com" className="w-full bg-transparent text-sm text-[#4A3527] outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#4A3527]">Password</label>
                    <div className="flex items-center rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3">
                      <Lock size={16} className="mr-3 text-[#8A7A6D]" />
                      <input required type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} placeholder="Your password" className="w-full bg-transparent text-sm text-[#4A3527] outline-none" />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="-mr-2 ml-1 flex h-9 w-9 items-center justify-center rounded-full text-[#8A7A6D] active:scale-90" tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setErrorText(''); setMessage(''); setMode('forgot-email'); }}
                    className="-mt-1 text-sm font-semibold text-accent"
                  >
                    Forgot Password?
                  </button>
                  {errorText ? <p className="rounded-2xl border border-[#F9D9D3] bg-[#FCEBEA] px-4 py-3 text-sm text-[#D64545]">{errorText}</p> : null}
                  {message && !errorText ? <p className="rounded-2xl border border-[#DCEFE5] bg-[#EAF6F0] px-4 py-3 text-sm text-[#4E9C79]">{message}</p> : null}
                  <button type="submit" disabled={loading} className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70">
                    {loading ? 'Please wait…' : 'Login'}
                  </button>
                </form>
              </div>
            )}

            {/* ---------------- FORGOT PASSWORD: EMAIL ---------------- */}
            {mode === 'forgot-email' && (
              <form onSubmit={handleForgotEmailSubmit} className="mt-5 space-y-4 max-w-[400px] mx-auto w-full">
                <p className="text-sm text-[#8A7A6D]">Enter the email you registered with — we'll send a 4-digit code to reset your password.</p>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#4A3527]">Email</label>
                  <div className="flex items-center rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3">
                    <Mail size={16} className="mr-3 text-[#8A7A6D]" />
                    <input required type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="you@example.com" className="w-full bg-transparent text-sm text-[#4A3527] outline-none" />
                  </div>
                </div>
                {errorText ? <p className="rounded-2xl border border-[#F9D9D3] bg-[#FCEBEA] px-4 py-3 text-sm text-[#D64545]">{errorText}</p> : null}
                <button type="submit" disabled={loading} className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70">
                  {loading ? 'Checking…' : 'Send Code'}
                </button>
              </form>
            )}

            {/* ---------------- FORGOT PASSWORD: OTP ---------------- */}
            {mode === 'forgot-otp' && (
              <div className="mt-5 space-y-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FDE9DC] text-accent">
                  <ShieldCheck size={26} />
                </div>
                <p className="text-sm text-[#8A7A6D]">
                  Enter the 4-digit code sent to <span className="font-semibold text-[#4A3527]">{form.email}</span>.
                </p>
                <OtpInput length={4} resetKey={otpResetKey} onComplete={handleForgotOtpComplete} />
                {errorText ? <p className="rounded-2xl border border-[#F9D9D3] bg-[#FCEBEA] px-4 py-3 text-sm text-[#D64545]">{errorText}</p> : null}
                {message && !errorText ? <p className="text-xs text-[#8A7A6D]">{message}</p> : null}
                {loading ? <p className="text-xs uppercase tracking-[0.2em] text-accent">Verifying…</p> : null}
                <button
                  type="button"
                  onClick={handleResendForgotOtp}
                  disabled={cooldown > 0 || loading}
                  className="text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:text-[#B5A594]"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>
            )}

            {/* ---------------- FORGOT PASSWORD: RESET ---------------- */}
            {mode === 'forgot-reset' && (
              <form onSubmit={handleResetPasswordSubmit} className="mt-5 space-y-4 max-w-[400px] mx-auto w-full">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FDE9DC] text-accent">
                  <KeyRound size={26} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#4A3527]">New password</label>
                  <div className="flex items-center rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3">
                    <Lock size={16} className="mr-3 text-[#8A7A6D]" />
                    <input required minLength={6} type={showPassword ? 'text' : 'password'} value={newPassword.password} onChange={(e) => setNewPassword((c) => ({ ...c, password: e.target.value }))} placeholder="At least 6 characters" className="w-full bg-transparent text-sm text-[#4A3527] outline-none" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="-mr-2 ml-1 flex h-9 w-9 items-center justify-center rounded-full text-[#8A7A6D] active:scale-90" tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#4A3527]">Confirm new password</label>
                  <div className="flex items-center rounded-2xl border border-[#F3E4D4] bg-[#FFF9F4] px-4 py-3">
                    <Lock size={16} className="mr-3 text-[#8A7A6D]" />
                    <input required minLength={6} type={showPassword ? 'text' : 'password'} value={newPassword.confirm} onChange={(e) => setNewPassword((c) => ({ ...c, confirm: e.target.value }))} placeholder="Re-enter password" className="w-full bg-transparent text-sm text-[#4A3527] outline-none" />
                  </div>
                </div>
                {errorText ? <p className="rounded-2xl border border-[#F9D9D3] bg-[#FCEBEA] px-4 py-3 text-sm text-[#D64545]">{errorText}</p> : null}
                <button type="submit" disabled={loading} className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70">
                  {loading ? 'Saving…' : 'Reset Password'}
                </button>
              </form>
            )}
          </motion.div>
        </AnimatePresence>

        {['signup', 'login'].includes(mode) && (
          <div className="mt-5 flex items-center justify-between text-sm text-[#8A7A6D] max-w-[400px] mx-auto w-full">
            <button
              type="button"
              onClick={() => { setErrorText(''); setMessage(''); setMode(mode === 'signup' ? 'login' : 'signup'); }}
              className="font-semibold text-accent"
            >
              {mode === 'signup' ? 'Already have an account? Login' : 'Need an account? Sign up'}
            </button>
            <button type="button" onClick={onClose} className="font-semibold text-[#4A3527]">Close</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default AuthModal;