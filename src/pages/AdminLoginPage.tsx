import React, { useState, useRef } from 'react';
import { usePOS } from '../context/POSContext';
import { Lock, User, Eye, EyeOff, LogIn, Crown, ShieldAlert } from 'lucide-react';
import { ArfaLogo } from '../components/ArfaLogo';

interface AdminLoginPageProps {
  onLoginSuccess: () => void;
  onNavigateToKasir: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLoginSuccess, onNavigateToKasir }) => {
  const { login } = usePOS();
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('admin123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Masukkan username admin.');
      usernameRef.current?.focus();
      return;
    }
    if (!password) {
      setError('Masukkan kata sandi admin.');
      passwordRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setError('');

    const res = await login(username.trim(), password, 'admin');
    setIsLoading(false);

    if (res.success) {
      onLoginSuccess();
    } else {
      setIsShaking(true);
      setError(res.error || 'Login admin gagal. Periksa username dan kata sandi.');
      setTimeout(() => setIsShaking(false), 600);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-600/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
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
        className={`relative w-full max-w-md bg-slate-900 rounded-3xl border border-amber-900/40 shadow-2xl overflow-hidden transition-all duration-300 ${
          isShaking ? 'animate-[shake_0.5s_ease-in-out]' : ''
        }`}
        style={isShaking ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        {/* Top Gold Stripe */}
        <div className="h-1.5 bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-500" />

        {/* Header */}
        <div className="px-8 pt-7 pb-5 text-center border-b border-slate-800">
          <div className="flex justify-center mb-3">
            <ArfaLogo size={68} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-bold mb-2">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>PORTAL LOGIN ADMIN</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            ARFA FASHION POS
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Khusus pemilik toko &amp; administrator sistem POS
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="px-8 py-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs animate-in fade-in duration-200">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Username Admin
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
                placeholder="admin"
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 focus:border-amber-500 focus:bg-slate-800/90 rounded-xl text-white text-sm outline-none transition-all placeholder:text-slate-500 font-medium"
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Kata Sandi Admin
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
                placeholder="••••••••"
                className="w-full pl-10 pr-12 py-3 bg-slate-800 border border-slate-700 focus:border-amber-500 focus:bg-slate-800/90 rounded-xl text-white text-sm outline-none transition-all placeholder:text-slate-500"
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
              Default admin: <span className="font-mono text-amber-300">admin</span> / <span className="font-mono text-amber-300">admin123</span>
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all mt-2 ${
              isLoading || !username.trim() || !password
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memvalidasi Akses Admin...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Masuk ke Dashboard Admin</span>
              </>
            )}
          </button>
        </form>

        {/* Switch to Kasir Login Footer */}
        <div className="px-8 pb-6 pt-3 text-center border-t border-slate-800/80 space-y-2">
          <p className="text-xs text-slate-400">
            Bukan Administrator toko?
          </p>
          <button
            type="button"
            onClick={onNavigateToKasir}
            className="text-xs font-bold text-brand-400 hover:text-brand-300 hover:underline transition-colors"
          >
            ← Beralih ke Terminal Login Kasir
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
