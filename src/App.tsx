import React, { useEffect, useState, useCallback } from 'react';
import { usePOS } from './context/POSContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { TransactionPage } from './pages/TransactionPage';
import { ProductsPage } from './pages/ProductsPage';
import { HistoryPage } from './pages/HistoryPage';
import { DashboardPage } from './pages/DashboardPage';
import { MobileScannerPage } from './pages/MobileScannerPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { KasirLoginPage } from './pages/KasirLoginPage';
import { StokPage } from './pages/StokPage';
import { LaporanPage } from './pages/LaporanPage';
import { PenggunaPage } from './pages/PenggunaPage';
import { PengaturanPage } from './pages/PengaturanPage';
import { PaymentMethodsPage } from './pages/PaymentMethodsPage';
import { CheckoutModal } from './components/CheckoutModal';
import { ReceiptModal } from './components/ReceiptModal';
import { PaymentMethodsModal } from './components/PaymentMethodsModal';
import { ProfileModal } from './components/ProfileModal';
import { ActiveTab } from './types';

export const App: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isPaymentMethodsOpen,
    setIsPaymentMethodsOpen,
    currentUser,
    isSuperAdmin,
    logout
  } = usePOS();

  // Check if browser is opened as dedicated Mobile Handheld Scanner
  const isScannerMode = window.location.search.includes('mode=scanner');

  // Track login state from sessionStorage
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('pos_logged_in') === 'true';
  });

  // Track login portal view when not logged in ('admin' | 'kasir')
  const [loginPortal, setLoginPortal] = useState<'admin' | 'kasir'>(() => {
    const path = window.location.pathname.toLowerCase();
    return path.startsWith('/admin') ? 'admin' : 'kasir';
  });

  // Handle URL sync and route guard
  useEffect(() => {
    const handleLocation = () => {
      const path = window.location.pathname.toLowerCase();

      if (!isLoggedIn) {
        if (path.startsWith('/admin')) {
          setLoginPortal('admin');
        } else {
          setLoginPortal('kasir');
        }
        return;
      }

      // User IS logged in: enforce role access
      if (!isSuperAdmin) {
        // KASIR ROUTE GUARD:
        // Kasir cannot visit /admin/* or admin tabs
        if (path.startsWith('/admin')) {
          console.warn('Access denied: Kasir attempted to visit admin route');
          window.history.replaceState(null, '', '/kasir/dashboard');
          setActiveTab('dashboard');
          return;
        }

        // Allowed tabs for Kasir
        const kasirAllowed: ActiveTab[] = ['dashboard', 'transaksi', 'riwayat'];
        const matchedTab = path.replace('/kasir/', '') as ActiveTab;

        if (kasirAllowed.includes(matchedTab)) {
          if (activeTab !== matchedTab) setActiveTab(matchedTab);
        } else if (path.startsWith('/kasir') && matchedTab) {
          // If trying to access admin tab like /kasir/stok, reset to dashboard
          window.history.replaceState(null, '', '/kasir/dashboard');
          setActiveTab('dashboard');
        }
      } else {
        // ADMIN ROUTE:
        const matchedTab = (path.replace('/admin/', '') || path.replace('/kasir/', '')) as ActiveTab;
        const adminAllowed: ActiveTab[] = [
          'dashboard', 'transaksi', 'produk', 'stok', 'riwayat',
          'laporan', 'pengguna', 'metode', 'pengaturan'
        ];
        if (adminAllowed.includes(matchedTab)) {
          if (activeTab !== matchedTab) setActiveTab(matchedTab);
        }
      }
    };

    handleLocation();
    window.addEventListener('popstate', handleLocation);
    return () => window.removeEventListener('popstate', handleLocation);
  }, [isLoggedIn, isSuperAdmin, activeTab, setActiveTab]);

  // Sync browser URL whenever activeTab changes
  useEffect(() => {
    if (!isLoggedIn) return;

    const prefix = isSuperAdmin ? '/admin' : '/kasir';
    const targetPath = `${prefix}/${activeTab}`;
    if (window.location.pathname !== targetPath) {
      window.history.replaceState(null, '', targetPath);
    }
  }, [activeTab, isLoggedIn, isSuperAdmin]);

  // Enforce Kasir cannot stay on admin tabs
  useEffect(() => {
    if (isLoggedIn && !isSuperAdmin) {
      const adminTabs: ActiveTab[] = ['produk', 'stok', 'laporan', 'pengguna', 'metode', 'pengaturan'];
      if (adminTabs.includes(activeTab)) {
        setActiveTab('dashboard');
      }
    }
  }, [isLoggedIn, isSuperAdmin, activeTab, setActiveTab]);

  const handleLoginSuccess = useCallback(() => {
    setIsLoggedIn(true);
    const role = sessionStorage.getItem('pos_user_role');
    const targetPath = role === 'admin' ? '/admin/dashboard' : '/kasir/dashboard';
    window.history.replaceState(null, '', targetPath);
    setActiveTab('dashboard');
  }, [setActiveTab]);

  const handleLogout = useCallback(() => {
    const wasAdmin = isSuperAdmin;
    logout();
    setIsLoggedIn(false);
    const nextPortal = wasAdmin ? 'admin' : 'kasir';
    setLoginPortal(nextPortal);
    window.history.replaceState(null, '', `/${nextPortal}/login`);
  }, [isSuperAdmin, logout]);

  // Global hotkeys for POS cashier speed
  useEffect(() => {
    if (isScannerMode || !isLoggedIn) return;

    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Shortcuts depending on role
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('dashboard');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('transaksi');
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (isSuperAdmin) setActiveTab('produk');
        else setActiveTab('riwayat');
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (isSuperAdmin) setActiveTab('stok');
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (isSuperAdmin) setActiveTab('riwayat');
      } else if (e.key === 'F6') {
        e.preventDefault();
        if (isSuperAdmin) setActiveTab('laporan');
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [setActiveTab, isScannerMode, isLoggedIn, isSuperAdmin]);

  // If opened on smartphone in scanner mode, show dedicated mobile scanner view
  if (isScannerMode) {
    return <MobileScannerPage />;
  }

  // Login Gate: separate Admin & Kasir Portals
  if (!isLoggedIn) {
    if (loginPortal === 'admin') {
      return (
        <AdminLoginPage
          onLoginSuccess={handleLoginSuccess}
          onNavigateToKasir={() => {
            setLoginPortal('kasir');
            window.history.replaceState(null, '', '/kasir/login');
          }}
        />
      );
    }

    return (
      <KasirLoginPage
        onLoginSuccess={handleLoginSuccess}
        onNavigateToAdmin={() => {
          setLoginPortal('admin');
          window.history.replaceState(null, '', '/admin/login');
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      {/* 1. Minimalist Sidebar (desktop only; mobile gets bottom nav inside Sidebar component) */}
      <Sidebar onLogout={handleLogout} />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header with live clock and cashier status */}
        <Header />

        {/* Dynamic Page Views — pb-16 on mobile to clear the fixed bottom nav */}
        <main className="flex-1 flex overflow-hidden pb-16 md:pb-0">
          {activeTab === 'transaksi' && <TransactionPage />}
          {activeTab === 'dashboard' && <DashboardPage />}
          {activeTab === 'produk' && isSuperAdmin && <ProductsPage />}
          {activeTab === 'stok' && isSuperAdmin && <StokPage />}
          {activeTab === 'riwayat' && <HistoryPage />}
          {activeTab === 'laporan' && isSuperAdmin && <LaporanPage />}
          {activeTab === 'pengguna' && isSuperAdmin && <PenggunaPage />}
          {activeTab === 'metode' && isSuperAdmin && <PaymentMethodsPage />}
          {activeTab === 'pengaturan' && isSuperAdmin && <PengaturanPage />}
        </main>
      </div>

      {/* Modals */}
      <CheckoutModal />
      <ReceiptModal />
      <PaymentMethodsModal
        isOpen={isPaymentMethodsOpen}
        onClose={() => setIsPaymentMethodsOpen(false)}
      />
      <ProfileModal />
    </div>
  );
};
