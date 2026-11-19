import { useState } from 'react';
import { Lock, Mail, User as UserIcon, X } from 'lucide-react';
import { api } from '../lib/api';
import type { AuthUser } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
  initialMode?: 'login' | 'signup';
  initialReferralCode?: string;
  reasonMessage?: string;
}

export function AuthModal({
  isOpen,
  onClose,
  onAuthenticated,
  initialMode = 'login',
  initialReferralCode = '',
  reasonMessage,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user =
        mode === 'login'
          ? await api.login(identifier, password)
          : await api.signup({
              username,
              displayName,
              email,
              password,
              birthYear: birthYear ? Number(birthYear) : undefined,
              referralCode: referralCode.trim() || undefined,
            });
      onAuthenticated(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoSignIn() {
    setError(null);
    setLoading(true);
    try {
      const user = await api.demoLogin();
      onAuthenticated(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign into demo account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'login' ? 'Sign in to SnapGram' : 'Create SnapGram account'}
    >
      <div className="w-full sm:max-w-md bg-[#121216] border border-white/[0.09] rounded-t-3xl sm:rounded-3xl p-6 pb-8 sm:pb-6 shadow-2xl">
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {mode === 'login' ? 'Sign in to SnapGram' : 'Join SnapGram'}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              {reasonMessage || 'Share 24-hour stories, vertical reels, and private snaps.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 rounded-xl border border-white/[0.06] mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`min-h-[40px] text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              mode === 'login' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`min-h-[40px] text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              mode === 'signup' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign up
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-sm text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'login' ? (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Username or email
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="maya_lin or maya@snapgram.demo"
                  autoComplete="username"
                  className="w-full h-12 pl-10 pr-4 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="alex_frames"
                    autoComplete="username"
                    className="w-full h-12 px-3.5 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Display name</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex Rivera"
                    autoComplete="name"
                    className="w-full h-12 px-3.5 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    autoComplete="email"
                    className="w-full h-12 pl-10 pr-4 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Birth year (optional)
                  </label>
                  <input
                    type="number"
                    min={1900}
                    max={new Date().getFullYear() - 13}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="e.g. 1998"
                    className="w-full h-12 px-3.5 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white tabular-nums placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Referral code (optional)
                  </label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder="SG-..."
                    className="w-full h-12 px-3.5 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full h-12 pl-10 pr-4 bg-zinc-950 border border-white/[0.1] rounded-xl text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white text-zinc-950 font-semibold text-sm hover:bg-zinc-200 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="relative my-5 flex items-center">
          <div className="flex-1 border-t border-white/[0.08]" />
          <span className="px-3 text-xs text-zinc-500">or try immediately</span>
          <div className="flex-1 border-t border-white/[0.08]" />
        </div>

        <button
          type="button"
          onClick={handleDemoSignIn}
          disabled={loading}
          className="w-full h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium text-sm hover:bg-amber-500/20 active:scale-[0.99] transition-all"
        >
          Continue as Demo Creator (@maya_lin)
        </button>
      </div>
    </div>
  );
}
