import React, { useState, useRef, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { KeyRound, Eye, EyeOff, LogIn, ShieldCheck, AlertCircle, Crown, User, CheckCircle2 } from 'lucide-react';
import { ArfaLogo } from '../components/ArfaLogo';
import { AVAILABLE_ROLES } from '../data/initialData';
import { UserRole } from '../types';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

// Default PIN — stored as base64 in localStorage key 'pos_pin'
const DEFAULT_PIN_B64 = btoa('123456');

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { cashier, switchRole } = usePOS();

  const [selectedRole, setSelectedRole] = useState<UserRole>(() => {
    return cashier.role || 'kasir';
  });
  const [name, setName] = useState<string>(() => {
    return cashier.name || 'Budi Pratama';
  });
  const [pin, setPin] = useState<string>('123456');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'super_admin') {
      setName('Super Admin');
    } else {
      setName('Budi Pratama');
    }
    setError('');
    pinRef.current?.focus();
  };

  const getStoredPin = (): string => {
    if (selectedRole === 'super_admin') {
      return localStorage.getItem('pos_admin_pin') || localStorage.getItem('pos_pin') || DEFAULT_PIN_B64;
    }
    return localStorage.getItem('pos_kasir_pin') || localStorage.getItem('pos_pin') || DEFAULT_PIN_B64;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Masukkan nama kasir/admin terlebih dahulu.');
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
        // Apply chosen role
        switchRole(selectedRole);

        // Save login session
        sessionStorage.setItem('pos_logged_in', 'true');
        sessionStorage.setItem('pos_login_name', name.trim());
        sessionStorage.setItem('pos_role', selectedRole);
        onLoginSuccess();
      } else {
        setIsShaking(true);
        setError('Kata sandi / PIN salah. Coba lagi. (Default: 123456)');
        setPin('');
        setIsLoading(false);
        pinRef.current?.focus();
        setTimeout(() => setIsShaking(false), 600);
      }
    }, 400);
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
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-slate-800/20 blur-3xl" />
        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Login Card */}
      <div
        className={`relative w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ${
          isShaking ? 'animate-[shake_0.5s_ease-in-out]' : ''
        }`}
        style={isShaking ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-brand-500 to-emerald-400" />

        {/* Header */}
        <div className="px-8 pt-7 pb-5 text-center border-b border-slate-800">
          <div className="flex justify-center mb-2.5">
            <ArfaLogo size={70} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            ARFA FASHION
          </h1>
          <p className="text-xs text-pink-400 font-bold tracking-wider uppercase mt-0.5">
            Sistem Kasir &amp; Inventaris
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Pilih role akun untuk masuk ke terminal POS
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

          {/* Role Selection Cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Pilih Role Akun
            </label>
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_ROLES.map((r) => {
                const isSelected = selectedRole === r.role;
                const isSuper = r.role === 'super_admin';
                return (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => handleSelectRole(r.role)}
                    className={`p-3 rounded-2xl border text-left transition-all duration-200 relative flex flex-col justify-between ${
                      isSelected
                        ? isSuper
                          ? 'bg-amber-950/40 border-amber-500 text-amber-200 shadow-lg shadow-amber-900/30 ring-1 ring-amber-500/50'
                          : 'bg-brand-950/40 border-brand-500 text-brand-200 shadow-lg shadow-brand-900/30 ring-1 ring-brand-500/50'
                        : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-white">
                        {isSuper ? (
                          <Crown className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                        ) : (
                          <User className={`w-4 h-4 ${isSelected ? 'text-brand-400' : 'text-slate-400'}`} />
                        )}
                        <span>{r.name}</span>
                      </div>
                      {isSelected && (
                        <CheckCircle2
                          className={`w-4 h-4 ${isSuper ? 'text-amber-400' : 'text-brand-400'}`}
                        />
                      )}
                    </div>
                    <p className="text-[11px] font-medium leading-snug line-clamp-2 opacity-85">
                      {isSuper ? 'Bisa tambah, edit, & hapus produk serta metode' : 'Hanya bisa melihat katalog & metode pembayaran'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Nama Pengguna
            </label>
            <div className="relative">
              <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
                placeholder="Nama pengguna..."
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 focus:border-brand-500 focus:bg-slate-800/80 rounded-xl text-white text-sm outline-none transition-all placeholder:text-slate-500"
                autoComplete="username"
              />
            </div>
          </div>

          {/* PIN Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Kata Sandi / PIN
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={pinRef}
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                onKeyDown={handlePinKeyDown}
                placeholder="••••••"
                className="w-full pl-10 pr-12 py-3 bg-slate-800 border border-slate-700 focus:border-brand-500 focus:bg-slate-800/80 rounded-xl text-white text-sm font-mono tracking-widest outline-none transition-all placeholder:text-slate-500 placeholder:tracking-normal"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                tabIndex={-1}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 ml-1">
              Kata sandi / PIN default: <span className="font-mono text-slate-400">123456</span>
            </p>
          </div>

          {/* PIN Dot Indicator */}
          <div className="flex items-center justify-center gap-2 py-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                  i < pin.length
                    ? selectedRole === 'super_admin'
                      ? 'bg-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                      : 'bg-brand-500 scale-110 shadow-sm shadow-brand-500/50'
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
                : selectedRole === 'super_admin'
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 active:scale-[0.98]'
                : 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30 active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memverifikasi role &amp; PIN...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Masuk sebagai {selectedRole === 'super_admin' ? 'Super Admin' : 'Kasir'}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-8 pb-6 text-center border-t border-slate-800/60 pt-4">
          <p className="text-[11px] text-slate-500">
            Sistem Kasir POS • Multi-Role Access Control v1.1
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
