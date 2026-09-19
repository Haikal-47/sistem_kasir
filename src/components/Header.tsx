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
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs shrink-0 z-20">
        {/* Left: Outlet & Station Name */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              {cashier.outletName}
            </h1>
            <span className="text-xs text-slate-600 font-mono">Terminal #01</span>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Online • {cashier.shift}
          </div>
        </div>

        {/* Right: Cashier Name, Pending Alert, Clock, Help */}
        <div className="flex items-center gap-4">
          {/* Pending notification trigger */}
          {pendingConfirmations.length > 0 && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors animate-bounce"
              title="Klik untuk membuka antrean konfirmasi transfer"
            >
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <span>{pendingConfirmations.length} Transfer Perlu Dicek</span>
            </button>
          )}

          {/* Cashier Badge */}
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>Kasir: <strong className="text-slate-800">{cashier.name}</strong></span>
          </div>

          {/* Realtime Clock */}
          <div className="flex items-center gap-2 font-mono text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-900">{formattedTime}</span>
            <span className="text-slate-500 hidden md:inline font-sans">| {formattedDate}</span>
          </div>

          {/* Keyboard shortcut help */}
          <button
            onClick={() => setShowShortcutModal(true)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
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
