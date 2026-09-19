import React, { useState, useEffect } from 'react';
import { usePOS } from '../context/POSContext';
import { Clock, ShieldCheck, AlertCircle, HelpCircle, X } from 'lucide-react';

export const Header: React.FC = () => {
  const { cashier, pendingConfirmations, setActiveTab } = usePOS();
  const [time, setTime] = useState<Date>(new Date());
  const [showShortcutModal, setShowShortcutModal] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = time.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-200 px-3 md:px-6 flex items-center justify-between shadow-xs shrink-0 z-20">
        {/* Left: Outlet & Station Name */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <img src="/logo.png" alt="Kasir Kita" className="w-7 h-7 object-contain shrink-0" />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight truncate">
              {cashier.outletName}
            </h1>
            <span className="text-xs text-brand-600 font-bold hidden md:inline">Kasir Kita</span>
            <span className="text-xs text-slate-400 font-mono hidden md:inline">• Terminal #01</span>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-0.5 hidden md:block" />

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Online • {cashier.shift}
          </div>

          {/* Mobile: online indicator dot only */}
          <span className="md:hidden w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Online" />
        </div>

        {/* Right: Cashier Name, Pending Alert, Clock, Help */}
        <div className="flex items-center gap-1.5 md:gap-4">
          {/* Pending notification trigger – full on desktop, icon-only on mobile */}
          {pendingConfirmations.length > 0 && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors animate-bounce"
              title="Klik untuk membuka antrean konfirmasi transfer"
            >
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="hidden sm:inline">{pendingConfirmations.length} Transfer Perlu Dicek</span>
              <span className="sm:hidden font-bold">{pendingConfirmations.length}</span>
            </button>
          )}

          {/* Cashier Badge – hidden on very small screens */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" />
            <span className="hidden lg:inline">Kasir: </span>
            <strong className="text-slate-800">{cashier.name.split(' ')[0]}</strong>
          </div>

          {/* Realtime Clock */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="font-semibold text-slate-900">{formattedTime}</span>
            <span className="text-slate-500 hidden md:inline font-sans">| {formattedDate}</span>
          </div>

          {/* Keyboard shortcut help – desktop only */}
          <button
            onClick={() => setShowShortcutModal(true)}
            className="hidden md:block p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Panduan Pintasan Keyboard"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand-600" />
                Pintasan Keyboard Kasir
              </h3>
              <button
                onClick={() => setShowShortcutModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-sm mt-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">Buka Menu Transaksi</span>
                <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-xs font-semibold">F1</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">Buka Dashboard & Verifikasi</span>
                <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-xs font-semibold">F2</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">Buka Kelola Produk</span>
                <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-xs font-semibold">F3</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">Buka Riwayat Transaksi</span>
                <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-xs font-semibold">F4</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">Fokus ke Barcode Scanner</span>
                <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-xs font-semibold">F7</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">Bersihkan Keranjang Belanja</span>
                <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono text-xs font-semibold">F8</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">Proses Bayar / Checkout</span>
                <kbd className="px-2 py-1 bg-brand-50 border border-brand-300 text-brand-700 rounded font-mono text-xs font-semibold">F9</kbd>
              </div>
            </div>

            <button
              onClick={() => setShowShortcutModal(false)}
              className="mt-5 w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
