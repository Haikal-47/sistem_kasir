import React from 'react';
import { usePOS } from '../context/POSContext';
import { 
  ScanLine, 
  LayoutDashboard, 
  Package, 
  Receipt, 
  UserCircle2, 
  RotateCcw,
  Store,
  LogOut,
  CreditCard
} from 'lucide-react';
import { ArfaLogo } from './ArfaLogo';

interface SidebarProps {
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const { activeTab, setActiveTab, pendingConfirmations, cashier, resetToDemoData } = usePOS();

  const navItems = [
    {
      id: 'transaksi' as const,
      label: 'Transaksi',
      icon: ScanLine,
      shortcut: 'F1',
    },
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: pendingConfirmations.length,
      shortcut: 'F2',
    },
    {
      id: 'produk' as const,
      label: 'Produk',
      icon: Package,
      shortcut: 'F3',
    },
    {
      id: 'riwayat' as const,
      label: 'Riwayat',
      icon: Receipt,
      shortcut: 'F4',
    },
    {
      id: 'metode' as const,
      label: 'Metode',
      icon: CreditCard,
      shortcut: 'F5',
    },
  ];

  const handleLogout = () => {
    if (confirm(`Keluar dari sesi kasir "${cashier.name}"?`)) {
      onLogout();
    }
  };

  return (
    <>
      {/* ===== DESKTOP SIDEBAR (hidden on mobile) ===== */}
      <aside className="hidden md:flex w-20 bg-slate-900 text-slate-300 flex-col justify-between items-center py-4 border-r border-slate-800 select-none z-30 shrink-0">
        {/* Brand Icon & Logo */}
        <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setActiveTab('transaksi')} title="ARFA FASHION POS">
          <ArfaLogo size={44} />
          <span className="text-[8.5px] tracking-wider uppercase font-black text-pink-300 mt-1 text-center leading-tight">
            ARFA FASHION
          </span>
        </div>

        {/* Nav Menu */}
        <nav className="flex flex-col gap-3 w-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-brand-600 text-white font-semibold shadow-md shadow-brand-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
                title={`${item.label} (${item.shortcut})`}
              >
                <Icon className="w-6 h-6 mb-1 transition-transform group-hover:scale-110" />
                <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                <span className={`text-[9px] mt-0.5 opacity-60 font-mono ${isActive ? 'text-brand-100' : 'text-slate-500'}`}>
                  {item.shortcut}
                </span>

                {/* Pending Notification Badge for Dashboard */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold ring-2 ring-slate-900 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Cashier, Reset & Logout */}
        <div className="flex flex-col items-center gap-2 w-full px-2 border-t border-slate-800 pt-3">
          <button
            onClick={() => {
              if (confirm('Muat ulang data demo produk dan riwayat bawaan?')) {
                resetToDemoData();
              }
            }}
            title="Reset Data Demo"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs flex flex-col items-center"
          >
            <RotateCcw className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Reset</span>
          </button>

          <div className="flex flex-col items-center text-center group cursor-pointer" title={`Kasir: ${cashier.name}\n${cashier.shift}`}>
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400 group-hover:border-brand-500 transition-colors">
              <UserCircle2 className="w-6 h-6" />
            </div>
            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[64px] mt-1">
              {cashier.name.split(' ')[0]}
            </span>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            title="Keluar / Logout"
            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors flex flex-col items-center"
          >
            <LogOut className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Keluar</span>
          </button>
        </div>
      </aside>

      {/* ===== MOBILE BOTTOM NAVIGATION BAR (visible only on mobile) ===== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 flex items-stretch shadow-2xl"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all duration-200 ${
                isActive
                  ? 'text-brand-400'
                  : 'text-slate-500 active:text-slate-300'
              }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-brand-400" />
              )}

              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className={`text-[10px] font-semibold leading-none ${isActive ? 'text-brand-400' : 'text-slate-500'}`}>
                {item.label}
              </span>

              {/* Notification badge */}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1.5 left-[calc(50%+8px)] flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold ring-1 ring-slate-900 animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Mobile logout as last item */}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-slate-600 active:text-rose-400"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-semibold leading-none">Keluar</span>
        </button>
      </nav>
    </>
  );
};
