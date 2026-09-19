import React, { useEffect, useState } from 'react';
import { usePOS } from './context/POSContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { TransactionPage } from './pages/TransactionPage';
import { ProductsPage } from './pages/ProductsPage';
import { HistoryPage } from './pages/HistoryPage';
import { DashboardPage } from './pages/DashboardPage';
import { MobileScannerPage } from './pages/MobileScannerPage';
import { LoginPage } from './pages/LoginPage';
import { CheckoutModal } from './components/CheckoutModal';
import { ReceiptModal } from './components/ReceiptModal';
import { PaymentMethodsModal } from './components/PaymentMethodsModal';
import { PaymentMethodsPage } from './pages/PaymentMethodsPage';

export const App: React.FC = () => {
  const { activeTab, setActiveTab, isPaymentMethodsOpen, setIsPaymentMethodsOpen } = usePOS();

  // Check if browser is opened as dedicated Mobile Handheld Scanner
  const isScannerMode = window.location.search.includes('mode=scanner');

  // Auth gate — uses sessionStorage so logout happens on browser close
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('pos_logged_in') === 'true';
  });

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('pos_logged_in');
    sessionStorage.removeItem('pos_login_name');
    setIsLoggedIn(false);
  };

  // Global hotkeys for POS cashier speed (only in normal POS mode)
  useEffect(() => {
    if (isScannerMode || !isLoggedIn) return;

    const handleGlobalKeys = (e: KeyboardEvent) => {
      // F1 -> Transaksi
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('transaksi');
      }
      // F2 -> Dashboard & Antrean
      else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('dashboard');
      }
      // F3 -> Produk
      else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('produk');
      }
      // F4 -> Riwayat
      else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('riwayat');
      }
      // F5 -> Metode Pembayaran
      else if (e.key === 'F5') {
        e.preventDefault();
        setActiveTab('metode');
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [setActiveTab, isScannerMode, isLoggedIn]);

  // If opened on smartphone in scanner mode, show dedicated mobile scanner view
  if (isScannerMode) {
    return <MobileScannerPage />;
  }

  // Login gate
  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      {/* 1. Minimalist Sidebar (desktop only; mobile gets bottom nav inside Sidebar component) */}
      <Sidebar onLogout={handleLogout} />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header with live clock and cashier status */}
        <Header />

        {/* Dynamic Page Views — add pb-16 on mobile to clear the fixed bottom nav */}
        <main className="flex-1 flex overflow-hidden pb-16 md:pb-0">
          {activeTab === 'transaksi' && <TransactionPage />}
          {activeTab === 'dashboard' && <DashboardPage />}
          {activeTab === 'produk' && <ProductsPage />}
          {activeTab === 'riwayat' && <HistoryPage />}
          {activeTab === 'metode' && <PaymentMethodsPage />}
        </main>
      </div>

      {/* Modals */}
      <CheckoutModal />
      <ReceiptModal />
      <PaymentMethodsModal
        isOpen={isPaymentMethodsOpen}
        onClose={() => setIsPaymentMethodsOpen(false)}
      />
    </div>
  );
};
