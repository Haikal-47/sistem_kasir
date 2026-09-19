import React, { useEffect } from 'react';
import { usePOS } from './context/POSContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { TransactionPage } from './pages/TransactionPage';
import { ProductsPage } from './pages/ProductsPage';
import { HistoryPage } from './pages/HistoryPage';
import { DashboardPage } from './pages/DashboardPage';
import { CheckoutModal } from './components/CheckoutModal';
import { ReceiptModal } from './components/ReceiptModal';

export const App: React.FC = () => {
  const { activeTab, setActiveTab } = usePOS();

  // Global hotkeys for POS cashier speed
  useEffect(() => {
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
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [setActiveTab]);

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
      {/* 1. Minimalist Sidebar */}
      <Sidebar />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header with live clock and cashier status */}
        <Header />

        {/* Dynamic Page Views */}
        <main className="flex-1 flex overflow-hidden">
          {activeTab === 'transaksi' && <TransactionPage />}
          {activeTab === 'dashboard' && <DashboardPage />}
          {activeTab === 'produk' && <ProductsPage />}
          {activeTab === 'riwayat' && <HistoryPage />}
        </main>
      </div>

      {/* Modals */}
      <CheckoutModal />
      <ReceiptModal />
    </div>
  );
};
