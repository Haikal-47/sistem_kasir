import React, { useState, useRef } from 'react';
import { usePOS } from '../context/POSContext';
import { Lock, User, Eye, EyeOff, LogIn, ShoppingBag, AlertCircle } from 'lucide-react';
import { ArfaLogo } from '../components/ArfaLogo';

interface KasirLoginPageProps {
  onLoginSuccess: () => void;
  onNavigateToAdmin: () => void;
}

export const KasirLoginPage: React.FC<KasirLoginPageProps> = ({ onLoginSuccess, onNavigateToAdmin }) => {
  const { login } = usePOS();
  const [username, setUsername] = useState<string>('gusti');
  const [password, setPassword] = useState<string>('123456');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Masukkan username kasir.');
      usernameRef.current?.focus();
      return;
    }
    if (!password) {
      setError('Masukkan kata sandi kasir.');
      passwordRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setError('');

    const res = await login(username.trim(), password, 'kasir');
    setIsLoading(false);

    if (res.success) {
      onLoginSuccess();
    } else {
      setIsShaking(true);
      setError(res.error || 'Login kasir gagal. Periksa username dan kata sandi.');
      setTimeout(() => setIsShaking(false), 600);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-600/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Login Box */}
      <div
        className={`relative w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ${
          isShaking ? 'animate-[shake_0.5s_ease-in-out]' : ''
        }`}
        style={isShaking ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        {/* Top Emerald Stripe */}
        <div className="h-1.5 bg-gradient-to-r from-brand-600 via-emerald-400 to-teal-500" />

        {/* Header */}
        <div className="px-8 pt-7 pb-5 text-center border-b border-slate-800">
          <div className="flex justify-center mb-3">
            <ArfaLogo size={68} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-950/70 border border-brand-500/40 text-brand-300 text-xs font-bold mb-2">
            <ShoppingBag className="w-3.5 h-3.5 text-brand-400" />
            <span>TERMINAL LOGIN KASIR</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            ARFA FASHION POS
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Masuk untuk melayani transaksi kasir toko fisik
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="px-8 py-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Username Kasir
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                placeholder="gusti"
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 focus:border-brand-500 focus:bg-slate-800/90 rounded-xl text-white text-sm outline-none transition-all placeholder:text-slate-500 font-medium"
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Kata Sandi / PIN Kasir
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="••••••"
                className="w-full pl-10 pr-12 py-3 bg-slate-800 border border-slate-700 focus:border-brand-500 focus:bg-slate-800/90 rounded-xl text-white text-sm outline-none transition-all placeholder:text-slate-500"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Default kasir: <span className="font-mono text-brand-300">gusti</span> / <span className="font-mono text-brand-300">123456</span>
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all mt-2 ${
              isLoading || !username.trim() || !password
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                : 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30 active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memvalidasi Akses Kasir...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Masuk ke Terminal Kasir</span>
              </>
            )}
          </button>
        </form>

        {/* Switch to Admin Login Footer */}
        <div className="px-8 pb-6 pt-3 text-center border-t border-slate-800/80 space-y-2">
          <p className="text-xs text-slate-400">
            Pemilik toko atau Administrator?
          </p>
          <button
            type="button"
            onClick={onNavigateToAdmin}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline transition-colors"
          >
            👑 Masuk ke Portal Login Admin →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};
