import React, { useState, useRef, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { Store, KeyRound, Eye, EyeOff, LogIn, ShieldCheck, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

// Default PIN — stored as base64 in localStorage key 'pos_pin'
// Can be changed: kasir type current PIN lalu set baru
const DEFAULT_PIN_B64 = btoa('123456');

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { cashier } = usePOS();

  const [name, setName] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    // Pre-fill kasir name from profile
    if (cashier?.name) {
      setName(cashier.name);
      setTimeout(() => pinRef.current?.focus(), 100);
    }
  }, [cashier]);

  const getStoredPin = (): string => {
    return localStorage.getItem('pos_pin') || DEFAULT_PIN_B64;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Masukkan nama kasir terlebih dahulu.');
      nameRef.current?.focus();
      return;
    }
    if (pin.length < 4) {
      setError('PIN minimal 4 digit.');
      pinRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setError('');

    // Simulate brief auth delay for realism
    setTimeout(() => {
      const storedPin = getStoredPin();
      const inputPinB64 = btoa(pin);

      if (inputPinB64 === storedPin) {
        // Save login session
        sessionStorage.setItem('pos_logged_in', 'true');
        sessionStorage.setItem('pos_login_name', name.trim());
        onLoginSuccess();
      } else {
        setIsShaking(true);
        setError('PIN salah. Coba lagi. (Default: 123456)');
        setPin('');
        setIsLoading(false);
        pinRef.current?.focus();
        setTimeout(() => setIsShaking(false), 600);
      }
    }, 500);
  };

  const handlePinKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-600/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-slate-800/20 blur-3xl" />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Login Card */}
      <div
        className={`relative w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ${
          isShaking ? 'animate-[shake_0.5s_ease-in-out]' : ''
        }`}
        style={isShaking ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-emerald-400" />

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-slate-800">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 shadow-xl shadow-brand-600/30 mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {cashier.outletName || 'POS PRO'}
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            Sistem Kasir Digital — Login Kasir
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="px-8 py-6 space-y-5">
          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Nama Kasir
            </label>
            <div className="relative">
              <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
                placeholder="Nama kasir bertugas..."
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 focus:border-brand-500 focus:bg-slate-800/80 rounded-xl text-white text-sm outline-none transition-all placeholder:text-slate-500"
                autoComplete="username"
              />
            </div>
          </div>

          {/* PIN Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              PIN Kasir
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={pinRef}
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }}
                onKeyDown={handlePinKeyDown}
                placeholder="••••••"
                inputMode="numeric"
                className="w-full pl-10 pr-12 py-3 bg-slate-800 border border-slate-700 focus:border-brand-500 focus:bg-slate-800/80 rounded-xl text-white text-sm font-mono tracking-widest outline-none transition-all placeholder:text-slate-500 placeholder:tracking-normal"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPin(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                tabIndex={-1}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 ml-1">
              PIN default: <span className="font-mono text-slate-400">123456</span>
            </p>
          </div>

          {/* PIN Dot Indicator */}
          <div className="flex items-center justify-center gap-2 py-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                  i < pin.length
                    ? 'bg-brand-500 scale-110 shadow-sm shadow-brand-500/50'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading || !name.trim() || pin.length < 4}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 ${
              isLoading || !name.trim() || pin.length < 4
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-600/30 active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Masuk ke Sistem Kasir</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-8 pb-6 text-center">
          <p className="text-[11px] text-slate-600">
            Sistem Kasir POS Pro v1.0 • Single Session
          </p>
        </div>
      </div>

      {/* Shake keyframe via inline style */}
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
