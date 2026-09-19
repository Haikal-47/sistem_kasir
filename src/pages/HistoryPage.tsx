import React, { useState } from 'react';
import { usePOS } from '../context/POSContext';
import { Transaction } from '../types';
import { formatRupiah, formatDateTime } from '../utils/formatters';
import { 
  Receipt, 
  Search, 
  Filter, 
  Eye, 
  Printer, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Banknote, 
  CreditCard,
  X,
  Calendar
} from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const { transactions, setSelectedReceipt, confirmTransferPayment, cancelTransaction } = usePOS();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');
  const [methodFilter, setMethodFilter] = useState<string>('SEMUA');
  const [selectedTxDetail, setSelectedTxDetail] = useState<Transaction | null>(null);

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQ = !q || 
      tx.invoiceNumber.toLowerCase().includes(q) ||
      tx.cashierName.toLowerCase().includes(q) ||
      tx.items.some(it => it.name.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'SEMUA' || tx.status === statusFilter;
    const matchesMethod = methodFilter === 'SEMUA' || tx.paymentMethod === methodFilter;

    return matchesQ && matchesStatus && matchesMethod;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
      
      {/* Header Bar */}
      <div className="p-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-brand-600" />
            <span>Riwayat Transaksi Kasir</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Arsip seluruh transaksi penjualan, nota pembayaran kasir, dan status pelunasan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
            Total Transaksi: <strong className="text-slate-900">{transactions.length}</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari no. invoice, kasir, atau nama item..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 focus:border-brand-600 rounded-xl text-xs text-slate-800 outline-hidden transition-all shadow-2xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 outline-hidden focus:border-brand-600 shadow-2xs"
            >
              <option value="SEMUA">Semua Status</option>
              <option value="LUNAS">Lunas</option>
              <option value="MENUNGGU_KONFIRMASI">Menunggu Konfirmasi</option>
              <option value="BATAL">Batal</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Metode:</span>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 outline-hidden focus:border-brand-600 shadow-2xs"
            >
              <option value="SEMUA">Semua Metode</option>
              <option value="TUNAI">Tunai</option>
              <option value="TRANSFER">Transfer / QRIS</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">No. Invoice & Waktu</th>
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4">Detail Item</th>
                <th className="py-3 px-4">Metode Bayar</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTransactions.map((tx) => {
                const totalItemCount = tx.items.reduce((sum, it) => sum + it.quantity, 0);

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Invoice & Date */}
                    <td className="py-3 px-4">
                      <div className="font-bold font-mono text-slate-900 text-xs">{tx.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formatDateTime(tx.date)}</span>
                      </div>
                    </td>

                    {/* Cashier Name */}
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {tx.cashierName}
                    </td>

                    {/* Items snippet */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-slate-800 truncate">
                        {tx.items.map(it => `${it.name} (${it.quantity})`).join(', ')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Total {totalItemCount} barang
                      </div>
                    </td>

                    {/* Payment Method */}
                    <td className="py-3 px-4">
                      {tx.paymentMethod === 'TUNAI' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                          <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tunai</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 text-[11px] font-bold border border-sky-200">
                          <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                          <span>Transfer</span>
                        </span>
                      )}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 px-4 font-extrabold font-mono text-slate-900 text-xs">
                      {formatRupiah(tx.total)}
                    </td>

                    {/* Status Pill */}
                    <td className="py-3 px-4">
                      {tx.status === 'LUNAS' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Lunas</span>
                        </span>
                      )}
                      {tx.status === 'MENUNGGU_KONFIRMASI' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold animate-pulse">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Perlu Konfirmasi</span>
                        </span>
                      )}
                      {tx.status === 'BATAL' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Batal</span>
                        </span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Quick Confirm button if pending */}
                        {tx.status === 'MENUNGGU_KONFIRMASI' && (
                          <button
                            onClick={() => confirmTransferPayment(tx.id)}
                            className="py-1 px-2.5 rounded-lg bg-brand-600 text-white font-bold text-[11px] hover:bg-brand-700 transition-colors shadow-2xs"
                            title="Konfirmasi Lunas Sekarang"
                          >
                            Konfirmasi
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedTxDetail(tx)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Lihat Detail Transaksi"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setSelectedReceipt(tx)}
                          className="p-1.5 text-slate-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Cetak Struk Transaksi"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTransactions.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs">
              Tidak ada catatan transaksi yang sesuai dengan filter.
            </div>
          )}
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTxDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] text-brand-400 font-mono uppercase font-bold tracking-wider">
                  Rincian Transaksi
                </span>
                <h3 className="font-bold text-sm text-white font-mono mt-0.5">
                  {selectedTxDetail.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTxDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-xs border border-slate-200">
                <div>
                  <span className="text-slate-500">Kasir Bertugas:</span>
                  <div className="font-bold text-slate-800">{selectedTxDetail.cashierName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Waktu Transaksi:</span>
                  <div className="font-medium text-slate-800">{formatDateTime(selectedTxDetail.date)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Metode Pembayaran:</span>
                  <div className="font-bold text-slate-800">{selectedTxDetail.paymentMethod}</div>
                </div>
                <div>
                  <span className="text-slate-500">Status Pembayaran:</span>
                  <div className={`font-bold ${selectedTxDetail.status === 'LUNAS' ? 'text-brand-600' : 'text-amber-600'}`}>
                    {selectedTxDetail.status}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Daftar Barang Belanja
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedTxDetail.items.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-slate-500 text-[10px]">
                          {item.quantity} x {formatRupiah(item.price)}
                        </div>
                      </div>
                      <div className="font-bold font-mono text-slate-900">
                        {formatRupiah(item.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculation Summary */}
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs border border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatRupiah(selectedTxDetail.subtotal)}</span>
                </div>
                {selectedTxDetail.discount > 0 && (
                  <div className="flex justify-between text-brand-600">
                    <span>Diskon</span>
                    <span className="font-mono">-{formatRupiah(selectedTxDetail.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Tagihan</span>
                  <span className="font-mono text-brand-700">{formatRupiah(selectedTxDetail.total)}</span>
                </div>

                {selectedTxDetail.paymentMethod === 'TUNAI' && (
                  <>
                    <div className="flex justify-between text-slate-600 pt-1">
                      <span>Uang Diterima</span>
                      <span className="font-mono">{formatRupiah(selectedTxDetail.cashGiven || selectedTxDetail.total)}</span>
                    </div>
                    <div className="flex justify-between text-brand-700 font-semibold">
                      <span>Kembalian</span>
                      <span className="font-mono">{formatRupiah(selectedTxDetail.changeAmount || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Transfer Proof section if available */}
              {selectedTxDetail.paymentMethod === 'TRANSFER' && selectedTxDetail.transferProofUrl && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Bukti Transfer Rekening
                  </span>
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 h-40">
                    <img
                      src={selectedTxDetail.transferProofUrl}
                      alt="Bukti Transfer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {selectedTxDetail.transferConfirmedBy && (
                    <p className="text-[11px] text-brand-700 font-medium">
                      ✓ Diverifikasi oleh {selectedTxDetail.transferConfirmedBy} pada {formatDateTime(selectedTxDetail.transferConfirmedAt || '')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between gap-2">
              {selectedTxDetail.status === 'MENUNGGU_KONFIRMASI' && (
                <button
                  onClick={() => {
                    confirmTransferPayment(selectedTxDetail.id);
                    setSelectedTxDetail(null);
                  }}
                  className="py-2 px-4 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700"
                >
                  Konfirmasi Lunas Sekarang
                </button>
              )}

              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => {
                    const tx = selectedTxDetail;
                    setSelectedTxDetail(null);
                    setSelectedReceipt(tx);
                  }}
                  className="py-2 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-100 flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Struk</span>
                </button>

                <button
                  onClick={() => setSelectedTxDetail(null)}
                  className="py-2 px-4 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
