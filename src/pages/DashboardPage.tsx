import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { formatRupiah, formatDateTime } from '../utils/formatters';
import { 
  LayoutDashboard, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Receipt, 
  AlertTriangle, 
  ArrowUpRight, 
  ScanLine,
  Eye,
  Check,
  X,
  CreditCard
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { 
    transactions, 
    products, 
    pendingConfirmations, 
    confirmTransferPayment, 
    cancelTransaction, 
    setActiveTab, 
    updateProduct 
  } = usePOS();

  const [previewProof, setPreviewProof] = useState<string | null>(null);

  // Statistics
  const completedTransactions = transactions.filter(t => t.status === 'LUNAS');
  const totalRevenue = completedTransactions.reduce((sum, t) => sum + t.total, 0);
  const lowStockProducts = products.filter(p => p.stock <= 5);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-100 p-4 md:p-6 space-y-4 md:space-y-6">
      
      {/* Top Banner with Quick POS Jump */}
      <div className="bg-slate-900 text-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <span className="text-brand-400 text-xs font-mono font-bold uppercase tracking-wider">
            Terminal Kasir Aktif
          </span>
          <h1 className="text-xl md:text-2xl font-black tracking-tight mt-1">
            Dashboard Operasional Kasir
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pantau ringkasan shift hari ini, notifikasi antrean verifikasi transfer, dan kontrol stok.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('transaksi')}
          className="py-3 px-5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <ScanLine className="w-4 h-4" />
          <span>Buka POS Transaksi (F1)</span>
          <ArrowUpRight className="w-4 h-4 ml-0.5" />
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omset */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Omset Shift Ini</span>
            <div className="text-xl font-black font-mono text-slate-900 mt-1">
              {formatRupiah(totalRevenue)}
            </div>
            <span className="text-[10px] text-brand-600 font-semibold mt-0.5 inline-block">
              {completedTransactions.length} transaksi lunas
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Transaksi Berhasil */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Transaksi Lunas</span>
            <div className="text-xl font-black font-mono text-slate-900 mt-1">
              {completedTransactions.length}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 inline-block">
              Siap cetak struk nota
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Menunggu Konfirmasi */}
        <div className={`p-5 rounded-2xl border shadow-xs flex items-center justify-between transition-colors ${
          pendingConfirmations.length > 0
            ? 'bg-amber-50/70 border-amber-300'
            : 'bg-white border-slate-200'
        }`}>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Perlu Konfirmasi</span>
            <div className={`text-xl font-black font-mono mt-1 ${pendingConfirmations.length > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
              {pendingConfirmations.length}
            </div>
            <span className={`text-[10px] font-semibold mt-0.5 inline-block ${pendingConfirmations.length > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
              {pendingConfirmations.length > 0 ? 'Cek bukti transfer segera' : 'Semua pembayaran tuntas'}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            pendingConfirmations.length > 0 ? 'bg-amber-200 text-amber-900 animate-pulse' : 'bg-slate-100 text-slate-500'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Stok Rendah */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Peringatan Stok</span>
            <div className={`text-xl font-black font-mono mt-1 ${lowStockProducts.length > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {lowStockProducts.length} Produk
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 inline-block">
              Stok &lt;= 5 unit tersisa
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Row: Antrean Pembayaran Transfer (Perlu Konfirmasi) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Antrean Konfirmasi Pembayaran Transfer & QRIS
              </h2>
              <p className="text-xs text-slate-500">
                Kasir memeriksa foto bukti transfer dan memvalidasi sebelum status diubah menjadi Lunas.
              </p>
            </div>
          </div>

          <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
            {pendingConfirmations.length} Menunggu Verifikasi
          </span>
        </div>

        {pendingConfirmations.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
            <p className="font-semibold text-slate-700">Tidak ada antrean pembayaran transfer!</p>
            <p className="mt-0.5">Semua transaksi pembayaran telah selesai diverifikasi oleh kasir.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingConfirmations.map((tx) => (
              <div
                key={tx.id}
                className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/30 flex flex-col justify-between gap-3 transition-all hover:border-amber-300 shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900">{tx.invoiceNumber}</span>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {formatDateTime(tx.date)} • Kasir: {tx.cashierName}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-brand-700">{formatRupiah(tx.total)}</span>
                      <div className="text-[10px] text-slate-500">{tx.items.length} macam barang</div>
                    </div>
                  </div>

                  {/* Channel / Bank info */}
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-700 font-medium">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    <span>{tx.transferBank || 'Transfer Bank / QRIS'}</span>
                  </div>

                  {/* Items preview snippet */}
                  <div className="mt-2 text-xs text-slate-600 line-clamp-1 bg-white/70 p-1.5 rounded-lg border border-amber-100">
                    {tx.items.map(it => `${it.name} (${it.quantity})`).join(', ')}
                  </div>
                </div>

                {/* Proof thumbnail & Confirmation Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200/80">
                  {tx.transferProofUrl && (
                    <button
                      onClick={() => setPreviewProof(tx.transferProofUrl || null)}
                      className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                      title="Perbesar Bukti Transfer"
                    >
                      <Eye className="w-3.5 h-3.5 text-brand-600" />
                      <span>Cek Bukti</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => {
                        if (confirm(`Batalkan transaksi ${tx.invoiceNumber}? Stok produk akan dikembalikan.`)) {
                          cancelTransaction(tx.id);
                        }
                      }}
                      className="py-1.5 px-3 rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors"
                    >
                      Tolak
                    </button>

                    <button
                      onClick={() => confirmTransferPayment(tx.id)}
                      className="py-1.5 px-4 rounded-xl bg-brand-600 text-white hover:bg-brand-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Konfirmasi Lunas</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row: Low Stock Warning */}
      {lowStockProducts.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-sm text-slate-900">
              Peringatan Stok Kritis (Segera Restock)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/40 flex items-center justify-between gap-2"
              >
                <div>
                  <h4 className="font-bold text-xs text-slate-800 leading-snug truncate max-w-[180px]">
                    {p.name}
                  </h4>
                  <div className="text-[10px] text-rose-700 font-bold mt-0.5">
                    Sisa stok: {p.stock} {p.unit}
                  </div>
                </div>

                <button
                  onClick={() => updateProduct(p.id, { stock: p.stock + 10 })}
                  className="py-1 px-2.5 rounded-lg bg-white border border-rose-200 text-slate-700 text-[11px] font-bold hover:bg-rose-100 transition-colors shadow-2xs whitespace-nowrap"
                  title="Tambah 10 unit ke stok"
                >
                  +10 Stok
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proof Image Preview Modal */}
      {previewProof && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold">Pratinjau Bukti Transfer Pelanggan</span>
              <button onClick={() => setPreviewProof(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center">
              <img src={previewProof} alt="Bukti Transfer" className="max-h-[60vh] object-contain rounded-lg shadow-sm" />
            </div>
            <div className="p-3 bg-white border-t border-slate-200 text-right">
              <button
                onClick={() => setPreviewProof(null)}
                className="py-1.5 px-4 bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
