import React from 'react';
import { usePOS } from '../context/POSContext';
import { 
  ScanLine, 
  LayoutDashboard, 
  Package, 
  Receipt, 
  UserCircle2, 
  LogOut, 
  CreditCard, 
  Crown,
  Boxes,
  BarChart3,
  Users,
  Settings
} from 'lucide-react';
import { ArfaLogo } from './ArfaLogo';
import { ActiveTab } from '../types';

interface SidebarProps {
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const { activeTab, setActiveTab, pendingConfirmations, cashier, currentUser, isSuperAdmin, setIsProfileModalOpen } = usePOS();

  // Admin menu (all 9 items)
  const adminNavItems: { id: ActiveTab; label: string; icon: any; shortcut?: string; badge?: number }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: pendingConfirmations.length,
      shortcut: 'F1',
    },
    {
      id: 'transaksi',
      label: 'Kasir POS',
      icon: ScanLine,
      shortcut: 'F2',
    },
    {
      id: 'produk',
      label: 'Produk',
      icon: Package,
      shortcut: 'F3',
    },
    {
      id: 'stok',
      label: 'Stok',
      icon: Boxes,
      shortcut: 'F4',
    },
    {
      id: 'riwayat',
      label: 'Riwayat',
      icon: Receipt,
      shortcut: 'F5',
    },
    {
      id: 'laporan',
      label: 'Laporan',
      icon: BarChart3,
      shortcut: 'F6',
    },
    {
      id: 'pengguna',
      label: 'Pengguna',
      icon: Users,
    },
    {
      id: 'metode',
      label: 'Metode',
      icon: CreditCard,
    },
    {
      id: 'pengaturan',
      label: 'Pengaturan',
      icon: Settings,
    },
  ];

  // Kasir menu (only 3 allowed items)
  const kasirNavItems: { id: ActiveTab; label: string; icon: any; shortcut?: string; badge?: number }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: pendingConfirmations.length,
      shortcut: 'F1',
    },
    {
      id: 'transaksi',
      label: 'Kasir POS',
      icon: ScanLine,
      shortcut: 'F2',
    },
    {
      id: 'riwayat',
      label: 'Riwayat',
      icon: Receipt,
      shortcut: 'F3',
    },
  ];

  const navItems = isSuperAdmin ? adminNavItems : kasirNavItems;

  const handleLogout = () => {
    const displayName = currentUser?.name || cashier.name;
    if (confirm(`Keluar dari sesi akun "${displayName}"?`)) {
      onLogout();
    }
  };

  const displayName = currentUser?.name || cashier.name;

  return (
    <>
      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside className="hidden md:flex w-[78px] bg-slate-950 text-slate-300 flex-col justify-between items-center py-3 border-r border-slate-800/80 select-none z-30 shrink-0">
        
        {/* Brand Icon & Logo */}
        <div 
          className="flex flex-col items-center gap-1 cursor-pointer shrink-0 mb-2 group" 
          onClick={() => setActiveTab(isSuperAdmin ? 'dashboard' : 'transaksi')} 
          title="ARFA FASHION POS"
        >
          <div className="transition-transform group-hover:scale-105">
            <ArfaLogo size={38} />
          </div>
          <span className="text-[8px] tracking-wider uppercase font-black text-pink-300 text-center leading-tight">
            ARFA POS
          </span>
        </div>

        {/* Nav Menu (Scrollable if many items) */}
        <nav className="flex-1 flex flex-col gap-1.5 w-full px-2 overflow-y-auto scrollbar-none py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-150 group ${
                  isActive
                    ? isSuperAdmin
                      ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30 ring-1 ring-amber-400/50'
                      : 'bg-brand-600 text-white font-bold shadow-md shadow-brand-600/30 ring-1 ring-brand-400/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
                title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
              >
                <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                <span className="text-[10px] font-semibold leading-tight mt-0.5 truncate max-w-[66px] text-center">
                  {item.label}
                </span>

                {/* Badge for notifications */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-[9px] font-extrabold ring-2 ring-slate-950 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="flex flex-col items-center gap-1.5 w-full px-2 border-t border-slate-800/80 pt-2 shrink-0">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex flex-col items-center text-center group cursor-pointer w-full p-1 rounded-xl hover:bg-slate-900 transition-colors"
            title={`Role: ${isSuperAdmin ? 'Super Admin' : 'Kasir'}\nNama: ${displayName}\nKlik untuk lihat profil / ubah kata sandi`}
          >
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
              isSuperAdmin
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-400 group-hover:border-amber-400'
                : 'bg-slate-900 border-slate-700 text-brand-400 group-hover:border-brand-500'
            }`}>
              {isSuperAdmin ? <Crown className="w-3.5 h-3.5" /> : <UserCircle2 className="w-4 h-4" />}
            </div>
            <span className="text-[9.5px] text-slate-200 font-bold truncate max-w-[66px] mt-0.5 leading-none">
              {displayName}
            </span>
            <span className={`text-[8px] uppercase tracking-tighter mt-0.5 leading-none font-bold ${
              isSuperAdmin ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {isSuperAdmin ? 'Admin' : 'Kasir'}
            </span>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            title="Keluar / Logout"
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors flex flex-col items-center"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[8.5px] font-medium mt-0.5">Keluar</span>
          </button>
        </div>
      </aside>

      {/* ===== MOBILE BOTTOM NAVIGATION BAR ===== */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950 border-t border-slate-800 flex items-stretch shadow-2xl overflow-x-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex-1 min-w-[54px] flex flex-col items-center justify-center py-2 gap-0.5 transition-all duration-150 ${
                isActive
                  ? isSuperAdmin ? 'text-amber-400' : 'text-brand-400'
                  : 'text-slate-500 active:text-slate-300'
              }`}
            >
              {isActive && (
                <span className={`absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full ${
                  isSuperAdmin ? 'bg-amber-400' : 'bg-brand-400'
                }`} />
              )}
              <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[9px] font-semibold leading-none truncate max-w-[50px]">
                {item.label}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-[8px] font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={handleLogout}
          className="flex-1 min-w-[54px] flex flex-col items-center justify-center py-2 gap-0.5 text-slate-600 active:text-rose-400"
          title="Keluar / Logout"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-[9px] font-semibold leading-none">Keluar</span>
        </button>
      </nav>
    </>
  );
};
